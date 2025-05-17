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
}