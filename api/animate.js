import { blockNames, modelAnimationNames } from "../config.js";

let flock;

export function setFlockReference(ref) {
  flock = ref;
}

export const flockAnimate = {
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
      // Check if mesh exists immediately first
      const existingMesh = flock.scene?.getMeshByName(meshName);
      if (!existingMesh) {
        console.warn(`Mesh '${meshName}' not found for animateProperty.`);
        resolve();
        return;
      }

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
          const startPosition = mesh.position.clone(); // Capture start position

          const addY =
            meshName === "__active_camera__"
              ? 0
              : mesh.getBoundingInfo().boundingBox.extendSize.y *
                mesh.scaling.y;

          let targetY = y + addY;

          const endPosition = new flock.BABYLON.Vector3(x, targetY, z);
          const fps = 30;
          const frames = fps * duration;

          const glideAnimation = new flock.BABYLON.Animation(
            "glideTo",
            "position",
            fps,
            flock.BABYLON.Animation.ANIMATIONTYPE_VECTOR3,
            loop || reverse
              ? flock.BABYLON.Animation.ANIMATIONLOOPMODE_CYCLE // Continuous loop or reverse
              : flock.BABYLON.Animation.ANIMATIONLOOPMODE_CONSTANT, // Stops at end
          );

          // Define keyframes for forward and reverse motion
          const glideKeys = [
            { frame: 0, value: startPosition }, // Start position
            { frame: frames, value: endPosition }, // End position
          ];

          // Add reverse motion if required
          if (reverse || loop) {
            glideKeys.push(
              { frame: frames * 2, value: startPosition }, // Return to start
            );
          }

          // Set keyframes
          glideAnimation.setKeys(glideKeys);

          // Apply easing if specified
          if (easing !== "Linear") {
            let easingFunction;
            switch (easing) {
              case "SineEase":
                easingFunction = new flock.BABYLON.SineEase();
                break;
              case "CubicEase":
                easingFunction = new flock.BABYLON.CubicEase();
                break;
              case "QuadraticEase":
                easingFunction = new flock.BABYLON.QuadraticEase();
                break;
              case "ExponentialEase":
                easingFunction = new flock.BABYLON.ExponentialEase();
                break;
              case "BounceEase":
                easingFunction = new flock.BABYLON.BounceEase();
                break;
              case "ElasticEase":
                easingFunction = new flock.BABYLON.ElasticEase();
                break;
              case "BackEase":
                easingFunction = new flock.BABYLON.BackEase();
                break;
              default:
                easingFunction = new flock.BABYLON.SineEase(); // Default to SineEase
            }
            easingFunction.setEasingMode(
              flock.BABYLON.EasingFunction.EASINGMODE_EASEINOUT,
            );
            glideAnimation.setEasingFunction(easingFunction);
          }

          // Attach the animation to the mesh
          mesh.animations.push(glideAnimation);

          // Start the animation
          const animatable = flock.scene.beginAnimation(
            mesh,
            0,
            reverse ? frames * 2 : frames,
            loop,
          );

          if (mesh.physics) {
            mesh.physics.disablePreStep = false;
            mesh.physics.setPrestepType(
              flock.BABYLON.PhysicsPrestepType.ACTION,
            );
          }
          animatable.onAnimationEndObservable.add(() => {
            if (reverse) {
              // Ensure mesh ends at the final position for non-looping animations
              mesh.position = startPosition.clone();
            } else {
              mesh.position = endPosition.clone();
            }
            resolve();
          });
        } else {
          resolve(); // Resolve immediately if the mesh is not available
        }
      });
    });
  },
  async glideToObject(
    meshName1,
    meshName2,
    {
      duration = 1,
      reverse = false,
      loop = false,
      easing = "Linear",
    } = {},
  ) {
    return new Promise(async (resolve) => {
        await flock.whenModelReady(meshName1, async function (mesh1) {
          if (mesh1) {
            flock.whenModelReady(meshName2, async function (mesh2) {
              if (mesh2) {
                const x = mesh2.position.x;
                const y = mesh2.position.y;
                const z = mesh2.position.z;
                await flockAnimate.glideTo(meshName1, {
                  x,
                  y,
                  z,
                  duration,
                  reverse,
                  loop,
                  easing,
                });
                resolve();
              } else {
                resolve();
              }
            });
          } else {
            resolve(); // Resolve immediately if mesh1 is not available
          }
        });
    });
  },
  resolvePropertyToAnimate(property, mesh) {
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
  determineAnimationType(property) {
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
  parseKeyframeValue(property, value, mesh) {
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
  findFirstDescendantWithMaterial(mesh) {
    if (mesh.material) return mesh;
    const descendants = mesh.getDescendants();
    return descendants.find((descendant) => descendant.material) || null;
  },
  addAnimationToGroup(animationGroup, animation, target) {
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
          const propertyToAnimate = flock.resolvePropertyToAnimate(
              property,
              targetMesh,
            ),
            fps = 30, // Frames per second
            animationType = flock.determineAnimationType(property),
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
            value: flock.parseKeyframeValue(
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

          // Apply easing function
          flock.applyEasing(keyframeAnimation, easing);

          // Add the animation to the group
          flock.addAnimationToGroup(
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
  applyEasing(animation, easing) {
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
      // Check if mesh exists immediately first
      const existingMesh = flock.scene?.getMeshByName(meshName);
      if (!existingMesh) {
        console.warn(`Mesh '${meshName}' not found for animateKeyFrames.`);
        resolve();
        return;
      }

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
  stopAnimations(modelName) {
    return flock.whenModelReady(modelName, (mesh) => {
      if (mesh && mesh.animations) {
        // Stop all animations directly on the mesh
        flock.scene.stopAnimation(mesh);
      }

      // Alternatively, if using animation groups:
      if (mesh.animationGroups) {
        mesh.animationGroups.forEach((group) => {
          group.stop();
        });
      }
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
        flock.animationGroupTargetsDescendant(animationGroup, mesh)
      ) {
        animationGroup.stop();
      }
    });
  },
  animationGroupTargetsDescendant(animationGroup, parentMesh) {
    let descendants = parentMesh.getDescendants();
    for (let targetedAnimation of animationGroup.targetedAnimations) {
      let target = targetedAnimation.target;
      if (descendants.includes(target)) {
        return true;
      }
    }
    return false;
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
      return flock.switchToAnimationModel(
        scene,
        meshOrGroup,
        animationName,
        loop,
        restart,
      );
    } else if (flock.separateAnimations) {
      // || meshOrGroup.name.includes('ANIMTEST'))

      return flock.switchToAnimationLoad(
        scene,
        meshOrGroup,
        animationName,
        loop,
        restart,
        play,
      );
    } else {
      return flock.switchToAnimationModel(
        scene,
        meshOrGroup,
        animationName,
        loop,
        restart,
      );
    }
  },
  async switchToAnimationLoad2(
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

        const boneMap = {},
          tnMap = {};
        mesh.skeleton.bones.forEach((b) => {
          boneMap[b.name] = b;
          if (b._linkedTransformNode)
            tnMap[b._linkedTransformNode.name] = b._linkedTransformNode;
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

    if (
      physicsMesh &&
      physicsMesh.physics &&
      physicsMesh.physics.shape &&
      physicsMesh.physics.shape.constructor.name === "_PhysicsShapeCapsule"
    ) {
      // Determine desired physics shape type based on animation name
      let desiredShapeType = "vertical";
      if (animationName === "Fly") {
        desiredShapeType = "horizontal-fly";
      } else if (animationName === "Fall") {
        desiredShapeType = "horizontal-fall";
      } else if (animationName === "Sitting" || animationName === "Sit_Down") {
        //console.log("Sitting animation detected");
        desiredShapeType = "sitting";
      }

      // Only update if the shape type has changed
      if (
        !mesh.metadata.currentPhysicsShapeType ||
        mesh.metadata.currentPhysicsShapeType !== desiredShapeType
      ) {
        // Preserve physics properties
        const motionType = physicsMesh.physics.getMotionType();
        const massProps = physicsMesh.physics.getMassProperties();
        const disablePreStep = physicsMesh.physics.disablePreStep;

        // Create new shape based on animation
        // Always use physicsMesh which has the full body bounding box
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
            -0.4,
          );
        } else if (desiredShapeType === "sitting") {
          newShape = flock.createSittingCapsuleFromBoundingBox(
            physicsMesh,
            flock.scene,
          );
        } else {
          newShape = flock.createCapsuleFromBoundingBox(
            physicsMesh,
            flock.scene,
          );
        }

        // Update the physics shape
        physicsMesh.physics.shape = newShape;

        // Restore physics properties
        physicsMesh.physics.setMotionType(motionType);
        physicsMesh.physics.setMassProperties(massProps);
        physicsMesh.physics.disablePreStep = disablePreStep;

        // Track the current physics shape type
        mesh.metadata.currentPhysicsShapeType = desiredShapeType;
      }
    }

    if (!retargetedGroup.isPlaying || restart) {
      retargetedGroup.stop();
      retargetedGroup.reset();
      retargetedGroup.start(loop);
    }

    return retargetedGroup;
  },
  activateAnimation(
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
    if (
      physicsMesh &&
      physicsMesh.physics &&
      physicsMesh.physics.shape &&
      physicsMesh.physics.shape.constructor.name === "_PhysicsShapeCapsule"
    ) {
      let desiredShapeType = "vertical";
      if (animationName === "Fly") {
        desiredShapeType = "horizontal-fly";
      } else if (animationName === "Fall") {
        desiredShapeType = "horizontal-fall";
      } else if (animationName === "Sitting" || animationName === "Sit_Down") {
        desiredShapeType = "sitting";
      }

      if (
        !mesh.metadata.currentPhysicsShapeType ||
        mesh.metadata.currentPhysicsShapeType !== desiredShapeType
      ) {
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
            -0.4,
          );
        } else if (desiredShapeType === "sitting") {
          newShape = flock.createSittingCapsuleFromBoundingBox(
            physicsMesh,
            flock.scene,
          );
        } else {
          newShape = flock.createCapsuleFromBoundingBox(
            physicsMesh,
            flock.scene,
          );
        }

        physicsMesh.physics.shape = newShape;
        physicsMesh.physics.setMotionType(motionType);
        physicsMesh.physics.setMassProperties(massProps);
        physicsMesh.physics.disablePreStep = disablePreStep;
        mesh.metadata.currentPhysicsShapeType = desiredShapeType;
      }
    }

    // Start animation
    if (!retargetedGroup.isPlaying || restart) {
      retargetedGroup.stop();
      retargetedGroup.reset();
      retargetedGroup.start(loop);
    }
  },
  async switchToAnimationLoad(
    scene,
    meshOrGroup,
    animationName,
    loop = true,
    restart = false,
    play = true,
  ) {
    // Validate critical dependencies
    if (!scene || !meshOrGroup || !animationName) {
      console.warn('switchToAnimationLoad: Missing required parameters');
      return null;
    }

    if (!flock?.BABYLON || !flock?.scene || typeof flock.activateAnimation !== 'function') {
      console.error('switchToAnimationLoad: Required flock dependencies not available');
      return null;
    }

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
    if (!mesh || !mesh.skeleton) {
      console.warn('switchToAnimationLoad: No skeleton found on mesh');
      return null;
    }

    // Initialize metadata structure
    if (!mesh.metadata) mesh.metadata = {};
    if (!mesh.metadata.animationGroups) mesh.metadata.animationGroups = {};
    if (!mesh.metadata.inflightLoads) mesh.metadata.inflightLoads = {};

    const cache = mesh.metadata.animationGroups;
    const inflight = mesh.metadata.inflightLoads;

    // Always initialize request counter, even if not playing
    mesh.metadata.requestCounter = (mesh.metadata.requestCounter || 0) + 1;
    const currentRequest = mesh.metadata.requestCounter;

    // Record intent when we plan to play
    if (play) {
      mesh.metadata.requestedAnimationName = animationName;
    }

    // Check cache atomically - get reference once
    const cachedEntry = cache[animationName];

    // Handle promise (still loading)
    if (cachedEntry && typeof cachedEntry.then === 'function') {
      return null; // Already loading, don't block
    }

    // Handle error state (previous load failed)
    if (cachedEntry && cachedEntry._loadError) {
      console.warn(`Animation ${animationName} previously failed to load`);
      return null;
    }

    // Handle loaded animation group
    if (cachedEntry && cachedEntry instanceof flock.BABYLON.AnimationGroup) {
      if (!play) {
        return cachedEntry;
      }

      // Check if this is still the requested animation
      if (mesh.metadata.requestedAnimationName !== animationName) {
        return cachedEntry;
      }

      // Activate with error handling
      try {
        flock.activateAnimation(
          mesh,
          meshOrGroup,
          cachedEntry,
          animationName,
          loop,
          restart,
          currentRequest
        );
      } catch (error) {
        console.error(`Failed to activate animation ${animationName}:`, error);
      }
      return cachedEntry;
    }

    // Not loaded yet - start loading
    if (inflight[animationName]) {
      return null; // Already loading, don't duplicate
    }

    inflight[animationName] = true;

    const loadPromise = (async () => {
      try {
        const modelName = meshOrGroup.metadata?.modelName;

        // Safe check for blockNames
        const useBlockSuffix = 
          typeof blockNames !== 'undefined' && 
          Array.isArray(blockNames) && 
          blockNames.includes(modelName);

        const animationFile = useBlockSuffix
          ? animationName + '_Block'
          : animationName;

        const animImport = await flock.BABYLON.SceneLoader.LoadAssetContainerAsync(
          './animations/',
          animationFile + '.glb',
          flock.scene,
          undefined,
          undefined,
          { gltf: { animationStartMode: flock.BABYLON_LOADER.GLTFLoaderAnimationStartMode.NONE } },
        );

        const animGroup = animImport.animationGroups.find(
          (ag) => ag.name === animationName && ag.targetedAnimations.length > 0,
        );

        if (!animGroup) {
          console.warn(`Animation group ${animationName} not found in loaded file`);
          animImport.dispose();
          return { _loadError: true, _errorMessage: 'Animation group not found' };
        }

        // Build bone and transform node maps
        const boneMap = {};
        const tnMap = {};
        mesh.skeleton.bones.forEach((b) => {
          boneMap[b.name] = b;
          if (b._linkedTransformNode) {
            tnMap[b._linkedTransformNode.name] = b._linkedTransformNode;
          }
        });

        // Create retargeted animation group
        const newGroup = new flock.BABYLON.AnimationGroup(
          `${mesh.name}.${animationName}`,
          scene
        );

        for (const ta of animGroup.targetedAnimations) {
          let target = null;
          if (ta.target instanceof flock.BABYLON.Bone) {
            target = boneMap[ta.target.name];
          } else if (ta.target instanceof flock.BABYLON.TransformNode) {
            target = tnMap[ta.target.name];
          }

          if (target && ta.animation?.targetProperty !== 'scaling') {
            const animCopy = ta.animation.clone(`${ta.animation.name}_${mesh.name}`);
            newGroup.addTargetedAnimation(animCopy, target);
          }
        }

        animImport.dispose();
        return newGroup;

      } catch (error) {
        console.error(`Failed to load animation ${animationName}:`, error);
        return { _loadError: true, _errorMessage: error.message };
      } finally {
        delete inflight[animationName];
      }
    })();

    // Store promise in cache
    cache[animationName] = loadPromise;

    // Auto-activate when loaded
    loadPromise.then((result) => {
      // Replace promise with actual result (group or error object)
      cache[animationName] = result;

      // Only activate if it's a valid group and conditions are met
      if (
        result &&
        result instanceof flock.BABYLON.AnimationGroup &&
        play &&
        mesh.metadata.requestedAnimationName === animationName
      ) {
        try {
          flock.activateAnimation(
            mesh,
            meshOrGroup,
            result,
            animationName,
            loop,
            restart,
            currentRequest
          );
        } catch (error) {
          console.error(`Failed to activate animation ${animationName} after load:`, error);
        }
      }
    }).catch((error) => {
      // Shouldn't reach here due to try-catch above, but safety net
      console.error(`Unexpected error in animation load promise for ${animationName}:`, error);
      cache[animationName] = { _loadError: true, _errorMessage: error.message };
    });

    return null; // Return immediately
  },
  async switchToAnimationLoad2(
    scene,
    meshOrGroup,
    animationName,
    loop = true,
    restart = false,
    play = true,
  ) {
    // ---- resolve a mesh that (eventually) has a skeleton ----
    const resolveMeshWithSkeletonNow = (root) => {
      if (!root) return null;
      if (root.skeleton) return root;
      if (root.getChildMeshes) {
        for (const c of root.getChildMeshes()) if (c.skeleton) return c;
      }
      return null;
    };

    const meshCandidate =
      typeof meshOrGroup === "string"
        ? scene.getMeshByName(meshOrGroup) ||
          scene.getTransformNodeByName(meshOrGroup)
        : meshOrGroup;

    // Ensure metadata scaffolding even before skeleton is present
    if (meshCandidate && !meshCandidate.metadata) meshCandidate.metadata = {};
    if (meshCandidate) {
      meshCandidate.metadata._animCache ||= { groups: {}, inflight: {} };
    }

    // Record "intent" early so the latest request wins.
    if (meshCandidate && play)
      meshCandidate.metadata.requestedAnimationName = animationName;
    if (meshCandidate) {
      meshCandidate.metadata._animReqCounter =
        (meshCandidate.metadata._animReqCounter || 0) + 1;
    }
    const requestToken = meshCandidate?.metadata?._animReqCounter || 0;

    // If the skeleton isn't available yet, arm a one-time observer to retry once it's ready.
    const meshNow = resolveMeshWithSkeletonNow(meshCandidate);
    if (!meshNow || !meshNow.skeleton) {
      if (scene && meshCandidate) {
        // Avoid multiple arms for the same (mesh, request) by tagging
        const tagKey = `_flockAwaitSkeleton_${animationName}_${requestToken}`;
        if (!meshCandidate.metadata[tagKey]) {
          meshCandidate.metadata[tagKey] = true;
          scene.onBeforeRenderObservable.addOnce(() => {
            // Re-enter once; if skeleton is ready then, we'll proceed and auto-start.
            switchToAnimationLoad(
              scene,
              meshCandidate,
              animationName,
              loop,
              restart,
              play,
            );
          });
        }
      }
      return null; // non-blocking; simple projects will still start once skeleton appears
    }

    const mesh = meshNow; // from here on we have a skeleton

    // ---- caches ----
    mesh.metadata ||= {};
    mesh.metadata._animCache ||= { groups: {}, inflight: {} };
    const cacheGroups = mesh.metadata._animCache.groups;
    const cacheInflight = mesh.metadata._animCache.inflight;

    const isGroupAlive = (ag) =>
      !!ag &&
      !ag.isDisposed &&
      Array.isArray(ag.targetedAnimations) &&
      ag.targetedAnimations.length > 0 &&
      ag.targetedAnimations.every((ta) => !!ta?.animation && !!ta?.target);

    const withTimeout = (p, ms) => {
      let t;
      const to = new Promise(
        (_, rej) => (t = setTimeout(() => rej(new Error("timeout")), ms)),
      );
      return Promise.race([p, to]).finally(() => clearTimeout(t));
    };

    // Helper: activate a resolved group (idempotent, no per-frame reset)
    const activateGroup = (group) => {
      if (!group || !isGroupAlive(group)) return;
      // only latest request may act
      if (requestToken !== mesh.metadata._animReqCounter) return;
      if (mesh.metadata.requestedAnimationName !== animationName) return;

      const sameGroupActive = mesh._currentAnimGroup === group;

      // Stop siblings only when switching
      if (!sameGroupActive) {
        const all = scene.animationGroups || [];
        for (const ag of all) {
          if (ag === group) continue;
          if (!isGroupAlive(ag)) continue;
          const touches = ag.targetedAnimations.some(
            (ta) =>
              ta.target instanceof flock.BABYLON.Bone &&
              ta.target.skeleton === mesh.skeleton,
          );
          if (touches && ag.isPlaying) {
            try {
              ag.stop();
            } catch {}
          }
        }
      }

      // Mark current
      mesh._currentAnimGroup = group;
      mesh.metadata.currentAnimationName = animationName;

      // Prime ONCE per (group, skeleton)
      const skelId = mesh.skeleton.uniqueId;
      group._flockPrimed ||= {};
      if (!group._flockPrimed[skelId]) {
        try {
          group.normalize(0, null);
        } catch {}
        try {
          group.reset();
        } catch {}
        try {
          group.goToFrame(0);
        } catch {}
        group._flockPrimed[skelId] = true;
      }

      if (!(typeof group.speedRatio === "number" && group.speedRatio > 0))
        group.speedRatio = 1;

      if (sameGroupActive && !restart) {
        if (!group.isPlaying) {
          try {
            group.start(loop);
          } catch {}
          if (!group.isPlaying) {
            try {
              group.play(loop);
            } catch {}
          }
        } else {
          group.loopAnimation = !!loop;
        }
      } else {
        try {
          group.stop();
        } catch {}
        try {
          group.reset();
        } catch {}
        try {
          group.goToFrame(0);
        } catch {}
        try {
          group.start(loop);
        } catch {}
        if (!group.isPlaying) {
          try {
            group.play(loop);
          } catch {}
        }
      }

      // One-frame watchdog if we just switched or weren't playing
      if (!sameGroupActive || restart || !group.isPlaying) {
        scene.onBeforeRenderObservable.addOnce(() => {
          if (requestToken !== mesh.metadata._animReqCounter) return;
          if (!isGroupAlive(group) || group.isPlaying) return;
          try {
            group.reset();
          } catch {}
          try {
            group.goToFrame(0);
          } catch {}
          if (!(typeof group.speedRatio === "number" && group.speedRatio > 0))
            group.speedRatio = 1;
          try {
            group.start(loop);
          } catch {}
          if (!group.isPlaying) {
            try {
              group.play(loop);
            } catch {}
          }
        });
      }

      // Physics capsule update (unchanged behaviour)
      const body = meshOrGroup?.physics;
      if (
        body?.shape &&
        body.shape.constructor?.name === "_PhysicsShapeCapsule"
      ) {
        let desired = "vertical";
        if (animationName === "Fly") desired = "horizontal-fly";
        else if (animationName === "Fall") desired = "horizontal-fall";
        else if (animationName === "Sitting" || animationName === "Sit_Down")
          desired = "sitting";

        if (mesh.metadata.currentPhysicsShapeType !== desired) {
          const motionType = body.getMotionType();
          const massProps = body.getMassProperties();
          const disablePreStep = body.disablePreStep;

          let newShape;
          if (desired === "horizontal-fly") {
            newShape = flock.createHorizontalCapsuleFromBoundingBox(
              meshOrGroup,
              flock.scene,
              0,
            );
          } else if (desired === "horizontal-fall") {
            newShape = flock.createHorizontalCapsuleFromBoundingBox(
              meshOrGroup,
              flock.scene,
              -0.4,
            );
          } else if (desired === "sitting") {
            newShape = flock.createSittingCapsuleFromBoundingBox(
              meshOrGroup,
              flock.scene,
            );
          } else {
            newShape = flock.createCapsuleFromBoundingBox(
              meshOrGroup,
              flock.scene,
            );
          }

          if (requestToken === mesh.metadata._animReqCounter) {
            body.shape = newShape;
            body.setMotionType(motionType);
            body.setMassProperties(massProps);
            body.disablePreStep = disablePreStep;
            mesh.metadata.currentPhysicsShapeType = desired;
          }
        }
      }
    };

    // ---- resolved group? ----
    let group = cacheGroups[animationName];
    if (group && !isGroupAlive(group)) {
      delete cacheGroups[animationName];
      group = null;
    }

    // If loading already, return now. When it resolves, we’ll auto-activate.
    if (!group && cacheInflight[animationName]) return null;

    // ---- start a background load if needed ----
    if (!group) {
      const modelName = mesh.metadata?.modelName;
      const animationFile =
        typeof blockNames !== "undefined" && blockNames.includes(modelName)
          ? animationName + "_Block"
          : animationName;

      cacheInflight[animationName] = (async () => {
        try {
          const container = await withTimeout(
            flock.BABYLON.SceneLoader.LoadAssetContainerAsync(
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
            ),
            7000,
          );
          try {
            const src = container.animationGroups.find(
              (ag) =>
                ag.name === animationName && ag.targetedAnimations.length > 0,
            );
            if (!src) return null;

            // Retarget to this skeleton
            const boneMap = {},
              tnMap = {};
            mesh.skeleton.bones.forEach((b) => {
              boneMap[b.name] = b;
              if (b._linkedTransformNode)
                tnMap[b._linkedTransformNode.name] = b._linkedTransformNode;
            });

            const newGroup = new flock.BABYLON.AnimationGroup(
              `${mesh.name}.${animationName}`,
              scene,
            );
            for (const ta of src.targetedAnimations) {
              let target = null;
              if (ta.target instanceof flock.BABYLON.Bone)
                target = boneMap[ta.target.name];
              else if (ta.target instanceof flock.BABYLON.TransformNode)
                target = tnMap[ta.target.name];
              if (target && ta.animation?.targetProperty !== "scaling") {
                const cloned = ta.animation.clone(
                  `${ta.animation.name}_${mesh.name}`,
                );
                newGroup.addTargetedAnimation(cloned, target);
              }
            }
            return isGroupAlive(newGroup) ? newGroup : null;
          } finally {
            container.dispose();
          }
        } catch {
          return null;
        }
      })();

      cacheInflight[animationName]
        .then((loaded) => {
          if (loaded) cacheGroups[animationName] = loaded;
          // Auto-activate if play was requested and the request is still current.
          if (
            loaded &&
            play &&
            mesh.metadata?.requestedAnimationName === animationName
          ) {
            activateGroup(loaded);
          }
        })
        .finally(() => {
          delete cacheInflight[animationName];
        });

      return null; // non-blocking
    }

    // ---- already have the group ----
    if (!play) return group;
    activateGroup(group);
    return group;
  },
  getCurrentAnimationName(meshOrGroup) {
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

    return mesh.metadata.currentAnimationName || null;
  },
  getCurrentAnimationInfo(meshOrGroup) {
    // Find mesh with skeleton
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
    if (!animName || !scene) return { name: null, isLooping: false };

    // Try to find a Babylon AnimationGroup that matches
    const group = scene.animationGroups.find(g => g.name === animName);
    const isLooping = group ? !!group.loopAnimation : false;

    return { name: animName, isLooping };
  },
  async switchToAnimationLoad(
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

        const boneMap = {},
          tnMap = {};
        mesh.skeleton.bones.forEach((b) => {
          boneMap[b.name] = b;
          if (b._linkedTransformNode)
            tnMap[b._linkedTransformNode.name] = b._linkedTransformNode;
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

    if (
      physicsMesh &&
      physicsMesh.physics &&
      physicsMesh.physics.shape &&
      physicsMesh.physics.shape.constructor.name === "_PhysicsShapeCapsule"
    ) {
      // Determine desired physics shape type based on animation name
      let desiredShapeType = "vertical";
      if (animationName === "Fly") {
        desiredShapeType = "horizontal-fly";
      } else if (animationName === "Fall") {
        desiredShapeType = "horizontal-fall";
      } else if (animationName === "Sitting" || animationName === "Sit_Down") {
        //console.log("Sitting animation detected");
        desiredShapeType = "sitting";
      }

      // Only update if the shape type has changed
      if (
        !mesh.metadata.currentPhysicsShapeType ||
        mesh.metadata.currentPhysicsShapeType !== desiredShapeType
      ) {
        // Preserve physics properties
        const motionType = physicsMesh.physics.getMotionType();
        const massProps = physicsMesh.physics.getMassProperties();
        const disablePreStep = physicsMesh.physics.disablePreStep;

        // Create new shape based on animation
        // Always use physicsMesh which has the full body bounding box
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
            -0.4,
          );
        } else if (desiredShapeType === "sitting") {
          newShape = flock.createSittingCapsuleFromBoundingBox(
            physicsMesh,
            flock.scene,
          );
        } else {
          newShape = flock.createCapsuleFromBoundingBox(
            physicsMesh,
            flock.scene,
          );
        }

        // Update the physics shape
        physicsMesh.physics.shape = newShape;

        // Restore physics properties
        physicsMesh.physics.setMotionType(motionType);
        physicsMesh.physics.setMassProperties(massProps);
        physicsMesh.physics.disablePreStep = disablePreStep;

        // Track the current physics shape type
        mesh.metadata.currentPhysicsShapeType = desiredShapeType;
      }
    }

    if (!retargetedGroup.isPlaying || restart) {
      retargetedGroup.stop();
      retargetedGroup.reset();
      retargetedGroup.start(loop);
    }

    return retargetedGroup;
  },
  async switchToAnimationLoad2(
    scene,
    meshOrGroup,
    animationName,
    loop = true,
    restart = false,
    play = true,
  ) {
    // ---- resolve a mesh that (eventually) has a skeleton ----
    const resolveMeshWithSkeletonNow = (root) => {
      if (!root) return null;
      if (root.skeleton) return root;
      if (root.getChildMeshes) {
        for (const c of root.getChildMeshes()) if (c.skeleton) return c;
      }
      return null;
    };

    const meshCandidate =
      typeof meshOrGroup === "string"
        ? scene.getMeshByName(meshOrGroup) ||
          scene.getTransformNodeByName(meshOrGroup)
        : meshOrGroup;

    // Ensure metadata scaffolding even before skeleton is present
    if (meshCandidate && !meshCandidate.metadata) meshCandidate.metadata = {};
    if (meshCandidate) {
      meshCandidate.metadata._animCache ||= { groups: {}, inflight: {} };
    }

    // Record "intent" early so the latest request wins.
    if (meshCandidate && play)
      meshCandidate.metadata.requestedAnimationName = animationName;
    if (meshCandidate) {
      meshCandidate.metadata._animReqCounter =
        (meshCandidate.metadata._animReqCounter || 0) + 1;
    }
    const requestToken = meshCandidate?.metadata?._animReqCounter || 0;

    // If the skeleton isn't available yet, arm a one-time observer to retry once it's ready.
    const meshNow = resolveMeshWithSkeletonNow(meshCandidate);
    if (!meshNow || !meshNow.skeleton) {
      if (scene && meshCandidate) {
        // Avoid multiple arms for the same (mesh, request) by tagging
        const tagKey = `_flockAwaitSkeleton_${animationName}_${requestToken}`;
        if (!meshCandidate.metadata[tagKey]) {
          meshCandidate.metadata[tagKey] = true;
          scene.onBeforeRenderObservable.addOnce(() => {
            // Re-enter once; if skeleton is ready then, we'll proceed and auto-start.
            switchToAnimationLoad(
              scene,
              meshCandidate,
              animationName,
              loop,
              restart,
              play,
            );
          });
        }
      }
      return null; // non-blocking; simple projects will still start once skeleton appears
    }

    const mesh = meshNow; // from here on we have a skeleton

    // ---- caches ----
    mesh.metadata ||= {};
    mesh.metadata._animCache ||= { groups: {}, inflight: {} };
    const cacheGroups = mesh.metadata._animCache.groups;
    const cacheInflight = mesh.metadata._animCache.inflight;

    const isGroupAlive = (ag) =>
      !!ag &&
      !ag.isDisposed &&
      Array.isArray(ag.targetedAnimations) &&
      ag.targetedAnimations.length > 0 &&
      ag.targetedAnimations.every((ta) => !!ta?.animation && !!ta?.target);

    const withTimeout = (p, ms) => {
      let t;
      const to = new Promise(
        (_, rej) => (t = setTimeout(() => rej(new Error("timeout")), ms)),
      );
      return Promise.race([p, to]).finally(() => clearTimeout(t));
    };

    // Helper: activate a resolved group (idempotent, no per-frame reset)
    const activateGroup = (group) => {
      if (!group || !isGroupAlive(group)) return;
      // only latest request may act
      if (requestToken !== mesh.metadata._animReqCounter) return;
      if (mesh.metadata.requestedAnimationName !== animationName) return;

      const sameGroupActive = mesh._currentAnimGroup === group;

      // Stop siblings only when switching
      if (!sameGroupActive) {
        const all = scene.animationGroups || [];
        for (const ag of all) {
          if (ag === group) continue;
          if (!isGroupAlive(ag)) continue;
          const touches = ag.targetedAnimations.some(
            (ta) =>
              ta.target instanceof flock.BABYLON.Bone &&
              ta.target.skeleton === mesh.skeleton,
          );
          if (touches && ag.isPlaying) {
            try {
              ag.stop();
            } catch {}
          }
        }
      }

      // Mark current
      mesh._currentAnimGroup = group;
      mesh.metadata.currentAnimationName = animationName;

      // Prime ONCE per (group, skeleton)
      const skelId = mesh.skeleton.uniqueId;
      group._flockPrimed ||= {};
      if (!group._flockPrimed[skelId]) {
        try {
          group.normalize(0, null);
        } catch {}
        try {
          group.reset();
        } catch {}
        try {
          group.goToFrame(0);
        } catch {}
        group._flockPrimed[skelId] = true;
      }

      if (!(typeof group.speedRatio === "number" && group.speedRatio > 0))
        group.speedRatio = 1;

      if (sameGroupActive && !restart) {
        if (!group.isPlaying) {
          try {
            group.start(loop);
          } catch {}
          if (!group.isPlaying) {
            try {
              group.play(loop);
            } catch {}
          }
        } else {
          group.loopAnimation = !!loop;
        }
      } else {
        try {
          group.stop();
        } catch {}
        try {
          group.reset();
        } catch {}
        try {
          group.goToFrame(0);
        } catch {}
        try {
          group.start(loop);
        } catch {}
        if (!group.isPlaying) {
          try {
            group.play(loop);
          } catch {}
        }
      }

      // One-frame watchdog if we just switched or weren't playing
      if (!sameGroupActive || restart || !group.isPlaying) {
        scene.onBeforeRenderObservable.addOnce(() => {
          if (requestToken !== mesh.metadata._animReqCounter) return;
          if (!isGroupAlive(group) || group.isPlaying) return;
          try {
            group.reset();
          } catch {}
          try {
            group.goToFrame(0);
          } catch {}
          if (!(typeof group.speedRatio === "number" && group.speedRatio > 0))
            group.speedRatio = 1;
          try {
            group.start(loop);
          } catch {}
          if (!group.isPlaying) {
            try {
              group.play(loop);
            } catch {}
          }
        });
      }

      // Physics capsule update (unchanged behaviour)
      const body = meshOrGroup?.physics;
      if (
        body?.shape &&
        body.shape.constructor?.name === "_PhysicsShapeCapsule"
      ) {
        let desired = "vertical";
        if (animationName === "Fly") desired = "horizontal-fly";
        else if (animationName === "Fall") desired = "horizontal-fall";
        else if (animationName === "Sitting" || animationName === "Sit_Down")
          desired = "sitting";

        if (mesh.metadata.currentPhysicsShapeType !== desired) {
          const motionType = body.getMotionType();
          const massProps = body.getMassProperties();
          const disablePreStep = body.disablePreStep;

          let newShape;
          if (desired === "horizontal-fly") {
            newShape = flock.createHorizontalCapsuleFromBoundingBox(
              meshOrGroup,
              flock.scene,
              0,
            );
          } else if (desired === "horizontal-fall") {
            newShape = flock.createHorizontalCapsuleFromBoundingBox(
              meshOrGroup,
              flock.scene,
              -0.4,
            );
          } else if (desired === "sitting") {
            newShape = flock.createSittingCapsuleFromBoundingBox(
              meshOrGroup,
              flock.scene,
            );
          } else {
            newShape = flock.createCapsuleFromBoundingBox(
              meshOrGroup,
              flock.scene,
            );
          }

          if (requestToken === mesh.metadata._animReqCounter) {
            body.shape = newShape;
            body.setMotionType(motionType);
            body.setMassProperties(massProps);
            body.disablePreStep = disablePreStep;
            mesh.metadata.currentPhysicsShapeType = desired;
          }
        }
      }
    };

    // ---- resolved group? ----
    let group = cacheGroups[animationName];
    if (group && !isGroupAlive(group)) {
      delete cacheGroups[animationName];
      group = null;
    }

    // If loading already, return now. When it resolves, we’ll auto-activate.
    if (!group && cacheInflight[animationName]) return null;

    // ---- start a background load if needed ----
    if (!group) {
      const modelName = mesh.metadata?.modelName;
      const animationFile =
        typeof blockNames !== "undefined" && blockNames.includes(modelName)
          ? animationName + "_Block"
          : animationName;

      cacheInflight[animationName] = (async () => {
        try {
          const container = await withTimeout(
            flock.BABYLON.SceneLoader.LoadAssetContainerAsync(
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
            ),
            7000,
          );
          try {
            const src = container.animationGroups.find(
              (ag) =>
                ag.name === animationName && ag.targetedAnimations.length > 0,
            );
            if (!src) return null;

            // Retarget to this skeleton
            const boneMap = {},
              tnMap = {};
            mesh.skeleton.bones.forEach((b) => {
              boneMap[b.name] = b;
              if (b._linkedTransformNode)
                tnMap[b._linkedTransformNode.name] = b._linkedTransformNode;
            });

            const newGroup = new flock.BABYLON.AnimationGroup(
              `${mesh.name}.${animationName}`,
              scene,
            );
            for (const ta of src.targetedAnimations) {
              let target = null;
              if (ta.target instanceof flock.BABYLON.Bone)
                target = boneMap[ta.target.name];
              else if (ta.target instanceof flock.BABYLON.TransformNode)
                target = tnMap[ta.target.name];
              if (target && ta.animation?.targetProperty !== "scaling") {
                const cloned = ta.animation.clone(
                  `${ta.animation.name}_${mesh.name}`,
                );
                newGroup.addTargetedAnimation(cloned, target);
              }
            }
            return isGroupAlive(newGroup) ? newGroup : null;
          } finally {
            container.dispose();
          }
        } catch {
          return null;
        }
      })();

      cacheInflight[animationName]
        .then((loaded) => {
          if (loaded) cacheGroups[animationName] = loaded;
          // Auto-activate if play was requested and the request is still current.
          if (
            loaded &&
            play &&
            mesh.metadata?.requestedAnimationName === animationName
          ) {
            activateGroup(loaded);
          }
        })
        .finally(() => {
          delete cacheInflight[animationName];
        });

      return null; // non-blocking
    }

    // ---- already have the group ----
    if (!play) return group;
    activateGroup(group);
    return group;
  },
  getCurrentAnimationName(meshOrGroup) {
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

    return mesh.metadata.currentAnimationName || null;
  },
  switchToAnimationModel(
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
        flock.animationGroupTargetsDescendant(group, mesh),
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

    if (
      physicsMesh &&
      physicsMesh.physics &&
      physicsMesh.physics.shape &&
      physicsMesh.physics.shape.constructor.name === "_PhysicsShapeCapsule"
    ) {
      // Find mesh with skeleton for bounding box calculation
      const findMeshWithSkeleton = (rootMesh) => {
        if (rootMesh?.skeleton) return rootMesh;
        if (rootMesh?.getChildMeshes) {
          for (const child of rootMesh.getChildMeshes()) {
            if (child.skeleton) return child;
          }
        }
        return null;
      };
      const skeletonMesh = findMeshWithSkeleton(mesh) || mesh;

      // Determine desired physics shape type based on animation name
      let desiredShapeType = "vertical";
      if (animationName === "Fly") {
        desiredShapeType = "horizontal-fly";
      } else if (animationName === "Fall") {
        desiredShapeType = "horizontal-fall";
      } else if (animationName === "Sitting") {
        desiredShapeType = "sitting";
      }

      // Only update if the shape type has changed
      if (!skeletonMesh.metadata) skeletonMesh.metadata = {};
      if (
        !skeletonMesh.metadata.currentPhysicsShapeType ||
        skeletonMesh.metadata.currentPhysicsShapeType !== desiredShapeType
      ) {
        // Preserve physics properties
        const motionType = physicsMesh.physics.getMotionType();
        const massProps = physicsMesh.physics.getMassProperties();
        const disablePreStep = physicsMesh.physics.disablePreStep;

        // Create new shape based on animation
        // Always use physicsMesh which has the full body bounding box
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
            -0.5,
          );
        } else if (desiredShapeType === "sitting") {
          newShape = flock.createSittingCapsuleFromBoundingBox(
            physicsMesh,
            flock.scene,
          );
        } else {
          newShape = flock.createCapsuleFromBoundingBox(
            physicsMesh,
            flock.scene,
          );
        }

        // Update the physics shape
        physicsMesh.physics.shape = newShape;

        // Restore physics properties
        physicsMesh.physics.setMotionType(motionType);
        physicsMesh.physics.setMassProperties(massProps);
        physicsMesh.physics.disablePreStep = disablePreStep;

        // Track the current physics shape type
        skeletonMesh.metadata.currentPhysicsShapeType = desiredShapeType;
      }
    }

    return targetAnimationGroup;
  },

  switchAnimationModel(
    meshName,
    { animationName, loop = true, restart = false } = {},
  ) {
    return flock.whenModelReady(meshName, (mesh) => {
      flock.switchToAnimation(flock.scene, mesh, animationName, loop, restart);
    });
  },
  async playAnimation(
    meshName,
    { animationName, loop = false, restart = true } = {},
  ) {
    // Always wait for mesh to exist before deciding
    const mesh = await flock._waitForMesh(meshName);
    if (!mesh) {
      console.error(`Mesh "${meshName}" not found.`);
      return;
    }
    // Get the modelName from metadata or whatever property you use
    const modelName = mesh.metadata?.modelName;

    // Check if model should use playAnimationModel based on configuration
    if (modelAnimationNames.includes(modelName)) {
      return flock.playAnimationModel(meshName, {
        animationName,
        loop,
        restart,
      });
    } else if (flock.separateAnimations) {
      return flock.playAnimationLoad(meshName, {
        animationName,
        loop,
        restart,
      });
    } else {
      return flock.playAnimationModel(meshName, {
        animationName,
        loop,
        restart,
      });
    }
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

  async playAnimationModel(
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

  async playAnimationLoad(
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
    const animGroup = await flock.switchToAnimationLoad(
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
  switchAnimation(
    meshName,
    { animationName, loop = true, restart = false } = {},
  ) {
    return flock.whenModelReady(meshName, (mesh) => {
      flock.switchToAnimation(flock.scene, mesh, animationName, loop, restart);
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
    return new Promise(async (resolve) => {
      // Check if mesh exists immediately first
      const existingMesh = flock.scene?.getMeshByName(meshName);
      if (!existingMesh) {
        console.warn(`Mesh '${meshName}' not found for rotateAnim.`);
        resolve();
        return;
      }

      await flock.whenModelReady(meshName, async function (mesh) {
        if (mesh) {
          // Store the original rotation
          const startRotation = mesh.rotation.clone();

          // Convert degrees to radians
          const targetRotation = new flock.BABYLON.Vector3(
            x * (Math.PI / 180), // X-axis in radians
            y * (Math.PI / 180), // Y-axis in radians
            z * (Math.PI / 180), // Z-axis in radians
          );

          const fps = 30;
          const frames = fps * duration;

          // Determine the loop mode based on reverse and loop
          let loopMode;
          if (reverse) {
            loopMode = flock.BABYLON.Animation.ANIMATIONLOOPMODE_YOYO;
          } else if (loop) {
            loopMode = flock.BABYLON.Animation.ANIMATIONLOOPMODE_CYCLE;
          } else {
            loopMode = flock.BABYLON.Animation.ANIMATIONLOOPMODE_CONSTANT;
          }

          // Create animation for rotation only
          const rotateAnimation = new flock.BABYLON.Animation(
            "rotateTo",
            "rotation",
            fps,
            flock.BABYLON.Animation.ANIMATIONTYPE_VECTOR3,
            loopMode,
          );

          // Define keyframes for rotation
          const rotateKeys = [
            { frame: 0, value: startRotation },
            { frame: frames, value: targetRotation },
          ];

          rotateAnimation.setKeys(rotateKeys);

          // Apply easing if needed
          if (easing !== "Linear") {
            let easingFunction;
            switch (easing) {
              case "SineEase":
                easingFunction = new flock.BABYLON.SineEase();
                break;
              case "CubicEase":
                easingFunction = new flock.BABYLON.CubicEase();
                break;
              case "QuadraticEase":
                easingFunction = new flock.BABYLON.QuadraticEase();
                break;
              case "ExponentialEase":
                easingFunction = new flock.BABYLON.ExponentialEase();
                break;
              case "BounceEase":
                easingFunction = new flock.BABYLON.BounceEase();
                break;
              case "ElasticEase":
                easingFunction = new flock.BABYLON.ElasticEase();
                break;
              case "BackEase":
                easingFunction = new flock.BABYLON.BackEase();
                break;
              default:
                easingFunction = new flock.BABYLON.SineEase();
            }
            easingFunction.setEasingMode(
              flock.BABYLON.EasingFunction.EASINGMODE_EASEINOUT,
            );
            rotateAnimation.setEasingFunction(easingFunction);
          }

          // Use beginDirectAnimation to apply ONLY the rotation animation
          // This ensures we don't interfere with any other properties
          const animatable = flock.scene.beginDirectAnimation(
            mesh,
            [rotateAnimation],
            0,
            frames,
            loop,
          );

          animatable.onAnimationEndObservable.add(() => {
            resolve();
          });
        } else {
          resolve(); // Resolve immediately if the mesh is not available
        }
      });
    });
  },
};
