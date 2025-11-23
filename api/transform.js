let flock;

export function setFlockReference(ref) {
  flock = ref;
}

export const flockTransform = {
  positionAt(meshName, {
    x = 0,
    y = 0,
    z = 0,
    useY = true,
    yReference = "BASE",
  } = {}) {
    return new Promise((resolve, reject) => {
      flock.whenModelReady(meshName, (mesh) => {
        if (!mesh) {
          reject(new Error(`Mesh '${meshName}' not found`));
          return;
        }

        x ??= mesh.position.x;
        y ??= mesh.position.y;
        z ??= mesh.position.z;

        if (mesh.physics) {
          if (
            mesh.physics.getMotionType() !==
            flock.BABYLON.PhysicsMotionType.DYNAMIC
          ) {
            mesh.physics.setMotionType(
              flock.BABYLON.PhysicsMotionType.ANIMATED,
            );
          }
        }

        // Check if we have pivot settings in metadata
        if (mesh.metadata && mesh.metadata.pivotSettings) {
          const pivotSettings = mesh.metadata.pivotSettings;
          const boundingBox =
            mesh.getBoundingInfo().boundingBox.extendSize;

          // Helper to resolve pivot values
          function resolvePivotValue(value, axis) {
            if (typeof value === "string") {
              switch (value) {
                case "MIN":
                  return -boundingBox[axis];
                case "MAX":
                  return boundingBox[axis];
                case "CENTER":
                default:
                  return 0;
              }
            } else if (typeof value === "number") {
              return value;
            } else {
              return 0;
            }
          }

          // Calculate offset based on pivot settings
          const pivotOffsetX = resolvePivotValue(pivotSettings.x, "x");
          const pivotOffsetY = resolvePivotValue(pivotSettings.y, "y");
          const pivotOffsetZ = resolvePivotValue(pivotSettings.z, "z");

          // Apply position with pivot offset
          mesh.position.set(
            x - pivotOffsetX,
            useY ? y - pivotOffsetY : mesh.position.y,
            z - pivotOffsetZ,
          );
        } else {
          // Original behavior if no pivot settings
          const addY =
            meshName === "__active_camera__"
              ? 0
              : mesh.getBoundingInfo().boundingBox.extendSize.y *
                mesh.scaling.y;
          let targetY = useY ? y + addY : mesh.position.y;
          mesh.position.set(x, targetY, z);
        }

        // Update physics and world matrix
        if (mesh.physics) {
          mesh.physics.disablePreStep = false;
          mesh.physics.setTargetTransform(
            mesh.position,
            mesh.rotationQuaternion,
          );
        }
        mesh.computeWorldMatrix(true);
        //console.log("Position at", x, y, z, mesh.position.y, mesh);

        resolve();

      });
    });
  },
  moveTo(meshName, { target, useY = true } = {}) {
    return new Promise((resolve, reject) => {
      flock.whenModelReady(meshName, (mesh1) => {
        if (!mesh1) {
          reject(new Error(`Source mesh '${meshName}' not found`));
          return;
        }

        flock.whenModelReady(target, (mesh2) => {
          if (!mesh2) {
            reject(new Error(`Target mesh '${target}' not found`));
            return;
          }

          try {
            let originalMotionType = null;

            // Store original physics state if physics object
            if (mesh1.physics) {
              originalMotionType = mesh1.physics.getMotionType();

              // Only change motion type if it's not already DYNAMIC or ANIMATED
              if (originalMotionType !== flock.BABYLON.PhysicsMotionType.DYNAMIC &&
                  originalMotionType !== flock.BABYLON.PhysicsMotionType.ANIMATED) {
                mesh1.physics.setMotionType(flock.BABYLON.PhysicsMotionType.ANIMATED);
              }
            }

            // Calculate target position
            const targetAbsPosition = mesh2.getAbsolutePosition().clone();
            if (!useY) {
              targetAbsPosition.y = mesh1.getAbsolutePosition().y;
            }

            // Perform immediate movement
            mesh1.setAbsolutePosition(targetAbsPosition);
            mesh1.computeWorldMatrix(true);

            // Update physics if present
            if (mesh1.physics) {
              mesh1.physics.disablePreStep = false;
              mesh1.physics.setTargetTransform(
                mesh1.position,
                mesh1.rotationQuaternion,
              );

              // Restore original motion type if it was changed and different from ANIMATED
              if (originalMotionType && 
                  originalMotionType !== flock.BABYLON.PhysicsMotionType.ANIMATED &&
                  originalMotionType !== flock.BABYLON.PhysicsMotionType.DYNAMIC) {
                // Use setTimeout to allow physics update to complete first
                setTimeout(() => {
                  mesh1.physics.setMotionType(originalMotionType);
                }, 0);
              }
            }

            resolve();

          } catch (error) {
            reject(new Error(`Failed to move mesh '${meshName}' to '${target}': ${error.message}`));
          }
        });
      });
    });
  },
  moveByVector(meshName, { x = 0, y = 0, z = 0 } = {}) {
    return new Promise((resolve, reject) => {
      flock.whenModelReady(meshName, (mesh) => {
        if (!mesh) {
          reject(new Error(`Mesh '${meshName}' not found`));
          return;
        }

        try {
          let originalMotionType = null;
          let originalVelocity = null;
          let motionTypeTemporarilyChanged = false;

          if (mesh.physics) {
            originalMotionType = mesh.physics.getMotionType?.();
            originalVelocity = mesh.physics.getLinearVelocity?.();

            // Only coerce to ANIMATED if the body is neither DYNAMIC nor ANIMATED.
            if (
              originalMotionType !== flock.BABYLON.PhysicsMotionType.DYNAMIC &&
              originalMotionType !== flock.BABYLON.PhysicsMotionType.ANIMATED
            ) {
              mesh.physics.setMotionType(flock.BABYLON.PhysicsMotionType.ANIMATED);
              motionTypeTemporarilyChanged = true;
            }
          }

          // Apply position delta
          mesh.position.addInPlace(new flock.BABYLON.Vector3(x, y, z));

          if (mesh.physics) {
            if (
              originalMotionType === flock.BABYLON.PhysicsMotionType.ANIMATED ||
              motionTypeTemporarilyChanged
            ) {
              // For ANIMATED bodies, drive transform explicitly.
              mesh.physics.disablePreStep = false;
              mesh.physics.setTargetTransform(
                mesh.position,
                mesh.rotationQuaternion
              );
            } else if (originalMotionType === flock.BABYLON.PhysicsMotionType.DYNAMIC) {
              // For DYNAMIC bodies, do not call setTargetTransform.
              // Preserve horizontal velocity; zero vertical to avoid solver fighting the Y nudge.
              if (originalVelocity) {
                originalVelocity.y = 0;
                mesh.physics.setLinearVelocity(originalVelocity);
              }
            }

            // Restore original motion type if we coerced it temporarily.
            if (
              motionTypeTemporarilyChanged &&
              originalMotionType !== flock.BABYLON.PhysicsMotionType.ANIMATED &&
              originalMotionType !== flock.BABYLON.PhysicsMotionType.DYNAMIC
            ) {
              setTimeout(() => {
                mesh.physics.setTargetTransform(mesh.position, mesh.rotationQuaternion);
                mesh.physics.setMotionType(originalMotionType);
              }, 0);
            }
          }

          mesh.computeWorldMatrix(true);
          resolve();
        } catch (error) {
          reject(new Error(`Failed to move mesh '${meshName}' by vector: ${error.message}`));
        }
      });
    });
  },
  distanceTo(meshName1, meshName2) {
    try {
      const mesh1 = flock.scene.getMeshByName(meshName1);
      const mesh2 = flock.scene.getMeshByName(meshName2);

      if (!mesh1) {
        throw new Error(`First mesh '${meshName1}' not found`);
      }

      if (!mesh2) {
        throw new Error(`Second mesh '${meshName2}' not found`);
      }

      const distance = flock.BABYLON.Vector3.Distance(
        mesh1.position,
        mesh2.position,
      );

      return distance;

    } catch (error) {
      throw new Error(`Failed to calculate distance between '${meshName1}' and '${meshName2}': ${error.message}`);
    }
  },
  rotate(meshName, { x = 0, y = 0, z = 0 } = {}) {
    // Handle mesh rotation
    return flock.whenModelReady(meshName, (mesh) => {
      if (meshName === "__active_camera__") {
        // Handle camera rotation
        const camera = flock.scene.activeCamera;
        if (!camera) return;

        const incrementalRotation =
          flock.BABYLON.Quaternion.RotationYawPitchRoll(
            flock.BABYLON.Tools.ToRadians(y),
            flock.BABYLON.Tools.ToRadians(x),
            flock.BABYLON.Tools.ToRadians(z),
          );

        // Check if the camera is ArcRotateCamera or FreeCamera, and rotate accordingly
        if (camera.alpha !== undefined) {
          // ArcRotateCamera: Adjust the 'alpha' (horizontal) and 'beta' (vertical)
          camera.alpha += flock.BABYLON.Tools.ToRadians(y);
          camera.beta += flock.BABYLON.Tools.ToRadians(x);
        } else if (camera.rotation !== undefined) {
          // FreeCamera: Adjust the camera's rotationQuaternion or Euler rotation
          if (!camera.rotationQuaternion) {
            camera.rotationQuaternion =
              flock.BABYLON.Quaternion.RotationYawPitchRoll(
                flock.BABYLON.Tools.ToRadians(
                  camera.rotation.y,
                ),
                flock.BABYLON.Tools.ToRadians(
                  camera.rotation.x,
                ),
                flock.BABYLON.Tools.ToRadians(
                  camera.rotation.z,
                ),
              );
          }

          camera.rotationQuaternion
            .multiplyInPlace(incrementalRotation)
            .normalize();
        }
        return;
      }

      const incrementalRotation =
        flock.BABYLON.Quaternion.RotationYawPitchRoll(
          flock.BABYLON.Tools.ToRadians(y),
          flock.BABYLON.Tools.ToRadians(x),
          flock.BABYLON.Tools.ToRadians(z),
        );
      mesh.rotationQuaternion
        .multiplyInPlace(incrementalRotation)
        .normalize();

      if (mesh.physics) {
        mesh.physics.disablePreStep = false;
        mesh.physics.setTargetTransform(
          mesh.absolutePosition,
          mesh.rotationQuaternion,
        );
      }
      mesh.computeWorldMatrix(true);
    });
  },
  rotateTo(meshName, { x = 0, y = 0, z = 0 } = {}) {
    return flock.whenModelReady(meshName, (mesh) => {
      if (meshName === "__active_camera__") {
        const camera = flock.scene.activeCamera;
        if (!camera) return;
        // For an ArcRotateCamera, set the absolute alpha (horizontal) and beta (vertical) angles.
        if (camera.alpha !== undefined) {
          camera.alpha = flock.BABYLON.Tools.ToRadians(y); // horizontal
          camera.beta = flock.BABYLON.Tools.ToRadians(x); // vertical
        }
        // For a FreeCamera or any camera using a rotationQuaternion:
        else if (camera.rotation !== undefined) {
          // Ensure a rotationQuaternion exists.
          if (!camera.rotationQuaternion) {
            camera.rotationQuaternion =
              flock.BABYLON.Quaternion.RotationYawPitchRoll(
                flock.BABYLON.Tools.ToRadians(
                  camera.rotation.y,
                ),
                flock.BABYLON.Tools.ToRadians(
                  camera.rotation.x,
                ),
                flock.BABYLON.Tools.ToRadians(
                  camera.rotation.z,
                ),
              ).normalize();
          }
          // Create the target quaternion using the absolute Euler angles.
          // Here we assume y is yaw, x is pitch, and z is roll.
          const targetQuat =
            flock.BABYLON.Quaternion.RotationYawPitchRoll(
              flock.BABYLON.Tools.ToRadians(y),
              flock.BABYLON.Tools.ToRadians(x),
              flock.BABYLON.Tools.ToRadians(z),
            ).normalize();
          // Set the camera's rotationQuaternion directly to the target.
          camera.rotationQuaternion = targetQuat;
        }
        return;
      }
      // Ensure mesh has a rotation quaternion
      if (!mesh.rotationQuaternion) {
        mesh.rotationQuaternion = flock.BABYLON.Quaternion.RotationYawPitchRoll(
          mesh.rotation.y,
          mesh.rotation.x,
          mesh.rotation.z,
        );
      }

      // Create the target rotation quaternion from absolute Euler angles (degrees)
      const targetQuat = flock.BABYLON.Quaternion.RotationYawPitchRoll(
        flock.BABYLON.Tools.ToRadians(y), // yaw
        flock.BABYLON.Tools.ToRadians(x), // pitch
        flock.BABYLON.Tools.ToRadians(z)  // roll
      ).normalize();

      // Set the mesh's rotation directly to the target
      mesh.rotationQuaternion = targetQuat;

      // Update physics if present
      if (mesh.physics) {
        mesh.physics.disablePreStep = false;
        mesh.physics.setTargetTransform(
          mesh.absolutePosition,
          mesh.rotationQuaternion,
        );
      }
      mesh.computeWorldMatrix(true);
    });
  },
  async lookAt(meshName, { target, useY = false } = {}) {
    const [mesh1, mesh2] = await Promise.all([
      flock.whenModelReady(meshName),
      flock.whenModelReady(target),
    ]);

    const scene = mesh1.getScene?.() ?? mesh2.getScene?.();
    if (!scene) return;

    // Camera special case: Babylon camera API already handles this well.
    if (meshName === "__active_camera__" && typeof mesh1.setTarget === "function") {
      const camPos = mesh1.getAbsolutePosition?.() ?? mesh1.absolutePosition;
      const tgtPos = (mesh2.getAbsolutePosition?.() ?? mesh2.absolutePosition).clone();
      if (!useY) tgtPos.y = camPos.y;
      mesh1.setTarget(tgtPos);
      await new Promise(resolve => {
        const cb = () => { scene.onAfterRenderObservable.removeCallback(cb); resolve(); };
        scene.onAfterRenderObservable.add(cb);
      });
      return;
    }

    // If the body isn't fully dynamic, drive it as ANIMATED (kinematic-like) so we can set orientation.
    if (mesh1.physics) {
      const mt = mesh1.physics.getMotionType();
      if (mt !== flock.BABYLON.PhysicsMotionType.DYNAMIC) {
        mesh1.physics.setMotionType(flock.BABYLON.PhysicsMotionType.ANIMATED);
      }
    }

    // Build a look direction toward target (flatten Y if requested)
    const p1 = mesh1.getAbsolutePosition?.() ?? mesh1.absolutePosition;
    const p2 = mesh2.getAbsolutePosition?.() ?? mesh2.absolutePosition;
    const dir = p2.subtract(p1);
    if (!useY) dir.y = 0;
    if (dir.lengthSquared() === 0) return; // already at target horizontally

    dir.normalize();

    // Babylon is left-handed; FromLookDirectionLH expects a forward (toward target) and up.
    const up = flock.BABYLON.Axis.Y; // world up
    const q = flock.BABYLON.Quaternion.FromLookDirectionLH(dir, up);

    // Ensure we’re using quaternions for rotation (safer with physics)
    if (!mesh1.rotationQuaternion) {
      mesh1.rotationQuaternion = new flock.BABYLON.Quaternion();
    }
    mesh1.rotationQuaternion.copyFrom(q);
    mesh1.computeWorldMatrix(true);

    // Wait one tick so transforms “stick” before returning.
    if (mesh1.physics) {
      await new Promise(resolve => {
        const cb = () => { scene.onAfterPhysicsObservable.removeCallback(cb); resolve(); };
        scene.onAfterPhysicsObservable.add(cb);
      });
    } else {
      await new Promise(resolve => {
        const cb = () => { scene.onAfterRenderObservable.removeCallback(cb); resolve(); };
        scene.onAfterRenderObservable.add(cb);
      });
    }

    mesh1.computeWorldMatrix(true);
  },
  scale(
    meshName,
    {
      x = 1,
      y = 1,
      z = 1,
      xOrigin = "CENTRE",
      yOrigin = "BOTTOM",
      zOrigin = "CENTRE",
    } = {}
  ) {
    return flock.whenModelReady(meshName, (mesh) => {
      mesh.metadata = mesh.metadata || {};
      mesh.metadata.origin = { xOrigin, yOrigin, zOrigin };

      if (mesh.physics) {
        mesh.physics.disablePreStep = false;
      }
      // Get the original bounding box dimensions and positions
      const boundingInfo = mesh.getBoundingInfo();
      const originalMinY = boundingInfo.boundingBox.minimumWorld.y;
      const originalMaxY = boundingInfo.boundingBox.maximumWorld.y;
      const originalMinX = boundingInfo.boundingBox.minimumWorld.x;
      const originalMaxX = boundingInfo.boundingBox.maximumWorld.x;
      const originalMinZ = boundingInfo.boundingBox.minimumWorld.z;
      const originalMaxZ = boundingInfo.boundingBox.maximumWorld.z;

      // Apply scaling to the mesh
      mesh.scaling = new flock.BABYLON.Vector3(x, y, z);

      mesh.refreshBoundingInfo();
      mesh.computeWorldMatrix(true);

      // Get the new bounding box information after scaling
      const newBoundingInfo = mesh.getBoundingInfo();
      //console.log(newBoundingInfo);
      const newMinY = newBoundingInfo.boundingBox.minimumWorld.y;
      const newMaxY = newBoundingInfo.boundingBox.maximumWorld.y;
      const newMinX = newBoundingInfo.boundingBox.minimumWorld.x;
      const newMaxX = newBoundingInfo.boundingBox.maximumWorld.x;
      const newMinZ = newBoundingInfo.boundingBox.minimumWorld.z;
      const newMaxZ = newBoundingInfo.boundingBox.maximumWorld.z;

      // Adjust position based on Y-origin
      if (yOrigin === "BASE") {
        const diffY = newMinY - originalMinY;
        mesh.position.y -= diffY; // Shift the object down by the difference
      } else if (yOrigin === "TOP") {
        const diffY = newMaxY - originalMaxY;
        mesh.position.y -= diffY; // Shift the object up by the difference
      }

      // Adjust position based on X-origin
      if (xOrigin === "LEFT") {
        const diffX = newMinX - originalMinX;
        mesh.position.x -= diffX; // Shift the object to the left
      } else if (xOrigin === "RIGHT") {
        const diffX = newMaxX - originalMaxX;
        mesh.position.x -= diffX; // Shift the object to the right
      }

      // Adjust position based on Z-origin
      if (zOrigin === "FRONT") {
        const diffZ = newMinZ - originalMinZ;
        mesh.position.z -= diffZ; // Shift the object forward
      } else if (zOrigin === "BACK") {
        const diffZ = newMaxZ - originalMaxZ;
        mesh.position.z -= diffZ; // Shift the object backward
      }

      // Refresh bounding info and recompute world matrix
      mesh.refreshBoundingInfo();
      mesh.computeWorldMatrix(true);
      flock.updatePhysics(mesh);
    });
  },
  resize(
    meshName,
    {
      width = null,     
      height = null,   
      depth = null,    
      xOrigin = "CENTRE",
      yOrigin = "BASE",
      zOrigin = "CENTRE",
    } = {}
  ) {
    return flock.whenModelReady(meshName, (mesh) => {
      mesh.metadata = mesh.metadata || {};
      // Save the original local bounding box once.
      if (!mesh.metadata.originalMin || !mesh.metadata.originalMax) {
        const bi = mesh.getBoundingInfo();
        mesh.metadata.originalMin = bi.boundingBox.minimum.clone();
        mesh.metadata.originalMax = bi.boundingBox.maximum.clone();
      }
      const origMin = mesh.metadata.originalMin;
      const origMax = mesh.metadata.originalMax;
      // Compute the original dimensions.
      const origWidth = origMax.x - origMin.x;
      const origHeight = origMax.y - origMin.y;
      const origDepth = origMax.z - origMin.z;
      // Compute new scaling factors based on the original dimensions.
      const scaleX = origWidth && width !== null ? width / origWidth : 1;
      const scaleY = origHeight && height !== null ? height / origHeight : 1;
      const scaleZ = origDepth && depth !== null ? depth / origDepth : 1;
      // Refresh current bounding info and compute the old anchor (world space)
      mesh.refreshBoundingInfo();
      const oldBI = mesh.getBoundingInfo();
      const oldMinWorld = oldBI.boundingBox.minimumWorld;
      const oldMaxWorld = oldBI.boundingBox.maximumWorld;
      const oldAnchor = new flock.BABYLON.Vector3(
        xOrigin === "LEFT"
          ? oldMinWorld.x
          : xOrigin === "RIGHT"
            ? oldMaxWorld.x
            : (oldMinWorld.x + oldMaxWorld.x) / 2,
        yOrigin === "BASE"
          ? oldMinWorld.y
          : yOrigin === "TOP"
            ? oldMaxWorld.y
            : (oldMinWorld.y + oldMaxWorld.y) / 2,
        zOrigin === "FRONT"
          ? oldMinWorld.z
          : zOrigin === "BACK"
            ? oldMaxWorld.z
            : (oldMinWorld.z + oldMaxWorld.z) / 2,
      );
      // Apply the new scaling.
      mesh.scaling = new flock.BABYLON.Vector3(scaleX, scaleY, scaleZ);
      mesh.refreshBoundingInfo();
      mesh.computeWorldMatrix(true);
      // Now compute the new anchor (world space) after scaling.
      const newBI = mesh.getBoundingInfo();
      const newMinWorld = newBI.boundingBox.minimumWorld;
      const newMaxWorld = newBI.boundingBox.maximumWorld;
      const newAnchor = new flock.BABYLON.Vector3(
        xOrigin === "LEFT"
          ? newMinWorld.x
          : xOrigin === "RIGHT"
            ? newMaxWorld.x
            : (newMinWorld.x + newMaxWorld.x) / 2,
        yOrigin === "BASE"
          ? newMinWorld.y
          : yOrigin === "TOP"
            ? newMaxWorld.y
            : (newMinWorld.y + newMaxWorld.y) / 2,
        zOrigin === "FRONT"
          ? newMinWorld.z
          : zOrigin === "BACK"
            ? newMaxWorld.z
            : (newMinWorld.z + newMaxWorld.z) / 2,
      );
      // Compute the difference and adjust the mesh's position so the anchor stays fixed.
      const diff = newAnchor.subtract(oldAnchor);
      mesh.position.subtractInPlace(diff);
      // Final updates.
      mesh.refreshBoundingInfo();
      mesh.computeWorldMatrix(true);
      flock.updatePhysics(mesh);
    });
  },
  setPivotPoint(meshName, {
    xPivot = "CENTER",
    yPivot = "MIN",     // <- default Y is MIN (BASE)
    zPivot = "CENTER",
  } = {}) {
    return flock.whenModelReady(meshName, (mesh) => {
      if (!mesh) return;

      const BABYLON = flock.BABYLON;

      const bounding = mesh.getBoundingInfo().boundingBox.extendSize;
      function resolvePivotValue(value, axis) {
        if (typeof value === "string") {
          switch (value) {
            case "MIN":    return -bounding[axis];
            case "MAX":    return  bounding[axis];
            case "CENTER":
            default:       return 0;
          }
        }
        return (typeof value === "number") ? value : 0;
      }

      // OLD pivot from metadata; default Y is MIN, X/Z are CENTER
      const prev = (mesh.metadata && mesh.metadata.pivotSettings) || { x: "CENTER", y: "MIN", z: "CENTER" };
      const oldPivotLocal = new BABYLON.Vector3(
        resolvePivotValue(prev.x, "x"),
        resolvePivotValue(prev.y, "y"),
        resolvePivotValue(prev.z, "z"),
      );

      // NEW pivot from args (Y defaults to MIN above)
      const newPivotLocal = new BABYLON.Vector3(
        resolvePivotValue(xPivot, "x"),
        resolvePivotValue(yPivot, "y"),
        resolvePivotValue(zPivot, "z"),
      );

      // World position of OLD pivot (before change)
      mesh.computeWorldMatrix(true);
      const wmBefore = mesh.getWorldMatrix().clone();
      const oldPivotWorld = BABYLON.Vector3.TransformCoordinates(oldPivotLocal, wmBefore);

      // Apply new pivot to mesh (and children, per your existing behavior)
      mesh.setPivotPoint(newPivotLocal);
      mesh.getChildMeshes().forEach((child) => child.setPivotPoint(newPivotLocal));

      // World position of NEW pivot (after change)
      mesh.computeWorldMatrix(true);
      const wmAfter = mesh.getWorldMatrix().clone();
      const newPivotWorld = BABYLON.Vector3.TransformCoordinates(newPivotLocal, wmAfter);

      // Reposition to preserve visual placement
      const delta = oldPivotWorld.subtract(newPivotWorld);
      mesh.position.addInPlace(delta);

      // Physics sync
      if (mesh.physics) {
        if (mesh.physics.getMotionType() !== BABYLON.PhysicsMotionType.DYNAMIC) {
          mesh.physics.setMotionType(BABYLON.PhysicsMotionType.ANIMATED);
        }
        const rq = mesh.rotationQuaternion || BABYLON.Quaternion.FromEulerAngles(mesh.rotation.x, mesh.rotation.y, mesh.rotation.z);
        mesh.physics.disablePreStep = false;
        mesh.physics.setTargetTransform(mesh.position, rq);
      }

      mesh.computeWorldMatrix(true);

      // Save NEW pivot settings
      mesh.metadata = mesh.metadata || {};
      mesh.metadata.pivotSettings = { x: xPivot, y: yPivot, z: zPivot };
    });
  },

}