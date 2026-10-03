let flock;

export const isBodyAlive = (body) => !!body?._pluginData?.hpBodyId;

const activeDrives = new WeakMap();

const isPhysicsEnabled = (mesh) =>
  isBodyAlive(mesh?.physics) && mesh.metadata?.physicsType !== 'NONE';

const applyDrivenState = (body) => {
  body.disablePreStep = false;
  body.setPrestepType(flock.BABYLON.PhysicsPrestepType.ACTION);
  body.setMotionType(flock.BABYLON.PhysicsMotionType.ANIMATED);
};

const teleportOne = (mesh) => {
  if (!isPhysicsEnabled(mesh)) return;
  const body = mesh.physics;
  mesh.computeWorldMatrix(true);
  const prestepType = body.getPrestepType();
  body.setPrestepType(flock.BABYLON.PhysicsPrestepType.TELEPORT);
  flock.hk.setPhysicsBodyTransformation(body, mesh);
  body.setPrestepType(prestepType);
};

const driveOne = (mesh) => {
  let drive = activeDrives.get(mesh);
  if (!drive) {
    const body = mesh.physics;
    drive = {
      count: 0,
      motionType: body.getMotionType(),
      disablePreStep: body.disablePreStep,
      prestepType: body.getPrestepType(),
      teleportQueued: false,
      observer: flock.scene.onAfterAnimationsObservable.add(() => mesh.computeWorldMatrix(true)),
    };
    activeDrives.set(mesh, drive);
    applyDrivenState(body);
  }
  drive.count += 1;

  let released = false;
  return {
    teleport() {
      if (released || drive.teleportQueued) return;
      drive.teleportQueued = true;
      flock.scene.onBeforePhysicsObservable.addOnce(() => {
        drive.teleportQueued = false;
        if (released || !isBodyAlive(mesh.physics)) return;
        mesh.physics.setLinearVelocity(flock.BABYLON.Vector3.Zero());
        mesh.physics.setAngularVelocity(flock.BABYLON.Vector3.Zero());
        teleportOne(mesh);
      });
    },
    release() {
      if (released) return;
      released = true;
      drive.count -= 1;
      if (drive.count > 0) return;
      activeDrives.delete(mesh);
      flock.scene.onAfterAnimationsObservable.remove(drive.observer);
      const body = mesh.physics;
      if (!isBodyAlive(body)) return;
      body.setMotionType(drive.motionType);
      body.setPrestepType(drive.prestepType);
      body.disablePreStep = drive.disablePreStep;
      body.setLinearVelocity(flock.BABYLON.Vector3.Zero());
      body.setAngularVelocity(flock.BABYLON.Vector3.Zero());
      teleportOne(mesh);
    },
  };
};

// A body cloned mid-drive would keep the drive's temporary ANIMATED state for
// good, which pins the clone in place; give it the source's resting state.
export const restoreRestingState = (sourceMesh, body) => {
  const drive = activeDrives.get(sourceMesh);
  if (!drive || !isBodyAlive(body)) return;
  body.setMotionType(drive.motionType);
  body.setPrestepType(drive.prestepType);
  body.disablePreStep = drive.disablePreStep;
};

const adoptPhysicsChangeDuringDrive = (mesh) => {
  const drive = activeDrives.get(mesh);
  const body = mesh.physics;
  if (!drive || !isBodyAlive(body)) return;
  drive.motionType = body.getMotionType();
  drive.disablePreStep = body.disablePreStep;
  drive.prestepType = body.getPrestepType();
  applyDrivenState(body);
};

const redriveRebuiltBody = (mesh) => {
  const body = mesh.physics;
  if (!activeDrives.has(mesh) || !isBodyAlive(body)) return;
  applyDrivenState(body);
};

const withPhysicsDescendants = (mesh) =>
  mesh ? [mesh, ...mesh.getChildMeshes(false)].filter(isPhysicsEnabled) : [];

export const teleportBodyToMesh = (mesh) => {
  withPhysicsDescendants(mesh).forEach(teleportOne);
};

// Meshes under an active drive, so a child parented mid-motion can join it.
const activeDriveRoots = new Map();

export const driveBody = (mesh) => {
  const drives = withPhysicsDescendants(mesh).map(driveOne);
  const controller = {
    teleport() {
      drives.forEach((drive) => drive.teleport());
    },
    release() {
      drives.forEach((drive) => drive.release());
      const controllers = activeDriveRoots.get(mesh);
      controllers?.delete(controller);
      if (!controllers?.size) activeDriveRoots.delete(mesh);
    },
    adopt(child) {
      withPhysicsDescendants(child).forEach((childMesh) => {
        const drive = driveOne(childMesh);
        drives.push(drive);
        drive.teleport();
      });
    },
  };
  if (!activeDriveRoots.has(mesh)) activeDriveRoots.set(mesh, new Set());
  activeDriveRoots.get(mesh).add(controller);
  return controller;
};

// Without this, a child parented under a gliding group keeps a static body
// where it was attached while its mesh travels on with the group.
export const joinActiveDrives = (child) => {
  for (let node = child?.parent; node; node = node.parent) {
    activeDriveRoots.get(node)?.forEach((controller) => controller.adopt(child));
  }
};

// Restitution lives on the shape material, not mass properties. Reads
// metadata.bounciness (default 0), so it survives shape/body rebuilds. Combine
// is MAXIMUM (bounciest surface wins) and must match on every material — objects
// and grounds — or a zeroing combine lets a ground at 0 cancel a bouncy object.
// Call after the body's shape is assigned.
export const applyBounciness = (physicsBody, mesh) => {
  if (!physicsBody?.shape) return;
  const restitution = mesh?.metadata?.bounciness ?? 0;
  physicsBody.shape.material = {
    ...physicsBody.shape.material,
    restitution,
    restitutionCombine: flock.BABYLON.PhysicsMaterialCombineMode.MAXIMUM,
  };
};

// Returns the mesh's normalised local basis vectors in world space, so velocity
// magnitudes stay correct regardless of mesh scale.
const localBasis = (mesh) => {
  mesh.computeWorldMatrix(true);
  const m = mesh.getWorldMatrix();
  const right = flock.BABYLON.Vector3.TransformNormal(
    new flock.BABYLON.Vector3(1, 0, 0),
    m
  ).normalize();
  const up = flock.BABYLON.Vector3.TransformNormal(
    new flock.BABYLON.Vector3(0, 1, 0),
    m
  ).normalize();
  const forward = flock.BABYLON.Vector3.TransformNormal(
    new flock.BABYLON.Vector3(0, 0, 1),
    m
  ).normalize();
  return { right, up, forward };
};

// Keep a driven object upright, like the move-forward character controller:
// no tipping or spinning, but still free to yaw (e.g. steered with 'look at').
const keepUpright = (mesh) => {
  if (!isBodyAlive(mesh.physics)) return;
  mesh.physics.setAngularVelocity(new flock.BABYLON.Vector3(0, 0, 0));
  const q = mesh.rotationQuaternion;
  if (q) {
    q.x = 0; // no pitch
    q.z = 0; // no roll
    q.normalize();
  }
};

// Re-assert the maintained speed (mesh.metadata.velocityDrive) each step. The
// horizontal directions (forward/sideways relative to the object, x/z world) go
// through move-forward's shared ground-aware engine, so a driven object moves
// exactly like a player — riding slopes, hopping small steps, not launching off
// ramps. The vertical (up / y) is a direct lift on top. Object stays upright.
const applyVelocityDrive = (mesh) => {
  const drive = mesh.metadata?.velocityDrive;
  if (!drive || !isBodyAlive(mesh.physics)) return;
  const B = flock.BABYLON;

  const hasHorizontal =
    drive.forward !== undefined ||
    drive.sideways !== undefined ||
    drive.x !== undefined ||
    drive.z !== undefined;

  if (hasHorizontal) {
    const desired = (mesh._setSpeedDesiredH ??= new B.Vector3());
    desired.set(0, 0, 0);
    if (drive.forward !== undefined || drive.sideways !== undefined) {
      const { right, forward } = localBasis(mesh);
      if (drive.forward !== undefined) {
        // flock "forward" = -localForward, projected onto the horizontal plane.
        const fx = -forward.x;
        const fz = -forward.z;
        const l = Math.hypot(fx, fz) || 1;
        desired.x += (fx / l) * drive.forward;
        desired.z += (fz / l) * drive.forward;
      }
      if (drive.sideways !== undefined) {
        const sx = -right.x;
        const sz = -right.z;
        const l = Math.hypot(sx, sz) || 1;
        desired.x += (sx / l) * drive.sideways;
        desired.z += (sz / l) * drive.sideways;
      }
    }
    if (drive.x !== undefined) desired.x += drive.x;
    if (drive.z !== undefined) desired.z += drive.z;

    // Step-up boost handled this frame -> done.
    if (flock.applyGroundedMovement(mesh, desired)) return;
  }

  // Explicit vertical lift (up / y) overrides the gravity-driven vertical.
  const vertical = drive.up !== undefined ? drive.up : drive.y;
  if (vertical !== undefined) {
    const v = mesh.physics.getLinearVelocity();
    v.y = vertical;
    mesh.physics.setLinearVelocity(v);
  }

  keepUpright(mesh);
};

// Default "no free sliding" behaviour for a mesh with the upright joint
// constraint when nothing is actively driving it.
const applyUprightStabiliser = (mesh) => {
  if (!mesh.metadata?.constraint) return;
  try {
    const v = (mesh._stabiliserVelocity ??= new flock.BABYLON.Vector3());
    mesh.physics.getLinearVelocityToRef(v);
    const keepHorizontal =
      v.x * v.x + v.z * v.z > 1e-6 &&
      mesh.metadata.physicsCapsule &&
      (!flock.checkGrounded(mesh) || mesh._jumpUntilGrounded);
    if (!keepHorizontal) {
      v.x = 0;
      v.z = 0;
      mesh.physics.setLinearVelocity(v);
    }
    mesh.physics.setAngularVelocity(flock.BABYLON.Vector3.ZeroReadOnly);
  } catch (err) {
    console.warn('Physics body became invalid:', err);
  }
};

// Single per-mesh post-physics observer shared by ensureVerticalConstraint
// and setSpeed, so only one of them ever touches a mesh's velocity per step.
const ensurePostPhysicsUpkeep = (mesh) => {
  // Kept on the mesh, not mesh.metadata, since cloneMesh shallow-copies metadata.
  if (mesh._postPhysicsUpkeep) return;
  const scene = flock.scene;
  if (!scene?.onAfterPhysicsObservable) return;
  const observer = scene.onAfterPhysicsObservable.add(() => {
    if (!mesh || mesh.isDisposed?.() || !isBodyAlive(mesh.physics)) {
      scene.onAfterPhysicsObservable.remove(observer);
      mesh._postPhysicsUpkeep = null;
      return;
    }
    if (mesh.metadata?.velocityDrive) {
      applyVelocityDrive(mesh);
    } else {
      applyUprightStabiliser(mesh);
    }
  });
  mesh._postPhysicsUpkeep = observer;
};

const getShapeTypeFromPhysics = (physics) => {
  if (!physics?.shape) return null;
  const shape = physics.shape;
  if (
    flock?.BABYLON?.PhysicsShapeContainer &&
    shape instanceof flock.BABYLON.PhysicsShapeContainer
  )
    return 'CONTAINER';
  if (flock?.BABYLON?.PhysicsShapeCapsule && shape instanceof flock.BABYLON.PhysicsShapeCapsule)
    return 'CAPSULE';
  if (
    flock?.BABYLON?.PhysicsShapeConvexHull &&
    shape instanceof flock.BABYLON.PhysicsShapeConvexHull
  )
    return 'CONVEX_HULL';
  if (flock?.BABYLON?.PhysicsShapeBox && shape instanceof flock.BABYLON.PhysicsShapeBox)
    return 'BOX';
  if (flock?.BABYLON?.PhysicsShapeSphere && shape instanceof flock.BABYLON.PhysicsShapeSphere)
    return 'SPHERE';
  if (flock?.BABYLON?.PhysicsShapeCylinder && shape instanceof flock.BABYLON.PhysicsShapeCylinder)
    return 'CYLINDER';
  if (flock?.BABYLON?.PhysicsShapeMesh && shape instanceof flock.BABYLON.PhysicsShapeMesh)
    return 'MESH';
  return null;
};

const capturePhysicsState = (targetMesh) => {
  const body = targetMesh.physics;
  if (!body?._pluginData?.hpBodyId) {
    return {
      motionType: undefined,
      disablePreStep: body?.disablePreStep ?? false,
      shapeType: targetMesh.metadata?.physicsShapeType,
    };
  }
  return {
    motionType: body.getMotionType?.(),
    disablePreStep: body.disablePreStep ?? false,
    shapeType: getShapeTypeFromPhysics(body) || targetMesh.metadata?.physicsShapeType,
  };
};

const disposePhysics = (targetMesh) => {
  if (!targetMesh.physics) return;

  const body = targetMesh.physics;

  // Remove the body from the physics world
  try {
    if (body._pluginData?.hpBodyId) {
      flock.hk._hknp.HP_World_RemoveBody(flock.hk.world, body._pluginData.hpBodyId);
    }
  } catch (e) {
    console.warn('[physics] RemoveBody warning:', e);
  }

  // Dispose the shape only if it is not shared with another body.
  // PhysicsBody.clone() shares the same shape JS object between source and clone,
  // so disposing it here would also destroy the source's shape, leaving the source
  // body with a dangling reference that crashes the next clone attempt.
  try {
    if (!body.shape?._isShared) {
      body.shape?.dispose?.();
    }
  } catch (error) {
    console.warn('Suppressed non-critical error:', error);
  }
  try {
    body.dispose?.();
  } catch (error) {
    console.warn('Suppressed non-critical error:', error);
  }
  // body.dispose() sets transformNode.physicsBody = null, but only if no earlier
  // step throws. Force-clear it so Babylon's clone path doesn't try to clone a
  // disposed body with shape = null (which Havok rejects).
  targetMesh.physicsBody = null;
  targetMesh.physics = null;
};

// Rings and donuts are hollow: a CONVEX_HULL shrink-wraps the hole shut, so a
// dynamic ring balances on a pole instead of sliding down it. A container of
// box segments leaves the hole open while staying dynamic-capable (a triangle
// MESH shape is static-only in Havok).
const HOLLOW_SEGMENTS = 12;

const isHollowWalledMesh = (mesh) => {
  const shapeType = mesh?.metadata?.shapeType;
  if (shapeType !== 'Ring' && shapeType !== 'Donut') return false;
  const dims = mesh?.metadata?.ringDimensions ?? mesh?.metadata?.donutDimensions;
  if (!dims) return true;
  return Number(dims.innerDiameter) > 1e-6;
};

const createHollowContainerShape = (mesh, scene) => {
  const B = flock.BABYLON;
  const shapeType = mesh?.metadata?.shapeType;
  const sx = Math.abs(mesh?.scaling?.x ?? 1) || 1;
  const sy = Math.abs(mesh?.scaling?.y ?? 1) || 1;
  const sz = Math.abs(mesh?.scaling?.z ?? 1) || 1;
  const radialScale = (sx + sz) / 2;

  let meanRadius;
  let wallRadial;
  let height;
  if (shapeType === 'Ring') {
    const dims = mesh.metadata?.ringDimensions;
    if (!dims) return null;
    const outerR = (dims.diameter / 2) * radialScale;
    const innerR = (dims.innerDiameter / 2) * radialScale;
    if (!(outerR > 0) || !(innerR > 1e-6)) return null;
    meanRadius = (outerR + innerR) / 2;
    wallRadial = outerR - innerR;
    height = dims.height * sy;
  } else if (shapeType === 'Donut') {
    const dims = mesh.metadata?.donutDimensions;
    if (!dims) return null;
    const tube = dims.thickness * radialScale;
    if (!(tube > 0)) return null;
    meanRadius = ((dims.diameter - dims.thickness) / 2) * radialScale;
    if (!(meanRadius > 1e-6)) return null;
    wallRadial = tube;
    height = tube * sy;
  } else {
    return null;
  }
  if (!(meanRadius > 0) || !(wallRadial > 0) || !(height > 0)) return null;

  const segments = HOLLOW_SEGMENTS;
  // Overlap tangentially to seal corner gaps, but keep the radial depth exact:
  // oversizing radially shrinks the hole (apothem = meanRadius - depth/2) and
  // the pole then catches the rim and orbits instead of threading it.
  const tangential = 2 * meanRadius * Math.tan(Math.PI / segments) * 1.25;
  const container = new B.PhysicsShapeContainer(scene);
  for (let i = 0; i < segments; i++) {
    const angle = (i / segments) * Math.PI * 2;
    const child = new B.PhysicsShapeBox(
      B.Vector3.Zero(),
      B.Quaternion.Identity(),
      new B.Vector3(tangential, height, wallRadial),
      scene
    );
    container.addChild(
      child,
      new B.Vector3(meanRadius * Math.cos(angle), 0, meanRadius * Math.sin(angle)),
      B.Quaternion.RotationYawPitchRoll(-angle - Math.PI / 2, 0, 0)
    );
  }
  return container;
};

const createPhysicsShape = (mesh, shapeType) => {
  if (shapeType === 'CONTAINER') {
    return createHollowContainerShape(mesh, flock.scene);
  }
  if (shapeType === 'CAPSULE') {
    mesh.computeWorldMatrix(true);
    return flock.createCapsuleFromBoundingBox(mesh, flock.scene);
  }
  if (shapeType === 'CONVEX_HULL') {
    return new flock.BABYLON.PhysicsShapeConvexHull(mesh, flock.scene);
  }
  if (shapeType === 'BOX') {
    return flock.createBoxFromBoundingBox(mesh, flock.scene);
  }
  if (shapeType === 'SPHERE') {
    return flock.createSphereFromBoundingBox(mesh, flock.scene);
  }
  if (shapeType === 'CYLINDER') {
    return flock.createCylinderFromBoundingBox(mesh, flock.scene);
  }
  return new flock.BABYLON.PhysicsShapeMesh(mesh, flock.scene);
};

const SHAPE_TYPES_KEPT_ON_REBUILD = [
  'CAPSULE',
  'CONVEX_HULL',
  'BOX',
  'SPHERE',
  'CYLINDER',
  'CONTAINER',
];

const applyPhysicsShape = (
  targetMesh,
  shapeType,
  motionType = flock.BABYLON.PhysicsMotionType.STATIC,
  disablePreStep = false
) => {
  const normalizedShapeType = SHAPE_TYPES_KEPT_ON_REBUILD.includes(shapeType) ? shapeType : 'MESH';
  const physicsShape = createPhysicsShape(targetMesh, normalizedShapeType);
  if (!physicsShape) {
    console.error('[physics] Failed to create', normalizedShapeType, 'shape for', targetMesh.name);
    return;
  }

  const physicsBody = new flock.BABYLON.PhysicsBody(
    targetMesh,
    normalizedShapeType === 'CAPSULE' ? flock.BABYLON.PhysicsMotionType.DYNAMIC : motionType,
    false,
    flock.scene
  );
  physicsBody.shape = physicsShape;
  physicsBody.setMassProperties({ mass: 1 });
  applyBounciness(physicsBody, targetMesh);
  physicsBody.disablePreStep = disablePreStep;
  targetMesh.physics = physicsBody;
  if (normalizedShapeType === 'CAPSULE') physicsBody.setMotionType(motionType);
  targetMesh.metadata = targetMesh.metadata || {};
  targetMesh.metadata.physicsShapeType = normalizedShapeType;
  targetMesh.metadata.physicsCache = {
    motionType: physicsBody.getMotionType?.(),
    disablePreStep: physicsBody.disablePreStep,
    shapeType: normalizedShapeType,
  };
};

function waitForSceneTransformFlush(scene) {
  if (!scene || scene.isDisposed) return Promise.resolve();

  return new Promise((resolve) => {
    let resolved = false;

    const finish = () => {
      if (resolved) return;
      resolved = true;
      resolve();
    };

    scene.onAfterRenderObservable.addOnce(finish);

    // Fallback so tests or unusual non-rendering contexts do not hang forever.
    setTimeout(finish, 0);
  });
}

export function setFlockReference(ref) {
  flock = ref;
}

const PICK_TRIGGER_NAMES = [
  'OnPickTrigger',
  'OnLeftPickTrigger',
  'OnDoublePickTrigger',
  'OnPickDownTrigger',
  'OnPickUpTrigger',
];

function isDescendantOf(mesh, ancestor) {
  let node = mesh?.parent;
  while (node) {
    if (node === ancestor) return true;
    node = node.parent;
  }
  return false;
}

// A group shell encloses its members, so a ray aimed at a member hits
// the (invisible) shell first and Babylon routes the click to the
// shell. Give a member with its own trigger for this event first
// refusal. Returns the mesh whose manager should fire instead, or
// null when the owner itself should handle the click.
function resolveDelegatedMesh(owner, triggerId, evt) {
  if (owner?.metadata?.shapeType !== 'Group' && owner?.visibility !== 0) return null;
  const x = evt?.pointerX;
  const y = evt?.pointerY;
  if (typeof x !== 'number' || typeof y !== 'number') return null;
  if (typeof flock.scene?.multiPick !== 'function') return null;
  let hits;
  try {
    hits = flock.scene.multiPick(
      x,
      y,
      (m) => m.isPickable && m.isVisible && m.isEnabled?.() !== false
    );
  } catch {
    return null;
  }
  if (!hits?.length) return null;
  // multiPick returns hits in scene.meshes order, not nearest first.
  hits.sort((a, b) => (a?.distance ?? Infinity) - (b?.distance ?? Infinity));
  const ownerManager = owner.actionManager;
  let candidate = null;
  for (const hit of hits) {
    const m = hit?.pickedMesh;
    if (!m || m === owner) continue;
    if (!isDescendantOf(m, owner)) break;
    const mgr =
      typeof m._getActionManagerForTrigger === 'function'
        ? m._getActionManagerForTrigger(triggerId)
        : null;
    if (mgr && mgr !== ownerManager) {
      // Nearest mesh up from the hit owning that manager (the hit
      // itself, or an intermediate group). Fired with a delegated flag
      // so it runs directly instead of re-delegating.
      let o = m;
      while (o && o !== owner && o.actionManager !== mgr) o = o.parent;
      candidate = o && o !== owner ? o : m;
      if (m.visibility !== 0) break;
    } else if (m.visibility !== 0) {
      break;
    }
  }
  return candidate;
}

function shellHasRealTrigger(shell, triggerId) {
  const actions = shell?.actionManager?.actions;
  if (!actions) return false;
  return actions.some((a) => a && a.trigger === triggerId && !a._flockForwarder);
}

function hasRealPickTrigger(mesh) {
  const manager = mesh?.actionManager;
  if (!manager?.hasPickTriggers) return false;
  const ids = PICK_TRIGGER_NAMES.map((name) => flock.BABYLON.ActionManager[name]);
  return (manager.actions || []).some((a) => a && ids.includes(a.trigger) && !a._flockForwarder);
}

export const flockPhysics = {
  isHollowWalledMesh,
  createHollowContainerShape,
  createPhysicsBody(mesh, shape, motionType = flock.BABYLON.PhysicsMotionType.STATIC) {
    const physicsBody = new flock.BABYLON.PhysicsBody(mesh, motionType, false, flock.scene);
    physicsBody.shape = shape;
    physicsBody.setMassProperties({ mass: 1 });
    applyBounciness(physicsBody, mesh);
    mesh.physics = physicsBody;
  },
  applyPhysics(geometry, physicsShape) {
    const physicsBody = new flock.BABYLON.PhysicsBody(
      geometry,
      flock.BABYLON.PhysicsMotionType.STATIC,
      false,
      flock.scene
    );
    physicsBody.shape = physicsShape;
    physicsBody.setMassProperties({ mass: 1 });
    applyBounciness(physicsBody, geometry);
    physicsBody.disablePreStep = true;

    geometry.physics = physicsBody;
  },
  disposeMeshPhysics(mesh) {
    disposePhysics(mesh);
  },
  updatePhysics(mesh, parent = null) {
    if (!parent) parent = mesh;
    // Keeps the sign: a negative axis is a deliberate mirror (flip, mirror).
    for (const axis of ['x', 'y', 'z']) {
      const value = mesh.scaling[axis];
      if (Math.abs(value) < 0.01) mesh.scaling[axis] = value < 0 ? -0.01 : 0.01;
    }
    mesh.computeWorldMatrix(true);
    mesh.refreshBoundingInfo(true);
    if (!isBodyAlive(parent.physics)) return;

    const { motionType, disablePreStep } = capturePhysicsState(parent);
    const physicsShape = parent.physics.shape;
    if (!physicsShape) return;

    const boundingBox = mesh.getBoundingInfo().boundingBox;
    const size = boundingBox.maximum
      .subtract(boundingBox.minimum)
      .multiplyInPlace(mesh.absoluteScaling);
    const width = Math.abs(size.x);
    const height = Math.abs(size.y);
    const depth = Math.abs(size.z);
    const center = boundingBox.center.multiply(mesh.absoluteScaling);

    let newShape;
    let detectedShapeType;
    if (physicsShape instanceof flock.BABYLON.PhysicsShapeBox) {
      detectedShapeType = 'BOX';
      newShape = new flock.BABYLON.PhysicsShapeBox(
        center,
        new flock.BABYLON.Quaternion(0, 0, 0, 1),
        new flock.BABYLON.Vector3(width, height, depth),
        flock.scene
      );
    } else if (physicsShape instanceof flock.BABYLON.PhysicsShapeSphere) {
      detectedShapeType = 'SPHERE';
      newShape = new flock.BABYLON.PhysicsShapeSphere(
        center,
        Math.max(width, height, depth) / 2,
        flock.scene
      );
    } else if (physicsShape instanceof flock.BABYLON.PhysicsShapeCylinder) {
      detectedShapeType = 'CYLINDER';
      newShape = new flock.BABYLON.PhysicsShapeCylinder(
        new flock.BABYLON.Vector3(center.x, center.y - height / 2, center.z),
        new flock.BABYLON.Vector3(center.x, center.y + height / 2, center.z),
        Math.max(width, depth) / 2,
        flock.scene
      );
    } else if (
      flock?.BABYLON?.PhysicsShapeCapsule &&
      physicsShape instanceof flock.BABYLON.PhysicsShapeCapsule
    ) {
      detectedShapeType = 'CAPSULE';
      newShape = createPhysicsShape(mesh, 'CAPSULE');
      if (!newShape) return;
    } else if (
      flock?.BABYLON?.PhysicsShapeConvexHull &&
      physicsShape instanceof flock.BABYLON.PhysicsShapeConvexHull
    ) {
      detectedShapeType = 'CONVEX_HULL';
      newShape = createPhysicsShape(mesh, 'CONVEX_HULL');
      if (!newShape) return;
    } else if (
      flock?.BABYLON?.PhysicsShapeContainer &&
      physicsShape instanceof flock.BABYLON.PhysicsShapeContainer
    ) {
      detectedShapeType = 'CONTAINER';
      if (isHollowWalledMesh(parent)) {
        newShape = createHollowContainerShape(parent, flock.scene);
      } else {
        detectedShapeType = parent.metadata?.physicsShapeType || 'MESH';
        newShape = createPhysicsShape(mesh, detectedShapeType);
      }
      if (!newShape) return;
    } else if (
      flock?.BABYLON?.PhysicsShapeMesh &&
      physicsShape instanceof flock.BABYLON.PhysicsShapeMesh
    ) {
      // A live edit may have rebuilt a dynamic ring as a hollow MESH; repair
      // it to the dynamic-capable container so the hole stays open.
      if (
        isHollowWalledMesh(parent) &&
        motionType === flock.BABYLON.PhysicsMotionType.DYNAMIC
      ) {
        detectedShapeType = 'CONTAINER';
        newShape = createHollowContainerShape(parent, flock.scene);
      } else {
        detectedShapeType = 'MESH';
        newShape = createPhysicsShape(mesh, 'MESH');
      }
      if (!newShape) return;
    } else {
      detectedShapeType =
        getShapeTypeFromPhysics(parent.physics) || parent.metadata?.physicsShapeType;
      if (!detectedShapeType) return;
      newShape = createPhysicsShape(mesh, detectedShapeType);
      if (!newShape) return;
    }

    const linearVelocity = parent.physics.getLinearVelocity();
    const angularVelocity = parent.physics.getAngularVelocity();

    disposePhysics(parent);

    const isCapsule = detectedShapeType === 'CAPSULE';
    const physicsBody = new flock.BABYLON.PhysicsBody(
      parent,
      isCapsule
        ? flock.BABYLON.PhysicsMotionType.DYNAMIC
        : (motionType ?? flock.BABYLON.PhysicsMotionType.STATIC),
      false,
      flock.scene
    );
    physicsBody.shape = newShape;
    physicsBody.setMassProperties({ mass: 1 });
    applyBounciness(physicsBody, parent);
    physicsBody.disablePreStep = disablePreStep ?? false;
    physicsBody.setLinearVelocity(linearVelocity);
    physicsBody.setAngularVelocity(angularVelocity);
    parent.physics = physicsBody;
    if (isCapsule) physicsBody.setMotionType(motionType ?? flock.BABYLON.PhysicsMotionType.STATIC);
    parent.metadata = parent.metadata || {};
    parent.metadata.physicsShapeType = detectedShapeType;
    parent.metadata.physicsCache = {
      motionType: physicsBody.getMotionType?.(),
      disablePreStep: physicsBody.disablePreStep,
      shapeType: detectedShapeType,
    };
    redriveRebuiltBody(parent);
  },
  addBeforePhysicsObservable(scene, ...meshes) {
    const beforePhysicsObserver = scene.onBeforePhysicsObservable.add(() => {
      meshes.forEach((mesh) => {
        mesh.computeWorldMatrix(true);
      });
    });
    return beforePhysicsObserver;
  },
  up(meshName, upForce = 10) {
    const mesh = flock.scene.getMeshByName(meshName);
    if (mesh && isBodyAlive(mesh.physics)) {
      mesh.physics.applyImpulse(
        new flock.BABYLON.Vector3(0, upForce, 0),
        mesh.getAbsolutePosition()
      );
    } else {
      console.log('Model not loaded (up):', meshName);
    }
  },
  // Set how bouncy an object is (0 = no bounce, 1 = very bouncy). Stored in
  // metadata so it survives physics rebuilds; see applyBounciness.
  applyBounciness,
  ensurePostPhysicsUpkeep,
  setBounciness(meshName, bounciness = 0.5) {
    const mesh = flock.scene.getMeshByName(meshName);
    if (mesh && isBodyAlive(mesh.physics) && mesh.physics.shape) {
      mesh.metadata = mesh.metadata || {};
      mesh.metadata.bounciness = Math.max(0, Math.min(1, bounciness));
      applyBounciness(mesh.physics, mesh);
    } else {
      console.error(`Model '${meshName}' not loaded or missing physics (setBounciness)`);
    }
  },
  applyForce(meshName, { forceX = 0, forceY = 0, forceZ = 0 } = {}) {
    const mesh = flock.scene.getMeshByName(meshName);
    if (mesh && isBodyAlive(mesh.physics)) {
      mesh.physics.applyImpulse(
        new flock.BABYLON.Vector3(forceX, forceY, forceZ),
        mesh.getAbsolutePosition()
      );
    } else {
      console.error(`Model '${meshName}' not loaded or missing physics (applyForce)`);
    }
  },
  // Ensure mesh.metadata.physicsCapsule is set, computing it from the bounding
  // box if missing — the exact assignment move-forward uses, so driven objects
  // get a consistent capsule for either block.
  ensurePhysicsCapsule(mesh) {
    if (!mesh) return null;
    let cap = mesh.metadata?.physicsCapsule;
    if (cap && typeof cap.radius === 'number' && typeof cap.height === 'number') {
      return cap;
    }
    mesh.computeWorldMatrix(true);
    const bb = mesh.getBoundingInfo().boundingBox;
    const localMin = bb.minimum;
    const localMax = bb.maximum;
    const height = Math.max(0.001, localMax.y - localMin.y);
    const width = Math.max(0.001, localMax.x - localMin.x);
    const depth = Math.max(0.001, localMax.z - localMin.z);
    const radius = Math.min(width, depth) / 2;
    const localCenter = new flock.BABYLON.Vector3(
      (localMin.x + localMax.x) / 2,
      (localMin.y + localMax.y) / 2,
      (localMin.z + localMax.z) / 2
    );
    const adjustedHeight = Math.max(0, height - 0.01);
    cap = { radius, height: adjustedHeight, localCenter };
    mesh.metadata = mesh.metadata || {};
    mesh.metadata.physicsCapsule = cap;
    return cap;
  },
  // Set the speed an object travels at in one of its directions. Choose a local
  // direction (forward/sideways/up, relative to the object's facing) or a world
  // axis (x/y/z). The speed is *maintained* — re-applied every physics step — so
  // it holds until you change it. Directions you haven't set are left to physics,
  // so gravity still pulls it down and it can ride slopes and hit barriers. Local
  // directions follow the move-forward / glide convention (forward =
  // mesh.forward.negate()). 'all' to 0 is a full stop: it clears every maintained
  // direction and zeroes the velocity, so the object behaves normally afterwards.
  setSpeed(meshName, direction, speed = 0) {
    const mesh = flock.scene.getMeshByName(meshName);
    if (!(mesh && isBodyAlive(mesh.physics))) {
      console.error(`Model '${meshName}' not loaded or missing physics (setSpeed)`);
      return;
    }
    mesh.metadata = mesh.metadata || {};
    // Assign a physics capsule the same way move-forward does, for consistency.
    flock.ensurePhysicsCapsule(mesh);

    if (direction === 'all') {
      if (speed === 0) {
        // Full stop: drop all maintained motion and kill current velocity, so
        // physics (gravity, slopes) takes over normally and driving can resume.
        delete mesh.metadata.velocityDrive;
        mesh.physics.setLinearVelocity(new flock.BABYLON.Vector3(0, 0, 0));
        return;
      }
      mesh.metadata.velocityDrive = { x: speed, y: speed, z: speed };
    } else {
      const worldAxis = { x_coordinate: 'x', y_coordinate: 'y', z_coordinate: 'z' }[direction];
      mesh.metadata.velocityDrive = mesh.metadata.velocityDrive || {};
      mesh.metadata.velocityDrive[worldAxis || direction] = speed;
    }

    ensurePostPhysicsUpkeep(mesh);
    applyVelocityDrive(mesh); // take effect immediately, not next frame
  },
  setPhysicsForMesh(mesh, physicsType) {
    if (!mesh) return mesh;

    mesh.metadata = mesh.metadata || {};
    mesh.metadata.physicsType = physicsType;

    if (!mesh.physics && physicsType !== 'NONE') {
      const { motionType, disablePreStep, shapeType } = mesh.metadata.physicsCache || {};
      const resolvedShapeType = shapeType || mesh.metadata.physicsShapeType || 'MESH';
      applyPhysicsShape(mesh, resolvedShapeType, motionType, disablePreStep);
    }

    if (!mesh.physics || (!isBodyAlive(mesh.physics) && physicsType !== 'NONE')) return mesh;

    switch (physicsType) {
      case 'STATIC':
        if (
          getShapeTypeFromPhysics(mesh.physics) === 'CONTAINER' &&
          isHollowWalledMesh(mesh)
        ) {
          disposePhysics(mesh);
          applyPhysicsShape(mesh, 'MESH', flock.BABYLON.PhysicsMotionType.STATIC, true);
          break;
        }
        mesh.physics.setMotionType(flock.BABYLON.PhysicsMotionType.STATIC);
        mesh.physics.disablePreStep = true;
        if (mesh.physics.body) mesh.physics.body.disableSync = false;
        break;

      case 'DYNAMIC':
        if (isHollowWalledMesh(mesh)) {
          const current = getShapeTypeFromPhysics(mesh.physics);
          if (current !== 'CONTAINER') {
            disposePhysics(mesh);
            applyPhysicsShape(
              mesh,
              'CONTAINER',
              flock.BABYLON.PhysicsMotionType.DYNAMIC,
              false
            );
            break;
          }
        } else if (getShapeTypeFromPhysics(mesh.physics) === 'MESH') {
          disposePhysics(mesh);
          applyPhysicsShape(mesh, 'CONVEX_HULL', flock.BABYLON.PhysicsMotionType.DYNAMIC, false);
          break;
        }
        mesh.physics.setMotionType(flock.BABYLON.PhysicsMotionType.DYNAMIC);
        mesh.physics.disablePreStep = false;
        if (mesh.physics.body) mesh.physics.body.disableSync = false;
        break;

      case 'ANIMATED':
        mesh.physics.setMotionType(flock.BABYLON.PhysicsMotionType.ANIMATED);
        mesh.physics.disablePreStep = false;
        if (mesh.physics.body) mesh.physics.body.disableSync = false;
        break;

      case 'NONE':
        mesh.metadata.physicsCache = capturePhysicsState(mesh);
        disposePhysics(mesh);
        mesh.physics = null;
        break;
    }

    adoptPhysicsChangeDuringDrive(mesh);
    flock._syncTeleportMeshHierarchy?.(mesh);
    return mesh;
  },
  async setPhysics(meshName, physicsType) {
    const mesh = await (typeof flock.ensureModelReadyPromise === 'function'
      ? flock.ensureModelReadyPromise(meshName)
      : new Promise((resolve) => flock.whenModelReady(meshName, resolve)));

    if (flock.abortController?.signal?.aborted || !mesh) return mesh;

    mesh.computeWorldMatrix?.(true);
    mesh.refreshBoundingInfo?.();

    // The settle-a-frame wait (#637) only matters when the mesh's world
    // transform depends on hierarchy/scene propagation that hasn't flushed
    // yet — i.e. parented meshes. For a freshly created, unparented mesh the
    // synchronous computeWorldMatrix(true) above already makes the transform
    // correct, so the per-body frame wait is pure latency. Skipping it here
    // is what makes loops that spawn many physics objects fast (N bodies no
    // longer cost N frames).
    if (mesh.parent) {
      await waitForSceneTransformFlush(flock.scene);

      if (flock.abortController?.signal?.aborted || mesh.isDisposed?.()) return mesh;

      mesh.computeWorldMatrix?.(true);
      mesh.refreshBoundingInfo?.();
    }

    return flock.setPhysicsForMesh(mesh, physicsType);
  },
  setPhysicsShape(meshName, shapeType) {
    return new Promise((resolve) => {
      flock.whenModelReady(meshName, (mesh) => {
        const capturePhysicsState = (targetMesh) => ({
          motionType: targetMesh.physics?.getMotionType?.(),
          disablePreStep: targetMesh.physics?.disablePreStep,
        });

        mesh.metadata = mesh.metadata || {};

        // --- CAPSULE path (player collider) ---
        const applyCapsuleToRoot = (targetMesh) => {
          targetMesh.computeWorldMatrix(true);
          const { motionType, disablePreStep } = capturePhysicsState(targetMesh);
          disposePhysics(targetMesh);

          // IMPORTANT: use targetMesh (not outer mesh)
          const physicsShape = flock.createCapsuleFromBoundingBox(targetMesh, flock.scene);
          if (!physicsShape) {
            console.error('[setPhysicsShape] Failed to create capsule for', targetMesh.name);
            return;
          }

          const physicsBody = new flock.BABYLON.PhysicsBody(
            targetMesh,
            flock.BABYLON.PhysicsMotionType.DYNAMIC,
            false,
            flock.scene
          );
          physicsBody.shape = physicsShape;
          physicsBody.setMassProperties({ mass: 1 });
          applyBounciness(physicsBody, targetMesh);
          physicsBody.disablePreStep = disablePreStep ?? false;

          targetMesh.physics = physicsBody;
          if (motionType != null) {
            physicsBody.setMotionType(motionType);
          }

          targetMesh.metadata.physicsShapeType = 'CAPSULE';
          targetMesh.metadata.physicsCache = {
            motionType: physicsBody.getMotionType?.(),
            disablePreStep: physicsBody.disablePreStep,
            shapeType: 'CAPSULE',
          };
        };

        const applyMeshPhysicsShape = (targetMesh) => {
          const { motionType, disablePreStep } = capturePhysicsState(targetMesh);

          if (!targetMesh.material) {
            disposePhysics(targetMesh);
            return;
          }

          disposePhysics(targetMesh);

          // A dynamic ring/donut keeps its hole via the container; rebuilding
          // a triangle MESH here would undo that and restore an unsupported
          // dynamic-mesh body.
          let physicsShape;
          let shapeType = 'MESH';
          if (
            isHollowWalledMesh(targetMesh) &&
            motionType === flock.BABYLON.PhysicsMotionType.DYNAMIC
          ) {
            physicsShape = createHollowContainerShape(targetMesh, flock.scene);
            if (physicsShape) shapeType = 'CONTAINER';
            else physicsShape = new flock.BABYLON.PhysicsShapeMesh(targetMesh, flock.scene);
          } else {
            physicsShape = new flock.BABYLON.PhysicsShapeMesh(targetMesh, flock.scene);
          }

          const physicsBody = new flock.BABYLON.PhysicsBody(
            targetMesh,
            motionType ?? flock.BABYLON.PhysicsMotionType.STATIC,
            false,
            flock.scene
          );
          physicsBody.shape = physicsShape;
          physicsBody.setMassProperties({ mass: 1 });
          applyBounciness(physicsBody, targetMesh);
          physicsBody.disablePreStep = disablePreStep ?? false;

          targetMesh.physics = physicsBody;

          targetMesh.metadata.physicsShapeType = shapeType;
          targetMesh.metadata.physicsCache = {
            motionType: physicsBody.getMotionType?.(),
            disablePreStep: physicsBody.disablePreStep,
            shapeType,
          };
        };

        // --- Dispatch by shape type ---
        switch (shapeType) {
          case 'CAPSULE':
            // Only on root (player), no children
            applyCapsuleToRoot(mesh);
            break;

          case 'MESH':
            applyMeshPhysicsShape(mesh);
            if (mesh.getChildMeshes) {
              mesh.getChildMeshes().forEach((subMesh) => {
                applyMeshPhysicsShape(subMesh);
              });
            }
            break;

          default:
            console.error('Invalid shape type provided:', shapeType);
            resolve();
            return;
        }
        resolve();
      });
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
  hasRealPickTrigger,
  ensureGroupPickForwarder(shell) {
    if (!shell || shell.metadata?.shapeType !== 'Group') return;
    if (shell.isDisposed?.()) return;
    const scene = shell.getScene?.() || flock.scene;
    if (!scene) return;
    if (!shell.actionManager) shell.actionManager = new flock.BABYLON.ActionManager(scene);
    shell.actionManager.isRecursive = true;
    if (shell.metadata._pickForwarded) return;
    shell.metadata._pickForwarded = true;
    // A trigger-less shell still occludes its members (it encloses them),
    // so member clicks would die on the shell without ever reaching a
    // handler. Forward them to the deepest member with a real trigger.
    // Once the group itself gets a real trigger, its own handler takes
    // over (member-first delegation) and the forwarders stand down.
    for (const name of PICK_TRIGGER_NAMES) {
      const triggerId = flock.BABYLON.ActionManager[name];
      const forward = new flock.BABYLON.ExecuteCodeAction(triggerId, (evt) => {
        if (shellHasRealTrigger(shell, triggerId)) return;
        const clicked = evt?.meshUnderPointer || evt?.source;
        if (clicked !== shell) return;
        const member = resolveDelegatedMesh(shell, triggerId, evt);
        member?.actionManager?.processTrigger(triggerId, {
          ...evt,
          source: member,
          meshUnderPointer: member,
          __flockDelegated: true,
        });
      });
      forward._flockForwarder = true;
      shell.actionManager.registerAction(forward);
    }
  },
  onTrigger(
    meshName,
    {
      trigger,
      callback,
      mode = 'wait',
      applyToGroup = false,
      // Captured here, not re-read later - a pending trigger registers
      // asynchronously, by which point this could be stale. Internal only,
      // see onSectionStop in api/sections.js.
      __owningSignal = flock.sectionSignal(),
    }
  ) {
    const groupName = flock._familyOf(meshName);
    if (flock._isTag(meshName)) applyToGroup = true;
    const getAllGuiControls = () => {
      const root = flock.scene?.UITexture?._rootContainer ?? flock.scene?.UITexture?.rootContainer;
      if (!root) return [];
      if (typeof root.getDescendants === 'function') {
        return root.getDescendants(false);
      }
      const all = [];
      const stack = [root];
      while (stack.length > 0) {
        const node = stack.pop();
        const children = node?._children ?? node?.children ?? [];
        for (const child of children) {
          all.push(child);
          stack.push(child);
        }
      }
      return all;
    };

    if (!flock.scene) {
      if (!flock.pendingTriggers.has(groupName)) flock.pendingTriggers.set(groupName, []);
      flock.pendingTriggers
        .get(groupName)
        .push({ meshName, trigger, callback, mode, applyToGroup, owningSignal: __owningSignal });
      return;
    }

    if (applyToGroup) {
      let matchingButtons = [];
      if (flock.scene.UITexture && !flock._isTag(groupName)) {
        matchingButtons = getAllGuiControls().filter(
          (control) =>
            control instanceof flock.GUI.Button &&
            control.name &&
            flock._familyOf(control.name) === groupName
        );
      }
      const matching = flock.scene.meshes.filter((m) => flock._inGroup(m, groupName));

      if (matchingButtons.length > 0) {
        for (const btn of matchingButtons) {
          flock.onTrigger(btn.name, {
            trigger,
            callback,
            mode,
            applyToGroup: false,
            __owningSignal,
          });
        }
      }
      if (matching.length > 0) {
        for (const m of matching) {
          flock.onTrigger(m.name, {
            trigger,
            callback,
            mode,
            applyToGroup: false,
            __owningSignal,
          });
        }
      }
      if (!flock.pendingTriggers.has(groupName)) flock.pendingTriggers.set(groupName, []);
      flock.pendingTriggers
        .get(groupName)
        .push({ meshName, trigger, callback, mode, applyToGroup, owningSignal: __owningSignal });
      return;
    }

    let guiButton = null;
    if (flock.scene.UITexture) {
      guiButton = flock.scene.UITexture.getControlByName?.(meshName) ?? null;
    }

    const tryNow =
      flock.scene?.getMeshByName(meshName) || flock.modelReadyPromises.has(meshName) || guiButton;

    if (!tryNow) {
      if (!flock.pendingTriggers.has(groupName)) flock.pendingTriggers.set(groupName, []);
      flock.pendingTriggers
        .get(groupName)
        .push({ meshName, trigger, callback, mode, applyToGroup, owningSignal: __owningSignal });
      return;
    }

    return new Promise((resolve) => {
      flock.whenModelReady(meshName, async function (target) {
        if (!target) {
          flock.reportBlockError({
            key: 'object_not_found',
            api: 'onTrigger',
            values: { object: meshName },
          });
          resolve();
          return;
        }

        let isExecuting = false;
        let hasExecuted = false;
        let callbacks = Array.isArray(callback) ? callback : [callback];
        let currentIndex = 0;

        function registerMeshAction(mesh, trigger, action) {
          mesh.isPickable = true;
          if (!mesh.actionManager)
            mesh.actionManager = new flock.BABYLON.ActionManager(flock.scene);
          // Let clicks on members without their own trigger bubble to a
          // group/parent handler. Babylon routes a pick to the nearest
          // ancestor whose manager has this specific trigger, so a member
          // with its own handler still wins and nothing fires twice.
          mesh.actionManager.isRecursive = true;

          let actionSequence = new flock.BABYLON.ExecuteCodeAction(
            flock.BABYLON.ActionManager[trigger],
            action
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
          flock.onSectionStop(
            () => mesh.actionManager?.unregisterAction(actionSequence),
            __owningSignal
          );
        }

        function registerButtonAction(button, trigger, action) {
          if (trigger === 'OnPointerUpTrigger') button.onPointerUpObservable.add(action);
          else button.onPointerClickObservable.add(action);
          flock.onSectionStop(() => {
            if (trigger === 'OnPointerUpTrigger') button.onPointerUpObservable.remove(action);
            else button.onPointerClickObservable.remove(action);
          }, __owningSignal);
        }

        async function executeAction(meshId) {
          if (mode === 'once' && hasExecuted) return;
          if (mode === 'wait' && isExecuting) return;
          if (mode === 'once') hasExecuted = true;
          if (mode === 'wait') isExecuting = true;

          try {
            await callbacks[currentIndex](meshId);
            currentIndex = (currentIndex + 1) % callbacks.length;
          } catch (e) {
            flock.reportBlockError({
              key: 'trigger_block_failed',
              api: 'onTrigger',
              error: e,
            });
          } finally {
            if (mode === 'wait') isExecuting = false;
          }
        }

        if (target instanceof flock.BABYLON.AbstractMesh) {
          registerMeshAction(target, trigger, async (evt) => {
            const clickedMesh = evt?.meshUnderPointer || evt?.source || target;
            if (clickedMesh === target) {
              if (!evt?.__flockDelegated) {
                const delegatedMesh = resolveDelegatedMesh(
                  target,
                  flock.BABYLON.ActionManager[trigger],
                  evt
                );
                if (delegatedMesh?.actionManager) {
                  delegatedMesh.actionManager.processTrigger(flock.BABYLON.ActionManager[trigger], {
                    ...evt,
                    source: delegatedMesh,
                    meshUnderPointer: delegatedMesh,
                    __flockDelegated: true,
                  });
                  return;
                }
              }
              await executeAction(target.name);
              return;
            }
            // Bubbled from a member without its own trigger for this event.
            if (isDescendantOf(clickedMesh, target)) {
              await executeAction(target.name);
            }
            // Anything else is an unrelated mesh — ignore it.
          });

          // XR case
          if (flock.xrHelper && flock.xrHelper.baseExperience) {
            let stopHitTest = null;
            const xrObs = flock.xrHelper.baseExperience.onStateChangedObservable.add((state) => {
              if (state === flock.BABYLON.WebXRState.IN_XR) {
                // `position` carries the session's world scale; the raw matrix is in metres.
                stopHitTest ??= flock._onARHitTest((results) => {
                  if (!results.length) return;
                  target.position.copyFrom(results[0].position);
                  target.isVisible = true;
                });
              } else if (state === flock.BABYLON.WebXRState.EXITING_XR) {
                stopHitTest?.();
                stopHitTest = null;
              }
            });
            flock.abortController?.signal?.addEventListener(
              'abort',
              () => {
                stopHitTest?.();
                flock.xrHelper?.baseExperience?.onStateChangedObservable?.remove(xrObs);
              },
              { once: true }
            );
          }
        } else if (target instanceof flock.GUI.Button) {
          registerButtonAction(target, trigger, async () => await executeAction(target.name));
        } else {
          flock.reportBlockError({
            key: 'target_not_clickable',
            api: 'onTrigger',
            values: { object: meshName },
          });
        }
        resolve();
      });
    });
  },
  onIntersect(
    meshName,
    otherMeshName,
    { trigger, callback, applyToGroupOther = false, applyToGroupSelf = false } = {}
  ) {
    const resolveCanonicalGroupName = (rawName) => {
      const scene = flock.scene;
      const exact = scene?.getMeshByName?.(rawName);
      if (exact?.name) return flock._familyOf(exact.name);

      let normalized = rawName.includes('__') ? rawName.split('__')[0] : rawName;
      normalized = normalized.replace(/[^a-zA-Z0-9._-]/g, '');

      if (normalized && normalized !== rawName) {
        if (scene?.getMeshByName?.(normalized) || flock.modelReadyPromises.has(normalized)) {
          return flock._familyOf(normalized);
        }
      }

      return flock._familyOf(rawName);
    };

    if (flock._isTag(otherMeshName)) applyToGroupOther = true;

    if (applyToGroupSelf) {
      const groupName = resolveCanonicalGroupName(meshName);

      if (!flock.pendingSelfIntersections.has(groupName)) {
        flock.pendingSelfIntersections.set(groupName, []);
      }

      const pendingEntry = {
        trigger,
        callback,
        registeredPairs: new Set(),
      };
      flock.pendingSelfIntersections.get(groupName).push(pendingEntry);

      if (flock.scene) {
        const matching = flock.scene.meshes.filter((m) => flock._inGroup(m, groupName));
        const promises = [];
        for (let i = 0; i < matching.length; i++) {
          for (let j = i + 1; j < matching.length; j++) {
            const meshA = matching[i].uniqueId < matching[j].uniqueId ? matching[i] : matching[j];
            const meshB = meshA === matching[i] ? matching[j] : matching[i];
            const pairKey = `${meshA.uniqueId}|${meshB.uniqueId}`;
            if (!pendingEntry.registeredPairs.has(pairKey)) {
              pendingEntry.registeredPairs.add(pairKey);
              promises.push(
                flock.onIntersect(meshA.name, meshB.name, {
                  trigger,
                  callback,
                  applyToGroupOther: false,
                })
              );
            }
          }
        }
        return Promise.all(promises);
      }

      return;
    }

    const isTag = flock._isTag(meshName);
    const mayBecomeTag =
      applyToGroupOther &&
      !flock._nameRegistry.has(meshName) &&
      !flock.scene?.getMeshByName(meshName);
    if (isTag || mayBecomeTag) {
      const registered = new Set();
      const register = (name) => {
        if (registered.has(name)) return Promise.resolve();
        registered.add(name);
        return flock.onIntersect(name, otherMeshName, { trigger, callback, applyToGroupOther });
      };
      flock.pendingTagIntersections ??= new Map();
      if (!flock.pendingTagIntersections.has(meshName)) {
        flock.pendingTagIntersections.set(meshName, []);
      }
      flock.pendingTagIntersections.get(meshName).push({ register });
      if (isTag) return Promise.all(flock.getObjectsWithTag(meshName).map(register));
    }

    if (applyToGroupOther) {
      const groupName = resolveCanonicalGroupName(otherMeshName);

      if (!flock.pendingIntersections.has(groupName)) {
        flock.pendingIntersections.set(groupName, []);
      }

      const pendingEntry = {
        meshName,
        trigger,
        callback,
        registeredOthers: new Set(),
      };
      flock.pendingIntersections.get(groupName).push(pendingEntry);

      const registerForOther = (name) => {
        if (name === meshName || pendingEntry.registeredOthers.has(name)) {
          return Promise.resolve();
        }
        pendingEntry.registeredOthers.add(name);
        return flock.onIntersect(meshName, name, {
          trigger,
          callback,
          applyToGroupOther: false,
        });
      };

      if (flock.scene) {
        const matching = flock.scene.meshes.filter((m) => flock._inGroup(m, groupName));
        const matchingNames = [...new Set(matching.map((m) => m.name))];
        return Promise.all(matchingNames.map((name) => registerForOther(name)));
      }

      return;
    }

    return new Promise((resolve) => {
      flock.whenModelReady(meshName, async function (mesh) {
        if (!flock.requireMesh(mesh, { api: 'onIntersect', name: meshName })) {
          resolve();
          return;
        }

        flock.whenModelReady(otherMeshName, async function (otherMesh) {
          if (!flock.requireMesh(otherMesh, { api: 'onIntersect', name: otherMeshName })) {
            resolve();
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
            async function (evt) {
              const evtMesh = evt?.additionalData ?? evt?.mesh;
              if (evtMesh && evtMesh !== otherMesh) return;
              await callback(mesh.name, otherMesh.name);
            },
            new flock.BABYLON.PredicateCondition(flock.BABYLON.ActionManager, () =>
              otherMesh.isEnabled()
            )
          );

          mesh.actionManager.registerAction(action);

          const otherDisposeObserver = otherMesh.onDisposeObservable.addOnce(() => {
            mesh.actionManager?.unregisterAction(action);
          });

          mesh.onDisposeObservable.addOnce(() => {
            otherMesh.onDisposeObservable.remove(otherDisposeObserver);
          });

          resolve();
        });
      });
    });
  },
  isTouchingSurface(meshName) {
    const mesh = flock.scene.getMeshByName(meshName);
    if (mesh) {
      return flock.checkIfOnSurface(mesh);
    } else {
      console.log('Model not loaded (isTouchingSurface):', meshName);
      return false;
    }
  },
  checkIfOnSurface(mesh) {
    const B = flock.BABYLON;
    const scene = flock.scene;
    const plugin = scene.getPhysicsEngine()?.getPhysicsPlugin();
    if (!plugin || !mesh.physics) return false;

    // --- Velocity gate: if rising, you are NOT grounded, full stop. ---
    const v = mesh.physics.getLinearVelocity();
    if (v && v.y > 0.5) return false; // launching / ascending → never "on surface"

    mesh.computeWorldMatrix(true);
    const bb = mesh.getBoundingInfo().boundingBox;

    // Small probe, NOT the full collider width (a wide sphere clips nearby keys/walls).
    const radius = 0.12;
    mesh._surfaceProbe ??= new B.PhysicsShapeSphere(B.Vector3.Zero(), radius, scene);

    const start = bb.centerWorld.clone();
    start.y = bb.minimumWorld.y + radius + 0.02;
    const end = start.clone();
    end.y -= 0.12; // short sweep: ~12cm below feet, not 25

    const castResult = new B.ShapeCastResult();
    const hitResult = new B.ShapeCastResult();
    plugin.shapeCast(
      {
        shape: mesh._surfaceProbe,
        rotation: B.Quaternion.Identity(),
        startPosition: start,
        endPosition: end,
        shouldHitTriggers: false,
        ignoreBody: mesh.physics,
      },
      castResult,
      hitResult
    );

    if (!castResult.hasHit) return false;

    const n = hitResult.hitNormal;
    if (!n) return true;
    const dot = Math.min(Math.max(B.Vector3.Dot(n.normalizeToNew(), B.Vector3.UpReadOnly), -1), 1);
    return (Math.acos(dot) * 180) / Math.PI <= 50; // near-horizontal ground only
  },
  meshExists(name) {
    return !!(flock.scene && flock.scene.getMeshByName(name));
  },
  // Toggle Physics V2 debug shapes, resilient to scene/engine reloads & reruns.
  showPhysics(show = true) {
    const scene = flock?.scene;
    if (!scene) {
      console.warn('Scene not ready yet');
      return;
    }

    const engine = scene.getPhysicsEngine?.();
    if (!engine) {
      console.warn('Physics engine not enabled on this scene.');
      return;
    }

    const PhysicsViewerClass = flock.BABYLON?.Debug?.PhysicsViewer || flock.BABYLON?.PhysicsViewer;

    if (!PhysicsViewerClass) {
      console.warn('PhysicsViewer not available on BABYLON namespace.');
      return;
    }

    // If we have a viewer from an old scene/engine, tear it down.
    const sceneChanged = flock._physicsViewerScene && flock._physicsViewerScene !== scene;
    const engineChanged = flock._physicsViewerEngine && flock._physicsViewerEngine !== engine;

    if (sceneChanged || engineChanged) {
      try {
        flock.physicsViewer?.dispose?.();
      } catch (_) {
        console.warn('Suppressed non-critical error:', _);
      }
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
        } catch (_) {
          console.warn('Suppressed non-critical error:', _);
        }
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

      if (typeof engine.getBodies === 'function') {
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
          } catch (_) {
            console.warn('Suppressed non-critical error:', _);
          }
        }
      }
      flock.physicsViewerActive = true;
    } else {
      for (const body of bodies) {
        if (flock._physicsBodiesShown.has(body)) {
          try {
            flock.physicsViewer.hideBody(body);
          } catch (_) {
            console.warn('Suppressed non-critical error:', _);
          }
          flock._physicsBodiesShown.delete(body);
        }
      }
      flock.physicsViewerActive = false;

      // Optional: fully dispose to guarantee no leftovers between runs.
      // Comment these out if you prefer to keep the instance around.
      try {
        flock.physicsViewer?.dispose?.();
      } catch (_) {
        console.warn('Suppressed non-critical error:', _);
      }
      flock.physicsViewer = null;
      flock._physicsViewerScene = null;
      flock._physicsViewerEngine = null;
      flock._physicsBodiesShown?.clear?.();
      flock._physicsBodiesShown = null;
    }
  },
};
