let flock;

export function setFlockReference(ref) {
  flock = ref;
}

export const flockFreeze = {
  // Frozen: the tab is hidden or the project is paused, and the project's code
  // must spend no time. Everything that holds while frozen (game clock, wait,
  // timers, loop yields, audio) listens for 'change' on freezeEvents. A change
  // can repeat the current state, so listeners must be idempotent.
  // A hidden tab also stops rendering; a paused project keeps rendering so the
  // gizmos work, with physics, animations and the project's per-frame and
  // input handlers held instead.
  freezeEvents: new EventTarget(),
  _userPaused: false,
  isFrozen() {
    return Boolean(globalThis.document?.hidden) || flock._userPaused;
  },
  isPaused() {
    return flock._userPaused;
  },
  setPaused(paused) {
    paused = Boolean(paused);
    if (flock._userPaused === paused) return;
    flock._userPaused = paused;
    flock._applyPauseToScene();
    flock.freezeEvents.dispatchEvent(new Event('change'));
  },
  _applyPauseToScene() {
    const scene = flock.scene;
    if (!scene) return;
    const running = !flock._userPaused;
    // _animate is skipped while disabled, so its clock would otherwise jump
    // by the whole pause on the first frame back.
    if (running && !scene.animationsEnabled) scene.resetLastAnimationTimeFrame?.();
    scene.animationsEnabled = running;
    scene.physicsEnabled = running;
    for (const system of scene.particleSystems ?? []) {
      if (running) flock._thawParticleSystem(system);
      else flock._freezeParticleSystem(system);
    }
  },
  // A zero update speed holds particles where they are and emits no more,
  // while they still render.
  _frozenParticleSpeeds: new WeakMap(),
  _freezeParticleSystem(system) {
    if (flock._frozenParticleSpeeds.has(system)) return;
    flock._frozenParticleSpeeds.set(system, system.updateSpeed);
    system.updateSpeed = 0;
  },
  _thawParticleSystem(system) {
    if (!flock._frozenParticleSpeeds.has(system)) return;
    system.updateSpeed = flock._frozenParticleSpeeds.get(system);
    flock._frozenParticleSpeeds.delete(system);
  },
  // Run callback now, or as soon as the project is resumed.
  whenRunning(callback) {
    if (!flock._userPaused) {
      callback();
      return;
    }
    const onChange = () => {
      if (flock._userPaused) return;
      flock.freezeEvents.removeEventListener('change', onChange);
      callback();
    };
    flock.freezeEvents.addEventListener('change', onChange);
  },
  // Restart after a gap (hidden tab, context lost) unless stopped or still
  // hidden. Frame timing is reset so the first frame doesn't advance
  // animations and physics by the whole gap.
  _resumeRenderLoop() {
    const engine = flock.engine;
    if (!engine || !flock._renderLoop || flock._renderLoopStopped) return;
    if (globalThis.document?.hidden || engine.isContextLost?.()) return;
    if (engine.activeRenderLoops?.includes(flock._renderLoop)) return;
    flock.scene?.resetLastAnimationTimeFrame?.();
    engine.performanceMonitor?.reset?.();
    engine.runRenderLoop(flock._renderLoop);
  },
  // Wrap a yield primitive so it holds while frozen: a background tab or a
  // paused project must spend no real time running loops, matching wait() and
  // the game clock. A stopped run abandons the held yield exactly as it would
  // otherwise, so abort only needs to detach the listener.
  makeFreezeAwareYield(nativeYield, signal) {
    return (settle) => {
      if (!flock.isFrozen()) {
        nativeYield(settle);
        return;
      }
      const onThaw = () => {
        if (flock.isFrozen()) return;
        flock.freezeEvents.removeEventListener('change', onThaw);
        signal?.removeEventListener('abort', onAbort);
        nativeYield(settle);
      };
      const onAbort = () => flock.freezeEvents.removeEventListener('change', onThaw);
      flock.freezeEvents.addEventListener('change', onThaw);
      signal?.addEventListener('abort', onAbort, { once: true });
    };
  },
  // Counted-loop yield: scheduler.yield() resumes when the browser is free (not
  // at the next paint); fall back to rAF where unavailable. Guarded like rAF so
  // a stopped run never resumes; held while frozen.
  makeLoopYield(guard, signal) {
    const schedulerYield = window.scheduler?.yield?.bind(window.scheduler) ?? null;
    const requestAnimationFrame = window.requestAnimationFrame.bind(window);
    const nativeYield = (settle) =>
      schedulerYield ? schedulerYield().then(settle, settle) : requestAnimationFrame(settle);
    const held = flock.makeFreezeAwareYield(nativeYield, signal);
    return (callback) => held(guard(callback));
  },
  // setTimeout that spends no frozen time: it holds while the tab is hidden or
  // the project is paused and resumes with the delay that was left, so a
  // block's "for N seconds" means N running seconds — the same rule as wait().
  // Returns a handle whose cancel() stops it and detaches the listener.
  freezeAwareTimeout(callback, ms) {
    let remaining = Math.max(0, Number(ms) || 0);
    let startedAt = 0;
    let running = false;
    let id = null;
    let done = false;

    const cancel = () => {
      if (done) return;
      done = true;
      running = false;
      clearTimeout(id);
      flock.freezeEvents.removeEventListener('change', onFreezeChange);
    };
    const fire = () => {
      cancel();
      callback();
    };
    const arm = () => {
      startedAt = performance.now();
      running = true;
      id = setTimeout(fire, remaining);
    };
    const onFreezeChange = () => {
      if (flock.isFrozen()) {
        if (!running) return;
        running = false;
        clearTimeout(id);
        remaining = Math.max(0, remaining - (performance.now() - startedAt));
      } else if (!running) {
        arm();
      }
    };

    flock.freezeEvents.addEventListener('change', onFreezeChange);
    if (!flock.isFrozen()) arm();
    return { cancel };
  },
};
