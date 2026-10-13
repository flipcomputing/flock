// Flock - Creative coding in 3D
// Dr Tracy Gardner - https://github.com/tracygardner
// Flip Computing Limited - flipcomputing.com

import HavokPhysics from '@babylonjs/havok';
import * as BABYLON from '@babylonjs/core';
import * as BABYLON_LOADER from '@babylonjs/loaders';
import { GradientMaterial, ShadowOnlyMaterial } from '@babylonjs/materials';

// Point Babylon’s Draco loader at local folder for offline use
BABYLON.DracoCompression.Configuration = {
  decoder: {
    wasmUrl: './draco/draco_wasm_wrapper_gltf.js',
    wasmBinaryUrl: './draco/draco_decoder_gltf.wasm',
    fallbackUrl: './draco/draco_decoder_gltf.js',
  },
};
import earcut from 'earcut';
import '@fontsource/atkinson-hyperlegible-next';
import '@fontsource/atkinson-hyperlegible-next/500.css';
import '@fontsource/atkinson-hyperlegible-next/600.css';

import '@fontsource/asap';
import '@fontsource/asap/500.css';
import '@fontsource/asap/600.css';
import { characterNames, getModelDisplayName } from './config';
import { flockRuntimeUrl } from './runtime/urls.js';
import { startStandaloneWhenReady } from './standalone.js';

import { FlowGraphLog10Block } from '@babylonjs/core';
const optionalBabylonDeps = { earcut, FlowGraphLog10Block };
const globalEarcutTarget = typeof globalThis !== 'undefined' ? globalThis : undefined;

if (globalEarcutTarget) {
  Object.assign(globalEarcutTarget, optionalBabylonDeps);
}
import { flockCSG, setFlockReference as setFlockCSG } from './api/csg';
import { flockAnimate, setFlockReference as setFlockAnimate } from './api/animate';
import { flockSound, setFlockReference as setFlockSound } from './api/sound';
import { flockUI, setFlockReference as setFlockUI } from './api/ui';
import { flockMovement, setFlockReference as setFlockMovement } from './api/movement';
import { flockModels, setFlockReference as setFlockModels } from './api/models';
import { flockShapes, setFlockReference as setFlockShapes } from './api/shapes';
import { flockTransform, setFlockReference as setFlockTransform } from './api/transform';
import { flockMaterial, setFlockReference as setFlockMaterial } from './api/material';
import { flockEffects, setFlockReference as setFlockEffects } from './api/effects';
import { flockPhysics, setFlockReference as setFlockPhysics } from './api/physics';
import { createFlockXRState, flockXR, setFlockReference as setFlockXR } from './api/xr';
import { flockControl, setFlockReference as setFlockControl } from './api/control';
import { flockScene, setFlockReference as setFlockScene } from './api/scene';
import { flockMesh, setFlockReference as setFlockMesh } from './api/mesh';
import { flockCamera, setFlockReference as setFlockCamera } from './api/camera';
import { flockEvents, setFlockReference as setFlockEvents } from './api/events';
import { flockSections, setFlockReference as setFlockSections } from './api/sections';
import { flockMicrobit, setFlockReference as setFlockMicrobit } from './api/microbit';
import { setFlockReference as setFlockMicrobitManager } from './microbit/manager.js';
import { flockMath, setFlockReference as setFlockMath } from './api/math';
import { flockSensing, setFlockReference as setFlockSensing } from './api/sensing';
import { flockSandbox, setFlockReference as setFlockSandbox } from './runtime/sandbox.js';
import { flockReadiness, setFlockReference as setFlockReadiness } from './runtime/readiness.js';
import { flockLifecycle, setFlockReference as setFlockLifecycle } from './runtime/lifecycle.js';
import { translate } from './main/translation.js';
import { handleError, markReported } from './ui/notifications.js';
import { getShowInternalNodes, setShowInternalNodes } from './ui/inspectorVisibility.js';

export const flock = {
  blockDebug: false,
  separateAnimations: true,
  memoryDebug: false,
  memoryMonitorInterval: 5000,
  materialsDebug: false,
  meshDebug: false,
  performanceOverlay: false,
  get showInternalNodes() {
    return getShowInternalNodes();
  },
  set showInternalNodes(show) {
    setShowInternalNodes(show, this.scene);
  },
  hideProjectName: true, // input stays in DOM; save/export still reads its value
  maxMeshes: 5000,
  maxClonesPerSource: 500,
  meshLimitEnabled: false,
  meshRecyclingEnabled: false,
  console: console,
  havokAbortHandled: false,
  triggerHandlingDebug: false,
  soundDebug: false,
  modelPath: './models/',
  soundPath: './sounds/',
  imagePath: './images/',
  texturePath: './textures/',
  animationPath: './animations/',
  // Keep optional Babylon dependencies referenced so bundlers include them.
  optionalBabylonDeps,
  engine: null,
  engineReady: false,
  eventDebug: false,
  modelReadyPromises: new Map(),
  pendingMeshCreations: 0,
  pendingTriggers: new Map(),
  pendingIntersections: new Map(),
  _nameRegistry: new Map(),
  _liveNameCache: new Map(),
  _animationFileCache: {},
  _ambiguousLiveNames: new Set(),
  getModelDisplayName,
  characterNames: characterNames,
  alert: alert,
  BABYLON: BABYLON,
  BABYLON_LOADER: BABYLON_LOADER,
  GradientMaterial: GradientMaterial,
  ShadowOnlyMaterial: ShadowOnlyMaterial,
  scene: null,
  highlighter: null,
  glowLayer: null,
  mainLight: null,
  shadowLight: null,
  shadowGenerator: null,
  shadowCasters: new Set(),
  shadowExcluded: new Set(),
  xrFramebufferScale: 1.2,
  xrFixedFoveation: 0.5,
  hk: null,
  havokInstance: null,
  initialClearColor: null,
  ground: null,
  sky: null,
  GUI: null,
  EXPORT: null,
  controlsTexture: null,
  _xrHUDControlRoots: [],
  inputManager: null,
  canvas: null,
  abortController: null,
  // Set only while a section's own setup code (loadSection) is running.
  _currentSection: null,
  _renderLoop: null,
  _renderLoopStopped: false,
  _contextLostAt: null,
  _escalationTimer: null,
  _webglVisibilityListenerAdded: false,
  _webglContextLostListenerAdded: false,
  _audioFreezeListenerAdded: false,
  _audioSuspendedByFreeze: false,
  document: document,
  disposed: null,
  events: {},
  modelCache: {},
  globalSounds: [],
  originalModelTransformations: {},
  modelsBeingLoaded: {},
  geometryCache: {},
  materialCache: {},
  physicsShapeCache: {},
  flockNotReady: true,
  // Diagnostic flag like memoryDebug: logs raw micro:bit serial lines and
  // WebUSB status chatter to the console (debug level) while true.
  microbitDebug: false,
  lastFrameTime: 0,
  savedCamera: null,
  _editorView: false,
  ...createFlockXRState(),
  ...flockCSG,
  ...flockAnimate,
  ...flockSound,
  ...flockUI,
  ...flockMovement,
  ...flockModels,
  ...flockShapes,
  ...flockTransform,
  ...flockMaterial,
  ...flockEffects,
  ...flockPhysics,
  ...flockScene,
  ...flockMesh,
  ...flockCamera,
  ...flockXR,
  ...flockControl,
  ...flockEvents,
  ...flockSections,
  ...flockMicrobit,
  ...flockSensing,
  ...flockMath,
  ...flockSandbox,
  ...flockReadiness,
  ...flockLifecycle,
  // onBlockError lets the UI show a translated message from key + values.
  onBlockError: null,
  _debugLogging: undefined,
  // Testing phase: warnings ON by default (?debug=false silences).
  // TODO: revert to opt-in (`=== 'true'`, default false) after testing.
  isDebugLoggingEnabled() {
    if (flock._debugLogging === undefined) {
      try {
        flock._debugLogging = new URLSearchParams(window.location.search).get('debug') !== 'false';
      } catch {
        flock._debugLogging = true;
      }
    }
    return flock._debugLogging;
  },
  reportBlockError({ key, values = {}, api, error } = {}) {
    // A caught value can come straight from user code, so classify and report
    // through safe primitives rather than its own getters.
    const safe = error == null ? undefined : flock.sanitizeError(error);
    if (safe?.name === 'AbortError') return;
    // A stack overflow is nearly always runaway user recursion; report it as
    // such. Message differs by engine (V8 "call stack", Firefox "recursion").
    if (
      (safe?.name === 'RangeError' || safe?.name === 'InternalError') &&
      /call stack|recursion/i.test(safe.message)
    ) {
      key = 'recursion_too_deep';
    }
    // One fault can fire in a burst (stack-overflow cascade, per-frame loop error), so
    // collapse within a short window when key, API and message match (`values` is not compared).
    const now = Date.now();
    const sig = `${key}\0${api ?? ''}\0${safe?.message ?? ''}`;
    if (sig === flock._lastErrorSig && now - flock._lastErrorAt < 1000) {
      return;
    }
    flock._lastErrorSig = sig;
    flock._lastErrorAt = now;
    if (flock.isDebugLoggingEnabled()) {
      console.warn(`[flock] ${api ?? 'block'}: ${key}`, values, safe ?? '');
    }
    try {
      flock.onBlockError?.({ key, values, api, error: safe });
    } catch {
      // a broken listener must not break the swallow path
    }
  },
  // User code can throw any value, including one whose name/message/stack getters throw or
  // return non-strings. Read each once into a plain Error so host handlers see only safe
  // primitives. A getter that hangs is undefendable — that's user code hanging itself.
  sanitizeError(error) {
    const read = (get) => {
      try {
        const v = get();
        return v == null ? '' : String(v);
      } catch {
        return '';
      }
    };
    // A thrown primitive (e.g. `throw "bad input"`) has no .message, so use the
    // value itself rather than losing the text.
    const isPrimitive = error == null || (typeof error !== 'object' && typeof error !== 'function');
    const safe = new Error(isPrimitive ? read(() => error) : read(() => error?.message));
    safe.name = isPrimitive ? 'Error' : read(() => error?.name) || 'Error';
    safe.stack = isPrimitive ? '' : read(() => error?.stack);
    return safe;
  },
  requireMesh(target, { api, name } = {}) {
    if (target instanceof flock.BABYLON.AbstractMesh) return true;
    flock.reportBlockError({
      key: target == null ? 'object_not_found' : 'target_not_a_mesh',
      api,
      values: { object: name },
    });
    return false;
  },
  // Enhanced error reporting with block context
  createEnhancedError(error, code) {
    const lines = code.split('\n');
    const errorContext = {
      message: error.message,
      stack: error.stack,
      codeSnippet: null,
      suggestion: null,
    };

    // Try to extract line number from error
    const lineMatch = error.stack?.match(/at .*:(\d+):\d+/);
    if (lineMatch) {
      const lineNum = parseInt(lineMatch[1]) - 1;
      if (lineNum >= 0 && lineNum < lines.length) {
        const start = Math.max(0, lineNum - 2);
        const end = Math.min(lines.length, lineNum + 3);
        errorContext.codeSnippet = lines
          .slice(start, end)
          .map((line, idx) => {
            const actualLine = start + idx;
            const marker = actualLine === lineNum ? '>>> ' : '    ';
            return `${marker}${actualLine + 1}: ${line}`;
          })
          .join('\n');
      }
    }

    // Add common error suggestions
    if (error.message.includes('is not defined')) {
      errorContext.suggestion =
        'Check if the variable or function name is spelled correctly and has been declared.';
    } else if (error.message.includes('Cannot read property')) {
      errorContext.suggestion = 'Check if the object exists before accessing its properties.';
    }

    return errorContext;
  },
  // Used by all mesh creation paths; inert unless flock.meshRecyclingEnabled.
  _recycleOldestByKey(key) {
    if (!flock.meshRecyclingEnabled) return;
    if (!flock._modelInstances) flock._modelInstances = Object.create(null);
    const current = Array.isArray(flock._modelInstances[key]) ? flock._modelInstances[key] : [];
    flock._modelInstances[key] = current.filter((name) => {
      const m = flock.scene?.getMeshByName(name);
      return m && !m.isDisposed();
    });
    const max = flock.maxClonesPerSource ?? 500;
    if (flock._modelInstances[key].length >= max) {
      const oldestName = flock._modelInstances[key][0];
      const oldest = flock.scene?.getMeshByName(oldestName);
      if (oldest) flock.disposeMesh(oldest);
      flock._modelInstances[key] = flock._modelInstances[key].slice(1);
    }
  },
  _registerInstance(key, meshName) {
    if (!flock._modelInstances) flock._modelInstances = Object.create(null);
    const current = Array.isArray(flock._modelInstances[key]) ? flock._modelInstances[key] : [];
    flock._modelInstances[key] = current.concat(meshName);
  },
  maxMeshesReached() {
    if (!flock.meshLimitEnabled) return false;
    const scene = flock?.scene;
    if (!scene || typeof flock.maxMeshes !== 'number') return false;

    const meshCount = scene.meshes.length;
    const max = flock.maxMeshes;

    if (meshCount >= max) {
      flock.printText?.({
        text: translate('max_mesh_limit_reached').replace('{max}', max),
        duration: 30,
        color: '#ff0000',
      });

      return true;
    }

    return false;
  },
  _resetCameraInputState(camera = flock.scene?.activeCamera) {
    if (!camera) return;

    // ArcRotateCamera inertial offsets can keep rotating after input ends.
    if ('inertialAlphaOffset' in camera) camera.inertialAlphaOffset = 0;
    if ('inertialBetaOffset' in camera) camera.inertialBetaOffset = 0;
    if ('inertialRadiusOffset' in camera) camera.inertialRadiusOffset = 0;
    if ('inertialPanningX' in camera) camera.inertialPanningX = 0;
    if ('inertialPanningY' in camera) camera.inertialPanningY = 0;

    // Free/Universal camera deltas can persist when pointer state desyncs.
    if (camera.cameraDirection?.set) {
      camera.cameraDirection.set(0, 0, 0);
    }
    if (camera.cameraRotation?.set) {
      camera.cameraRotation.set(0, 0);
    } else if (camera.cameraRotation) {
      camera.cameraRotation.x = 0;
      camera.cameraRotation.y = 0;
    }
  },
  _hardResetCameraControls(
    camera = flock.scene?.activeCamera,
    { reattachDelayMs = 0, noPreventDefault = true } = {}
  ) {
    if (!camera || !flock.canvas) return;
    if (typeof camera.detachControl !== 'function') return;
    if (typeof camera.attachControl !== 'function') return;

    camera.detachControl(flock.canvas);
    flock._resetCameraInputState(camera);

    if (flock._cameraControlReattachTimer) {
      clearTimeout(flock._cameraControlReattachTimer);
      flock._cameraControlReattachTimer = null;
    }

    const reattach = () => {
      if (!flock.scene || flock.scene.activeCamera !== camera) return;
      if (flock._canvasControlsEnabled === false) return;
      flock._resetCameraInputState(camera);
      camera.attachControl(flock.canvas, noPreventDefault);
      flock._cameraControlReattachTimer = null;
    };

    if (reattachDelayMs > 0) {
      flock._cameraControlReattachTimer = setTimeout(reattach, reattachDelayMs);
      return;
    }

    reattach();
  },
  getTotalSceneVertices() {
    return flock.scene.meshes.reduce((total, mesh) => {
      return total + mesh.getTotalVertices();
    }, 0);
  },
  checkMemoryUsage() {
    if (!performance.memory) {
      return; // Not available in all browsers
    }

    const used = performance.memory.usedJSHeapSize / 1024 / 1024;
    const total = performance.memory.totalJSHeapSize / 1024 / 1024;
    const limit = performance.memory.jsHeapSizeLimit / 1024 / 1024;

    console.log(
      `Memory: ${used.toFixed(1)}MB used / ${total.toFixed(1)}MB allocated / ${limit.toFixed(1)}MB limit`
    );

    // Warn if approaching limits
    const usagePercent = (used / limit) * 100;
    if (usagePercent > 80) {
      console.warn(`High memory usage: ${usagePercent.toFixed(1)}% of limit`);
      // Show user warning in UI
      this.printText({
        text: translate('high_memory_usage_warning').replace('{percent}', usagePercent.toFixed(1)),
        duration: 3,
        color: '#ff9900',
      });
    }

    // Count Babylon.js objects for more specific monitoring
    if (flock.scene) {
      const counts = {
        meshes: flock.scene.meshes.length,
        geometries: Object.keys(flock.geometryCache).length,
        vertices: flock.getTotalSceneVertices(),
        materials: flock.scene.materials.length,
        cachedMaterials: Object.keys(flock.materialCache).length,
        textures: flock.scene.textures.length,
        animationGroups: flock.scene.animationGroups.length,
      };
      console.log('Scene objects:', counts);
    }
  },
  startMemoryMonitoring() {
    console.log('Starting memory monitoring...');
    // Clear any existing monitoring
    if (flock.memoryMonitorInterval) {
      clearInterval(flock.memoryMonitorInterval);
    }

    // Get the abort signal
    const signal = flock.abortController?.signal;

    if (signal?.aborted) {
      return; // Don't start if already aborted
    }

    // Monitor every 5 seconds
    flock.memoryMonitorInterval = setInterval(() => {
      // Check if aborted before each check
      if (signal?.aborted) {
        clearInterval(flock.memoryMonitorInterval);
        flock.memoryMonitorInterval = null;
        return;
      }

      flock.checkMemoryUsage();
    }, 5000);

    // Clean up when aborted
    signal?.addEventListener('abort', () => {
      if (flock.memoryMonitorInterval) {
        clearInterval(flock.memoryMonitorInterval);
        flock.memoryMonitorInterval = null;
      }
    });
  },
  // Havok's wasm needs WebAssembly SIMD, which iOS Safari only has from 16.4.
  // Older engines can't parse the v128 return type in this module's type
  // section, so validate() is false there and true everywhere Havok can run.
  isWasmSimdSupported() {
    if (flock._wasmSimdSupported === undefined) {
      try {
        flock._wasmSimdSupported =
          typeof WebAssembly !== 'undefined' &&
          WebAssembly.validate(
            new Uint8Array([
              0, 97, 115, 109, 1, 0, 0, 0, 1, 5, 1, 96, 0, 1, 123, 3, 2, 1, 0, 10, 10, 1, 8, 0, 65,
              0, 253, 15, 253, 98, 11,
            ])
          );
      } catch {
        // A throwing validate() means the engine can't handle the module at all.
        flock._wasmSimdSupported = false;
      }
    }
    return flock._wasmSimdSupported;
  },
  isPhysicsMemoryAbort(error) {
    const message = `${error?.message ?? error}`.toLowerCase();
    const isWasmRuntimeError =
      typeof WebAssembly !== 'undefined' && error instanceof WebAssembly.RuntimeError;
    // Emscripten wraps a wasm parse failure as "Aborted(CompileError: …)".
    // That's a missing capability, not memory pressure.
    if (message.includes('compileerror') || !flock.isWasmSimdSupported()) {
      return false;
    }
    return message.includes('out of memory') || (isWasmRuntimeError && message.includes('abort'));
  },
  // Loader is injectable so tests can assert the wasm is never fetched when
  // the device can't run it.
  async ensurePhysicsInstance(loadHavok = HavokPhysics) {
    if (!flock.isWasmSimdSupported()) {
      const error = new Error('WebAssembly SIMD is unavailable, so Havok physics cannot start.');
      handleError(error, { source: 'physics-unsupported' });
      throw markReported(error);
    }

    // Callers that arrive together share one in-flight load, so a second
    // caller can't start a duplicate wasm instance and leak the loser.
    if (!flock.havokInstance) {
      const pending = (flock._havokInstancePromise ??= loadHavok());
      try {
        const instance = await pending;
        // Commit/clear only our own load: a mid-await reset (OOM) must not
        // restore a stale instance, and a rejection must still allow a retry.
        if (flock._havokInstancePromise === pending) {
          flock.havokInstance = instance;
        }
      } finally {
        if (flock._havokInstancePromise === pending) {
          flock._havokInstancePromise = undefined;
        }
      }
    }

    return flock.havokInstance;
  },
  handlePhysicsOutOfMemory(error) {
    if (flock.havokAbortHandled) {
      return;
    }

    flock.havokAbortHandled = true;

    try {
      flock._renderLoopStopped = true;
      if (flock._renderLoop) {
        flock.engine?.stopRenderLoop(flock._renderLoop);
      } else {
        flock.engine?.stopRenderLoop();
      }
      flock.abortController?.abort();
    } catch (e) {
      console.log('Failed to stop render loop during physics OOM handling:', e);
    }

    try {
      flock.hk?.dispose?.();
    } catch (e) {
      console.log('Failed to dispose Havok instance during physics OOM handling:', e);
    }

    // Clear the instance so the next run reloads a fresh one.
    flock.hk = null;
    flock.havokInstance = null;
    flock._havokInstancePromise = undefined;

    handleError(error, { source: 'physics-oom', fatal: true });
  },
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
  // Runtime helper
  describeMesh(meshName, text) {
    const safeText = flock.sanitizeInlineText(String(text ?? '').substring(0, 256));
    if (!safeText) return;

    return flock.whenModelReady(meshName, (mesh) => {
      if (!mesh) return;
      const root = mesh.metadata?.boundingBox ?? mesh;
      if (root.metadata) {
        root.metadata.displayName = safeText;
      }
      const setOnChildren = (m) => {
        if (m.metadata) {
          m.metadata.displayName = safeText;
        }
      };
      if (typeof root.getChildMeshes === 'function') {
        root.getChildMeshes(false).forEach(setOnChildren);
      }
    }).then(() => {});
  },

  sanitizeInlineText(input) {
    return String(input)
      .replace(/\r?\n/g, ' ')
      .replace(/\*\//g, '*∕')
      .replace(/\/\//g, '∕∕')
      .replace(/`/g, 'ˋ');
  },

  download(filename, data, mimeType) {
    const blob = new Blob([data], { type: mimeType });
    const url = URL.createObjectURL(blob);
    const a = flock.document.createElement('a');
    a.href = url;
    a.download = filename;
    flock.document.body.appendChild(a);
    a.click();
    flock.document.body.removeChild(a);
    URL.revokeObjectURL(url);
  },
};

function bindFlockModules() {
  setFlockCSG(flock);
  setFlockAnimate(flock);
  setFlockSound(flock);
  setFlockUI(flock);
  setFlockMovement(flock);
  setFlockModels(flock);
  setFlockShapes(flock);
  setFlockTransform(flock);
  setFlockMaterial(flock);
  setFlockEffects(flock);
  setFlockPhysics(flock);
  setFlockScene(flock);
  setFlockMesh(flock);
  setFlockCamera(flock);
  setFlockXR(flock);
  setFlockMath(flock);
  setFlockControl(flock);
  setFlockEvents(flock);
  setFlockSections(flock);
  setFlockMicrobit(flock);
  setFlockSensing(flock);
  setFlockSandbox(flock);
  setFlockReadiness(flock);
  setFlockLifecycle(flock);
}

flock._bindModules = bindFlockModules;

// Bind API module closures at load time so workspace-load paths (e.g. the XR
// hint) can call flock helpers before the first scene runs. initializeNewScene
// re-asserts the same reference after each reset.
bindFlockModules();
setFlockMicrobitManager(flock);

flock.runtimeUrl = flockRuntimeUrl;

export { initializeFlock } from './standalone.js';

window.setBPM = flockSound.setBPM;
window.updateListenerPositionAndOrientation = flockSound.updateListenerPositionAndOrientation;
window.speak = flockSound.speak;

document.addEventListener('visibilitychange', () => {
  flock.freezeEvents.dispatchEvent(new Event('change'));
});

startStandaloneWhenReady();
