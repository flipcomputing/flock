let flock;

export function setFlockReference(ref) {
  flock = ref;
}

export const flockSound = {
  async playSound(meshName = "__everywhere__", soundName, options = {}) {
    const loop = !!options.loop;
    const volume = options.volume ?? 1;
    const playbackRate = options.playbackRate ?? 1;
    const soundUrl = flock.soundPath + soundName;

    // Global (non-spatial) sound
    if (meshName === "__everywhere__") {
      const sound = await flock.BABYLON.CreateSoundAsync(soundName, soundUrl, {
        spatialEnabled: false,
        autoplay: false,
        loop,
        volume,
        playbackRate,
      });

      sound.play();
      flock.globalSounds.push(sound);

      if (!loop) {
        return new Promise((resolve) => {
          sound.onEndedObservable.addOnce(() => {
            const index = flock.globalSounds.indexOf(sound);
            if (index !== -1) {
              flock.globalSounds.splice(index, 1);
            }
            resolve();
          });
        });
      }

      return sound;
    }

    // Spatial sound for a mesh
    const mesh = flock.scene.getMeshByName(meshName);
    if (mesh && !mesh.isDisposed?.()) {
      return await attachSoundToMesh(mesh);
    }

    // Mesh not ready yet — wait for it
    return flock.whenModelReady(meshName, async (resolvedMesh) => {
      return await attachSoundToMesh(resolvedMesh);
    });

    // Main sound logic for mesh-attached sounds
    async function attachSoundToMesh(mesh) {
      if (!mesh.metadata || typeof mesh.metadata !== "object") {
        mesh.metadata = {};
      }

      const currentSound = mesh.metadata.currentSound;

      if (currentSound) {
        try {
          currentSound.stop();
        } catch (e) {
          console.warn("Failed to stop sound:", e);
        }

        const index = flock.globalSounds.indexOf(currentSound);
        if (index !== -1) {
          flock.globalSounds.splice(index, 1);
        }

        if (mesh.metadata?.currentSound === currentSound) {
          delete mesh.metadata.currentSound;
        }
      }

      const sound = await flock.BABYLON.CreateSoundAsync(soundName, soundUrl, {
        spatialEnabled: true,
        spatialDistanceModel: "linear",
        spatialMaxDistance: 20,
        autoplay: false,
        loop,
        volume,
        playbackRate,
      });

      if (sound.spatial && !mesh.isDisposed()) {
        await sound.spatial.attach(mesh);
      }

      sound.play();

      if (!mesh.metadata || typeof mesh.metadata !== "object") {
        mesh.metadata = {};
      }

      mesh.metadata.currentSound = sound;
      sound._attachedMesh = mesh;

      if (!flock.globalSounds.includes(sound)) {
        flock.globalSounds.push(sound);
      }

      if (!loop) {
        return new Promise((resolve) => {
          sound.onEndedObservable.addOnce(() => {
            if (mesh.metadata?.currentSound === sound) {
              delete mesh.metadata.currentSound;
            }
            const index = flock.globalSounds.indexOf(sound);
            if (index !== -1) {
              flock.globalSounds.splice(index, 1);
            }
            resolve();
          });
        });
      }

      return sound;
    }
  },
  stopAllSounds() {
    flock.globalSounds.forEach((sound) => {
      try {
        const mesh = sound._attachedMesh;
        if (mesh?.metadata?.currentSound === sound) {
          delete mesh.metadata.currentSound;
        }

        sound.stop();
      } catch (e) {
        console.warn("Error stopping sound:", sound.name, e);
      }
    });

    flock.globalSounds = [];

    if (!flock.audioContext || flock.audioContext.state === "closed") return;

    // Close the audio context
    if (flock.audioContext) {
      flock.audioContext
        .close()
        .then(() => {
          console.log("Audio context closed.");
        })
        .catch((error) => {
          console.error("Error closing audio context:", error);
        });
    }
  },
  getAudioContext() {
    if (!flock.audioContext) {
      flock.audioContext = new (window.AudioContext ||
        window.webkitAudioContext)();
    }
    return flock.audioContext;
  },
  playNotes(
    meshName,
    {
      notes = [],
      durations = [],
      instrument = flock.createInstrument("square", { frequency: 440, attack: 0.1, decay: 0.3, sustain: 0.7, release: 1.0 })
    } = {},
  ) {
    return new Promise((resolve) => {
      flock.whenModelReady(meshName, async function (mesh) {
        notes = notes.map((note) => (note === "_" ? null : note));
        durations = durations.map(Number);

        const getBPM = (obj) => obj?.metadata?.bpm || null;
        const getBPMFromMeshOrScene = (mesh, scene) =>
          getBPM(mesh) || getBPM(mesh?.parent) || getBPM(scene) || 60;
        const bpm = getBPMFromMeshOrScene(mesh, flock.scene);

       
        let context = flock.audioContext; // Ensure a global audio context
        if (!context || context.state === "closed") {
          try {
            flock.audioContext = new (window.AudioContext || window.webkitAudioContext)();
            context = flock.audioContext;
            console.log("Created new audio context (previous was closed)");
          } catch (error) {
            console.error("Could not create audio context:", error);
            resolve();
            return;
          }
        }
        if (!context || context.state === "closed") {
          console.log("Audio context is closed or not available.");
          return;
        }

        if (context.state === "suspended") {
          try {
            await context.resume();
          } catch (error) {
            console.warn("Could not resume audio context:", error);
            return;
          }
        }
        if (mesh && mesh.position) {
          // Create the panner node only once if it doesn't exist
          if (!mesh.metadata.panner) {
            const panner = context.createPanner();
            mesh.metadata.panner = panner;

            // Configure the panner for spatial effects
            panner.panningModel = "HRTF";
            panner.distanceModel = "inverse";
            panner.refDistance = 0.5;
            panner.maxDistance = 50;
            panner.rolloffFactor = 2;
            panner.connect(context.destination);
          }

          const panner = mesh.metadata.panner; // Reuse the same panner node

          // Continuously update the panner position while notes are playing
          const observer = flock.scene.onBeforeRenderObservable.add(() => {
            const { x, y, z } = mesh.position;
            panner.positionX.value = -x;
            panner.positionY.value = y;
            panner.positionZ.value = z;
          });

          // Iterate over the notes and schedule playback
          let offsetTime = 0;
          for (let i = 0; i < notes.length; i++) {
            const note = notes[i];
            const duration = Number(durations[i]);

            if (note !== null) {
              flock.playMidiNote(
                context,
                mesh,
                note,
                duration,
                bpm,
                context.currentTime + offsetTime, // Schedule the note
                instrument,
              );
            }

            offsetTime += flock.durationInSeconds(duration, bpm);
          }

          // Resolve the promise after the last note has played
          setTimeout(
            () => {
              flock.scene.onBeforeRenderObservable.remove(observer);
              resolve();
            },
            (offsetTime + 1) * 1000,
          ); // Add a small buffer after the last note finishes
        } else {
          console.error("Mesh does not have a position property:", mesh);
          resolve();
        }
      });
    });
  },
  playMidiNote(
    context,
    mesh,
    note,
    duration,
    bpm,
    playTime,
    instrument = null,
  ) {
    if (!context || context.state === "closed") return;

    // Create a new oscillator for each note
    const osc = context.createOscillator();
    const panner = mesh.metadata.panner;
    // If an instrument is provided, reuse its gainNode but create a new oscillator each time
    const gainNode = instrument ? instrument.gainNode : context.createGain();

    // Set oscillator type based on the instrument or default to 'sine'
    osc.type = instrument ? instrument.oscillator.type : "sine";
    osc.frequency.value = flock.midiToFrequency(note); // Convert MIDI note to frequency

    // Connect the oscillator to the gain node and panner
    osc.connect(gainNode);
    gainNode.connect(panner);
    panner.connect(context.destination);

    const gap = Math.min(0.05, (60 / bpm) * 0.05); // Slightly larger gap

    gainNode.gain.setValueAtTime(
      1,
      Math.max(playTime, context.currentTime + 0.01),
    );

    const fadeOutDuration = Math.min(0.2, duration * 0.2); // Longer fade-out for clarity

    gainNode.gain.linearRampToValueAtTime(
      0,
      playTime + duration - gap - fadeOutDuration,
    ); // Gradual fade-out

    osc.start(playTime); // Start the note at playTime
    osc.stop(playTime + duration - gap); // Stop slightly earlier to add a gap

    // Clean up: disconnect the oscillator after it's done
    osc.onended = () => {
      osc.disconnect();
    };

    // Fallback clean-up in case osc.onended is not triggered
    setTimeout(
      () => {
        if (osc) {
          osc.disconnect();
        }
      },
      (playTime + duration) * 1000,
    );
  },
  midiToFrequency(note) {
    return 440 * Math.pow(2, (note - 69) / 12); // Convert MIDI note to frequency
  },
  durationInSeconds(duration, bpm) {
    return (60 / bpm) * duration; // Convert beats to seconds
  },
  createInstrument(
    type,
    {
      frequency = 440,
      attack = 0.1,
      decay = 0.3,
      sustain = 0.7,
      release = 1.0
    } = {}
  ) {
    const audioCtx = flock.audioContext;

    if (!audioCtx || audioCtx.state === "closed") return;

    const oscillator = audioCtx.createOscillator();
    const gainNode = audioCtx.createGain();

    oscillator.type = type;
    oscillator.frequency.setValueAtTime(frequency, audioCtx.currentTime);

    // Create ADSR envelope
    gainNode.gain.setValueAtTime(0, audioCtx.currentTime);
    gainNode.gain.linearRampToValueAtTime(1, audioCtx.currentTime + attack);
    gainNode.gain.linearRampToValueAtTime(
      sustain,
      audioCtx.currentTime + attack + decay,
    );
    gainNode.gain.linearRampToValueAtTime(
      0,
      audioCtx.currentTime + attack + decay + release,
    );
    oscillator.connect(gainNode).connect(audioCtx.destination);

    return { oscillator, gainNode, audioCtx };
  },
  setBPM(bpm, meshName = null) {
    if (meshName) {
      return flock.whenModelReady(meshName, async function (mesh) {
        if (mesh) {
          if (!mesh.metadata) mesh.metadata = {};
          mesh.metadata.bpm = bpm;
        }
      });
    } else {
      if (!flock.scene.metadata) flock.scene.metadata = {};
      flock.scene.metadata.bpm = bpm;
    }
  },
  updateListenerPositionAndOrientation(context, camera) {
    const { x: cx, y: cy, z: cz } = camera.position;
    const forwardVector = camera.getForwardRay().direction;

    if (context.listener.positionX) {
      // Update listener's position
      context.listener.positionX.setValueAtTime(cx, context.currentTime);
      context.listener.positionY.setValueAtTime(cy, context.currentTime);
      context.listener.positionZ.setValueAtTime(cz, context.currentTime);

      // Update listener's forward direction
      context.listener.forwardX.setValueAtTime(
        -forwardVector.x,
        context.currentTime,
      );
      context.listener.forwardY.setValueAtTime(
        forwardVector.y,
        context.currentTime,
      );
      context.listener.forwardZ.setValueAtTime(
        forwardVector.z,
        context.currentTime,
      );

      // Set the listener's up vector (typically pointing upwards in the Y direction)
      context.listener.upX.setValueAtTime(0, context.currentTime);
      context.listener.upY.setValueAtTime(1, context.currentTime);
      context.listener.upZ.setValueAtTime(0, context.currentTime);
    } else {
      // Firefox
      context.listener.setPosition(cx, cy, cz);
      context.listener.setOrientation(
        -forwardVector.x,
        forwardVector.y,
        forwardVector.z,
        0,
        1,
        0,
      );
    }
  },
};
