let flock;

export function setFlockReference(ref) {
  flock = ref;
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

    const scene = flock.scene;
    const physicsEngine = scene.getPhysicsEngine();
    if (!physicsEngine) return;
    const havokPlugin = physicsEngine.getPhysicsPlugin();

    const B = flock.BABYLON;
    const up = B.Vector3.UpReadOnly;

    // One-time per-mesh cache of scratch state to keep this hot path alloc-free.
    let cache = model._moveForwardCache;
    if (!cache) {
      const makeQuery = () => ({
        shape: null,
        rotation: new B.Quaternion(0, 0, 0, 1),
        startPosition: new B.Vector3(),
        endPosition: new B.Vector3(),
        shouldHitTriggers: false,
        ignoredBodies: [],
        collisionFilterGroup: -1,
        collisionFilterMask: -1,
      });
      cache = model._moveForwardCache = {
        groundCastResult: new B.ShapeCastResult(),
        groundHitResult: new B.ShapeCastResult(),
        stepLowResult: new B.ShapeCastResult(),
        stepLowHitResult: new B.ShapeCastResult(),
        stepHighResult: new B.ShapeCastResult(),
        stepHighHitResult: new B.ShapeCastResult(),
        groundQuery: makeQuery(),
        stepLowQuery: makeQuery(),
        stepHighQuery: makeQuery(),
        forwardLocal: B.Vector3.Forward(),
        cameraForward: new B.Vector3(),
        horizontalForward: new B.Vector3(),
        desiredHorizontalVelocity: new B.Vector3(),
        currentVelocity: new B.Vector3(),
        currentHorizontalVelocity: new B.Vector3(),
        appliedHorizontalVelocity: new B.Vector3(),
        finalVelocity: new B.Vector3(),
        boostedVelocity: new B.Vector3(),
        facingDirection: new B.Vector3(),
        normalScratch: new B.Vector3(),
        angularVelocity: new B.Vector3(),
        deltaEuler: new B.Vector3(),
        targetRotation: new B.Quaternion(),
        currentRotationConjugate: new B.Quaternion(),
        deltaRotation: new B.Quaternion(),
      };
    }

    const groundShapeKey = `${capsuleHeightBottomOffset}:${capsuleRadius}`;
    if (
      !model._groundQueryShape ||
      model._groundQueryShapeKey !== groundShapeKey
    ) {
      model._groundQueryShape?.dispose();
      model._groundQueryShape = new B.PhysicsShapeCapsule(
        new B.Vector3(0, -capsuleHeightBottomOffset, 0),
        new B.Vector3(0, capsuleHeightBottomOffset, 0),
        capsuleRadius,
        scene,
      );
      model._groundQueryShapeKey = groundShapeKey;
      if (!model._queryShapeCleanupRegistered) {
        model._queryShapeCleanupRegistered = true;
        model.onDisposeObservable.add(() => {
          model._groundQueryShape?.dispose();
          model._groundQueryShape = null;
          model._stepProbeShape?.dispose();
          model._stepProbeShape = null;
        });
      }
    }

    // Camera forward direction (no alloc)
    scene.activeCamera.getDirectionToRef(
      cache.forwardLocal,
      cache.cameraForward,
    );

    const horizontalForward = cache.horizontalForward;
    horizontalForward.set(cache.cameraForward.x, 0, cache.cameraForward.z);
    horizontalForward.normalize();
    horizontalForward.scaleToRef(speed, cache.desiredHorizontalVelocity);

    // --- Grounded check via capsule shapeCast ---
    const groundQuery = cache.groundQuery;
    groundQuery.shape = model._groundQueryShape;
    groundQuery.startPosition.copyFrom(model.position);
    groundQuery.endPosition.copyFrom(model.position);
    groundQuery.endPosition.y -= groundCheckDistance;
    if (model.rotationQuaternion) {
      groundQuery.rotation.copyFrom(model.rotationQuaternion);
    } else {
      groundQuery.rotation.copyFromFloats(0, 0, 0, 1);
    }

    havokPlugin.shapeCast(
      groundQuery,
      cache.groundCastResult,
      cache.groundHitResult,
    );

    let grounded = false;
    if (cache.groundCastResult.hasHit) {
      const n = cache.groundCastResult.hitNormalWorld;
      if (n) {
        cache.normalScratch.copyFrom(n);
        cache.normalScratch.normalize();
        const dot = B.Vector3.Dot(cache.normalScratch, up);
        const clampedDot = Math.min(Math.max(dot, -1), 1);
        const angleDeg = (Math.acos(clampedDot) * 180) / Math.PI;
        grounded = angleDeg <= maxSlopeAngleDeg;
      } else {
        grounded = true;
      }
    }

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
    model.physics.getLinearVelocityToRef(cache.currentVelocity);
    const currentVelocity = cache.currentVelocity;
    cache.currentHorizontalVelocity.set(currentVelocity.x, 0, currentVelocity.z);

    const appliedHorizontalVelocity = cache.appliedHorizontalVelocity;
    if (grounded || withinCoyoteTime) {
      // full control on ground/coyote
      appliedHorizontalVelocity.copyFrom(cache.desiredHorizontalVelocity);
    } else {
      // airborne: no acceleration toward input, apply drag
      cache.currentHorizontalVelocity.scaleToRef(
        airDragPerTick,
        appliedHorizontalVelocity,
      );
      if (airControlFactor > 0) {
        cache.desiredHorizontalVelocity.scaleAndAddToRef(
          airControlFactor,
          appliedHorizontalVelocity,
        );
      }
    }

    // --- Step-up probe to allow ledge hops when near ground ---
    if (grounded || withinCoyoteTime) {
      const stepSphereRadius = capsuleRadius * 0.8;
      if (
        !model._stepProbeShape ||
        model._stepProbeShapeRadius !== stepSphereRadius
      ) {
        model._stepProbeShape?.dispose();
        model._stepProbeShape = new B.PhysicsShapeSphere(
          new B.Vector3(0, 0, 0),
          stepSphereRadius,
          scene,
        );
        model._stepProbeShapeRadius = stepSphereRadius;
      }

      const lowQuery = cache.stepLowQuery;
      lowQuery.shape = model._stepProbeShape;
      lowQuery.startPosition.copyFrom(model.position);
      lowQuery.startPosition.y += 0.05;
      horizontalForward.scaleToRef(stepProbeDistance, lowQuery.endPosition);
      lowQuery.endPosition.addInPlace(lowQuery.startPosition);

      const highQuery = cache.stepHighQuery;
      highQuery.shape = model._stepProbeShape;
      highQuery.startPosition.copyFrom(lowQuery.startPosition);
      highQuery.startPosition.y += stepHeight + 0.1;
      horizontalForward.scaleToRef(stepProbeDistance, highQuery.endPosition);
      highQuery.endPosition.addInPlace(highQuery.startPosition);

      havokPlugin.shapeCast(
        lowQuery,
        cache.stepLowResult,
        cache.stepLowHitResult,
      );

      if (cache.stepLowResult.hasHit) {
        havokPlugin.shapeCast(
          highQuery,
          cache.stepHighResult,
          cache.stepHighHitResult,
        );
        if (!cache.stepHighResult.hasHit) {
          // Only boost if we haven't recently boosted
          const lastStepBoost = model._lastStepBoost || 0;
          if (nowMs - lastStepBoost > 400) {
            model._lastStepBoost = nowMs;

            cache.boostedVelocity.set(
              appliedHorizontalVelocity.x,
              Math.max(currentVelocity.y, 2.5),
              appliedHorizontalVelocity.z,
            );
            model.physics.setLinearVelocity(cache.boostedVelocity);
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

    cache.finalVelocity.set(
      appliedHorizontalVelocity.x,
      clampedVertical,
      appliedHorizontalVelocity.z,
    );
    model.physics.setLinearVelocity(cache.finalVelocity);

    // --- Face movement direction if there is meaningful horizontal speed ---
    const horizontalSpeedSq = appliedHorizontalVelocity.lengthSquared();
    if (horizontalSpeedSq > 1e-6) {
      appliedHorizontalVelocity.normalizeToRef(cache.facingDirection);
      B.Quaternion.FromLookDirectionLHToRef(
        cache.facingDirection,
        up,
        cache.targetRotation,
      );
      if (model.rotationQuaternion) {
        cache.currentRotationConjugate.copyFrom(model.rotationQuaternion);
      } else {
        cache.currentRotationConjugate.copyFromFloats(0, 0, 0, 1);
      }
      cache.currentRotationConjugate.conjugateInPlace();
      cache.targetRotation.multiplyToRef(
        cache.currentRotationConjugate,
        cache.deltaRotation,
      );
      cache.deltaRotation.toEulerAnglesToRef(cache.deltaEuler);
      cache.angularVelocity.set(0, cache.deltaEuler.y * 5, 0);
      model.physics.setAngularVelocity(cache.angularVelocity);
    }

    if (!model.rotationQuaternion) {
      model.rotationQuaternion = B.Quaternion.RotationYawPitchRoll(
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
    if (!model || speed === 0) return;

    flock.ensureVerticalConstraint(model);

    const B = flock.BABYLON;
    const up = B.Vector3.UpReadOnly;
    const sidewaysSpeed = speed;

    let cache = model._moveSidewaysCache;
    if (!cache) {
      cache = model._moveSidewaysCache = {
        rightLocal: B.Vector3.Right(),
        cameraRight: new B.Vector3(),
        currentVelocity: new B.Vector3(),
        finalVelocity: new B.Vector3(),
        facingDirection: new B.Vector3(),
        angularVelocity: new B.Vector3(),
        deltaEuler: new B.Vector3(),
        targetRotation: new B.Quaternion(),
        currentRotationConjugate: new B.Quaternion(),
        deltaRotation: new B.Quaternion(),
      };
    }

    flock.scene.activeCamera.getDirectionToRef(
      cache.rightLocal,
      cache.cameraRight,
    );
    cache.cameraRight.normalize();

    model.physics.getLinearVelocityToRef(cache.currentVelocity);

    cache.finalVelocity.set(
      cache.cameraRight.x * sidewaysSpeed,
      cache.currentVelocity.y, // Keep Y velocity (no vertical movement)
      cache.cameraRight.z * sidewaysSpeed,
    );
    model.physics.setLinearVelocity(cache.finalVelocity);

    // Rotate the model to face the direction of movement
    const sign = sidewaysSpeed <= 0 ? -1 : 1;
    cache.facingDirection.set(
      cache.cameraRight.x * sign,
      0,
      cache.cameraRight.z * sign,
    );
    cache.facingDirection.normalize();

    B.Quaternion.FromLookDirectionLHToRef(
      cache.facingDirection,
      up,
      cache.targetRotation,
    );

    cache.currentRotationConjugate.copyFrom(model.rotationQuaternion);
    cache.currentRotationConjugate.conjugateInPlace();
    cache.targetRotation.multiplyToRef(
      cache.currentRotationConjugate,
      cache.deltaRotation,
    );
    cache.deltaRotation.toEulerAnglesToRef(cache.deltaEuler);

    cache.angularVelocity.set(0, cache.deltaEuler.y * 5, 0);
    model.physics.setAngularVelocity(cache.angularVelocity);

    // Normalize the model's rotation to avoid drift
    model.rotationQuaternion.x = 0;
    model.rotationQuaternion.z = 0;
    model.rotationQuaternion.normalize();
  },
  strafe(modelName, speed) {
    const model = flock.scene.getMeshByName(modelName);
    if (!model || speed === 0) return;

    const B = flock.BABYLON;
    const up = B.Vector3.UpReadOnly;
    const sidewaysSpeed = -speed;

    let cache = model._strafeCache;
    if (!cache) {
      cache = model._strafeCache = {
        forwardLocal: B.Vector3.Forward(),
        cameraForward: new B.Vector3(),
        cameraRight: new B.Vector3(),
        currentVelocity: new B.Vector3(),
        finalVelocity: new B.Vector3(),
      };
    }

    // cameraRight = normalize(cameraForward × up)
    flock.scene.activeCamera.getDirectionToRef(
      cache.forwardLocal,
      cache.cameraForward,
    );
    B.Vector3.CrossToRef(cache.cameraForward, up, cache.cameraRight);
    cache.cameraRight.normalize();

    model.physics.getLinearVelocityToRef(cache.currentVelocity);

    cache.finalVelocity.set(
      cache.cameraRight.x * sidewaysSpeed,
      cache.currentVelocity.y,
      cache.cameraRight.z * sidewaysSpeed,
    );
    model.physics.setLinearVelocity(cache.finalVelocity);
  },
  updateDynamicMeshPositions(scene, dynamicMeshes) {
    dynamicMeshes.forEach((mesh) => {
      mesh.physics.setCollisionCallbackEnabled(true);
      const observable = mesh.physics.getCollisionObservable();
      observable.add((collisionEvent) => {
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