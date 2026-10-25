import { isBodyAlive, teleportBodyToMesh } from './physics.js';

let flock;

function resolvePositionInputs(mesh, { x = 0, y = 0, z = 0, useY = true, meshName = '' } = {}) {
  const nextX = x ?? mesh.position.x;
  const nextY = y ?? mesh.position.y;
  const nextZ = z ?? mesh.position.z;

  return {
    x: nextX,
    y: nextY,
    z: nextZ,
    useY,
    isCamera: meshName === '__active_camera__',
  };
}

// Planes and cameras pivot at their centre (a camera's eye), exempt from the
// base-rule lift.
function usesCenterPivot(mesh) {
  const shape = mesh?.metadata?.shape;
  return shape === 'plane' || shape === 'camera' || shape === 'marker';
}

// setPivot in a DO moves the origin after the base rule placed the mesh.
// The base rule reads and places the position from before it ran, so
// editor edits match Play whatever order the DO runs it in.
function placementShift(mesh) {
  return mesh.metadata?.placementShift ?? { x: 0, y: 0, z: 0 };
}

function recordPlacementShift(mesh, before) {
  const after = mesh.getAbsolutePosition();
  const shift = placementShift(mesh);
  mesh.metadata = mesh.metadata || {};
  mesh.metadata.placementShift = {
    x: shift.x + after.x - before.x,
    y: shift.y + after.y - before.y,
    z: shift.z + after.z - before.z,
  };
}

// Baking the pivot moves the geometry's base relative to the origin.
function pivotBaseOffset(mesh, scaleY) {
  return (mesh.metadata?.pivotOffset?.y ?? 0) * scaleY;
}

function currentAnchorSettings(mesh) {
  return (
    mesh.metadata?.anchorSettings ??
    (usesCenterPivot(mesh)
      ? { x: 'CENTER', y: 'CENTER', z: 'CENTER' }
      : { x: 'CENTER', y: 'MIN', z: 'CENTER' })
  );
}

function axisKey(axis) {
  const normalized = String(axis ?? 'x').toLowerCase();
  return normalized.includes('y') ? 'y' : normalized.includes('z') ? 'z' : 'x';
}

// Skinned meshes bind vertices to bones in one orientation; mirroring
// the transform without re-targeting the skeleton would distort them.
function isSkinned(mesh) {
  return [mesh, ...(mesh.getChildMeshes?.() ?? [])].some((m) => m?.skeleton);
}

// Mirror in local space; children follow via the world matrix.
function negateAxis(mesh, key) {
  const hierarchy = [mesh, ...(mesh.getChildMeshes?.() ?? [])];
  mesh.scaling[key] *= -1;
  hierarchy.forEach((m) => {
    if (m?.getTotalVertices?.() > 0 && typeof m.flipFaces === 'function') m.flipFaces();
  });
  mesh.refreshBoundingInfo?.(true);
  // Recompute parent-first so descendants pick up the mirrored matrix.
  hierarchy.forEach((m) => m.computeWorldMatrix?.(true));
  // No updatePhysics: physics shapes use absolute extents, which mirroring
  // preserves. Re-sync any live bodies to the mirrored transforms instead.
  hierarchy.forEach((m) => {
    if (isBodyAlive(m?.physics)) teleportBodyToMesh(m);
  });
}

// Like Blender's mirror object, the plane follows the about object's own
// axes, so it turns with a rotated group; without one it uses world axes.
function mirrorPlane(about, key) {
  const B = flock.BABYLON;
  const normal = B.Vector3.Zero();
  normal[key] = 1;
  if (!about) return { normal, point: B.Vector3.Zero() };
  about.computeWorldMatrix(true);
  return {
    normal: B.Vector3.TransformNormal(normal, about.getWorldMatrix()).normalize(),
    point: hierarchyCentre(about),
  };
}

function applyReflectedWorld(target, world, { normal, point }) {
  const B = flock.BABYLON;
  const reflection = B.Matrix.Reflection(B.Plane.FromPositionAndNormal(point, normal));
  let local = world.multiply(reflection);
  if (target.parent) {
    target.parent.computeWorldMatrix(true);
    local = local.multiply(B.Matrix.Invert(target.parent.getWorldMatrix()));
  }
  const scaling = new B.Vector3();
  const rotation = new B.Quaternion();
  // Keep target's own scaling signs so a mirror stays negative on its axis.
  local.decompose(scaling, rotation, target.position, target, false);
  target.scaling.copyFrom(scaling);
  target.rotationQuaternion = rotation;
  target.computeWorldMatrix(true);
  if (isBodyAlive(target.physics)) teleportBodyToMesh(target);
}

function hierarchyCentre(mesh) {
  mesh.computeWorldMatrix(true);
  const { min, max } = mesh.getHierarchyBoundingVectors(true);
  return min.add(max).scale(0.5);
}

// Babylon names a cloned descendant by joining the names along its path.
function removeCounterpart(clone, sourceMesh, sourceNode) {
  const path = [];
  for (let node = sourceNode; node && node !== sourceMesh; node = node.parent) {
    path.unshift(node.name);
  }
  const cloneName = [clone.name, ...path].join('.');
  const counterpart = clone.getDescendants(false).find((node) => node.name === cloneName);
  if (counterpart) flock.disposeMesh(counterpart);
}

function isInGroup(mesh) {
  let ancestor = mesh?.parent;
  while (ancestor) {
    if (ancestor.metadata?.shapeType === 'Group') return true;
    ancestor = ancestor.parent;
  }
  return false;
}

function applyInWorldSpace(mesh, applyFn) {
  const parent = mesh.parent;
  if (parent) mesh.setParent(null);
  try {
    applyFn();
  } finally {
    if (parent) mesh.setParent(parent);
  }
}

function applyPositionWithCurrentBaseRule(
  mesh,
  { x = 0, y = 0, z = 0, useY = true, meshName = '' } = {}
) {
  const {
    x: nextX,
    y: nextY,
    z: nextZ,
    isCamera,
  } = resolvePositionInputs(mesh, {
    x,
    y,
    z,
    useY,
    meshName,
  });

  const shift = placementShift(mesh);
  mesh.position.set(nextX + shift.x, useY ? nextY + shift.y : mesh.position.y, nextZ + shift.z);

  if (useY && !isCamera && !usesCenterPivot(mesh) && typeof mesh.getBoundingInfo === 'function') {
    mesh.computeWorldMatrix(true);
    mesh.refreshBoundingInfo?.();

    // Meshes are created upright and any rotate_to block runs after
    // creation, so the base must be computed as if unrotated - otherwise a
    // position captured post-rotation (e.g. from a gizmo drag) gets applied
    // pre-rotation on replay and the object jumps when the rotate then
    // swings it around its pivot with no compensation. Group members follow
    // the same rule, so moving a mesh into or out of a group keeps its Y.
    const bi = mesh.getBoundingInfo();
    const localMinY = bi?.boundingBox?.minimum?.y;
    const scaleY = mesh.scaling?.y ?? 1;
    if (Number.isFinite(localMinY)) {
      const base = mesh.position.y + localMinY * scaleY + pivotBaseOffset(mesh, scaleY);
      const deltaY = nextY + shift.y - base;
      if (Math.abs(deltaY) > 1e-6) mesh.position.y += deltaY;
    }
  }

  mesh.computeWorldMatrix(true);

  return {
    x: mesh.position.x,
    y: mesh.position.y,
    z: mesh.position.z,
  };
}

function resizeMesh(
  mesh,
  {
    width = null,
    height = null,
    depth = null,
    xOrigin = 'CENTRE',
    yOrigin = 'BASE',
    zOrigin = 'CENTRE',
    maintainTextureScale = true,
  } = {}
) {
  mesh.metadata = mesh.metadata || {};

  if (!mesh.metadata.originalMin || !mesh.metadata.originalMax) {
    if (mesh.getTotalVertices() > 0) {
      const bi = mesh.getBoundingInfo();
      mesh.metadata.originalMin = bi.boundingBox.minimum.clone();
      mesh.metadata.originalMax = bi.boundingBox.maximum.clone();
    } else {
      // Empty container (e.g. a group): its size lives in its children.
      const { min, max } = flock.getHierarchyLocalBounds(mesh);
      mesh.metadata.originalMin = min.clone();
      mesh.metadata.originalMax = max.clone();
    }
  }

  const origMin = mesh.metadata.originalMin;
  const origMax = mesh.metadata.originalMax;
  const origWidth = origMax.x - origMin.x;
  const origHeight = origMax.y - origMin.y;
  const origDepth = origMax.z - origMin.z;

  const scaleX = origWidth && width !== null ? width / origWidth : 1;
  const scaleY = origHeight && height !== null ? height / origHeight : 1;
  const scaleZ = origDepth && depth !== null ? depth / origDepth : 1;

  const { min: oldMinWorld, max: oldMaxWorld } = flock.getEffectiveWorldBounds(mesh);

  const oldAnchor = new flock.BABYLON.Vector3(
    xOrigin === 'LEFT'
      ? oldMinWorld.x
      : xOrigin === 'RIGHT'
        ? oldMaxWorld.x
        : (oldMinWorld.x + oldMaxWorld.x) / 2,
    yOrigin === 'BASE'
      ? oldMinWorld.y
      : yOrigin === 'TOP'
        ? oldMaxWorld.y
        : (oldMinWorld.y + oldMaxWorld.y) / 2,
    zOrigin === 'FRONT'
      ? oldMinWorld.z
      : zOrigin === 'BACK'
        ? oldMaxWorld.z
        : (oldMinWorld.z + oldMaxWorld.z) / 2
  );

  mesh.scaling = new flock.BABYLON.Vector3(
    Math.max(0.01, scaleX),
    Math.max(0.01, scaleY),
    Math.max(0.01, scaleZ)
  );

  if (maintainTextureScale) flock.retileTextures(mesh);

  const { min: newMinWorld, max: newMaxWorld } = flock.getEffectiveWorldBounds(mesh);

  const newAnchor = new flock.BABYLON.Vector3(
    xOrigin === 'LEFT'
      ? newMinWorld.x
      : xOrigin === 'RIGHT'
        ? newMaxWorld.x
        : (newMinWorld.x + newMaxWorld.x) / 2,
    yOrigin === 'BASE'
      ? newMinWorld.y
      : yOrigin === 'TOP'
        ? newMaxWorld.y
        : (newMinWorld.y + newMaxWorld.y) / 2,
    zOrigin === 'FRONT'
      ? newMinWorld.z
      : zOrigin === 'BACK'
        ? newMaxWorld.z
        : (newMinWorld.z + newMaxWorld.z) / 2
  );

  const diff = newAnchor.subtract(oldAnchor);
  mesh.position.subtractInPlace(diff);

  flock.updatePhysics(mesh);
}

function hasTexture(mesh) {
  return [mesh, ...mesh.getChildMeshes(false)].some((part) => {
    const texName = part.material?.metadata?.texName;
    return texName && texName !== 'none.png';
  });
}

function isGroundLevel(y) {
  return y === '__ground__level__' || Number(y) === -999999;
}

async function placeAnchorAt(mesh, { x, y, z, useY = true }) {
  const current = flock._getAnchor(mesh);
  const target = {
    x: toFinite(x ?? current.x, current.x),
    y: current.y,
    z: toFinite(z ?? current.z, current.z),
  };
  if (useY && isGroundLevel(y)) {
    await flock.waitForGroundReady();
    target.y = flock.getGroundLevelAt(target.x, target.z);
  } else if (useY) {
    target.y = toFinite(y ?? current.y, current.y);
  }
  moveAnchorTo(mesh, target);
}

function moveAnchorTo(mesh, target) {
  applyInWorldSpace(mesh, () => {
    const anchor = flock._getAnchor(mesh);
    mesh.position.x += target.x - anchor.x;
    mesh.position.y += target.y - anchor.y;
    mesh.position.z += target.z - anchor.z;
    mesh.computeWorldMatrix(true);
  });
}

// Flock models face local -z, so their own left is local +x.
const SIDES = {
  center: null,
  on_top: [1, 1],
  under: [1, -1],
  left: [0, 1],
  right: [0, -1],
  front: [2, -1],
  behind: [2, 1],
};

function worldHalfAxes(mesh) {
  mesh.computeWorldMatrix(true);
  const box = mesh.getBoundingInfo().boundingBox;
  const { Vector3 } = flock.BABYLON;
  return {
    centre: box.centerWorld.clone(),
    halfAxes: [
      new Vector3(box.extendSize.x, 0, 0),
      new Vector3(0, box.extendSize.y, 0),
      new Vector3(0, 0, box.extendSize.z),
    ].map((v) => Vector3.TransformNormal(v, mesh.getWorldMatrix())),
  };
}

function reachAlong(box, direction) {
  return box.halfAxes.reduce(
    (sum, v) => sum + Math.abs(flock.BABYLON.Vector3.Dot(v, direction)),
    0
  );
}

// Sides follow the target's own axes; the mover keeps its rotation and its box
// touches that face, centred on it, with the pivots level along the target's
// up axis for the horizontal sides. Center lines up the two box centres.
function besideAnchor(mesh, target, side, gap = 0) {
  const { Vector3 } = flock.BABYLON;
  const to = worldHalfAxes(target);
  const from = worldHalfAxes(mesh);
  let goal = to.centre;
  let level = false;
  if (SIDES[side]) {
    const [axisIndex, sign] = SIDES[side];
    const halfAxis = to.halfAxes[axisIndex];
    const normal = halfAxis.normalizeToNew().scale(sign);
    goal = goal.add(normal.scale(halfAxis.length() + reachAlong(from, normal) + gap));
    level = axisIndex !== 1;
  }
  const anchor = flock._getAnchor(mesh);
  let result = new Vector3(anchor.x, anchor.y, anchor.z).add(goal.subtract(from.centre));
  if (level) {
    const up = to.halfAxes[1].normalizeToNew();
    const pivot = flock._getAnchor(target);
    const rise = Vector3.Dot(new Vector3(pivot.x, pivot.y, pivot.z).subtract(result), up);
    result = result.add(up.scale(rise));
  }
  return { x: result.x, y: result.y, z: result.z };
}

function nearAnchor(mesh, target, gap = 0) {
  const { Vector3 } = flock.BABYLON;
  const to = worldHalfAxes(target);
  const from = worldHalfAxes(mesh);
  let direction = to.centre.subtract(from.centre);
  direction.y = 0;
  if (direction.length() < 1e-6) direction = new Vector3(0, 0, 1);
  direction.normalize();
  const goal = to.centre.subtract(
    direction.scale(reachAlong(to, direction) + reachAlong(from, direction) + gap)
  );
  const anchor = flock._getAnchor(mesh);
  return {
    x: anchor.x + goal.x - from.centre.x,
    y: flock._getAnchor(target).y,
    z: anchor.z + goal.z - from.centre.z,
  };
}

function positionXYZ(position) {
  const [x, y, z] = Array.isArray(position)
    ? position
    : [position?.x ?? 0, position?.y ?? 0, position?.z ?? 0];
  return { x: toFinite(x), y: isGroundLevel(y) ? y : toFinite(y), z: toFinite(z) };
}

export function setFlockReference(ref) {
  flock = ref;
}

// Coerce a value to a finite number, or return the fallback.
function toFinite(v, fallback = 0) {
  const n = Number(v);
  return Number.isFinite(n) ? n : fallback;
}

// Exactly ±90° pitch makes a camera's look-at up vector degenerate; screen
// roll then depends on platform libm rounding and can render upside down.
function clampCameraPitchDegrees(x) {
  const wrapped = (((x % 360) + 540) % 360) - 180;
  if (Math.abs(Math.abs(wrapped) - 90) < 0.05) {
    return Math.sign(wrapped) * (Math.abs(wrapped) > 90 ? 90.05 : 89.95);
  }
  return x;
}

export const flockTransform = {
  // Blocks speak Euler degrees, the engine speaks quaternions; the quaternion
  // is the source of truth — writing mesh.rotation nulls it.
  eulerDegreesToQuat(x = 0, y = 0, z = 0) {
    return flock.BABYLON.Quaternion.RotationYawPitchRoll(
      flock.BABYLON.Tools.ToRadians(y),
      flock.BABYLON.Tools.ToRadians(x),
      flock.BABYLON.Tools.ToRadians(z)
    ).normalize();
  },
  quatToEulerDegrees(quat) {
    const euler = quat.toEulerAngles();
    return {
      x: flock.BABYLON.Tools.ToDegrees(euler.x),
      y: flock.BABYLON.Tools.ToDegrees(euler.y),
      z: flock.BABYLON.Tools.ToDegrees(euler.z),
    };
  },
  ensureQuaternion(target) {
    if (!target.rotationQuaternion) {
      target.rotationQuaternion = flock.BABYLON.Quaternion.FromEulerVector(
        target.rotation ?? flock.BABYLON.Vector3.Zero()
      );
    }
    return target.rotationQuaternion;
  },
  async setBlockPositionOnMesh(mesh, { x = 0, y = 0, z = 0, useY = true, meshName = '' } = {}) {
    if (!mesh) return;

    let nextY = y;
    const groundLevelSentinel = -999999;
    const numericY = typeof nextY === 'string' ? Number(nextY) : nextY;
    if (nextY === '__ground__level__' || numericY === groundLevelSentinel) {
      await flock.waitForGroundReady();
      nextY = flock.getGroundLevelAt(x, z);
    }

    applyInWorldSpace(mesh, () => {
      applyPositionWithCurrentBaseRule(mesh, {
        x,
        y: nextY,
        z,
        useY,
        meshName: meshName || mesh.name || '',
      });
    });
  },
  positionAt(meshName, options) {
    return flock._positionMeshAt(meshName, options, { byAnchor: true });
  },
  _applyInitialTransform(mesh, { position = null, rotation = null, size = null } = {}) {
    if (size) {
      resizeMesh(mesh, {
        width: size.width ?? null,
        height: size.height ?? null,
        depth: size.depth ?? null,
      });
    }
    if (rotation) {
      mesh.rotationQuaternion = flock.eulerDegreesToQuat(
        toFinite(rotation.x),
        toFinite(rotation.y),
        toFinite(rotation.z)
      );
      mesh.computeWorldMatrix(true);
    }
    if (position) {
      const { x, y, z } = positionXYZ(position);
      const onGround = isGroundLevel(y);
      moveAnchorTo(mesh, { x, y: onGround ? flock.getGroundLevelAt(x, z) : y, z });
      if (onGround && !flock.ground) {
        flock.waitForGroundReady().then(() => {
          if (mesh.isDisposed()) return;
          moveAnchorTo(mesh, { x, y: flock.getGroundLevelAt(x, z), z });
          teleportBodyToMesh(mesh);
        });
      }
    }
    if (isBodyAlive(mesh.physics)) teleportBodyToMesh(mesh);
  },
  // Where the anchor would sit if the mesh were placed the old way (unrotated
  // base, or origin, at position, then a DO resize and rotate_to), without
  // moving it.
  _legacyInitialAnchor(mesh, { position, placeByOrigin = false, rotation = null, size = null }) {
    const parent = mesh.parent;
    if (parent) mesh.setParent(null);
    const saved = {
      position: mesh.position.clone(),
      rotationQuaternion: mesh.rotationQuaternion?.clone() ?? null,
      rotation: mesh.rotation.clone(),
      scaling: mesh.scaling.clone(),
    };
    try {
      mesh.rotationQuaternion = flock.BABYLON.Quaternion.Identity();
      if (size) mesh.scaling.set(1, 1, 1);
      mesh.computeWorldMatrix(true);
      if (placeByOrigin) mesh.position.set(position.x, position.y, position.z);
      else applyPositionWithCurrentBaseRule(mesh, { ...position, useY: true });
      mesh.computeWorldMatrix(true);
      if (size) resizeMesh(mesh, { ...size, maintainTextureScale: false });
      if (rotation) {
        mesh.rotationQuaternion = flock.eulerDegreesToQuat(
          toFinite(rotation.x),
          toFinite(rotation.y),
          toFinite(rotation.z)
        );
      }
      mesh.computeWorldMatrix(true);
      return flock._getAnchor(mesh);
    } finally {
      mesh.position.copyFrom(saved.position);
      mesh.rotation.copyFrom(saved.rotation);
      mesh.rotationQuaternion = saved.rotationQuaternion;
      mesh.scaling.copyFrom(saved.scaling);
      mesh.computeWorldMatrix(true);
      if (parent) mesh.setParent(parent);
    }
  },
  _positionAtBase(meshName, options) {
    return flock._positionMeshAt(meshName, options, { byAnchor: false });
  },
  _positionMeshAt(meshName, { x = 0, y = 0, z = 0, useY = true } = {}, { byAnchor }) {
    return new Promise((resolve) => {
      flock.whenModelReady(meshName, async (mesh) => {
        // The active camera is positioned by the rule below but is not a mesh.
        const isCamera = meshName === '__active_camera__';
        if (isCamera) {
          if (!mesh) {
            resolve();
            return;
          }
        } else if (!flock.requireMesh(mesh, { api: 'positionAt', name: meshName })) {
          resolve();
          return;
        }

        if (byAnchor && !isCamera && mesh.metadata?.shape !== 'camera') {
          await placeAnchorAt(mesh, { x, y, z, useY });
        } else {
          x = toFinite(x ?? mesh.position.x, mesh.position.x);
          z = toFinite(z ?? mesh.position.z, mesh.position.z);
          if (y !== '__ground__level__') {
            y = toFinite(y ?? mesh.position.y, mesh.position.y);
          }

          await this.setBlockPositionOnMesh(mesh, {
            x,
            y,
            z,
            useY,
            meshName,
          });
        }

        mesh.computeWorldMatrix(true);
        teleportBodyToMesh(mesh);

        resolve();
      });
    });
  },
  positionAtSingleCoordinate(meshName, coordinate_setting, value) {
    return new Promise((resolve) => {
      flock.whenModelReady(meshName, async (mesh) => {
        // Prevent positionAt call if mesh doesn't exist in the first place
        if (!flock.requireMesh(mesh, { api: 'positionAtSingleCoordinate', name: meshName })) {
          resolve();
          return;
        }

        switch (coordinate_setting) {
          case 'x_coordinate':
            await flock.positionAt(meshName, {
              x: value,
              y: null,
              z: null,
              useY: false,
            });
            break;

          case 'y_coordinate':
            await flock.positionAt(meshName, {
              x: null,
              y: value,
              z: null,
              useY: true,
            });
            break;

          case 'z_coordinate':
            await flock.positionAt(meshName, {
              x: null,
              y: null,
              z: value,
              useY: false,
            });
            break;
        }

        resolve();
      });
    });
  },
  moveTo(
    meshName,
    { target, useY = true, side = null, offsetX = 0, offsetY = 0, offsetZ = 0 } = {}
  ) {
    return new Promise((resolve) => {
      flock.whenModelReady(meshName, (mesh1) => {
        if (!flock.requireMesh(mesh1, { api: 'moveTo', name: meshName })) {
          resolve();
          return;
        }

        flock.whenModelReady(target, async (mesh2) => {
          if (!flock.requireMesh(mesh2, { api: 'moveTo', name: target })) {
            resolve();
            return;
          }

          try {
            const offset = flock._targetOffset(mesh2, { x: offsetX, y: offsetY, z: offsetZ });
            if (meshName === '__active_camera__' || mesh1.metadata?.shape === 'camera') {
              const targetAbsPosition = mesh2.getAbsolutePosition().add(offset);
              if (!useY) targetAbsPosition.y = mesh1.getAbsolutePosition().y;
              mesh1.setAbsolutePosition(targetAbsPosition);
            } else {
              const goal = flock._anchorGoal(mesh1, mesh2, side);
              await placeAnchorAt(mesh1, {
                x: goal.x + offset.x,
                y: goal.y + offset.y,
                z: goal.z + offset.z,
                useY,
              });
            }
            mesh1.computeWorldMatrix(true);
            teleportBodyToMesh(mesh1);

            resolve();
          } catch (error) {
            flock.reportBlockError({
              key: 'move_failed',
              api: 'moveTo',
              values: { object: meshName, target },
              error,
            });
            resolve();
          }
        });
      });
    });
  },
  moveByVector(meshName, { x = 0, y = 0, z = 0 } = {}) {
    x = toFinite(x);
    y = toFinite(y);
    z = toFinite(z);
    return new Promise((resolve) => {
      flock.whenModelReady(meshName, (mesh) => {
        if (!flock.requireMesh(mesh, { api: 'moveByVector', name: meshName })) {
          resolve();
          return;
        }

        try {
          mesh.position.addInPlace(new flock.BABYLON.Vector3(x, y, z));
          mesh.computeWorldMatrix(true);

          if (
            isBodyAlive(mesh.physics) &&
            mesh.physics.getMotionType() === flock.BABYLON.PhysicsMotionType.DYNAMIC
          ) {
            const velocity = mesh.physics.getLinearVelocity();
            velocity.y = 0;
            mesh.physics.setLinearVelocity(velocity);
          }
          teleportBodyToMesh(mesh);
          resolve();
        } catch (error) {
          flock.reportBlockError({
            key: 'move_failed',
            api: 'moveByVector',
            values: { object: meshName },
            error,
          });
          resolve();
        }
      });
    });
  },
  distanceTo(meshName1, meshName2) {
    const mesh1 = flock.scene?.getMeshByName(meshName1);
    const mesh2 = flock.scene?.getMeshByName(meshName2);

    // Infinity, not null: null < n is true, so a missing object would count as close.
    if (!mesh1 || !mesh2) {
      flock.reportBlockError({
        key: 'object_not_found',
        api: 'distanceTo',
        values: { object: mesh1 ? meshName2 : meshName1 },
      });
      return Infinity;
    }

    return flock.BABYLON.Vector3.Distance(mesh1.position, mesh2.position);
  },
  rotate(meshName, { x = 0, y = 0, z = 0 } = {}) {
    x = toFinite(x);
    y = toFinite(y);
    z = toFinite(z);
    return new Promise((resolve) => {
      flock.whenModelReady(meshName, (mesh) => {
        if (meshName === '__active_camera__') {
          const camera = flock.scene.activeCamera;
          if (!camera) {
            resolve();
            return;
          }

          if (camera.alpha !== undefined) {
            camera.alpha += flock.BABYLON.Tools.ToRadians(y);
            camera.beta += flock.BABYLON.Tools.ToRadians(x);
          } else if (camera.rotation !== undefined) {
            // Yaw about world up, pitch about the view's right axis; a
            // local-space multiply would roll a pitched camera.
            const current = camera.rotationQuaternion
              ? camera.rotationQuaternion.toEulerAngles()
              : camera.rotation;
            const targetQuat = flock.eulerDegreesToQuat(
              clampCameraPitchDegrees(flock.BABYLON.Tools.ToDegrees(current.x) + x),
              flock.BABYLON.Tools.ToDegrees(current.y) + y,
              flock.BABYLON.Tools.ToDegrees(current.z) + z
            );
            camera.rotationQuaternion = targetQuat;
            camera.rotation.copyFrom(targetQuat.toEulerAngles());
          }
          resolve();
          return;
        }

        if (!mesh) {
          flock.reportBlockError({
            key: 'object_not_found',
            api: 'rotate',
            values: { object: meshName },
          });
          resolve();
          return;
        }

        if (mesh.name === 'hemisphericLight') {
          const oldLightVector = mesh.direction;
          const xRadian = flock.BABYLON.Tools.ToRadians(x);
          const yRadian = flock.BABYLON.Tools.ToRadians(y);
          const zRadian = flock.BABYLON.Tools.ToRadians(z);
          const newLightVector = new flock.BABYLON.Vector3(xRadian, yRadian, zRadian);
          mesh.direction = oldLightVector.add(newLightVector);
          resolve();
          return;
        }

        if (!flock.requireMesh(mesh, { api: 'rotate', name: meshName })) {
          resolve();
          return;
        }

        const incrementalRotation = flock.eulerDegreesToQuat(x, y, z);
        flock.ensureQuaternion(mesh).multiplyInPlace(incrementalRotation).normalize();
        mesh.computeWorldMatrix(true);
        teleportBodyToMesh(mesh);
        resolve();
      });
    });
  },
  rotateTo(meshName, { x = 0, y = 0, z = 0, world = false } = {}) {
    x = toFinite(x);
    y = toFinite(y);
    z = toFinite(z);
    return new Promise((resolve) => {
      flock.whenModelReady(meshName, (mesh) => {
        if (meshName === '__active_camera__') {
          const camera = flock.scene.activeCamera;
          if (!camera) {
            resolve();
            return;
          }
          if (camera.alpha !== undefined) {
            camera.alpha = flock.BABYLON.Tools.ToRadians(y);
            camera.beta = flock.BABYLON.Tools.ToRadians(x);
          } else if (camera.rotation !== undefined) {
            const targetQuat = flock.eulerDegreesToQuat(clampCameraPitchDegrees(x), y, z);
            camera.rotationQuaternion = targetQuat;
            camera.rotation.copyFrom(targetQuat.toEulerAngles());
          }
          resolve();
          return;
        }
        if (!mesh) {
          flock.reportBlockError({
            key: 'object_not_found',
            api: 'rotateTo',
            values: { object: meshName },
          });
          resolve();
          return;
        }
        if (!(mesh instanceof flock.BABYLON.AbstractMesh) && mesh.name !== 'hemisphericLight') {
          flock.reportBlockError({
            key: 'target_not_a_mesh',
            api: 'rotateTo',
            values: { object: meshName },
          });
          resolve();
          return;
        }
        const applyRotation = () => {
          mesh.rotationQuaternion = flock.eulerDegreesToQuat(x, y, z);
        };
        if (world || isInGroup(mesh)) applyInWorldSpace(mesh, applyRotation);
        else applyRotation();
        mesh.computeWorldMatrix(true);

        if (mesh.name === 'hemisphericLight') {
          const xRadian = flock.BABYLON.Tools.ToRadians(x);
          const yRadian = flock.BABYLON.Tools.ToRadians(y);
          const zRadian = flock.BABYLON.Tools.ToRadians(z);
          mesh.direction = new flock.BABYLON.Vector3(xRadian, yRadian, zRadian);
        }

        teleportBodyToMesh(mesh);
        resolve();
      });
    });
  },
  async lookAt(meshName, { target, useY = false } = {}) {
    const [mesh1, mesh2] = await Promise.all([
      flock.whenModelReady(meshName),
      flock.whenModelReady(target),
    ]);
    // lookAt supports cameras too, so guard on presence, not mesh type.
    if (!mesh1 || !mesh2) {
      flock.reportBlockError({
        key: 'object_not_found',
        api: 'lookAt',
        values: { object: !mesh1 ? meshName : target },
      });
      return;
    }
    const scene = mesh1.getScene?.() ?? mesh2.getScene?.();
    if (!scene) return;

    // Camera special case: Babylon camera API already handles this well.
    if (meshName === '__active_camera__' && typeof mesh1.setTarget === 'function') {
      // Cameras expose globalPosition; meshes expose absolutePosition.
      const camPos = mesh1.globalPosition ?? mesh1.position;
      const tgtPos = (mesh2.absolutePosition ?? mesh2.globalPosition ?? mesh2.position).clone();
      if (!useY) tgtPos.y = mesh1.target?.y ?? camPos.y;
      mesh1.setTarget(tgtPos);
      await new Promise((resolve) => {
        const cb = () => {
          scene.onAfterRenderObservable.removeCallback(cb);
          resolve();
        };
        scene.onAfterRenderObservable.add(cb);
      });
      return;
    }

    // The general path rotates mesh1 to face mesh2's position; both must be
    // positional meshes (the active-camera turner is handled above).
    if (
      !flock.requireMesh(mesh1, { api: 'lookAt', name: meshName }) ||
      !flock.requireMesh(mesh2, { api: 'lookAt', name: target })
    ) {
      return;
    }

    const p1 = mesh1.absolutePosition;
    const p2 = mesh2.absolutePosition;
    const dir = p2.subtract(p1);
    if (!useY) dir.y = 0;
    if (dir.lengthSquared() === 0) return; // already at target horizontally
    dir.normalize();

    // RH turns local -Z toward the target, which is the front of Flock models.
    const up = flock.BABYLON.Axis.Y; // world up
    const q = flock.BABYLON.Quaternion.FromLookDirectionRH(dir, up);

    await this.rotateTo(meshName, { ...flock.quatToEulerDegrees(q), world: true });

    // The body teleport is already queued, so nothing needs waiting for. Resuming on
    // onAfterPhysicsObservable instead re-armed a calling loop mid-physics-phase, which
    // dragged the XR watch camera's follow out of step with the frame.
    if (mesh1.physics) return;

    // Wait one tick so transforms "stick" before returning.
    await new Promise((resolve) => {
      const cb = () => {
        scene.onAfterRenderObservable.removeCallback(cb);
        resolve();
      };
      scene.onAfterRenderObservable.add(cb);
    });
  },
  scale(
    meshName,
    { x = 1, y = 1, z = 1, xOrigin = 'CENTRE', yOrigin = 'BOTTOM', zOrigin = 'CENTRE' } = {}
  ) {
    const toScale = (v) => (Number.isFinite(Number(v)) ? Math.max(0.01, Number(v)) : 1);
    x = toScale(x);
    y = toScale(y);
    z = toScale(z);
    return new Promise((resolve) => {
      flock.whenModelReady(meshName, (mesh) => {
        if (!flock.requireMesh(mesh, { api: 'scale', name: meshName })) {
          resolve();
          return;
        }
        mesh.metadata = mesh.metadata || {};
        mesh.metadata.origin = { xOrigin, yOrigin, zOrigin };

        const boundingInfo = mesh.getBoundingInfo();
        const originalMinY = boundingInfo.boundingBox.minimumWorld.y;
        const originalMaxY = boundingInfo.boundingBox.maximumWorld.y;
        const originalMinX = boundingInfo.boundingBox.minimumWorld.x;
        const originalMaxX = boundingInfo.boundingBox.maximumWorld.x;
        const originalMinZ = boundingInfo.boundingBox.minimumWorld.z;
        const originalMaxZ = boundingInfo.boundingBox.maximumWorld.z;

        mesh.scaling = new flock.BABYLON.Vector3(x, y, z);

        mesh.refreshBoundingInfo(true);
        mesh.computeWorldMatrix(true);

        const newBoundingInfo = mesh.getBoundingInfo();
        const newMinY = newBoundingInfo.boundingBox.minimumWorld.y;
        const newMaxY = newBoundingInfo.boundingBox.maximumWorld.y;
        const newMinX = newBoundingInfo.boundingBox.minimumWorld.x;
        const newMaxX = newBoundingInfo.boundingBox.maximumWorld.x;
        const newMinZ = newBoundingInfo.boundingBox.minimumWorld.z;
        const newMaxZ = newBoundingInfo.boundingBox.maximumWorld.z;

        if (yOrigin === 'BASE') {
          const diffY = newMinY - originalMinY;
          mesh.position.y -= diffY;
        } else if (yOrigin === 'TOP') {
          const diffY = newMaxY - originalMaxY;
          mesh.position.y -= diffY;
        }

        if (xOrigin === 'LEFT') {
          const diffX = newMinX - originalMinX;
          mesh.position.x -= diffX;
        } else if (xOrigin === 'RIGHT') {
          const diffX = newMaxX - originalMaxX;
          mesh.position.x -= diffX;
        }

        if (zOrigin === 'FRONT') {
          const diffZ = newMinZ - originalMinZ;
          mesh.position.z -= diffZ;
        } else if (zOrigin === 'BACK') {
          const diffZ = newMaxZ - originalMaxZ;
          mesh.position.z -= diffZ;
        }

        mesh.refreshBoundingInfo(true);
        mesh.computeWorldMatrix(true);
        let physicsTarget = mesh;
        while (physicsTarget.parent && !physicsTarget.physics) {
          physicsTarget = physicsTarget.parent;
        }

        if (physicsTarget.physics && physicsTarget !== mesh) {
          flock.updatePhysics(mesh, physicsTarget);
        } else {
          flock.updatePhysics(mesh);
        }
        resolve();
      });
    });
  },
  flip(meshName, axis = 'x') {
    return new Promise((resolve) => {
      flock.whenModelReady(meshName, (mesh) => {
        if (!flock.requireMesh(mesh, { api: 'flip', name: meshName })) {
          resolve();
          return;
        }
        if (!isSkinned(mesh)) negateAxis(mesh, axisKey(axis));
        resolve();
      });
    });
  },
  mirror(
    sourceMeshName,
    {
      mirrorId,
      mirrorName = null,
      axis = 'x',
      aboutMeshName = null,
      blockKey = mirrorId,
      callback = null,
      then = null,
    } = {}
  ) {
    const key = axisKey(axis);
    return flock.cloneMesh({
      sourceMeshName,
      cloneId: mirrorId,
      cloneName: mirrorName,
      blockKey,
      callback,
      then,
      // Its own family, so the source's event handlers don't fire on it.
      family: mirrorName ?? mirrorId,
      // The source's own DO (e.g. rotate_to) would overwrite the reflection.
      inheritConstruction: false,
      transform: async (clone, sourceMesh) => {
        for (const node of [clone, ...clone.getDescendants(false)]) {
          delete node.metadata?.tags;
        }
        delete clone.metadata.cloneOf;
        if (isSkinned(sourceMesh)) {
          console.warn(`mirror: ${sourceMeshName} is an animated character, which can't be mirrored`);
          flock.disposeMesh(clone);
          return false;
        }

        const about = aboutMeshName ? await flock.whenModelReady(aboutMeshName) : null;
        if (clone.isDisposed()) return false;
        const plane = mirrorPlane(about, key);

        // Before mirroring: the recompute resets negative scaling.
        if (about && about !== sourceMesh && about.isDescendantOf(sourceMesh)) {
          removeCounterpart(clone, sourceMesh, about);
          flock.recomputeGroupGeometry(clone);
        }

        // flipFaces below would otherwise flip the source too.
        [clone, ...clone.getChildMeshes()].forEach((m) => {
          if (m.getTotalVertices?.() > 0) {
            m.makeGeometryUnique();
            m.metadata = { ...m.metadata, sharedGeometry: false };
          }
        });
        const world = clone.computeWorldMatrix(true).clone();
        negateAxis(clone, key);
        applyReflectedWorld(clone, world, plane);

        clone.metadata.mirror = {
          sourceBlockKey: sourceMesh.metadata?.blockKey ?? null,
          ...plane,
          aboutBlockKey: about?.metadata?.blockKey ?? null,
        };
        return true;
      },
    });
  },
  // Sets target's transform to from's reflected across a mirror's plane,
  // which pairs a mirror with its source in either direction.
  placeReflected(target, from, plane) {
    applyReflectedWorld(target, from.computeWorldMatrix(true), plane);
  },
  resize(
    meshName,
    {
      width = null,
      height = null,
      depth = null,
      xOrigin = 'CENTRE',
      yOrigin = 'BASE',
      zOrigin = 'CENTRE',
      maintainTextureScale = true,
    } = {}
  ) {
    return new Promise((resolve) => {
      flock.whenModelReady(meshName, (mesh) => {
        if (!flock.requireMesh(mesh, { api: 'resize', name: meshName })) {
          resolve();
          return;
        }
        if (maintainTextureScale && hasTexture(mesh)) flock._realiseLinked(mesh);
        resizeMesh(mesh, { width, height, depth, xOrigin, yOrigin, zOrigin, maintainTextureScale });
        resolve();
      });
    });
  },
  // The pivot is the mesh origin: the point it rotates about. Moving it
  // never moves the mesh or changes what positions mean.
  setPivot(meshName, { x = 'CENTER', y = 'CENTER', z = 'CENTER' } = {}) {
    return new Promise((resolve) => {
      flock.whenModelReady(meshName, (mesh) => {
        if (!mesh) {
          resolve();
          return;
        }

        mesh.computeWorldMatrix(true);
        mesh.refreshBoundingInfo();
        const box = mesh.getBoundingInfo().boundingBox;
        const pivotLocal = flock._resolveAnchorLocal(mesh, { x, y, z });
        const targetWorld = flock.BABYLON.Vector3.TransformCoordinates(
          pivotLocal,
          mesh.getWorldMatrix()
        );

        if (pivotLocal.lengthSquared() > 0) {
          const positionKind = flock.BABYLON.VertexBuffer.PositionKind;
          if (mesh.geometry && mesh.isVerticesDataPresent(positionKind)) {
            if (mesh.geometry.meshes.length > 1) mesh.makeGeometryUnique();
            const positions = mesh.getVerticesData(positionKind, true, true);
            for (let i = 0; i < positions.length; i += 3) {
              positions[i] -= pivotLocal.x;
              positions[i + 1] -= pivotLocal.y;
              positions[i + 2] -= pivotLocal.z;
            }
            mesh.setVerticesData(
              positionKind,
              positions,
              mesh.getVertexBuffer(positionKind).isUpdatable()
            );
            mesh.refreshBoundingInfo();
          } else {
            const { minimum, maximum } = box;
            mesh.setBoundingInfo(
              new flock.BABYLON.BoundingInfo(
                minimum.subtract(pivotLocal),
                maximum.subtract(pivotLocal)
              )
            );
          }
          mesh.getChildren(undefined, true).forEach((child) => {
            child.position?.subtractInPlace(pivotLocal);
          });
        }

        const before = mesh.getAbsolutePosition().clone();
        mesh.setAbsolutePosition(targetWorld);
        mesh.computeWorldMatrix(true);
        recordPlacementShift(mesh, before);
        flock.updatePhysics(mesh);
        teleportBodyToMesh(mesh);

        mesh.metadata = mesh.metadata || {};
        const offset = mesh.metadata.pivotOffset ?? { x: 0, y: 0, z: 0 };
        mesh.metadata.pivotOffset = {
          x: offset.x + pivotLocal.x,
          y: offset.y + pivotLocal.y,
          z: offset.z + pivotLocal.z,
        };
        resolve();
      });
    });
  },
  // The anchor is the point positions refer to, and that animated scaling
  // holds still. Setting it never moves the mesh.
  setAnchor(meshName, { x = 'CENTER', y = 'MIN', z = 'CENTER' } = {}) {
    return new Promise((resolve) => {
      flock.whenModelReady(meshName, (mesh) => {
        if (!mesh) {
          resolve();
          return;
        }

        mesh.metadata = mesh.metadata || {};
        mesh.metadata.anchorSettings = { x, y, z };
        resolve();
      });
    });
  },
  _resolveAnchorLocal(mesh, settings = currentAnchorSettings(mesh)) {
    const box = mesh.getBoundingInfo().boundingBox;
    const resolveAxis = (value, axis) => {
      switch (value) {
        case 'MIN':
          return box.minimum[axis];
        case 'MAX':
          return box.maximum[axis];
        default:
          return box.center[axis] + (typeof value === 'number' ? value : 0);
      }
    };
    return new flock.BABYLON.Vector3(
      resolveAxis(settings.x, 'x'),
      resolveAxis(settings.y, 'y'),
      resolveAxis(settings.z, 'z')
    );
  },
  getBlockPositionFromMesh(mesh) {
    if (!mesh) return { x: 0, y: 0, z: 0 };
    mesh.computeWorldMatrix?.(true);
    // Group members are read in world space (mesh.position is
    // parent-relative), matching setBlockPositionOnMesh, which unparents.
    const grouped = isInGroup(mesh);
    const worldPos = mesh.absolutePosition ?? mesh.position ?? { x: 0, y: 0, z: 0 };
    const shift = placementShift(mesh);
    if (usesCenterPivot(mesh)) {
      return {
        x: (worldPos.x ?? 0) - shift.x,
        y: (worldPos.y ?? 0) - shift.y,
        z: (worldPos.z ?? 0) - shift.z,
      };
    }
    mesh.refreshBoundingInfo?.();

    const bi = mesh.getBoundingInfo?.();

    // Base computed as if unrotated, matching how creation (initializeMesh)
    // applies it before any later rotate_to block runs - see
    // applyPositionWithCurrentBaseRule for why this must match.
    const pos = grouped ? worldPos : (mesh.position ?? { x: 0, y: 0, z: 0 });
    const localMinY = bi?.boundingBox?.minimum?.y;
    const scaleY = (grouped ? mesh.absoluteScaling?.y : mesh.scaling?.y) ?? 1;
    const posY = pos.y ?? 0;
    const baseRuleY = Number.isFinite(localMinY)
      ? posY + localMinY * scaleY + pivotBaseOffset(mesh, scaleY)
      : posY;

    return { x: (pos.x ?? 0) - shift.x, y: baseRuleY - shift.y, z: (pos.z ?? 0) - shift.z };
  },
  // Where mesh's anchor goes to sit at target, or against one of its sides.
  _anchorGoal(mesh, target, side = null, gap = 0) {
    gap = toFinite(gap);
    let goal;
    const boxed = mesh.getBoundingInfo?.() && target.getBoundingInfo?.();
    if (side === 'near' && boxed) return nearAnchor(mesh, target, gap);
    if (Object.hasOwn(SIDES, side) && boxed) {
      if (SIDES[side]) return besideAnchor(mesh, target, side, gap);
      goal = besideAnchor(mesh, target, side);
    } else {
      goal = flock._getAnchor(target);
    }
    if (!gap) return goal;
    const { Vector3 } = flock.BABYLON;
    const start = flock._getAnchor(mesh);
    const end = new Vector3(goal.x, goal.y, goal.z);
    const along = end.subtract(new Vector3(start.x, start.y, start.z));
    if (along.length() < 1e-6) return goal;
    const stop = end.subtract(along.normalize().scale(gap));
    return { x: stop.x, y: stop.y, z: stop.z };
  },
  _targetOffset(target, { x = 0, y = 0, z = 0 } = {}, space = 'local') {
    const offset = new flock.BABYLON.Vector3(toFinite(x), toFinite(y), toFinite(z));
    if (space === 'world' || offset.equals(flock.BABYLON.Vector3.Zero())) return offset;
    const rotation = new flock.BABYLON.Quaternion();
    target.computeWorldMatrix(true).decompose(undefined, rotation);
    return offset.applyRotationQuaternion(rotation);
  },
  _getAnchor(mesh) {
    if (!mesh) return null;

    // Cameras / anything without bounds: just use position
    if (!mesh.getBoundingInfo || !mesh.getBoundingInfo()) {
      return {
        x: mesh.position.x,
        y: mesh.position.y,
        z: mesh.position.z,
      };
    }

    mesh.computeWorldMatrix(true);
    const bb = mesh.getBoundingInfo().boundingBox;
    const minW = bb.minimumWorld;
    const maxW = bb.maximumWorld;

    const anchorSettings = currentAnchorSettings(mesh);
    let numericAnchorWorld;

    function resolveAxis(axisKey, setting) {
      const min = minW[axisKey];
      const max = maxW[axisKey];

      if (typeof setting === 'string') {
        switch (setting) {
          case 'MIN':
            return min;
          case 'MAX':
            return max;
          case 'CENTER':
          default:
            return (min + max) / 2;
        }
      }

      if (typeof setting === 'number') {
        numericAnchorWorld ??= flock.BABYLON.Vector3.TransformCoordinates(
          flock._resolveAnchorLocal(mesh, anchorSettings),
          mesh.getWorldMatrix()
        );
        return numericAnchorWorld[axisKey];
      }

      // Fallback to center
      return (min + max) / 2;
    }

    const x = resolveAxis('x', anchorSettings.x);
    const y = resolveAxis('y', anchorSettings.y);
    const z = resolveAxis('z', anchorSettings.z);

    return { x, y, z };
  },
};
