let flock;

export function setFlockReference(ref) {
  flock = ref;
}

export const flockPhysics = {
  createPhysicsBody(
    mesh,
    shape,
    motionType = flock.BABYLON.PhysicsMotionType.STATIC,
  ) {
    const physicsBody = new flock.BABYLON.PhysicsBody(
      mesh,
      motionType,
      false,
      flock.scene,
    );
    physicsBody.shape = shape;
    physicsBody.setMassProperties({ mass: 1, restitution: 0.5 });
    mesh.physics = physicsBody;
  },
  applyPhysics(geometry, physicsShape) {
    const physicsBody = new flock.BABYLON.PhysicsBody(
      geometry,
      flock.BABYLON.PhysicsMotionType.STATIC,
      false,
      flock.scene,
    );
    physicsBody.shape = physicsShape;
    physicsBody.setMassProperties({ mass: 1, restitution: 0.5 });
    physicsBody.disablePreStep = false;

    geometry.physics = physicsBody;
  },
  updatePhysics(mesh, parent = null) {
    if (!parent) parent = mesh;
    // If the mesh has a physics body, update its shape
    if (parent.physics) {
      // Preserve the disablePreStep setting if it exists
      const disablePreStep = parent.physics.disablePreStep || false;

      // Recreate the physics shape based on the new scale
      //console.log(parent.physics.shape.constructor.name);

      // Handling Capsule shape
      if (
        parent.physics.shape.constructor.name === "_PhysicsShapeCapsule"
      ) {
        const newShape = flock.createCapsuleFromBoundingBox(
          mesh,
          flock.scene,
        );
        parent.physics.shape = newShape;
        parent.physics.setMassProperties({ mass: 1, restitution: 0.5 }); // Adjust properties as needed
      }

      // Handling Box shape
      else if (
        parent.physics.shape.constructor.name === "_PhysicsShapeBox"
      ) {
        // Extract bounding box dimensions in world space (after scaling)
        const boundingBox = mesh.getBoundingInfo().boundingBox;
        const width =
          boundingBox.maximumWorld.x - boundingBox.minimumWorld.x;
        const height =
          boundingBox.maximumWorld.y - boundingBox.minimumWorld.y;
        const depth =
          boundingBox.maximumWorld.z - boundingBox.minimumWorld.z;

        const boxShape = new flock.BABYLON.PhysicsShapeBox(
          new flock.BABYLON.Vector3(0, 0, 0),
          new flock.BABYLON.Quaternion(0, 0, 0, 1), // No rotation
          new flock.BABYLON.Vector3(width, height, depth), // Updated dimensions
          flock.scene,
        );

        // Update the physics body with the new shape
        parent.physics.shape = boxShape;
      }

      // Handling Mesh shape
      else if (
        parent.physics.shape.constructor.name === "_PhysicsShapeMesh"
      ) {
        // Create a new mesh shape based on the updated geometry of the mesh
        const newMeshShape = new flock.BABYLON.PhysicsShapeMesh(
          mesh,
          flock.scene,
        );

        // Update the physics body with the new mesh shape
        parent.physics.shape = newMeshShape;
      }

      // Preserve the disablePreStep setting from the previous physics object
      parent.physics.disablePreStep = disablePreStep;
      parent.physics.setMassProperties({ mass: 1, restitution: 0.5 });
    }
  },
  addBeforePhysicsObservable(scene, ...meshes) {
    const beforePhysicsObserver = scene.onBeforePhysicsObservable.add(
      () => {
        meshes.forEach((mesh) => {
          mesh.computeWorldMatrix(true);
        });
      },
    );
  },
  up(modelName, upForce = 10) {
    const mesh = flock.scene.getMeshByName(modelName);
    if (mesh) {
      mesh.physics.applyImpulse(
        new flock.BABYLON.Vector3(0, upForce, 0),
        mesh.getAbsolutePosition(),
      );
    } else {
      console.log("Model not loaded (up):", modelName);
    }
  },
  applyForce(modelName, forceX = 0, forceY = 0, forceZ = 0) {
    const mesh = flock.scene.getMeshByName(modelName);
    if (mesh) {
      mesh.physics.applyImpulse(
        new flock.BABYLON.Vector3(forceX, forceY, forceZ),
        mesh.getAbsolutePosition(),
      );
    } else {
      console.log("Model not loaded (applyForce):", modelName);
    }
  },
  setPhysics(modelName, physicsType) {
    return flock.whenModelReady(modelName, (mesh) => {
      switch (physicsType) {
        case "STATIC":
          mesh.physics.setMotionType(
            flock.BABYLON.PhysicsMotionType.STATIC,
          );
          /*flock.hk._hknp.HP_World_AddBody(
            flock.hk.world,
            mesh.physics._pluginData.hpBodyId,
            mesh.physics.startAsleep,
          );*/
          mesh.physics.disablePreStep = true;
          break;
        case "DYNAMIC":
          mesh.physics.setMotionType(
            flock.BABYLON.PhysicsMotionType.DYNAMIC,
          );
          // Stops falling through platforms
          /*flock.hk._hknp.HP_World_AddBody(
            flock.hk.world,
            mesh.physics._pluginData.hpBodyId,
            mesh.physics.startAsleep,
          );*/
          mesh.physics.disablePreStep = false;
          //mesh.physics.disableSync = false;
          //mesh.physics.setPrestepType(flock.BABYLON.PhysicsPrestepType.TELEPORT);
          break;
        case "ANIMATED":
          mesh.physics.setMotionType(
            flock.BABYLON.PhysicsMotionType.ANIMATED,
          );
          /*flock.hk._hknp.HP_World_AddBody(
            flock.hk.world,
            mesh.physics._pluginData.hpBodyId,
            mesh.physics.startAsleep,
          );*/
          mesh.physics.disablePreStep = false;
          break;
        case "NONE":
          mesh.physics.setMotionType(
            flock.BABYLON.PhysicsMotionType.STATIC,
          );
          mesh.isPickable = false;
          flock.hk._hknp.HP_World_RemoveBody(
            flock.hk.world,
            mesh.physics._pluginData.hpBodyId,
          );
          mesh.physics.disablePreStep = true;
          break;
        default:
          console.error(
            "Invalid physics type provided:",
            physicsType,
          );
          break;
      }
    });
  },
  setPhysicsShape(modelName, shapeType) {
    return flock.whenModelReady(modelName, (mesh) => {
      const disposePhysics = (targetMesh) => {
        if (targetMesh.physics) {
          const body = targetMesh.physics;

          // Remove the body from the physics world
          flock.hk._hknp.HP_World_RemoveBody(
            flock.hk.world,
            body._pluginData.hpBodyId,
          );

          // Dispose of the shape explicitly
          if (body.shape) {
            body.shape.dispose();
            body.shape = null; // Clear shape reference
          }

          // Dispose of the body explicitly
          body.dispose();
          targetMesh.physics = null; // Clear reference
        }
      };

      const applyPhysicsShape = (targetMesh) => {
        // Dispose physics if no material
        if (!targetMesh.material) {
          disposePhysics(targetMesh);
          return; // Skip further processing
        }

        if (!targetMesh.geometry) {
          return; // Skip if no geometry
        }

        // Dispose existing physics before applying a new shape
        disposePhysics(targetMesh);

        let physicsShape, radius, boundingBox, height;
        switch (shapeType) {
          case "CAPSULE":
            boundingBox = targetMesh.getBoundingInfo().boundingBox;
            radius =
              Math.max(
                boundingBox.maximum.x - boundingBox.minimum.x,
                boundingBox.maximum.z - boundingBox.minimum.z,
              ) / 2;
            height = boundingBox.maximum.y - boundingBox.minimum.y;
            physicsShape = new flock.BABYLON.PhysicsShapeCapsule(
              targetMesh,
              flock.scene,
              { radius: radius, height: height },
            );
            break;
          case "MESH":
            physicsShape = new flock.BABYLON.PhysicsShapeMesh(
              targetMesh,
              flock.scene,
            );
            break;
          default:
            console.error(
              "Invalid shape type provided:",
              shapeType,
            );
            return;
        }

        const physicsBody = new flock.BABYLON.PhysicsBody(
          targetMesh,
          flock.BABYLON.PhysicsMotionType.STATIC, // Default motion type
          false,
          flock.scene,
        );
        physicsBody.shape = physicsShape;
        physicsBody.setMassProperties({ mass: 1, restitution: 0.5 });
        physicsBody.disablePreStep = false;

        targetMesh.physics = physicsBody;
      };

      // Apply to main mesh
      applyPhysicsShape(mesh);

      // Apply to submeshes
      if (mesh.getChildMeshes) {
        mesh.getChildMeshes().forEach((subMesh) => {
          applyPhysicsShape(subMesh);
        });
      }
    });
  },
  checkMeshesTouching(mesh1VarName, mesh2VarName) {
    const mesh1 = flock.scene.getMeshByName(mesh1VarName);
    const mesh2 = flock.scene.getMeshByName(mesh2VarName);
    if (mesh1 && mesh2 && mesh2.isEnabled()) {
      return mesh1.intersectsMesh(mesh2, false);
    }
    return false;
  },
  onTrigger(modelName, trigger, doCode, options = { mode: "wait" }) {
    return flock.whenModelReady(modelName, async function (target) {
      if (!target) {
        console.log("Model or GUI Button not loaded:", modelName);
        return;
      }

      let { mode } = options;
      let isExecuting = false; // Tracks whether action is currently executing
      let hasExecuted = false; // Tracks whether action has executed in 'once' mode
      let doCodes = Array.isArray(doCode) ? doCode : [doCode];
      let currentIndex = 0;

      // Helper to handle action registration for meshes
      function registerMeshAction(mesh, trigger, action) {
        mesh.isPickable = true;
        if (!mesh.actionManager) {
          mesh.actionManager = new flock.BABYLON.ActionManager(
            flock.scene,
          );
          mesh.actionManager.isRecursive = true;
        }

        let actionSequence = new flock.BABYLON.ExecuteCodeAction(
          flock.BABYLON.ActionManager[trigger],
          action,
        );

        for (let i = 1; i < doCodes.length; i++) {
          actionSequence = actionSequence.then(
            new flock.BABYLON.ExecuteCodeAction(
              flock.BABYLON.ActionManager[trigger],
              async () => await doCodes[i](),
            ),
          );
        }

        mesh.actionManager.registerAction(actionSequence);
      }

      // Helper to handle GUI button registration
      function registerButtonAction(button, trigger, action) {
        if (trigger === "OnPointerUpTrigger") {
          button.onPointerUpObservable.add(action);
        } else {
          button.onPointerClickObservable.add(action);
        }
      }

      // Execute the next code in sequence
      async function executeAction() {
        // Handle 'once' mode - execute only once
        if (mode === "once") {
          if (hasExecuted) return; // Skip if already executed
          hasExecuted = true; // Mark as executed
        }

        // Handle 'wait' mode - discard if already executing
        if (mode === "wait") {
          if (isExecuting) return; // Skip if still processing
          isExecuting = true;
        }

        try {
          await doCodes[currentIndex]();
          currentIndex = (currentIndex + 1) % doCodes.length;
        } catch (e) {
          console.error("Action execution failed:", e);
        } finally {
          // Reset execution flag only for 'wait' mode
          if (mode === "wait") isExecuting = false;
        }
      }

      // Handle meshes
      if (target instanceof flock.BABYLON.AbstractMesh) {
        registerMeshAction(target, trigger, async () => {
          await executeAction(); // Always execute immediately
        });

        // Handle AR/VR-specific interactions
        if (flock.xrHelper && flock.xrHelper.baseExperience) {
          flock.xrHelper.baseExperience.onStateChangedObservable.add(
            (state) => {
              if (
                state === flock.BABYLON.WebXRState.IN_XR &&
                flock.xrHelper.baseExperience.sessionManager
                  .sessionMode === "immersive-ar"
              ) {
                flock.xrHelper.baseExperience.featuresManager.enableFeature(
                  flock.BABYLON.WebXRHitTest.Name,
                  "latest",
                  {
                    onHitTestResultObservable: (
                      results,
                    ) => {
                      if (results.length > 0) {
                        const hitTest = results[0];
                        const position =
                          hitTest.transformationMatrix.getTranslation();
                        target.position.copyFrom(
                          position,
                        );
                        target.isVisible = true;
                      }
                    },
                  },
                );

                flock.scene.onPointerDown = function (
                  evt,
                  pickResult,
                ) {
                  if (
                    pickResult.hit &&
                    pickResult.pickedMesh === target
                  ) {
                    executeAction(); // Discard extra triggers in 'wait' mode
                  }
                };
              } else if (state === BABYLON.WebXRState.NOT_IN_XR) {
                flock.scene.onPointerDown = null;
              }
            },
          );
        }
      }
      // Handle GUI buttons
      else if (target instanceof flock.GUI.Button) {
        registerButtonAction(target, trigger, async () => {
          await executeAction(); // Execute immediately
        });
      }
    });
  },

  onIntersect(modelName, otherModelName, trigger, doCode) {
    return flock.whenModelReady(modelName, async function (mesh) {
      if (!mesh) {
        console.error("Model not loaded:", modelName);
        return;
      }

      // Load the second model
      return flock.whenModelReady(
        otherModelName,
        async function (otherMesh) {
          if (!otherMesh) {
            console.error("Model not loaded:", otherModelName);
            return;
          }

          // Initialize actionManager if not present
          if (!mesh.actionManager) {
            mesh.actionManager = new flock.BABYLON.ActionManager(
              flock.scene,
            );
            mesh.actionManager.isRecursive = true;
          }

          const action = new flock.BABYLON.ExecuteCodeAction(
            {
              trigger: flock.BABYLON.ActionManager[trigger],
              parameter: {
                mesh: otherMesh,
                usePreciseIntersection: true,
              },
            },
            async function () {
              await doCode(); // Execute the provided callback function
            },
            new flock.BABYLON.PredicateCondition(
              flock.BABYLON.ActionManager,
              () => {
                return otherMesh.isEnabled();
              },
            ),
          );
          mesh.actionManager.registerAction(action); // Register the ExecuteCodeAction
        },
      );
    });
  },
  isTouchingSurface(modelName) {
    const mesh = flock.scene.getMeshByName(modelName);
    if (mesh) {
      return flock.checkIfOnSurface(mesh);
    } else {
      console.log("Model not loaded (isTouchingSurface):", modelName);
      return false;
    }
  },
  checkIfOnSurface(mesh) {
    mesh.computeWorldMatrix(true);
    const boundingInfo = mesh.getBoundingInfo();

    const minY = boundingInfo.boundingBox.minimumWorld.y;
    const rayOrigin = new flock.BABYLON.Vector3(
      boundingInfo.boundingBox.centerWorld.x,
      minY + 0.01,
      boundingInfo.boundingBox.centerWorld.z,
    );

    const ray = new flock.BABYLON.Ray(
      rayOrigin,
      new flock.BABYLON.Vector3(0, -1, 0),
      2,
    );

    let parentPickable = false;
    if (mesh.isPickable) {
      parentPickable = true;
      mesh.isPickable = false;
    }

    const descendants = mesh.getChildMeshes(false);
    descendants.forEach((childMesh) => {
      if (childMesh.getTotalVertices() > 0) {
        childMesh.isPickable = false;
      }
    });
    const hit = flock.scene.pickWithRay(ray);
    descendants.forEach((childMesh) => {
      if (childMesh.getTotalVertices() > 0) {
        childMesh.isPickable = true;
      }
    });

    if (parentPickable) mesh.ispickable = true;

    //if(hit.hit) {console.log(hit.pickedMesh.name, hit.distance);}
    return hit.hit && hit.pickedMesh !== null && hit.distance <= 0.06;
  },
}