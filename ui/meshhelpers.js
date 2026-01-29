import { flock } from "../flock.js";

export function roundToOneDecimal(value) {
  return Math.round(value * 10) / 10;
}

export function getMeshRotationInDegrees(mesh) {
  let eulerRotation;

  if (mesh.rotationQuaternion) {
    eulerRotation = mesh.rotationQuaternion.toEulerAngles();
  } else if (mesh.rotation) {
    eulerRotation = mesh.rotation;
  } else {
    return { x: 0, y: 0, z: 0 };
  }

  return {
    x: roundToOneDecimal(flock.BABYLON.Tools.ToDegrees(eulerRotation.x)),
    y: roundToOneDecimal(flock.BABYLON.Tools.ToDegrees(eulerRotation.y)),
    z: roundToOneDecimal(flock.BABYLON.Tools.ToDegrees(eulerRotation.z)),
  };
}

export function roundVectorToFixed(vector, decimals) {
  return new vector.constructor(
    parseFloat(vector.x.toFixed(decimals)),
    parseFloat(vector.y.toFixed(decimals)),
    parseFloat(vector.z.toFixed(decimals)),
  );
}

const PICK_OK = (m) => m && m.isPickable !== false;

function isLeafMesh(m) {
  if (!m || m.isDisposed?.()) return false;
  const hasKids = (m.getChildren?.().length ?? 0) > 0;
  const hasGeom =
    typeof m.getTotalVertices === "function" && m.getTotalVertices() > 0;
  return !hasKids && hasGeom;
}

function isInSubtree(root, node) {
  if (!root || !node) return false;
  if (root === node) return true;
  for (let p = node.parent; p; p = p.parent) if (p === root) return true;
  return false;
}

export function pickLeafFromRay(ray, scene) {
  const leafFirst = scene.pickWithRay(ray, (m) => PICK_OK(m) && isLeafMesh(m));
  if (leafFirst?.pickedMesh) return leafFirst.pickedMesh;

  const primary = scene.pickWithRay(ray, PICK_OK);
  const parent = primary?.pickedMesh;
  if (!parent) return null;

  if (isLeafMesh(parent)) return parent;

  const maxDist = (primary.distance ?? Number.POSITIVE_INFINITY) + 1e-4;
  const ray2 = ray.clone();
  ray2.length = Math.min(ray.length ?? maxDist, maxDist);

  const hits =
    scene.multiPickWithRay(
      ray2,
      (m) => PICK_OK(m) && isLeafMesh(m) && isInSubtree(parent, m),
      false,
    ) || [];

  if (hits.length) {
    // ensure nearest leaf is chosen
    hits.sort((a, b) => a.distance - b.distance);
    return hits[0].pickedMesh;
  }

  // last resort: color the parent
  return parent;
}
