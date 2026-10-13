// Flock - Creative coding in 3D
// Dr Tracy Gardner - https://github.com/tracygardner
// Flip Computing Limited - flipcomputing.com

import HavokPhysics from '@babylonjs/havok';
import * as BABYLON from '@babylonjs/core';
import * as BABYLON_GUI from '@babylonjs/gui/2D/index.js';
import * as BABYLON_LOADER from '@babylonjs/loaders';
import { GradientMaterial, ShadowOnlyMaterial } from '@babylonjs/materials';
import * as BABYLON_EXPORT from '@babylonjs/serializers';

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
const MAX_RENDER_PIXELS = 2560 * 1440;

function isRenderResolutionCapEnabled() {
  try {
    return new URLSearchParams(window.location.search).get('capResolution') === '1';
  } catch {
    return false;
  }
}

function renderPixelRatio() {
  const dpr = window.devicePixelRatio || 1;
  const screenPixels = (window.screen?.width || 0) * (window.screen?.height || 0);
  if (!isRenderResolutionCapEnabled() || !screenPixels) return dpr;
  return Math.max(1, Math.min(dpr, Math.sqrt(MAX_RENDER_PIXELS / screenPixels)));
}


if (globalEarcutTarget) {
  Object.assign(globalEarcutTarget, optionalBabylonDeps);
}
import { flockCSG, setFlockReference as setFlockCSG } from './api/csg';
import { flockAnimate, setFlockReference as setFlockAnimate } from './api/animate';
import { flockSound, setFlockReference as setFlockSound } from './api/sound';
import { flockUI, setFlockReference as setFlockUI } from './api/ui';
import { flockMovement, setFlockReference as setFlockMovement } from './api/movement';
import { flockModels, setFlockReference as setFlockModels } from './api/models';
import { flockShapes, getManifold, setFlockReference as setFlockShapes } from './api/shapes';
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
import {
  getMicrobitManager,
  setFlockReference as setFlockMicrobitManager,
} from './microbit/manager.js';
import { flockMath, setFlockReference as setFlockMath } from './api/math';
import { flockSensing, setFlockReference as setFlockSensing } from './api/sensing';
import { flockSandbox, setFlockReference as setFlockSandbox } from './runtime/sandbox.js';
import { flockReadiness, setFlockReference as setFlockReadiness } from './runtime/readiness.js';
import { translate } from './main/translation.js';
import { handleError, dismissBanner, showBanner, markReported } from './ui/notifications.js';
import { attachInteractIndicator, detachInteractIndicator } from './ui/interactIndicator.js';
import { getShowInternalNodes, setShowInternalNodes } from './ui/inspectorVisibility.js';
import { InputManager } from './input/inputManager.js';
import { KeyboardSource } from './input/keyboardSource.js';
import { OnScreenSource } from './input/onScreenSource.js';
import { GamepadSource } from './input/gamepadSource.js';
import { CameraControls } from './input/cameraControls.js';
import { getBoundKeys } from './input/bindings.js';

import {
  enableSceneDescription,
  announceSayText,
  announceObjectSay,
  getObjectLabel,
  recordObjectPromptText,
  recordObjectSayText,
  setTransientSayText,
  recordWorldInstructionText,
} from './accessibility/accessibility.js';
import { initUIAccessibility, clearUIControls } from './accessibility/uiA11y.js';

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
  async initialize() {
    flock.BABYLON = BABYLON;
    flock.GUI = BABYLON_GUI;
    flock.EXPORT = BABYLON_EXPORT;
    flock.document = document;
    flock.canvas = flock.document.getElementById('renderCanvas');
    // Make canvas focusable for keyboard events
    flock.canvas.tabIndex = -1;
    initUIAccessibility(flock.canvas);
    //flock.canvas.setAttribute("aria-label", "Flock 3D world canvas");
    flock.scene = null;
    flock.ground = null;
    flock.sky = null;
    flock.engineReady = false;
    flock.inputManager = new InputManager();
    flock._onScreenSource = new OnScreenSource(flock.inputManager, { target: flock.canvas });

    // micro:bit events also pulse the key pipeline as a momentary edge, so
    // "any"-device micro:bit blocks (and legacy projects, which generate
    // whenKeyEvent) respond to boards connected over WebUSB.
    if (!flock._microbitKeySinkAttached) {
      flock._microbitKeySinkAttached = true;
      setFlockMicrobitManager(flock); // lets the manager read flock.microbitDebug
      const microbitManager = getMicrobitManager();
      microbitManager.onAnyEvent((char) => {
        flock.inputManager?._setKey(char, true);
        flock.inputManager?._setKey(char, false);
      });
      // Silently reconnect known boards (navigator.usb.getDevices) and watch
      // for replugs. No-op where WebUSB is unavailable.
      microbitManager.init();
    }
    flock.displayScale = renderPixelRatio() * 0.75;
    flock.BABYLON.Database.IDBStorageEnabled = true;
    flock.BABYLON.Engine.CollisionsEpsilon = 0.00005;
    await flock.document.fonts.ready; // Wait for all fonts to be loaded
    flock.abortController = new AbortController();

    try {
      const manifoldWasm = await getManifold(flockRuntimeUrl('wasm/manifold.wasm'));
      await flock.BABYLON.InitializeCSG2Async({
        manifoldInstance: manifoldWasm.Manifold,
        manifoldMeshInstance: manifoldWasm.Mesh,
      });
    } catch (error) {
      // CSG2 powers only boolean mesh blocks; the rest of the app still works.
      console.warn('CSG2 unavailable; mesh boolean blocks are disabled.', error);
    }

    flock.canvas.addEventListener(
      'touchend',
      (event) => {
        if (event.touches.length === 0) {
          // Canvas is touchable before the first run and after disposal, when
          // there is no scene yet.
          const camera = flock.scene?.activeCamera;
          const input = camera?.inputs?.attached?.pointers;
          if (
            input &&
            (input._pointA !== null || input._pointB !== null || input._isMultiTouch === true)
          ) {
            flock._hardResetCameraControls(camera, {
              reattachDelayMs: 100,
              noPreventDefault: true,
            });
          }
        }
      },
      { passive: false }
    );

    // Block synthetic on-screen key events from reaching Babylon camera plugins
    // when an ArcRotateCamera is active — physical arrow keys still work for
    // keyboard accessibility; only __flockSynthetic events are stopped.
    const _blockSyntheticForArcRotate = (e) => {
      if (
        e.__flockSynthetic &&
        flock.scene?.activeCamera instanceof flock.BABYLON.ArcRotateCamera
      ) {
        e.stopImmediatePropagation();
      }
    };
    flock.canvas.addEventListener('keydown', _blockSyntheticForArcRotate, true);
    flock.canvas.addEventListener('keyup', _blockSyntheticForArcRotate, true);

    flock._keyboardSource = new KeyboardSource(flock.inputManager, {
      target: flock.canvas,
      onBlur: () => flock._hardResetCameraControls(flock.scene?.activeCamera),
    });
    flock._keyboardSource.start();

    // Hardening for rare pointer/input desync where camera keeps moving
    // after input ends or browser focus changes.
    window.addEventListener('blur', () => {
      flock._gamepadSource?.releaseAllKeys();
      // Babylon.js bug: camera drifts after window blur; force-reset to stop it.
      flock._hardResetCameraControls(flock.scene?.activeCamera);
    });

    window.addEventListener('pointerup', () => {
      flock._hardResetCameraControls(flock.scene?.activeCamera);
    });

    // macOS suppresses keyup for keys released while ⌘ is held; Babylon's
    // camera keyboard input keeps them in _keys, so the camera would drift
    // until the next blur. Clear its held keys when ⌘ comes up.
    flock.canvas.addEventListener('keyup', (e) => {
      if (e.key !== 'Meta') return;
      const kb = flock.scene?.activeCamera?.inputs?.attached?.keyboard;
      if (kb?._keys) kb._keys.length = 0;
    });

    flock.engineReady = true;
  },
  _scheduleContextEscalation() {
    clearTimeout(flock._escalationTimer);
    flock._escalationTimer = setTimeout(() => {
      flock._escalationTimer = null;
      if (flock.engine?.isContextLost?.()) {
        handleError(new Error('WebGL context restore timeout'), {
          source: 'webgl-lost',
          fatal: true,
        });
      }
    }, 8000);
  },
  createEngine() {
    flock.engine?.dispose();
    flock.engine = null;

    try {
      flock.engine = new flock.BABYLON.Engine(flock.canvas, true, {
        preserveDrawingBuffer: true,
        stencil: true,
        powerPreference: 'default',
      });
    } catch (error) {
      // WebGL unavailable or blacklisted: a device problem, not the project's.
      handleError(error, { source: 'webgl-lost', fatal: true });
      throw markReported(error);
    }

    flock.engine.disableUniformBuffers = true; // Meshes with alpha black on Samsung A14

    // Set on the engine, not the element: Babylon reapplies its default on every pointer move.
    flock.engine.canvasTabIndex = 0;

    if (!flock._webglContextLostListenerAdded) {
      flock._webglContextLostListenerAdded = true;
      // Call preventDefault() on the raw event so the browser is willing to restore.
      flock.canvas.addEventListener('webglcontextlost', (event) => {
        event.preventDefault();
      });
    }

    flock.engine.onContextLostObservable.add(() => {
      flock._contextLostAt = Date.now();
      showBanner('webgl-lost', {
        message: translate('error_webgl_restoring'),
      });
      if (document.visibilityState === 'visible') {
        flock._scheduleContextEscalation();
      }
    });

    flock.engine.onContextRestoredObservable.add(() => {
      clearTimeout(flock._escalationTimer);
      flock._escalationTimer = null;
      flock._contextLostAt = null;
      dismissBanner('webgl-lost');
      flock.engine.resize();
      flock._resumeRenderLoop();
    });

    if (!flock._webglVisibilityListenerAdded) {
      flock._webglVisibilityListenerAdded = true;
      document.addEventListener('visibilitychange', () => {
        if (document.visibilityState === 'visible' && flock._contextLostAt) {
          flock.engine?.resize();
          if (!flock._escalationTimer) {
            flock._scheduleContextEscalation();
          }
        }
      });
    }

    if (!flock._audioFreezeListenerAdded) {
      flock._audioFreezeListenerAdded = true;
      flock.freezeEvents.addEventListener('change', () => {
        flock.syncAudioWithFreeze?.();
      });
    }

    if (!flock._renderFreezeListenerAdded) {
      flock._renderFreezeListenerAdded = true;
      flock.freezeEvents.addEventListener('change', () => {
        if (document.hidden) {
          // Stop outright rather than leaning on the browser to throttle rAF:
          // everything driven by scene.render() (physics, animations, forever,
          // waitUntil) then freezes with the clock, audio and loop yields
          // instead of crawling on in the background.
          flock.engine?.stopRenderLoop();
        } else {
          flock._resumeRenderLoop();
        }
      });
    }

    if (!flock._gameClockFreezeListenerAdded) {
      flock._gameClockFreezeListenerAdded = true;
      flock._frozenAccumMs = 0;
      flock._frozenAt = flock.isFrozen() ? Date.now() : null;
      flock.freezeEvents.addEventListener('change', () => {
        if (flock.isFrozen()) {
          flock._frozenAt ??= Date.now();
        } else if (flock._frozenAt != null) {
          flock._frozenAccumMs += Date.now() - flock._frozenAt;
          flock._frozenAt = null;
        }
      });
    }

    flock.engine.enableOfflineSupport = false;
    flock.engine.setHardwareScalingLevel(1 / renderPixelRatio());
  },
  async disposeOldScene() {
    flock.flockNotReady = true;

    if (flock.memoryDebug)
      if (flock.hk) {
        const [, stats] = flock.hk._hknp.HP_GetStatistics();

        const [
          numBodies,
          numShapes,
          numConstraints,
          numDebugGeometries,
          numWorlds,
          numQueryCollectors,
        ] = stats;

        console.log('Havok bodies:', numBodies);
        console.log('Havok shapes:', numShapes);
        console.log('Havok constraints:', numConstraints);
        console.log('Havok debug geometries:', numDebugGeometries);
        console.log('Havok worlds:', numWorlds);
        console.log('Havok query collectors:', numQueryCollectors);
        console.log(
          'Havok heap memory:',
          (flock.havokInstance.HEAPU8.buffer.byteLength / (1024 * 1024)).toFixed(2),
          'MB'
        );
      }

    if (flock.scene) {
      try {
        // Stop all sounds and animations first
        flock.stopAllSounds();
        flock.engine?.stopRenderLoop();

        if (flock.ground?.metadata) {
          const md = flock.ground.metadata;
          try {
            if (md.heightmapBody?._pluginData?.hpBodyId && flock.hk?.world) {
              flock.hk._hknp.HP_World_RemoveBody(
                flock.hk.world,
                md.heightmapBody._pluginData.hpBodyId
              );
            }
          } catch {
            /* ignore */
          }
          try {
            md.heightmapBody?.dispose();
          } catch {
            /* already disposed */
          }
          try {
            md.heightmapShape?.dispose();
          } catch {
            /* already disposed */
          }
          md.heightmapBody = null;
          md.heightmapShape = null;
        }

        flock._cameraControlBindings = null;
        flock._onScreenSource?.releaseAll();
        flock._onScreenSource?.stop();
        flock._joystickSource?.stop();
        flock._joystickSource = null;
        flock._gamepadSource?.stop();
        flock._gamepadSource = null;
        flock._xrSource?.stop();
        flock._xrSource = null;
        flock._restoreXREmbodiedVisibility?.();
        if (flock._xrViewObserver && flock._xrViewObserverScene) {
          flock._xrViewObserverScene.onBeforeRenderObservable.remove(flock._xrViewObserver);
          flock._xrViewObserver = null;
          flock._xrViewObserverScene = null;
        }
        try {
          flock.xrHelper?.dispose?.();
        } catch (error) {
          console.warn('Error disposing xrHelper:', error);
        }
        flock.xrHelper = null;
        flock.inputManager.resetActionKeys();
        detachInteractIndicator();

        flock._cameraControls?.stop();
        flock._cameraControls = null;

        if (flock._gamepadButtonObserver) {
          flock.scene.onBeforeRenderObservable.remove(flock._gamepadButtonObserver);
          flock._gamepadButtonObserver = null;
        }

        try {
          const canvas = flock.engine?.getRenderingCanvas?.();
          flock.scene?.activeCamera?.detachControl?.(canvas);
          flock.scene?.detachControl?.();
        } catch {
          /* ignore scene cleanup errors */
        }

        // Abort any ongoing operations
        if (flock.abortController) {
          flock.abortController.abort();
        }

        // Stop all animations and dispose animation groups
        flock.scene.stopAllAnimations();

        // Dispose animatables
        if (flock.scene.animatables) {
          [...flock.scene.animatables].forEach((animatable) => {
            try {
              animatable.stop();
              animatable.dispose?.();
            } catch (error) {
              console.warn('Error disposing animatable:', error);
            }
          });
        }

        // Dispose animation groups
        if (flock.scene.animationGroups) {
          [...flock.scene.animationGroups].forEach((group) => {
            if (group) {
              try {
                group.stop();
                group.dispose();
              } catch (error) {
                console.warn('Error disposing animation group:', error);
              }
            }
          });
        }

        // Clear all observables and event listeners
        flock.removeEventListeners();

        // Dispose UI elements
        flock.controlsTexture?.dispose();
        flock.controlsTexture = null;
        flock._xrHUDControlRoots = [];

        // Clear main UI texture and all its controls
        if (flock.scene.UITexture) {
          flock.scene.UITexture.dispose();
          flock.scene.UITexture = null;
        }

        // Clear advanced texture and stack panel
        if (flock.advancedTexture) {
          flock.advancedTexture.dispose();
          flock.advancedTexture = null;
        }

        if (flock.stackPanel) {
          flock.stackPanel.dispose();
          flock.stackPanel = null;
        }

        // Dispose sound tracks
        if (flock.scene.mainSoundTrack) {
          flock.scene.mainSoundTrack.dispose();
        }
        if (flock.scene.soundTracks) {
          flock.scene.soundTracks.forEach((track) => track?.dispose());
        }

        // Dispose post-processing effects
        if (flock.scene.postProcesses) {
          [...flock.scene.postProcesses].forEach((pp) => pp?.dispose());
        }
        flock.scene.postProcessRenderPipelineManager?.dispose();

        // Dispose effects
        flock.highlighter?.dispose();
        flock.highlighter = null;
        flock.glowLayer?.dispose();
        flock.glowLayer = null;

        // Dispose lighting
        flock.mainLight?.dispose();
        flock.mainLight = null;

        // Dispose particle systems first (before meshes they might be attached to)
        const particleSystems = flock.scene.particleSystems ? [...flock.scene.particleSystems] : [];
        particleSystems.forEach((system) => {
          if (system?.dispose) {
            try {
              system.dispose();
            } catch (error) {
              console.warn('Error disposing particle system:', error);
            }
          }
        });

        if (flock.scene.meshes) {
          for (const mesh of flock.scene.meshes) {
            const c = mesh?.metadata?.uprightConstraint;
            if (c) {
              try {
                c.dispose();
              } catch (e) {
                console.warn('Error disposing constraint:', e);
              }
              mesh.metadata.uprightConstraint = null;
            }
          }
        }

        // Dispose all meshes and their action managers
        const meshesToDispose = flock.scene.meshes ? [...flock.scene.meshes] : [];
        meshesToDispose.forEach((mesh) => {
          if (mesh?.actionManager) {
            try {
              mesh.actionManager.dispose();
            } catch (error) {
              console.warn('Error disposing action manager:', error);
            }
          }
          if (mesh?.material?.dispose && typeof mesh.material.dispose === 'function') {
            try {
              mesh.material.dispose();
            } catch (error) {
              console.warn('Error disposing mesh material:', error);
            }
          }
          if (mesh?.dispose && typeof mesh.dispose === 'function') {
            try {
              // Shared shapes are disposed via physicsShapeCache below
              if (!mesh.physics?.shape?._isShared) {
                mesh.physics?.shape?.dispose();
              }
              mesh.physics?.dispose();

              mesh.dispose();
            } catch (error) {
              console.warn('Error disposing mesh:', error);
            }
          }
        });

        // Dispose transform nodes
        const transformNodes = flock.scene.transformNodes ? [...flock.scene.transformNodes] : [];
        transformNodes.forEach((node) => {
          if (node?.dispose) {
            try {
              node.dispose();
            } catch (error) {
              console.warn('Error disposing transform node:', error);
            }
          }
        });

        // Dispose geometries (after meshes)
        const geometries = flock.scene.geometries ? [...flock.scene.geometries] : [];
        geometries.forEach((geometry) => {
          if (geometry?.dispose) {
            try {
              geometry.dispose();
            } catch (error) {
              console.warn('Error disposing geometry:', error);
            }
          }
        });

        // Clear camera
        if (flock.scene.activeCamera) {
          flock.scene.activeCamera.inputs?.clear();
          flock.scene.activeCamera.dispose();
        }

        // Dispose textures
        const textures = flock.scene.textures ? [...flock.scene.textures] : [];
        textures.forEach((texture) => {
          if (texture?.dispose && typeof texture.dispose === 'function') {
            try {
              texture.dispose();
            } catch (error) {
              console.warn('Error disposing texture:', error);
            }
          }
        });

        // Dispose materials that weren't caught earlier
        const materials = flock.scene.materials ? [...flock.scene.materials] : [];
        materials.forEach((material) => {
          if (material?.dispose && typeof material.dispose === 'function') {
            try {
              material.dispose();
            } catch (error) {
              console.warn('Error disposing material:', error);
            }
          }
        });

        // Clear all scene observables
        flock.scene.onActiveCameraChanged?.remove(flock._audioListenerObserver);
        flock._audioListenerObserver = null;
        flock._audioListenerTickObserver = null;
        flock.scene.onBeforeRenderObservable?.clear();
        flock.scene.onAfterRenderObservable?.clear();
        flock.scene.onBeforeAnimationsObservable?.clear();
        flock.scene.onAfterAnimationsObservable?.clear();
        flock.scene.onReadyObservable?.clear();
        flock.scene.onDataLoadedObservable?.clear();
        flock.scene.onDisposedObservable?.clear();
        flock.scene.onPointerObservable?.clear();
        flock.scene.onKeyboardObservable?.clear();

        // Wait for async operations to complete
        await new Promise((resolve) => setTimeout(resolve, 100));

        // Dispose any shapes still in the cache (e.g. from models disposed mid-scene
        // whose cache entry was never cleaned up). Must happen before hk.dispose().
        for (const shape of Object.values(flock.physicsShapeCache)) {
          if (!shape?._isDisposed) {
            try {
              shape.dispose();
            } catch {
              /* already disposed */
            }
          }
        }

        // Dispose physics engine and release WASM heap
        try {
          flock.hk?.dispose(); // Babylon's HavokPlugin wrapper
        } catch (error) {
          console.warn('Error disposing HavokPlugin:', error);
        }
        flock.hk = null;

        // Dispose of the scene
        flock.scene.dispose();
        flock.scene = null;

        // Dispose the Babylon.js engine
        //flock.engine?.dispose();
        //flock.engine = null;

        // Dispose Babylon audio engine, then close the underlying context.
        // Capture the context reference now — stopAllSounds() (called earlier) nulls
        // flock.audioContext without closing it when Babylon owns it, so we must
        // grab _audioContext directly before dispose clears the engine reference.
        // Closing the context kills all scheduled oscillators from playMidiNote that
        // are not tracked in globalSounds.
        const audioContextToClose = flock.audioEngine?._audioContext ?? flock.audioContext;
        try {
          flock.audioEngine?.dispose?.();
        } catch (error) {
          console.warn('Error disposing audioEngine:', error);
        }
        flock.audioEngine = null;
        flock.audioEnginePromise = null;

        if (audioContextToClose && audioContextToClose.state !== 'closed') {
          try {
            await audioContextToClose.close();
          } catch (error) {
            console.warn('AudioContext was already closed or closing:', error);
          }
        }
        flock.audioContext = null;
        flock._audioStopped = false;

        // Clear all references
        flock.events = {};
        flock.modelCache = {};
        flock.globalSounds = [];
        flock.modelsBeingLoaded = {};
        flock.originalModelTransformations = {};
        flock.geometryCache = {};
        flock.materialCache = {};
        flock.physicsShapeCache = {};
        flock.pendingTriggers = new Map();
        flock.pendingIntersections = new Map();
        flock.pendingSelfIntersections = new Map();
        flock.pendingTagIntersections = new Map();
        flock._nameRegistry = new Map();
        flock._liveNameCache = new Map();
        flock._ambiguousLiveNames = new Set();
        flock._animationFileCache = {};
        flock._modelInstances = Object.create(null);
        flock.ground = null;
        flock.sky = null;

        // Clear abort controller
        flock.abortController = null;

        // Force garbage collection in development (if available)
        if (typeof window !== 'undefined' && window.gc) {
          setTimeout(() => {
            try {
              window.gc();
              console.log('Forced garbage collection');
            } catch {
              // Silently fail if gc is not available
            }
          }, 100);
        }
      } catch (error) {
        console.error('Error during scene disposal:', error);
        // Even if disposal fails, clear critical references
        flock.scene = null;
        flock.engine = null;
        flock.flockNotReady = true;
      }
    } else {
      console.log('No scene to dispose');
      if (flock.abortController) {
        flock.abortController.abort();
        flock.abortController = null;
      }
    }
  },
  ensureAudio() {
    if (!flock.audioEnginePromise) {
      // iOS Safari polyfill — must run before Babylon calls new AudioContext().
      if (typeof window !== 'undefined' && !window.AudioContext && window.webkitAudioContext) {
        window.AudioContext = window.webkitAudioContext;
      }
      try {
        // Capture the promise reference so the .then() handler can detect if
        // cleanup ran (set audioEnginePromise to null) or a new scene replaced
        // it before this async init resolved — and dispose the stale engine.
        let enginePromise;
        // listenerAutoUpdate ticks on window rAF, which stops in an immersive XR
        // session. Driven from the scene render loop below so VR keeps distance falloff.
        enginePromise = flock.BABYLON.CreateAudioEngineAsync({
          volume: 1,
          listenerAutoUpdate: false,
          listenerEnabled: true,
          resumeOnInteraction: true,
        })
          .then((audioEngine) => {
            if (flock.audioEnginePromise !== enginePromise) {
              try {
                audioEngine.dispose?.();
              } catch {
                /* best-effort */
              }
              return;
            }
            flock.audioEngine = audioEngine;
            // resumeOnInteraction resumes on any click on the page, which
            // would restart audio that a pause suspended.
            audioEngine.stateChangedObservable?.add((state) => {
              if (state === 'running' && flock._audioSuspendedByFreeze) {
                audioEngine.pauseAsync().catch(() => {});
              }
            });
            dismissBanner('audio');
            flock.audioContext = audioEngine._audioContext ?? flock.audioContext;
            flock.globalStartTime = flock.audioContext?.currentTime ?? 0;
            if (flock.scene?.activeCamera) {
              audioEngine.listener.attach(flock.scene.activeCamera);
            }
            flock._audioListenerObserver = flock.scene?.onActiveCameraChanged?.add(() => {
              if (flock.scene?.activeCamera) {
                audioEngine.listener.attach(flock.scene.activeCamera);
              }
            });
            flock._audioListenerTickObserver = flock.scene?.onBeforeRenderObservable?.add(() => {
              if (flock.audioEngine !== audioEngine) return;
              audioEngine.listener.update();
            });
          })
          .catch((err) => {
            console.warn('[flock] Audio engine unavailable:', err);
            flock.audioEngine = null;
            showBanner('audio', { message: translate('error_audio') });
          });
        flock.audioEnginePromise = enginePromise;
      } catch (err) {
        console.warn('[flock] Audio engine unavailable:', err);
        flock.audioEngine = null;
        flock.audioEnginePromise = Promise.resolve();
        showBanner('audio', { message: translate('error_audio') });
      }
    }
    return flock.audioEnginePromise;
  },
  async initializeNewScene() {
    // Wait a bit more to ensure all disposal operations are complete
    await new Promise((resolve) => setTimeout(resolve, 200));

    // Stop existing render loop or create a new engine
    flock.engine ? flock.engine.stopRenderLoop() : flock.createEngine();

    // Reset scene-wide state
    flock.events = {};
    flock.modelCache = {};
    flock.globalSounds = [];
    flock.modelsBeingLoaded = {};
    flock.originalModelTransformations = {};
    flock.geometryCache = {};
    flock.pendingTriggers = new Map();
    flock.pendingIntersections = new Map();
    flock.pendingSelfIntersections = new Map();
    flock.pendingTagIntersections = new Map();
    flock._nameRegistry = new Map();
    flock._liveNameCache = new Map();
    flock.modelReadyPromises = new Map();
    flock._animationFileCache = {};
    flock._modelInstances = Object.create(null);
    flock.materialCache = {};
    flock._fogAwareShaderMaterials = new Set();
    flock.physicsShapeCache = {};
    flock.havokAbortHandled = false;
    flock.disposed = false;

    // Clear any error banner from a previous run now that we're starting fresh.
    dismissBanner('physics-oom');
    dismissBanner('project-run');

    // Create the new scene
    flock.scene = new flock.BABYLON.Scene(flock.engine);

    //Enable accessibility layer
    clearUIControls();
    enableSceneDescription(flock.scene, flock.inputManager);
    // Announce "say" and "printText" outputs so NVDA reads Blockly say blocks reliably.
    if (!flock._a11yTextWrapped) {
      // Wrap say(text, ...)
      if (typeof flock.say === 'function') {
        const originalSay = flock.say.bind(flock);
        flock.say = (...args) => {
          const result = originalSay(...args);

          const targetName = args?.[0];
          const options = args?.[1];
          const text = options && typeof options.text === 'string' ? options.text : '';
          const rawDuration = options?.duration;
          const duration =
            isFinite(Number(rawDuration)) && Number(rawDuration) > 0 ? Number(rawDuration) : 0;

          if (text.trim()) {
            if (duration > 0) {
              // Transient say: announce immediately and show in Ctrl+J while visible
              const mesh = flock.scene?.getMeshByName(targetName);
              const label = mesh ? getObjectLabel(mesh) : targetName;
              announceObjectSay(`${label} says: ${text}`);
              setTransientSayText(targetName, text, duration);
            } else {
              // Persistent say: store for Ctrl+J nearest-object reading
              recordObjectPromptText(targetName, text);
              recordObjectSayText(targetName, text);
            }
          }

          return result;
        };
      }

      // Wrap printText({ text: "..." })
      if (typeof flock.printText === 'function') {
        const originalPrintText = flock.printText.bind(flock);
        flock.printText = (...args) => {
          const result = originalPrintText(...args);

          const payload = args?.[0];
          const text =
            typeof payload === 'string'
              ? payload
              : payload && typeof payload.text === 'string'
                ? payload.text
                : '';

          if (text && text.trim()) {
            recordWorldInstructionText(text);
            announceSayText(text);
          }
          return result;
        };
      }

      flock._a11yTextWrapped = true;
    }

    flock._renderLoop = () => {
      try {
        flock.scene.render();
      } catch (error) {
        if (flock.isPhysicsMemoryAbort(error)) {
          flock.handlePhysicsOutOfMemory(error);
          return;
        }
        // Stop the loop so a crash doesn't re-fire every frame.
        flock._renderLoopStopped = true;
        flock.engine?.stopRenderLoop(flock._renderLoop);
        handleError(error, { source: 'project-run', fatal: false });
      }
    };

    // Apply and remember the app's default clear colour so it can be
    // restored if the user removes their sky/background blocks later.
    const defaultClearColor = flock.BABYLON.Color3.FromHexString('#33334c');
    flock.scene.clearColor = defaultClearColor.clone?.() ?? defaultClearColor;
    flock.initialClearColor = defaultClearColor.clone?.() ?? defaultClearColor;

    // Abort controller for clean-up
    flock.abortController = new AbortController();
    // Strong-reference Set, unlike _sections - reset per run to avoid leaking.
    flock._loadedSections = new Set();
    // Reset so a stale queued load from a previous run can't hold up this one.
    flock._loadQueueTail = Promise.resolve();
    flock._canvasControlsEnabled = undefined;
    // Subtitles default off each run; the enable_subtitles block opts in.
    flock.subtitlesEnabled = false;
    flock._subtitleControl = null;
    flock._subtitleToken = 0;
    flock._subtitleTimer = null;

    // Enable physics
    await flock.ensurePhysicsInstance();
    flock.hk = new flock.BABYLON.HavokPlugin(true, flock.havokInstance);
    flock.scene.enablePhysics(new flock.BABYLON.Vector3(0, -9.81, 0), flock.hk);
    flock._applyPauseToScene();
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

    // Add highlight layer
    flock.highlighter = new flock.BABYLON.HighlightLayer('highlighter', flock.scene);

    // Set up a new camera
    const camera = new flock.BABYLON.FreeCamera(
      'camera',
      new flock.BABYLON.Vector3(0, 3, -10),
      flock.scene
    );
    flock.savedCamera = camera;
    flock.defaultCamera = camera;
    flock.mainCamera = camera;
    camera.minZ = 0;
    camera.setTarget(flock.BABYLON.Vector3.Zero());
    camera.rotation.x = flock.BABYLON.Tools.ToRadians(0);
    flock._configureFlyCamera(camera);
    flock.scene.activeCamera = camera;
    camera.attachControl(flock.canvas, false);

    // An engine created while the canvas was hidden keeps a 1x buffer until
    // something resizes it.
    if (flock.canvas?.clientWidth > 0 && flock.canvas?.clientHeight > 0) {
      flock.engine.resize();
    }

    // Start the render loop now that a camera exists
    flock._renderLoopStopped = false;
    flock._resumeRenderLoop();
    flock._gamepadSource = new GamepadSource(flock.inputManager, {
      scene: flock.scene,
      canvas: flock.canvas,
    });
    flock._gamepadSource.start();
    flock._onScreenSource.start(flock.scene);
    flock._cameraControls = new CameraControls(flock);
    flock._cameraControls.start();
    // Set up lighting
    const hemisphericLight = new flock.BABYLON.HemisphericLight(
      'hemisphericLight',
      new flock.BABYLON.Vector3(0, 3, 0),
      flock.scene
    );
    hemisphericLight.intensity = 1.0;
    hemisphericLight.diffuse = new flock.BABYLON.Color3(1, 1, 1);
    hemisphericLight.groundColor = new flock.BABYLON.Color3(0.5, 0.5, 0.5);
    // No specular: an ambient light shouldn't cast a hard highlight that
    // blows surfaces to white when the view aligns with its direction.
    hemisphericLight.specular = new flock.BABYLON.Color3(0, 0, 0);

    flock.mainLight = hemisphericLight;

    // KHR_PBR_NEUTRAL rolls off overexposure without crushing shadows the
    // way ACES's filmic curve does.
    flock.scene.imageProcessingConfiguration.toneMappingEnabled = true;
    flock.scene.imageProcessingConfiguration.toneMappingType =
      flock.BABYLON.ImageProcessingConfiguration.TONEMAPPING_KHR_PBR_NEUTRAL;
    flock.scene.imageProcessingConfiguration.exposure = 1.0;

    // Directional light that drives the ShadowGenerator. A shadow is the
    // absence of this light's contribution where it's blocked, so it must
    // actually illuminate. It starts at intensity 0 (no effect, flat
    // hemispheric look by default); enableShadows() raises it so the "sun"
    // shading and cast shadows only appear while shadows are turned on.
    const shadowLight = new flock.BABYLON.DirectionalLight(
      'shadowLight',
      // Near-overhead angle keeps shadows small and tucked under objects for
      // a cartoony look (a shallower angle stretches them out). A slight
      // offset is kept so vertical faces still get some directional shading.
      new flock.BABYLON.Vector3(-0.15, -1, -0.15),
      flock.scene
    );
    shadowLight.position = new flock.BABYLON.Vector3(20, 40, 20);
    shadowLight.intensity = 0;
    flock.shadowLight = shadowLight;
    flock.shadowGenerator = null;
    flock.shadowCasters.clear();
    flock.shadowExcluded.clear();

    // Headlamp: fills in faces the hemispheric light leaves dark, by always
    // pointing where the camera looks. No specular — its direction tracks
    // the view exactly, so a head-on surface would always catch a hotspot.
    const headlampLight = new flock.BABYLON.DirectionalLight(
      'headlampLight',
      new flock.BABYLON.Vector3(0, 0, 1),
      flock.scene
    );
    headlampLight.diffuse = new flock.BABYLON.Color3(1, 1, 1);
    headlampLight.specular = new flock.BABYLON.Color3(0, 0, 0);
    flock.headlampLight = headlampLight;
    flock.updateHeadlampIntensity();
    flock.scene.onBeforeRenderObservable.add(() => {
      const camera = flock.scene.activeCamera;
      if (!camera) return;
      headlampLight.direction = camera.getForwardRay().direction;
    });

    // Enable collisions
    flock.scene.collisionsEnabled = true;

    flock.onScreenControls('ARROWS', 'YES', 'AUTO', '#ffffff');

    // Create the UI
    flock.advancedTexture = flock.GUI.AdvancedDynamicTexture.CreateFullscreenUI('UI');

    // Stack panel for text
    flock.stackPanel = new flock.GUI.StackPanel();
    flock.stackPanel.width = '100%'; // Fixed width for the panel
    flock.stackPanel.horizontalAlignment = flock.GUI.Control.HORIZONTAL_ALIGNMENT_LEFT; // Align to the left
    flock.stackPanel.verticalAlignment = flock.GUI.Control.VERTICAL_ALIGNMENT_TOP; // Align to the top

    flock.stackPanel.isVertical = true;
    flock.advancedTexture.addControl(flock.stackPanel);

    // Keep the listener up to date while sounds are playing, but don't
    // create a new AudioContext just because a frame rendered.
    flock.scene.onBeforeRenderObservable.add(() => {
      // When Babylon's audio engine is active it owns context.listener via
      // listener.attach(camera) + listenerAutoUpdate:true. Setting .value on
      // the same AudioParams would throw NotSupportedError (setValueAtTime
      // overlapping setValueCurveAtTime). Skip our manual update in that case.
      if (flock.audioEngine) return;
      const context = flock.audioContext;
      if (context && context.state !== 'closed' && flock.scene.activeCamera) {
        flock.updateListenerPositionAndOrientation(context, flock.scene.activeCamera);
      }
    });

    attachInteractIndicator(flock.scene, flock.inputManager);

    // Mark scene as ready
    flock.flockNotReady = false;

    flock._resetXRState();
  },
  removeEventListeners() {},
  _configureFlyCamera(camera) {
    camera.angularSensibilityX = 2000;
    camera.angularSensibilityY = 2000;
    camera.speed = 0.25;

    // Extend the fly camera's vertical keyboard bindings to match the
    // on-screen button layout: BUTTON1 keys + PageUp for up,
    // BUTTON3 keys + PageDown for down. Babylon's native input handles
    // these with its built-in inertia/smoothing, keeping it consistent
    // with gamepad button movement.
    const KEY_CODE = { PageUp: 33, PageDown: 34, r: 82, 1: 49, f: 70, 3: 51 };
    const toKeyCodes = (keys) => keys.map((k) => KEY_CODE[k]).filter(Boolean);
    const kbInput = camera.inputs?.attached?.keyboard;
    if (kbInput) {
      kbInput.keysUpward = toKeyCodes([...getBoundKeys('BUTTON1'), 'PageUp']);
      kbInput.keysDownward = toKeyCodes([...getBoundKeys('BUTTON3'), 'PageDown']);
      kbInput.keysLeft = [];
      kbInput.keysRight = [];
    }
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

// Bind API module closures at load time so workspace-load paths (e.g. the XR
// hint) can call flock helpers before the first scene runs. initializeNewScene
// re-asserts the same reference after each reset.
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
setFlockMicrobitManager(flock);
setFlockSensing(flock);
setFlockSandbox(flock);
setFlockReadiness(flock);

flock.runtimeUrl = flockRuntimeUrl;

export { initializeFlock } from './standalone.js';

window.setBPM = flockSound.setBPM;
window.updateListenerPositionAndOrientation = flockSound.updateListenerPositionAndOrientation;
window.speak = flockSound.speak;

document.addEventListener('visibilitychange', () => {
  flock.freezeEvents.dispatchEvent(new Event('change'));
});

startStandaloneWhenReady();
