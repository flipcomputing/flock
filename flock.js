// Flock - Creative coding in 3D
// Dr Tracy Gardner - https://github.com/tracygardner
// Flip Computing Limited - flipcomputing.com

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
import {
  flockDiagnostics,
  setFlockReference as setFlockDiagnostics,
} from './runtime/diagnostics.js';
import { flockFreeze, setFlockReference as setFlockFreeze } from './runtime/freeze.js';
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
  ...flockDiagnostics,
  ...flockFreeze,
  // onBlockError lets the UI show a translated message from key + values.
  onBlockError: null,
  _debugLogging: undefined,
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
  setFlockDiagnostics(flock);
  setFlockFreeze(flock);
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
