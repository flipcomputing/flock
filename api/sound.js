let flock;

export function setFlockReference(ref) {
  flock = ref;
}

export const flockSound = {
  async playSound(
    meshName,
    { soundName, loop = false, volume = 1, playbackRate = 1 } = {},
  ) {
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
      instrument = flock.createInstrument("square", {
        frequency: 440,
        attack: 0.1,
        decay: 0.3,
        sustain: 0.7,
        release: 1.0,
      }),
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
            flock.audioContext = new (window.AudioContext ||
              window.webkitAudioContext)();
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

            // Configure the panner for aggressive spatial effects to match playSound behavior
            panner.panningModel = "HRTF";
            panner.distanceModel = "exponential"; // More aggressive than linear
            panner.refDistance = 1.0;
            panner.maxDistance = 15;
            panner.rolloffFactor = 1;
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
            // Use default duration of 0.5 if missing or invalid (NaN)
            const rawDuration = Number(durations[i]);
            const duration = isNaN(rawDuration) ? 0.5 : rawDuration;

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

    // Validate numeric parameters to prevent Web Audio API errors
    if (!isFinite(duration) || !isFinite(playTime) || !isFinite(bpm)) {
      console.warn('playMidiNote: Invalid parameters', { duration, playTime, bpm });
      return;
    }

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
      release = 1.0,
    } = {},
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
  setBPM(meshName, bpm) {
    if (meshName === "__everywhere__") {
      if (!flock.scene.metadata || typeof flock.scene.metadata !== "object") {
        flock.scene.metadata = {};
      }
      flock.scene.metadata.bpm = bpm;
      return;
    }

    return flock.whenModelReady(meshName, async function (mesh) {
      if (!mesh) {
        throw new Error(`Mesh '${meshName}' not found`);
      }

      if (!mesh.metadata || typeof mesh.metadata !== "object") {
        mesh.metadata = {};
      }

      mesh.metadata.bpm = bpm;
    });
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
  async speak(
    meshName,
    text,
    {
      voice = "female",
      language = "en-US",
      rate = 1,
      pitch = 1,
      volume = 1,
      mode = "start",
    } = {},
  ) {
    // Debug logging to check parameters
    console.log(`[SPEAK DEBUG] Called with:`, {
      meshName: meshName,
      text: text,
      voice: voice,
      language: language,
      rate: rate,
      pitch: pitch,
      volume: volume,
      mode: mode,
    });

    // Check for Web Speech API support
    if (!("speechSynthesis" in window)) {
      console.warn("Text-to-speech not supported in this browser");
      return mode === "await" ? Promise.resolve() : undefined;
    }

    // Stop any current speech
    window.speechSynthesis.cancel();

    // Create utterance
    const utterance = new SpeechSynthesisUtterance(text);

    // Set basic properties
    utterance.rate = Math.max(0.1, Math.min(10, rate));
    utterance.pitch = Math.max(0, Math.min(2, pitch));
    utterance.volume = Math.max(0, Math.min(1, volume));
    utterance.lang = "en-US";

    // Handle spatial audio if meshName is provided and not "__everywhere__"
    let spatialAudioSetup = null;
    console.log(
      `[SPEAK DEBUG] Checking spatial audio setup for meshName: "${meshName}"`,
    );
    if (meshName && meshName !== "__everywhere__") {
      console.log(
        `[SPEAK DEBUG] Setting up spatial audio for mesh: "${meshName}"`,
      );
      spatialAudioSetup = await flockSound.setupSpatialSpeech(
        utterance,
        meshName,
      );
    } else {
      console.log(`[SPEAK DEBUG] Using non-spatial audio (everywhere mode)`);
    }

    // Set voice if available - handle voice loading timing
    let voices = window.speechSynthesis.getVoices();

    // If no voices available, wait for them to load
    if (voices.length === 0) {
      await new Promise((resolve) => {
        // Some browsers need time to load voices
        if (window.speechSynthesis.onvoiceschanged !== undefined) {
          window.speechSynthesis.onvoiceschanged = () => {
            voices = window.speechSynthesis.getVoices();
            resolve();
          };
        } else {
          // Fallback for browsers that don't support onvoiceschanged
          setTimeout(() => {
            voices = window.speechSynthesis.getVoices();
            resolve();
          }, 100);
        }
      });
    }

    if (voices.length > 0) {
      let selectedVoice = null;

      // Debug: Log available voices for troubleshooting
      console.log(
        "Available voices:",
        voices.map((v) => ({
          name: v.name,
          lang: v.lang,
          localService: v.localService,
          default: v.default,
        })),
      );

      console.log("Requested voice type:", voice, "language:", language);

      // Common voice names by platform and gender
      const commonVoices = {
        "en-US": {
          male: [
            // Windows
            "david",
            "mark",
            "zira",
            "james",
            // macOS/iOS
            "alex",
            "daniel",
            "fred",
            "jorge",
            "tom",
            // Android/Chrome
            "male",
            "man",
          ],
          female: [
            // Windows
            "zira",
            "hazel",
            "helen",
            // macOS/iOS
            "samantha",
            "susan",
            "allison",
            "ava",
            "karen",
            "moira",
            "tessa",
            "veera",
            "victoria",
            // Android/Chrome
            "female",
            "woman",
          ],
        },
        "en-GB": {
          male: [
            // Windows
            "george",
            "hazel",
            // macOS/iOS
            "daniel",
            "oliver",
            "serena",
            // Android/Chrome
            "male",
            "man",
          ],
          female: [
            // Windows
            "hazel",
            "susan",
            // macOS/iOS
            "kate",
            "serena",
            "stephanie",
            // Android/Chrome
            "female",
            "woman",
          ],
        },
      };

      // Filter voices by requested language
      const languageVoices = voices.filter((v) => v.lang.startsWith(language));

      if (languageVoices.length === 0) {
        console.warn(
          `No voices found for language ${language}, falling back to any English voice`,
        );
        // Fallback to any English voice
        const englishVoices = voices.filter((v) => v.lang.startsWith("en"));
        if (englishVoices.length > 0) {
          selectedVoice = englishVoices[0];
        }
      } else {
        const voiceNames = commonVoices[language]?.[voice] || [];

        // 1. Try common voice names for the platform/language
        for (const voiceName of voiceNames) {
          selectedVoice = languageVoices.find((v) =>
            v.name.toLowerCase().includes(voiceName.toLowerCase()),
          );
          if (selectedVoice) break;
        }

        // 2. Look for explicit "Male" or "Female" in name
        if (!selectedVoice) {
          selectedVoice = languageVoices.find((v) =>
            v.name.toLowerCase().includes(voice.toLowerCase()),
          );
        }

        // 3. For male voices, avoid known female names
        if (!selectedVoice && voice === "male") {
          const femaleTerms = [
            "female",
            "woman",
            "lady",
            "girl",
            "samantha",
            "susan",
            "kate",
            "zira",
            "hazel",
            "helen",
            "karen",
            "moira",
            "tessa",
            "fiona",
            "allison",
            "ava",
            "veera",
            "victoria",
            "stephanie",
            "serena",
          ];
          selectedVoice = languageVoices.find(
            (v) =>
              !femaleTerms.some((term) =>
                v.name.toLowerCase().includes(term.toLowerCase()),
              ),
          );
        }

        // 4. For female voices, avoid known male names
        if (!selectedVoice && voice === "female") {
          const maleTerms = [
            "male",
            "man",
            "david",
            "alex",
            "daniel",
            "mark",
            "tom",
            "george",
            "peter",
            "john",
            "michael",
            "robert",
            "fred",
            "jorge",
            "james",
            "oliver",
          ];
          selectedVoice = languageVoices.find(
            (v) =>
              !maleTerms.some((term) =>
                v.name.toLowerCase().includes(term.toLowerCase()),
              ),
          );
        }

        // 5. Fallback to first voice in the language
        if (!selectedVoice) {
          selectedVoice = languageVoices[0];
        }
      }

      // Final fallback to first available voice
      if (!selectedVoice) {
        selectedVoice = voices[0];
      }

      if (selectedVoice) {
        utterance.voice = selectedVoice;
        console.log("Selected voice:", {
          name: selectedVoice.name,
          requestedType: voice,
          lang: selectedVoice.lang,
          localService: selectedVoice.localService,
        });
      } else {
        console.warn("No voice found for type:", voice, "using default");
      }
    }

    if (mode === "await") {
      return new Promise((resolve, reject) => {
        utterance.onend = () => {
          if (spatialAudioSetup) {
            spatialAudioSetup.cleanup();
          }
          resolve();
        };
        utterance.onerror = (event) => {
          console.warn("Speech synthesis error:", event.error);
          if (spatialAudioSetup) {
            spatialAudioSetup.cleanup();
          }
          resolve(); // Resolve instead of reject to prevent blocking
        };

        window.speechSynthesis.speak(utterance);
      });
    } else {
      // Fire and forget mode
      utterance.onend = () => {
        if (spatialAudioSetup) {
          spatialAudioSetup.cleanup();
        }
      };
      utterance.onerror = (event) => {
        console.warn("Speech synthesis error:", event.error);
        if (spatialAudioSetup) {
          spatialAudioSetup.cleanup();
        }
      };

      window.speechSynthesis.speak(utterance);
      return undefined;
    }
  },

  async setupSpatialSpeech(utterance, meshName) {
    console.log(
      `[SPATIAL AUDIO DEBUG] Setting up spatial speech for mesh: ${meshName}`,
    );

    const mesh = flock.scene.getMeshByName(meshName);
    if (!mesh) {
      console.warn(
        `[SPATIAL AUDIO DEBUG] Mesh '${meshName}' not found for spatial speech`,
      );
      return null;
    }

    console.log(
      `[SPATIAL AUDIO DEBUG] Found mesh '${meshName}' at position:`,
      mesh.position,
    );

    // Get or create audio context
    const audioContext = flockSound.getAudioContext();
    if (!audioContext || audioContext.state === "closed") {
      console.warn("[SPATIAL AUDIO DEBUG] Audio context not available");
      return null;
    }

    if (audioContext.state === "suspended") {
      await audioContext.resume();
    }

    // Create spatial audio nodes
    const panner = audioContext.createPanner();
    panner.panningModel = "HRTF";
    panner.distanceModel = "exponential";
    panner.refDistance = 1.0;
    panner.maxDistance = 15;
    panner.rolloffFactor = 2;

    // Create stereo panner for enhanced left/right positioning
    const stereoPanner = audioContext.createStereoPanner();

    // Connect panner -> stereo panner -> destination
    panner.connect(stereoPanner);
    stereoPanner.connect(audioContext.destination);

    // Set up position updating
    const updateSpatialPosition = () => {
      if (!mesh || mesh.isDisposed?.() || !flock.scene.activeCamera) {
        return;
      }

      const camera = flock.scene.activeCamera;
      const cameraPosition = camera.position;
      const meshPosition = mesh.position;

      // Update panner position (note: Babylon.js uses right-handed coordinates)
      panner.positionX.setValueAtTime(
        -meshPosition.x,
        audioContext.currentTime,
      );
      panner.positionY.setValueAtTime(meshPosition.y, audioContext.currentTime);
      panner.positionZ.setValueAtTime(meshPosition.z, audioContext.currentTime);

      // Calculate stereo panning based on relative position
      const cameraToMesh = meshPosition.subtract(cameraPosition);
      const cameraRight = camera
        .getForwardRay()
        .direction.cross(flock.BABYLON.Vector3.Up())
        .normalize();

      // Project the relative position onto the camera's right vector for left/right positioning
      const rightDot = flock.BABYLON.Vector3.Dot(
        cameraToMesh.normalize(),
        cameraRight,
      );

      // Convert to stereo pan value (-1 = full left, 1 = full right)
      const panValue = Math.max(-1, Math.min(1, rightDot * 2)); // Amplify the effect
      stereoPanner.pan.setValueAtTime(panValue, audioContext.currentTime);

      // Update listener position and orientation
      flockSound.updateListenerPositionAndOrientation(
        audioContext,
        flock.scene.activeCamera,
      );

      // Debug info (throttled)
      if (Math.random() < 0.01) {
        // ~1% chance per frame
        const distance = flock.BABYLON.Vector3.Distance(
          cameraPosition,
          meshPosition,
        );
        console.log(`[SPATIAL AUDIO DEBUG] Position update:`, {
          meshPosition: {
            x: meshPosition.x.toFixed(2),
            y: meshPosition.y.toFixed(2),
            z: meshPosition.z.toFixed(2),
          },
          cameraPosition: {
            x: cameraPosition.x.toFixed(2),
            y: cameraPosition.y.toFixed(2),
            z: cameraPosition.z.toFixed(2),
          },
          distance: distance.toFixed(2),
          panValue: panValue.toFixed(2),
        });
      }
    };

    // Start position updates
    const renderObserver = flock.scene.onBeforeRenderObservable.add(
      updateSpatialPosition,
    );

    // Initial position update
    updateSpatialPosition();

    // Try to use the more advanced approach with MediaStream
    let spatialAudioSource = null;
    let isPlayingThroughSpatialAudio = false;

    // Fallback: Use the original utterance but with enhanced volume calculation
    const originalVolume = utterance.volume;

    const updateVolumeBasedOnDistance = () => {
      if (!mesh || mesh.isDisposed?.() || !flock.scene.activeCamera) {
        return;
      }

      const cameraPosition = flock.scene.activeCamera.position;
      const meshPosition = mesh.position;
      const distance = flock.BABYLON.Vector3.Distance(
        cameraPosition,
        meshPosition,
      );

      // Calculate volume based on exponential distance model
      // Account for camera's minimum distance constraint (camera can't get closer than ~7-8 units)
      const cameraMinDistance = 7; // Camera's minimum radius limit
      const adjustedDistance = Math.max(0, distance - cameraMinDistance); // Effective distance for audio

      const refDistance = 0.5; // Small reference distance for adjusted calculation
      const rolloffFactor = 1.5; // Moderate rolloff
      const maxDistance = 15; // Max effective distance

      let volumeGain = 1;

      // When within camera's minimum range, use full volume
      if (adjustedDistance <= refDistance) {
        volumeGain = 1; // Full volume when effectively "close"
      } else if (adjustedDistance < maxDistance) {
        // Gradual falloff after reference distance
        volumeGain =
          refDistance /
          (refDistance + rolloffFactor * (adjustedDistance - refDistance));
        // Ensure minimum audible volume even at distance
        volumeGain = Math.max(0.15, volumeGain);
      } else {
        volumeGain = 0.1; // Quiet but audible beyond max distance
      }

      // Apply volume (note: this only works if speech hasn't started yet in most browsers)
      const newVolume = Math.max(0, Math.min(1, originalVolume * volumeGain));
      if (utterance.volume !== newVolume) {
        utterance.volume = newVolume;
      }
    };

    // Set initial volume and log the result
    updateVolumeBasedOnDistance();

    console.log(`[SPATIAL AUDIO DEBUG] Initial spatial setup:`, {
      originalVolume: originalVolume,
      currentVolume: utterance.volume,
      meshName: meshName,
      meshPosition: mesh.position,
    });

    console.log(
      `[SPATIAL AUDIO DEBUG] Spatial audio setup complete for '${meshName}'`,
    );

    return {
      cleanup: () => {
        console.log("[SPATIAL AUDIO DEBUG] Cleaning up spatial speech");

        // Remove render observer
        if (renderObserver && flock.scene?.onBeforeRenderObservable) {
          flock.scene.onBeforeRenderObservable.remove(renderObserver);
        }

        // Clean up audio nodes
        if (spatialAudioSource) {
          try {
            spatialAudioSource.disconnect();
          } catch (e) {
            console.warn("Error disconnecting spatial audio source:", e);
          }
        }

        if (stereoPanner) {
          try {
            stereoPanner.disconnect();
          } catch (e) {
            console.warn("Error disconnecting stereo panner:", e);
          }
        }

        if (panner) {
          try {
            panner.disconnect();
          } catch (e) {
            console.warn("Error disconnecting panner:", e);
          }
        }

        console.log("[SPATIAL AUDIO DEBUG] Spatial speech cleanup complete");
      },
    };
  },
};
