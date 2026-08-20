import { translate } from '../main/translation.js';
import { XRSource } from '../input/xrSource.js';
import { patchEmulatorOffsetReferenceSpace } from '../input/xrEmulatorShim.js';
import { FLY_SPEED } from '../input/cameraControls.js';
import {
  setFlockReference as setXRDebugFlockReference,
  xrDebugPost,
  xrDebugTick,
  xrDebugResetTicks,
} from './xrdebug.js';

let flock;

// Left out or nonsense keeps the default rather than putting the scene somewhere surprising.
function optionalCentimetres(value, maxCm) {
  const centimetres = Number(value);
  if (!Number.isFinite(centimetres) || centimetres < 0) return null;
  return Math.min(maxCm, centimetres);
}

export function setFlockReference(ref) {
  flock = ref;
  setXRDebugFlockReference(ref);
}

export const createFlockXRState = () => ({
  _xrCameraMotionMode: 'none',
  _xrViewMode: 'watch',
  _xrFollowTarget: null,
  _xrFollowCameraDirection: null,
  _xrFollowCameraRadius: null,
  _xrFollowCameraVerticalOffset: null,
  _xrFollowLastPosition: null,
  _xrFollowSettledPosition: null,
  _xrFollowLastMovedAt: 0,
  _xrWatchAnchorPosition: null,
  _xrWatchAnchorTarget: null,
  _xrSnapTurnHeld: false,
  _xrWatchPosition: null,
  _xrNonXRCameraPosition: null,
  _xrProjectCameraOrbits: false,
  _xrEmbodiedVisibility: new Map(),
  _xrMode: undefined,
  _teleportAllTargets: false,
  _teleportGroundTarget: true,
  _teleportExplicitTargetNames: new Set(),
  _teleportExplicitTargetMeshes: new Set(),
  _teleportFloorMeshes: new Set(),
  _teleportBlockerMeshes: new Set(),
  _xrViewObserver: null,
  _xrViewObserverScene: null,
  _xrMeshAddedObserver: null,
  _xrMeshRemovedObserver: null,
  _xrMeshObserverScene: null,
  _xrVisibilitySyncQueued: false,
  _xrMoveForward: null,
  _xrMoveRight: null,
  _xrMoveDelta: null,
  _xrForwardBasis: null,
  _xrRightBasis: null,
  _xrHUDCenter: null,
  _xrHUDForward: null,
  _xrSessionActive: false,
  _xrDesktopUITexture: null,
  _xrVirtualKeyboard: null,
  _xrUIPlacement: 'wrist',
  _xrUIControllerObserver: null,
  _xrUIControllerRemovedObserver: null,
  _xrHUDActive: false,
  _cameraBackgroundLayer: null,
  _cameraBackgroundTexture: null,
  _cameraBackgroundFacing: null,
  _cameraBackgroundRequest: 0,
  _xrSavedClearColor: null,
  _xrSavedSkyEnabled: null,
  _magicWindowReady: null,
  _magicWindowFallback: false,
  _xrHelperAutoCreated: false,
  _arSceneSizeCm: null,
  _arSceneClearanceCm: null,
  _arSceneHeightCm: null,
  _arWorldScale: 1,
  _arPlacementFrames: 0,
  _arPlacementWaitFrames: 0,
  _arGroundState: null,
  _arShadowMaterial: null,
  _arHitTest: null,
  _xrHUDViewAspect: null,
  // Off until the block asks for it while the restrictor is being tuned on real headsets;
  // 'auto' is where this defaults once it has earned its keep.
  _xrComfortTunnel: 'off',
  _xrComfortStrength: 'medium',
  _xrComfortColour: '#000000',
  _xrComfortSeeThrough: 0,
  _xrVignetteMesh: null,
  _xrVignetteMaterial: null,
  _xrVignetteRestriction: 0,
  _xrVignettePhysicalPosition: null,
  _xrVignettePhysicalRotation: null,
  _xrVignetteRenderedPosition: null,
  _xrVignetteRenderedRotation: null,
  _xrVignetteScratch: null,
  _xrVignetteHasBaseline: false,
  _xrVignetteSampledAt: 0,
});

// The panel spans about 56 degrees at this distance.
const XR_HUD_WIDTH = 1.6;
const XR_HUD_HEIGHT = 0.9;
const XR_HUD_DISTANCE = 1.5;
const XR_HUD_TEXTURE_WIDTH = 1536;
const XR_HUD_TEXTURE_HEIGHT = 864;
// Canvas-pixel UI resolves to well under a degree here, so every pixel measure is scaled
// up. Offsets scale too, so controls placed far from their edge can fall off the panel.
const XR_HUD_MAGNIFICATION = 2.5;
// Holds the wrist panel at the size it had with the smaller HUD plane.
const XR_WRIST_SCALE = 0.26;

// A phone's panel is fitted to the view instead, in front of the scene.
const XR_HANDHELD_HUD_DISTANCE_M = 0.5;
const XR_HANDHELD_HUD_TEXTURE_MAX = 2048;
const XR_HANDHELD_HUD_RENDERING_GROUP = 1;
// Below this a rebuild would be rounding noise, not a turned phone.
const XR_HUD_ASPECT_TOLERANCE = 0.05;

// Big enough to fill about half a phone screen from the clearance the viewer is stood at.
const AR_DEFAULT_SCENE_SIZE_CM = 150;
const AR_SCENE_SIZE_MIN_CM = 1;
const AR_SCENE_SIZE_MAX_CM = 100000;
// Measured from the near edge: distance to the centre grows with the footprint.
const AR_DIORAMA_CLEARANCE_M = 0.3;
const AR_SCENE_DISTANCE_MAX_CM = 1000;
const AR_SCENE_HEIGHT_MAX_CM = 1000;
// How far below the screen's centre a handheld diorama is allowed to sit, and how far back
// that is ever allowed to stand the viewer if the reported eye height is wild.
const AR_MAX_LOOK_DOWN = Math.PI / 4;
const AR_MAX_HANDHELD_DISTANCE_M = 3.5;
const AR_PLACEMENT_SETTLE_FRAMES = 3;
// Tracking can take hundreds of frames to come up on a phone; place unposed rather than never.
const AR_PLACEMENT_MAX_WAIT_FRAMES = 600;
const VIGNETTE_MESH_NAME = 'xrComfortVignette';
// Babylon's pointer visuals, not scene content.
const XR_HELPER_MESH_NAMES = new Set(['laserPointer', 'gazeTracker', VIGNETTE_MESH_NAME]);

// Stands in until the session reports a pose to measure the wearer against.
const XR_FALLBACK_EYE_HEIGHT_M = 1.5;
const SNAP_TURN_ANGLE = Math.PI / 6;
const SNAP_TURN_PRESS = 0.7;
const SNAP_TURN_RELEASE = 0.3;
// Comfort waits for the character to hold still before the view catches up.
const COMFORT_SETTLE_MS = 250;
// Smaller height changes are the character settling, not a climb.
const EMBODY_MIN_HEIGHT_CHANGE_M = 0.02;

// The comfort restrictor closes the periphery down while the view moves under the wearer
// rather than with them. Restriction runs 0 (open) to 1 (tunnel), and stops short of 1 so
// there is always something left to steer by.
const VIGNETTE_MAX_RESTRICTION = 0.85;
// The speeds that earn full restriction, and the drift below which nothing closes at all.
const VIGNETTE_REF_SPEED_MPS = 3;
const VIGNETTE_REF_TURN_RAD_S = Math.PI / 3;
const VIGNETTE_DEADZONE_MPS = 0.3;
const VIGNETTE_DEADZONE_RAD_S = 0.2;
// Closing sooner than it opens: the periphery should be gone before the motion is felt, and
// the rate limit is also what keeps a borderline speed from flickering the edge.
const VIGNETTE_CLOSE_PER_S = 4;
const VIGNETTE_OPEN_PER_S = 2;
// A frame the browser sat on carries no usable speed, and a frame carrying more than a stride
// is a jump rather than a speed. Both start the measurement again instead of slamming shut.
const VIGNETTE_MAX_DT_S = 0.1;
const VIGNETTE_JUMP_M = 0.5;
const VIGNETTE_JUMP_RAD = Math.PI / 12;
// Half-angles from straight ahead: open sits outside any headset's field of view, so an open
// restrictor is not merely invisible but has nothing to draw.
const VIGNETTE_OPEN_ANGLE = 1.6;
// How tight the tunnel gets at full speed. Relief and immersion trade off against each other
// differently for every wearer, which is why this is the wearer's choice rather than a constant.
const VIGNETTE_CLOSED_ANGLES = { low: 0.61, medium: 0.35, high: 0.21 };
const VIGNETTE_FEATHER_RAD = 0.22;
// Far enough out that the eyes' offset from the centre is a fifth of a degree of aperture.
const VIGNETTE_RADIUS_M = 12;
// Drawn after the scene and after the handheld HUD's group.
const VIGNETTE_RENDERING_GROUP = 2;

// A working sensor reports within a frame; this waits out iOS, where the permission needs a
// user gesture this call never has and so never resolves either way.
const MAGIC_WINDOW_SENSOR_TIMEOUT_MS = 2500;

export const flockXR = {
  _moveUIControls(source, target) {
    if (!source?.rootContainer || !target?.addControl) return;
    const controls = [...(source.rootContainer.children ?? [])];
    for (const control of controls) {
      source.removeControl?.(control);
      target.addControl(control);
    }
  },
  _hideXRKeyboard(input) {
    const keyboard = flock._xrVirtualKeyboard;
    if (!keyboard) return;
    keyboard.disconnect(input);
    if (keyboard.connectedInputText) return;
    keyboard._flockSubmit = null;
    keyboard.isVisible = false;
  },
  _showXRKeyboardForInput(input, onSubmit) {
    if (!flock._xrSessionActive || !input || !flock.meshTexture) return;

    if (!flock._xrVirtualKeyboard) {
      const keyboard = flock.GUI.VirtualKeyboard.CreateDefaultLayout('xrVirtualKeyboard');
      keyboard.width = '720px';
      keyboard.horizontalAlignment = flock.GUI.Control.HORIZONTAL_ALIGNMENT_CENTER;
      keyboard.verticalAlignment = flock.GUI.Control.VERTICAL_ALIGNMENT_BOTTOM;
      keyboard.isVisible = false;
      keyboard.onKeyPressObservable.add((key) => {
        if (key !== '\u21b5') return;
        const submit = keyboard._flockSubmit;
        queueMicrotask(() => submit?.());
      });
      flock.meshTexture.addControl(keyboard);
      flock._xrVirtualKeyboard = keyboard;
    }

    flock._xrVirtualKeyboard.disconnect();
    flock._xrVirtualKeyboard.connect(input);
    flock._xrVirtualKeyboard._flockSubmit = onSubmit;
    flock._xrVirtualKeyboard.isVisible = true;
    // Control.dispose() clears onBlurObservable without firing it.
    input.onDisposeObservable?.addOnce?.(() => flock._hideXRKeyboard(input));
  },
  _createXRHUDTexture(
    plane,
    {
      width = XR_HUD_TEXTURE_WIDTH,
      height = XR_HUD_TEXTURE_HEIGHT,
      magnification = flock._xrTuning('xu', XR_HUD_MAGNIFICATION, 1, 4),
    } = {}
  ) {
    const texture = flock.GUI.AdvancedDynamicTexture.CreateForMesh(plane, width, height, true);
    texture.idealWidth = Math.round(width / magnification);
    // Mip filtering softens glyph edges, and a head-locked panel barely moves against the eye.
    texture.updateSamplingMode(flock.BABYLON.Texture.BILINEAR_SAMPLINGMODE);
    plane.material.disableDepthWrite = true;
    plane.material.disableLighting = true;
    return texture;
  },
  // The texture has to match the panel's shape, or every control on it is skewed.
  _rebuildXRHUDTexture(width, height) {
    const plane = flock.uiPlane;
    if (!plane || !flock.GUI) return;
    const previousTexture = flock.meshTexture;
    const previousMaterial = plane.material;
    const texture = flock._createXRHUDTexture(plane, { width, height, magnification: 1 });
    flock.meshTexture = texture;
    if (previousTexture) {
      flock._moveUIControls(previousTexture, texture);
      if (flock.scene?.UITexture === previousTexture) flock.scene.UITexture = texture;
      previousTexture.dispose();
    }
    // CreateForMesh leaves the old material behind.
    if (previousMaterial && previousMaterial !== plane.material) previousMaterial.dispose();
    flock._refreshOnScreenControls?.();
  },
  // The view's own frustum, whatever field of view the device renders with.
  _xrHUDFrustum(rig, distance) {
    const projection = rig?.getProjectionMatrix?.()?.m;
    if (!projection?.[0] || !projection?.[5]) return null;
    return {
      width: (2 * distance) / projection[0],
      height: (2 * distance) / projection[5],
    };
  },
  _xrHUDDistance() {
    const scale = flock.xrHelper?.baseExperience?.sessionManager?.worldScalingFactor || 1;
    const distance = flock._isHandheldXRSession() ? XR_HANDHELD_HUD_DISTANCE_M : XR_HUD_DISTANCE;
    return distance * scale;
  },
  _handheldHUDTextureSize(aspect) {
    const canvasWidth = flock.engine?.getRenderWidth?.() || XR_HUD_TEXTURE_WIDTH;
    let width = Math.min(XR_HANDHELD_HUD_TEXTURE_MAX, Math.max(512, Math.round(canvasWidth)));
    let height = Math.round(width / aspect);
    if (height > XR_HANDHELD_HUD_TEXTURE_MAX) {
      height = XR_HANDHELD_HUD_TEXTURE_MAX;
      width = Math.round(height * aspect);
    }
    return { width, height };
  },
  _fitXRHUDToView(rig, distance) {
    const plane = flock.uiPlane;
    const frustum = flock._xrHUDFrustum(rig, distance);
    if (!plane || !frustum) return;
    plane.scaling.set(frustum.width / XR_HUD_WIDTH, frustum.height / XR_HUD_HEIGHT, 1);

    const aspect = frustum.width / frustum.height;
    if (!Number.isFinite(aspect) || aspect <= 0) return;
    const current = flock._xrHUDViewAspect;
    if (current && Math.abs(aspect - current) / current < XR_HUD_ASPECT_TOLERANCE) return;
    flock._xrHUDViewAspect = aspect;
    const { width, height } = flock._handheldHUDTextureSize(aspect);
    flock._rebuildXRHUDTexture(width, height);
  },
  // No controllers to hang the panel from, and each tap's laser would cross the room.
  _applyHandheldXRSession() {
    if (!flock._isHandheldXRSession()) return;
    const pointerSelection = flock.xrHelper?.pointerSelection;
    if (pointerSelection) {
      pointerSelection.displayLaserPointer = false;
      pointerSelection.displaySelectionMesh = false;
    }
    if (flock.uiPlane) flock.uiPlane.renderingGroupId = XR_HANDHELD_HUD_RENDERING_GROUP;
    flock._applyXRUIPlacement();
  },
  _xrWristParent() {
    const left = (flock.xrHelper?.input?.controllers ?? []).find(
      (controller) => controller.inputSource?.handedness === 'left'
    );
    return left?.grip ?? left?.pointer ?? null;
  },
  _applyXRUIPlacement() {
    const plane = flock.uiPlane;
    if (!plane) return;

    const wristParent =
      flock._xrUIPlacement === 'wrist' && !flock._isHandheldXRSession()
        ? flock._xrWristParent()
        : null;
    if (wristParent) {
      plane.parent = wristParent;
      // A rotationQuaternion, once set, is what the node rotates by.
      plane.rotationQuaternion = null;
      plane.position.set(0.1, -0.05, 0);
      plane.rotation.set(Math.PI / 2, 0, 0);
      plane.scaling.setAll(XR_WRIST_SCALE);
      return;
    }

    plane.parent = null;
    plane.scaling.setAll(1);
    flock._syncXRHUDPose();
  },
  // The eyes render from the rig cameras, which hold the pose the frame opened with. Moving
  // the XR camera later in the frame — snap turn, watch trail, teleport — reaches its children
  // but not the rig cameras, so a head-locked child would spend that frame off where the eyes
  // are not looking. Following the rig cameras keeps the panel with the view.
  _syncXRHUDPose() {
    const plane = flock.uiPlane;
    // Wrist placement rides a controller grip, which the pose update moves with the eyes.
    if (!plane || plane.parent || !plane.isVisible) return;
    const rigs = flock.xrHelper?.baseExperience?.camera?.rigCameras;
    if (!rigs?.length) return;

    const B = flock.BABYLON;
    flock._xrHUDCenter ??= new B.Vector3();
    flock._xrHUDForward ??= new B.Vector3();
    flock._xrForwardBasis ??= B.Vector3.Forward();

    const center = flock._xrHUDCenter.copyFromFloats(0, 0, 0);
    for (const rig of rigs) {
      // globalPosition is only refreshed alongside the world matrix.
      rig.getWorldMatrix();
      center.addInPlace(rig.globalPosition);
    }
    center.scaleInPlace(1 / rigs.length);

    const distance = flock._xrHUDDistance();
    rigs[0].getDirectionToRef(flock._xrForwardBasis, flock._xrHUDForward);
    plane.position.copyFrom(center).addInPlace(flock._xrHUDForward.scaleInPlace(distance));
    plane.rotationQuaternion ??= new B.Quaternion();
    plane.rotationQuaternion.copyFrom(rigs[0].absoluteRotation);
    if (flock._isHandheldXRSession()) flock._fitXRHUDToView(rigs[0], distance);
  },
  _hudHasInteractiveControls(container) {
    for (const child of container?.children ?? []) {
      if (child.isVisible === false) continue;
      if (child.isPointerBlocker) return true;
      if (flock._hudHasInteractiveControls(child)) return true;
    }
    return false;
  },
  // The panel sits between viewer and scene, so it must only swallow rays when pressable.
  _syncXRHUDPicking() {
    if (!flock.uiPlane) return;
    flock.uiPlane.isPickable = flock._hudHasInteractiveControls(flock.meshTexture?.rootContainer);
  },
  _enterXRHUD() {
    if (!flock.meshTexture || !flock.scene) return;
    flock._xrHUDActive = true;
    const desktopTexture =
      flock.scene.UITexture ??
      flock.GUI.AdvancedDynamicTexture.CreateFullscreenUI('UI', true, flock.scene);
    if (desktopTexture !== flock.meshTexture) {
      flock._xrDesktopUITexture = desktopTexture;
      flock._moveUIControls(desktopTexture, flock.meshTexture);
      flock.scene.UITexture = flock.meshTexture;
    }
    flock._refreshOnScreenControls?.();
  },
  _exitXRHUD() {
    const wasActive = flock._xrHUDActive;
    flock._xrHUDActive = false;
    const desktopTexture = flock._xrDesktopUITexture;
    if (flock._xrVirtualKeyboard) {
      flock._xrVirtualKeyboard.disconnect();
      flock.meshTexture?.removeControl?.(flock._xrVirtualKeyboard);
      flock._xrVirtualKeyboard.dispose();
      flock._xrVirtualKeyboard = null;
    }
    if (wasActive) flock._refreshOnScreenControls?.();

    if (!desktopTexture || !flock.scene) return;

    flock._moveUIControls(flock.meshTexture, desktopTexture);
    flock.scene.UITexture = desktopTexture;
    flock._xrDesktopUITexture = null;
  },
  _resetXRState() {
    flock._exitXRHUD?.();
    flock._restoreARGround?.();
    flock._xrSource?.stop?.();
    flock._xrSource = null;
    if (flock._xrViewObserver && flock._xrViewObserverScene) {
      flock._xrViewObserverScene.onBeforeRenderObservable?.remove?.(flock._xrViewObserver);
    }
    if (flock._xrUIControllerObserver) {
      flock.xrHelper?.input?.onControllerAddedObservable?.remove?.(flock._xrUIControllerObserver);
    }
    if (flock._xrUIControllerRemovedObserver) {
      flock.xrHelper?.input?.onControllerRemovedObservable?.remove?.(
        flock._xrUIControllerRemovedObserver
      );
    }
    if (flock._xrMeshObserverScene) {
      if (flock._xrMeshAddedObserver) {
        flock._xrMeshObserverScene.onNewMeshAddedObservable?.remove?.(flock._xrMeshAddedObserver);
      }
      if (flock._xrMeshRemovedObserver) {
        flock._xrMeshObserverScene.onMeshRemovedObservable?.remove?.(flock._xrMeshRemovedObserver);
      }
    }
    flock._disposeXRVignette();
    flock.xrHelper = null;
    Object.assign(flock, createFlockXRState());
  },
  _xrTuning(param, fallback, min, max) {
    let raw = null;
    try {
      raw = new URLSearchParams(window.location.search).get(param);
    } catch {
      // No location (tests, workers): use the default.
    }
    if (raw === null || raw.trim() === '') return fallback;
    const value = Number(raw);
    if (!Number.isFinite(value)) return fallback;
    return Math.min(max, Math.max(min, value));
  },
  _xrCanvasOptions() {
    const defaults = flock.BABYLON.WebXRManagedOutputCanvasOptions.GetDefaults(flock.engine);
    return {
      ...defaults,
      canvasOptions: {
        ...defaults.canvasOptions,
        framebufferScaleFactor: flock._xrTuning('xs', flock.xrFramebufferScale, 0.5, 2),
      },
    };
  },
  _applyXRDefaults(mode) {
    // The starting state doubles as "the project never said": leave anything else alone.
    if (mode !== 'VR' || flock._xrViewMode !== 'watch' || flock._xrCameraMotionMode !== 'none') {
      return;
    }
    if (flock._xrTargetPosition()) {
      flock._xrCameraMotionMode = 'comfort';
      return;
    }
    flock._xrViewMode = 'embody';
    flock._xrCameraMotionMode = 'teleport';
  },
  _ensureTeleportationState() {
    flock._teleportExplicitTargetNames ??= new Set();
    flock._teleportExplicitTargetMeshes ??= new Set();
    flock._teleportFloorMeshes ??= new Set();
    flock._teleportBlockerMeshes ??= new Set();
    if (flock._teleportGroundTarget === undefined) flock._teleportGroundTarget = true;
    if (flock._teleportAllTargets === undefined) flock._teleportAllTargets = false;
  },
  _isTeleportTarget(mesh) {
    if (!mesh || mesh.isDisposed?.()) return false;
    for (let current = mesh; current; current = current.parent) {
      if (current === flock.ground && flock._teleportGroundTarget) return true;
      if (
        flock._teleportExplicitTargetMeshes.has(current) ||
        flock._teleportExplicitTargetNames.has(current.name)
      ) {
        return true;
      }
      if (
        flock._teleportAllTargets &&
        (!!current.metadata?.blockKey || flock._nameRegistry?.has(current.name))
      ) {
        return true;
      }
    }
    return false;
  },
  // The teleport ray starts at the player, so their own body and anything they carry
  // must be neither a landing spot nor a blocker.
  _isXRPlayerPart(mesh) {
    const target = flock._xrFollowTarget;
    if (!target || !mesh) return false;
    for (let current = mesh; current; current = current.parent) {
      if (current === target) return true;
      if (current.metadata?._attachedTargetName === target.name) return true;
    }
    return false;
  },
  _hasTeleportBlockingPhysics(mesh) {
    for (let current = mesh; current; current = current.parent) {
      if (current.physics) return true;
    }
    return false;
  },
  _syncTeleportMeshHierarchy(mesh) {
    if (!mesh) return;
    flock._syncTeleportMesh(mesh);
    mesh.getChildMeshes?.(false)?.forEach((child) => flock._syncTeleportMesh(child));
  },
  _unregisterTeleportMesh(mesh) {
    const teleportation = flock.xrHelper?.teleportation;
    if (flock._teleportFloorMeshes.has(mesh)) teleportation?.removeFloorMesh(mesh);
    if (flock._teleportBlockerMeshes.has(mesh)) teleportation?.removeBlockerMesh(mesh);
    flock._teleportFloorMeshes.delete(mesh);
    flock._teleportBlockerMeshes.delete(mesh);
    flock._teleportExplicitTargetMeshes.delete(mesh);
  },
  _syncTeleportMesh(mesh) {
    if (flock._xrMode !== 'VR') return;
    const teleportation = flock.xrHelper?.teleportation;
    if (!teleportation || !mesh) return;
    flock._ensureTeleportationState();
    const isPlayerPart = flock._isXRPlayerPart(mesh);
    const isTarget = !isPlayerPart && flock._isTeleportTarget(mesh);
    const isFloor = flock._teleportFloorMeshes.has(mesh);
    const isBlocker = flock._teleportBlockerMeshes.has(mesh);
    if (isTarget && !isFloor) {
      teleportation.addFloorMesh(mesh);
      flock._teleportFloorMeshes.add(mesh);
    } else if (!isTarget && isFloor) {
      teleportation.removeFloorMesh(mesh);
      flock._teleportFloorMeshes.delete(mesh);
    }
    const shouldBlock = !isPlayerPart && flock._hasTeleportBlockingPhysics(mesh) && !isTarget;
    if (shouldBlock && !isBlocker) {
      teleportation.addBlockerMesh(mesh);
      flock._teleportBlockerMeshes.add(mesh);
    } else if (!shouldBlock && isBlocker) {
      teleportation.removeBlockerMesh(mesh);
      flock._teleportBlockerMeshes.delete(mesh);
    }
  },
  _applyTeleportationState() {
    const teleportation = flock.xrHelper?.teleportation;
    if (!teleportation) return;
    if (flock._xrMode !== 'VR') {
      teleportation.detach();
      return;
    }
    flock._ensureTeleportationState();
    flock.scene.meshes.forEach((mesh) => flock._syncTeleportMesh(mesh));
    if (
      flock._canvasControlsEnabled !== false &&
      flock._xrViewMode === 'embody' &&
      flock._xrCameraMotionMode === 'teleport'
    ) {
      teleportation.attach();
    } else teleportation.detach();
  },
  _applyXRInputState() {
    const hasFollowTarget = !!flock._xrTargetPosition();
    if (
      !hasFollowTarget &&
      flock._xrCameraMotionMode === 'smooth' &&
      flock._canvasControlsEnabled !== false
    ) {
      flock._xrSource?.setInputMode('fly');
      return;
    }
    // Teleport steers with the thumbstick; otherwise the project's own movement gets it.
    // Canvas controls off stands every built-in camera motion down, teleport included.
    const projectControls =
      flock._canvasControlsEnabled === false ||
      (hasFollowTarget
        ? flock._xrViewMode === 'watch' ||
          (flock._xrViewMode === 'embody' && flock._xrCameraMotionMode === 'smooth')
        : flock._xrCameraMotionMode !== 'teleport');
    const inputMode = projectControls ? 'project' : 'disabled';
    flock._xrSource?.setInputMode(inputMode);
  },
  _handleXRStateChange(state) {
    if (state === flock.BABYLON.WebXRState.ENTERING_XR) {
      flock._syncXRFollowTargetFromCamera();
      flock._xrSource?.start();
      flock._enterXRHUD();
      const stackPanel = flock.stackPanel;
      if (stackPanel) {
        flock.advancedTexture?.removeControl?.(stackPanel);
        flock.meshTexture?.addControl?.(stackPanel);
        stackPanel.horizontalAlignment = flock.GUI.Control.HORIZONTAL_ALIGNMENT_LEFT;
        stackPanel.verticalAlignment = flock.GUI.Control.VERTICAL_ALIGNMENT_TOP;
      }
      if (flock.uiPlane) {
        flock.uiPlane.isVisible = true;
        flock._applyXRUIPlacement();
      }
      if (flock.advancedTexture?.rootContainer) {
        flock.advancedTexture.rootContainer.isVisible = false;
      }
    } else if (state === flock.BABYLON.WebXRState.IN_XR) {
      const baseExperience = flock.xrHelper?.baseExperience;
      if (!baseExperience) return;
      flock._xrSessionActive = true;
      baseExperience.sessionManager.fixedFoveation = flock._xrTuning(
        'xf',
        flock.xrFixedFoveation,
        0,
        1
      );
      flock._positionXRWatchCamera();
      flock._resetXRVignetteBaseline();
      flock._resetXRViewTracking({ reposition: true });
      flock._applyXRViewVisibility();
      if (flock._isPassthroughSession()) flock._showPassthroughBackground(true);
      flock._applyCameraBackground();
      flock._applyHandheldXRSession();
      flock._applyARSceneScale();
      xrDebugResetTicks();
      xrDebugPost('entered session');
    } else if (state === flock.BABYLON.WebXRState.EXITING_XR) {
      xrDebugPost('exiting session');
      flock._xrSessionActive = false;
      flock._setXRVignetteRestriction(0);
      flock._resetARScene();
      flock._applyXRViewVisibility();
      flock._showPassthroughBackground(false);
      flock._applyCameraBackground();
      flock._xrSource?.stop();
      const stackPanel = flock.stackPanel;
      if (stackPanel) {
        flock.meshTexture?.removeControl?.(stackPanel);
        flock.advancedTexture?.addControl?.(stackPanel);
        stackPanel.width = '100%';
        stackPanel.horizontalAlignment = flock.GUI.Control.HORIZONTAL_ALIGNMENT_LEFT;
        stackPanel.verticalAlignment = flock.GUI.Control.VERTICAL_ALIGNMENT_TOP;
      }
      if (flock.uiPlane) {
        flock.uiPlane.isVisible = false;
        flock.uiPlane.renderingGroupId = 0;
      }
      flock._exitXRHUD();
      if (flock.advancedTexture?.rootContainer) {
        flock.advancedTexture.rootContainer.isVisible = true;
      }
    }
  },
  _xrTargetPosition() {
    const target = flock._xrFollowTarget;
    if (!target || target.isDisposed?.()) return null;
    return target.getAbsolutePosition?.() ?? target.absolutePosition ?? target.position ?? null;
  },
  _resetXRViewTracking({ reposition = false } = {}) {
    const targetPosition = flock._xrTargetPosition();
    const xrCamera = flock.xrHelper?.baseExperience?.camera;
    if (
      reposition &&
      xrCamera?.position &&
      flock._xrViewMode === 'watch' &&
      flock._xrWatchPosition
    ) {
      xrCamera.position.copyFrom(flock._xrWatchPosition);
    }
    if (targetPosition) {
      flock._xrFollowLastPosition = targetPosition.clone?.() ?? { ...targetPosition };
      flock._xrFollowSettledPosition = targetPosition.clone?.() ?? { ...targetPosition };
      flock._xrFollowLastMovedAt = performance.now?.() ?? Date.now();

      if (reposition && xrCamera?.position && flock._xrViewMode === 'embody') {
        if (!flock._xrWatchPosition) flock._xrWatchPosition = xrCamera.position.clone();
        xrCamera.position.x = targetPosition.x;
        xrCamera.position.z = targetPosition.z;
      }
    }
    flock._syncXRWatchAnchor(xrCamera?.position);
  },
  // Where the camera sits relative to the character, so walking can carry it along and a snap
  // turn can swing it around them without either having to work the framing out again.
  _syncXRWatchAnchor(cameraPosition) {
    flock._xrWatchAnchorPosition = null;
    flock._xrWatchAnchorTarget = null;

    const targetPosition = flock._xrTargetPosition();
    if (!targetPosition || !cameraPosition || flock._xrViewMode !== 'watch') return;

    const offsetX = cameraPosition.x - targetPosition.x;
    const offsetZ = cameraPosition.z - targetPosition.z;
    // Standing on the character leaves nothing to swing around.
    if (Math.hypot(offsetX, offsetZ) < 0.001) return;

    flock._xrWatchAnchorPosition = cameraPosition.clone();
    flock._xrWatchAnchorTarget = targetPosition.clone?.() ?? { ...targetPosition };
  },
  // Rotates the play space, so the headset keeps whatever offset the wearer is looking at.
  _rotateXRCameraYaw(radians) {
    const xrCamera = flock.xrHelper?.baseExperience?.camera;
    if (!xrCamera?.rotationQuaternion || !radians) return;
    const yaw = flock.BABYLON.Quaternion.FromEulerAngles(0, radians, 0);
    yaw.multiplyToRef(xrCamera.rotationQuaternion, xrCamera.rotationQuaternion);
    // A snap turn is a jump rather than a speed: measuring across it would slam the
    // restrictor shut on a turn taken precisely to avoid one.
    flock._resetXRVignetteBaseline();
  },
  // Carries the camera to `pivot`, turning it `angle` around that pivot on the way, so
  // the wearer keeps both their own head offset and their view of the character. Following
  // the character passes 0: only a snap turn ever rotates the world around the wearer.
  _placeXRWatchCamera(pivot, angle) {
    const anchor = flock._xrWatchAnchorPosition;
    const base = flock._xrWatchAnchorTarget;
    const xrCamera = flock.xrHelper?.baseExperience?.camera;
    if (!anchor || !base || !pivot || !xrCamera?.position) return false;

    const offsetX = anchor.x - base.x;
    const offsetY = anchor.y - base.y;
    const offsetZ = anchor.z - base.z;
    const sin = Math.sin(angle);
    const cos = Math.cos(angle);
    const desired = new flock.BABYLON.Vector3(
      pivot.x + offsetX * cos + offsetZ * sin,
      pivot.y + offsetY,
      pivot.z + offsetZ * cos - offsetX * sin
    );

    xrCamera.position.addInPlace(desired.subtract(anchor));
    flock._rotateXRCameraYaw(angle);
    flock._xrWatchAnchorPosition = desired;
    flock._xrWatchAnchorTarget = pivot.clone?.() ?? { ...pivot };
    return true;
  },
  // Watch swings around the character so they stay in view; embodied turns on the spot.
  _applyXRSnapTurn(angle) {
    if (
      flock._xrViewMode === 'watch' &&
      flock._placeXRWatchCamera(flock._xrWatchAnchorTarget, angle)
    ) {
      return;
    }
    flock._rotateXRCameraYaw(angle);
  },
  _updateXRSnapTurn() {
    if (flock._xrMode !== 'VR' || !flock._xrSessionActive) return;
    // Teleport steering snap turns through Babylon's own teleportation feature.
    if (
      flock._canvasControlsEnabled === false ||
      (flock._xrViewMode === 'embody' && flock._xrCameraMotionMode === 'teleport')
    ) {
      flock._xrSnapTurnHeld = false;
      return;
    }

    const turn = flock.inputManager.getAxis('XR_TURN_X');
    if (Math.abs(turn) < SNAP_TURN_RELEASE) {
      flock._xrSnapTurnHeld = false;
      return;
    }
    if (flock._xrSnapTurnHeld || Math.abs(turn) < SNAP_TURN_PRESS) return;
    flock._xrSnapTurnHeld = true;
    flock._applyXRSnapTurn(turn > 0 ? SNAP_TURN_ANGLE : -SNAP_TURN_ANGLE);
  },
  // Must be read as XR is entered: the project camera can be replaced or orbited afterwards.
  _captureXRWatchFraming(camera = flock.scene?.activeCamera) {
    const target = camera?.lockedTarget ?? camera?.metadata?.following;
    const targetPosition = target
      ? (target.getAbsolutePosition?.() ?? target.absolutePosition ?? target.position ?? null)
      : null;
    const offset =
      camera?.position && targetPosition ? camera.position.subtract(targetPosition) : null;
    flock._xrNonXRCameraPosition = camera?.position?.clone?.() ?? null;
    // The session swaps in an XR camera, so remember whether the project's own camera orbited.
    flock._xrProjectCameraOrbits = camera?.getClassName?.() === 'ArcRotateCamera';
    flock._xrFollowCameraVerticalOffset = offset ? offset.y : null;
    if (offset) offset.y = 0;
    flock._xrFollowCameraDirection = offset?.lengthSquared() ? offset.normalize() : null;
    flock._xrFollowCameraRadius = Number.isFinite(camera?.radius) ? camera.radius : null;
    return target;
  },
  _syncXRFollowTargetFromCamera(camera = flock.scene?.activeCamera) {
    flock._setXRFollowTarget(flock._captureXRWatchFraming(camera) ?? null);
  },
  // Watch frames the headset the way the project camera frames the character, so a camera the
  // project attaches part way through a session has to reach the wearer too.
  _frameXRFromProjectCamera(camera) {
    flock._syncXRFollowTargetFromCamera(camera);
    if (!flock._xrSessionActive || flock._xrMode !== 'VR') return;
    flock._positionXRWatchCamera();
    flock._resetXRViewTracking({ reposition: true });
  },
  // The session is running by the time watch mode places the camera, so what it sets is where
  // the eyes land, not where the wearer stands.
  _xrEyeHeight(camera = flock.xrHelper?.baseExperience?.camera) {
    return camera?.realWorldHeight || XR_FALLBACK_EYE_HEIGHT_M;
  },
  _positionXRWatchCamera() {
    const xrCamera = flock.xrHelper?.baseExperience?.camera;
    if (!xrCamera?.position) return;

    const headsetPosition = xrCamera.position.clone();
    const targetPosition = flock._xrTargetPosition();
    const followDirection = flock._xrFollowCameraDirection;
    const followRadius = flock._xrFollowCameraRadius;
    const verticalOffset = flock._xrFollowCameraVerticalOffset;
    flock._xrWatchPosition = flock._xrNonXRCameraPosition?.clone?.() ?? headsetPosition;

    if (targetPosition && followDirection && followRadius !== null && verticalOffset !== null) {
      const horizontalDistance = Math.sqrt(
        Math.max(0, followRadius * followRadius - verticalOffset * verticalOffset)
      );
      flock._xrWatchPosition.x = targetPosition.x + followDirection.x * horizontalDistance;
      // The project camera's height is a spot to stand in; the wearer's own goes on top of it.
      flock._xrWatchPosition.y = targetPosition.y + verticalOffset + flock._xrEyeHeight(xrCamera);
      flock._xrWatchPosition.z = targetPosition.z + followDirection.z * horizontalDistance;
    }

    // Embodying a target places the headset on that target, at its own eye height.
    if (targetPosition && flock._xrViewMode !== 'watch') return;
    xrCamera.position.copyFrom(flock._xrWatchPosition);
    if (targetPosition) xrCamera.setTarget?.(targetPosition);
  },
  _setXRFollowTarget(target) {
    if (flock._xrFollowTarget !== target) flock._restoreXREmbodiedVisibility();
    flock._xrFollowTarget = target;
    flock._resetXRViewTracking();
    flock._applyXRViewVisibility();
    flock._applyXRInputState();
    flock._applyTeleportationState();
  },
  _restoreXREmbodiedVisibility() {
    for (const [mesh, isVisible] of flock._xrEmbodiedVisibility) {
      if (!mesh.isDisposed?.()) mesh.isVisible = isVisible;
    }
    flock._xrEmbodiedVisibility.clear();
  },
  _restoreXREmbodiedMesh(mesh) {
    if (!mesh) return;
    for (const part of [mesh, ...(mesh.getChildMeshes?.(false) ?? [])]) {
      if (!flock._xrEmbodiedVisibility.has(part)) continue;
      if (!part.isDisposed?.()) part.isVisible = flock._xrEmbodiedVisibility.get(part);
      flock._xrEmbodiedVisibility.delete(part);
    }
  },
  _xrEmbodiedAttachments(target) {
    // Bone-attached meshes are parented to a Bone, so they never show up in the
    // target's child meshes; the tracking list is the only route to them.
    return (target.metadata?._boneAttachments ?? []).flatMap((entry) => {
      const mesh = flock.scene?.getMeshByName?.(entry.meshName);
      if (!mesh || mesh.isDisposed?.()) return [];
      return [mesh, ...(mesh.getChildMeshes?.(false) ?? [])];
    });
  },
  _applyXRViewVisibility() {
    const shouldHide = flock._xrSessionActive && flock._xrViewMode === 'embody';
    if (!shouldHide) {
      flock._restoreXREmbodiedVisibility();
      return;
    }

    const target = flock._xrFollowTarget;
    if (!target || target.isDisposed?.()) return;
    const hierarchy = [
      target,
      ...(target.getChildMeshes?.(false) ?? []),
      ...flock._xrEmbodiedAttachments(target),
    ];
    for (const mesh of hierarchy) {
      if (mesh.metadata?.isXREmbodiedHUD) continue;
      if (!('isVisible' in mesh) || flock._xrEmbodiedVisibility.has(mesh)) continue;
      flock._xrEmbodiedVisibility.set(mesh, mesh.isVisible);
      mesh.isVisible = false;
    }
  },
  _isXREmbodiedTarget(target) {
    return (
      !!target &&
      flock._xrMode === 'VR' &&
      flock._xrSessionActive &&
      flock._xrViewMode === 'embody' &&
      flock._xrFollowTarget === target
    );
  },
  _syncXREmbodiedTarget() {
    const target = flock._xrFollowTarget;
    const xrCamera = flock.xrHelper?.baseExperience?.camera;
    if (!flock._isXREmbodiedTarget(target) || !xrCamera?.position || target.isDisposed?.()) return;

    const current =
      target.getAbsolutePosition?.() ?? target.absolutePosition ?? target.position ?? null;
    if (!current) return;
    const next = current.clone?.() ?? new flock.BABYLON.Vector3(current.x, current.y, current.z);
    next.x = xrCamera.position.x;
    next.z = xrCamera.position.z;

    if (target.setAbsolutePosition) target.setAbsolutePosition(next);
    else {
      target.position.x = next.x;
      target.position.z = next.z;
    }
    target.physics?.setTargetTransform?.(
      target.getAbsolutePosition?.() ?? next,
      target.rotationQuaternion
    );
  },
  _updateXRView() {
    if (flock._xrMode !== 'VR' || !flock._xrSessionActive) return;
    const xrCamera = flock.xrHelper?.baseExperience?.camera;
    if (!xrCamera?.position) return;

    const position = flock._xrTargetPosition();
    if (!position) {
      if (flock._xrCameraMotionMode !== 'smooth' || flock._canvasControlsEnabled === false) {
        return;
      }
      const moveX = flock.inputManager.getAxis('XR_MOVE_X');
      const moveZ = flock.inputManager.getAxis('XR_MOVE_Y');
      const moveY = flock.inputManager.getAxis('XR_MOVE_VERTICAL');
      if (!moveX && !moveY && !moveZ) return;

      const B = flock.BABYLON;
      flock._xrMoveForward ??= new B.Vector3();
      flock._xrMoveRight ??= new B.Vector3();
      flock._xrMoveDelta ??= new B.Vector3();
      flock._xrForwardBasis ??= B.Vector3.Forward();
      flock._xrRightBasis ??= B.Vector3.Right();
      xrCamera.getDirectionToRef(flock._xrForwardBasis, flock._xrMoveForward);
      flock._xrMoveForward.y = 0;
      flock._xrMoveForward.normalize();
      xrCamera.getDirectionToRef(flock._xrRightBasis, flock._xrMoveRight);
      flock._xrMoveRight.y = 0;
      flock._xrMoveRight.normalize();
      flock._xrMoveForward.scaleToRef(-moveZ, flock._xrMoveDelta);
      flock._xrMoveRight.scaleAndAddToRef(moveX, flock._xrMoveDelta);
      flock._xrMoveDelta.y = moveY;
      const length = flock._xrMoveDelta.length();
      if (length > 1) flock._xrMoveDelta.scaleInPlace(1 / length);
      const seconds = Math.min(0.05, (flock.engine?.getDeltaTime?.() ?? 16) / 1000);
      flock._xrMoveDelta.scaleInPlace(FLY_SPEED * seconds);
      xrCamera.position.addInPlace(flock._xrMoveDelta);
      return;
    }

    if (flock._xrViewMode === 'embody') {
      if (flock._xrCameraMotionMode === 'teleport') {
        flock._syncXREmbodiedTarget();
        return;
      }
      if (flock._xrCameraMotionMode !== 'smooth') return;
    }

    if (flock._xrViewMode === 'watch' && flock._xrCameraMotionMode === 'none') return;
    if (!flock._xrFollowLastPosition || !flock._xrFollowSettledPosition) {
      flock._resetXRViewTracking();
      return;
    }

    const now = performance.now?.() ?? Date.now();
    const isWatch = flock._xrViewMode === 'watch';

    if (flock.BABYLON.Vector3.DistanceSquared(position, flock._xrFollowLastPosition) > 0.0001) {
      const delta = position.subtract(flock._xrFollowLastPosition);
      const holdHeight = !isWatch && Math.abs(delta.y) < EMBODY_MIN_HEIGHT_CHANGE_M;
      if (holdHeight) delta.y = 0;
      const heldY = flock._xrFollowLastPosition.y;
      flock._xrFollowLastMovedAt = now;
      flock._xrFollowLastPosition.copyFrom(position);
      // Held rather than dropped, so a slow climb still adds up to a move.
      if (holdHeight) flock._xrFollowLastPosition.y = heldY;
      if (flock._xrCameraMotionMode === 'smooth') {
        if (!isWatch || !flock._placeXRWatchCamera(position, 0)) {
          xrCamera.position.addInPlace(delta);
        }
        flock._xrFollowSettledPosition.copyFrom(position);
      }
      return;
    }
    if (flock._xrCameraMotionMode !== 'comfort') return;
    if (now - flock._xrFollowLastMovedAt < COMFORT_SETTLE_MS) return;

    if (flock._placeXRWatchCamera(position, 0)) {
      flock._xrFollowSettledPosition.copyFrom(position);
      return;
    }
    const delta = position.subtract(flock._xrFollowSettledPosition);
    if (delta.lengthSquared() <= 0.000001) return;
    xrCamera.position.addInPlace(delta);
    flock._xrFollowSettledPosition.copyFrom(position);
  },
  _ensureXRVignetteShaders() {
    const store = flock.BABYLON.Effect.ShadersStore;
    if (store['xrVignetteVertexShader']) return;
    store['xrVignetteVertexShader'] = `
      precision highp float;
      attribute vec3 position;
      uniform mat4 worldViewProjection;
      varying vec3 vDirection;
      void main() {
        vDirection = position;
        gl_Position = worldViewProjection * vec4(position, 1.0);
      }
    `;
    store['xrVignetteFragmentShader'] = `
      precision highp float;
      varying vec3 vDirection;
      uniform float aperture;
      uniform float feather;
      uniform vec3 tint;
      uniform float opacity;
      void main() {
        // Measured from the head at the centre of the sphere rather than from either eye, so
        // both eyes are given the same aperture and there is no edge to fuse.
        float angle = acos(clamp(normalize(vDirection).z, -1.0, 1.0));
        float alpha = smoothstep(aperture, aperture + feather, angle) * opacity;
        if (alpha <= 0.0) discard;
        gl_FragColor = vec4(tint, alpha);
      }
    `;
  },
  _createXRVignette() {
    if (flock._xrVignetteMesh || !flock.scene) return;
    const B = flock.BABYLON;
    const camera = flock.xrHelper?.baseExperience?.camera;
    if (!camera) return;
    flock._ensureXRVignetteShaders();

    const material = new B.ShaderMaterial(
      'xrComfortVignetteMaterial',
      flock.scene,
      { vertex: 'xrVignette', fragment: 'xrVignette' },
      {
        attributes: ['position'],
        uniforms: ['worldViewProjection', 'aperture', 'feather', 'tint', 'opacity'],
        needAlphaBlending: true,
      }
    );
    // The camera sits inside the sphere, and nothing in the scene may cut a hole in the
    // periphery, so the restrictor is drawn last and never tested against what it covers.
    material.backFaceCulling = false;
    material.disableDepthWrite = true;
    material.depthFunction = B.Constants.ALWAYS;
    material.setFloat('aperture', VIGNETTE_OPEN_ANGLE);
    material.setFloat('feather', VIGNETTE_FEATHER_RAD);

    const mesh = B.MeshBuilder.CreateSphere(
      VIGNETTE_MESH_NAME,
      { diameter: VIGNETTE_RADIUS_M * 2, segments: 24 },
      flock.scene
    );
    mesh.material = material;
    mesh.isPickable = false;
    mesh.isVisible = false;
    mesh.renderingGroupId = VIGNETTE_RENDERING_GROUP;
    // It surrounds the camera, so testing its bounds against the frustum proves nothing.
    mesh.alwaysSelectAsActiveMesh = true;
    // Riding the camera node keeps the aperture centred without a per-frame placement that
    // could land a frame behind the eyes it is drawn for.
    mesh.parent = camera;

    flock._xrVignetteMaterial = material;
    flock._xrVignetteMesh = mesh;
    flock._xrVignetteRestriction = 0;
    flock._applyXRVignetteStyle();
    flock._resetXRVignetteBaseline();
  },
  _disposeXRVignette() {
    flock._xrVignetteMesh?.dispose?.();
    flock._xrVignetteMaterial?.dispose?.();
    flock._xrVignetteMesh = null;
    flock._xrVignetteMaterial = null;
    flock._xrVignetteRestriction = 0;
  },
  _xrVignetteClosedAngle() {
    return VIGNETTE_CLOSED_ANGLES[flock._xrComfortStrength] ?? VIGNETTE_CLOSED_ANGLES.medium;
  },
  _applyXRVignetteStyle() {
    const material = flock._xrVignetteMaterial;
    if (!material) return;
    const B = flock.BABYLON;
    let tint = null;
    try {
      tint = B.Color3.FromHexString(flock._xrComfortColour);
    } catch {
      // A colour the picker never produces: keep the periphery black rather than lose it.
    }
    material.setColor3?.('tint', tint ?? new B.Color3(0, 0, 0));
    material.setFloat('opacity', 1 - flock._xrComfortSeeThrough / 100);
    // The aperture the restriction is currently at may sit at the old strength's angle.
    flock._setXRVignetteRestriction(flock._xrVignetteRestriction);
  },
  _vrComfortTunnelActive() {
    if (flock._xrComfortTunnel !== 'auto') return false;
    // auto is what the device can do: the restrictor is rendered in an immersive VR session
    // and nowhere else. 'on' is left unclaimed for a renderer that reaches further.
    return flock._xrMode === 'VR' && flock._xrSessionActive;
  },
  _resetXRVignetteBaseline() {
    flock._xrVignetteHasBaseline = false;
  },
  _setXRVignetteRestriction(restriction) {
    const value = Math.min(VIGNETTE_MAX_RESTRICTION, Math.max(0, restriction));
    flock._xrVignetteRestriction = value;
    const mesh = flock._xrVignetteMesh;
    if (!mesh || mesh.isDisposed?.()) return;
    // Open, the aperture is wider than any headset shows: there would be nothing to draw.
    mesh.isVisible = value > 0;
    if (value <= 0) return;
    flock._xrVignetteMaterial?.setFloat?.(
      'aperture',
      VIGNETTE_OPEN_ANGLE + (flock._xrVignetteClosedAngle() - VIGNETTE_OPEN_ANGLE) * value
    );
  },
  // Saturating rather than linear, so crossing the deadzone is a hint rather than a wall and
  // there is still somewhere left to go once the wearer is moving quickly.
  _xrVignetteResponse(value, deadzone, reference) {
    if (!(value > deadzone) || reference <= deadzone) return 0;
    const t = Math.min(1, (value - deadzone) / (reference - deadzone));
    return t * t * (3 - 2 * t);
  },
  // The pose the wearer's own body puts the headset in. baseReferenceSpace is fixed for the
  // session, while referenceSpace carries the offset Babylon folds in whenever the camera is
  // moved outside the XR loop -- a pose read against that one already has the artificial
  // motion in it and leaves nothing to subtract.
  _readXRPhysicalPose(position, rotation) {
    const sessionManager = flock.xrHelper?.baseExperience?.sessionManager;
    const frame = sessionManager?.currentFrame;
    const space = sessionManager?.baseReferenceSpace;
    if (!frame || !space) return false;
    const pose = frame.getViewerPose(space);
    // An emulated pose is a guess at where the wearer is rather than a measurement of it.
    if (!pose?.transform || pose.emulatedPosition) return false;
    const posePosition = pose.transform.position;
    const orientation = pose.transform.orientation;
    if (orientation?.x === undefined) return false;
    const scale = sessionManager.worldScalingFactor || 1;
    const flip = flock.scene?.useRightHandedSystem ? 1 : -1;
    position.set(posePosition.x * scale, posePosition.y * scale, posePosition.z * scale * flip);
    rotation.set(orientation.x, orientation.y, orientation.z * flip, orientation.w * flip);
    return true;
  },
  // Restricts on the motion the wearer's inner ear cannot account for: the rendered view's
  // motion with the wearer's own subtracted. Deliberately blind to where the rest came from,
  // so locomotion, physics, animation and camera moves all count the same.
  _updateXRVignette() {
    const mesh = flock._xrVignetteMesh;
    if (!mesh || mesh.isDisposed?.()) return;
    if (!flock._vrComfortTunnelActive()) {
      flock._resetXRVignetteBaseline();
      flock._setXRVignetteRestriction(0);
      return;
    }
    const xrCamera = flock.xrHelper?.baseExperience?.camera;
    if (!xrCamera?.position || !xrCamera.rotationQuaternion) return;

    const B = flock.BABYLON;
    flock._xrVignettePhysicalPosition ??= new B.Vector3();
    flock._xrVignettePhysicalRotation ??= new B.Quaternion();
    flock._xrVignetteRenderedPosition ??= new B.Vector3();
    flock._xrVignetteRenderedRotation ??= new B.Quaternion();
    flock._xrVignetteScratch ??= {
      position: new B.Vector3(),
      rotation: new B.Quaternion(),
      drift: new B.Vector3(),
      physicalTurn: new B.Quaternion(),
      renderedTurn: new B.Quaternion(),
      inverse: new B.Quaternion(),
    };
    const scratch = flock._xrVignetteScratch;

    // Tracking loss leaves nothing to subtract. Holding the wearer still credits all of the
    // rendered motion to the scene, which errs towards restricting: the comfortable way to be
    // wrong, and the behaviour to revisit on a headset.
    if (!flock._readXRPhysicalPose(scratch.position, scratch.rotation)) {
      scratch.position.copyFrom(flock._xrVignettePhysicalPosition);
      scratch.rotation.copyFrom(flock._xrVignettePhysicalRotation);
    }

    const now = performance.now?.() ?? Date.now();
    const elapsed = (now - flock._xrVignetteSampledAt) / 1000;
    const hadBaseline = flock._xrVignetteHasBaseline;

    scratch.drift.copyFrom(xrCamera.position).subtractInPlace(flock._xrVignetteRenderedPosition);
    scratch.drift.addInPlace(flock._xrVignettePhysicalPosition).subtractInPlace(scratch.position);
    const drift = scratch.drift.length();

    flock._xrVignetteRenderedRotation.conjugateToRef(scratch.inverse);
    xrCamera.rotationQuaternion.multiplyToRef(scratch.inverse, scratch.renderedTurn);
    flock._xrVignettePhysicalRotation.conjugateToRef(scratch.inverse);
    scratch.rotation.multiplyToRef(scratch.inverse, scratch.physicalTurn);
    const alignment = Math.abs(B.Quaternion.Dot(scratch.renderedTurn, scratch.physicalTurn));
    const swing = 2 * Math.acos(Math.min(1, alignment));

    // Rebased before any early return: a frame that could not be measured must not be measured
    // against on the next one either.
    flock._xrVignetteRenderedPosition.copyFrom(xrCamera.position);
    flock._xrVignetteRenderedRotation.copyFrom(xrCamera.rotationQuaternion);
    flock._xrVignettePhysicalPosition.copyFrom(scratch.position);
    flock._xrVignettePhysicalRotation.copyFrom(scratch.rotation);
    flock._xrVignetteSampledAt = now;
    flock._xrVignetteHasBaseline = true;

    // A first sample, a frame the browser sat on, and a teleport or snap turn are all things
    // that are not a speed. Hold the restrictor where it is rather than read one off them.
    if (!hadBaseline || elapsed <= 0 || elapsed > VIGNETTE_MAX_DT_S) return;
    if (drift > VIGNETTE_JUMP_M || swing > VIGNETTE_JUMP_RAD) return;

    // Combined by the larger of the two: moving and turning at once is not twice as sickening,
    // and adding them would close the aperture fully every time both happen together.
    const target =
      VIGNETTE_MAX_RESTRICTION *
      Math.max(
        flock._xrVignetteResponse(drift / elapsed, VIGNETTE_DEADZONE_MPS, VIGNETTE_REF_SPEED_MPS),
        flock._xrVignetteResponse(swing / elapsed, VIGNETTE_DEADZONE_RAD_S, VIGNETTE_REF_TURN_RAD_S)
      );

    const current = flock._xrVignetteRestriction;
    const step = (target > current ? VIGNETTE_CLOSE_PER_S : VIGNETTE_OPEN_PER_S) * elapsed;
    flock._setXRVignetteRestriction(current + Math.min(step, Math.max(-step, target - current)));
  },
  async _immersiveVRSupported() {
    try {
      return (await navigator.xr?.isSessionSupported?.('immersive-vr')) === true;
    } catch {
      // No WebXR, or an insecure or permissions-blocked context.
      return false;
    }
  },
  // Phones do Cardboard-style immersive VR as well, so support alone can't tell them from a
  // headset. A headset browser missing from this list just falls back to the XR block.
  _isHeadsetBrowser() {
    const agent = navigator.userAgent ?? '';
    if (/OculusBrowser|Quest|Pico|Wolvic|Vision ?OS|Mobile VR/i.test(agent)) return true;
    return !/Android|iPhone|iPad|iPod/i.test(agent);
  },
  async _immersiveARSupported() {
    try {
      return (await navigator.xr?.isSessionSupported?.('immersive-ar')) === true;
    } catch {
      // No WebXR, or an insecure or permissions-blocked context.
      return false;
    }
  },
  // Passthrough belongs to the session rather than the scene: a VR session leaves a black void
  // behind the scene whatever the background asks for. A project that set a camera background
  // wants the real world back there, and on a headset an AR session is the only way to hand it
  // over, so the background decides which session the enter button opens.
  async _xrSessionMode() {
    if (flock._xrMode === 'AR') return 'immersive-ar';
    if (!flock._cameraBackgroundFacing || !flock._isHeadsetBrowser()) return 'immersive-vr';
    // A tethered desktop headset does VR without passthrough, and asking it for AR would leave
    // the wearer with a button that opens nothing.
    return (await flock._immersiveARSupported()) ? 'immersive-ar' : 'immersive-vr';
  },
  // Babylon's enter button (its buttons are private, hence the guarded reach) reads its session
  // mode at click time, so a background set after XR started up still gets a passthrough session.
  async _syncPendingXRSessionMode() {
    const buttons = flock.xrHelper?.enterExitUI?._buttons;
    if (!buttons?.length || flock._xrSessionActive) return;
    const sessionMode = await flock._xrSessionMode();
    for (const button of buttons) {
      if (button.sessionMode === 'immersive-vr' || button.sessionMode === 'immersive-ar') {
        button.sessionMode = sessionMode;
      }
    }
  },
  // Entering stays the wearer's click either way: a session needs a user gesture.
  async _showXRButtonOnHeadset() {
    if (flock.xrHelper || flock._xrMode !== undefined) return false;
    if (!flock._isHeadsetBrowser()) return false;
    const signal = flock.abortController?.signal;
    if (!(await flock._immersiveVRSupported())) return false;
    // The project may have set its own mode, or been stopped, while we were asking.
    if (signal?.aborted || flock.xrHelper || flock._xrMode !== undefined) return false;
    await flock.initializeXR('VR');
    flock._xrHelperAutoCreated = true;
    return true;
  },
  async _sensorOrientationAvailable() {
    const input = flock.BABYLON?.FreeCameraDeviceOrientationInput;
    if (typeof input?.WaitForOrientationChangeAsync !== 'function') return false;
    try {
      await input.WaitForOrientationChangeAsync(MAGIC_WINDOW_SENSOR_TIMEOUT_MS);
      return true;
    } catch {
      // Timed out, denied, or no sensor: nothing to look around with either way.
      return false;
    }
  },
  // The feed stands in for the look-around the sensor can't give, matching what iOS projects
  // already do by hand. A project that chose its own facing keeps it.
  _degradeMagicWindow() {
    flock._magicWindowFallback = true;
    if (flock._cameraBackgroundLayer) flock._showPassthroughBackground(true);
    else if (!flock._cameraBackgroundFacing) flock.setCameraBackground('environment');
  },
  async _startMagicWindow() {
    // Captured now, never re-read at settle time: stopping a run replaces the controller.
    const signal = flock.abortController?.signal;
    // Only a free camera carries this input; a follow camera has no look-around yet.
    if (typeof flock.scene?.activeCamera?.inputs?.addDeviceOrientation !== 'function') return;

    // Attaching sets rotationQuaternion, which silently retires camera.rotation and with it the
    // project's own look controls, so nothing is attached until the sensor is known to report.
    const available = await flock._sensorOrientationAvailable();
    if (signal?.aborted || flock._xrMode !== 'MAGIC_WINDOW') return;
    if (!available) {
      // A desktop has no sensor and wants no webcam; the feed stands in only on a handheld.
      if (!flock._isHeadsetBrowser()) flock._degradeMagicWindow();
      return;
    }

    const camera = flock.scene?.activeCamera;
    if (typeof camera?.inputs?.addDeviceOrientation !== 'function') return;
    if (!camera.inputs.attached.deviceOrientation) camera.inputs.addDeviceOrientation();
  },
  async initializeXR(mode) {
    const autoHelper = flock.xrHelper && flock._xrHelperAutoCreated ? flock.xrHelper : null;
    if (flock.xrHelper && !autoHelper) return; // Avoid reinitializing

    patchEmulatorOffsetReferenceSpace();
    // Claimed before any await, so the headset auto-button cannot race in and take the mode.
    flock._xrMode = mode;

    // A headset head-tracks the view already, so looking around there means a session.
    if (
      mode === 'MAGIC_WINDOW' &&
      flock._isHeadsetBrowser() &&
      (await flock._immersiveVRSupported())
    ) {
      mode = 'VR';
      flock._xrMode = mode;
    }

    // Projects reach their XR block after the headset button has already opened, so the mode
    // repoints that button rather than building a second experience behind it.
    if (autoHelper) {
      flock._xrHelperAutoCreated = false;
      flock._syncXRFollowTargetFromCamera();
      flock._applyXRDefaults(mode);
      await flock._syncPendingXRSessionMode();
      flock._applyTeleportationState();
      return;
    }

    flock._syncXRFollowTargetFromCamera();
    flock._applyXRDefaults(mode);

    if (mode === 'VR' || mode === 'AR') {
      // No AR session to enter: a button that opens nothing is worse than the camera feed.
      if (mode === 'AR' && !(await flock._immersiveARSupported())) {
        mode = 'MAGIC_WINDOW';
        flock._xrMode = mode;
        flock._magicWindowReady = flock._startMagicWindow();
        return;
      }

      flock.xrHelper = await flock.scene.createDefaultXRExperienceAsync({
        outputCanvasOptions: flock._xrCanvasOptions(),
        uiOptions: {
          sessionMode: await flock._xrSessionMode(),
          // A session that was not asked for hit test can never be granted it, and the mode
          // can still be repointed after this.
          optionalFeatures: ['hit-test'],
        },
      });

      // Babylon swallows a failed init and returns a helper with nothing on it.
      if (!flock.xrHelper?.baseExperience) {
        flock.xrHelper = null;
        return;
      }
    } else if (mode === 'MAGIC_WINDOW') {
      // Not awaited: the sensor check waits out a permission iOS never grants here, and the
      // rest of the project should not wait with it.
      flock._magicWindowReady = flock._startMagicWindow();
      return;
    }

    // Keep the application UI at a stable, readable position in the viewer's field of view.
    flock.uiPlane = flock.BABYLON.MeshBuilder.CreatePlane(
      'xrHUDPlane',
      { width: XR_HUD_WIDTH, height: XR_HUD_HEIGHT },
      flock.scene
    );
    flock.uiPlane.isVisible = false;
    flock.uiPlane.isPickable = false;
    flock.uiPlane.metadata = { isXRHUD: true };

    flock.meshTexture = flock._createXRHUDTexture(flock.uiPlane);

    // Removal fires before the grip is disposed, so reparenting here is safe.
    flock._xrUIControllerObserver = flock.xrHelper.input.onControllerAddedObservable.add(() =>
      flock._applyXRUIPlacement()
    );
    flock._xrUIControllerRemovedObserver = flock.xrHelper.input.onControllerRemovedObservable.add(
      () => flock._applyXRUIPlacement()
    );
    flock._applyXRUIPlacement();
    if (mode === 'VR') flock._createXRVignette();

    flock._xrSource = new XRSource(flock.inputManager, {
      xrHelper: flock.xrHelper,
      scene: flock.scene,
    });
    flock._applyXRInputState();
    flock._xrSource.start();
    flock._xrViewObserver = flock.scene.onBeforeRenderObservable.add(() => {
      flock._syncXRHUDPicking();
      flock._updateXRSnapTurn();
      flock._updateXRView();
      flock._updateXRVignette();
      flock._placeARScene();
      flock._syncXRHUDPose();
      if (flock._xrSessionActive) xrDebugTick();
    });
    flock._xrViewObserverScene = flock.scene;

    flock._teleportFloorMeshes = new Set();
    flock._teleportBlockerMeshes = new Set();
    const observerScene = flock.scene;
    flock._xrMeshObserverScene = observerScene;
    flock._xrMeshAddedObserver = observerScene.onNewMeshAddedObservable.add((mesh) => {
      queueMicrotask(() => {
        if (flock._xrMeshObserverScene !== observerScene) return;
        flock._syncTeleportMesh(mesh);
        if (flock._xrVisibilitySyncQueued) return;
        flock._xrVisibilitySyncQueued = true;
        queueMicrotask(() => {
          if (flock._xrMeshObserverScene !== observerScene) return;
          flock._xrVisibilitySyncQueued = false;
          flock._applyXRViewVisibility();
        });
      });
    });
    flock._xrMeshRemovedObserver = observerScene.onMeshRemovedObservable.add((mesh) => {
      flock._unregisterTeleportMesh(mesh);
      flock._xrEmbodiedVisibility.delete(mesh);
    });
    flock._applyTeleportationState();

    // Handle XR state changes
    flock.xrHelper.baseExperience.onStateChangedObservable.add(flock._handleXRStateChange);
  },
  // 'opaque' is a plain VR session: the compositor has no view of the room to blend the scene into.
  _isPassthroughSession() {
    if (flock._xrMode === 'AR') return true;
    const blend = flock.xrHelper?.baseExperience?.sessionManager?.session?.environmentBlendMode;
    return blend === 'additive' || blend === 'alpha-blend';
  },
  // A passthrough session draws the scene over the room, so the opaque things behind it — the
  // clear colour and the sky — are what stand between the wearer and that room.
  _showPassthroughBackground(visible) {
    const scene = flock.scene;
    if (!scene) return;
    if (visible) {
      flock._xrSavedClearColor ??= scene.clearColor?.clone?.() ?? null;
      scene.clearColor = new flock.BABYLON.Color4(0, 0, 0, 0);
      if (flock.sky) {
        flock._xrSavedSkyEnabled = flock.sky.isEnabled?.() ?? true;
        flock.sky.setEnabled?.(false);
      }
      return;
    }
    if (flock._xrSavedClearColor) scene.clearColor = flock._xrSavedClearColor;
    flock._xrSavedClearColor = null;
    if (flock.sky && flock._xrSavedSkyEnabled !== null) {
      flock.sky.setEnabled?.(flock._xrSavedSkyEnabled);
      flock._xrSavedSkyEnabled = null;
    }
  },
  _disposeCameraBackgroundLayer() {
    const layer = flock._cameraBackgroundLayer;
    if (!layer) return;
    flock._cameraBackgroundLayer = null;
    // Layer.dispose() takes its texture with it, and the feed outlives the layer.
    layer.texture = null;
    layer.dispose();
  },
  _disposeCameraBackground() {
    // Strands any webcam request still starting up.
    flock._cameraBackgroundRequest = (flock._cameraBackgroundRequest ?? 0) + 1;
    flock._disposeCameraBackgroundLayer();
    // Disposing the texture is what releases the webcam.
    flock._cameraBackgroundTexture?.dispose();
    flock._cameraBackgroundTexture = null;
    flock._cameraBackgroundFacing = null;
  },
  _showCameraBackgroundLayer(texture) {
    if (flock._cameraBackgroundLayer || !flock.scene) return;
    const layer = new flock.BABYLON.Layer('videoLayer', null, flock.scene, true);
    layer.texture = texture;
    flock._cameraBackgroundLayer = layer;
    // The sky is a mesh, so it would draw over a feed the mode fell back to.
    if (flock._magicWindowFallback) flock._showPassthroughBackground(true);
  },
  // A headset gives the page no camera it can show in a session: the selfie feed freezes there,
  // and passthrough stands in for it. The feed waits for the flat view.
  _applyCameraBackground() {
    const texture = flock._cameraBackgroundTexture;
    if (!texture) return;
    if (flock._xrSessionActive) {
      flock._disposeCameraBackgroundLayer();
      return;
    }
    flock._showCameraBackgroundLayer(texture);
  },
  // One view, and taps rather than controllers.
  _isHandheldXRSession() {
    const baseExperience = flock.xrHelper?.baseExperience;
    const interactionMode = baseExperience?.sessionManager?.session?.interactionMode;
    if (interactionMode) return interactionMode === 'screen-space';
    const views = baseExperience?.camera?.rigCameras?.length;
    if (views) return views === 1;
    return !flock._isHeadsetBrowser();
  },
  // Terrain is scenery; the flat ground is a floor the room already has. Metadata
  // arrives with onReady, so a ground without any is terrain still loading.
  _isTerrainGround() {
    const ground = flock.ground;
    if (!ground || ground.isDisposed?.()) return false;
    return ground.metadata?.heightMapImage !== 'NONE';
  },
  _isARSceneContent(mesh) {
    if (!mesh || mesh.isDisposed?.() || mesh === flock.sky || mesh === flock.uiPlane) return false;
    if (mesh === flock.ground) return flock._isTerrainGround();
    if (mesh.metadata?.isXRHUD || XR_HELPER_MESH_NAMES.has(mesh.name)) return false;
    if (mesh.isEnabled?.() === false || mesh.isVisible === false) return false;
    return (mesh.getTotalVertices?.() ?? 0) > 0;
  },
  _arSceneBounds() {
    const B = flock.BABYLON;
    let min = null;
    let max = null;
    for (const mesh of flock.scene?.meshes ?? []) {
      if (!flock._isARSceneContent(mesh)) continue;
      mesh.computeWorldMatrix?.(true);
      const box = mesh.getBoundingInfo?.()?.boundingBox;
      if (!box) continue;
      min = min ? B.Vector3.Minimize(min, box.minimumWorld) : box.minimumWorld.clone();
      max = max ? B.Vector3.Maximize(max, box.maximumWorld) : box.maximumWorld.clone();
    }
    if (!min || !max) return null;
    return {
      min,
      max,
      centre: min.add(max).scale(0.5),
      width: Math.max(max.x - min.x, max.z - min.z),
    };
  },
  // A phone sees only a slice of a life-size scene; a headset stands in it.
  _arSceneSizeCentimetres() {
    if (Number.isFinite(flock._arSceneSizeCm)) return flock._arSceneSizeCm;
    return flock._isHandheldXRSession() ? AR_DEFAULT_SCENE_SIZE_CM : 0;
  },
  _arSceneClearanceMetres() {
    const centimetres = flock._arSceneClearanceCm;
    return Number.isFinite(centimetres) ? centimetres / 100 : AR_DIORAMA_CLEARANCE_M;
  },
  // How far above the room's floor the scene sits, not how tall it is.
  _arSceneHeightMetres() {
    const centimetres = flock._arSceneHeightCm;
    return Number.isFinite(centimetres) ? centimetres / 100 : 0;
  },
  _arWorldScaleFor(sizeCm, bounds) {
    if (!sizeCm || !bounds || !(bounds.width > 0)) return 1;
    const scale = bounds.width / (sizeCm / 100);
    return Number.isFinite(scale) && scale > 0 ? scale : 1;
  },
  _applyARSceneScale() {
    const sessionManager = flock.xrHelper?.baseExperience?.sessionManager;
    if (!sessionManager || !flock._xrSessionActive) return;

    // A session that ended while scaled leaves its factor behind, so every session sets one.
    const isAR = flock._xrMode === 'AR';
    const scale = isAR
      ? flock._arWorldScaleFor(flock._arSceneSizeCentimetres(), flock._arSceneBounds())
      : 1;
    flock._arWorldScale = scale;
    sessionManager.worldScalingFactor = scale;
    flock._syncARGround();
    // A headset at life size already stands where the project put it.
    const placing = isAR && (scale !== 1 || flock._isHandheldXRSession());
    flock._arPlacementFrames = placing ? AR_PLACEMENT_SETTLE_FRAMES : 0;
    flock._arPlacementWaitFrames = placing ? AR_PLACEMENT_MAX_WAIT_FRAMES : 0;
  },
  // Writing camera.position before the first pose re-offsets the reference space every frame.
  _arViewerPoseReady() {
    const sessionManager = flock.xrHelper?.baseExperience?.sessionManager;
    const frame = sessionManager?.currentFrame;
    const referenceSpace = sessionManager?.referenceSpace;
    if (!frame || !referenceSpace) return false;
    return !!frame.getViewerPose(referenceSpace);
  },
  // The session's first frame has an identity rotation, and placement needs the facing.
  _placeARScene() {
    if (!flock._arPlacementFrames || flock._xrMode !== 'AR' || !flock._xrSessionActive) return;
    const camera = flock.xrHelper?.baseExperience?.camera;
    if (!camera?.position || !camera.rigCameras?.length) return;
    if (flock._arViewerPoseReady()) {
      if (--flock._arPlacementFrames > 0) return;
    } else if (--flock._arPlacementWaitFrames > 0) {
      return;
    } else {
      xrDebugPost('placing without a viewer pose');
    }
    // Once only: a count left behind re-places, and re-offsets, on every later unposed frame.
    flock._arPlacementFrames = 0;
    flock._arPlacementWaitFrames = 0;

    if (flock._arWorldScale === 1) {
      flock._positionXRARCamera(camera);
      xrDebugPost('placed at life size');
      return;
    }

    const bounds = flock._arSceneBounds();
    if (!bounds) {
      xrDebugPost('placement aborted: no bounds');
      return;
    }

    const B = flock.BABYLON;
    const forward = new B.Vector3();
    camera.getDirectionToRef(B.Vector3.Forward(), forward);
    forward.y = 0;
    if (forward.lengthSquared() < 0.000001) forward.set(0, 0, 1);
    else forward.normalize();

    const scale = flock._arWorldScale;
    let distance = bounds.width / 2 + flock._arSceneClearanceMetres() * scale;
    // realWorldHeight is already in scene units, and reads 0 until the first pose.
    const eyeHeight = camera.realWorldHeight || XR_FALLBACK_EYE_HEIGHT_M * scale;
    // Raising the scene lowers the viewer against it; nothing in the scene itself moves.
    const cameraY = bounds.min.y + eyeHeight - flock._arSceneHeightMetres() * scale;

    // A wearer looks down as freely as they turn; a phone points where it is held, so a diorama
    // at arm's length sits below the screen entirely. Standing back trades size for being seen.
    if (flock._isHandheldXRSession()) {
      const drop = cameraY - bounds.centre.y;
      const backOff = drop > 0 ? drop / Math.tan(AR_MAX_LOOK_DOWN) : 0;
      distance = Math.max(distance, Math.min(backOff, AR_MAX_HANDHELD_DISTANCE_M * scale));
    }

    // Moving the play space moves the diorama: stand the viewer that far back from it.
    camera.position.set(
      bounds.centre.x - forward.x * distance,
      cameraY,
      bounds.centre.z - forward.z * distance
    );
    xrDebugPost(`placed at ${(distance / flock._arWorldScale).toFixed(2)}m`);
  },
  // Life size: stand where the project camera looked from, on the ground not at its height.
  _positionXRARCamera(camera = flock.xrHelper?.baseExperience?.camera) {
    if (!camera?.position) return;
    const source = flock._xrTargetPosition() ?? flock._xrNonXRCameraPosition;
    if (!source) return;
    const groundLevel = flock.getGroundLevelAt?.(source.x, source.z) ?? 0;
    camera.position.set(source.x, groundLevel + flock._xrEyeHeight(camera), source.z);
  },
  _arShadowCatcher() {
    if (flock._arShadowMaterial) return flock._arShadowMaterial;
    if (!flock.ShadowOnlyMaterial || !flock.scene) return null;
    const material = new flock.ShadowOnlyMaterial('arGroundShadow', flock.scene);
    material.activeLight = flock.shadowLight;
    flock._arShadowMaterial = material;
    return material;
  },
  // A shrunken scene sits on the room's floor, so the project's floor gets out of the way.
  _syncARGround() {
    const ground = flock.ground;
    const scaled =
      flock._xrSessionActive && flock._xrMode === 'AR' && flock._arWorldScale !== 1 && !!ground;
    if (!scaled || flock._isTerrainGround()) {
      flock._restoreARGround();
      return;
    }

    flock._arGroundState ??= {
      mesh: ground,
      isVisible: ground.isVisible,
      material: ground.material,
    };
    const catcher = flock.shadowGenerator ? flock._arShadowCatcher() : null;
    if (catcher) {
      ground.material = catcher;
      ground.receiveShadows = true;
      ground.isVisible = true;
      return;
    }
    ground.material = flock._arGroundState.material;
    ground.isVisible = false;
  },
  _restoreARGround() {
    const state = flock._arGroundState;
    flock._arGroundState = null;
    if (state && !state.mesh.isDisposed?.()) {
      state.mesh.isVisible = state.isVisible;
      state.mesh.material = state.material;
    }
    flock._arShadowMaterial?.dispose();
    flock._arShadowMaterial = null;
  },
  // Enabling the feature again disposes the previous one and its observers, so every listener
  // shares one. Returns a function that stops listening.
  _onARHitTest(callback) {
    const baseExperience = flock.xrHelper?.baseExperience;
    if (baseExperience?.sessionManager?.sessionMode !== 'immersive-ar') return () => {};
    if (!flock._arHitTest) {
      try {
        flock._arHitTest = baseExperience.featuresManager.enableFeature(
          flock.BABYLON.WebXRHitTest.Name,
          'latest',
          {},
          true,
          false
        );
      } catch {
        // No hit test here: the mesh stays where the project put it.
        return () => {};
      }
    }
    const feature = flock._arHitTest;
    const observer = feature.onHitTestResultObservable.add(callback);
    return () => feature.onHitTestResultObservable.remove(observer);
  },
  _resetARScene() {
    const sessionManager = flock.xrHelper?.baseExperience?.sessionManager;
    // Babylon pushes the depth range back through the session on this write, and a session the
    // headset itself ended is already gone by the time the exit runs.
    if (sessionManager?.inXRSession) sessionManager.worldScalingFactor = 1;
    flock._arWorldScale = 1;
    flock._arPlacementFrames = 0;
    flock._arPlacementWaitFrames = 0;
    flock._restoreARGround();
  },
  /*
          Category: Scene>XR
  */

  setCameraBackground(cameraType) {
    if (!flock.scene) {
      console.error(
        'Scene not available. Ensure the scene is initialised before setting the camera background.'
      );
      return;
    }

    flock._disposeCameraBackground();
    flock._cameraBackgroundFacing = cameraType;
    flock._syncPendingXRSessionMode();
    // Captured now: a later call, or a stop, has to be able to strand this request.
    const request = (flock._cameraBackgroundRequest ?? 0) + 1;
    flock._cameraBackgroundRequest = request;
    const signal = flock.abortController?.signal;

    flock.BABYLON.VideoTexture.CreateFromWebCam(
      flock.scene,
      (videoTexture) => {
        if (request !== flock._cameraBackgroundRequest || signal?.aborted || !flock.scene) {
          videoTexture.dispose();
          return;
        }
        videoTexture._invertY = false; // Correct orientation
        videoTexture.uScale = -1; // Flip horizontally for mirror effect
        flock._cameraBackgroundTexture = videoTexture;
        flock._applyCameraBackground();
      },
      {
        facingMode: cameraType, // "user" for front, "environment" for back
        minWidth: 640,
        minHeight: 480,
        maxWidth: 1920,
        maxHeight: 1080,
        deviceId: '',
      }
    );
  },
  async setXRMode(mode) {
    await flock.initializeXR(mode);
    flock.printText({
      text: translate('xr_mode_message'),
      duration: 5,
      color: 'white',
    });
  },
  setXRViewMode(mode) {
    if (mode !== 'watch' && mode !== 'embody') return;
    flock._xrViewMode = mode;
    if (mode === 'watch' && flock._xrCameraMotionMode === 'teleport') {
      flock._xrCameraMotionMode = 'comfort';
    } else if (mode === 'embody' && flock._xrCameraMotionMode === 'comfort') {
      flock._xrCameraMotionMode = 'teleport';
    }
    flock._applyXRInputState?.();
    flock._applyTeleportationState?.();
    flock._resetXRViewTracking?.({ reposition: true });
    flock._applyXRViewVisibility?.();
  },
  // 0 asks for life size: the viewer stands in the scene.
  setARSceneSize(centimetres, distanceCm, heightCm) {
    const size = Number(centimetres);
    if (!Number.isFinite(size) || size < 0) return;
    flock._arSceneSizeCm =
      size === 0 ? 0 : Math.min(AR_SCENE_SIZE_MAX_CM, Math.max(AR_SCENE_SIZE_MIN_CM, size));
    flock._arSceneClearanceCm = optionalCentimetres(distanceCm, AR_SCENE_DISTANCE_MAX_CM);
    flock._arSceneHeightCm = optionalCentimetres(heightCm, AR_SCENE_HEIGHT_MAX_CM);
    flock._applyARSceneScale();
  },
  setVRComfort(mode, strength, colour, seeThrough) {
    // Each setting stands on its own: one bad value leaves the others to take effect.
    if (mode === 'auto' || mode === 'off') flock._xrComfortTunnel = mode;
    if (Object.hasOwn(VIGNETTE_CLOSED_ANGLES, strength)) flock._xrComfortStrength = strength;
    if (typeof colour === 'string' && /^#[0-9a-f]{6}$/i.test(colour)) {
      flock._xrComfortColour = colour;
    }
    const clarity = Number(seeThrough);
    if (Number.isFinite(clarity)) {
      flock._xrComfortSeeThrough = Math.min(100, Math.max(0, clarity));
    }
    flock._applyXRVignetteStyle();
    flock._resetXRVignetteBaseline();
    if (flock._xrComfortTunnel === 'off') flock._setXRVignetteRestriction(0);
  },
  setXRUIPlacement(placement) {
    if (placement !== 'hud' && placement !== 'wrist') return;
    flock._xrUIPlacement = placement;
    flock._applyXRUIPlacement();
  },
  setXRCameraMotionMode(mode) {
    const validModes =
      flock._xrViewMode === 'embody'
        ? ['none', 'teleport', 'smooth']
        : ['none', 'comfort', 'smooth'];
    if (!validModes.includes(mode)) return;
    flock._xrCameraMotionMode = mode;
    flock._applyXRInputState?.();
    flock._applyTeleportationState?.();
    flock._resetXRViewTracking?.();
  },
  addTeleportTarget(target) {
    flock._ensureTeleportationState?.();
    if (target === 'all') {
      flock._teleportAllTargets = true;
      flock.scene?.meshes?.forEach((mesh) => flock._syncTeleportMesh?.(mesh));
      return;
    }
    if (target === 'ground') {
      flock._teleportGroundTarget = true;
      flock._syncTeleportMeshHierarchy?.(flock.ground);
      return;
    }
    const isNamedTarget = typeof target === 'string';
    if (isNamedTarget) flock._teleportExplicitTargetNames.add(target);
    else if (target) flock._teleportExplicitTargetMeshes.add(target);
    else return;
    const mesh = isNamedTarget ? flock.scene?.getMeshByName?.(target) : target;
    flock._syncTeleportMeshHierarchy?.(mesh);
  },
  removeTeleportTarget(target) {
    flock._ensureTeleportationState?.();
    if (target === 'all') {
      flock._teleportAllTargets = false;
      flock.scene?.meshes?.forEach((mesh) => flock._syncTeleportMesh?.(mesh));
      return;
    }
    if (target === 'ground') {
      flock._teleportGroundTarget = false;
      flock._syncTeleportMeshHierarchy?.(flock.ground);
      return;
    }
    const isNamedTarget = typeof target === 'string';
    if (isNamedTarget) flock._teleportExplicitTargetNames.delete(target);
    else if (target) flock._teleportExplicitTargetMeshes.delete(target);
    else return;
    const mesh = isNamedTarget ? flock.scene?.getMeshByName?.(target) : target;
    flock._syncTeleportMeshHierarchy?.(mesh);
  },
  exportMesh(meshName, format) {
    //meshName = "scene";

    if (meshName === 'scene' && format === 'GLB') {
      const scene = flock.scene;

      const cls = (n) => n?.getClassName?.();
      const isEnabledDeep = (n) => (typeof n.isEnabled === 'function' ? n.isEnabled(true) : true);

      // Treat ALL mesh subclasses as geometry; we'll still skip LinesMesh explicitly
      const isAbstractMesh = (n) =>
        typeof flock.BABYLON !== 'undefined' && n instanceof flock.BABYLON.AbstractMesh;
      const isLines = (n) => cls(n) === 'LinesMesh';

      // --- Ghost: top-level + enabled + AbstractMesh + no material (not lines)
      const targets = scene.meshes.filter(
        (m) => !m.parent && isEnabledDeep(m) && isAbstractMesh(m) && !isLines(m) && !m.material
      );

      // Shared transparent PBR material (GLTF-friendly)
      const ghostMat = new flock.BABYLON.PBRMaterial('_tmpExportGhost', scene);
      ghostMat.alpha = 0;
      ghostMat.alphaMode = flock.BABYLON.Engine.ALPHA_BLEND;
      ghostMat.transparencyMode = flock.BABYLON.PBRMaterial.PBRMATERIAL_ALPHABLEND;
      ghostMat.disableLighting = true;
      ghostMat.metallic = 0;
      ghostMat.roughness = 1;
      ghostMat.albedoColor = new flock.BABYLON.Color4(1, 1, 1, 0);

      const patches = targets.map((mesh) => ({
        mesh,
        prev: mesh.material ?? null,
      }));
      for (const { mesh } of patches) mesh.material = ghostMat;

      // Optional: name allowlist for safety (keeps ground even if disabled, if you want)
      const alwaysKeepNames = new Set(['ground', 'Ground']);

      const shouldExportNode = (node) => {
        const c = cls(node);
        if (!c) return false;

        // Always keep ground (by name) before any other checks
        if (node.name && alwaysKeepNames.has(node.name)) return true;

        // Respect enabled state (includes ancestors)
        if (!isEnabledDeep(node)) return false;

        // Never export cameras/lights
        if (c === 'Camera' || c === 'Light') return false;

        // Skip line helpers entirely
        if (c === 'LinesMesh') return false;

        // Keep all transform containers
        if (c === 'TransformNode') return true;

        // Keep ALL mesh subclasses (e.g., Mesh, InstancedMesh, GroundMesh, etc.)
        if (isAbstractMesh(node)) return true;

        return false;
      };

      flock.EXPORT.GLTF2Export.GLBAsync(scene, 'scene.glb', {
        exportMaterials: true,
        exportTextures: true,
        shouldExportNode,
      })
        .then((glb) => glb.downloadFiles())
        .finally(() => {
          // Restore originals
          for (const { mesh, prev } of patches) mesh.material = prev;
          ghostMat.dispose();
        });

      return;
    }

    return new Promise((resolve) => {
      flock.whenModelReady(meshName, async function (mesh) {
        if (!flock.requireMesh(mesh, { api: 'exportMesh', name: meshName })) {
          resolve();
          return;
        }
        const anchorMesh = mesh;
        const rootChild = anchorMesh.getChildMeshes().find((child) => child.name === '__root__');

        const exportAnchors = [anchorMesh];
        if (rootChild) {
          exportAnchors.push(rootChild);
        }

        const allowedNodes = new Set();
        for (const anchor of exportAnchors) {
          allowedNodes.add(anchor);
          anchor.getChildMeshes(false).forEach((childMesh) => allowedNodes.add(childMesh));
        }

        const hasDirectRootChild = (node) =>
          typeof node?.getChildMeshes === 'function' &&
          node.getChildMeshes(true).some((child) => child.name === '__root__');
        const wrapperNodes = [...allowedNodes].filter(
          (node) => node.name !== '__root__' && hasDirectRootChild(node)
        );

        const childMeshes = mesh.getChildMeshes(false);
        const meshList = [mesh, ...childMeshes];
        if (format === 'STL') {
          flock.EXPORT.STLExport.CreateSTL(meshList, true, mesh.name, false, false);
        } else if (format === 'OBJ') {
          flock.EXPORT.OBJExport.OBJ(mesh);
        } else if (format === 'GLB') {
          const ghostMat = new flock.BABYLON.PBRMaterial('_tmpExportWrapperGhost', flock.scene);
          ghostMat.alpha = 0;
          ghostMat.alphaMode = flock.BABYLON.Engine.ALPHA_BLEND;
          ghostMat.transparencyMode = flock.BABYLON.PBRMaterial.PBRMATERIAL_ALPHABLEND;
          ghostMat.disableLighting = true;
          ghostMat.metallic = 0;
          ghostMat.roughness = 1;
          ghostMat.albedoColor = new flock.BABYLON.Color4(1, 1, 1, 0);

          const wrapperPatches = wrapperNodes.map((wrapperMesh) => ({
            wrapperMesh,
            prevMaterial: wrapperMesh.material ?? null,
          }));
          for (const { wrapperMesh } of wrapperPatches) {
            wrapperMesh.material = ghostMat;
          }

          mesh.flipFaces();
          try {
            await flock.EXPORT.GLTF2Export.GLBAsync(flock.scene, mesh.name + '.glb', {
              shouldExportNode: (node) => allowedNodes.has(node),
            }).then((glb) => {
              glb.downloadFiles();
            });
          } finally {
            mesh.flipFaces();
            for (const { wrapperMesh, prevMaterial } of wrapperPatches) {
              wrapperMesh.material = prevMaterial;
            }
            ghostMat.dispose();
          }
        }
        resolve();
      });
    });
  },
};
