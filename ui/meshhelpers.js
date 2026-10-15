import { flock } from '../flock.js';

// Where a click can place something: camera frames are skipped.
export const isPlacementSurface = (mesh) => mesh.isPickable && mesh.metadata?.shape !== 'camera';

export const SELECTED_HIDDEN_VISIBILITY = 0.001;

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
    parseFloat(vector.z.toFixed(decimals))
  );
}

const PICK_OK = (m) => m && m.isPickable !== false && m.metadata?.shape !== 'camera';

export function pickLeafFromRay(ray, scene) {
  const isSeen = (m) =>
    PICK_OK(m) && m.isEnabled() && m.isVisible && m.visibility > SELECTED_HIDDEN_VISIBILITY;
  return scene.pickWithRay(ray, isSeen)?.pickedMesh ?? null;
}
