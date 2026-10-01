let flock;

export function setFlockReference(ref) {
  flock = ref;
}

function ensureDynamicForMovement(mesh) {
  if (!mesh) return null;
  if (mesh.metadata?.physicsType !== 'DYNAMIC') {
    flock.setPhysicsForMesh(mesh, 'DYNAMIC');
  }
}

// --- Shared movement/jump tuning ---------------------------------------------
// These are shared by the grounded-movement core, the ground check and the
// jump so behaviour is consistent. Kept module-scoped so they are defined once.
const MAX_SLOPE_ANGLE_DEG = 75; // steeper than this counts as a wall, not ground
const GROUND_CHECK_DISTANCE = 0.3; // downward capsule probe length
const COYOTE_TIME_MS = 120; // grace window to still count as grounded after a ledge
const MAX_VERTICAL_VELOCITY = 3.0; // clamp for normal movement (anti ramp-launch)
const MAX_FALL_VELOCITY = 25.0;
const STEP_HEIGHT = 0.55;
// Below this, the camera's forward is too near vertical for its horizontal part to be a heading
const MIN_HORIZONTAL_FORWARD_SQ = 0.05;
const STEP_PROBE_RADIUS = 0.08;
const STEP_PROBE_REACH = 0.15;
const STEP_PROBE_CLEARANCE = 0.05;
const STEP_COOLDOWN_MS = 100;
const DEFAULT_GRAVITY = 9.81;

// Airborne horizontal handling. Both are expressed per-second and converted to
// the current frame's dt so they behave identically on slow and fast devices.
//   AIR_DRAG_PER_SECOND: fraction of horizontal speed retained after one second
//     of airtime (closer to 1 = more momentum preserved). 0.8 keeps most run
//     speed through a normal jump arc, giving the familiar platformer carry.
//   AIR_CONTROL_RATE: exponential approach rate (per second) toward the input
//     direction while a direction is held — lets the player nudge the arc
//     without erasing momentum. Only applied when there is input.
const AIR_DRAG_PER_SECOND = 0.8;
const AIR_CONTROL_RATE = 6.0;
const CHARACTER_GRAVITY_FACTOR = 3.0;

// Read the scene's gravity magnitude (falls back to 9.81 for headless tests).
function sceneGravityMagnitude() {
  const g = flock.scene?.getPhysicsEngine?.()?.gravity?.y;
  return typeof g === 'number' && g !== 0 ? Math.abs(g) : DEFAULT_GRAVITY;
}

function nowMs() {
  return typeof performance !== 'undefined' && performance.now ? performance.now() : Date.now();
}

function ensureCharacterBody(model) {
  const body = model.physics;
  if (model._characterSetupBody === body && model._characterSetupShape === body.shape) return;
  body.setGravityFactor?.(CHARACTER_GRAVITY_FACTOR);
  if (body.shape) {
    body.shape.material = {
      ...body.shape.material,
      friction: 0,
      staticFriction: 0,
      frictionCombine: flock.BABYLON.PhysicsMaterialCombineMode.MINIMUM,
    };
  }
  model._characterSetupBody = body;
  model._characterSetupShape = body.shape;
}

export const flockMovement = {
  // Lazily build the per-mesh movement scratch cache (query descriptors,
  // shapecast result buffers and reusable vectors). Allocates once per mesh so
  // the movement/jump hot paths stay allocation-free. Shared by
  // applyGroundedMovement, checkGrounded and jump.
  ensureMovementCache(model) {
    let c = model._moveForwardCache;
    if (c) return c;
    const B = flock.BABYLON;
    const makeQuery = () => ({
      shape: null,
      rotation: new B.Quaternion(0, 0, 0, 1),
      startPosition: new B.Vector3(),
      endPosition: new B.Vector3(),
      shouldHitTriggers: false,
      ignoreBody: null,
      collisionFilterGroup: -1,
      collisionFilterMask: -1,
    });
    c = model._moveForwardCache = {
      groundCastResult: new B.ShapeCastResult(),
      groundHitResult: new B.ShapeCastResult(),
      stepLowResult: new B.ShapeCastResult(),
      stepLowHitResult: new B.ShapeCastResult(),
      stepHighResult: new B.ShapeCastResult(),
      stepHighHitResult: new B.ShapeCastResult(),
      stepDownResult: new B.ShapeCastResult(),
      stepDownHitResult: new B.ShapeCastResult(),
      groundQuery: makeQuery(),
      stepLowQuery: makeQuery(),
      stepHighQuery: makeQuery(),
      stepDownQuery: makeQuery(),
      horizontalForward: new B.Vector3(),
      desiredHorizontalVelocity: new B.Vector3(),
      currentVelocity: new B.Vector3(),
      currentHorizontalVelocity: new B.Vector3(),
      appliedHorizontalVelocity: new B.Vector3(),
      finalVelocity: new B.Vector3(),
      boostedVelocity: new B.Vector3(),
      normalScratch: new B.Vector3(),
      airSteerScratch: new B.Vector3(),
    };
    if (!model._queryShapeCleanupRegistered) {
      model._queryShapeCleanupRegistered = true;
      model.onDisposeObservable.add(() => {
        model._groundQueryShape?.dispose();
        model._groundQueryShape = null;
        model._stepProbeShape?.dispose();
        model._stepProbeShape = null;
      });
    }
    return c;
  },

  // Capsule shapeCast straight down to decide if the mesh is standing on ground
  // within the slope tolerance. Refreshes model._lastGroundedAt (for coyote
  // time) and maintains the airborne latch used by jump: model._wasAirborne is
  // set the moment the mesh leaves the ground and, on the airborne→grounded
  // landing transition, jump budget/clamp exemption are reset. Returns boolean.
  checkGrounded(model) {
    if (!model?.physics || !model.metadata?.physicsCapsule) return false;
    const B = flock.BABYLON;
    const scene = flock.scene;
    const physicsEngine = scene?.getPhysicsEngine?.();
    if (!physicsEngine) return false;
    const havokPlugin = physicsEngine.getPhysicsPlugin();

    const cap = flock.ensurePhysicsCapsule(model);
    const capsuleRadius = cap.radius * 0.9;
    const capsuleHeightBottomOffset = Math.max(0.001, cap.height * 0.5 - capsuleRadius);
    const c = flock.ensureMovementCache(model);

    // Ground query shape — cached, recreated only when dimensions change.
    const groundShapeKey = `${capsuleHeightBottomOffset}_${capsuleRadius}`;
    if (!model._groundQueryShape || model._groundQueryShapeKey !== groundShapeKey) {
      model._groundQueryShape?.dispose();
      const lc = cap.localCenter || B.Vector3.Zero();
      model._groundQueryShape = new B.PhysicsShapeCapsule(
        new B.Vector3(lc.x, lc.y - capsuleHeightBottomOffset, lc.z),
        new B.Vector3(lc.x, lc.y + capsuleHeightBottomOffset, lc.z),
        capsuleRadius,
        scene
      );
      model._groundQueryShapeKey = groundShapeKey;
    }

    const gq = c.groundQuery;
    gq.shape = model._groundQueryShape;
    gq.ignoreBody = model.physics;
    gq.startPosition.copyFrom(model.position);
    gq.endPosition.copyFrom(model.position);
    gq.endPosition.y -= GROUND_CHECK_DISTANCE;
    if (model.rotationQuaternion) {
      gq.rotation.copyFrom(model.rotationQuaternion);
    } else {
      gq.rotation.copyFromFloats(0, 0, 0, 1);
    }

    havokPlugin.shapeCast(gq, c.groundCastResult, c.groundHitResult);

    let grounded = false;
    if (c.groundCastResult.hasHit) {
      const n = c.groundHitResult.hitNormal;
      if (n) {
        c.normalScratch.copyFrom(n);
        c.normalScratch.normalize();
        const dot = B.Vector3.Dot(c.normalScratch, B.Vector3.UpReadOnly);
        const clampedDot = Math.min(Math.max(dot, -1), 1);
        const angleDeg = (Math.acos(clampedDot) * 180) / Math.PI;
        grounded = angleDeg <= MAX_SLOPE_ANGLE_DEG;
      } else {
        grounded = true;
      }
    }

    if (grounded) {
      model._lastGroundedAt = nowMs();
      // Clear the jump clamp exemption once the character has *settled* on the
      // ground — i.e. it is not still rising from a fresh jump. During the
      // takeoff frames the capsule is still within GROUND_CHECK_DISTANCE but the
      // velocity is rising, so this correctly waits until it has landed.
      model.physics.getLinearVelocityToRef(c.currentVelocity);
      if (c.currentVelocity.y <= 0.1) {
        model._jumpUntilGrounded = false;
      }
    }

    return grounded;
  },

  // Shared character-movement core. Given a desired *world-space horizontal*
  // velocity, applies ground-aware movement (capsule ground check, coyote time,
  // step-up over ledges, vertical clamp) and sets the body's velocity. Used by
  // moveForward (camera-relative) and setSpeed (object/world-relative) so both
  // move identically. Returns true if a step-up boost was applied (caller should
  // do no further work this frame). Requires model.metadata.physicsCapsule.
  applyGroundedMovement(model, desiredHorizontalVelocity) {
    if (!model?.physics || !model.metadata?.physicsCapsule) return false;
    const cap = flock.ensurePhysicsCapsule(model);
    const capsuleRadius = cap.radius;

    const B = flock.BABYLON;
    const scene = flock.scene;
    const physicsEngine = scene.getPhysicsEngine();
    if (!physicsEngine) return false;
    const havokPlugin = physicsEngine.getPhysicsPlugin();

    const c = flock.ensureMovementCache(model);
    ensureCharacterBody(model);

    // Desired horizontal velocity comes from the caller; derive the normalised
    // forward direction (for the step probe) from it.
    c.desiredHorizontalVelocity.copyFrom(desiredHorizontalVelocity);
    c.desiredHorizontalVelocity.y = 0;
    c.horizontalForward.copyFrom(c.desiredHorizontalVelocity);
    const hLen = c.horizontalForward.length();
    if (hLen > 1e-6) c.horizontalForward.scaleInPlace(1 / hLen);
    else c.horizontalForward.set(0, 0, 0);

    // --- Grounded check + coyote time (shared with jump) ---
    const grounded = flock.checkGrounded(model);
    const now = nowMs();
    const withinCoyoteTime = model._lastGroundedAt
      ? now - model._lastGroundedAt <= COYOTE_TIME_MS
      : false;

    // --- Horizontal control policy ---
    const prev = model._lastMoveForwardMs !== undefined ? model._lastMoveForwardMs : now;
    model._lastMoveForwardMs = now;

    model.physics.getLinearVelocityToRef(c.currentVelocity);
    const cv = c.currentVelocity;
    c.currentHorizontalVelocity.set(cv.x, 0, cv.z);

    const ahv = c.appliedHorizontalVelocity;
    if (grounded || withinCoyoteTime) {
      ahv.copyFrom(c.desiredHorizontalVelocity);
    } else {
      // Airborne: preserve momentum (dt-normalised drag) and allow limited air
      // control toward held input (dt-normalised exponential approach), so the
      // feel is identical on slow and fast devices.
      const rawDt = (now - prev) / 1000;
      const dtSeconds = Math.min(Math.max(rawDt, 1 / 240), 1 / 15);
      const dragFactor = Math.pow(AIR_DRAG_PER_SECOND, dtSeconds);
      c.currentHorizontalVelocity.scaleToRef(dragFactor, ahv);
      if (AIR_CONTROL_RATE > 0 && c.desiredHorizontalVelocity.lengthSquared() > 1e-6) {
        const blend = 1 - Math.exp(-AIR_CONTROL_RATE * dtSeconds);
        // ahv += (desired - ahv) * blend
        c.desiredHorizontalVelocity.subtractToRef(ahv, c.airSteerScratch);
        c.airSteerScratch.scaleInPlace(blend);
        ahv.addInPlace(c.airSteerScratch);
      }
    }

    // --- Step-up probe to allow ledge hops when near ground ---
    const rising = model._jumpUntilGrounded && cv.y > 0.1;
    if (
      (grounded || withinCoyoteTime) &&
      !rising &&
      hLen > 1e-6 &&
      now - (model._lastStepBoost || 0) > STEP_COOLDOWN_MS
    ) {
      const probeRadius = Math.min(STEP_PROBE_RADIUS, capsuleRadius * 0.5);
      if (!model._stepProbeShape || model._stepProbeShapeRadius !== probeRadius) {
        model._stepProbeShape?.dispose();
        model._stepProbeShape = new B.PhysicsShapeSphere(
          new B.Vector3(0, 0, 0),
          probeRadius,
          scene
        );
        model._stepProbeShapeRadius = probeRadius;
      }

      const lc = cap.localCenter || B.Vector3.ZeroReadOnly;
      const feetY = model.position.y + lc.y - cap.height / 2;
      const stepHeight = Math.min(STEP_HEIGHT, cap.height * 0.25);
      const reach = capsuleRadius + STEP_PROBE_REACH;

      const lq = c.stepLowQuery;
      lq.shape = model._stepProbeShape;
      lq.ignoreBody = model.physics;
      lq.startPosition.set(
        model.position.x,
        feetY + probeRadius + STEP_PROBE_CLEARANCE,
        model.position.z
      );
      c.horizontalForward.scaleToRef(reach, lq.endPosition);
      lq.endPosition.addInPlace(lq.startPosition);
      havokPlugin.shapeCast(lq, c.stepLowResult, c.stepLowHitResult);

      const riserNormal = c.stepLowResult.hasHit ? c.stepLowHitResult.hitNormal : null;
      if (
        riserNormal &&
        Math.abs(riserNormal.y) < 0.5 &&
        B.Vector3.Dot(riserNormal, c.horizontalForward) < 0
      ) {
        const hq = c.stepHighQuery;
        hq.shape = model._stepProbeShape;
        hq.ignoreBody = model.physics;
        hq.startPosition.set(model.position.x, feetY + stepHeight + probeRadius, model.position.z);
        c.horizontalForward.scaleToRef(reach, hq.endPosition);
        hq.endPosition.addInPlace(hq.startPosition);
        havokPlugin.shapeCast(hq, c.stepHighResult, c.stepHighHitResult);

        if (!c.stepHighResult.hasHit) {
          const dq = c.stepDownQuery;
          dq.shape = model._stepProbeShape;
          dq.ignoreBody = model.physics;
          dq.startPosition.copyFrom(hq.endPosition);
          dq.endPosition.copyFrom(hq.endPosition);
          dq.endPosition.y = feetY + probeRadius;
          havokPlugin.shapeCast(dq, c.stepDownResult, c.stepDownHitResult);

          if (c.stepDownResult.hasHit) {
            const stepTopY =
              dq.startPosition.y +
              (dq.endPosition.y - dq.startPosition.y) * c.stepDownResult.hitFraction -
              probeRadius;
            const rise = stepTopY - feetY + STEP_PROBE_CLEARANCE;
            if (rise > STEP_PROBE_CLEARANCE) {
              const stepVelocity = Math.sqrt(
                2 * sceneGravityMagnitude() * CHARACTER_GRAVITY_FACTOR * rise
              );
              model._lastStepBoost = now;
              model._jumpUntilGrounded = true;
              model._jumpStartMs = now;
              model._jumpTakeoffVelocity = stepVelocity;
              c.boostedVelocity.set(ahv.x, Math.max(cv.y, stepVelocity), ahv.z);
              model.physics.setLinearVelocity(c.boostedVelocity);
              model.isGrounded = grounded;
              return true;
            }
          }
        }
      }
    }

    // --- Vertical: let gravity act; clamp extremes to stop ramp-launching,
    // except while a deliberate jump is in progress (see jump()), so the jump's
    // takeoff velocity survives this per-frame reset until the mesh lands. ---
    let clampedVertical;
    if (model._jumpUntilGrounded) {
      const jumpElapsed = (now - (model._jumpStartMs ?? now)) / 1000;
      const ballisticVertical =
        (model._jumpTakeoffVelocity ?? 0) -
        sceneGravityMagnitude() * CHARACTER_GRAVITY_FACTOR * jumpElapsed;
      clampedVertical = Math.max(
        Math.min(cv.y, Math.max(ballisticVertical, MAX_VERTICAL_VELOCITY)),
        -MAX_FALL_VELOCITY
      );
    } else {
      clampedVertical = Math.min(Math.max(cv.y, -MAX_FALL_VELOCITY), MAX_VERTICAL_VELOCITY);
    }
    c.finalVelocity.set(ahv.x, clampedVertical, ahv.z);
    model.physics.setLinearVelocity(c.finalVelocity);

    model.isGrounded = grounded;
    return false;
  },

  // Make a character jump — a direct replacement for a vertical force impulse,
  // but height-based and momentum-preserving. Sets the upward takeoff velocity
  // from a target height (v = sqrt(2*g*h)) so the height is predictable and
  // mass-independent, and leaves the horizontal velocity untouched so any run
  // speed carries into the arc (momentum). Whether/when a character may jump
  // (grounded checks, one-per-press, etc.) is left to the caller's own logic,
  // exactly as it was with the force block.
  jump(modelName, { jumpHeight = 1.5 } = {}) {
    const model = flock.scene.getMeshByName(modelName);
    if (!model) return;
    ensureDynamicForMovement(model);
    if (!model.physics) return;
    flock.ensureVerticalConstraint(model);

    const B = flock.BABYLON;
    ensureCharacterBody(model);
    const g = sceneGravityMagnitude() * CHARACTER_GRAVITY_FACTOR;
    const vJump = Math.sqrt(2 * g * Math.max(0, jumpHeight));

    const v = (model._jumpVelScratch ??= new B.Vector3());
    model.physics.getLinearVelocityToRef(v);
    v.y = vJump; // preserve x/z (momentum)
    model.physics.setLinearVelocity(v);

    model._jumpUntilGrounded = true; // survive the movement vertical clamp until landing
    model._jumpStartMs = nowMs();
    model._jumpTakeoffVelocity = vJump;
    model.isGrounded = false;
  },
  moveForward(modelName, speed) {
    if (speed === 0) return;
    const model = flock.scene.getMeshByName(modelName);
    if (!model) return;
    ensureDynamicForMovement(model);
    if (!model.physics) return;
    flock.ensureVerticalConstraint(model);

    // Only drive designated capsule characters.
    if (!model.metadata?.physicsCapsule) return;

    const B = flock.BABYLON;
    const scene = flock.scene;
    if (!scene.activeCamera) return;

    // Camera forward → desired world horizontal velocity (reused scratch).
    model._mfForwardLocal ??= B.Vector3.Forward();
    model._mfCameraForward ??= new B.Vector3();
    model._mfDesiredHorizontal ??= new B.Vector3();
    scene.activeCamera.getDirectionToRef(model._mfForwardLocal, model._mfCameraForward);
    const forward = model._mfCameraForward;
    if (forward.x * forward.x + forward.z * forward.z > MIN_HORIZONTAL_FORWARD_SQ) {
      model._mfDesiredHorizontal.set(forward.x, 0, forward.z);
    } else {
      // Aimed steeply down, forward is almost vertical. Right stays level, and forward is square
      // to it, so a phone held over a diorama still steers where it is pointing.
      model._mfRightLocal ??= B.Vector3.Right();
      model._mfCameraRight ??= new B.Vector3();
      scene.activeCamera.getDirectionToRef(model._mfRightLocal, model._mfCameraRight);
      model._mfDesiredHorizontal.set(-model._mfCameraRight.z, 0, model._mfCameraRight.x);
    }
    model._mfDesiredHorizontal.normalize();
    model._mfDesiredHorizontal.scaleInPlace(speed);

    const boosted = flock.applyGroundedMovement(model, model._mfDesiredHorizontal);
    if (boosted) return;

    const c = model._moveForwardCache;
    if (!c) return; // applyGroundedMovement exited early (e.g. no physics engine)
    const ahv = c.appliedHorizontalVelocity;

    // --- Face movement direction if there is meaningful horizontal speed ---
    model._mfFacing ??= new B.Vector3();
    model._mfTargetRotation ??= new B.Quaternion();
    model._mfConjugate ??= new B.Quaternion();
    model._mfDeltaRotation ??= new B.Quaternion();
    model._mfDeltaEuler ??= new B.Vector3();
    model._mfAngularVelocity ??= new B.Vector3();
    if (ahv.lengthSquared() > 1e-6) {
      ahv.normalizeToRef(model._mfFacing);
      B.Quaternion.FromLookDirectionLHToRef(
        model._mfFacing,
        B.Vector3.UpReadOnly,
        model._mfTargetRotation
      );
      if (model.rotationQuaternion) {
        model._mfConjugate.copyFrom(model.rotationQuaternion);
      } else {
        model._mfConjugate.copyFromFloats(0, 0, 0, 1);
      }
      model._mfConjugate.conjugateInPlace();
      model._mfTargetRotation.multiplyToRef(model._mfConjugate, model._mfDeltaRotation);
      model._mfDeltaRotation.toEulerAnglesToRef(model._mfDeltaEuler);
      model._mfAngularVelocity.set(0, model._mfDeltaEuler.y * 5, 0);
      model.physics.setAngularVelocity(model._mfAngularVelocity);
    }

    if (!model.rotationQuaternion) {
      model.rotationQuaternion = B.Quaternion.RotationYawPitchRoll(
        model.rotation.y,
        model.rotation.x,
        model.rotation.z
      );
    }
    model.rotationQuaternion.x = 0;
    model.rotationQuaternion.z = 0;
    model.rotationQuaternion.normalize();
  },
  moveSideways(modelName, speed) {
    if (speed === 0) return;
    const model = flock.scene.getMeshByName(modelName);
    if (!model) return;
    ensureDynamicForMovement(model);
    if (!model.physics) return;

    flock.ensureVerticalConstraint(model);

    const B = flock.BABYLON;

    let c = model._moveSidewaysCache;
    if (!c) {
      c = model._moveSidewaysCache = {
        rightLocal: B.Vector3.Right(),
        cameraRight: new B.Vector3(),
        moveDirection: new B.Vector3(),
        currentVelocity: new B.Vector3(),
        finalVelocity: new B.Vector3(),
        facingDirection: new B.Vector3(),
        targetRotation: new B.Quaternion(),
        currentRotationConjugate: new B.Quaternion(),
        deltaRotation: new B.Quaternion(),
        deltaEuler: new B.Vector3(),
        angularVelocity: new B.Vector3(),
      };
      model.onDisposeObservable.addOnce(() => {
        model._moveSidewaysCache = null;
      });
    }

    // Camera right direction — no alloc
    flock.scene.activeCamera.getDirectionToRef(c.rightLocal, c.cameraRight);
    c.cameraRight.normalize();
    c.cameraRight.scaleToRef(speed, c.moveDirection);

    // Capsule characters go through the air-aware core so momentum is preserved
    // in the air (matching moveForward); other dynamic meshes keep the direct
    // horizontal drive.
    if (model.metadata?.physicsCapsule) {
      if (flock.applyGroundedMovement(model, c.moveDirection)) return;
    } else {
      model.physics.getLinearVelocityToRef(c.currentVelocity);
      c.finalVelocity.set(c.moveDirection.x, c.currentVelocity.y, c.moveDirection.z);
      model.physics.setLinearVelocity(c.finalVelocity);
    }

    // Face the direction of travel: positive speed = right, negative speed = left
    const sign = speed > 0 ? 1 : -1;
    c.facingDirection.set(sign * c.cameraRight.x, 0, sign * c.cameraRight.z);
    c.facingDirection.normalize();

    B.Quaternion.FromLookDirectionLHToRef(
      c.facingDirection,
      B.Vector3.UpReadOnly,
      c.targetRotation
    );

    if (model.rotationQuaternion) {
      c.currentRotationConjugate.copyFrom(model.rotationQuaternion);
    } else {
      c.currentRotationConjugate.copyFromFloats(0, 0, 0, 1);
    }
    c.currentRotationConjugate.conjugateInPlace();
    c.targetRotation.multiplyToRef(c.currentRotationConjugate, c.deltaRotation);
    c.deltaRotation.toEulerAnglesToRef(c.deltaEuler);
    c.angularVelocity.set(0, c.deltaEuler.y * 5, 0);
    model.physics.setAngularVelocity(c.angularVelocity);

    // Prevent pitch/roll drift
    if (model.rotationQuaternion) {
      model.rotationQuaternion.x = 0;
      model.rotationQuaternion.z = 0;
      model.rotationQuaternion.normalize();
    }
  },
  strafe(modelName, speed) {
    if (speed === 0) return;
    const model = flock.scene.getMeshByName(modelName);
    if (!model) return;
    ensureDynamicForMovement(model);
    if (!model.physics) return;

    flock.ensureVerticalConstraint(model);

    const B = flock.BABYLON;

    let c = model._strafeCache;
    if (!c) {
      c = model._strafeCache = {
        rightLocal: B.Vector3.Right(),
        cameraRight: new B.Vector3(),
        moveDirection: new B.Vector3(),
        currentVelocity: new B.Vector3(),
        finalVelocity: new B.Vector3(),
      };
      model.onDisposeObservable.addOnce(() => {
        model._strafeCache = null;
      });
    }

    // Camera right direction — same approach as moveSideways, no alloc
    flock.scene.activeCamera.getDirectionToRef(c.rightLocal, c.cameraRight);
    c.cameraRight.normalize();
    c.cameraRight.scaleToRef(speed, c.moveDirection);

    // Capsule characters use the air-aware core (momentum preserved airborne);
    // other dynamic meshes keep the direct horizontal drive.
    if (model.metadata?.physicsCapsule) {
      if (flock.applyGroundedMovement(model, c.moveDirection)) return;
    } else {
      model.physics.getLinearVelocityToRef(c.currentVelocity);
      c.finalVelocity.set(c.moveDirection.x, c.currentVelocity.y, c.moveDirection.z);
      model.physics.setLinearVelocity(c.finalVelocity);
    }
  },
};
