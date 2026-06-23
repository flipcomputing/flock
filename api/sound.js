let flock;

export function setFlockReference(ref) {
  flock = ref;
}

// --- Native Web Audio helpers for playSound ---

const soundBufferCache = new Map(); // soundUrl → Promise<AudioBuffer>

// Smoothing constants — one-pole lowpass applied per render frame.
// α = 0.4 gives a ~33 ms time constant at 60 fps, enough to damp
// rapid panning swings without perceptible spatial lag.
const LISTENER_SMOOTH = 0.4;
const PANNER_SMOOTH   = 0.4;

// Smoothed listener state — shared across all sounds in the same context.
// Stored at module level so every updateListenerPositionAndOrientation call
// continues from the same running average rather than resetting each time.
let _listenerCtx = null;
let _slx = 0, _sly = 0, _slz = 0; // smoothed listener position
let _sfx = 0, _sfy = 0, _sfz = 0; // smoothed listener forward

async function loadAudioBuffer(url, context) {
  if (!soundBufferCache.has(url)) {
    soundBufferCache.set(
      url,
      fetch(url)
        .then((r) => {
          if (!r.ok) throw new Error(`HTTP ${r.status} fetching ${url}`);
          return r.arrayBuffer();
        })
        .then((ab) => context.decodeAudioData(ab))
        .catch((err) => {
          soundBufferCache.delete(url);
          throw err;
        }),
    );
  }
  return soundBufferCache.get(url);
}

function playBufferEverywhere(context, buffer, soundName, { loop, volume, playbackRate }) {
  const gainNode = context.createGain();
  gainNode.gain.value = volume;
  gainNode.connect(context.destination);

  const source = context.createBufferSource();
  source.buffer = buffer;
  source.playbackRate.value = playbackRate;
  source.loop = loop;
  source.connect(gainNode);

  let done = false;
  const finish = () => {
    if (done) return;
    done = true;
    try { source.stop(); } catch {}
    try { gainNode.disconnect(); } catch {}
    const idx = flock.globalSounds.indexOf(soundRef);
    if (idx !== -1) flock.globalSounds.splice(idx, 1);
  };

  const soundRef = {
    name: soundName,
    stop() {
      finish();
    },
  };

  flock.globalSounds.push(soundRef);
  source.start();

  if (!loop) {
    return new Promise((resolve) => {
      source.onended = () => { finish(); resolve(); };
    });
  }
  return soundRef;
}

function playBufferOnMesh(context, mesh, buffer, soundName, { loop, volume, playbackRate }) {
  if (!mesh.metadata || typeof mesh.metadata !== 'object') mesh.metadata = {};

  const currentSound = mesh.metadata.currentSound;
  if (currentSound) {
    try { currentSound.stop(); } catch {}
  }

  const panner = context.createPanner();
  panner.panningModel = 'equalpower';
  panner.distanceModel = 'linear';
  panner.refDistance = 1;
  panner.maxDistance = 20;
  panner.rolloffFactor = 1;
  panner.connect(context.destination);

  const gainNode = context.createGain();
  gainNode.gain.value = volume;
  gainNode.connect(panner);

  const source = context.createBufferSource();
  source.buffer = buffer;
  source.playbackRate.value = playbackRate;
  source.loop = loop;
  source.connect(gainNode);

  // Smoothed panner position — initialised to the mesh's starting position.
  let sx = mesh.position.x, sy = mesh.position.y, sz = mesh.position.z;

  const updatePosition = () => {
    if (!flock.scene || context.state === 'closed') { finish(); return; }
    if (mesh.isDisposed?.()) { finish(); return; }
    const { x, y, z } = mesh.position;
    sx += PANNER_SMOOTH * (x - sx);
    sy += PANNER_SMOOTH * (y - sy);
    sz += PANNER_SMOOTH * (z - sz);
    panner.positionX.value = sx;
    panner.positionY.value = sy;
    panner.positionZ.value = sz;
    if (!flock.audioEngine && flock.scene.activeCamera) {
      flockSound.updateListenerPositionAndOrientation(context, flock.scene.activeCamera);
    }
  };
  updatePosition();
  const observer = flock.scene.onBeforeRenderObservable.add(updatePosition);

  let done = false;
  const finish = () => {
    if (done) return;
    done = true;
    flock.scene?.onBeforeRenderObservable?.remove(observer);
    try { source.stop(); } catch {}
    try { source.disconnect(); } catch {}
    try { gainNode.disconnect(); } catch {}
    try { panner.disconnect(); } catch {}
    if (mesh.metadata?.currentSound === soundRef) delete mesh.metadata.currentSound;
    const idx = flock.globalSounds.indexOf(soundRef);
    if (idx !== -1) flock.globalSounds.splice(idx, 1);
  };

  const soundRef = {
    name: soundName,
    _attachedMesh: mesh,
    stop() {
      finish();
    },
  };

  mesh.metadata.currentSound = soundRef;
  flock.globalSounds.push(soundRef);
  source.start();

  if (!loop) {
    return new Promise((resolve) => {
      source.onended = () => { finish(); resolve(); };
    });
  }
  return soundRef;
}

// Returns Babylon's AudioContext if available, otherwise reuses or lazily creates one.
// Avoids the two-AudioContext problem on iOS where a second running context causes
// "Failed to start the audio device" errors.
function getOrCreateContext() {
  const babylonCtx = flock.audioEngine?._audioContext;
  if (babylonCtx) {
    flock.audioContext = babylonCtx;
    return babylonCtx;
  }
  if (flock.audioContext && flock.audioContext.state !== 'closed') {
    return flock.audioContext;
  }
  try {
    flock.audioContext = new (window.AudioContext || window.webkitAudioContext)();
    return flock.audioContext;
  } catch {
    return null;
  }
}

// iOS Safari will throw InvalidStateError/NotAllowedError when resume() is called
// outside a user gesture. Defers the resume to the next pointer/touch event instead
// of silently bailing, so audio works as soon as the user next taps the screen.
async function safeResume(context) {
  if (context.state !== 'suspended') return;
  try {
    await context.resume();
  } catch (err) {
    if (err.name !== 'InvalidStateError' && err.name !== 'NotAllowedError') throw err;
    await new Promise((resolve) => {
      let timer;
      const cleanup = () => {
        clearTimeout(timer);
        document.removeEventListener('pointerdown', handler);
        document.removeEventListener('touchstart', handler);
      };
      const handler = () => {
        cleanup();
        context.resume().catch(() => {}).finally(resolve);
      };
      document.addEventListener('pointerdown', handler);
      document.addEventListener('touchstart', handler, { passive: true });
      // Abandon after 10 s — prevents a permanent listener leak when programmatic
      // audio fires but the user never gestures (e.g. background tab, navigation).
      timer = setTimeout(() => { cleanup(); resolve(); }, 10000);
    });
  }
}

export const flockSound = {
  async playSound(
    meshName,
    { soundName, loop = false, volume = 1, playbackRate = 1 } = {},
  ) {
    volume = Number.isFinite(Number(volume)) ? Math.max(0, Math.min(1, Number(volume))) : 1;
    playbackRate =
      Number.isFinite(Number(playbackRate)) && Number(playbackRate) > 0
        ? Number(playbackRate)
        : 1;
    if (!soundName || typeof soundName !== "string") {
      console.warn("playSound: invalid soundName");
      return;
    }

    await flock.ensureAudio();
    const context = getOrCreateContext();
    if (!context) return;
    await safeResume(context);
    if (context.state === 'closed') return;

    const soundUrl = flock.soundPath + soundName;
    let buffer;
    try {
      buffer = await loadAudioBuffer(soundUrl, context);
    } catch (err) {
      console.warn("playSound: failed to load audio:", soundUrl, err);
      return;
    }

    if (context.state === "closed") return;

    if (meshName === "__everywhere__") {
      return playBufferEverywhere(context, buffer, soundName, { loop, volume, playbackRate });
    }

    const mesh = flock.scene.getMeshByName(meshName);
    if (mesh && !mesh.isDisposed?.()) {
      return playBufferOnMesh(context, mesh, buffer, soundName, { loop, volume, playbackRate });
    }

    return new Promise((resolve) => {
      flock.whenModelReady(meshName, async (resolvedMesh) => {
        if (flock.audioContext !== context) { resolve(); return; }
        const result = await playBufferOnMesh(
          context,
          resolvedMesh,
          buffer,
          soundName,
          { loop, volume, playbackRate },
        );
        resolve(result);
      });
    });
  },
  stopAllSounds() {
    if (!flock?.globalSounds) return;
    soundBufferCache.clear();
    const sounds = flock.globalSounds.slice();
    flock.globalSounds = [];
    for (const sound of sounds) {
      try {
        sound.stop();
      } catch (e) {
        console.warn("Error stopping sound:", sound.name, e);
      }
    }

    // Immediately disconnect the __everywhere__ gain — context.close() is async and
    // a brief window exists where the old gain can still feed the destination.
    if (flock._everywhereGain) {
      try { flock._everywhereGain.disconnect(); } catch { /* already detached */ }
      flock._everywhereGain = null;
    }

    // Null immediately so any lingering playNotes calls see no context and bail
    flock._audioStopped = true;
    const ctx = flock.audioContext;
    flock.audioContext = null;
    // Release the module-level smoothing reference so the old context can be GC'd.
    // updateListenerPositionAndOrientation is skipped when Babylon's engine is active,
    // so _listenerCtx would otherwise hold the last closed context indefinitely.
    _listenerCtx = null;

    if (!ctx || ctx.state === "closed") return;

    // Don't close Babylon's own context — it gets closed when audioEngine.dispose() runs.
    // Closing it here would break Babylon's audio graph on the next scene load.
    const isBabylonOwned = flock.audioEngine?._audioContext === ctx;
    if (!isBabylonOwned) {
      ctx.close().catch((error) => {
        console.error("Error closing audio context:", error);
      });
    }
  },
  getAudioContext() {
    return getOrCreateContext();
  },
  async playNotes(
    meshName,
    {
      notes = [],
      durations = [],
      instrument = flock.createInstrument("square"),
    } = {},
  ) {
    // A freshly-initiated playNotes means "play now", so clear any prior stop
    // request. stopAllSounds sets _audioStopped to abort an in-flight sequence
    // (caught by the post-setup check below and the per-note loop); it must not
    // permanently disable future playback until a full scene dispose.
    flock._audioStopped = false;
    notes = notes.map((note) => (note === "_" ? null : note));
    durations = durations.map(Number);

    const getBPM = (obj) => obj?.metadata?.bpm || null;

    await flock.ensureAudio();
    const context = getOrCreateContext();
    if (!context || context.state === "closed") return;
    await safeResume(context);
    if (context.state === "closed") return;
    if (flock._audioStopped) return;

    const scheduleNotes = (mesh, outputNode, observer) => {
      return new Promise((resolve) => {
        let bpm =
          getBPM(mesh) ||
          getBPM(mesh?.parent) ||
          getBPM(flock.scene) ||
          60;
        bpm = Number(bpm);
        if (!isFinite(bpm) || bpm <= 0) bpm = 60;

        let offsetTime = 0;
        for (let i = 0; i < notes.length; i++) {
          const note = notes[i];
          let duration = Number(durations[i]);
          if (!isFinite(duration) || duration <= 0) duration = 1;

          if (note !== null) {
            flock.playMidiNote(
              context,
              { metadata: { panner: outputNode } },
              note,
              duration,
              bpm,
              context.currentTime + offsetTime,
              instrument,
            );
          }

          offsetTime += flock.durationInSeconds(duration, bpm);
        }

        const audioTail =
          (instrument?.attack ?? 0.01) +
          (instrument?.decay ?? 0.1) +
          (instrument?.release ?? 0.2);
        setTimeout(
          () => {
            if (observer) flock.scene?.onBeforeRenderObservable?.remove(observer);
            resolve();
          },
          (offsetTime + audioTail + 0.1) * 1000,
        );
      });
    };

    if (meshName === "__everywhere__") {
      // Disconnect any lingering gain from a prior __everywhere__ call immediately.
      // context.close() is async; an old gain can still feed the destination for a
      // brief window, producing a comb-filter offset that sounds like echo.
      if (flock._everywhereGain) {
        try { flock._everywhereGain.disconnect(); } catch { /* already detached */ }
        flock._everywhereGain = null;
      }
      const gain = context.createGain();
      flock._everywhereGain = gain;
      gain.connect(context.destination);
      return scheduleNotes(null, gain, null).then(() => {
        if (flock._everywhereGain === gain) flock._everywhereGain = null;
        try { gain.disconnect(); } catch { /* already detached */ }
      });
    }

    return new Promise((resolve) => {
      flock.whenModelReady(meshName, async function (mesh) {
        if (flock._audioStopped || !flock.scene) {
          resolve();
          return;
        }
        if (!mesh?.position) {
          console.error("Mesh does not have a position property:", mesh);
          resolve();
          return;
        }

        if (!mesh.metadata.panner || mesh.metadata.panner.context !== context) {
          if (mesh.metadata.panner) {
            try { mesh.metadata.panner.disconnect(); } catch (e) {}
          }
          const panner = context.createPanner();
          mesh.metadata.panner = panner;
          panner.panningModel = "equalpower";
          panner.distanceModel = "linear";
          panner.refDistance = 1;
          panner.maxDistance = 20;
          panner.rolloffFactor = 1;
          panner.connect(context.destination);
        }

        const panner = mesh.metadata.panner;

        const updatePositions = () => {
          if (!flock.scene || context.state === 'closed' || mesh.isDisposed?.()) return;
          const { x, y, z } = mesh.position;
          panner.positionX.value = x;
          panner.positionY.value = y;
          panner.positionZ.value = z;
          if (!flock.audioEngine && flock.scene.activeCamera) {
            flockSound.updateListenerPositionAndOrientation(
              context,
              flock.scene.activeCamera,
            );
          }
        };
        updatePositions();
        const observer = flock.scene.onBeforeRenderObservable.add(updatePositions);

        await scheduleNotes(mesh, panner, observer);
        resolve();
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
      console.warn("playMidiNote: Invalid parameters", {
        duration,
        playTime,
        bpm,
      });
      return;
    }

    // Create fresh audio nodes per note so ADSR envelopes don't interfere
    const osc = context.createOscillator();
    const gainNode = context.createGain();
    gainNode.gain.setValueAtTime(0, context.currentTime); // Start silent to prevent click on first note
    const panner = mesh.metadata.panner;

    osc.type = instrument?.type ?? "sine";
    osc.frequency.value = flock.midiToFrequency(note); // Convert MIDI note to frequency

    // Set up LFO effect if specified
    const effect = instrument?.effect ?? "none";
    const effectRate = instrument?.effectRate ?? 5;
    const effectDepth = instrument?.effectDepth ?? 0.5;
    let lfo = null;
    let lfoGain = null;
    if (effect !== "none") {
      lfo = context.createOscillator();
      lfoGain = context.createGain();
      lfo.type = effect === "warble" ? "square" : "sine";
      lfo.frequency.value = effect === "robot" ? effectRate * 100 : effectRate;
      lfoGain.gain.value =
        effect === "tremolo"
          ? effectDepth
          : osc.frequency.value * effectDepth * 0.5;
      lfo.connect(lfoGain);
      if (effect === "tremolo") {
        lfoGain.connect(gainNode.gain);
      } else {
        lfoGain.connect(osc.frequency);
      }
    }

    // Connect the oscillator to the gain node and panner
    // (panner is already connected to destination by the caller)
    osc.connect(gainNode);
    gainNode.connect(panner);

    const gap = Math.min(0.05, (60 / bpm) * 0.05); // Slightly larger gap

    // Use ADSR from the instrument if available, otherwise use simple defaults
    const volume = instrument?.volume ?? 1.0;
    const attack = instrument?.attack ?? 0.01;
    const decay = instrument?.decay ?? 0.1;
    const sustain = instrument?.sustain ?? 0.7;
    const release = instrument?.release ?? 0.2;
    const noteDuration = flock.durationInSeconds(duration, bpm);

    const startTime = Math.max(playTime, context.currentTime + 0.01);
    const attackEnd = startTime + attack;
    const decayEnd = attackEnd + decay;
    const releaseStart = Math.max(
      decayEnd,
      startTime + noteDuration - gap - release,
    );
    // Cap the release so a short note can't ring for longer than the note itself.
    // Without this, a 0.5s note with release=1.0 would extend 1.4s and audibly
    // bleed over the next notes, especially at full volume (__everywhere__ / inside mesh).
    const effectiveRelease = Math.min(release, noteDuration);
    const stopTime = releaseStart + effectiveRelease;

    gainNode.gain.cancelScheduledValues(startTime);
    gainNode.gain.setValueAtTime(0, startTime);
    gainNode.gain.linearRampToValueAtTime(volume, attackEnd);
    gainNode.gain.linearRampToValueAtTime(sustain * volume, decayEnd);
    gainNode.gain.setValueAtTime(sustain * volume, releaseStart);
    gainNode.gain.linearRampToValueAtTime(0, stopTime);

    osc.start(playTime); // Start the note at playTime
    if (lfo) lfo.start(playTime);

    const oscStopTime =
      isFinite(stopTime) && stopTime > playTime
        ? stopTime
        : Math.max(playTime + 0.001, context.currentTime + 0.02);
    osc.stop(oscStopTime);
    if (lfo) lfo.stop(oscStopTime);

    // osc.onended is the primary cleanup path; the setTimeout is a fallback in case
    // the event never fires (e.g. context suspended). The guard ensures disconnect()
    // is called exactly once — calling it twice throws in older Safari/WebKit.
    // noteRef is registered in globalSounds so stopAllSounds() can reach these
    // oscillators directly — previously context.close() was doing that job.
    let cleanupDone = false;
    let noteRef;
    const doDisconnect = () => {
      if (cleanupDone) return;
      cleanupDone = true;
      clearTimeout(cleanupTimer);
      if (flock.globalSounds) {
        const idx = flock.globalSounds.indexOf(noteRef);
        if (idx !== -1) flock.globalSounds.splice(idx, 1);
      }
      osc.disconnect();
      gainNode.disconnect();
      if (lfo) lfo.disconnect();
      if (lfoGain) lfoGain.disconnect();
    };
    osc.onended = doDisconnect;
    const cleanupDelay = Math.max(100, (stopTime - context.currentTime + 0.5) * 1000);
    const cleanupTimer = setTimeout(doDisconnect, cleanupDelay);

    noteRef = { name: 'note', stop() { try { osc.stop(0); } catch { /* already stopped */ } doDisconnect(); } };
    if (flock.globalSounds) flock.globalSounds.push(noteRef);
  },
  midiToFrequency(note) {
    const parsed = Number(note);
    note = Math.min(
      127,
      Math.max(0, Math.round(Number.isNaN(parsed) ? 60 : parsed)),
    ); // Clamp to valid MIDI range 0-127
    return 440 * Math.pow(2, (note - 69) / 12); // Convert MIDI note to frequency
  },
  durationInSeconds(duration, bpm) {
    return (60 / bpm) * duration; // Convert beats to seconds
  },
  createInstrument(
    type,
    {
      volume = 1.0,
      attack = 0.1,
      decay = 0.3,
      sustain = 0.7,
      release = 1.0,
      effect = "none",
      effectRate = 5,
      effectDepth = 0.5,
    } = {},
  ) {
    // Clamp parameters to valid ranges
    const toNum = (v, def) => {
      const n = Number(v);
      return Number.isNaN(n) ? def : n;
    };
    const validEffects = ["none", "tremolo", "vibrato", "warble", "robot"];
    effect = validEffects.includes(effect) ? effect : "none";
    volume = Math.min(1, Math.max(0, toNum(volume, 1.0)));
    attack = Math.min(5, Math.max(0, toNum(attack, 0.1)));
    decay = Math.min(5, Math.max(0, toNum(decay, 0.3)));
    sustain = Math.min(1, Math.max(0, toNum(sustain, 0.7)));
    release = Math.min(10, Math.max(0, toNum(release, 1.0)));
    effectRate = Math.min(20, Math.max(0.1, toNum(effectRate, 5)));
    effectDepth = Math.min(1, Math.max(0, toNum(effectDepth, 0.5)));

    // Return configuration only — audio nodes are created fresh per note in playMidiNote
    return {
      type,
      volume,
      attack,
      decay,
      sustain,
      release,
      effect,
      effectRate,
      effectDepth,
    };
  },
  setBPM(meshName, bpm) {
    const safeBpm = Number.isFinite(Number(bpm)) && Number(bpm) > 0 ? Number(bpm) : 60;
    bpm = safeBpm;

    if (meshName === "__everywhere__") {
      if (!flock.scene.metadata || typeof flock.scene.metadata !== "object") {
        flock.scene.metadata = {};
      }
      flock.scene.metadata.bpm = bpm;
      return;
    }

    return new Promise((resolve) => {
      flock.whenModelReady(meshName, async function (mesh) {
        if (!mesh) {
          console.warn(`setBPM: mesh '${meshName}' not found`);
          resolve();
          return;
        }

        if (!mesh.metadata || typeof mesh.metadata !== "object") {
          mesh.metadata = {};
        }

        mesh.metadata.bpm = bpm;
        resolve();
      });
    });
  },
  async playMusic(meshName, { notes = [], instrument = null } = {}) {
    const effectiveInstrument = instrument ?? flock.createInstrument("sine");
    const flatNotes =
      notes.length > 0 && Array.isArray(notes[0])
        ? notes.flat()
        : notes;
    const pitches = flatNotes.map((n) => n?.pitch ?? null);
    const baseDurations = flatNotes.map((n) => n?.duration ?? 0.5);

    const getSpeed = (mesh) =>
      Math.max(
        0.01,
        Number(
          meshName === "__everywhere__"
            ? flock.scene?.metadata?.musicSpeed
            : mesh?.metadata?.musicSpeed,
        ) || 1,
      );

    const playForMesh = async (mesh) => {
      const speed = getSpeed(mesh);
      const durations = baseDurations.map((d) => d / speed);
      return flockSound.playNotes(meshName, {
        notes: pitches,
        durations,
        instrument: effectiveInstrument,
      });
    };

    if (meshName === "__everywhere__") {
      return playForMesh(null);
    }

    return new Promise((resolve) => {
      flock.whenModelReady(meshName, async (mesh) => {
        await playForMesh(mesh);
        resolve();
      });
    });
  },
  setMusicSpeed(meshName, speed) {
    const validSpeed = Math.max(0.01, Number(speed) || 1);

    if (meshName === "__everywhere__") {
      if (!flock.scene.metadata || typeof flock.scene.metadata !== "object") {
        flock.scene.metadata = {};
      }
      flock.scene.metadata.musicSpeed = validSpeed;
      return;
    }

    return new Promise((resolve) => {
      flock.whenModelReady(meshName, function (mesh) {
        if (!mesh.metadata || typeof mesh.metadata !== "object") {
          mesh.metadata = {};
        }
        mesh.metadata.musicSpeed = validSpeed;
        resolve();
      });
    });
  },
  updateListenerPositionAndOrientation(context, camera) {
    if (!context || !camera) return;
    const { x: cx, y: cy, z: cz } = camera.position;
    const fwd = camera.getForwardRay().direction;
    const tfx = -fwd.x, tfy = fwd.y, tfz = fwd.z;

    // Reset smooth state when the audio context changes (e.g. after stopAllSounds).
    // Otherwise continue from the running average so position/orientation never jump.
    if (context !== _listenerCtx) {
      _listenerCtx = context;
      _slx = cx;  _sly = cy;  _slz = cz;
      _sfx = tfx; _sfy = tfy; _sfz = tfz;
    } else {
      _slx += LISTENER_SMOOTH * (cx  - _slx);
      _sly += LISTENER_SMOOTH * (cy  - _sly);
      _slz += LISTENER_SMOOTH * (cz  - _slz);
      _sfx += LISTENER_SMOOTH * (tfx - _sfx);
      _sfy += LISTENER_SMOOTH * (tfy - _sfy);
      _sfz += LISTENER_SMOOTH * (tfz - _sfz);
    }

    // Normalise — linear interpolation between unit vectors doesn't preserve length.
    const fLen = Math.sqrt(_sfx * _sfx + _sfy * _sfy + _sfz * _sfz);
    const nfx = fLen > 1e-4 ? _sfx / fLen : 0;
    const nfy = fLen > 1e-4 ? _sfy / fLen : 1;
    const nfz = fLen > 1e-4 ? _sfz / fLen : 0;

    if (context.listener.positionX) {
      context.listener.positionX.value = _slx;
      context.listener.positionY.value = _sly;
      context.listener.positionZ.value = _slz;

      context.listener.forwardX.value = nfx;
      context.listener.forwardY.value = nfy;
      context.listener.forwardZ.value = nfz;

      context.listener.upX.value = 0;
      context.listener.upY.value = 1;
      context.listener.upZ.value = 0;
    } else {
      // Firefox
      context.listener.setPosition(_slx, _sly, _slz);
      context.listener.setOrientation(nfx, nfy, nfz, 0, 1, 0);
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
    if (meshName && meshName !== "__everywhere__") {
      spatialAudioSetup = await flockSound.setupSpatialSpeech(
        utterance,
        meshName,
      );
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
      } else {
        console.warn("No voice found for type:", voice, "using default");
      }
    }

    // Show the spoken text as a subtitle (if enabled). Display it synchronously
    // rather than from utterance.onstart — onstart fires unreliably in Chrome
    // after speechSynthesis.cancel() (called above), so it would only show for
    // the first utterance. A duration-based backstop clears the caption even if
    // onend is likewise dropped; onend/onerror clear it sooner when they fire.
    const subtitlesOn = !!(flock.subtitlesEnabled && flock.showSubtitle);
    let subtitleTimer = null;
    const showSubtitle = () => {
      if (!subtitlesOn) return;
      flock.showSubtitle(text);
      flock._subtitleOwner = utterance;
      // ~14 chars/sec at rate 1; floor of 2s, plus a 1s buffer.
      const seconds =
        Math.max(2, String(text).length / 14) / Math.max(0.1, rate) + 1;
      subtitleTimer = setTimeout(() => {
        if (flock._subtitleOwner === utterance) flock.clearSubtitle();
      }, seconds * 1000);
    };
    const clearSubtitle = () => {
      if (!subtitlesOn) return;
      if (subtitleTimer) {
        clearTimeout(subtitleTimer);
        subtitleTimer = null;
      }
      // Only clear if this utterance still owns the caption — a late onend from
      // a cancelled utterance must not wipe a newer one's subtitle.
      if (flock._subtitleOwner === utterance) flock.clearSubtitle();
    };

    if (mode === "await") {
      return new Promise((resolve) => {
        utterance.onend = () => {
          clearSubtitle();
          if (spatialAudioSetup) {
            spatialAudioSetup.cleanup();
          }
          resolve();
        };
        utterance.onerror = (event) => {
          console.warn("Speech synthesis error:", event.error);
          clearSubtitle();
          if (spatialAudioSetup) {
            spatialAudioSetup.cleanup();
          }
          resolve(); // Resolve instead of reject to prevent blocking
        };

        showSubtitle();
        window.speechSynthesis.speak(utterance);
      });
    } else {
      // Fire and forget mode
      utterance.onend = () => {
        clearSubtitle();
        if (spatialAudioSetup) {
          spatialAudioSetup.cleanup();
        }
      };
      utterance.onerror = (event) => {
        console.warn("Speech synthesis error:", event.error);
        clearSubtitle();
        if (spatialAudioSetup) {
          spatialAudioSetup.cleanup();
        }
      };

      showSubtitle();
      window.speechSynthesis.speak(utterance);
      return undefined;
    }
  },

  setupSpatialSpeech(utterance, meshName) {
    // SpeechSynthesisUtterance audio can't be routed through Web Audio API,
    // so spatial positioning is approximated by scaling utterance.volume with distance.
    const mesh = flock.scene.getMeshByName(meshName);
    if (!mesh) return null;

    const originalVolume = utterance.volume;

    const updateVolume = () => {
      if (!mesh || mesh.isDisposed?.() || !flock.scene.activeCamera) return;
      const distance = flock.BABYLON.Vector3.Distance(
        flock.scene.activeCamera.position,
        mesh.position,
      );

      // Camera can't get closer than ~7 units; treat that as "full volume" range.
      const adjustedDistance = Math.max(0, distance - 7);
      const refDistance = 0.5;
      const rolloffFactor = 1.5;
      const maxDistance = 15;

      let volumeGain;
      if (adjustedDistance <= refDistance) {
        volumeGain = 1;
      } else if (adjustedDistance < maxDistance) {
        volumeGain = Math.max(
          0.15,
          refDistance / (refDistance + rolloffFactor * (adjustedDistance - refDistance)),
        );
      } else {
        volumeGain = 0.1;
      }

      utterance.volume = Math.max(0, Math.min(1, originalVolume * volumeGain));
    };

    updateVolume();
    const renderObserver = flock.scene.onBeforeRenderObservable.add(updateVolume);

    return {
      cleanup: () => {
        flock.scene?.onBeforeRenderObservable?.remove(renderObserver);
      },
    };
  },
};
