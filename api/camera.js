let flock;

export function setFlockReference(ref) {
  flock = ref;
}

function getFollowTarget(mesh) {
        if (!mesh) return null;

        mesh.metadata = mesh.metadata || {};
        let followTarget = mesh.metadata._cameraFollowTarget;
        if (followTarget && followTarget.isDisposed?.()) {
                followTarget = null;
        }

        if (!followTarget) {
                followTarget = new flock.BABYLON.TransformNode(
                        `${mesh.name || "mesh"}_cameraFollowTarget`,
                        flock.scene,
                );
                followTarget.parent = mesh;
                mesh.metadata._cameraFollowTarget = followTarget;
        }

        mesh.computeWorldMatrix?.(true);
        mesh.refreshBoundingInfo?.();

        const localCenter = mesh.getBoundingInfo?.()?.boundingBox?.center;
        if (localCenter) {
                followTarget.position.copyFrom(localCenter);
        } else {
                followTarget.position.set(0, 0, 0);
        }

        return followTarget;
}

export const flockCamera = {
        /* 
                Category: Scene>Camera
        */
        attachCamera(meshName, options = {}) {
                const { radius = 7, front = true } = options;
                
                return new Promise((resolve) => {
                        flock.whenModelReady(meshName, async function (mesh) {
                                if (!mesh) {
                                        console.log("Model not loaded:", meshName);
                                        resolve();
                                        return;
                                }

                        if (!mesh.physics) {
                                console.log("Can't attach camera to: ", meshName);
                                resolve();
                                return;
                        }
                        flock.ensureVerticalConstraint(mesh);

                        let camera;
                        const followTarget = getFollowTarget(mesh) || mesh;

                        if (front) {
                                // Original attachCamera behavior - start in front then move behind
                                // Calculate direction character is facing
                                const forward = new flock.BABYLON.Vector3(
                                        Math.sin(mesh.rotation.y),
                                        0,
                                        Math.cos(mesh.rotation.y)
                                );

                                // STEP 1: Place camera IN FRONT of character (facing them)
                                camera = new flock.BABYLON.ArcRotateCamera(
                                        "camera",
                                        Math.PI / 2,
                                        Math.PI,
                                        radius,
                                        followTarget.getAbsolutePosition().add(forward.scale(3)), // in front
                                        flock.scene
                                );

                                camera.lockedTarget = followTarget;
                                camera.attachControl(flock.canvas, false);
                                flock.scene.activeCamera = camera;

                                // Set camera controls and limits
                                camera.lowerBetaLimit = Math.PI / 3;
                                camera.upperBetaLimit = Math.PI / 2;
                                camera.lowerRadiusLimit = radius * 0.6;
                                camera.upperRadiusLimit = radius * 1.6;
                                camera.angularSensibilityX = 2000;
                                camera.angularSensibilityY = 2000;
                                camera.panningSensibility = 0;
                                camera.inputs.removeByType("ArcRotateCameraMouseWheelInput");

                                camera.inputs.attached.pointers.multiTouchPanAndZoom = false;
                                camera.inputs.attached.pointers.multiTouchPanning = false;
                                camera.inputs.attached.pointers.pinchZoom = false;
                                camera.inputs.attached.pointers.pinchInwards = false;
                                camera.inputs.attached.pointers.useNaturalPinchZoom = false;

                                // Move camera behind the character
                                const behind = forward.scale(-radius);
                                camera.setPosition(followTarget.getAbsolutePosition().add(behind));

                                camera.metadata = camera.metadata || {};
                                camera.metadata.following = mesh;
                        } else {
                                // Original attachCamera2 behavior - position directly behind
                                let savedCamera = flock.scene.activeCamera;
                                flock.savedCamera = savedCamera;

                                camera = new flock.BABYLON.ArcRotateCamera(
                                        "camera",
                                        Math.PI / 2,
                                        Math.PI,
                                        radius,
                                        followTarget.getAbsolutePosition(),
                                        flock.scene,
                                );
                                
                                camera.checkCollisions = true;
                                camera.lowerBetaLimit = Math.PI / 3;
                                camera.upperBetaLimit = Math.PI / 2;
                                camera.lowerRadiusLimit = radius * 0.6;
                                camera.upperRadiusLimit = radius * 1.6;
                                camera.angularSensibilityX = 2000;
                                camera.angularSensibilityY = 2000;
                                camera.panningSensibility = 0;
                                camera.inputs.removeByType("ArcRotateCameraMouseWheelInput");

                                camera.inputs.attached.pointers.multiTouchPanAndZoom = false;
                                camera.inputs.attached.pointers.multiTouchPanning = false;
                                camera.inputs.attached.pointers.pinchZoom = false;
                                camera.inputs.attached.pointers.pinchInwards = false;
                                camera.inputs.attached.pointers.useNaturalPinchZoom = false;
                                
                                camera.lockedTarget = followTarget;
                                camera.metadata = camera.metadata || {};
                                camera.metadata.following = mesh;
                                camera.attachControl(flock.canvas, false);
                                flock.scene.activeCamera = camera;
                        }
                        resolve();
                        });
                });
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
                (scene.meshes || []).find(m =>
                  m && typeof m.name === "string" && m.name.startsWith("Constraint_") && !m.isDisposed()
                );

          if (!constraintBox) {
                // create a new hidden static box
                constraintBox = flock.BABYLON.MeshBuilder.CreateBox(
                  "Constraint",
                  { height: 1, width: 1, depth: 1 },
                  scene
                );
                constraintBox.metadata = constraintBox.metadata || {};
                constraintBox.metadata.blockKey = constraintBox.name;
                constraintBox.name = constraintBox.name + "_" + constraintBox.uniqueId;
                constraintBox.isVisible = false;
                constraintBox.material = constraintBox.material || new flock.BABYLON.StandardMaterial("staticMaterial", scene);

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
                body.setMassProperties({ mass: 1, restitution: 0.5 });
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
                  body.setMassProperties({ mass: 1, restitution: 0.5 });
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

          // position the anchor under the mesh so it doesn’t introduce sideways torque
          const meshWorldPos = mesh.getAbsolutePosition ? mesh.getAbsolutePosition() : mesh.position.clone();
          constraintBox.position.copyFrom(meshWorldPos);
          constraintBox.position.y += -4; // keep your original -4 offset

          // --- add the vertical constraint (lock roll & pitch; allow yaw) ---
          const constraint = new flock.BABYLON.Physics6DoFConstraint(
                {
                  axisA:     new flock.BABYLON.Vector3(1, 0, 0),
                  axisB:     new flock.BABYLON.Vector3(1, 0, 0),
                  perpAxisA: new flock.BABYLON.Vector3(0, 1, 0),
                  perpAxisB: new flock.BABYLON.Vector3(0, 1, 0),
                },
                [
                  { axis: flock.BABYLON.PhysicsConstraintAxis.ANGULAR_X, minLimit: 0, maxLimit: 0 },
                  { axis: flock.BABYLON.PhysicsConstraintAxis.ANGULAR_Z, minLimit: 0, maxLimit: 0 },
                ],
                scene
          );

          try {
                mesh.physics.addConstraint(constraintBox.physics, constraint);
                mesh.metadata.constraint = true;
                mesh.metadata.uprightConstraint = constraint;
          } catch (e) {
                console.warn("[ensureVerticalConstraint] addConstraint failed:", e);
          }

          // --- stabiliser: add only once per mesh to avoid stacking effects after swaps ---
          if (!mesh.metadata._uprightStabiliser) {
                mesh.metadata._uprightStabiliser = scene.onAfterPhysicsObservable.add(() => {
                  if (!mesh || mesh.isDisposed() || !mesh.physics || !mesh.physics._pluginData) return;
                  try {
                        // preserve Y motion; zero X/Z linear velocity *only if you really want to block sliding*.
                        // If sideways walking causes spin, comment the next two lines so movement isn't fighting physics.
                        const v = mesh.physics.getLinearVelocity();
                        mesh.physics.setLinearVelocity(new flock.BABYLON.Vector3(0, v.y, 0));

                        // keep yaw free; kill roll/pitch
                        mesh.physics.setAngularVelocity(new flock.BABYLON.Vector3(0, 0, 0));
                  } catch (err) {
                        console.warn("Physics body became invalid:", err);
                  }
                });
          }
        },
        getCamera() {
                return "__active_camera__";
        },
        cameraControl(key, action) {
                // Define a local function to handle the camera actions
                function handleCameraAction() {
                        if (flock.scene.activeCamera.keysRotateLeft) {
                                // FreeCamera specific controls
                                switch (action) {
                                        case "moveUp":
                                                flock.scene.activeCamera.keysUp.push(key);
                                                break;
                                        case "moveDown":
                                                flock.scene.activeCamera.keysDown.push(key);
                                                break;
                                        case "moveLeft":
                                                flock.scene.activeCamera.keysLeft.push(key);
                                                break;
                                        case "moveRight":
                                                flock.scene.activeCamera.keysRight.push(key);
                                                break;
                                        case "rotateUp":
                                                flock.scene.activeCamera.keysRotateUp.push(key);
                                                break;
                                        case "rotateDown":
                                                flock.scene.activeCamera.keysRotateDown.push(key);
                                                break;
                                        case "rotateLeft":
                                                flock.scene.activeCamera.keysRotateLeft.push(key);
                                                break;
                                        case "rotateRight":
                                                flock.scene.activeCamera.keysRotateRight.push(key);
                                                break;
                                }
                        } else {
                                // ArcRotateCamera specific controls
                                switch (action) {
                                        case "rotateLeft":
                                        case "moveLeft":
                                                flock.scene.activeCamera.keysLeft.push(key);
                                                break;
                                        case "rotateRight":
                                        case "moveRight":
                                                flock.scene.activeCamera.keysRight.push(key);
                                                break;
                                        case "moveUp":
                                        case "rotateUp":
                                                flock.scene.activeCamera.keysUp.push(key);
                                                break;
                                        case "moveDown":
                                        case "rotateDown":
                                                flock.scene.activeCamera.keysDown.push(key);
                                                break;
                                }
                        }
                }

                if (flock.scene.activeCamera) {
                        handleCameraAction();
                } else {
                        console.error("No active camera found in the scene.");
                }
        },

}
