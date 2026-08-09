import { translate } from '../main/translation.js';
import { XRSource } from '../input/xrSource.js';
import { patchEmulatorOffsetReferenceSpace } from '../input/xrEmulatorShim.js';

let flock;

export function setFlockReference(ref) {
  flock = ref;
}

export const flockXRState = {
  _xrCameraMotionMode: 'none',
  _xrViewMode: 'watch',
  _xrFollowTarget: null,
  _xrFollowLastPosition: null,
  _xrFollowSettledPosition: null,
  _xrFollowLastMovedAt: 0,
  _xrWatchPosition: null,
  _xrEmbodiedVisibility: new Map(),
  _xrMode: undefined,
  _teleportAllTargets: false,
  _teleportGroundTarget: true,
  _teleportExplicitTargetNames: new Set(),
  _teleportExplicitTargetMeshes: new Set(),
  _teleportFloorMeshes: new Set(),
  _teleportBlockerMeshes: new Set(),
  _xrViewObserver: null,
  _xrSessionActive: false,
};

export const flockXR = {
  _resetXRState() {
    flock.xrHelper = null;
    for (const [key, value] of Object.entries(flockXRState)) {
      if (value instanceof Map) flock[key] = new Map();
      else if (value instanceof Set) flock[key] = new Set();
      else flock[key] = value;
    }
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
    if (flock._xrViewMode === 'embody' && flock._xrCameraMotionMode === 'teleport') {
      teleportation.attach();
    } else teleportation.detach();
  },
  _applyXRInputState() {
    const projectControls =
      flock._xrViewMode === 'watch' ||
      (flock._xrViewMode === 'embody' && flock._xrCameraMotionMode === 'smooth');
    const inputMode = projectControls ? 'project' : 'disabled';
    flock._xrSource?.setInputMode(inputMode);
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
    if (!targetPosition) return;

    flock._xrFollowLastPosition = targetPosition.clone?.() ?? { ...targetPosition };
    flock._xrFollowSettledPosition = targetPosition.clone?.() ?? { ...targetPosition };
    flock._xrFollowLastMovedAt = performance.now?.() ?? Date.now();

    if (!reposition || !xrCamera?.position) return;
    if (flock._xrViewMode === 'embody') {
      if (!flock._xrWatchPosition) flock._xrWatchPosition = xrCamera.position.clone();
      xrCamera.position.x = targetPosition.x;
      xrCamera.position.z = targetPosition.z;
    }
  },
  _syncXRFollowTargetFromCamera(camera = flock.scene?.activeCamera) {
    const target = camera?.lockedTarget ?? camera?.metadata?.following;
    if (!target) return;
    if (flock._xrFollowTarget !== target) flock._restoreXREmbodiedVisibility();
    flock._xrFollowTarget = target;
    flock._resetXRViewTracking();
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

    if (flock._xrViewMode === 'embody') {
      if (flock._xrCameraMotionMode === 'teleport') {
        flock._syncXREmbodiedTarget();
        return;
      }
      if (flock._xrCameraMotionMode !== 'smooth') return;
    }

    if (flock._xrViewMode === 'watch' && flock._xrCameraMotionMode === 'none') return;
    const position = flock._xrTargetPosition();
    if (!position) return;
    if (!flock._xrFollowLastPosition || !flock._xrFollowSettledPosition) {
      flock._resetXRViewTracking();
      return;
    }

    const now = performance.now?.() ?? Date.now();
    if (flock.BABYLON.Vector3.DistanceSquared(position, flock._xrFollowLastPosition) > 0.0001) {
      const delta = position.subtract(flock._xrFollowLastPosition);
      if (flock._xrViewMode === 'embody') delta.y = 0;
      flock._xrFollowLastMovedAt = now;
      flock._xrFollowLastPosition.copyFrom(position);
      if (flock._xrCameraMotionMode === 'smooth') {
        xrCamera.position.addInPlace(delta);
        flock._xrFollowSettledPosition.copyFrom(position);
      }
      return;
    }
    if (flock._xrCameraMotionMode !== 'comfort') return;
    if (now - flock._xrFollowLastMovedAt < 250) return;

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

    // Create a UI plane for the wrist
    flock.uiPlane = flock.BABYLON.MeshBuilder.CreatePlane('uiPlane', { size: 0.4 }, flock.scene); // Smaller size for wrist UI
    flock.uiPlane.isVisible = false; // Start hidden

    const planeMaterial = new flock.BABYLON.StandardMaterial('uiPlaneMaterial', flock.scene);
    planeMaterial.disableDepthWrite = true;
    flock.uiPlane.material = planeMaterial;

    flock.meshTexture = flock.GUI.AdvancedDynamicTexture.CreateForMesh(flock.uiPlane);

    // Ensure the UI plane follows the wrist (using a controller or camera offset)
    flock.xrHelper.input.onControllerAddedObservable.add((controller) => {
      if (controller.inputSource.handedness === 'left') {
        // Attach the UI plane to the left-hand controller
        flock.uiPlane.parent = controller.grip || controller.pointer;

        // Position the UI plane to simulate a watch
        flock.uiPlane.position.set(0.1, -0.05, 0); // Slightly to the side, closer to the wrist
        flock.uiPlane.rotation.set(Math.PI / 2, 0, 0); // Rotate to face the user
      }
    });

    flock._xrSource = new XRSource(flock.inputManager, {
      xrHelper: flock.xrHelper,
      scene: flock.scene,
    });
    flock._applyXRInputState();
    flock._xrSource.start();
    flock._xrViewObserver = flock.scene.onBeforeRenderObservable.add(() => flock._updateXRView());

    flock._teleportFloorMeshes = new Set();
    flock._teleportBlockerMeshes = new Set();
    flock.scene.onNewMeshAddedObservable.add((mesh) => {
      queueMicrotask(() => {
        flock._syncTeleportMesh(mesh);
        flock._applyXRViewVisibility();
      });
    });
    flock.scene.onMeshRemovedObservable.add((mesh) => {
      flock._unregisterTeleportMesh(mesh);
      flock._xrEmbodiedVisibility.delete(mesh);
    });
    flock._applyTeleportationState();

    // Handle XR state changes
    flock.xrHelper.baseExperience.onStateChangedObservable.add((state) => {
      if (state === flock.BABYLON.WebXRState.ENTERING_XR) {
        flock._xrSource?.start();
        flock.advancedTexture.removeControl(flock.stackPanel);
        flock.meshTexture.addControl(flock.stackPanel);
        flock.uiPlane.isVisible = true;

        // Update alignment for wrist UI
        flock.stackPanel.horizontalAlignment = flock.GUI.Control.HORIZONTAL_ALIGNMENT_LEFT;
        flock.stackPanel.verticalAlignment = flock.GUI.Control.VERTICAL_ALIGNMENT_TOP;

        flock.advancedTexture.isVisible = false; // Hide fullscreen UI
      } else if (state === flock.BABYLON.WebXRState.IN_XR) {
        flock._xrSessionActive = true;
        // Base layer only exists once IN_XR; setting it at ENTERING_XR no-ops.
        flock.xrHelper.baseExperience.sessionManager.fixedFoveation = flock._xrTuning(
          'xf',
          flock.xrFixedFoveation,
          0,
          1
        );
        flock._xrWatchPosition = flock.xrHelper.baseExperience.camera.position.clone();
        flock._resetXRViewTracking({ reposition: true });
        flock._applyXRViewVisibility();
      } else if (state === flock.BABYLON.WebXRState.EXITING_XR) {
        flock._xrSessionActive = false;
        flock._applyXRViewVisibility();
        flock._xrSource?.stop();
        flock.meshTexture.removeControl(flock.stackPanel);
        flock.advancedTexture.addControl(flock.stackPanel);
        flock.uiPlane.isVisible = false;

        // Restore alignment for non-XR
        flock.stackPanel.width = '100%';
        flock.stackPanel.horizontalAlignment = flock.GUI.Control.HORIZONTAL_ALIGNMENT_LEFT;
        flock.stackPanel.verticalAlignment = flock.GUI.Control.VERTICAL_ALIGNMENT_TOP;

        flock.advancedTexture.rootContainer.isVisible = true;
      }
    });
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

    const videoLayer = new flock.BABYLON.Layer('videoLayer', null, flock.scene, true);

    flock.BABYLON.VideoTexture.CreateFromWebCam(
      flock.scene,
      (videoTexture) => {
        videoTexture._invertY = false; // Correct orientation
        videoTexture.uScale = -1; // Flip horizontally for mirror effect
        videoLayer.texture = videoTexture; // Assign the video feed to the layer
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
