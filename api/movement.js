let flock;

export function setFlockReference(ref) {
  flock = ref;
}

function getHorizontalDirection(vector) {
  const horizontalDirection = new flock.BABYLON.Vector3(vector.x, 0, vector.z);
  if (horizontalDirection.lengthSquared() <= 1e-8) {
    return null;
  }

  return horizontalDirection.normalize();
}

function ensureModelRotationQuaternion(model) {
  if (!model.rotationQuaternion) {
    const rotation = model.rotation || flock.BABYLON.Vector3.Zero();
    model.rotationQuaternion = flock.BABYLON.Quaternion.RotationYawPitchRoll(
      rotation.y || 0,
      rotation.x || 0,
      rotation.z || 0,
    );
  }
  model.computeWorldMatrix?.(true);
}

function getModelHorizontalAxes(model) {
  ensureModelRotationQuaternion(model);
  const metadata = (model.metadata = model.metadata || {});

  // Prefer local +Z for self-forward; fallback to -Z if needed.
  let forward = getHorizontalDirection(
    model.getDirection(flock.BABYLON.Vector3.Forward()),
  );
  if (!forward) {
    forward = getHorizontalDirection(
      model.getDirection(flock.BABYLON.Vector3.Backward()),
    );
  }

  // Build a horizontal right axis from forward to avoid roll/pitch artifacts.
  let right = forward
    ? getHorizontalDirection(flock.BABYLON.Vector3.Up().cross(forward))
    : null;
  if (!right) {
    right = getHorizontalDirection(
      model.getDirection(flock.BABYLON.Vector3.Right()),
    );
  }

  // Cache the first valid axes we see (useful for imported models before lookAt).
  if (forward && right) {
    metadata.defaultFacingAxes = {
      forward: forward.clone(),
      right: right.clone(),
    };
    return { forward, right };
  }

  // If orientation hasn't been established yet, fall back to cached/default world axes.
  if (metadata.defaultFacingAxes?.forward && metadata.defaultFacingAxes?.right) {
    return {
      forward: metadata.defaultFacingAxes.forward.clone(),
      right: metadata.defaultFacingAxes.right.clone(),
    };
  }

  return {
    forward: flock.BABYLON.Vector3.Forward(),
    right: flock.BABYLON.Vector3.Right(),
  };
}

export const flockMovement = {
  moveForward(modelName, speed) {
    const model = flock.scene.getMeshByName(modelName);
    if (!model || !model.physics || speed === 0) return;

    flock.ensureVerticalConstraint(model);

    // --- Tunables ---
    const cap = model.metadata?.physicsCapsule;
    if (
      !cap ||
      typeof cap.radius !== "number" ||
      typeof cap.height !== "number"
    )
      return;
    const capsuleRadius = cap.radius;

    // height is the full capsule height (including hemispherical caps)
    const capsuleHeightBottomOffset = Math.max(
      0.001,
      cap.height * 0.5 - capsuleRadius,
    );

    const maxSlopeAngleDeg = 45;
    const groundCheckDistance = 0.3;
    const coyoteTimeMs = 120; // brief grace after leaving ground
    const airControlFactor = 0.0; // 0 = no airborne acceleration
    const airDragPerTick = 0.9; // horizontal decay while airborne
    const stepHeight = 0.3;
    const stepProbeDistance = 0.6;
    const maxVerticalVelocity = 3.0;

    const up = flock.BABYLON.Vector3.Up();
    const scene = flock.scene;

    // Desired horizontal direction from camera
    const cameraForward = scene.activeCamera.getForwardRay().direction;
    const horizontalForward = new flock.BABYLON.Vector3(
      cameraForward.x,
      0,
      cameraForward.z,
    ).normalize();
    const desiredHorizontalVelocity = horizontalForward.scale(speed);

    // --- Grounded check via capsule shapeCast ---
    const groundCheckStart = model.position.clone();
    const groundCheckEnd = groundCheckStart.add(
      new flock.BABYLON.Vector3(0, -groundCheckDistance, 0),
    );

    const physicsEngine = scene.getPhysicsEngine();
    if (!physicsEngine) return;
    const havokPlugin = physicsEngine.getPhysicsPlugin();

    const groundQuery = {
      shape: new flock.BABYLON.PhysicsShapeCapsule(
        new flock.BABYLON.Vector3(0, -capsuleHeightBottomOffset, 0),
        new flock.BABYLON.Vector3(0, capsuleHeightBottomOffset, 0),
        capsuleRadius,
        scene,
      ),
      rotation: model.rotationQuaternion || flock.BABYLON.Quaternion.Identity(),
      startPosition: groundCheckStart,
      endPosition: groundCheckEnd,
      shouldHitTriggers: false,
      ignoredBodies: [], // must be an array
      collisionFilterGroup: -1,
      collisionFilterMask: -1,
    };

    const groundResult = new flock.BABYLON.ShapeCastResult();
    const groundHitResult = new flock.BABYLON.ShapeCastResult();
    havokPlugin.shapeCast(groundQuery, groundResult, groundHitResult);

    let grounded = false;
    if (groundResult.hasHit) {
      const n = groundResult.hitNormalWorld;
      if (n) {
        const dot = flock.BABYLON.Vector3.Dot(n.normalize(), up);
        const clampedDot = Math.min(Math.max(dot, -1), 1);
        const angleDeg = (Math.acos(clampedDot) * 180) / Math.PI;
        grounded = angleDeg <= maxSlopeAngleDeg;
      } else {
        grounded = true;
      }
    }

    //console.log("Grounded", grounded);

    // --- Coyote time window ---
    const nowMs =
      typeof performance !== "undefined" && performance.now
        ? performance.now()
        : Date.now();
    if (grounded) model._lastGroundedAt = nowMs;
    const withinCoyoteTime = model._lastGroundedAt
      ? nowMs - model._lastGroundedAt <= coyoteTimeMs
      : false;

    // --- Horizontal control policy ---
    const currentVelocity = model.physics.getLinearVelocity();
    const currentHorizontalVelocity = new flock.BABYLON.Vector3(
      currentVelocity.x,
      0,
      currentVelocity.z,
    );

    let appliedHorizontalVelocity;
    if (grounded || withinCoyoteTime) {
      // full control on ground/coyote
      appliedHorizontalVelocity = desiredHorizontalVelocity;
    } else {
      // airborne: no acceleration toward input, apply drag
      appliedHorizontalVelocity =
        currentHorizontalVelocity.scale(airDragPerTick);
      if (airControlFactor > 0) {
        appliedHorizontalVelocity = appliedHorizontalVelocity.add(
          desiredHorizontalVelocity.scale(airControlFactor),
        );
      }
    }

    // --- Step-up probe to allow ledge hops when near ground ---
    if (grounded || withinCoyoteTime) {
      const probeStartLow = model.position.add(
        new flock.BABYLON.Vector3(0, 0.05, 0),
      );
      const probeEndLow = probeStartLow.add(
        horizontalForward.scale(stepProbeDistance),
      );
      const probeStartHigh = probeStartLow.add(
        new flock.BABYLON.Vector3(0, stepHeight + 0.1, 0),
      );
      const probeEndHigh = probeStartHigh.add(
        horizontalForward.scale(stepProbeDistance),
      );

      const stepProbeQueryLow = {
        shape: new flock.BABYLON.PhysicsShapeSphere(
          new flock.BABYLON.Vector3(0, 0, 0),
          capsuleRadius * 0.8,
          scene,
        ),
        rotation: flock.BABYLON.Quaternion.Identity(),
        startPosition: probeStartLow,
        endPosition: probeEndLow,
        shouldHitTriggers: false,
        ignoredBodies: [],
        collisionFilterGroup: -1,
        collisionFilterMask: -1,
      };
      const stepProbeQueryHigh = {
        ...stepProbeQueryLow,
        startPosition: probeStartHigh,
        endPosition: probeEndHigh,
      };

      const lowResult = new flock.BABYLON.ShapeCastResult();
      const lowHitResult = new flock.BABYLON.ShapeCastResult();
      havokPlugin.shapeCast(stepProbeQueryLow, lowResult, lowHitResult);

      if (lowResult.hasHit) {
        const highResult = new flock.BABYLON.ShapeCastResult();
        const highHitResult = new flock.BABYLON.ShapeCastResult();
        havokPlugin.shapeCast(stepProbeQueryHigh, highResult, highHitResult);
        if (!highResult.hasHit) {
          // Only boost if we haven't recently boosted
          const lastStepBoost = model._lastStepBoost || 0;
          if (nowMs - lastStepBoost > 400) {
            model._lastStepBoost = nowMs;

            // Apply upward boost
            const boostedVelocity = new flock.BABYLON.Vector3(
              appliedHorizontalVelocity.x,
              Math.max(currentVelocity.y, 2.5),
              appliedHorizontalVelocity.z,
            );
            model.physics.setLinearVelocity(boostedVelocity);
            return; // Skip rest of movement logic this frame
          }
        }
      }
    }

    // --- Vertical: let gravity act; just clamp extremes ---
    const clampedVertical = Math.min(
      Math.max(currentVelocity.y, -maxVerticalVelocity),
      maxVerticalVelocity,
    );

    const finalVelocity = new flock.BABYLON.Vector3(
      appliedHorizontalVelocity.x,
      clampedVertical,
      appliedHorizontalVelocity.z,
    );
    model.physics.setLinearVelocity(finalVelocity);

    // --- Face movement direction if there is meaningful horizontal speed ---
    const horizontalSpeedSq = appliedHorizontalVelocity.lengthSquared();
    if (horizontalSpeedSq > 1e-6) {
      const facingDirection = appliedHorizontalVelocity.normalize();
      const targetRotation = flock.BABYLON.Quaternion.FromLookDirectionLH(
        facingDirection,
        up,
      );
      const currentRotation =
        model.rotationQuaternion || flock.BABYLON.Quaternion.Identity();
      const deltaRotation = targetRotation.multiply(
        currentRotation.conjugate(),
      );
      const deltaEuler = deltaRotation.toEulerAngles();
      model.physics.setAngularVelocity(
        new flock.BABYLON.Vector3(0, deltaEuler.y * 5, 0),
      );
    }

    if (!model.rotationQuaternion) {
      model.rotationQuaternion = flock.BABYLON.Quaternion.RotationYawPitchRoll(
        model.rotation.y,
        model.rotation.x,
        model.rotation.z,
      );
    }
    model.rotationQuaternion.x = 0;
    model.rotationQuaternion.z = 0;
    model.rotationQuaternion.normalize();

    model.isGrounded = grounded;
  },
  moveSideways(modelName, speed) {
    const model = flock.scene.getMeshByName(modelName);
    if (!model || !model.physics || speed === 0) return;

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
    if (!model || !model.physics || speed === 0) return;

    const sidewaysSpeed = -speed;

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
  moveForwardLocal(modelName, speed) {
    const model = flock.scene.getMeshByName(modelName);
    if (!model || !model.physics || speed === 0) return;

    flock.ensureVerticalConstraint(model);

    const axes = getModelHorizontalAxes(model);
    if (!axes) return;

    const moveDirection = axes.forward.scale(speed);
    const currentVelocity = model.physics.getLinearVelocity();

    model.physics.setLinearVelocity(
      new flock.BABYLON.Vector3(
        moveDirection.x,
        currentVelocity.y,
        moveDirection.z,
      ),
    );
  },
  moveSidewaysLocal(modelName, speed) {
    const model = flock.scene.getMeshByName(modelName);
    if (!model || !model.physics || speed === 0) return;

    flock.ensureVerticalConstraint(model);

    const axes = getModelHorizontalAxes(model);
    if (!axes) return;

    const moveDirection = axes.right.scale(speed);
    const currentVelocity = model.physics.getLinearVelocity();

    model.physics.setLinearVelocity(
      new flock.BABYLON.Vector3(
        moveDirection.x,
        currentVelocity.y,
        moveDirection.z,
      ),
    );

    const facingDirection = speed >= 0 ? axes.right : axes.right.scale(-1);
    const targetRotation = flock.BABYLON.Quaternion.FromLookDirectionLH(
      facingDirection,
      flock.BABYLON.Vector3.Up(),
    );
    const currentRotation =
      model.rotationQuaternion || flock.BABYLON.Quaternion.Identity();
    const deltaRotation = targetRotation.multiply(currentRotation.conjugate());
    const deltaEuler = deltaRotation.toEulerAngles();

    model.physics.setAngularVelocity(
      new flock.BABYLON.Vector3(0, deltaEuler.y * 5, 0),
    );

    if (!model.rotationQuaternion) {
      model.rotationQuaternion = flock.BABYLON.Quaternion.RotationYawPitchRoll(
        model.rotation.y,
        model.rotation.x,
        model.rotation.z,
      );
    }
    model.rotationQuaternion.x = 0;
    model.rotationQuaternion.z = 0;
    model.rotationQuaternion.normalize();
  },
  strafeLocal(modelName, speed) {
    const model = flock.scene.getMeshByName(modelName);
    if (!model || !model.physics || speed === 0) return;

    flock.ensureVerticalConstraint(model);

    const axes = getModelHorizontalAxes(model);
    if (!axes) return;

    const moveDirection = axes.right.scale(-speed);
    const currentVelocity = model.physics.getLinearVelocity();

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
