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
    const mesh = await (typeof flock.ensureModelReadyPromise === "function"
      ? flock.ensureModelReadyPromise(meshName)
      : new Promise((resolve) => flock.whenModelReady(meshName, resolve)));

    // Abort safety: if scene was torn down during the wait, exit quietly
    if (flock.abortController?.signal?.aborted || !mesh) return mesh;

    if (!mesh.physics) {
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
            console.warn(
              "[setPhysics] No hpBodyId on mesh physics; skip removal:",
              meshName,
            );
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
          try {
            if (body._pluginData?.hpBodyId) {
              flock.hk._hknp.HP_World_RemoveBody(
                flock.hk.world,
                body._pluginData.hpBodyId,
              );
            }
          } catch (e) {
            console.warn("[setPhysicsShape] RemoveBody warning:", e);
          }

          // Dispose of the shape explicitly
          try {
            body.shape?.dispose?.();
          } catch {}
          try {
            body.dispose?.();
          } catch {}
          targetMesh.physics = null;
        }
      };

      // --- CAPSULE path (player collider) ---
      const applyCapsuleToRoot = (targetMesh) => {
        targetMesh.computeWorldMatrix(true);
        disposePhysics(targetMesh);

        // IMPORTANT: use targetMesh (not outer mesh)
        const physicsShape = flock.createCapsuleFromBoundingBox(
          targetMesh,
          flock.scene,
        );
        if (!physicsShape) {
          console.error(
            "[setPhysicsShape] Failed to create capsule for",
            targetMesh.name,
          );
          return;
        }

        const physicsBody = new flock.BABYLON.PhysicsBody(
          targetMesh,
          flock.BABYLON.PhysicsMotionType.DYNAMIC,
          false,
          flock.scene,
        );
        physicsBody.shape = physicsShape;
        physicsBody.setMassProperties({ mass: 1, restitution: 0.5 });
        physicsBody.disablePreStep = false;

        targetMesh.physics = physicsBody;
      };

      // --- MESH path (preserve original behaviour) ---
      const applyMeshPhysicsShape = (targetMesh) => {
        // Keep your original material gate
        if (!targetMesh.material) {
          disposePhysics(targetMesh);
          return;
        }

        disposePhysics(targetMesh);

        const physicsShape = new flock.BABYLON.PhysicsShapeMesh(
          targetMesh,
          flock.scene,
        );

        const physicsBody = new flock.BABYLON.PhysicsBody(
          targetMesh,
          flock.BABYLON.PhysicsMotionType.STATIC, // unchanged
          false,
          flock.scene,
        );
        physicsBody.shape = physicsShape;
        physicsBody.setMassProperties({ mass: 1, restitution: 0.5 }); // unchanged
        physicsBody.disablePreStep = false;

        targetMesh.physics = physicsBody;
      };

      // --- Dispatch by shape type ---
      switch (shapeType) {
        case "CAPSULE":
          // Only on root (player), no children
          applyCapsuleToRoot(mesh);
          break;

        case "MESH":
          applyMeshPhysicsShape(mesh);
          if (mesh.getChildMeshes) {
            mesh.getChildMeshes().forEach((subMesh) => {
              applyMeshPhysicsShape(subMesh);
            });
          }
          break;

        default:
          console.error("Invalid shape type provided:", shapeType);
          return;
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
  onTrigger(
    meshName,
    { trigger, callback, mode = "wait", applyToGroup = false },
  ) {
    const groupName = meshName.includes("__")
      ? meshName.split("__")[0]
      : meshName.split("_")[0];

    // 🛡 Scene not ready yet – queue for later
    if (!flock.scene) {
      if (flock.triggerHandlingDebug)
        console.log(
          `[flock] Scene not ready, queuing group '${groupName}' trigger`,
        );
      if (!flock.pendingTriggers.has(groupName)) {
        flock.pendingTriggers.set(groupName, []);
      }
      flock.pendingTriggers.get(groupName).push({ trigger, callback, mode });
      return;
    }

    // 🧠 Handle group-wide registration
    if (applyToGroup) {
      // Check for GUI buttons first
      let matchingButtons = [];
      if (flock.scene.UITexture) {
        matchingButtons = flock.scene.UITexture._rootContainer._children.filter(
          (control) => control.name && control.name.startsWith(groupName),
        );
      }

      // Check for 3D meshes
      const matching = flock.scene.meshes.filter((m) =>
        m.name.startsWith(groupName),
      );

      // Apply to existing GUI buttons
      if (matchingButtons.length > 0) {
        for (const btn of matchingButtons) {
          flock.onTrigger(btn.name, {
            trigger,
            callback,
            mode,
            applyToGroup: false,
          });
        }
      }

      // Apply to existing 3D meshes
      if (matching.length > 0) {
        if (flock.triggerHandlingDebug) {
          console.log(
            `[flock] Applying trigger to ${matching.length} existing mesh(es) in group '${groupName}'`,
          );
        }
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

      // Register for future meshes/buttons in this group (always do this for applyToGroup)
      if (!flock.pendingTriggers.has(groupName)) {
        flock.pendingTriggers.set(groupName, []);
      }
      flock.pendingTriggers.get(groupName).push({ trigger, callback, mode });

      return;
    }

    // 🧪 If the mesh doesn't exist yet, queue trigger
    let guiButton = null;
    if (flock.scene.UITexture) {
      guiButton = flock.scene.UITexture._rootContainer._children.find(
        (control) => control.name === meshName,
      );
    }

    const tryNow =
      flock.scene?.getMeshByName(meshName) ||
      flock.modelReadyPromises.has(meshName) ||
      guiButton;

    if (!tryNow) {
      if (!flock.pendingTriggers.has(groupName)) {
        flock.pendingTriggers.set(groupName, []);
      }
      flock.pendingTriggers.get(groupName).push({ trigger, callback, mode });

      if (flock.triggerHandlingDebug)
        console.log(
          `[flock] Trigger for '${meshName}' stored for group '${groupName}'`,
        );
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
          action,
        );

        for (let i = 1; i < callbacks.length; i++) {
          actionSequence = actionSequence.then(
            new flock.BABYLON.ExecuteCodeAction(
              flock.BABYLON.ActionManager[trigger],
              async () => await callbacks[i](),
            ),
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

      async function executeAction(meshId) {

        if (mode === "once") {
          if (hasExecuted) return;
          hasExecuted = true;
        }

        if (mode === "wait") {
          if (isExecuting) return;
          isExecuting = true;
        }

        try {
          await callbacks[currentIndex](meshId);
          currentIndex = (currentIndex + 1) % callbacks.length;
        } catch (e) {
          console.error("Action execution failed:", e);
        } finally {
          if (mode === "wait") isExecuting = false;
        }
      }

      if (target instanceof flock.BABYLON.AbstractMesh) {
        registerMeshAction(target, trigger, async (evt) => {
          const clickedMesh = evt.meshUnderPointer || evt.source;
          const meshId = clickedMesh ? clickedMesh.name : target.name;
          await executeAction(meshId);
        });

        if (flock.xrHelper && flock.xrHelper.baseExperience) {
          flock.xrHelper.baseExperience.onStateChangedObservable.add(
            (state) => {
              if (
                state === flock.BABYLON.WebXRState.IN_XR &&
                flock.xrHelper.baseExperience.sessionManager.sessionMode ===
                  "immersive-ar"
              ) {
                flock.xrHelper.baseExperience.featuresManager.enableFeature(
                  flock.BABYLON.WebXRHitTest.Name,
                  "latest",
                  {
                    onHitTestResultObservable: (results) => {
                      if (results.length > 0) {
                        const hitTest = results[0];
                        const position =
                          hitTest.transformationMatrix.getTranslation();
                        target.position.copyFrom(position);
                        target.isVisible = true;
                      }
                    },
                  },
                );

                flock.scene.onPointerDown = function (evt, pickResult) {
                  if (pickResult.hit && pickResult.pickedMesh === target) {
                    executeAction(target.name);
                  }
                };
              } else if (state === flock.BABYLON.WebXRState.NOT_IN_XR) {
                flock.scene.onPointerDown = null;
              }
            },
          );
        }
      } else if (target instanceof flock.GUI.Button) {
        registerButtonAction(target, trigger, async () => {
          await executeAction(target.name);
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
  onIntersect2(
    meshName,
    otherMeshName,
    {
      trigger = "OnIntersectionEnterTrigger", // kept for ActionManager path
      callback,
      usePhysics, // legacy boolean still supported
      debounce = 0,
      mode = "either", // "auto" | "either" | "intersection" | "physics"
      separationFrames = 5, // when to consider 'exited' if only physics is used
    } = {},
  ) {
    return flock.whenModelReady(meshName, async (mesh) => {
      if (!mesh) {
        console.error("Model not loaded:", meshName);
        return;
      }

      return flock.whenModelReady(otherMeshName, async (otherMesh) => {
        if (!otherMesh) {
          console.error("Model not loaded:", otherMeshName);
          return;
        }

        const scene = flock.scene;
        const B = flock.BABYLON;

        // ---- config / mode resolution (back-compat) ----
        const bothHaveBodies = !!(mesh.physicsBody && otherMesh.physicsBody);
        let resolvedMode = mode;
        if (mode !== "either") {
          if (usePhysics === true) resolvedMode = "physics";
          else if (usePhysics === false) resolvedMode = "intersection";
          else if (mode === "auto")
            resolvedMode = bothHaveBodies ? "physics" : "intersection";
        }

        // ---- shared state (per pair) ----
        const key = `${mesh.uniqueId}_${otherMesh.uniqueId}`;
        const state = {
          inContact: false, // are we "inside" a contact session?
          lastFireMs: 0, // for debounce
          physicsFramesSinceHit: 0, // physics separation counter
          intersectingNow: false, // action-manager says we're intersecting
          lastFrameFired: -1, // dedupe same-frame double reports
        };

        const cleanups = [];

        const timeNow = () =>
          typeof performance !== "undefined" ? performance.now() : Date.now();
        const tryFireEnter = (sourceTag) => {
          // If both systems shout on the same frame, only fire once
          if (scene.getFrameId() === state.lastFrameFired) return;

          const now = timeNow();
          if (!state.inContact && now - state.lastFireMs >= debounce) {
            state.inContact = true;
            state.lastFireMs = now;
            state.lastFrameFired = scene.getFrameId();
            // Fire user callback
            Promise.resolve(callback(mesh.name, otherMesh.name)).catch(
              console.error,
            );
          }
        };

        const markExit = () => {
          state.inContact = false;
          state.intersectingNow = false;
          state.physicsFramesSinceHit = 0;
        };

        // ---- PHYSICS LISTENER (Havok v2) ----
        const enablePhysicsPath =
          (resolvedMode === "physics" || resolvedMode === "either") &&
          bothHaveBodies;
        if (enablePhysicsPath) {
          try {
            // Enable collision callbacks (safe to enable on both)
            mesh.physicsBody.setCollisionCallbackEnabled(true);
            otherMesh.physicsBody.setCollisionCallbackEnabled(true);

            const observable = mesh.physicsBody.getCollisionObservable();
            const physicsObserver = observable.add((evt) => {
              const other = evt.collidedAgainst?.transformNode;
              if (other === otherMesh && otherMesh.isEnabled()) {
                state.physicsFramesSinceHit = 0;
                tryFireEnter("physics");
              }
            });
            cleanups.push(() => observable.remove(physicsObserver));

            // Separation via frames without physics contact (only if AM path isn’t actively intersecting)
            const tickObserver = scene.onBeforeRenderObservable.add(() => {
              if (state.inContact && !state.intersectingNow) {
                state.physicsFramesSinceHit++;
                if (state.physicsFramesSinceHit > separationFrames) {
                  markExit();
                }
              } else {
                // reset counter when not in contact
                state.physicsFramesSinceHit = 0;
              }
            });
            cleanups.push(() =>
              scene.onBeforeRenderObservable.remove(tickObserver),
            );
          } catch (e) {
            console.warn(
              "Physics collision subscription failed, falling back to intersections:",
              e,
            );
          }
        }

        // ---- ACTION MANAGER INTERSECTION LISTENER ----
        const enableAMPath =
          resolvedMode === "intersection" ||
          resolvedMode === "either" ||
          (!bothHaveBodies && resolvedMode === "auto");
        if (enableAMPath) {
          if (!mesh.actionManager) {
            mesh.actionManager = new B.ActionManager(scene);
            mesh.actionManager.isRecursive = true;
          }

          // Always register Enter & Exit for robust state (even if caller passed Exit)
          const ENTER = B.ActionManager.OnIntersectionEnterTrigger;
          const EXIT = B.ActionManager.OnIntersectionExitTrigger;

          const enterAction = new B.ExecuteCodeAction(
            {
              trigger: ENTER,
              parameter: { mesh: otherMesh, usePreciseIntersection: true },
            },
            () => {
              if (otherMesh.isEnabled()) {
                state.intersectingNow = true;
                tryFireEnter("am");
              }
            },
            new B.PredicateCondition(B.ActionManager, () =>
              otherMesh.isEnabled(),
            ),
          );

          const exitAction = new B.ExecuteCodeAction(
            {
              trigger: EXIT,
              parameter: { mesh: otherMesh, usePreciseIntersection: true },
            },
            () => {
              state.intersectingNow = false;
              markExit();
            },
          );

          const enterReg = mesh.actionManager.registerAction(enterAction);
          const exitReg = mesh.actionManager.registerAction(exitAction);
          cleanups.push(() => {
            try {
              enterReg?.dispose();
            } catch (_) {}
            try {
              exitReg?.dispose();
            } catch (_) {}
          });

          // If the caller asked for a specific trigger callback semantics (e.g. Exit),
          // also register their requested trigger to invoke the callback directly.
          // This preserves your original API behavior.
          if (
            trigger &&
            B.ActionManager[trigger] &&
            trigger !== "OnIntersectionEnterTrigger"
          ) {
            const specific = new B.ExecuteCodeAction(
              {
                trigger: B.ActionManager[trigger],
                parameter: { mesh: otherMesh, usePreciseIntersection: true },
              },
              () => {
                if (otherMesh.isEnabled())
                  Promise.resolve(callback(mesh.name, otherMesh.name)).catch(
                    console.error,
                  );
              },
            );
            const reg = mesh.actionManager.registerAction(specific);
            cleanups.push(() => {
              try {
                reg?.dispose();
              } catch (_) {}
            });
          }
        }

        // ---- return a disposer so callers can unregister later ----
        // Usage: const dispose = onIntersect(...); dispose && dispose();
        return () => {
          // best effort cleanup
          while (cleanups.length) {
            const fn = cleanups.pop();
            try {
              fn();
            } catch (_) {}
          }
        };
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

    //console.log("Min bounding", minY);
    const rayOrigin = new flock.BABYLON.Vector3(
      boundingInfo.boundingBox.centerWorld.x,
      minY + 0.01,
      boundingInfo.boundingBox.centerWorld.z,
    );

    const ray = new flock.BABYLON.Ray(
      rayOrigin,
      new flock.BABYLON.Vector3(0, -1, 0),
      0.2,
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
  },
  // Toggle Physics V2 debug shapes, resilient to scene/engine reloads & reruns.
  showPhysics(show = true) {
    const scene = flock?.scene;
    if (!scene) {
      console.warn("Scene not ready yet");
      return;
    }

    const engine = scene.getPhysicsEngine?.();
    if (!engine) {
      console.warn("Physics engine not enabled on this scene.");
      return;
    }

    const PhysicsViewerClass =
      flock.BABYLON?.Debug?.PhysicsViewer || flock.BABYLON?.PhysicsViewer;

    if (!PhysicsViewerClass) {
      console.warn("PhysicsViewer not available on BABYLON namespace.");
      return;
    }

    // If we have a viewer from an old scene/engine, tear it down.
    const sceneChanged =
      flock._physicsViewerScene && flock._physicsViewerScene !== scene;
    const engineChanged =
      flock._physicsViewerEngine && flock._physicsViewerEngine !== engine;

    if (sceneChanged || engineChanged) {
      try {
        flock.physicsViewer?.dispose?.();
      } catch (_) {}
      flock.physicsViewer = null;
      flock._physicsViewerScene = null;
      flock._physicsViewerEngine = null;
      flock._physicsBodiesShown?.clear?.();
      flock._physicsBodiesShown = null;
    }

    // Create once per scene/engine.
    if (!flock.physicsViewer) {
      flock.physicsViewer = new PhysicsViewerClass(scene);
      flock._physicsViewerScene = scene;
      flock._physicsViewerEngine = engine;
      flock._physicsBodiesShown = new Set();

      // Auto-clean if this scene is disposed before a full page reload.
      scene.onDisposeObservable.add(() => {
        try {
          flock.physicsViewer?.dispose?.();
        } catch (_) {}
        flock.physicsViewer = null;
        flock._physicsViewerScene = null;
        flock._physicsViewerEngine = null;
        flock._physicsBodiesShown?.clear?.();
        flock._physicsBodiesShown = null;
      });
    }

    // Collect all current Physics V2 bodies (Inspector uses the engine's list).
    const collectBodies = () => {
      const bodies = [];
      const seen = new Set();

      if (typeof engine.getBodies === "function") {
        for (const body of engine.getBodies()) {
          if (body && !seen.has(body)) {
            seen.add(body);
            bodies.push(body);
          }
        }
      }

      // Fallback: meshes that expose a body (helps if plugin wraps differently).
      for (const mesh of scene.meshes) {
        const body = mesh.physicsBody || mesh.physics?.body || mesh.physics;
        if (body && !seen.has(body)) {
          seen.add(body);
          bodies.push(body);
        }
      }
      return bodies;
    };

    const bodies = collectBodies();

    if (show) {
      for (const body of bodies) {
        if (!flock._physicsBodiesShown.has(body)) {
          try {
            flock.physicsViewer.showBody(body);
            flock._physicsBodiesShown.add(body);
          } catch (_) {}
        }
      }
      flock.physicsViewerActive = true;
    } else {
      for (const body of bodies) {
        if (flock._physicsBodiesShown.has(body)) {
          try {
            flock.physicsViewer.hideBody(body);
          } catch (_) {}
          flock._physicsBodiesShown.delete(body);
        }
      }
      flock.physicsViewerActive = false;

      // Optional: fully dispose to guarantee no leftovers between runs.
      // Comment these out if you prefer to keep the instance around.
      try {
        flock.physicsViewer?.dispose?.();
      } catch (_) {}
      flock.physicsViewer = null;
      flock._physicsViewerScene = null;
      flock._physicsViewerEngine = null;
      flock._physicsBodiesShown?.clear?.();
      flock._physicsBodiesShown = null;
    }
  },
};
