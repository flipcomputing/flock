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
      if (parent.physics.shape.constructor.name === "_PhysicsShapeCapsule") {
        const newShape = flock.createCapsuleFromBoundingBox(mesh, flock.scene);
        parent.physics.shape = newShape;
        parent.physics.setMassProperties({ mass: 1, restitution: 0.5 }); // Adjust properties as needed
      }

      // Handling Box shape
      else if (parent.physics.shape.constructor.name === "_PhysicsShapeBox") {
        // Extract bounding box dimensions in world space (after scaling)
        const boundingBox = mesh.getBoundingInfo().boundingBox;
        const width = boundingBox.maximumWorld.x - boundingBox.minimumWorld.x;
        const height = boundingBox.maximumWorld.y - boundingBox.minimumWorld.y;
        const depth = boundingBox.maximumWorld.z - boundingBox.minimumWorld.z;

        const boxShape = new flock.BABYLON.PhysicsShapeBox(
          flock.BABYLON.Vector3.Zero(),
          new flock.BABYLON.Quaternion(0, 0, 0, 1), // No rotation
          new flock.BABYLON.Vector3(width, height, depth), // Updated dimensions
          flock.scene,
        );

        // Update the physics body with the new shape
        parent.physics.shape = boxShape;
      }

      // Handling Mesh shape
      else if (parent.physics.shape.constructor.name === "_PhysicsShapeMesh") {
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
    const beforePhysicsObserver = scene.onBeforePhysicsObservable.add(() => {
      meshes.forEach((mesh) => {
        mesh.computeWorldMatrix(true);
      });
    });
  },
  up(meshName, upForce = 10) {
    const mesh = flock.scene.getMeshByName(meshName);
    if (mesh) {
      mesh.physics.applyImpulse(
        new flock.BABYLON.Vector3(0, upForce, 0),
        mesh.getAbsolutePosition(),
      );
    } else {
      console.log("Model not loaded (up):", meshName);
    }
  },
  applyForce(meshName, { forceX = 0, forceY = 0, forceZ = 0 } = {}) {
    const mesh = flock.scene.getMeshByName(meshName);
    if (mesh && mesh.physics) {
      mesh.physics.applyImpulse(
        new flock.BABYLON.Vector3(forceX, forceY, forceZ),
        mesh.getAbsolutePosition(),
      );
    } else {
      console.error(
        `Model '${meshName}' not loaded or missing physics (applyForce)`,
      );
    }
  },
  async setPhysics(meshName, physicsType) {
    // 1) Wait for the mesh to exist (this truly blocks)
    const mesh = await (
      typeof flock.ensureModelReadyPromise === "function"
        ? flock.ensureModelReadyPromise(meshName)
        : new Promise((resolve) => flock.whenModelReady(meshName, resolve))
    );

    // Abort safety: if scene was torn down during the wait, exit quietly
    if (flock.abortController?.signal?.aborted || !mesh) return mesh;

    // 2) Apply physics mode (guard if no physics body yet)
    if (!mesh.physics) {
      console.warn("[setPhysics] Mesh has no physics body yet:", meshName);
      return mesh;
    }

    switch (physicsType) {
      case "STATIC":
        mesh.physics.setMotionType(flock.BABYLON.PhysicsMotionType.STATIC);
        mesh.physics.disablePreStep = true;
        break;

      case "DYNAMIC":
        mesh.physics.setMotionType(flock.BABYLON.PhysicsMotionType.DYNAMIC);
        mesh.physics.disablePreStep = false;
        break;

      case "ANIMATED":
        mesh.physics.setMotionType(flock.BABYLON.PhysicsMotionType.ANIMATED);
        mesh.physics.disablePreStep = false;
        break;

      case "NONE":
        // Park as STATIC and remove from the Havok world
        mesh.physics.setMotionType(flock.BABYLON.PhysicsMotionType.STATIC);
        mesh.isPickable = false;
        try {
          const id = mesh.physics._pluginData?.hpBodyId;
          if (id != null) {
            flock.hk._hknp.HP_World_RemoveBody(flock.hk.world, id);
          } else {
            console.warn("[setPhysics] No hpBodyId on mesh physics; skip removal:", meshName);
          }
        } catch (e) {
          console.warn("[setPhysics] Error removing body from Havok world:", e);
        }
        mesh.physics.disablePreStep = true;
        break;

      default:
        console.error("[setPhysics] Invalid physics type:", physicsType);
        break;
    }

    return mesh;
  },
  setPhysicsShape(meshName, shapeType) {
    return flock.whenModelReady(meshName, (mesh) => {
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
            console.error("Invalid shape type provided:", shapeType);
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
  onTrigger(meshName, { trigger, callback, mode = "wait", applyToGroup = false }) {
    const groupName = meshName.includes("__")
      ? meshName.split("__")[0]
      : meshName.split("_")[0];

    // 🛡 Scene not ready yet – queue for later
    if (!flock.scene) {
      //console.log(`[flock] Scene not ready, queuing group '${groupName}' trigger`);
      if (!flock.pendingTriggers.has(groupName)) {
        flock.pendingTriggers.set(groupName, []);
      }
      flock.pendingTriggers.get(groupName).push({ trigger, callback, mode });
      return;
    }

    // 🧠 Handle group-wide registration
    if (applyToGroup) {
      const matching = flock.scene.meshes.filter((m) =>
        m.name.startsWith(groupName)
      );
      if (matching.length > 0) {
        //console.log(`[flock] Applying trigger to ${matching.length} existing mesh(es) in group '${groupName}'`);
        for (const m of matching) {
          // ✅ No longer skipping the group anchor (e.g., "box1")
          flock.onTrigger(m.name, {
            trigger,
            callback,
            mode,
            applyToGroup: false, // 🧯 Prevent recursion
          });
        }
      }

      // Register for future meshes in this group
      if (!flock.pendingTriggers.has(groupName)) {
        flock.pendingTriggers.set(groupName, []);
      }
      flock.pendingTriggers.get(groupName).push({ trigger, callback, mode });
      return;
    }

    // 🧪 If the mesh doesn't exist yet, queue trigger
    const tryNow =
      flock.scene?.getMeshByName(meshName) ||
      flock.modelReadyPromises.has(meshName);

    if (!tryNow) {
      if (!flock.pendingTriggers.has(groupName)) {
        flock.pendingTriggers.set(groupName, []);
      }
      flock.pendingTriggers.get(groupName).push({ trigger, callback, mode });

      //console.log(`[flock] Trigger for '${meshName}' stored for group '${groupName}'`);
      return;
    }

    // 🎯 Register actual trigger
    return flock.whenModelReady(meshName, async function (target) {
      if (!target) {
        console.log("Model or GUI Button not loaded:", meshName);
        return;
      }

      let isExecuting = false;
      let hasExecuted = false;
      let callbacks = Array.isArray(callback) ? callback : [callback];
      let currentIndex = 0;

      function registerMeshAction(mesh, trigger, action) {
        mesh.isPickable = true;
        if (!mesh.actionManager) {
          mesh.actionManager = new flock.BABYLON.ActionManager(flock.scene);
          mesh.actionManager.isRecursive = true;
        }

        let actionSequence = new flock.BABYLON.ExecuteCodeAction(
          flock.BABYLON.ActionManager[trigger],
          async (evt) => {
            const clickedMesh = evt.meshUnderPointer || evt.source;
            const meshId = clickedMesh.name;
            await callbacks[0](meshId);
            for (let i = 1; i < callbacks.length; i++) {
              await callbacks[i]();
            }
          }
        );

        for (let i = 1; i < callbacks.length; i++) {
          actionSequence = actionSequence.then(
            new flock.BABYLON.ExecuteCodeAction(
              flock.BABYLON.ActionManager[trigger],
              async () => await callbacks[i]()
            )
          );
        }

        mesh.actionManager.registerAction(actionSequence);
      }

      function registerButtonAction(button, trigger, action) {
        if (trigger === "OnPointerUpTrigger") {
          button.onPointerUpObservable.add(action);
        } else {
          button.onPointerClickObservable.add(action);
        }
      }

      async function executeAction() {
        if (mode === "once") {
          if (hasExecuted) return;
          hasExecuted = true;
        }

        if (mode === "wait") {
          if (isExecuting) return;
          isExecuting = true;
        }

        try {
          await callbacks[currentIndex]();
          currentIndex = (currentIndex + 1) % callbacks.length;
        } catch (e) {
          console.error("Action execution failed:", e);
        } finally {
          if (mode === "wait") isExecuting = false;
        }
      }

      if (target instanceof flock.BABYLON.AbstractMesh) {
        registerMeshAction(target, trigger, async () => {
          await executeAction();
        });

        if (flock.xrHelper && flock.xrHelper.baseExperience) {
          flock.xrHelper.baseExperience.onStateChangedObservable.add((state) => {
            if (
              state === flock.BABYLON.WebXRState.IN_XR &&
              flock.xrHelper.baseExperience.sessionManager.sessionMode === "immersive-ar"
            ) {
              flock.xrHelper.baseExperience.featuresManager.enableFeature(
                flock.BABYLON.WebXRHitTest.Name,
                "latest",
                {
                  onHitTestResultObservable: (results) => {
                    if (results.length > 0) {
                      const hitTest = results[0];
                      const position = hitTest.transformationMatrix.getTranslation();
                      target.position.copyFrom(position);
                      target.isVisible = true;
                    }
                  }
                }
              );

              flock.scene.onPointerDown = function (evt, pickResult) {
                if (pickResult.hit && pickResult.pickedMesh === target) {
                  executeAction();
                }
              };
            } else if (state === flock.BABYLON.WebXRState.NOT_IN_XR) {
              flock.scene.onPointerDown = null;
            }
          });
        }
      } else if (target instanceof flock.GUI.Button) {
        registerButtonAction(target, trigger, async () => {
          await executeAction();
        });
      }
    });
  },
  onIntersect(meshName, otherMeshName, { trigger, callback }) {
    return flock.whenModelReady(meshName, async function (mesh) {
      if (!mesh) {
        console.error("Model not loaded:", meshName);
        return;
      }

      return flock.whenModelReady(otherMeshName, async function (otherMesh) {
        if (!otherMesh) {
          console.error("Model not loaded:", otherMeshName);
          return;
        }

        if (!mesh.actionManager) {
          mesh.actionManager = new flock.BABYLON.ActionManager(flock.scene);
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
            await callback(mesh.name, otherMesh.name); // Pass mesh names
          },
          new flock.BABYLON.PredicateCondition(
            flock.BABYLON.ActionManager,
            () => otherMesh.isEnabled(),
          ),
        );

        mesh.actionManager.registerAction(action);
      });
    });
  },
  isTouchingSurface(meshName) {
    const mesh = flock.scene.getMeshByName(meshName);
    if (mesh) {
      return flock.checkIfOnSurface(mesh);
    } else {
      console.log("Model not loaded (isTouchingSurface):", meshName);
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
  meshExists(name) {
    return !!(flock.scene && flock.scene.getMeshByName(name));
  }
};
