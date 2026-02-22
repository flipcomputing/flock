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

const updateCapsuleShapeForAnimation = (
  physicsMesh,
  animationName,
  { fallYOffset = -0.4 } = {},
) => {
  if (
    !physicsMesh ||
    !physicsMesh.physics ||
    !physicsMesh.physics.shape ||
    physicsMesh.physics.shape.constructor.name !== "_PhysicsShapeCapsule"
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
    return new Promise((resolve) => {
      flock.whenModelReady(meshName, async (mesh) => {
        if (!mesh) {
          resolve();
          return;
        }

        const BABYLON = flock.BABYLON;
        const children = mesh.getChildMeshes();

        const childData = children.map((c) => ({
          mesh: c,
          localPos: c.position.clone(),
          localRot: c.rotation.clone(),
          localQuat: c.rotationQuaternion ? c.rotationQuaternion.clone() : null,
        }));

        const startRotation = mesh.rotation.clone();
        const targetRotation = new BABYLON.Vector3(
          x * (Math.PI / 180),
          y * (Math.PI / 180),
          z * (Math.PI / 180),
        );

        const fps = 30;
        const frames = fps * duration;

        const rotateAnimation = new BABYLON.Animation(
          "rotate",
          "rotation",
          fps,
          BABYLON.Animation.ANIMATIONTYPE_VECTOR3,
          reverse
            ? BABYLON.Animation.ANIMATIONLOOPMODE_YOYO
            : loop
              ? BABYLON.Animation.ANIMATIONLOOPMODE_CYCLE
              : BABYLON.Animation.ANIMATIONLOOPMODE_CONSTANT,
        );

        rotateAnimation.setKeys([
          { frame: 0, value: startRotation },
          { frame: frames, value: targetRotation },
        ]);

        if (easing !== "Linear") {
          const ease = new BABYLON[easing]();
          ease.setEasingMode(BABYLON.EasingFunction.EASINGMODE_EASEINOUT);
          rotateAnimation.setEasingFunction(ease);
        }

        const syncObserver = flock.scene.onAfterAnimationsObservable.add(() => {
          mesh.computeWorldMatrix(true);
          childData.forEach((data) => data.mesh.computeWorldMatrix(true));

          if (mesh.physics && mesh.physics._pluginData?.hpBodyId) {
            mesh.physics.setTargetTransform(
              mesh.absolutePosition,
              mesh.absoluteRotationQuaternion ||
                BABYLON.Quaternion.FromEulerVector(mesh.rotation),
            );
          }
        });

        const animatable = flock.scene.beginDirectAnimation(
          mesh,
          [rotateAnimation],
          0,
          frames,
          loop,
        );

        animatable.onAnimationEndObservable.add(() => {
          flock.scene.onAfterAnimationsObservable.remove(syncObserver);
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
    return new Promise(async (resolve) => {
      await flock.whenModelReady(meshName, async function (mesh) {
        if (mesh) {
          const groundLevelSentinel = -999999;
          const numericY = typeof y === "string" ? Number(y) : y;
          if (y === "__ground__level__" || numericY === groundLevelSentinel) {
            await flock.waitForGroundReady();
            y = flock.getGroundLevelAt(x, z);
          }
          const BABYLON = flock.BABYLON;
          const children = mesh.getChildMeshes();

          // Determine if we should actually treat this as a physics object
          const isPhysicsActive =
            mesh.physics &&
            mesh.metadata?.physicsType !== "NONE" &&
            mesh.physics._pluginData?.hpBodyId;

          if (isPhysicsActive) {
            mesh.physics.disablePreStep = false;
            mesh.physics.setPrestepType(BABYLON.PhysicsPrestepType.ACTION);
            mesh.physics.setMotionType(BABYLON.PhysicsMotionType.ANIMATED);
          }

          const startAnchor = flock._getAnchor(mesh);
          const targetAnchor = new BABYLON.Vector3(x, y, z);
          const anchorDelta = targetAnchor.subtract(
            new BABYLON.Vector3(startAnchor.x, startAnchor.y, startAnchor.z),
          );
          const startPosition = mesh.position.clone();
          const endPosition = startPosition.add(anchorDelta);
          const fps = 30;
          const frames = fps * duration;

          const glideAnimation = new BABYLON.Animation(
            "glide",
            "position",
            fps,
            BABYLON.Animation.ANIMATIONTYPE_VECTOR3,
            loop || reverse
              ? BABYLON.Animation.ANIMATIONLOOPMODE_CYCLE
              : BABYLON.Animation.ANIMATIONLOOPMODE_CONSTANT,
          );

          const glideKeys = [
            { frame: 0, value: startPosition },
            { frame: frames, value: endPosition },
          ];
          if (reverse || loop)
            glideKeys.push({ frame: frames * 2, value: startPosition });
          glideAnimation.setKeys(glideKeys);

          if (easing !== "Linear") {
            let ease = new BABYLON[easing]();
            ease.setEasingMode(BABYLON.EasingFunction.EASINGMODE_EASEINOUT);
            glideAnimation.setEasingFunction(ease);
          }

          const syncObserver = flock.scene.onAfterAnimationsObservable.add(
            () => {
              mesh.computeWorldMatrix(true);
              children.forEach((c) => c.computeWorldMatrix(true));

              // Only sync the physics body if physics is logically active
              if (isPhysicsActive) {
                mesh.physics.setTargetTransform(
                  mesh.absolutePosition,
                  mesh.absoluteRotationQuaternion ||
                    BABYLON.Quaternion.FromEulerVector(mesh.rotation),
                );
              }
            },
          );

          const animatable = flock.scene.beginDirectAnimation(
            mesh,
            [glideAnimation],
            0,
            reverse || loop ? frames * 2 : frames,
            loop,
          );

          animatable.onAnimationEndObservable.add(() => {
            flock.scene.onAfterAnimationsObservable.remove(syncObserver);
            if (!reverse) mesh.position = endPosition.clone();
            resolve();
          });
        } else {
          resolve();
        }
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
      offsetSpace = "local", // "local" (default) or "world"
      duration = 1,
      reverse = false,
      loop = false,
      easing = "Linear",
    } = {},
  ) {
    return new Promise(async (resolve) => {
      await flock.whenModelReady(meshName1, async function (mesh1) {
        if (!mesh1) {
          resolve();
          return;
        }

        flock.whenModelReady(meshName2, async function (mesh2) {
          if (!mesh2) {
            resolve();
            return;
          }

          const BABYLON = flock.BABYLON;

          // Anchor (pivot) of the target in world space
          const { x: baseX, y: baseY, z: baseZ } = flock._getAnchor(mesh2);

          // Compute offset in world space
          let worldOffsetX = 0;
          let worldOffsetY = 0;
          let worldOffsetZ = 0;

          if (offsetX !== 0 || offsetY !== 0 || offsetZ !== 0) {
            if (offsetSpace === "world") {
              // Offsets are already in world space
              worldOffsetX = offsetX;
              worldOffsetY = offsetY;
              worldOffsetZ = offsetZ;
            } else {
              // Default: offsets are in the *local* space of the target mesh
              mesh2.computeWorldMatrix(true);
              const localOffset = new BABYLON.Vector3(
                offsetX,
                offsetY,
                offsetZ,
              );
              const worldOffset = BABYLON.Vector3.TransformNormal(
                localOffset,
                mesh2.getWorldMatrix(),
              );

              worldOffsetX = worldOffset.x;
              worldOffsetY = worldOffset.y;
              worldOffsetZ = worldOffset.z;
            }
          }

          await flockAnimate.glideTo(meshName1, {
            x: baseX + worldOffsetX,
            y: baseY + worldOffsetY,
            z: baseZ + worldOffsetZ,
            duration,
            reverse,
            loop,
            easing,
          });

          resolve();
        });
      });
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
    return new Promise(async (resolve) => {
      await flock.whenModelReady(meshName1, async function (mesh1) {
        if (!mesh1) {
          resolve();
          return;
        }

        flock.whenModelReady(meshName2, async function (mesh2) {
          if (!mesh2) {
            resolve();
            return;
          }

          const BABYLON = flock.BABYLON;
          let targetRotation;
          const normalizedMode = String(mode || "towards").toLowerCase();

          if (normalizedMode === "same_rotation") {
            mesh2.computeWorldMatrix(true);
            const targetQuaternion = new BABYLON.Quaternion();
            mesh2.getWorldMatrix().decompose(undefined, targetQuaternion);

            mesh1.computeWorldMatrix(true);
            let localTargetQuaternion = targetQuaternion;
            if (mesh1.parent?.getWorldMatrix) {
              mesh1.parent.computeWorldMatrix(true);
              const parentRotation = new BABYLON.Quaternion();
              mesh1.parent
                .getWorldMatrix()
                .decompose(undefined, parentRotation);
              localTargetQuaternion = parentRotation
                .conjugate()
                .multiply(targetQuaternion)
                .normalize();
            }

            const euler = localTargetQuaternion.toEulerAngles();
            targetRotation = {
              x: BABYLON.Tools.ToDegrees(euler.x),
              y: BABYLON.Tools.ToDegrees(euler.y),
              z: BABYLON.Tools.ToDegrees(euler.z),
            };
          } else {
            const p1 = mesh1.getAbsolutePosition?.() ?? mesh1.absolutePosition;
            const p2 = mesh2.getAbsolutePosition?.() ?? mesh2.absolutePosition;
            const dir = p2.subtract(p1);

            if (dir.lengthSquared() === 0) {
              resolve();
              return;
            }

            dir.normalize();
            const q = BABYLON.Quaternion.FromLookDirectionLH(dir, BABYLON.Axis.Y);
            const euler = q.toEulerAngles();

            targetRotation = {
              x: BABYLON.Tools.ToDegrees(euler.x),
              y: BABYLON.Tools.ToDegrees(euler.y),
              z: BABYLON.Tools.ToDegrees(euler.z),
            };
          }

          await flockAnimate.rotateAnim(meshName1, {
            ...targetRotation,
            duration,
            reverse,
            loop,
            easing,
          });

          resolve();
        });
      });
    });
  },
  animateKeyFrames(
    meshName,
    {
      keyframes,
      property,
      easing = "Linear",
      loop = false,
      reverse = false,
    } = {},
  ) {
    return new Promise(async (resolve) => {
      await flock.whenModelReady(meshName, async (mesh) => {
        if (!mesh) {
          resolve();
          return;
        }

        let propertyToAnimate;

        // Resolve material-related properties
        if (property === "color" || property === "alpha") {
          function findFirstDescendantWithMaterial(mesh) {
            if (mesh.material) {
              return mesh;
            }
            const descendants = mesh.getDescendants();
            for (const descendant of descendants) {
              if (descendant.material) {
                return descendant;
              }
            }
            return null;
          }
          mesh = findFirstDescendantWithMaterial(mesh);
        }

        // Resolve the property to animate
        if (property === "color") {
          propertyToAnimate =
            mesh.material.diffuseColor !== undefined
              ? "material.diffuseColor"
              : "material.albedoColor";
        } else if (property === "alpha") {
          propertyToAnimate = "material.alpha";
          mesh.material.transparencyMode =
            flock.BABYLON.Material.MATERIAL_ALPHABLEND;
        } else {
          propertyToAnimate = property;
        }

        const fps = 30; // Frames per second for the animation timeline
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
          flock.BABYLON.Animation.ANIMATIONLOOPMODE_CYCLE, // Force cycle mode
        );

        // Generate forward keyframes with seconds-to-frames conversion
        let currentFrame = 0;
        const forwardKeyframes = keyframes.map((keyframe) => {
          let value;

          // Resolve value based on property type
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
              const vectorValues = keyframe.value.match(/-?\d+(\.\d+)?/g);
              value =
                property === "rotation"
                  ? new flock.BABYLON.Vector3(
                      flock.BABYLON.Tools.ToRadians(
                        parseFloat(vectorValues[0]),
                      ),
                      flock.BABYLON.Tools.ToRadians(
                        parseFloat(vectorValues[1]),
                      ),
                      flock.BABYLON.Tools.ToRadians(
                        parseFloat(vectorValues[2]),
                      ),
                    )
                  : new flock.BABYLON.Vector3(
                      parseFloat(vectorValues[0]),
                      parseFloat(vectorValues[1]),
                      parseFloat(vectorValues[2]),
                    );
            }
          } else {
            value = parseFloat(keyframe.value);
          }

          // Calculate frame duration based on FPS
          const frameDuration = Math.round((keyframe.duration || 1) * fps); // Convert seconds to frames
          const frame = currentFrame;
          currentFrame += frameDuration; // Increment frames
          return { frame, value };
        });

        // Add an initial keyframe at the end for smooth looping if necessary
        if (
          loop &&
          !reverse &&
          forwardKeyframes.length > 0 &&
          keyframes.length > 0 &&
          keyframes[keyframes.length - 1].duration > 0 // Explicit check for non-zero duration
        ) {
          const initialKeyframe = {
            frame: currentFrame,
            value: forwardKeyframes[0].value, // Use the initial keyframe value
          };
          forwardKeyframes.push(initialKeyframe);
          currentFrame += fps; // Increment frames for the loop-back duration
        }

        // Generate reverse keyframes if required
        const reverseKeyframes = reverse
          ? forwardKeyframes
              .slice(0, -1) // Exclude the last frame to avoid duplication
              .reverse()
              .map((keyframe, index) => ({
                frame: currentFrame + index, // Continue frame numbering
                value: keyframe.value,
              }))
          : [];

        // Combine forward and reverse keyframes
        const allKeyframes = [...forwardKeyframes, ...reverseKeyframes];

        // Log generated keyframes for debugging
        //console.log("Generated Keyframes: ", allKeyframes);

        if (allKeyframes.length > 1) {
          keyframeAnimation.setKeys(allKeyframes);
        } else {
          console.warn("Insufficient keyframes for animation.");
          resolve();
          return;
        }

        mesh.animations.push(keyframeAnimation);

        if (property === "alpha") {
          mesh.material.markAsDirty(flock.BABYLON.Material.MiscDirtyFlag);
        }

        const lastFrame = allKeyframes[allKeyframes.length - 1].frame;

        //console.log(`Animating from frame 0 to ${lastFrame}`);

        const animatable = flock.scene.beginAnimation(mesh, 0, lastFrame, loop);

        animatable.onAnimationEndObservable.add(() => {
          //console.log("Animation completed.");
          resolve();
        });
      });
    });
  },
  createAnimation(
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
    return new Promise(async (resolve) => {
      // Ensure animationGroupName is not null; generate a unique name if it is
      animationGroupName =
        animationGroupName || `animation_${flock.scene.getUniqueId()}`;

      // Ensure the animation group exists or create a new one
      let animationGroup =
        flock.scene.getAnimationGroupByName(animationGroupName);
      if (!animationGroup) {
        animationGroup = new flock.BABYLON.AnimationGroup(
          animationGroupName,
          flock.scene,
        );
        //console.log(`Created new animation group: ${animationGroupName}`);
      }

      await flock.whenModelReady(meshName, async (mesh) => {
        if (!mesh) {
          console.warn(`Mesh ${meshName} not found.`);
          resolve(animationGroupName);
          return;
        }
        /*mesh.physics.disablePreStep = false;
        mesh.physics.setPrestepType(
          flock.BABYLON.PhysicsPrestepType.ACTION,
        );*/

        if (property === "alpha") {
          flock.ensureUniqueMaterial(mesh);
        }

        // Determine the meshes to animate
        const meshesToAnimate =
          property === "alpha"
            ? [mesh, ...mesh.getDescendants()].filter((m) => m.material) // Include descendants for alpha
            : [mesh]; // Only the root mesh for other properties

        for (const targetMesh of meshesToAnimate) {
          const propertyToAnimate = flock._resolvePropertyToAnimate(
              property,
              targetMesh,
            ),
            fps = 30, // Frames per second
            animationType = flock._determineAnimationType(property),
            loopMode = flock.BABYLON.Animation.ANIMATIONLOOPMODE_CYCLE; // Always use cycle mode for looping

          const keyframeAnimation = new flock.BABYLON.Animation(
            `${animationGroupName}_${property}`,
            propertyToAnimate,
            fps,
            animationType,
            loopMode,
          );

          // Convert keyframes (with absolute time in seconds) to Babylon.js frames
          const forwardKeyframes = keyframes.map((keyframe) => ({
            frame: Math.round((keyframe.duration || 0) * fps), // Convert seconds to frames
            value: flock._parseKeyframeValue(
              property,
              keyframe.value,
              targetMesh,
            ),
          }));

          // Add a keyframe at frame 0 if one doesn't exist already.
          if (!forwardKeyframes.some((k) => k.frame === 0)) {
            let currentValue;
            if (property === "alpha") {
              // For alpha, get the current alpha from the mesh's material.
              if (
                targetMesh.material &&
                typeof targetMesh.material.alpha !== "undefined"
              ) {
                currentValue = targetMesh.material.alpha;
              } else {
                currentValue = 1; // Default alpha value.
              }
            } else if (
              ["color", "colour", "diffuseColor", "colour_keyframe"].includes(
                property,
              )
            ) {
              // For colors, get and clone the diffuseColor.
              if (targetMesh.material && targetMesh.material.diffuseColor) {
                currentValue = targetMesh.material.diffuseColor.clone();
              } else {
                currentValue = flock.BABYLON.Color3.FromHexString("#ffffff");
              }
            } else {
              // For other properties, read the value directly.
              currentValue = targetMesh[propertyToAnimate];
              if (currentValue && typeof currentValue.clone === "function") {
                currentValue = currentValue.clone();
              }
            }
            forwardKeyframes.unshift({
              frame: 0,
              value: currentValue,
            });
          }

          // Generate reverse keyframes by mirroring forward frames
          const reverseKeyframes = reverse
            ? forwardKeyframes
                .slice(0, -1) // Exclude the last frame to avoid duplication
                .reverse()
                .map((keyframe, index) => ({
                  frame:
                    forwardKeyframes[forwardKeyframes.length - 1].frame +
                    (forwardKeyframes[index + 1]?.frame - keyframe.frame),
                  value: keyframe.value,
                }))
            : [];

          // Combine forward and reverse keyframes
          const allKeyframes = [...forwardKeyframes, ...reverseKeyframes];

          // Ensure sufficient keyframes
          if (allKeyframes.length > 1) {
            keyframeAnimation.setKeys(allKeyframes);
          } else {
            console.warn("Insufficient keyframes for animation.");
            continue; // Skip this mesh
          }

          flock._applyEasing(keyframeAnimation, easing);

          // Add the animation to the group
          flock._addAnimationToGroup(
            animationGroup,
            keyframeAnimation,
            targetMesh,
          );

          //console.log(`Added animation to group "${animationGroupName}" for property "${property}" on mesh "${targetMesh.name}".`);
        }

        if (animationGroup.targetedAnimations.length === 0) {
          console.warn("No animations added to the group.");
          resolve(animationGroupName);
          return;
        }

        if (mode === "START" || mode === "AWAIT") {
          // Start the animation group
          animationGroup.play(loop);

          if (mode === "AWAIT") {
            animationGroup.onAnimationEndObservable.add(() => {
              resolve(animationGroupName);
            });
          } else {
            resolve(animationGroupName);
          }
        } else if (mode === "CREATE") {
          // Do not start the animation group and prevent automatic playback
          animationGroup.stop(); // Explicitly ensure animations do not play
          animationGroup.onAnimationGroupPlayObservable.clear(); // Clear any unintended triggers
          //console.log("Animation group created but not started.");
          resolve(animationGroupName);
        } else {
          console.warn(`Unknown mode: ${mode}`);
          resolve(animationGroup);
        }
      });
    });
  },
  async animateProperty(
    meshName,
    {
      property,
      targetValue,
      duration = 1,
      reverse = false,
      loop = false,
      mode = "AWAIT",
    } = {},
  ) {
    const fps = 30;
    const frames = fps * duration;

    return new Promise(async (resolve) => {
      // Await mesh to be ready
      await flock.whenModelReady(meshName, async function (mesh) {
        if (!mesh) {
          console.error(`Mesh with name ${meshName} not found.`);
          resolve();
          return;
        }

        // If the property is a color, convert the hex string to Color3
        if (
          property === "diffuseColor" ||
          property === "emissiveColor" ||
          property === "ambientColor" ||
          property === "specularColor"
        ) {
          targetValue = flock.BABYLON.Color3.FromHexString(targetValue);
        }

        // Helper function to animate a material property
        function animateProperty(material, property, targetValue) {
          const startValue = material[property];

          // Determine the animation type
          const animationType =
            property === "alpha"
              ? flock.BABYLON.Animation.ANIMATIONTYPE_FLOAT
              : flock.BABYLON.Animation.ANIMATIONTYPE_COLOR3;

          // Create the animation
          const animation = new flock.BABYLON.Animation(
            `animate_${property}`,
            property,
            fps,
            animationType,
            reverse
              ? flock.BABYLON.Animation.ANIMATIONLOOPMODE_YOYO
              : flock.BABYLON.Animation.ANIMATIONLOOPMODE_CONSTANT,
          );

          // Define keyframes
          const keys = [
            { frame: 0, value: startValue },
            { frame: frames, value: targetValue },
          ];
          animation.setKeys(keys);

          material.animations = material.animations || [];
          material.animations.push(animation);

          // Start the animation
          const animatable = flock.scene.beginAnimation(
            material,
            0,
            frames,
            loop,
          );
          material.markAsDirty(flock.BABYLON.Material.MiscDirtyFlag); // Force material update

          return animatable;
        }

        // Function to animate material and its children recursively
        function animateMeshAndChildren(mesh) {
          if (mesh.material) {
            return animateProperty(mesh.material, property, targetValue);
          }
          if (mesh.getChildren) {
            mesh
              .getChildren()
              .forEach((child) => animateMeshAndChildren(child));
          }
        }

        // Start the animation based on the mode (await or start)
        if (mode === "AWAIT") {
          const animatable = animateMeshAndChildren(mesh);
          if (animatable) {
            animatable.onAnimationEndObservable.add(() => {
              resolve();
            });
          } else {
            resolve();
          }
        } else {
          animateMeshAndChildren(mesh);
          resolve();
        }
      });
    });
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
          //console.log(`New animation synchronised to frame ${currentFrame}.`);
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
      //console.log(`Applied easing: ${easing}`);
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
    if (mesh.metadata.requestCounter !== requestCounter) {
      return; // Newer request superseded this one
    }

    if (mesh.metadata.requestedAnimationName !== animationName) {
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
    updateCapsuleShapeForAnimation(physicsMesh, animationName, {
      fallYOffset: -0.4,
    });

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

    // Your groups are named like `${mesh.name}.${animName}`
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

    updateCapsuleShapeForAnimation(physicsMesh, animationName, {
      fallYOffset: -0.4,
    });

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
    const modelName = meshOrGroup.metadata.modelName;

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

    updateCapsuleShapeForAnimation(physicsMesh, animationName, {
      fallYOffset: -0.5,
    });

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
