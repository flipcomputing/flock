import { translate } from '../main/translation.js';
import { XRSource } from '../input/xrSource.js';
import { patchEmulatorOffsetReferenceSpace } from '../input/xrEmulatorShim.js';
import { FLY_SPEED } from '../input/cameraControls.js';

let flock;

export function setFlockReference(ref) {
  flock = ref;
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
  _xrFollowLastHeading: null,
  _xrFollowLastMovedAt: 0,
  _xrWatchYawOffset: null,
  _xrWatchAnchorYaw: null,
  _xrWatchAnchorPosition: null,
  _xrWatchAnchorTarget: null,
  _xrSnapTurnHeld: false,
  _xrWatchPosition: null,
  _xrNonXRCameraPosition: null,
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
  _xrSessionActive: false,
  _xrDesktopUITexture: null,
  _xrVirtualKeyboard: null,
  _xrUIPlacement: 'hud',
  _xrUIControllerObserver: null,
  _xrUIControllerRemovedObserver: null,
  _xrHUDActive: false,
  _cameraBackgroundLayer: null,
  _cameraBackgroundTexture: null,
  _cameraBackgroundFacing: null,
  _cameraBackgroundRequest: 0,
  _xrMirror: null,
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

// The mirror spans about 44 degrees of the view at this distance.
const XR_MIRROR_DISTANCE = 2.5;
const XR_MIRROR_WIDTH = 2;
const XR_MIRROR_ASPECT = 4 / 3;

const SNAP_TURN_ANGLE = Math.PI / 6;
const SNAP_TURN_PRESS = 0.7;
const SNAP_TURN_RELEASE = 0.3;
// Comfort waits for the character to hold still before the view catches up.
const COMFORT_SETTLE_MS = 250;
const HEADING_EPSILON = 0.01;

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
  _createXRHUDTexture(plane) {
    const texture = flock.GUI.AdvancedDynamicTexture.CreateForMesh(
      plane,
      XR_HUD_TEXTURE_WIDTH,
      XR_HUD_TEXTURE_HEIGHT,
      true
    );
    texture.idealWidth = Math.round(
      XR_HUD_TEXTURE_WIDTH / flock._xrTuning('xu', XR_HUD_MAGNIFICATION, 1, 4)
    );
    // Mip filtering softens glyph edges, and a head-locked panel barely moves against the eye.
    texture.updateSamplingMode(flock.BABYLON.Texture.BILINEAR_SAMPLINGMODE);
    return texture;
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

    const wristParent = flock._xrUIPlacement === 'wrist' ? flock._xrWristParent() : null;
    if (wristParent) {
      plane.parent = wristParent;
      plane.position.set(0.1, -0.05, 0);
      plane.rotation.set(Math.PI / 2, 0, 0);
      plane.scaling.setAll(XR_WRIST_SCALE);
      return;
    }

    plane.parent = flock.xrHelper?.baseExperience?.camera ?? null;
    plane.position.set(0, 0, XR_HUD_DISTANCE);
    plane.rotation.set(0, 0, 0);
    plane.scaling.setAll(1);
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
    if (
      mode === 'VR' &&
      !flock._xrTargetPosition() &&
      flock._xrViewMode === 'watch' &&
      flock._xrCameraMotionMode === 'none'
    ) {
      flock._xrViewMode = 'embody';
      flock._xrCameraMotionMode = 'smooth';
    }
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
    const isTarget = flock._isTeleportTarget(mesh);
    const isFloor = flock._teleportFloorMeshes.has(mesh);
    const isBlocker = flock._teleportBlockerMeshes.has(mesh);
    if (isTarget && !isFloor) {
      teleportation.addFloorMesh(mesh);
      flock._teleportFloorMeshes.add(mesh);
    } else if (!isTarget && isFloor) {
      teleportation.removeFloorMesh(mesh);
      flock._teleportFloorMeshes.delete(mesh);
    }
    const shouldBlock = flock._hasTeleportBlockingPhysics(mesh) && !isTarget;
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
    const projectControls = hasFollowTarget
      ? flock._xrViewMode === 'watch' ||
        (flock._xrViewMode === 'embody' && flock._xrCameraMotionMode === 'smooth')
      : flock._xrCameraMotionMode !== 'teleport';
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
      flock._resetXRViewTracking({ reposition: true });
      flock._applyXRViewVisibility();
      flock._applyCameraBackground();
    } else if (state === flock.BABYLON.WebXRState.EXITING_XR) {
      flock._xrSessionActive = false;
      flock._applyXRViewVisibility();
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
      if (flock.uiPlane) flock.uiPlane.isVisible = false;
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
      flock._xrFollowLastHeading = flock._xrTargetHeading();
      flock._xrFollowLastMovedAt = performance.now?.() ?? Date.now();

      if (reposition && xrCamera?.position && flock._xrViewMode === 'embody') {
        if (!flock._xrWatchPosition) flock._xrWatchPosition = xrCamera.position.clone();
        xrCamera.position.x = targetPosition.x;
        xrCamera.position.z = targetPosition.z;
      }
    }
    flock._syncXRWatchTrail(xrCamera?.position);
  },
  _xrTargetHeading() {
    const target = flock._xrFollowTarget;
    if (!target || target.isDisposed?.()) return null;
    const quaternion = target.rotationQuaternion;
    if (typeof quaternion?.toEulerAngles === 'function') return quaternion.toEulerAngles().y;
    const heading = target.rotation?.y;
    return Number.isFinite(heading) ? heading : null;
  },
  // The framing the watch camera keeps as the character walks and turns: where it sits
  // relative to the character's own heading, so it trails the same shoulder throughout.
  _syncXRWatchTrail(cameraPosition) {
    flock._xrWatchYawOffset = null;
    flock._xrWatchAnchorYaw = null;
    flock._xrWatchAnchorPosition = null;
    flock._xrWatchAnchorTarget = null;

    const targetPosition = flock._xrTargetPosition();
    if (!targetPosition || !cameraPosition || flock._xrViewMode !== 'watch') return;

    const offsetX = cameraPosition.x - targetPosition.x;
    const offsetZ = cameraPosition.z - targetPosition.z;
    const horizontal = Math.hypot(offsetX, offsetZ);
    if (horizontal < 0.001) return;

    const yaw = Math.atan2(offsetX, offsetZ);
    flock._xrWatchYawOffset = yaw - (flock._xrTargetHeading() ?? 0);
    flock._xrWatchAnchorYaw = yaw;
    flock._xrWatchAnchorPosition = cameraPosition.clone();
    flock._xrWatchAnchorTarget = targetPosition.clone?.() ?? { ...targetPosition };
  },
  _wrapAngle(angle) {
    return Math.atan2(Math.sin(angle), Math.cos(angle));
  },
  // Rotates the play space, so the headset keeps whatever offset the wearer is looking at.
  _rotateXRCameraYaw(radians) {
    const xrCamera = flock.xrHelper?.baseExperience?.camera;
    if (!xrCamera?.rotationQuaternion || !radians) return;
    const yaw = flock.BABYLON.Quaternion.FromEulerAngles(0, radians, 0);
    yaw.multiplyToRef(xrCamera.rotationQuaternion, xrCamera.rotationQuaternion);
  },
  // Carries the camera to `pivot`, turning it `angle` around that pivot on the way, so
  // the wearer keeps both their own head offset and their view of the character.
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
    flock._xrWatchAnchorYaw += angle;
    flock._xrWatchAnchorTarget = pivot.clone?.() ?? { ...pivot };
    return true;
  },
  _applyXRWatchTrail() {
    const targetPosition = flock._xrTargetPosition();
    if (!targetPosition || flock._xrWatchYawOffset === null) return false;
    const yaw = (flock._xrTargetHeading() ?? 0) + flock._xrWatchYawOffset;
    return flock._placeXRWatchCamera(
      targetPosition,
      flock._wrapAngle(yaw - flock._xrWatchAnchorYaw)
    );
  },
  // Watch swings around the character so they stay in view; embodied turns on the spot.
  _applyXRSnapTurn(angle) {
    if (
      flock._xrViewMode === 'watch' &&
      flock._placeXRWatchCamera(flock._xrWatchAnchorTarget, angle)
    ) {
      flock._xrWatchYawOffset += angle;
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
    flock._xrFollowCameraVerticalOffset = offset ? offset.y : null;
    if (offset) offset.y = 0;
    flock._xrFollowCameraDirection = offset?.lengthSquared() ? offset.normalize() : null;
    flock._xrFollowCameraRadius = Number.isFinite(camera?.radius) ? camera.radius : null;
    return target;
  },
  _syncXRFollowTargetFromCamera(camera = flock.scene?.activeCamera) {
    flock._setXRFollowTarget(flock._captureXRWatchFraming(camera) ?? null);
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
      flock._xrWatchPosition.y = targetPosition.y + verticalOffset;
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
  },
  _restoreXREmbodiedVisibility() {
    for (const [mesh, isVisible] of flock._xrEmbodiedVisibility) {
      if (!mesh.isDisposed?.()) mesh.isVisible = isVisible;
    }
    flock._xrEmbodiedVisibility.clear();
  },
  _applyXRViewVisibility() {
    const shouldHide = flock._xrSessionActive && flock._xrViewMode === 'embody';
    if (!shouldHide) {
      flock._restoreXREmbodiedVisibility();
      return;
    }

    const target = flock._xrFollowTarget;
    if (!target || target.isDisposed?.()) return;
    const hierarchy = [target, ...(target.getChildMeshes?.(false) ?? [])];
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
    const heading = flock._xrTargetHeading();
    const turned =
      isWatch &&
      heading !== null &&
      flock._xrFollowLastHeading !== null &&
      Math.abs(flock._wrapAngle(heading - flock._xrFollowLastHeading)) > HEADING_EPSILON;

    if (
      flock.BABYLON.Vector3.DistanceSquared(position, flock._xrFollowLastPosition) > 0.0001 ||
      turned
    ) {
      const delta = position.subtract(flock._xrFollowLastPosition);
      if (!isWatch) delta.y = 0;
      flock._xrFollowLastMovedAt = now;
      flock._xrFollowLastPosition.copyFrom(position);
      flock._xrFollowLastHeading = heading;
      if (flock._xrCameraMotionMode === 'smooth') {
        if (!isWatch || !flock._applyXRWatchTrail()) xrCamera.position.addInPlace(delta);
        flock._xrFollowSettledPosition.copyFrom(position);
      }
      return;
    }
    if (flock._xrCameraMotionMode !== 'comfort') return;
    if (now - flock._xrFollowLastMovedAt < COMFORT_SETTLE_MS) return;

    if (flock._applyXRWatchTrail()) {
      flock._xrFollowSettledPosition.copyFrom(position);
      return;
    }
    const delta = position.subtract(flock._xrFollowSettledPosition);
    if (delta.lengthSquared() <= 0.000001) return;
    xrCamera.position.addInPlace(delta);
    flock._xrFollowSettledPosition.copyFrom(position);
  },
  async initializeXR(mode) {
    if (flock.xrHelper) return; // Avoid reinitializing

    patchEmulatorOffsetReferenceSpace();
    flock._xrMode = mode;
    flock._syncXRFollowTargetFromCamera();
    flock._applyXRDefaults(mode);

    if (mode === 'VR') {
      flock.xrHelper = await flock.scene.createDefaultXRExperienceAsync({
        outputCanvasOptions: flock._xrCanvasOptions(),
      });
    } else if (mode === 'AR') {
      flock.xrHelper = await flock.scene.createDefaultXRExperienceAsync({
        outputCanvasOptions: flock._xrCanvasOptions(),
        uiOptions: {
          sessionMode: 'immersive-ar',
        },
      });
    } else if (mode === 'MAGIC_WINDOW') {
      let camera = flock.scene.activeCamera;
      if (!camera.inputs.attached.deviceOrientation) {
        camera.inputs.addDeviceOrientation();
      }
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
    flock.uiPlane.material.disableDepthWrite = true;
    flock.uiPlane.material.disableLighting = true;

    // Removal fires before the grip is disposed, so reparenting here is safe.
    flock._xrUIControllerObserver = flock.xrHelper.input.onControllerAddedObservable.add(() =>
      flock._applyXRUIPlacement()
    );
    flock._xrUIControllerRemovedObserver = flock.xrHelper.input.onControllerRemovedObservable.add(
      () => flock._applyXRUIPlacement()
    );
    flock._applyXRUIPlacement();

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
  _cameraBackgroundNeedsMirror() {
    return (
      flock._xrSessionActive && flock._xrMode === 'VR' && flock._cameraBackgroundFacing === 'user'
    );
  },
  _disposeCameraBackgroundLayer() {
    const layer = flock._cameraBackgroundLayer;
    if (!layer) return;
    flock._cameraBackgroundLayer = null;
    // Layer.dispose() takes its texture with it, and the mirror may be about to adopt it.
    layer.texture = null;
    layer.dispose();
  },
  _disposeXRMirror() {
    const mirror = flock._xrMirror;
    if (!mirror) return;
    flock._xrMirror = null;
    mirror.material?.dispose();
    mirror.dispose();
  },
  _disposeCameraBackground() {
    // Strands any webcam request still starting up.
    flock._cameraBackgroundRequest = (flock._cameraBackgroundRequest ?? 0) + 1;
    flock._disposeCameraBackgroundLayer();
    flock._disposeXRMirror();
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
  },
  // A background layer is screen space, so both eyes get identical pixels and the feed has no
  // stereo depth at all: in VR it reads as pressed against the face. A plane in the scene doesn't.
  _showXRMirror(texture) {
    if (flock._xrMirror || !flock.scene) return;

    const size = texture.getSize?.();
    const aspect = size?.width && size?.height ? size.width / size.height : XR_MIRROR_ASPECT;
    const mirror = flock.BABYLON.MeshBuilder.CreatePlane(
      'xrCameraMirror',
      { width: XR_MIRROR_WIDTH, height: XR_MIRROR_WIDTH / aspect },
      flock.scene
    );
    const material = new flock.BABYLON.StandardMaterial('xrCameraMirrorMaterial', flock.scene);
    material.disableLighting = true;
    material.emissiveTexture = texture;
    mirror.material = material;
    mirror.isPickable = false;
    mirror.applyFog = false;
    flock.glowLayer?.addExcludedMesh?.(mirror);

    flock._xrMirror = mirror;
    flock._positionXRMirror();
  },
  // World-locked once placed, so the viewer can turn away from it like a mirror on a wall.
  _positionXRMirror() {
    const mirror = flock._xrMirror;
    const xrCamera = flock.xrHelper?.baseExperience?.camera;
    if (!mirror || !xrCamera?.position) return;

    const forward = xrCamera.getDirection(flock.BABYLON.Vector3.Forward());
    forward.y = 0;
    if (forward.lengthSquared() < 1e-6) forward.copyFrom(flock.BABYLON.Vector3.Forward());
    forward.normalize();

    const distance = flock._xrTuning('xm', XR_MIRROR_DISTANCE, 0.5, 10);
    mirror.position.set(
      xrCamera.position.x + forward.x * distance,
      xrCamera.position.y,
      xrCamera.position.z + forward.z * distance
    );
    // A plane faces down its own -Z, so matching the viewer's heading turns it back on them.
    mirror.rotation.set(0, Math.atan2(forward.x, forward.z), 0);
  },
  _applyCameraBackground() {
    const texture = flock._cameraBackgroundTexture;
    if (!texture) return;
    if (flock._cameraBackgroundNeedsMirror()) {
      flock._disposeCameraBackgroundLayer();
      flock._showXRMirror(texture);
    } else {
      flock._disposeXRMirror();
      flock._showCameraBackgroundLayer(texture);
    }
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
