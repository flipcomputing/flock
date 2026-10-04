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
  return shape === 'plane' || shape === 'camera';
}

function currentAnchorSettings(mesh) {
  return (
    mesh.metadata?.pivotSettings ??
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

  mesh.position.set(nextX, useY ? nextY : mesh.position.y, nextZ);

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
      const deltaY = nextY - (mesh.position.y + localMinY * scaleY);
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
  positionAt(meshName, { x = 0, y = 0, z = 0, useY = true } = {}) {
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

        mesh.computeWorldMatrix(true);
        teleportBodyToMesh(mesh);

        resolve();
      });
    });
  },
  positionAtSingleCoordinate(meshName, coordinate_setting, value) {
    return new Promise((resolve) => {
      flock.whenModelReady(meshName, (mesh) => {
        // Prevent positionAt call if mesh doesn't exist in the first place
        if (!flock.requireMesh(mesh, { api: 'positionAtSingleCoordinate', name: meshName })) {
          resolve();
          return;
        }

        switch (coordinate_setting) {
          case 'x_coordinate':
            flock.positionAt(meshName, {
              x: value,
              y: null,
              z: null,
              useY: false,
            });
            break;

          case 'y_coordinate':
            flock.positionAt(meshName, {
              x: null,
              y: value,
              z: null,
              useY: true,
            });
            break;

          case 'z_coordinate':
            flock.positionAt(meshName, {
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
  moveTo(meshName, { target, useY = true } = {}) {
    return new Promise((resolve) => {
      flock.whenModelReady(meshName, (mesh1) => {
        if (!flock.requireMesh(mesh1, { api: 'moveTo', name: meshName })) {
          resolve();
          return;
        }

        flock.whenModelReady(target, (mesh2) => {
          if (!flock.requireMesh(mesh2, { api: 'moveTo', name: target })) {
            resolve();
            return;
          }

          try {
            const targetAbsPosition = mesh2.getAbsolutePosition().clone();
            if (!useY) {
              targetAbsPosition.y = mesh1.getAbsolutePosition().y;
            }

            mesh1.setAbsolutePosition(targetAbsPosition);
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
    try {
      const mesh1 = flock.scene.getMeshByName(meshName1);
      const mesh2 = flock.scene.getMeshByName(meshName2);

      if (!mesh1) {
        throw new Error(`First mesh '${meshName1}' not found`);
      }

      if (!mesh2) {
        throw new Error(`Second mesh '${meshName2}' not found`);
      }

      const distance = flock.BABYLON.Vector3.Distance(mesh1.position, mesh2.position);

      return distance;
    } catch (error) {
      throw new Error(
        `Failed to calculate distance between '${meshName1}' and '${meshName2}': ${error.message}`
      );
    }
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

    // Babylon is left-handed; FromLookDirectionLH expects a forward (toward target) and up.
    const up = flock.BABYLON.Axis.Y; // world up
    const q = flock.BABYLON.Quaternion.FromLookDirectionLH(dir, up);

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
    x = Number.isFinite(Number(x)) && Number(x) >= 0 ? Number(x) : 1;
    y = Number.isFinite(Number(y)) && Number(y) >= 0 ? Number(y) : 1;
    z = Number.isFinite(Number(z)) && Number(z) >= 0 ? Number(z) : 1;
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
          Math.max(0.01, Math.abs(scaleX)),
          Math.max(0.01, Math.abs(scaleY)),
          Math.max(0.01, Math.abs(scaleZ))
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
        resolve();
      });
    });
  },
  setAnchor(meshName, { xPivot = 'CENTER', yPivot = 'MIN', zPivot = 'CENTER' } = {}) {
    return new Promise((resolve) => {
      flock.whenModelReady(meshName, (mesh) => {
        if (!mesh) {
          resolve();
          return;
        }

        mesh.computeWorldMatrix(true);
        mesh.refreshBoundingInfo();
        const box = mesh.getBoundingInfo().boundingBox;
        const oldAnchorWorld = flock.BABYLON.Vector3.TransformCoordinates(
          flock._resolveAnchorLocal(mesh),
          mesh.getWorldMatrix()
        );
        const anchorLocal = flock._resolveAnchorLocal(mesh, { x: xPivot, y: yPivot, z: zPivot });

        if (anchorLocal.lengthSquared() > 0) {
          const positionKind = flock.BABYLON.VertexBuffer.PositionKind;
          if (mesh.geometry && mesh.isVerticesDataPresent(positionKind)) {
            if (mesh.geometry.meshes.length > 1) mesh.makeGeometryUnique();
            const positions = mesh.getVerticesData(positionKind, true, true);
            for (let i = 0; i < positions.length; i += 3) {
              positions[i] -= anchorLocal.x;
              positions[i + 1] -= anchorLocal.y;
              positions[i + 2] -= anchorLocal.z;
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
                minimum.subtract(anchorLocal),
                maximum.subtract(anchorLocal)
              )
            );
          }
          mesh.getChildren(undefined, true).forEach((child) => {
            child.position?.subtractInPlace(anchorLocal);
          });
        }

        mesh.setAbsolutePosition(oldAnchorWorld);
        mesh.computeWorldMatrix(true);
        flock.updatePhysics(mesh);
        teleportBodyToMesh(mesh);

        mesh.metadata = mesh.metadata || {};
        mesh.metadata.pivotSettings = { x: xPivot, y: yPivot, z: zPivot };
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
    if (usesCenterPivot(mesh)) {
      return { x: worldPos.x ?? 0, y: worldPos.y ?? 0, z: worldPos.z ?? 0 };
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
    const baseRuleY = Number.isFinite(localMinY) ? posY + localMinY * scaleY : posY;

    return { x: pos.x ?? 0, y: baseRuleY, z: pos.z ?? 0 };
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

    const pivotSettings = currentAnchorSettings(mesh);
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
          flock._resolveAnchorLocal(mesh, pivotSettings),
          mesh.getWorldMatrix()
        );
        return numericAnchorWorld[axisKey];
      }

      // Fallback to center
      return (min + max) / 2;
    }

    const x = resolveAxis('x', pivotSettings.x);
    const y = resolveAxis('y', pivotSettings.y);
    const z = resolveAxis('z', pivotSettings.z);

    return { x, y, z };
  },
};
