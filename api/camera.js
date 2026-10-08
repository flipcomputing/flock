import { hideFromInspector } from '../ui/inspectorVisibility.js';

let flock;

export function setFlockReference(ref) {
  flock = ref;
}

export const flockCamera = {
  _cameraModel: null,
  /* 
                Category: Scene>Camera
        */
  attachCamera(meshName, options = {}) {
    const { radius = 7, front = true, angle = 90, name = 'camera' } = options;

    return new Promise((resolve) => {
      flock.whenModelReady(meshName, async function (mesh) {
        if (!mesh) {
          console.log('Model not loaded:', meshName);
          resolve();
          return;
        }

        if (!mesh.physics) {
          console.log("Can't attach camera to: ", meshName);
          resolve();
          return;
        }
        flock.ensureVerticalConstraint(mesh);

        const existingCamera = flock.scene.activeCamera;
        const isRig = existingCamera?.metadata?.cameraRig;
        const disposedFollowCamera =
          existingCamera instanceof flock.BABYLON.ArcRotateCamera && !isRig;
        existingCamera?.detachControl();
        if (disposedFollowCamera) existingCamera.dispose();
        const previousMain = flock.mainCamera;
        if (
          previousMain &&
          previousMain !== existingCamera &&
          !previousMain.isDisposed() &&
          previousMain.metadata?.following &&
          !previousMain.metadata.cameraRig
        ) {
          previousMain.dispose();
        }

        const facing = flockCamera._followFacing(mesh);
        const anchor = mesh.getAbsolutePosition().clone();

        // savedCamera is the fly camera the gizmo toggles back to, so a follow camera
        // we just replaced must not take its place.
        if (!front && !disposedFollowCamera) {
          flock.savedCamera = isRig ? (flock.defaultCamera ?? existingCamera) : existingCamera;
        }

        const betaRadians = flock.BABYLON.Tools.ToRadians(angle);

        const camera = new flock.BABYLON.ArcRotateCamera(
          name,
          Math.PI / 2,
          betaRadians,
          radius,
          anchor,
          flock.scene
        );

        if (!front) camera.checkCollisions = true;
        flockCamera._configureFollowCamera(camera, { radius, betaRadians });

        camera.lockedTarget = mesh;
        // front looks the character in the face, otherwise sit over its shoulder.
        const horizontalOffset = radius * Math.sin(betaRadians);
        const verticalOffset = radius * Math.cos(betaRadians);
        camera.setPosition(
          anchor
            .add(facing.scale(front ? horizontalOffset : -horizontalOffset))
            .add(flock.BABYLON.Vector3.Up().scale(verticalOffset))
        );

        camera.metadata = camera.metadata || {};
        camera.metadata.following = mesh;
        camera.attachControl(flock.canvas, false);
        flock.scene.activeCamera = camera;
        flock.mainCamera = camera;

        flockCamera._reapplyCameraBindings(camera);

        flock._frameXRFromProjectCamera(camera);
        resolve(camera.name);
      });
    });
  },
  // Upper limit sits at the requested angle itself, since callers place the camera
  // there; lower limit allows orbiting 30° further overhead.
  _configureFollowCamera(camera, { radius, betaRadians }) {
    flockCamera._setFollowCameraLimits(camera, { radius, betaRadians });
    camera.angularSensibilityX = 2000;
    camera.angularSensibilityY = 2000;
    camera.panningSensibility = 0;
    camera.inputs.removeByType('ArcRotateCameraMouseWheelInput');

    camera.inputs.attached.pointers.multiTouchPanAndZoom = false;
    camera.inputs.attached.pointers.multiTouchPanning = false;
    camera.inputs.attached.pointers.pinchZoom = false;
    camera.inputs.attached.pointers.pinchInwards = false;
    camera.inputs.attached.pointers.useNaturalPinchZoom = false;
  },
  _setFollowCameraLimits(camera, { radius, betaRadians }) {
    camera.lowerBetaLimit = Math.max(0.01, betaRadians - Math.PI / 6);
    camera.upperBetaLimit = betaRadians;
    camera.lowerRadiusLimit = radius * 0.6;
    camera.upperRadiusLimit = radius * 1.6;
  },
  // Gizmo drags and glides lift a follow camera's limits so it can go
  // anywhere, then set them again around where it lands.
  _releaseFollowCameraLimits(camera) {
    if (!camera?.metadata?.following) return;
    camera.lowerBetaLimit = 0.01;
    camera.upperBetaLimit = Math.PI - 0.01;
    camera.lowerRadiusLimit = null;
    camera.upperRadiusLimit = null;
  },
  _settleFollowCameraLimits(camera) {
    if (!camera?.metadata?.following || camera.isDisposed()) return;
    flockCamera._setFollowCameraLimits(camera, { radius: camera.radius, betaRadians: camera.beta });
  },
  _configureOrbitCamera(camera) {
    camera.lowerBetaLimit = null;
    camera.upperBetaLimit = null;
    camera.allowUpsideDown = true;
    camera.lowerRadiusLimit = null;
    camera.upperRadiusLimit = null;
    camera.minZ = 0.1;
    camera.wheelDeltaPercentage = 0.01;
  },
  createCamera(
    cameraId,
    {
      type = 'fly',
      target = null,
      position = [0, 0, 0],
      distance = 7,
      up = 30,
      around = 0,
      visible = false,
      callback = null,
    } = {}
  ) {
    if (!cameraId || typeof cameraId !== 'string' || cameraId.length > 100) {
      console.warn('createCamera: invalid id');
      return null;
    }
    let blockKey = cameraId;
    if (cameraId.includes('__')) {
      [cameraId, blockKey] = cameraId.split('__');
    }
    const groupName = cameraId;
    cameraId = flock._reserveName(cameraId);

    if (flock.maxMeshesReached()) return null;
    flock._recycleOldestByKey(blockKey);

    const frame = flockCamera._createCameraFrame(cameraId);
    frame.metadata = frame.metadata || {};
    frame.metadata.shape = 'camera';
    frame.metadata.cameraType = type;
    frame.metadata.showFrame = visible !== false;
    frame.metadata.blockKey = blockKey;
    frame.metadata.sectionOwner = flock._currentSection;
    frame.isVisible = frame.metadata.showFrame;

    flock.setBlockPositionOnMesh(frame, {
      x: position[0],
      y: position[1],
      z: position[2],
      useY: true,
      meshName: frame.name,
    });
    frame.computeWorldMatrix(true);

    flockCamera._buildRigCamera(frame, type, { target, distance, up, around });
    frame.onDisposeObservable.add(() => flockCamera._disposeRigCamera(frame));

    flock.announceMeshReady(frame.name, groupName);
    flock._registerInstance(blockKey, frame.name);

    if (callback) {
      requestAnimationFrame(() => callback());
    }

    return frame.name;
  },
  // The camera.glb geometry, lens down local +Z, centred on the eye. The frame
  // starts empty and takes the model's geometry once it has loaded.
  _createCameraFrame(name) {
    const BABYLON = flock.BABYLON;
    const frame = new BABYLON.Mesh(name, flock.scene);
    flockCamera._loadCameraModel().then((model) => {
      if (frame.isDisposed()) return;
      if (model) flockCamera._applyCameraModel(frame, model);
      else flockCamera._applyFallbackFrame(frame);
    });
    return frame;
  },
  _loadCameraModel() {
    const BABYLON = flock.BABYLON;
    const scene = flock.scene;
    const cached = flockCamera._cameraModel;
    if (cached?.scene === scene && !scene.isDisposed) return cached.promise;

    const promise = BABYLON.SceneLoader.LoadAssetContainerAsync(
      flock.modelPath,
      'camera.glb',
      scene
    )
      .then((container) => {
        const parts = container.meshes.filter((mesh) => mesh.getTotalVertices() > 0);
        container.addAllToScene();
        const merged = BABYLON.Mesh.MergeMeshes(parts, false, true, undefined, false, true);
        merged.rotation.y = Math.PI / 2;
        merged.bakeCurrentTransformIntoVertices();
        const { minimum, maximum } = merged.getBoundingInfo().boundingBox;
        const size = maximum.subtract(minimum);
        const scale = 1.8 / Math.max(size.x, size.y, size.z);
        const centre = minimum.add(maximum).scale(0.5);
        merged.position = centre.scale(-scale);
        merged.scaling.setAll(scale);
        merged.bakeCurrentTransformIntoVertices();

        const model = {
          vertexData: BABYLON.VertexData.ExtractFromMesh(merged),
          subMeshes: merged.subMeshes.map((subMesh) => ({
            materialIndex: subMesh.materialIndex,
            verticesStart: subMesh.verticesStart,
            verticesCount: subMesh.verticesCount,
            indexStart: subMesh.indexStart,
            indexCount: subMesh.indexCount,
          })),
          material: merged.material,
        };
        merged.material = null;
        merged.dispose();
        container.meshes.forEach((mesh) => mesh.dispose(false, false));
        container.transformNodes.forEach((node) => node.dispose());
        flock.releaseContainer(container);
        hideFromInspector(model.material);
        model.material.subMaterials.forEach((material) => hideFromInspector(material));
        return model;
      })
      .catch((error) => {
        console.warn('Camera model failed to load:', error);
        return null;
      });
    flockCamera._cameraModel = { scene, promise };
    return promise;
  },
  _applyCameraModel(frame, model) {
    const BABYLON = flock.BABYLON;
    model.vertexData.applyToMesh(frame);
    frame.subMeshes = [];
    model.subMeshes.forEach(({ materialIndex, verticesStart, verticesCount, indexStart, indexCount }) => {
      new BABYLON.SubMesh(
        materialIndex,
        verticesStart,
        verticesCount,
        indexStart,
        indexCount,
        frame
      );
    });
    const material = hideFromInspector(model.material.clone(`${frame.name}_material`));
    frame.material = material;
    frame.onDisposeObservable.add(() => material.dispose());
    frame.refreshBoundingInfo();
  },
  // A square frustum, wide end forward, for when camera.glb cannot load.
  _applyFallbackFrame(frame) {
    const BABYLON = flock.BABYLON;
    const frustum = BABYLON.MeshBuilder.CreateCylinder(
      `${frame.name}_frustum`,
      { diameterTop: 0.9, diameterBottom: 0.35, height: 0.6, tessellation: 4 },
      flock.scene
    );
    frustum.rotation.set(Math.PI / 2, 0, Math.PI / 4);
    frustum.bakeCurrentTransformIntoVertices();
    BABYLON.VertexData.ExtractFromMesh(frustum).applyToMesh(frame);
    frustum.dispose();

    const material = new BABYLON.StandardMaterial(`${frame.name}_material`, flock.scene);
    material.diffuseColor = new BABYLON.Color3(0.5, 0.5, 0.5);
    material.specularColor = BABYLON.Color3.Black();
    frame.material = material;
    frame.onDisposeObservable.add(() => material.dispose());
  },
  // up: 0 is level with the target, 90 straight overhead. around: world
  // degrees, 0 on the -Z side (the default front view), 90 on the +X side.
  _createTargetCamera(frame, type, targetMesh, { distance, up, around }) {
    const BABYLON = flock.BABYLON;
    targetMesh.computeWorldMatrix(true);
    const targetPoint = targetMesh.getAbsolutePosition().clone();
    const radius = Math.max(Number(distance) || 0, 0.5);
    const betaRadians = Math.min(
      Math.max(BABYLON.Tools.ToRadians(90 - (Number(up) || 0)), 0.01),
      Math.PI - 0.01
    );
    const alphaRadians = BABYLON.Tools.ToRadians((Number(around) || 0) - 90);
    const eye = targetPoint.add(
      new BABYLON.Vector3(
        radius * Math.cos(alphaRadians) * Math.sin(betaRadians),
        radius * Math.cos(betaRadians),
        radius * Math.sin(alphaRadians) * Math.sin(betaRadians)
      )
    );
    frame.setAbsolutePosition(eye);
    frame.computeWorldMatrix(true);

    const camera = new BABYLON.ArcRotateCamera(
      `${frame.name}_camera`,
      0,
      betaRadians,
      radius,
      targetPoint,
      flock.scene
    );

    if (type === 'orbit') {
      flockCamera._configureOrbitCamera(camera);
      camera.setTarget(targetMesh);
    } else {
      flockCamera._configureFollowCamera(camera, { radius, betaRadians });
      camera.lockedTarget = targetMesh;
      camera.metadata = { following: targetMesh };
    }
    camera.setPosition(eye);
    return camera;
  },
  // Whichever side moved since the last frame wins: a moved frame (gizmo, block,
  // glide, group) drives the camera, otherwise the camera's pose is copied back.
  _startCameraRigSync(frame, camera) {
    const BABYLON = flock.BABYLON;
    const scene = flock.scene;
    const isArc = camera instanceof BABYLON.ArcRotateCamera;
    let lastPosition = null;
    let lastRotation = null;
    let wasActive = null;

    const snapshot = () => {
      frame.computeWorldMatrix(true);
      lastPosition = frame.getAbsolutePosition().clone();
      lastRotation = frame.absoluteRotationQuaternion.clone();
    };

    const setFrameWorldRotation = (worldRotation) => {
      let local = worldRotation;
      if (frame.parent) {
        frame.parent.computeWorldMatrix(true);
        const parentRotation =
          frame.parent.absoluteRotationQuaternion ?? BABYLON.Quaternion.Identity();
        local = BABYLON.Quaternion.Inverse(parentRotation).multiply(worldRotation);
      }
      frame.rotationQuaternion = local;
    };

    const pushFrameToCamera = () => {
      const position = frame.getAbsolutePosition();
      if (isArc) {
        camera.setPosition(position.clone());
      } else {
        camera.position.copyFrom(position);
        camera.rotationQuaternion = null;
        camera.rotation.copyFrom(frame.absoluteRotationQuaternion.toEulerAngles());
      }
    };

    const pullCameraToFrame = () => {
      if (isArc) {
        camera.computeWorldMatrix(true);
        const eye = camera.position.clone();
        const direction = camera.getTarget().subtract(eye);
        frame.setAbsolutePosition(eye);
        if (direction.lengthSquared() > 1e-8) {
          const forward = direction.normalize();
          let right = BABYLON.Vector3.Cross(BABYLON.Vector3.Up(), forward);
          if (right.lengthSquared() < 1e-8) right = BABYLON.Vector3.Right();
          right.normalize();
          const up = BABYLON.Vector3.Cross(forward, right);
          setFrameWorldRotation(BABYLON.Quaternion.RotationQuaternionFromAxis(right, up, forward));
        }
      } else {
        frame.setAbsolutePosition(camera.position);
        setFrameWorldRotation(
          camera.rotationQuaternion?.clone() ?? BABYLON.Quaternion.FromEulerVector(camera.rotation)
        );
      }
    };

    snapshot();
    const observer = scene.onBeforeRenderObservable.add(() => {
      if (frame.isDisposed() || camera.isDisposed()) return;
      frame.computeWorldMatrix(true);
      const frameMoved =
        !frame.getAbsolutePosition().equalsWithEpsilon(lastPosition, 1e-4) ||
        !frame.absoluteRotationQuaternion.equalsWithEpsilon(lastRotation, 1e-4);
      if (frameMoved) pushFrameToCamera();
      else pullCameraToFrame();
      snapshot();

      const isActive = scene.activeCamera === camera;
      if (isActive !== wasActive) {
        frame.isVisible = !isActive && frame.metadata.showFrame;
        wasActive = isActive;
        flock._onCameraRigActiveChange?.(frame, isActive);
      }
    });
    frame.metadata.cameraSyncObserver = observer;
  },
  _buildRigCamera(frame, type, { target = null, distance = 7, up = 30, around = 0 } = {}) {
    frame.metadata.cameraType = type;
    frame.metadata.cameraOptions = { target, distance, up, around };
    frame.metadata.cameraTarget = null;
    const cameraType = type === 'fly' || !target ? 'fly' : type;
    // A build still waiting on its target when a newer one starts is dropped.
    const build = (frame.metadata.rigBuild ?? 0) + 1;
    frame.metadata.rigBuild = build;
    frame.metadata.cameraReady = new Promise((resolveCamera) => {
      const finish = (camera) => {
        if (!camera) {
          resolveCamera(null);
          return;
        }
        if (frame.isDisposed() || frame.metadata.rigBuild !== build) {
          camera.dispose();
          resolveCamera(null);
          return;
        }
        camera.metadata = { ...(camera.metadata || {}), cameraRig: true, cameraType, frame };
        frame.metadata.camera = camera;
        flockCamera._startCameraRigSync(frame, camera);
        resolveCamera(camera);
      };

      if (cameraType === 'fly') {
        const camera = new flock.BABYLON.FreeCamera(
          `${frame.name}_camera`,
          frame.getAbsolutePosition().clone(),
          flock.scene
        );
        flock._configureFlyCamera?.(camera);
        camera.minZ = 0.1;
        camera.rotation.copyFrom(frame.absoluteRotationQuaternion.toEulerAngles());
        finish(camera);
        return;
      }

      if (target === '__origin__') {
        const origin = flockCamera._originNode();
        frame.metadata.cameraTarget = origin;
        finish(flockCamera._createTargetCamera(frame, cameraType, origin, { distance, up, around }));
        return;
      }

      flock.whenModelReady(target, (targetMesh) => {
        if (!targetMesh || frame.isDisposed()) {
          finish(null);
          return;
        }
        frame.metadata.cameraTarget = targetMesh;
        finish(
          flockCamera._createTargetCamera(frame, cameraType, targetMesh, {
            distance,
            up,
            around,
          })
        );
      });
    });
    return frame.metadata.cameraReady;
  },
  _originNode() {
    const scene = flock.scene;
    const existing = scene.getTransformNodeByName('__origin__');
    if (existing && !existing.isDisposed()) return existing;
    const origin = new flock.BABYLON.TransformNode('__origin__', scene);
    origin.doNotSerialize = true;
    return hideFromInspector(origin);
  },
  async updateCameraRig(frameName, options = {}) {
    const frame = flock.scene?.getMeshByName(frameName);
    if (frame?.metadata?.shape !== 'camera') return;
    const override = flock._editorCameraOverride;
    const previewing = !!override?.isPreviewing?.(frame);
    if (
      !previewing &&
      frame.metadata.camera &&
      flock.scene.activeCamera === frame.metadata.camera
    ) {
      frame.metadata.reactivateCamera = true;
    }
    flockCamera._disposeRigCamera(frame, { rebuilding: true });
    const camera = await flockCamera._buildRigCamera(frame, frame.metadata.cameraType, {
      ...frame.metadata.cameraOptions,
      ...options,
    });
    if (camera && previewing) {
      override.previewRebuilt?.(frame, camera);
    } else if (camera && frame.metadata.reactivateCamera) {
      frame.metadata.reactivateCamera = false;
      flockCamera._setProjectCamera(camera);
    }
  },
  // Distance, up and around of an eye point from a target, as the follow and
  // orbit camera blocks store them (see _createTargetCamera).
  cameraOffsetFromTarget(target, eye) {
    if (typeof target === 'string') {
      target = flock.scene?.getMeshByName(target)?.metadata?.cameraTarget;
    }
    if (!target || target.isDisposed()) return null;
    target.computeWorldMatrix(true);
    const offset = eye.subtract(target.getAbsolutePosition());
    const distance = offset.length();
    if (distance < 1e-6) return null;
    const { ToDegrees } = flock.BABYLON.Tools;
    const up = 90 - ToDegrees(Math.acos(Math.min(Math.max(offset.y / distance, -1), 1)));
    const around = (ToDegrees(Math.atan2(offset.z, offset.x)) + 90 + 360) % 360;
    return { distance, up, around };
  },
  _disposeRigCamera(frame, { rebuilding = false } = {}) {
    const scene = flock.scene;
    const camera = frame.metadata?.camera;
    if (frame.metadata?.cameraSyncObserver) {
      scene?.onBeforeRenderObservable.remove(frame.metadata.cameraSyncObserver);
      frame.metadata.cameraSyncObserver = null;
    }
    if (frame.metadata) frame.metadata.camera = null;
    if (!camera || camera.isDisposed()) return;
    flock._onCameraRigActiveChange?.(frame, false);
    flock._editorCameraOverride?.cameraDisposed?.(camera, { rebuilding });
    if (scene?.activeCamera === camera) {
      const fallback =
        flock.mainCamera && !flock.mainCamera.isDisposed() ? flock.mainCamera : flock.defaultCamera;
      flockCamera._activateCamera(fallback);
    }
    if (flock.savedCamera === camera) flock.savedCamera = flock.defaultCamera;
    camera.dispose();
  },
  setCameraFrameVisible(frameName, visible) {
    const frame = flock.scene?.getMeshByName(frameName);
    if (!frame?.metadata || frame.metadata.shape !== 'camera') return;
    frame.metadata.showFrame = !!visible;
    frame.isVisible =
      frame.metadata.showFrame && flock.scene.activeCamera !== frame.metadata.camera;
  },
  async _resolveCamera(name) {
    const scene = flock.scene;
    if (!scene || !name) return null;
    const namedCamera = scene.getCameraByName(name);
    if (namedCamera && !namedCamera.metadata?.cameraRig) return namedCamera;

    const frame = await new Promise((resolve) => flock.whenModelReady(name, resolve));
    if (!frame) return null;
    if (frame.metadata?.cameraReady) return await frame.metadata.cameraReady;
    return frame instanceof flock.BABYLON.Camera ? frame : null;
  },
  // Glide a camera onto another camera's position (and, for a fly camera, its
  // rotation). Follow/orbit cameras keep facing their target, so they glide
  // around it instead.
  async _glideCameraTo(
    source,
    toFrame,
    { offset = null, duration = 1, easing = 'Linear', reverse = false, loop = false } = {}
  ) {
    const BABYLON = flock.BABYLON;
    const scene = flock.scene;
    const toCamera = await toFrame.metadata.cameraReady;
    if (!scene || !source || !toCamera || toCamera.isDisposed()) return;

    toCamera.computeWorldMatrix(true);
    const endPosition = toCamera.globalPosition.clone();
    if (offset) endPosition.addInPlace(offset);
    const endRotation = toCamera.absoluteRotation.clone();

    const camera = source instanceof BABYLON.Camera ? source : source.metadata?.camera;
    const flyFrame =
      source.metadata?.shape === 'camera' && source.metadata.cameraType === 'fly'
        ? source
        : camera?.metadata?.cameraRig && camera.metadata.cameraType === 'fly'
          ? camera.metadata.frame
          : null;

    const fps = 30;
    const frames = fps * (Number(duration) > 0 ? Number(duration) : 1);
    const loopMode =
      loop || reverse
        ? BABYLON.Animation.ANIMATIONLOOPMODE_CYCLE
        : BABYLON.Animation.ANIMATIONLOOPMODE_CONSTANT;
    let ease = null;
    if (easing !== 'Linear' && BABYLON[easing]?.prototype instanceof BABYLON.EasingFunction) {
      ease = new BABYLON[easing]();
      ease.setEasingMode(BABYLON.EasingFunction.EASINGMODE_EASEINOUT);
    }
    const animate = (property, type, from, to) => {
      const animation = new BABYLON.Animation('cameraGlide', property, fps, type, loopMode);
      const keys = [
        { frame: 0, value: from },
        { frame: frames, value: to },
      ];
      if (reverse) keys.push({ frame: frames * 2, value: from });
      animation.setKeys(keys);
      if (ease) animation.setEasingFunction(ease);
      return animation;
    };

    let target;
    let animations;
    let settle = () => {};
    if (camera instanceof BABYLON.ArcRotateCamera) {
      target = camera;
      camera.computeWorldMatrix(true);
      const offsetFromTarget = endPosition.subtract(camera.getTarget());
      const radius = Math.max(offsetFromTarget.length(), 0.01);
      const beta = Math.acos(Math.min(Math.max(offsetFromTarget.y / radius, -1), 1));
      let alpha = Math.atan2(offsetFromTarget.z, offsetFromTarget.x);
      while (alpha - camera.alpha > Math.PI) alpha -= Math.PI * 2;
      while (alpha - camera.alpha < -Math.PI) alpha += Math.PI * 2;
      flockCamera._releaseFollowCameraLimits(camera);
      settle = () => flockCamera._settleFollowCameraLimits(camera);
      const float = BABYLON.Animation.ANIMATIONTYPE_FLOAT;
      animations = [
        animate('alpha', float, camera.alpha, alpha),
        animate('beta', float, camera.beta, beta),
        animate('radius', float, camera.radius, radius),
      ];
    } else {
      target = flyFrame ?? camera;
      if (!target) return;
      target.computeWorldMatrix(true);
      // Position and rotation animate in the target's own (parent) space.
      let localEndPosition = endPosition;
      let localEndRotation = endRotation;
      const parent = target.parent;
      if (parent) {
        parent.computeWorldMatrix(true);
        const toLocal = parent.getWorldMatrix().clone().invert();
        localEndPosition = BABYLON.Vector3.TransformCoordinates(endPosition, toLocal);
        localEndRotation = BABYLON.Quaternion.Inverse(parent.absoluteRotationQuaternion).multiply(
          endRotation
        );
      }
      const startPosition = target.position.clone();
      const startRotation =
        target.rotationQuaternion?.clone() ?? BABYLON.Quaternion.FromEulerVector(target.rotation);
      target.rotationQuaternion = startRotation.clone();
      animations = [
        animate(
          'position',
          BABYLON.Animation.ANIMATIONTYPE_VECTOR3,
          startPosition,
          localEndPosition
        ),
        animate(
          'rotationQuaternion',
          BABYLON.Animation.ANIMATIONTYPE_QUATERNION,
          startRotation,
          localEndRotation
        ),
      ];
      // A free camera turns by its Euler rotation, so hand back to that when done.
      if (!flyFrame) {
        settle = () => {
          camera.rotation.copyFrom(camera.rotationQuaternion.toEulerAngles());
          camera.rotationQuaternion = null;
        };
      }
    }

    target.metadata = target.metadata || {};
    target.metadata._cameraGlide?.stop();
    const animatable = scene.beginDirectAnimation(
      target,
      animations,
      0,
      reverse ? frames * 2 : frames,
      loop
    );
    target.metadata._cameraGlide = animatable;
    await new Promise((resolve) => {
      animatable.onAnimationEndObservable.add(() => {
        if (target.metadata._cameraGlide === animatable) target.metadata._cameraGlide = null;
        settle();
        resolve();
      });
    });
  },

  async switchCamera(name) {
    const camera = await flockCamera._resolveCamera(name);
    if (!camera || camera.isDisposed()) {
      console.warn('switchCamera: no camera called', name);
      return;
    }
    flockCamera._setProjectCamera(camera);
  },
  // The editor's fly/orbit/preview views own the screen while active; a project
  // switch then only changes the camera they return to.
  _setProjectCamera(camera) {
    const override = flock._editorCameraOverride;
    if (override?.active()) {
      override.setReturnCamera(camera);
      return;
    }
    flockCamera._activateCamera(camera);
  },
  _activateCamera(camera) {
    const scene = flock.scene;
    if (!scene || !camera || camera.isDisposed()) return;
    const current = scene.activeCamera;
    if (current === camera) return;
    if (flock.savedCamera === camera) flock.savedCamera = flock.defaultCamera ?? current;
    current?.detachControl();
    scene.activeCamera = camera;
    camera.attachControl(flock.canvas, false);
    flockCamera._reapplyCameraBindings(camera);
    flock._frameXRFromProjectCamera?.(camera);
  },
  // The character's own forward, flattened. mesh.rotation stops tracking the mesh once
  // physics or a rotate block writes a quaternion, so read the live world matrix.
  _followFacing(mesh) {
    mesh.computeWorldMatrix(true);
    const facing = mesh.forward.negate();
    facing.y = 0;
    return facing.lengthSquared() > 1e-6
      ? facing.normalize()
      : new flock.BABYLON.Vector3(0, 0, -1);
  },
  ensureVerticalConstraint(mesh) {
    if (!mesh || !flock.scene) return;
    if (!mesh.physics) return;
    mesh.metadata = mesh.metadata || {};
    if (mesh.metadata.constraint) return; // unset this before calling when swapping meshes

    const scene = flock.scene;

    // --- find or create a reusable constraint box (anchor) ---
    let constraintBox =
      (flock._constraintBox && !flock._constraintBox.isDisposed() && flock._constraintBox) ||
      (scene.meshes || []).find(
        (m) =>
          m && typeof m.name === 'string' && m.name.startsWith('Constraint_') && !m.isDisposed()
      );

    if (!constraintBox) {
      // create a new hidden static box
      constraintBox = flock.BABYLON.MeshBuilder.CreateBox(
        'Constraint',
        { height: 1, width: 1, depth: 1 },
        scene
      );
      constraintBox.metadata = constraintBox.metadata || {};
      constraintBox.metadata.blockKey = constraintBox.name;
      constraintBox.metadata.sectionOwner = flock._currentSection;
      constraintBox.name = constraintBox.name + '_' + constraintBox.uniqueId;
      constraintBox.isVisible = false;
      constraintBox.isPickable = false;
      hideFromInspector(constraintBox);
      constraintBox.material =
        constraintBox.material || new flock.BABYLON.StandardMaterial('staticMaterial', scene);

      const body = new flock.BABYLON.PhysicsBody(
        constraintBox,
        flock.BABYLON.PhysicsMotionType.STATIC,
        false,
        scene
      );
      const shape = new flock.BABYLON.PhysicsShapeBox(
        flock.BABYLON.Vector3.Zero(),
        new flock.BABYLON.Quaternion(0, 0, 0, 1),
        flock.BABYLON.Vector3.One(),
        scene
      );
      body.shape = shape;
      body.setMassProperties({ mass: 1 });
      flock.applyBounciness(body, constraintBox);
      constraintBox.physics = body;

      // cache it for reuse
      flock._constraintBox = constraintBox;
    } else {
      // ensure reused box still has a valid static body + shape
      if (!constraintBox.physics) {
        const body = new flock.BABYLON.PhysicsBody(
          constraintBox,
          flock.BABYLON.PhysicsMotionType.STATIC,
          false,
          scene
        );
        const shape = new flock.BABYLON.PhysicsShapeBox(
          flock.BABYLON.Vector3.Zero(),
          new flock.BABYLON.Quaternion(0, 0, 0, 1),
          flock.BABYLON.Vector3.One(),
          scene
        );
        body.shape = shape;
        body.setMassProperties({ mass: 1 });
        flock.applyBounciness(body, constraintBox);
        constraintBox.physics = body;
      } else if (!constraintBox.physics.shape) {
        constraintBox.physics.shape = new flock.BABYLON.PhysicsShapeBox(
          flock.BABYLON.Vector3.Zero(),
          new flock.BABYLON.Quaternion(0, 0, 0, 1),
          flock.BABYLON.Vector3.One(),
          scene
        );
      }
    }

    // position the anchor under the mesh out of the way
    const meshWorldPos = mesh.getAbsolutePosition
      ? mesh.getAbsolutePosition()
      : mesh.position.clone();
    constraintBox.position.copyFrom(meshWorldPos);
    constraintBox.position.y += -4; // keep original -4 offset
    constraintBox.computeWorldMatrix(true);

    if (constraintBox.physics) {
      if (!constraintBox.rotationQuaternion) {
        constraintBox.rotationQuaternion = flock.BABYLON.Quaternion.Identity();
      }
      constraintBox.physics.disablePreStep = false;
      constraintBox.physics.setTargetTransform(
        constraintBox.position,
        constraintBox.rotationQuaternion
      );
    }

    // --- add the vertical constraint (lock roll & pitch; allow yaw) ---
    const constraint = new flock.BABYLON.Physics6DoFConstraint(
      {
        axisA: new flock.BABYLON.Vector3(1, 0, 0),
        axisB: new flock.BABYLON.Vector3(1, 0, 0),
        perpAxisA: new flock.BABYLON.Vector3(0, 1, 0),
        perpAxisB: new flock.BABYLON.Vector3(0, 1, 0),
      },
      [
        {
          axis: flock.BABYLON.PhysicsConstraintAxis.ANGULAR_X,
          minLimit: 0,
          maxLimit: 0,
        },
        {
          axis: flock.BABYLON.PhysicsConstraintAxis.ANGULAR_Z,
          minLimit: 0,
          maxLimit: 0,
        },
      ],
      scene
    );

    try {
      mesh.physics.addConstraint(constraintBox.physics, constraint);
      mesh.metadata.constraint = true;
      mesh.metadata.uprightConstraint = constraint;
    } catch (e) {
      console.warn('[ensureVerticalConstraint] addConstraint failed:', e);
    }

    flock.ensurePostPhysicsUpkeep(mesh);
  },
  getCamera() {
    return '__active_camera__';
  },
  _normalizeKeyCode(inputKey) {
    const keyMap = {
      ArrowLeft: 37,
      ArrowUp: 38,
      ArrowRight: 39,
      ArrowDown: 40,
      ' ': 32,
      ',': 188,
      '.': 190,
      '/': 191,
    };

    if (typeof inputKey === 'number') {
      return inputKey;
    }

    if (typeof inputKey !== 'string') {
      return null;
    }

    if (/^[0-9]$/.test(inputKey)) {
      return inputKey.charCodeAt(0);
    }

    if (/^\d{2,}$/.test(inputKey)) {
      return Number(inputKey);
    }

    if (keyMap[inputKey] != null) {
      return keyMap[inputKey];
    }

    if (/^[a-z]$/i.test(inputKey)) {
      return inputKey.toUpperCase().charCodeAt(0);
    }

    return null;
  },
  _applyCameraBinding(camera, normalizedKey, action) {
    if (camera.keysRotateLeft) {
      switch (action) {
        case 'moveUp':
          camera.keysUp = [normalizedKey];
          break;
        case 'moveDown':
          camera.keysDown = [normalizedKey];
          break;
        case 'moveLeft':
          camera.keysLeft = [normalizedKey];
          break;
        case 'moveRight':
          camera.keysRight = [normalizedKey];
          break;
        case 'rotateUp':
          camera.keysRotateUp = [normalizedKey];
          break;
        case 'rotateDown':
          camera.keysRotateDown = [normalizedKey];
          break;
        case 'rotateLeft':
          camera.keysRotateLeft = [normalizedKey];
          break;
        case 'rotateRight':
          camera.keysRotateRight = [normalizedKey];
          break;
      }
    } else {
      switch (action) {
        case 'rotateLeft':
        case 'moveLeft':
          camera.keysLeft = [normalizedKey];
          break;
        case 'rotateRight':
        case 'moveRight':
          camera.keysRight = [normalizedKey];
          break;
        case 'moveUp':
        case 'rotateUp':
          camera.keysUp = [normalizedKey];
          break;
        case 'moveDown':
        case 'rotateDown':
          camera.keysDown = [normalizedKey];
          break;
      }
    }
  },
  _reapplyCameraBindings(camera) {
    if (!flock._cameraControlBindings) return;
    for (const { normalizedKey, action } of flock._cameraControlBindings) {
      this._applyCameraBinding(camera, normalizedKey, action);
    }
  },
  cameraControl(key, action) {
    const normalizedKey = this._normalizeKeyCode(key);
    if (normalizedKey == null) {
      console.warn('Unsupported camera control key:', key);
      return;
    }

    if (!flock._cameraControlBindings) {
      flock._cameraControlBindings = [];
    }
    flock._cameraControlBindings = flock._cameraControlBindings.filter((b) => b.action !== action);
    flock._cameraControlBindings.push({ normalizedKey, action });

    if (flock.scene.activeCamera) {
      this._applyCameraBinding(flock.scene.activeCamera, normalizedKey, action);
    } else {
      console.error('No active camera found in the scene.');
    }
  },
};
