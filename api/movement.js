let flock;

export function setFlockReference(ref) {
  flock = ref;
}

export const flockMovement = {
  moveForward(modelName, speed) {
    const model = flock.scene.getMeshByName(modelName);
    if (!model || !model.physics || speed === 0) return;

    flock.ensureVerticalConstraint(model);

    // --- CONFIGURATION ---
    const capsuleHeightBottomOffset = 1.0;
    const capsuleRadius = 0.5;
    const deltaTime = 0.016;
    const maxSlopeAngle = 45;
    const groundCheckDistance = 0.3; // Increased ground check distance
    const DEBUG = true;

    // --- MOVEMENT CALCULATION ---
    const camForward = flock.scene.activeCamera.getForwardRay().direction;
    const horizontalForward = new flock.BABYLON.Vector3(
      camForward.x,
      0,
      camForward.z,
    ).normalize();
    let desiredMovement = horizontalForward.scale(speed);

    // --- GROUND CHECK ---
    const groundCheckStart = model.position.clone();
    const groundCheckEnd = groundCheckStart.add(
      new flock.BABYLON.Vector3(0, -groundCheckDistance, 0),
    );

    const groundQuery = {
      shape: new flock.BABYLON.PhysicsShapeCapsule(
        new flock.BABYLON.Vector3(0, -capsuleHeightBottomOffset, 0),
        new flock.BABYLON.Vector3(0, capsuleHeightBottomOffset, 0),
        capsuleRadius,
        flock.scene,
      ),
      rotation: model.rotationQuaternion || flock.BABYLON.Quaternion.Identity(),
      startPosition: groundCheckStart,
      endPosition: groundCheckEnd,
      shouldHitTriggers: false,
    };

    const groundResult = new flock.BABYLON.ShapeCastResult();
    const groundHitResult = new flock.BABYLON.ShapeCastResult();

    const physicsEngine = flock.scene.getPhysicsEngine();
    if (!physicsEngine) {
      console.warn("No physics engine available.");
      return;
    }
    const havokPlugin = physicsEngine.getPhysicsPlugin();

    havokPlugin.shapeCast(groundQuery, groundResult, groundHitResult);

    // --- STATE TRACKING ---
    const currentVelocity = model.physics.getLinearVelocity();
    let grounded = false;
    let previouslyGrounded = model.isGrounded || false; // Store previous state
    let stateChanged = false;

    // Store grounded state for next frame
    model.isGrounded = grounded;
    // --- APPLY MOVEMENT ---
    const maxVerticalVelocity = 3.0; // Reduced max vertical velocity
    let newVertical = grounded ? 0 : currentVelocity.y;
    newVertical = Math.min(
      Math.max(newVertical, -maxVerticalVelocity),
      maxVerticalVelocity,
    );

    const finalVelocity = new flock.BABYLON.Vector3(
      desiredMovement.x,
      newVertical,
      desiredMovement.z,
    );

    model.physics.setLinearVelocity(finalVelocity);

    // If your mesh is coming out backwards, flip the vector:
    const facingDirection =
      speed >= 0 ? horizontalForward : horizontalForward.scale(-1);

    // Compute the target rotation based on the facing direction.
    const targetRotation = flock.BABYLON.Quaternion.FromLookDirectionLH(
      facingDirection,
      flock.BABYLON.Vector3.Up(),
    );

    // Use the current rotation (defaulting to identity if missing).
    const currentRotation =
      model.rotationQuaternion || flock.BABYLON.Quaternion.Identity();

    // Compute the difference between the current and target rotations.
    const deltaRotation = targetRotation.multiply(currentRotation.conjugate());
    const deltaEuler = deltaRotation.toEulerAngles();

    // Apply angular velocity (adjust multiplier as needed for smoothness).
    model.physics.setAngularVelocity(
      new flock.BABYLON.Vector3(0, deltaEuler.y * 5, 0),
    );

    // Keep the mesh’s rotation constrained to the Y axis.
    // Create a rotation quaternion if it doesn't exist
    if (!model.rotationQuaternion) {
        model.rotationQuaternion = BABYLON.Quaternion.RotationYawPitchRoll(
            model.rotation.y,
            model.rotation.x,
            model.rotation.z
        );
    }

    // Now safely set the values
    model.rotationQuaternion.x = 0;
    model.rotationQuaternion.z = 0;
    model.rotationQuaternion.x = 0;
    model.rotationQuaternion.z = 0;
    model.rotationQuaternion.normalize();
  },
  moveSideways(modelName, speed) {
    const model = flock.scene.getMeshByName(modelName);
    if (!model || speed === 0) return;

    flock.ensureVerticalConstraint(model);

    const sidewaysSpeed = speed;

    // Get the camera's right direction vector (perpendicular to the forward direction)
    const cameraRight = flock.scene.activeCamera
      .getDirection(flock.BABYLON.Vector3.Right())
      .normalize();

    const moveDirection = cameraRight.scale(sidewaysSpeed);
    const currentVelocity = model.physics.getLinearVelocity();

    // Set linear velocity in the sideways direction
    model.physics.setLinearVelocity(
      new flock.BABYLON.Vector3(
        moveDirection.x,
        currentVelocity.y, // Keep Y velocity (no vertical movement)
        moveDirection.z,
      ),
    );

    // Rotate the model to face the direction of movement
    const facingDirection =
      sidewaysSpeed <= 0
        ? new flock.BABYLON.Vector3(
            -cameraRight.x,
            0,
            -cameraRight.z,
          ).normalize() // Right
        : new flock.BABYLON.Vector3(
            cameraRight.x,
            0,
            cameraRight.z,
          ).normalize(); // Left

    const targetRotation = flock.BABYLON.Quaternion.FromLookDirectionLH(
      facingDirection,
      flock.BABYLON.Vector3.Up(),
    );

    const currentRotation = model.rotationQuaternion;
    const deltaRotation = targetRotation.multiply(currentRotation.conjugate());
    const deltaEuler = deltaRotation.toEulerAngles();

    // Apply angular velocity to smoothly rotate the player
    model.physics.setAngularVelocity(
      new flock.BABYLON.Vector3(0, deltaEuler.y * 5, 0),
    );

    // Normalize the model's rotation to avoid drift
    model.rotationQuaternion.x = 0;
    model.rotationQuaternion.z = 0;
    model.rotationQuaternion.normalize();
  },
  strafe(modelName, speed) {
    const model = flock.scene.getMeshByName(modelName);
    if (!model || speed === 0) return;

    const sidewaysSpeed = speed;

    // Get the camera's right direction vector (perpendicular to the forward direction)
    const cameraRight = flock.scene.activeCamera
      .getForwardRay()
      .direction.cross(flock.BABYLON.Vector3.Up())
      .normalize();

    const moveDirection = cameraRight.scale(sidewaysSpeed);
    const currentVelocity = model.physics.getLinearVelocity();

    // Set linear velocity in the sideways direction (left or right)
    model.physics.setLinearVelocity(
      new flock.BABYLON.Vector3(
        moveDirection.x,
        currentVelocity.y,
        moveDirection.z,
      ),
    );
  },
  updateDynamicMeshPositions(scene, dynamicMeshes) {
    const capsuleHalfHeight = 1;
    // When the capsule’s bottom is within this distance of the ground, we treat it as contact.
    const groundContactThreshold = 0.05;
    // If the gap is larger than this, assume the capsule is airborne and skip correction.
    const maxGroundContactGap = 0.1;
    // Maximum lerp factor per frame for ground correction.
    const lerpFactor = 0.1;
    // Only apply correction on nearly flat surfaces.
    const flatThreshold = 0.98; // dot product of surface normal with up

    dynamicMeshes.forEach((mesh) => {
      mesh.physics.setCollisionCallbackEnabled(true);
      const observable = mesh.physics.getCollisionObservable();
      const observer = observable.add((collisionEvent) => {
        //console.log("Collision event", collisionEvent);

        const penetration = Math.abs(collisionEvent.distance);
        // If the penetration is extremely small (indicating minor clipping)
        if (penetration < 0.001) {
          // Read the current vertical velocity.
          const currentVel = mesh.physics.getLinearVelocity();
          // If there is an upward impulse being applied by the solver,
          // override it by setting the vertical velocity to zero.
          if (currentVel.y > 0) {
            mesh.physics.setLinearVelocity(
              new flock.BABYLON.Vector3(currentVel.x, 0, currentVel.z),
            );
            console.log(
              "Collision callback: small penetration detected. Overriding upward velocity.",
            );
          }

          dynamicMeshes.forEach((mesh) => {
            // Use a downward ray to determine the gap to the ground.
            const capsuleHalfHeight = 1; // adjust as needed
            const rayOrigin = mesh.position
              .clone()
              .add(new flock.BABYLON.Vector3(0, -capsuleHalfHeight, 0));
            const downRay = new flock.BABYLON.Ray(
              rayOrigin,
              new flock.BABYLON.Vector3(0, -1, 0),
              3,
            );
            const hit = scene.pickWithRay(downRay, (m) =>
              m.name.toLowerCase().includes("ground"),
            );
            if (hit && hit.pickedMesh) {
              const groundY = hit.pickedPoint.y;
              const capsuleBottomY = mesh.position.y - capsuleHalfHeight;
              const gap = capsuleBottomY - groundY;
              // If the gap is very small (i.e. the capsule is on or nearly on the ground)
              // and the vertical velocity is upward, override it.
              const currentVel = mesh.physics.getLinearVelocity();
              if (Math.abs(gap) < 0.1 && currentVel.y > 0) {
                mesh.physics.setLinearVelocity(
                  new flock.BABYLON.Vector3(currentVel.x, 0, currentVel.z),
                );
                console.log("After-render: resetting upward velocity");
              }
            }
          });
        }
      });
    });
  },
};
