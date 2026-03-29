import { blockNames, modelAnimationNames } from "../config.js";

let flock;

export function setFlockReference(ref) {
  flock = ref;
}

const determineDesiredShapeType = (animationName) => {
  if (animationName === "Fly") return "horizontal-fly";
  if (animationName === "Fall") return "horizontal-fall";
  if (animationName === "Sitting" || animationName === "Sit_Down") {
    return "sitting";
  }
  return "vertical";
};

const updateCapsuleShapeForAnimation = (physicsMesh, animationName) => {
  if (
    !physicsMesh ||
    !physicsMesh.physics ||
    !physicsMesh.physics.shape ||
    !(
      flock?.BABYLON?.PhysicsShapeCapsule &&
      physicsMesh.physics.shape instanceof flock.BABYLON.PhysicsShapeCapsule
    )
  ) {
    return;
  }

  const desiredShapeType = determineDesiredShapeType(animationName);
  if (!physicsMesh.metadata) physicsMesh.metadata = {};

  if (physicsMesh.metadata.currentPhysicsShapeType === desiredShapeType) {
    return;
  }

  const motionType = physicsMesh.physics.getMotionType();
  const massProps = physicsMesh.physics.getMassProperties();
  const disablePreStep = physicsMesh.physics.disablePreStep;

  let newShape;
  if (desiredShapeType === "horizontal-fly") {
    newShape = flock.createHorizontalCapsuleFromBoundingBox(
      physicsMesh,
      flock.scene,
      0,
    );
  } else if (desiredShapeType === "horizontal-fall") {
    newShape = flock.createHorizontalCapsuleFromBoundingBox(
      physicsMesh,
      flock.scene,
      0,
    );
  } else if (desiredShapeType === "sitting") {
    newShape = flock.createSittingCapsuleFromBoundingBox(
      physicsMesh,
      flock.scene,
    );
  } else {
    newShape = flock.createCapsuleFromBoundingBox(physicsMesh, flock.scene);
  }

  physicsMesh.physics.shape = newShape;
  physicsMesh.physics.setMotionType(motionType);
  physicsMesh.physics.setMassProperties(massProps);
  physicsMesh.physics.disablePreStep = disablePreStep;

  physicsMesh.metadata.currentPhysicsShapeType = desiredShapeType;
};

export const flockAnimate = {
  async playAnimation(
    meshName,
    { animationName, loop = false, restart = true } = {},
  ) {
    return new Promise((resolve) => {
      flock.whenModelReady(meshName, async (mesh) => {
        if (!mesh) {
          console.error(`Mesh "${meshName}" not found.`);
          resolve();
          return;
        }
        const modelName = mesh.metadata?.modelName;

        if (modelAnimationNames.includes(modelName)) {
          await flock._playAnimationModel(meshName, {
            animationName,
            loop,
            restart,
          });
        } else if (flock.separateAnimations) {
          await flock._playAnimationLoad(meshName, {
            animationName,
            loop,
            restart,
          });
        } else {
          await flock._playAnimationModel(meshName, {
            animationName,
            loop,
            restart,
          });
        }
        resolve();
      });
    });
  },
  switchAnimation(
    meshName,
    { animationName, loop = true, restart = false } = {},
  ) {
    return new Promise((resolve) => {
      flock.whenModelReady(meshName, (mesh) => {
        flock.switchToAnimation(
          flock.scene,
          mesh,
          animationName,
          loop,
          restart,
        );
        resolve();
      });
    });
  },
  async rotateAnim(
    meshName,
    {
      x = 0,
      y = 0,
      z = 0,
      duration = 1,
      reverse = false,
      loop = false,
      easing = "Linear",
    } = {},
  ) {
    const rawDuration = Number(duration);
    duration =
      Number.isFinite(rawDuration) && rawDuration > 0 ? rawDuration : 1;
    const instant = Number.isFinite(rawDuration) && rawDuration === 0;
    x = Number.isFinite(Number(x)) ? Number(x) : 0;
    y = Number.isFinite(Number(y)) ? Number(y) : 0;
    z = Number.isFinite(Number(z)) ? Number(z) : 0;

    return new Promise((resolve) => {
      flock.whenModelReady(meshName, async (mesh) => {
        if (!mesh) {
          resolve();
          return;
        }

        if (instant) {
          const targetRotation = new flock.BABYLON.Vector3(
            x * (Math.PI / 180),
            y * (Math.PI / 180),
            z * (Math.PI / 180),
          );
          mesh.rotation = targetRotation;
          mesh.computeWorldMatrix(true);

          if (mesh.physics && mesh.physics._pluginData?.hpBodyId) {
            mesh.physics.setTargetTransform(
              mesh.absolutePosition,
              mesh.absoluteRotationQuaternion ||
                flock.BABYLON.Quaternion.FromEulerVector(mesh.rotation),
            );
          }

          resolve();
          return;
        }

        const children = mesh.getChildMeshes();

        const childData = children.map((c) => ({
          mesh: c,
          localPos: c.position.clone(),
          localRot: c.rotation.clone(),
          localQuat: c.rotationQuaternion ? c.rotationQuaternion.clone() : null,
        }));

        const startRotation = mesh.rotation.clone();
        const targetRotation = new flock.BABYLON.Vector3(
          x * (Math.PI / 180),
          y * (Math.PI / 180),
          z * (Math.PI / 180),
        );

        const fps = 30;
        const frames = fps * duration;

        const rotateAnimation = new flock.BABYLON.Animation(
          "rotate",
          "rotation",
          fps,
          flock.BABYLON.Animation.ANIMATIONTYPE_VECTOR3,
          loop
            ? flock.BABYLON.Animation.ANIMATIONLOOPMODE_CYCLE
            : flock.BABYLON.Animation.ANIMATIONLOOPMODE_CONSTANT,
        );

        const rotateKeys = [
          { frame: 0, value: startRotation },
          { frame: frames, value: targetRotation },
          ...(reverse ? [{ frame: frames * 2, value: startRotation }] : []),
        ];
        rotateAnimation.setKeys(rotateKeys);

        if (
          easing !== "Linear" &&
          typeof flock.BABYLON[easing] === "function" &&
          flock.BABYLON[easing].prototype instanceof
            flock.BABYLON.EasingFunction
        ) {
          const ease = new flock.BABYLON[easing]();
          ease.setEasingMode(flock.BABYLON.EasingFunction.EASINGMODE_EASEINOUT);
          rotateAnimation.setEasingFunction(ease);
        }

        const syncObserver = flock.scene.onAfterAnimationsObservable.add(() => {
          mesh.computeWorldMatrix(true);
          childData.forEach((data) => data.mesh.computeWorldMatrix(true));

          if (mesh.physics && mesh.physics._pluginData?.hpBodyId) {
            mesh.physics.setTargetTransform(
              mesh.absolutePosition,
              mesh.absoluteRotationQuaternion ||
                flock.BABYLON.Quaternion.FromEulerVector(mesh.rotation),
            );
          }
        });

        const animatable = flock.scene.beginDirectAnimation(
          mesh,
          [rotateAnimation],
          0,
          reverse ? frames * 2 : frames,
          loop,
        );

        animatable.onAnimationEndObservable.add(() => {
          flock.scene.onAfterAnimationsObservable.remove(syncObserver);
          if (reverse) {
            mesh.rotation = startRotation.clone();
          } else {
            mesh.rotation = targetRotation.clone();
          }
          resolve();
        });
      });
    });
  },
  async glideTo(
    meshName,
    {
      x = 0,
      y = 0,
      z = 0,
      duration = 1,
      reverse = false,
      loop = false,
      easing = "Linear",
    } = {},
  ) {
    duration =
      Number.isFinite(Number(duration)) && Number(duration) > 0
        ? Number(duration)
        : 1;
    x = Number.isFinite(Number(x)) ? Number(x) : 0;
    z = Number.isFinite(Number(z)) ? Number(z) : 0;
    if (y !== "__ground__level__") {
      y = Number.isFinite(Number(y)) ? Number(y) : 0;
    }

    await flock.whenModelReady(meshName, async (mesh) => {
      if (!mesh) return;

      if (mesh.metadata?._activeGlide) {
        mesh.metadata._activeGlide.stop();
        flock.scene.onAfterAnimationsObservable.remove(
          mesh.metadata._glideObserver,
        );
      }

      const groundLevelSentinel = -999999;
      const numericY = typeof y === "string" ? Number(y) : y;
      if (y === "__ground__level__" || numericY === groundLevelSentinel) {
        await flock.waitForGroundReady();
        y = flock.getGroundLevelAt(x, z);
      }

      const children = mesh.getChildMeshes();
      const isPhysicsActive =
        mesh.physics &&
        mesh.metadata?.physicsType !== "NONE" &&
        mesh.physics._pluginData?.hpBodyId;

      if (isPhysicsActive) {
        mesh.physics.disablePreStep = false;
        mesh.physics.setPrestepType(flock.BABYLON.PhysicsPrestepType.ACTION);
        mesh.physics.setMotionType(flock.BABYLON.PhysicsMotionType.ANIMATED);
      }

      const startAnchor = flock._getAnchor(mesh);
      const targetAnchor = new flock.BABYLON.Vector3(x, y, z);
      const anchorDelta = targetAnchor.subtract(
        new flock.BABYLON.Vector3(startAnchor.x, startAnchor.y, startAnchor.z),
      );
      const startPosition = mesh.position.clone();
      const endPosition = startPosition.add(anchorDelta);
      const fps = 30;
      const frames = fps * duration;

      const glideAnimation = new flock.BABYLON.Animation(
        "glide",
        "position",
        fps,
        flock.BABYLON.Animation.ANIMATIONTYPE_VECTOR3,
        loop || reverse
          ? flock.BABYLON.Animation.ANIMATIONLOOPMODE_CYCLE
          : flock.BABYLON.Animation.ANIMATIONLOOPMODE_CONSTANT,
      );

      const glideKeys = [
        { frame: 0, value: startPosition },
        { frame: frames, value: endPosition },
      ];
      if (reverse) glideKeys.push({ frame: frames * 2, value: startPosition });
      glideAnimation.setKeys(glideKeys);

      if (
        easing !== "Linear" &&
        typeof flock.BABYLON[easing] === "function" &&
        flock.BABYLON[easing].prototype instanceof flock.BABYLON.EasingFunction
      ) {
        let ease = new flock.BABYLON[easing]();
        ease.setEasingMode(flock.BABYLON.EasingFunction.EASINGMODE_EASEINOUT);
        glideAnimation.setEasingFunction(ease);
      }

      const syncObserver = flock.scene.onAfterAnimationsObservable.add(() => {
        mesh.computeWorldMatrix(true);
        children.forEach((c) => c.computeWorldMatrix(true));

        if (isPhysicsActive) {
          mesh.physics.setTargetTransform(
            mesh.absolutePosition,
            mesh.absoluteRotationQuaternion ||
              flock.BABYLON.Quaternion.FromEulerVector(mesh.rotation),
          );
        }
      });

      const animatable = flock.scene.beginDirectAnimation(
        mesh,
        [glideAnimation],
        0,
        reverse ? frames * 2 : frames,
        loop,
      );

      mesh.metadata = mesh.metadata || {};
      mesh.metadata._activeGlide = animatable;
      mesh.metadata._glideObserver = syncObserver;

      return new Promise((resolve) => {
        animatable.onAnimationEndObservable.add(() => {
          flock.scene.onAfterAnimationsObservable.remove(syncObserver);
          if (mesh.metadata._activeGlide === animatable) {
            mesh.metadata._activeGlide = null;
            mesh.metadata._glideObserver = null;
          }
          if (!reverse && !loop) mesh.position = endPosition.clone();
          resolve();
        });
      });
    });
  },
  async glideToObject(
    meshName1,
    meshName2,
    {
      offsetX = 0,
      offsetY = 0,
      offsetZ = 0,
      offsetSpace = "local",
      duration = 1,
      reverse = false,
      loop = false,
      easing = "Linear",
    } = {},
  ) {
    const mesh1 = await flock.whenModelReady(meshName1);
    if (!mesh1) return;

    const mesh2 = await flock.whenModelReady(meshName2);
    if (!mesh2) return;

    const { x: baseX, y: baseY, z: baseZ } = flock._getAnchor(mesh2);

    let worldOffsetX = 0;
    let worldOffsetY = 0;
    let worldOffsetZ = 0;

    if (offsetX !== 0 || offsetY !== 0 || offsetZ !== 0) {
      if (offsetSpace === "world") {
        worldOffsetX = offsetX;
        worldOffsetY = offsetY;
        worldOffsetZ = offsetZ;
      } else {
        mesh2.computeWorldMatrix(true);
        const localOffset = new flock.BABYLON.Vector3(
          offsetX,
          offsetY,
          offsetZ,
        );
        const worldOffset = flock.BABYLON.Vector3.TransformNormal(
          localOffset,
          mesh2.getWorldMatrix(),
        );

        worldOffsetX = worldOffset.x;
        worldOffsetY = worldOffset.y;
        worldOffsetZ = worldOffset.z;
      }
    }

    await this.glideTo(meshName1, {
      x: baseX + worldOffsetX,
      y: baseY + worldOffsetY,
      z: baseZ + worldOffsetZ,
      duration,
      reverse,
      loop,
      easing,
    });
  },
  async rotateToObject(
    meshName1,
    meshName2,
    {
      mode = "towards",
      duration = 1,
      reverse = false,
      loop = false,
      easing = "Linear",
    } = {},
  ) {
    const mesh1 = await flock.whenModelReady(meshName1);
    if (!mesh1) return;

    const mesh2 = await flock.whenModelReady(meshName2);
    if (!mesh2) return;

    let targetRotation;
    const normalizedMode = String(mode || "towards").toLowerCase();

    if (normalizedMode === "same_rotation") {
      mesh2.computeWorldMatrix(true);
      const targetQuaternion = new flock.BABYLON.Quaternion();
      mesh2.getWorldMatrix().decompose(undefined, targetQuaternion);

      mesh1.computeWorldMatrix(true);
      let localTargetQuaternion = targetQuaternion;

      if (mesh1.parent?.getWorldMatrix) {
        mesh1.parent.computeWorldMatrix(true);
        const parentRotation = new flock.BABYLON.Quaternion();
        mesh1.parent.getWorldMatrix().decompose(undefined, parentRotation);
        localTargetQuaternion = parentRotation
          .conjugate()
          .multiply(targetQuaternion)
          .normalize();
      }

      const euler = localTargetQuaternion.toEulerAngles();
      targetRotation = {
        x: flock.BABYLON.Tools.ToDegrees(euler.x),
        y: flock.BABYLON.Tools.ToDegrees(euler.y),
        z: flock.BABYLON.Tools.ToDegrees(euler.z),
      };
    } else {
      const p1 = mesh1.getAbsolutePosition?.() ?? mesh1.absolutePosition;
      const p2 = mesh2.getAbsolutePosition?.() ?? mesh2.absolutePosition;
      const dir = p2.subtract(p1);

      if (dir.lengthSquared() === 0) return;

      dir.normalize();
      const q = flock.BABYLON.Quaternion.FromLookDirectionLH(
        dir,
        flock.BABYLON.Axis.Y,
      );
      const euler = q.toEulerAngles();

      targetRotation = {
        x: flock.BABYLON.Tools.ToDegrees(euler.x),
        y: flock.BABYLON.Tools.ToDegrees(euler.y),
        z: flock.BABYLON.Tools.ToDegrees(euler.z),
      };
    }

    await this.rotateAnim(meshName1, {
      ...targetRotation,
      duration,
      reverse,
      loop,
      easing,
    });
  },
  async animateKeyFrames(
    meshName,
    {
      keyframes,
      property,
      easing = "Linear",
      loop = false,
      reverse = false,
    } = {},
  ) {
    let mesh = await flock.whenModelReady(meshName);
    if (!mesh) return;

    // Track active animations by property name to allow simultaneous
    // animations (e.g., moving and changing color at the same time)
    const activeKey = `_activeAnim_${property}`;
    if (mesh.metadata?.[activeKey]) {
      mesh.metadata[activeKey].stop();
    }

    // Material resolution for color/alpha properties
    if (property === "color" || property === "alpha") {
      const findFirstDescendantWithMaterial = (m) => {
        if (m.material) return m;
        const descendants = m.getDescendants();
        for (const descendant of descendants) {
          if (descendant.material) return descendant;
        }
        return null;
      };
      mesh = findFirstDescendantWithMaterial(mesh) || mesh;
    }

    let propertyToAnimate;
    if (property === "color") {
      propertyToAnimate =
        mesh.material?.diffuseColor !== undefined
          ? "material.diffuseColor"
          : "material.albedoColor";
    } else if (property === "alpha") {
      propertyToAnimate = "material.alpha";
      if (mesh.material) {
        mesh.material.transparencyMode =
          flock.BABYLON.Material.MATERIAL_ALPHABLEND;
      }
    } else {
      propertyToAnimate = property;
    }

    const fps = 30;
    const animationType =
      property === "color"
        ? flock.BABYLON.Animation.ANIMATIONTYPE_COLOR3
        : ["position", "rotation", "scaling"].includes(property)
          ? flock.BABYLON.Animation.ANIMATIONTYPE_VECTOR3
          : flock.BABYLON.Animation.ANIMATIONTYPE_FLOAT;

    const keyframeAnimation = new flock.BABYLON.Animation(
      "keyframeAnimation",
      propertyToAnimate,
      fps,
      animationType,
      flock.BABYLON.Animation.ANIMATIONLOOPMODE_CYCLE,
    );

    // Apply the requested easing function
    if (
      easing !== "Linear" &&
      typeof flock.BABYLON[easing] === "function" &&
      flock.BABYLON[easing].prototype instanceof flock.BABYLON.EasingFunction
    ) {
      const ease = new flock.BABYLON[easing]();
      ease.setEasingMode(flock.BABYLON.EasingFunction.EASINGMODE_EASEINOUT);
      keyframeAnimation.setEasingFunction(ease);
    }

    let currentFrame = 0;
    const forwardKeyframes = keyframes.map((keyframe) => {
      let value;
      if (property === "color") {
        value = flock.BABYLON.Color3.FromHexString(keyframe.value);
      } else if (["position", "rotation", "scaling"].includes(property)) {
        if (keyframe.value instanceof flock.BABYLON.Vector3) {
          value =
            property === "rotation"
              ? new flock.BABYLON.Vector3(
                  flock.BABYLON.Tools.ToRadians(keyframe.value.x),
                  flock.BABYLON.Tools.ToRadians(keyframe.value.y),
                  flock.BABYLON.Tools.ToRadians(keyframe.value.z),
                )
              : keyframe.value;
        } else if (typeof keyframe.value === "string") {
          const v = keyframe.value.match(/-?\d+(\.\d+)?/g).map(parseFloat);
          value =
            property === "rotation"
              ? new flock.BABYLON.Vector3(
                  flock.BABYLON.Tools.ToRadians(v[0] || 0),
                  flock.BABYLON.Tools.ToRadians(v[1] || 0),
                  flock.BABYLON.Tools.ToRadians(v[2] || 0),
                )
              : new flock.BABYLON.Vector3(v[0] || 0, v[1] || 0, v[2] || 0);
        }
      } else {
        value = parseFloat(keyframe.value);
      }

      const frame = currentFrame;
      currentFrame += Math.round((keyframe.duration || 1) * fps);
      return { frame, value };
    });

    // Handle smooth looping by returning to the start value
    if (loop && !reverse && forwardKeyframes.length > 0) {
      forwardKeyframes.push({
        frame: currentFrame,
        value: forwardKeyframes[0].value,
      });
      currentFrame += fps;
    }

    const reverseKeyframes = reverse
      ? forwardKeyframes
          .slice(0, -1)
          .reverse()
          .map((kf, i) => ({
            frame: currentFrame + i,
            value: kf.value,
          }))
      : [];

    const allKeyframes = [...forwardKeyframes, ...reverseKeyframes];
    if (allKeyframes.length <= 1) return;

    keyframeAnimation.setKeys(allKeyframes);
    mesh.animations.push(keyframeAnimation);

    if (property === "alpha" && mesh.material) {
      mesh.material.markAsDirty(flock.BABYLON.Material.MiscDirtyFlag);
    }

    const lastFrame = allKeyframes[allKeyframes.length - 1].frame;
    const animatable = flock.scene.beginAnimation(mesh, 0, lastFrame, loop);

    mesh.metadata = mesh.metadata || {};
    mesh.metadata[activeKey] = animatable;

    return new Promise((resolve) => {
      animatable.onAnimationEndObservable.add(() => {
        if (mesh.metadata[activeKey] === animatable) {
          mesh.metadata[activeKey] = null;
        }
        resolve();
      });
    });
  },
  async createAnimation(
    animationGroupName,
    meshName,
    {
      property,
      keyframes,
      easing = "Linear",
      loop = false,
      reverse = false,
      mode = "START",
    } = {},
  ) {
    // Generate a unique name if one isn't provided
    animationGroupName =
      animationGroupName || `animation_${flock.scene.getUniqueId()}`;

    // Get or create the animation group
    let animationGroup =
      flock.scene.getAnimationGroupByName(animationGroupName);
    if (!animationGroup) {
      animationGroup = new flock.BABYLON.AnimationGroup(
        animationGroupName,
        flock.scene,
      );
    }

    const mesh = await flock.whenModelReady(meshName);
    if (!mesh) {
      console.warn(`Mesh ${meshName} not found.`);
      return animationGroupName;
    }

    if (property === "alpha") {
      flock.ensureUniqueMaterial(mesh);
    }

    // Determine target meshes (handling alpha for descendants)
    const meshesToAnimate =
      property === "alpha"
        ? [mesh, ...mesh.getDescendants()].filter((m) => m.material)
        : [mesh];

    for (const targetMesh of meshesToAnimate) {
      const propertyToAnimate = flock._resolvePropertyToAnimate(
        property,
        targetMesh,
      );
      const fps = 30;
      const animationType = flock._determineAnimationType(property);
      const loopMode = flock.BABYLON.Animation.ANIMATIONLOOPMODE_CYCLE;

      const keyframeAnimation = new flock.BABYLON.Animation(
        `${animationGroupName}_${property}`,
        propertyToAnimate,
        fps,
        animationType,
        loopMode,
      );

      // Convert seconds to frames
      const forwardKeyframes = keyframes.map((keyframe) => ({
        frame: Math.round((keyframe.duration || 0) * fps),
        value: flock._parseKeyframeValue(property, keyframe.value, targetMesh),
      }));

      // Ensure a starting keyframe at frame 0
      if (!forwardKeyframes.some((k) => k.frame === 0)) {
        let currentValue;
        if (property === "alpha") {
          currentValue = targetMesh.material?.alpha ?? 1;
        } else if (["color", "colour", "diffuseColor"].includes(property)) {
          currentValue =
            targetMesh.material?.diffuseColor?.clone() ||
            flock.BABYLON.Color3.FromHexString("#ffffff");
        } else {
          currentValue = targetMesh[propertyToAnimate];
          if (currentValue?.clone) currentValue = currentValue.clone();
        }

        forwardKeyframes.unshift({ frame: 0, value: currentValue });
      }

      // Generate reverse keyframes
      const reverseKeyframes = reverse
        ? forwardKeyframes
            .slice(0, -1)
            .reverse()
            .map((keyframe, index) => ({
              frame:
                forwardKeyframes[forwardKeyframes.length - 1].frame +
                (forwardKeyframes[index + 1]?.frame - keyframe.frame),
              value: keyframe.value,
            }))
        : [];

      const allKeyframes = [...forwardKeyframes, ...reverseKeyframes];

      if (allKeyframes.length > 1) {
        keyframeAnimation.setKeys(allKeyframes);
      } else {
        continue;
      }

      // Apply easing using the internal helper
      flock._applyEasing(keyframeAnimation, easing);

      // Link animation to group
      flock._addAnimationToGroup(animationGroup, keyframeAnimation, targetMesh);
    }

    if (animationGroup.targetedAnimations.length === 0) {
      return animationGroupName;
    }

    // Handle Playback Modes
    if (mode === "START" || mode === "AWAIT") {
      animationGroup.play(loop);

      if (mode === "AWAIT") {
        return new Promise((resolve) => {
          animationGroup.onAnimationEndObservable.addOnce(() => {
            resolve(animationGroupName);
          });
        });
      }
    } else if (mode === "CREATE") {
      animationGroup.stop();
      animationGroup.onAnimationGroupPlayObservable.clear();
    }

    return animationGroupName;
  },
  async animateProperty(
    meshName,
    {
      property,
      targetValue,
      duration = 1,
      reverse = false,
      loop = false,
      easing = "Linear",
      mode = "AWAIT",
    } = {},
  ) {
    const mesh = await flock.whenModelReady(meshName);
    if (!mesh) return;

    // Track active animations by property to allow cancellation of
    // overlapping animations on the same property (e.g., two scale changes)
    const activeKey = `_activeAnim_${property}`;
    if (mesh.metadata?.[activeKey]) {
      mesh.metadata[activeKey].stop();
    }

    const fps = 30;
    const frames = fps * duration;
    const propertyToAnimate = flock._resolvePropertyToAnimate(property, mesh);
    const animationType = flock._determineAnimationType(property);

    const animation = new flock.BABYLON.Animation(
      `anim_${property}_${flock.scene.getUniqueId()}`,
      propertyToAnimate,
      fps,
      animationType,
      loop || reverse
        ? flock.BABYLON.Animation.ANIMATIONLOOPMODE_CYCLE
        : flock.BABYLON.Animation.ANIMATIONLOOPMODE_CONSTANT,
    );

    // Apply easing
    if (
      easing !== "Linear" &&
      typeof flock.BABYLON[easing] === "function" &&
      flock.BABYLON[easing].prototype instanceof flock.BABYLON.EasingFunction
    ) {
      const ease = new flock.BABYLON[easing]();
      ease.setEasingMode(flock.BABYLON.EasingFunction.EASINGMODE_EASEINOUT);
      animation.setEasingFunction(ease);
    }

    // Capture the current starting value
    let startValue = flock._getCurrentPropertyValue(
      mesh,
      property,
      propertyToAnimate,
    );
    if (startValue?.clone) startValue = startValue.clone();

    // Parse the target value (handling hex strings for colors, etc.)
    const parsedTarget = flock._parseKeyframeValue(property, targetValue, mesh);

    const keys = [
      { frame: 0, value: startValue },
      { frame: frames, value: parsedTarget },
    ];

    if (reverse) {
      keys.push({ frame: frames * 2, value: startValue });
    }

    animation.setKeys(keys);

    const animatable = flock.scene.beginDirectAnimation(
      mesh,
      [animation],
      0,
      reverse ? frames * 2 : frames,
      loop,
    );

    mesh.metadata = mesh.metadata || {};
    mesh.metadata[activeKey] = animatable;

    if (mode === "AWAIT") {
      return new Promise((resolve) => {
        animatable.onAnimationEndObservable.addOnce(() => {
          if (mesh.metadata[activeKey] === animatable) {
            mesh.metadata[activeKey] = null;
          }
          // Ensure final state is set explicitly if not reversing/looping
          if (!reverse && !loop) {
            flock._setPropertyValue(mesh, propertyToAnimate, parsedTarget);
          }
          resolve();
        });
      });
    }
  },
  playAnimationGroup(groupName) {
    const animationGroup = flock.scene.getAnimationGroupByName(groupName);
    if (animationGroup) {
      animationGroup.start();
    } else {
      console.warn(`Animation group '${groupName}' not found.`);
    }
  },
  pauseAnimationGroup(groupName) {
    const animationGroup = flock.scene.getAnimationGroupByName(groupName);
    if (animationGroup) {
      animationGroup.pause();
    } else {
      console.warn(`Animation group '${groupName}' not found.`);
    }
  },
  stopAnimationGroup(groupName) {
    const animationGroup = flock.scene.getAnimationGroupByName(groupName);
    if (animationGroup) {
      animationGroup.stop();
    } else {
      console.warn(`Animation group '${groupName}' not found.`);
    }
  },
  // Helper: Get the MIN position of a mesh on a given axis, accounting for its pivot
  _getMeshPivotPosition(mesh, axis) {
    // Match setAnchor defaults: x=CENTER, y=MIN, z=CENTER
    const pivotSettings = (mesh.metadata && mesh.metadata.pivotSettings) || {
      x: "CENTER",
      y: "MIN",
      z: "CENTER",
    };
    const bounding = mesh.getBoundingInfo().boundingBox.extendSize;
    const halfSize = bounding[axis] * mesh.scaling[axis];

    const pivotSetting = pivotSettings[axis];

    if (pivotSetting === "CENTER") {
      return mesh.position[axis]; // No adjustment for CENTER
    } else if (pivotSetting === "MIN") {
      return mesh.position[axis] - halfSize;
    } else if (pivotSetting === "MAX") {
      return mesh.position[axis] + halfSize;
    }
  },
  _resolvePropertyToAnimate(property, mesh) {
    if (!mesh) {
      console.warn("Mesh not found.");
      return null;
    }

    switch (property) {
      case "color":
        flock.ensureUniqueMaterial(mesh);
        return mesh.material?.diffuseColor !== undefined
          ? "material.diffuseColor"
          : "material.albedoColor";

      case "alpha":
        if (mesh.material) {
          mesh.material.transparencyMode =
            flock.BABYLON.Material.MATERIAL_ALPHABLEND;
        }
        return "material.alpha";

      default:
        // Handle rotation.x, rotation.y, rotation.z with quaternions
        if (
          ["rotation.x", "rotation.y", "rotation.z"].includes(property) &&
          mesh.rotationQuaternion // Only applies if using quaternions
        ) {
          return "rotationQuaternion"; // Map to rotationQuaternion
        }

        // Leave everything else unchanged
        return property;
    }
  },
  _determineAnimationType(property) {
    // Handle rotation.x, rotation.y, rotation.z with quaternions
    if (["rotation.x", "rotation.y", "rotation.z"].includes(property)) {
      return flock.BABYLON.Animation.ANIMATIONTYPE_QUATERNION; // Quaternion type
    }

    switch (property) {
      case "color":
        return flock.BABYLON.Animation.ANIMATIONTYPE_COLOR3;

      case "position":
      case "rotation":
      case "scaling":
        return flock.BABYLON.Animation.ANIMATIONTYPE_VECTOR3; // Full Vector3 properties

      default:
        return flock.BABYLON.Animation.ANIMATIONTYPE_FLOAT; // Scalars like position.x and scaling.x
    }
  },
  _parseKeyframeValue(property, value, mesh) {
    // Handle quaternion rotation for rotation.x, rotation.y, and rotation.z
    if (
      ["rotation.x", "rotation.y", "rotation.z"].includes(property) &&
      mesh.rotationQuaternion // Only applies if using quaternions
    ) {
      // Ensure the quaternion exists
      if (!mesh.rotationQuaternion) {
        mesh.rotationQuaternion = flock.BABYLON.Quaternion.FromEulerVector(
          mesh.rotation || flock.BABYLON.Vector3.Zero(),
        );
      }

      // Convert quaternion to Euler angles
      const euler = mesh.rotationQuaternion.toEulerAngles();

      // Update the specified axis (convert degrees to radians)
      const radians = flock.BABYLON.Tools.ToRadians(value); // Degrees → Radians
      switch (property) {
        case "rotation.x":
          euler.x = radians;
          break;
        case "rotation.y":
          euler.y = radians;
          break;
        case "rotation.z":
          euler.z = radians;
          break;
      }

      // Return the updated quaternion
      return flock.BABYLON.Quaternion.RotationYawPitchRoll(
        euler.y,
        euler.x,
        euler.z,
      );
    }

    // Handle full Vector3 rotations
    if (property.startsWith("rotation")) {
      if (value instanceof flock.BABYLON.Vector3) {
        return new flock.BABYLON.Vector3(
          flock.BABYLON.Tools.ToRadians(value.x || 0),
          flock.BABYLON.Tools.ToRadians(value.y || 0),
          flock.BABYLON.Tools.ToRadians(value.z || 0),
        );
      } else if (typeof value === "string") {
        const vectorValues = value.match(/-?\d+(\.\d+)?/g).map(Number);
        return new flock.BABYLON.Vector3(
          flock.BABYLON.Tools.ToRadians(vectorValues[0] || 0),
          flock.BABYLON.Tools.ToRadians(vectorValues[1] || 0),
          flock.BABYLON.Tools.ToRadians(vectorValues[2] || 0),
        );
      }
    }

    // Colors remain unchanged
    if (property === "color") {
      return flock.BABYLON.Color3.FromHexString(value);
    }

    // Handle position and scaling as Vector3
    if (["position", "scaling"].some((p) => property.startsWith(p))) {
      if (value instanceof flock.BABYLON.Vector3) {
        return value;
      } else if (typeof value === "string") {
        const vectorValues = value.match(/-?\d+(\.\d+)?/g).map(Number);
        return new flock.BABYLON.Vector3(
          vectorValues[0] || 0,
          vectorValues[1] || 0,
          vectorValues[2] || 0,
        );
      }
    }

    // Scalar values for properties like position.x, scaling.x
    if (/\.(x|y|z)$/.test(property)) {
      return parseFloat(value); // Scalar values remain unchanged
    }

    return parseFloat(value); // Default for scalar properties
  },
  _findFirstDescendantWithMaterial(mesh) {
    if (mesh.material) return mesh;
    const descendants = mesh.getDescendants();
    return descendants.find((descendant) => descendant.material) || null;
  },
  _addAnimationToGroup(animationGroup, animation, target) {
    // Add the animation to the group
    animationGroup.addTargetedAnimation(animation, target);

    if (animationGroup.isStarted) {
      // Get the current frame of the first animation in the group
      const currentFrame =
        animationGroup.targetedAnimations[0]?.animation.runtimeAnimations[0]
          ?.currentFrame;

      if (currentFrame !== undefined) {
        // Find the RuntimeAnimation for the newly added animation
        const runtimeAnimation = animation.runtimeAnimations.find(
          (ra) => ra.target === target,
        );

        if (runtimeAnimation) {
          runtimeAnimation.goToFrame(currentFrame);
        }
      } else {
        console.warn(
          "Could not retrieve the current frame for synchronisation.",
        );
      }
    }
  },
  animateFrom(groupName, timeInSeconds) {
    const animationGroup = flock.scene.getAnimationGroupByName(groupName);
    if (animationGroup) {
      const animation = animationGroup.targetedAnimations[0]?.animation;
      if (!animation) {
        console.warn(`Animation group '${groupName}' has no animations.`);
        return;
      }

      const fps = animation.framePerSecond;
      const frame = timeInSeconds * fps;

      animationGroup.goToFrame(frame);
      animationGroup.play();
    } else {
      console.warn(`Animation group '${groupName}' not found.`);
    }
  },
  _applyEasing(animation, easing) {
    let easingFunction;

    switch (easing.toLowerCase()) {
      case "ease-in":
        easingFunction = new flock.BABYLON.QuadraticEase();
        easingFunction.setEasingMode(
          flock.BABYLON.EasingFunction.EASINGMODE_EASEIN,
        );
        break;
      case "ease-out":
        easingFunction = new flock.BABYLON.QuadraticEase();
        easingFunction.setEasingMode(
          flock.BABYLON.EasingFunction.EASINGMODE_EASEOUT,
        );
        break;
      case "ease-in-out":
        easingFunction = new flock.BABYLON.QuadraticEase();
        easingFunction.setEasingMode(
          flock.BABYLON.EasingFunction.EASINGMODE_EASEINOUT,
        );
        break;
      case "linear":
      default:
        easingFunction = null; // No easing for linear
        break;
    }

    if (easingFunction) {
      animation.setEasingFunction(easingFunction);
    }
  },
  stopAnimations(modelName) {
    return new Promise((resolve) => {
      flock.whenModelReady(modelName, (mesh) => {
        if (mesh && mesh.animations) {
          flock.scene.stopAnimation(mesh);
        }

        if (mesh.animationGroups) {
          mesh.animationGroups.forEach((group) => {
            group.stop();
          });
        }
        resolve();
      });
    });
  },
  stopAnimationsTargetingMesh(scene, mesh) {
    scene.animationGroups.forEach(function (animationGroup) {
      let targets = animationGroup.targetedAnimations.map(
        function (targetedAnimation) {
          return targetedAnimation.target;
        },
      );

      if (
        targets.includes(mesh) ||
        flock._animationGroupTargetsDescendant(animationGroup, mesh)
      ) {
        animationGroup.stop();
      }
    });
  },
  _animationGroupTargetsDescendant(animationGroup, parentMesh) {
    let descendants = parentMesh.getDescendants();
    for (let targetedAnimation of animationGroup.targetedAnimations) {
      let target = targetedAnimation.target;
      if (descendants.includes(target)) {
        return true;
      }
    }
    return false;
  },
  _activateAnimation(
    mesh,
    meshOrGroup,
    retargetedGroup,
    animationName,
    loop,
    restart,
    requestCounter,
  ) {
    // Verify this is still the current request
    if (mesh.metadata?.requestCounter !== requestCounter) {
      return; // Newer request superseded this one
    }

    if (mesh.metadata?.requestedAnimationName !== animationName) {
      return; // Different animation now requested
    }

    // Stop previous animation
    if (
      mesh._currentAnimGroup &&
      mesh._currentAnimGroup !== retargetedGroup &&
      mesh._currentAnimGroup.isPlaying
    ) {
      mesh._currentAnimGroup.stop();
      mesh._currentAnimGroup = null;
    }

    mesh._currentAnimGroup = retargetedGroup;
    mesh.metadata.currentAnimationName = animationName;

    // Update physics shape
    const physicsMesh = meshOrGroup;
    updateCapsuleShapeForAnimation(physicsMesh, animationName);

    // Start animation
    if (!retargetedGroup.isPlaying || restart) {
      retargetedGroup.stop();
      retargetedGroup.reset();
      retargetedGroup.start(loop);
    }
  },
  _getCurrentAnimationInfo(meshOrGroup) {
    const findMeshWithSkeleton = (rootMesh) => {
      if (rootMesh?.skeleton) return rootMesh;
      if (rootMesh?.getChildMeshes) {
        for (const child of rootMesh.getChildMeshes()) {
          if (child.skeleton) return child;
        }
      }
      return null;
    };

    const mesh = findMeshWithSkeleton(meshOrGroup);
    if (!mesh || !mesh.metadata) return null;

    const scene = mesh.getScene?.();
    const animName = mesh.metadata.currentAnimationName || null;
    if (!animName || !scene)
      return { name: null, isLooping: false, isPlaying: false };

    // groups are named like `${mesh.name}.${animName}`
    const expectedGroupName = `${mesh.name}.${animName}`;

    const group =
      scene.getAnimationGroupByName?.(expectedGroupName) ||
      scene.animationGroups?.find((g) => g.name === expectedGroupName) ||
      // fallback if naming ever changes:
      scene.animationGroups?.find((g) => g.name?.endsWith?.(`.${animName}`)) ||
      null;

    return {
      name: animName,
      isLooping: group ? !!group.loopAnimation : false,
      isPlaying: group ? !!group.isPlaying : false,
      groupName: group?.name ?? null,
    };
  },
  async _switchToAnimationLoad(
    scene,
    meshOrGroup,
    animationName,
    loop = true,
    restart = false,
    play = true,
  ) {
    const findMeshWithSkeleton = (rootMesh) => {
      if (rootMesh?.skeleton) return rootMesh;
      if (rootMesh?.getChildMeshes) {
        for (const child of rootMesh.getChildMeshes()) {
          if (child.skeleton) return child;
        }
      }
      return null;
    };

    const mesh = findMeshWithSkeleton(meshOrGroup);
    if (!mesh || !mesh.skeleton) return null;

    if (!mesh.metadata) mesh.metadata = {};
    if (!mesh.metadata.animationGroups) mesh.metadata.animationGroups = {};
    const cache = mesh.metadata.animationGroups;

    // Only record "intent" when we actually plan to play something now.
    if (play) {
      mesh.metadata.requestedAnimationName = animationName;
    }

    // Resolve or load the animation group (promise-cached)
    let retargetedGroup;
    if (cache[animationName]) {
      retargetedGroup =
        typeof cache[animationName].then === "function"
          ? await cache[animationName]
          : cache[animationName];
    } else {
      cache[animationName] = (async () => {
        const modelName = meshOrGroup.metadata?.modelName;
        const animationFile =
          typeof blockNames !== "undefined" && blockNames.includes(modelName)
            ? animationName + "_Block"
            : animationName;

        const animImport =
          await flock.BABYLON.SceneLoader.LoadAssetContainerAsync(
            "./animations/",
            animationFile + ".glb",
            flock.scene,
            undefined,
            undefined,
            {
              gltf: {
                animationStartMode:
                  flock.BABYLON_LOADER.GLTFLoaderAnimationStartMode.NONE,
              },
            },
          );

        const animGroup = animImport.animationGroups.find(
          (ag) => ag.name === animationName && ag.targetedAnimations.length > 0,
        );
        if (!animGroup) {
          animImport.dispose();
          return null;
        }

        const skeleton = mesh.skeleton;
        if (!skeleton || !skeleton.bones) {
          animImport.dispose();
          return null;
        }

        const boneMap = {};
        const tnMap = {};
        skeleton.bones.forEach((b) => {
          boneMap[b.name] = b;
          if (b._linkedTransformNode) {
            tnMap[b._linkedTransformNode.name] = b._linkedTransformNode;
          }
        });

        const newGroup = new flock.BABYLON.AnimationGroup(
          `${mesh.name}.${animationName}`,
          scene,
        );
        for (const ta of animGroup.targetedAnimations) {
          let target = null;
          if (ta.target instanceof flock.BABYLON.Bone)
            target = boneMap[ta.target.name];
          else if (ta.target instanceof flock.BABYLON.TransformNode)
            target = tnMap[ta.target.name];
          if (target && ta.animation?.targetProperty !== "scaling") {
            const animCopy = ta.animation.clone(
              `${ta.animation.name}_${mesh.name}`,
            );
            newGroup.addTargetedAnimation(animCopy, target);
          }
        }

        animImport.dispose();
        return newGroup;
      })();

      retargetedGroup = await cache[animationName];
      cache[animationName] = retargetedGroup;
    }

    if (!retargetedGroup) return null;

    // If this was a preload (play === false), do NOT switch or start anything.
    if (!play) {
      return retargetedGroup;
    }

    // Only activate if this is still the latest requested animation.
    if (mesh.metadata.requestedAnimationName !== animationName) {
      return retargetedGroup;
    }

    if (
      mesh._currentAnimGroup &&
      mesh._currentAnimGroup !== retargetedGroup &&
      mesh._currentAnimGroup.isPlaying
    ) {
      mesh._currentAnimGroup.stop();
      mesh._currentAnimGroup = null;
    }

    mesh._currentAnimGroup = retargetedGroup;
    mesh.metadata.currentAnimationName = animationName;

    // Update physics shape based on animation
    const physicsMesh = meshOrGroup;

    updateCapsuleShapeForAnimation(physicsMesh, animationName);

    if (!retargetedGroup.isPlaying || restart) {
      retargetedGroup.stop();
      retargetedGroup.reset();
      retargetedGroup.start(loop);
    }

    return retargetedGroup;
  },

  // Helper: Wait for mesh to appear in scene
  async _waitForMesh(meshName, { maxAttempts = 100, interval = 10 } = {}) {
    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
      const mesh = flock.scene.getMeshByName(meshName);
      if (mesh) return mesh;
      await new Promise((resolve, reject) => {
        const timeoutId = setTimeout(resolve, interval);
        if (flock.abortController && flock.abortController.signal) {
          flock.abortController.signal.addEventListener("abort", () => {
            clearTimeout(timeoutId);
            reject(new Error("Timeout aborted"));
          });
        }
      });
    }
    return null;
  },
  async _playAnimationLoad(
    meshName,
    { animationName, loop = false, restart = true } = {},
  ) {
    if (!animationName) {
      console.warn(
        `No animationName provided for playAnimation on mesh '${meshName}'.`,
      );
      return;
    }
    const mesh = flock.scene.getMeshByName(meshName);
    if (!mesh) {
      console.error(`Mesh '${meshName}' not found for animation.`);
      return;
    }
    // Await the AnimationGroup from switchToAnimationLoad, which handles caching and remap
    const animGroup = await flock._switchToAnimationLoad(
      flock.scene,
      mesh,
      animationName,
      loop,
      restart,
    );
    if (!animGroup) {
      console.warn(
        `Animation '${animationName}' not found or failed for mesh '${meshName}'.`,
      );
      return;
    }
    return new Promise((resolve) => {
      if (animGroup.onAnimationGroupEndObservable) {
        const observer = animGroup.onAnimationGroupEndObservable.add(() => {
          animGroup.onAnimationGroupEndObservable.remove(observer);
          resolve();
        });
      } else {
        resolve();
      }
    });
  },
  switchToAnimation(
    scene,
    meshOrGroup,
    animationName,
    loop = true,
    restart = false,
    play = true,
  ) {
    const modelName = meshOrGroup.metadata?.modelName;

    if (modelAnimationNames.includes(modelName)) {
      return flock._switchToAnimationModel(
        scene,
        meshOrGroup,
        animationName,
        loop,
        restart,
      );
    } else if (flock.separateAnimations) {
      // || meshOrGroup.name.includes('ANIMTEST'))

      return flock._switchToAnimationLoad(
        scene,
        meshOrGroup,
        animationName,
        loop,
        restart,
        play,
      );
    } else {
      return flock._switchToAnimationModel(
        scene,
        meshOrGroup,
        animationName,
        loop,
        restart,
      );
    }
  },
  _switchToAnimationModel(
    scene,
    mesh,
    animationName,
    loop = true,
    restart = false,
  ) {
    const newAnimationName = animationName;

    if (!mesh) {
      console.error(`Mesh ${mesh.name} not found.`);
      return null;
    }

    if (flock.flockNotReady) return null;

    let targetAnimationGroup = flock.scene?.animationGroups?.find(
      (group) =>
        group.name === newAnimationName &&
        flock._animationGroupTargetsDescendant(group, mesh),
    );

    if (!targetAnimationGroup) {
      console.error(`Animation "${newAnimationName}" not found.`);
      return null;
    }

    if (!mesh.animationGroups) {
      mesh.animationGroups = [];
      flock.stopAnimationsTargetingMesh(scene, mesh);
    }

    if (
      mesh.animationGroups[0] &&
      mesh.animationGroups[0].name !== newAnimationName
    ) {
      flock.stopAnimationsTargetingMesh(scene, mesh);
      mesh.animationGroups[0].stop();
      mesh.animationGroups = [];
    }

    if (
      !mesh.animationGroups[0] ||
      (mesh.animationGroups[0].name == newAnimationName && restart)
    ) {
      flock.stopAnimationsTargetingMesh(scene, mesh);
      mesh.animationGroups[0] = targetAnimationGroup;
      mesh.animationGroups[0].reset();
      mesh.animationGroups[0].stop();
      mesh.animationGroups[0].start(
        loop,
        1.0,
        targetAnimationGroup.from,
        targetAnimationGroup.to,
        false,
      );
    }

    // Update physics shape based on animation
    const physicsMesh = mesh;

    updateCapsuleShapeForAnimation(physicsMesh, animationName);

    return targetAnimationGroup;
  },

  async _playAnimationModel(
    meshName,
    { animationName, loop = false, restart = true } = {},
  ) {
    if (!animationName) {
      console.warn(
        `No animationName provided for playAnimation on mesh '${meshName}'.`,
      );
      return;
    }
    const mesh = flock.scene.getMeshByName(meshName);
    if (!mesh) {
      console.error(`Mesh '${meshName}' not found for animation.`);
      return;
    }
    const animGroup = flock.switchToAnimation(
      flock.scene,
      mesh,
      animationName,
      loop,
      restart,
    );
    if (!animGroup) {
      console.warn(
        `Animation '${animationName}' not found for mesh '${meshName}'.`,
      );
      return;
    }
    return new Promise((resolve) => {
      animGroup.onAnimationEndObservable.addOnce(() => resolve());
    });
  },
};
