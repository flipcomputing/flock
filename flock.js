// Flock - Creative coding in 3D
// Dr Tracy Gardner - https://github.com/tracygardner
// Flip Computing Limited - flipcomputing.com

import * as BABYLON from '@babylonjs/core';
import { FlowGraphLog10Block } from '@babylonjs/core';
import * as BABYLON_LOADER from '@babylonjs/loaders';
import { GradientMaterial, ShadowOnlyMaterial } from '@babylonjs/materials';
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
import { getShowInternalNodes, setShowInternalNodes } from './ui/inspectorVisibility.js';
import * as csg from './api/csg';
import * as animate from './api/animate';
import * as sound from './api/sound';
import * as ui from './api/ui';
import * as movement from './api/movement';
import * as models from './api/models';
import * as shapes from './api/shapes';
import * as transform from './api/transform';
import * as material from './api/material';
import * as effects from './api/effects';
import * as physics from './api/physics';
import * as xr from './api/xr';
import * as control from './api/control';
import * as scene from './api/scene';
import * as mesh from './api/mesh';
import * as camera from './api/camera';
import * as events from './api/events';
import * as sections from './api/sections';
import * as microbit from './api/microbit';
import * as microbitManager from './microbit/manager.js';
import * as math from './api/math';
import * as sensing from './api/sensing';
import * as sandbox from './runtime/sandbox.js';
import * as readiness from './runtime/readiness.js';
import * as lifecycle from './runtime/lifecycle.js';
import * as diagnostics from './runtime/diagnostics.js';
import * as freeze from './runtime/freeze.js';

// Point Babylon’s Draco loader at local folder for offline use
BABYLON.DracoCompression.Configuration = {
  decoder: {
    wasmUrl: './draco/draco_wasm_wrapper_gltf.js',
    wasmBinaryUrl: './draco/draco_decoder_gltf.wasm',
    fallbackUrl: './draco/draco_decoder_gltf.js',
  },
};

const optionalBabylonDeps = { earcut, FlowGraphLog10Block };
const globalEarcutTarget = typeof globalThis !== 'undefined' ? globalThis : undefined;

if (globalEarcutTarget) {
  Object.assign(globalEarcutTarget, optionalBabylonDeps);
}

const flockModules = [
  csg,
  animate,
  sound,
  ui,
  movement,
  models,
  shapes,
  transform,
  material,
  effects,
  physics,
  scene,
  mesh,
  camera,
  xr,
  math,
  control,
  events,
  sections,
  microbit,
  sensing,
  sandbox,
  readiness,
  lifecycle,
  diagnostics,
  freeze,
  microbitManager,
];

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
  ...xr.createFlockXRState(),
  ...csg.flockCSG,
  ...animate.flockAnimate,
  ...sound.flockSound,
  ...ui.flockUI,
  ...movement.flockMovement,
  ...models.flockModels,
  ...shapes.flockShapes,
  ...transform.flockTransform,
  ...material.flockMaterial,
  ...effects.flockEffects,
  ...physics.flockPhysics,
  ...scene.flockScene,
  ...mesh.flockMesh,
  ...camera.flockCamera,
  ...xr.flockXR,
  ...control.flockControl,
  ...events.flockEvents,
  ...sections.flockSections,
  ...microbit.flockMicrobit,
  ...sensing.flockSensing,
  ...math.flockMath,
  ...sandbox.flockSandbox,
  ...readiness.flockReadiness,
  ...lifecycle.flockLifecycle,
  ...diagnostics.flockDiagnostics,
  ...freeze.flockFreeze,
  // onBlockError lets the UI show a translated message from key + values.
  onBlockError: null,
  _debugLogging: undefined,
  // Runtime helper
  describeMesh(meshName, text) {
    const safeText = flock.sanitizeInlineText(String(text ?? '').substring(0, 256));
    if (!safeText) return;

    return flock.whenModelReady(meshName, (readyMesh) => {
      if (!readyMesh) return;
      const root = readyMesh.metadata?.boundingBox ?? readyMesh;
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
  for (const module of flockModules) {
    module.setFlockReference(flock);
  }
}

flock._bindModules = bindFlockModules;

// Bind API module closures at load time so workspace-load paths (e.g. the XR
// hint) can call flock helpers before the first scene runs. initializeNewScene
// re-asserts the same reference after each reset.
bindFlockModules();

flock.runtimeUrl = flockRuntimeUrl;

export { initializeFlock } from './standalone.js';

window.setBPM = sound.flockSound.setBPM;
window.updateListenerPositionAndOrientation = sound.flockSound.updateListenerPositionAndOrientation;
window.speak = sound.flockSound.speak;

document.addEventListener('visibilitychange', () => {
  flock.freezeEvents.dispatchEvent(new Event('change'));
});

startStandaloneWhenReady();
