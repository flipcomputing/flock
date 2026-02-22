let flock;

export function setFlockReference(ref) {
  flock = ref;
}

function getDefaultPivotSettings() {
  return { x: "CENTER", y: "MIN", z: "CENTER" };
}

function normalizePivotSetting(setting, fallback = "CENTER") {
  if (typeof setting === "number" && Number.isFinite(setting)) return setting;
  if (typeof setting !== "string") return fallback;

  const upper = setting.toUpperCase();
  if (upper === "MIN" || upper === "CENTER" || upper === "MAX") return upper;
  return fallback;
}

function resolveAxisPivotLocal(mesh, axis, setting) {
  if (typeof setting === "number" && Number.isFinite(setting)) {
    return setting;
  }

  const bounds = mesh?.getBoundingInfo?.()?.boundingBox;
  if (!bounds) return 0;

  const ext = bounds.extendSize?.[axis];
  const half = Number.isFinite(ext) ? ext : 0;

  if (setting === "MIN") return -half;
  if (setting === "MAX") return half;
  return 0;
}

export const flockAnchorTransform = {
  getPivotSettings(mesh, fallback = getDefaultPivotSettings()) {
    const configured = mesh?.metadata?.pivotSettings || {};
    return {
      x: normalizePivotSetting(configured.x, fallback.x),
      y: normalizePivotSetting(configured.y, fallback.y),
      z: normalizePivotSetting(configured.z, fallback.z),
    };
  },

  getLocalAnchorOffset(mesh, pivotSettings = null) {
    if (!mesh) {
      return new flock.BABYLON.Vector3(0, 0, 0);
    }

    const resolved = pivotSettings || this.getPivotSettings(mesh);

    return new flock.BABYLON.Vector3(
      resolveAxisPivotLocal(mesh, "x", normalizePivotSetting(resolved.x, "CENTER")),
      resolveAxisPivotLocal(mesh, "y", normalizePivotSetting(resolved.y, "MIN")),
      resolveAxisPivotLocal(mesh, "z", normalizePivotSetting(resolved.z, "CENTER")),
    );
  },

  resolveWorldAnchor(mesh, pivotSettings = null) {
    if (!mesh) return null;

    if (!mesh.getBoundingInfo || !mesh.getBoundingInfo()) {
      const p = mesh.position || flock.BABYLON.Vector3.Zero();
      return { x: p.x, y: p.y, z: p.z };
    }

    mesh.computeWorldMatrix?.(true);

    const localAnchor = this.getLocalAnchorOffset(mesh, pivotSettings);
    const worldAnchor = flock.BABYLON.Vector3.TransformCoordinates(
      localAnchor,
      mesh.getWorldMatrix(),
    );

    return { x: worldAnchor.x, y: worldAnchor.y, z: worldAnchor.z };
  },

  setMeshByWorldAnchor(
    mesh,
    target,
    { useX = true, useY = true, useZ = true, pivotSettings = null } = {},
  ) {
    if (!mesh) return;

    const current = this.resolveWorldAnchor(mesh, pivotSettings);
    if (!current) return;

    const tx = useX ? target?.x : current.x;
    const ty = useY ? target?.y : current.y;
    const tz = useZ ? target?.z : current.z;

    const dx = Number.isFinite(tx) ? tx - current.x : 0;
    const dy = Number.isFinite(ty) ? ty - current.y : 0;
    const dz = Number.isFinite(tz) ? tz - current.z : 0;

    if (dx !== 0 || dy !== 0 || dz !== 0) {
      mesh.position.addInPlace(new flock.BABYLON.Vector3(dx, dy, dz));
      mesh.computeWorldMatrix?.(true);
    }

    return {
      x: current.x + dx,
      y: current.y + dy,
      z: current.z + dz,
    };
  },
};
