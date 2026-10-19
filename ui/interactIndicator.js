import {
  MeshBuilder,
  StandardMaterial,
  DynamicTexture,
  Color3,
  Vector3,
  Matrix,
  Mesh,
  ActionManager,
  Ray,
  VertexBuffer,
} from '@babylonjs/core';
import { hideFromInspector } from './inspectorVisibility.js';

const ICON_MESH_NAME = '__flock_interact_indicator';
const ICON_SIZE_PX = 24;
const TEX_SIZE = 128;
const MAX_RANGE = 4;
const MAX_RANGE_FREE_CAMERA = 12;
const MAX_HALF_ANGLE = Math.PI / 4; // 45 degrees
const BAND_FRACTION = 0.08;
const PARTS_REFRESH_FRAMES = 30;
const _COS_MAX_HALF_ANGLE = Math.cos(MAX_HALF_ANGLE);

// Module-level local axis constants (no per-frame allocation).
const _LOCAL_FORWARD = new Vector3(0, 0, 1);
const _LOCAL_RIGHT = new Vector3(1, 0, 0);
const _LOCAL_UP = new Vector3(0, 1, 0);

const _SUPPORT_DIRS = [];
for (let x = -1; x <= 1; x++) {
  for (let y = -1; y <= 1; y++) {
    for (let z = -1; z <= 1; z++) {
      if (x || y || z) _SUPPORT_DIRS.push(new Vector3(x, y, z).normalize());
    }
  }
}
const _supportCache = new WeakMap();
const _boneMat = new Matrix();
const _skinMat = new Matrix();

let _enabled = true;
let _icon = null;
let _texture = null;
let _observer = null;
let _currentTarget = null;
let _actionCallback = null;
let _actionObserver = null;
let _actionUpCallback = null;
let _actionUpObserver = null;
let _pressedTarget = null;
let _inputManager = null;

const _interactListeners = [];
export const onInteractObservable = {
  add(cb) {
    _interactListeners.push(cb);
  },
  remove(cb) {
    const i = _interactListeners.indexOf(cb);
    if (i >= 0) _interactListeners.splice(i, 1);
  },
};

// Single Ray allocated on attach, reused across frames.
let _ray = null;
// Second Ray for line-of-sight occlusion check.
let _losRay = null;
// Scratch vectors reused across frames — no per-frame allocation in targeting path.
let _cameraForward = null;
let _cameraRight = null;
let _cameraUp = null;
let _worldPt = null;
let _partsOwner = null;
let _parts = null;
let _partsAge = 0;
let _toMesh = null;
let _closestPt = null;
// Pre-allocated candidate array — cleared each frame.
let _candidates = null;
// Predicate allocated once; captures module variables by reference.
let _predicate = null;
// LOS predicate — all visible, pickable meshes (not just interactables).
let _losPredicate = null;
// Player mesh updated each frame without allocation.
let _playerMesh = null;

// Resolved once the SVG image element is loaded — reused across attach cycles.
let _imgPromise = null;

function _loadSvg() {
  if (_imgPromise) return _imgPromise;
  _imgPromise = new Promise((resolve) => {
    if (typeof document === 'undefined') {
      resolve(null);
      return;
    }
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => resolve(null);
    img.src = new URL('../assets/interaction-indicator.svg', import.meta.url).href;
  });
  return _imgPromise;
}

// Kick off SVG loading at module init so it's ready by first attach.
_loadSvg();

// Writes the closest point on mesh's world AABB to point `p` into `result`.
function _closestPointOnBBToRef(mesh, p, result) {
  const bb = mesh.getBoundingInfo().boundingBox;
  result.x = Math.max(bb.minimumWorld.x, Math.min(p.x, bb.maximumWorld.x));
  result.y = Math.max(bb.minimumWorld.y, Math.min(p.y, bb.maximumWorld.y));
  result.z = Math.max(bb.minimumWorld.z, Math.min(p.z, bb.maximumWorld.z));
}

function _isSayPlane(mesh) {
  return (
    !!mesh.metadata?.isTextPlane || (mesh.name === 'textPlane' && mesh.metadata?.sayTarget != null)
  );
}

function _extremePoints(positions, vertexOffsets) {
  const n = _SUPPORT_DIRS.length;
  const best = new Float64Array(n).fill(-Infinity);
  const bestIdx = new Int32Array(n);
  const count = vertexOffsets ? vertexOffsets.length : positions.length / 3;
  for (let v = 0; v < count; v++) {
    const i = vertexOffsets ? vertexOffsets[v] : v * 3;
    const x = positions[i];
    const y = positions[i + 1];
    const z = positions[i + 2];
    for (let d = 0; d < n; d++) {
      const dir = _SUPPORT_DIRS[d];
      const dot = x * dir.x + y * dir.y + z * dir.z;
      if (dot > best[d]) {
        best[d] = dot;
        bestIdx[d] = i;
      }
    }
  }

  const unique = [...new Set(bestIdx)];
  const points = new Float32Array(unique.length * 3);
  unique.forEach((idx, k) => {
    points[k * 3] = positions[idx];
    points[k * 3 + 1] = positions[idx + 1];
    points[k * 3 + 2] = positions[idx + 2];
  });
  return points;
}

function _boneGroups(positions, indices, weights) {
  const byBone = new Map();
  for (let v = 0; v < positions.length / 3; v++) {
    let bestW = -1;
    let bone = 0;
    for (let k = 0; k < 4; k++) {
      const w = weights[v * 4 + k];
      if (w > bestW) {
        bestW = w;
        bone = indices[v * 4 + k];
      }
    }
    let offsets = byBone.get(bone);
    if (!offsets) byBone.set(bone, (offsets = []));
    offsets.push(v * 3);
  }
  const groups = [];
  for (const [bone, offsets] of byBone) {
    groups.push({ bone, points: _extremePoints(positions, offsets) });
  }
  return groups;
}

function _supportData(mesh) {
  const source = mesh.sourceMesh ?? mesh;
  const buffer = source.getVertexBuffer?.(VertexBuffer.PositionKind);
  if (!buffer) return null;
  const cached = _supportCache.get(buffer);
  if (cached) return cached;
  const positions = source.getVerticesData(VertexBuffer.PositionKind);
  if (!positions || positions.length < 3) return null;

  const indices = source.skeleton && source.getVerticesData(VertexBuffer.MatricesIndicesKind);
  const weights = source.skeleton && source.getVerticesData(VertexBuffer.MatricesWeightsKind);
  const data =
    indices && weights
      ? { groups: _boneGroups(positions, indices, weights) }
      : { points: _extremePoints(positions, null) };
  _supportCache.set(buffer, data);
  return data;
}

const _piece = { minR: 0, minU: 0, maxU: 0 };
const _extents = {
  minR: 0,
  minU: 0,
  maxU: 0,
  minF: 0,
  maxF: 0,
  bandLo: 0,
  bandHi: 0,
  bandMinR: 0,
};

function _placementOwner(target) {
  let node = target;
  while (node) {
    if (_hasRealPickTrigger(node)) return node;
    node = node.parent;
  }
  return target;
}

function _isPlacementCandidate(m) {
  return m !== _icon && !_isSayPlane(m) && m.getTotalVertices?.() > 0;
}

function _isShown(m) {
  return m.isVisible && m.visibility > 0 && m.isEnabled?.() !== false;
}

function _placementParts(owner) {
  if (owner === _partsOwner && ++_partsAge < PARTS_REFRESH_FRAMES) return _parts;
  _partsOwner = owner;
  _partsAge = 0;
  _parts = [owner, ...owner.getChildMeshes(false)].filter(_isPlacementCandidate);
  return _parts;
}

function _addExtentPoint(p, result) {
  const r = Vector3.Dot(p, _cameraRight);
  const u = Vector3.Dot(p, _cameraUp);
  const f = Vector3.Dot(p, _cameraForward);
  if (r < result.minR) result.minR = r;
  if (u < result.minU) result.minU = u;
  if (u > result.maxU) result.maxU = u;
  if (f < result.minF) result.minF = f;
  if (f > result.maxF) result.maxF = f;
  if (r < _piece.minR) _piece.minR = r;
  if (u < _piece.minU) _piece.minU = u;
  if (u > _piece.maxU) _piece.maxU = u;
}

function _beginPiece() {
  _piece.minR = Infinity;
  _piece.minU = Infinity;
  _piece.maxU = -Infinity;
}

function _endPiece(result) {
  if (_piece.maxU >= result.bandLo && _piece.minU <= result.bandHi) {
    if (_piece.minR < result.bandMinR) result.bandMinR = _piece.minR;
  }
}

function _addPointsExtents(points, matrix, result) {
  _beginPiece();
  for (let i = 0; i < points.length; i += 3) {
    Vector3.TransformCoordinatesFromFloatsToRef(
      points[i],
      points[i + 1],
      points[i + 2],
      matrix,
      _worldPt
    );
    _addExtentPoint(_worldPt, result);
  }
  _endPiece(result);
}

function _addMeshExtents(mesh, result) {
  const data = _supportData(mesh);
  const world = mesh.getWorldMatrix();
  const source = mesh.sourceMesh ?? mesh;
  const boneMatrices = data?.groups ? source.skeleton?.getTransformMatrices(source) : null;
  if (data?.groups && boneMatrices) {
    for (const group of data.groups) {
      if ((group.bone + 1) * 16 > boneMatrices.length) continue;
      Matrix.FromArrayToRef(boneMatrices, group.bone * 16, _boneMat);
      _boneMat.multiplyToRef(world, _skinMat);
      _addPointsExtents(group.points, _skinMat, result);
    }
  } else if (data?.points) {
    _addPointsExtents(data.points, world, result);
  } else {
    _beginPiece();
    for (const corner of mesh.getBoundingInfo().boundingBox.vectorsWorld) {
      _addExtentPoint(corner, result);
    }
    _endPiece(result);
  }
}

function _accumulateExtents(owner, result) {
  result.minR = Infinity;
  result.minU = Infinity;
  result.maxU = -Infinity;
  result.minF = Infinity;
  result.maxF = -Infinity;
  result.bandMinR = Infinity;

  let shown = 0;
  for (const part of _placementParts(owner)) {
    if (!_isShown(part)) continue;
    _addMeshExtents(part, result);
    shown++;
  }
  if (shown === 0) _addMeshExtents(owner, result);
}

function _iconSizeAt(f, camF, sizeScale) {
  return sizeScale * Math.max(f - camF, 0);
}

function _geometryExtentsToRef(owner, result, camF, sizeScale) {
  result.bandLo = Infinity;
  result.bandHi = -Infinity;
  _accumulateExtents(owner, result);

  const midU = (result.minU + result.maxU) * 0.5;
  const midF = (result.minF + result.maxF) * 0.5;
  const halfBand = Math.max(
    _iconSizeAt(midF, camF, sizeScale) * 0.5,
    (result.maxU - result.minU) * BAND_FRACTION
  );
  result.bandLo = midU - halfBand;
  result.bandHi = midU + halfBand;
  _accumulateExtents(owner, result);
  if (result.bandMinR === Infinity) result.bandMinR = result.minR;
}

function _isDescendantOf(mesh, ancestor) {
  let node = mesh.parent;
  while (node) {
    if (node === ancestor) return true;
    node = node.parent;
  }
  return false;
}

// Forwarder actions (group shells passing clicks through to members) are
// pick triggers technically, but the shell itself isn't interactable.
function _hasRealPickTrigger(mesh) {
  const manager = mesh?.actionManager;
  if (!manager?.hasPickTriggers) return false;
  for (const action of manager.actions || []) {
    if (!action || action._flockForwarder) continue;
    if (
      action.trigger === ActionManager.OnPickTrigger ||
      action.trigger === ActionManager.OnPickDownTrigger ||
      action.trigger === ActionManager.OnPickUpTrigger
    ) {
      return true;
    }
  }
  return false;
}

export function attachInteractIndicator(scene, inputManager) {
  // Already attached with a live icon — nothing to do.
  if (_icon && !_icon.isDisposed()) return;
  // Stale singleton state: the icon mesh was disposed externally (e.g. a scene
  // teardown that bypassed detachInteractIndicator) but the module still holds
  // references and a registered observer. Reset fully before re-creating so we
  // don't leak the old observer or wedge on the dangling _icon guard.
  if (_icon) detachInteractIndicator();

  // Each scene starts with the indicator on; the sensing block toggles it.
  _enabled = true;

  _icon = MeshBuilder.CreatePlane(ICON_MESH_NAME, { size: 1 }, scene);
  _icon.billboardMode = Mesh.BILLBOARDMODE_ALL;
  _icon.renderingGroupId = 1;
  _icon.isPickable = false;
  _icon.checkCollisions = false;
  _icon.isVisible = false;
  hideFromInspector(_icon);

  const mat = new StandardMaterial(ICON_MESH_NAME + '_mat', scene);
  _texture = new DynamicTexture(ICON_MESH_NAME + '_tex', TEX_SIZE, scene, false);
  _texture.hasAlpha = true;

  // Start with a transparent canvas so the plane is invisible until the SVG loads.
  const initCtx = _texture.getContext();
  initCtx.clearRect(0, 0, TEX_SIZE, TEX_SIZE);
  _texture.update();

  mat.diffuseTexture = _texture;
  mat.useAlphaFromDiffuseTexture = true;
  mat.emissiveColor = new Color3(1, 1, 1);
  mat.disableLighting = true;
  mat.backFaceCulling = false;
  _icon.material = mat;

  // Draw the SVG into the texture once the image is ready.
  _loadSvg().then((img) => {
    if (!img || !_texture || _texture.isDisposed) return;
    const ctx = _texture.getContext();
    ctx.clearRect(0, 0, TEX_SIZE, TEX_SIZE);
    ctx.drawImage(img, 0, 0, TEX_SIZE, TEX_SIZE);
    _texture.update();
  });

  // Allocate per-attach resources reused across frames.
  _ray = new Ray(Vector3.Zero(), new Vector3(0, 0, 1), 1000);
  _losRay = new Ray(Vector3.Zero(), new Vector3(0, 0, 1), 1);
  _cameraForward = new Vector3(0, 0, 1);
  _cameraRight = new Vector3(1, 0, 0);
  _cameraUp = new Vector3(0, 1, 0);
  _worldPt = new Vector3();
  _toMesh = new Vector3();
  _closestPt = new Vector3();
  _candidates = [];
  _playerMesh = null;
  _predicate = (m) => {
    // An actionManager alone doesn't make a mesh interactable — onIntersect
    // attaches one purely for intersection triggers. Require a real pick trigger
    // (matching the pick triggers the BUTTON2 handler fires).
    if (m === _icon || !m.isVisible || !m.isEnabled?.()) return false;
    if (_isSayPlane(m)) return false;
    if (_playerMesh && (m === _playerMesh || _isDescendantOf(m, _playerMesh))) return false;
    if (_hasRealPickTrigger(m)) return true;
    // Bubble: a member without its own trigger still clicks through to a
    // group/parent handler (see onTrigger's recursive action managers).
    let node = m.parent;
    while (node) {
      if (_hasRealPickTrigger(node)) return true;
      node = node.parent;
    }
    return false;
  };
  _losPredicate = (m) => {
    if (m === _icon || !m.isVisible || !m.isPickable) return false;
    // The XR UI panel is head- or wrist-locked, so it always sits on the ray.
    if (m.metadata?.isXRHUD) return false;
    if (_playerMesh && (m === _playerMesh || _isDescendantOf(m, _playerMesh))) return false;
    return true;
  };

  _observer = scene.onBeforeRenderObservable.add(() => _updateIndicator(scene));

  if (inputManager) {
    _inputManager = inputManager;
    // Route like a pointer click: nearest manager up the hierarchy wins,
    // so a member without its own trigger bubbles to its group/parent.
    // No pointer coords here, so pass a synthetic event that skips the
    // shell's occlusion re-delegation (which needs screen coordinates).
    const fire = (target, trigger) => {
      const mgr =
        typeof target._getActionManagerForTrigger === 'function'
          ? target._getActionManagerForTrigger(trigger)
          : null;
      (mgr ?? target.actionManager)?.processTrigger(trigger, {
        source: target,
        meshUnderPointer: target,
        pointerX: undefined,
        pointerY: undefined,
        __flockDelegated: true,
      });
    };
    _actionCallback = (action) => {
      if (action !== 'BUTTON2') return;
      if (_inputManager?.hasActionOverride('BUTTON2')) return;
      if (!_currentTarget) return;
      _pressedTarget = _currentTarget;
      fire(_pressedTarget, ActionManager.OnPickDownTrigger);
      for (const cb of _interactListeners) cb(_pressedTarget);
    };
    _actionUpCallback = (action) => {
      if (action !== 'BUTTON2' || !_pressedTarget) return;
      const target = _pressedTarget;
      _pressedTarget = null;
      fire(target, ActionManager.OnPickUpTrigger);
      if (target === _currentTarget) fire(target, ActionManager.OnPickTrigger);
    };
    // Keep the observer handle: SimpleObservable.remove() matches on the
    // observer object returned by add(), not the raw callback. Passing the
    // callback removes nothing and leaks a listener on every attach/detach.
    _actionObserver = inputManager.onActionDownObservable.add(_actionCallback);
    _actionUpObserver = inputManager.onActionUpObservable.add(_actionUpCallback);
  }
}

// Toggle the interact indicator on or off. When disabled the icon is hidden,
// per-frame targeting is skipped and BUTTON2 interaction is suppressed; the
// observer stays attached so it can resume without re-allocating resources.
export function setInteractIndicatorEnabled(enabled) {
  _enabled = !!enabled;
  if (!_enabled) {
    _currentTarget = null;
    if (_icon) _icon.isVisible = false;
  }
}

function _updateIndicator(scene) {
  const camera = scene.activeCamera;
  if (!camera || !_icon) return;

  // Disabled via the sensing block — keep the icon hidden and skip targeting.
  if (!_enabled) {
    _icon.isVisible = false;
    _currentTarget = null;
    return;
  }

  // Suppress icon and click when BUTTON2 has been rebound.
  if (_inputManager?.hasActionOverride('BUTTON2')) {
    _icon.isVisible = false;
    _currentTarget = null;
    return;
  }

  // The player is whichever mesh the camera is following — set explicitly by Flock,
  // no heuristics. Null for free-camera scenes.
  _playerMesh = camera.metadata?.following ?? null;
  camera.getDirectionToRef(_LOCAL_FORWARD, _cameraForward);
  camera.getDirectionToRef(_LOCAL_RIGHT, _cameraRight);
  camera.getDirectionToRef(_LOCAL_UP, _cameraUp);

  // Build candidate list into pre-allocated array.
  _candidates.length = 0;
  for (const m of scene.meshes) {
    if (!_predicate(m)) continue;
    _candidates.push(m);
  }

  if (_candidates.length === 0) {
    _icon.isVisible = false;
    _currentTarget = null;
    return;
  }

  const engine = scene.getEngine();
  const renderW = engine.getRenderWidth();
  const renderH = engine.getRenderHeight();
  scene.createPickingRayToRef(renderW / 2, renderH / 2, null, _ray, camera);
  const hit = scene.pickWithRay(_ray, _predicate);

  let target = null;

  if (hit?.hit && hit.pickedMesh) {
    target = hit.pickedMesh;
    // A group shell encloses its members, so the ray hits the shell first
    // even when aiming at a member. See through it to the aimed-at member.
    if (
      (target.visibility === 0 || target.metadata?.shapeType === 'Group') &&
      typeof scene.multiPickWithRay === 'function'
    ) {
      try {
        const hits = scene.multiPickWithRay(_ray, _predicate);
        if (hits?.length) {
          for (const h of hits) {
            const m = h?.pickedMesh;
            if (!m || m === target) continue;
            if (!_isDescendantOf(m, target)) break;
            target = m;
            if (m.visibility !== 0) break;
          }
        }
      } catch {
        // Fall through with the shell target.
      }
    }
  } else {
    // Fallback: candidate with smallest angle to camera forward within the half-angle cone.
    let bestCos = _COS_MAX_HALF_ANGLE;
    for (const m of _candidates) {
      _closestPointOnBBToRef(m, camera.position, _closestPt);
      _toMesh.copyFrom(_closestPt).subtractInPlace(camera.position);
      const len = _toMesh.length();
      if (len === 0) continue;
      _toMesh.scaleInPlace(1 / len); // normalise in place
      const dot = Vector3.Dot(_cameraForward, _toMesh);
      if (dot > bestCos) {
        bestCos = dot;
        target = m;
      }
    }
  }

  // Range filter: drop the target if it's beyond range of the player (or camera).
  if (target) {
    const anchorPos = _playerMesh ? _playerMesh.getAbsolutePosition() : camera.position;
    const range = _playerMesh ? MAX_RANGE : MAX_RANGE_FREE_CAMERA;
    _closestPointOnBBToRef(target, anchorPos, _closestPt);
    if (Vector3.Distance(anchorPos, _closestPt) > range) target = null;
  }

  // Proximity fallback: pick the nearest interactable within range of the player
  // (or camera in free-camera mode) when nothing is directly aimed at. Restricted
  // to the forward cone so the indicator only ever flags what the viewer is
  // facing — a nearby interactable off to the side or behind is not targeted.
  if (!target) {
    const anchorPos = _playerMesh ? _playerMesh.getAbsolutePosition() : camera.position;
    const range = _playerMesh ? MAX_RANGE : MAX_RANGE_FREE_CAMERA;
    let bestDist = range;
    for (const m of _candidates) {
      // Cone check: closest bounding-box point must lie within the half-angle
      // of camera forward (same aim test as the angle fallback above).
      _closestPointOnBBToRef(m, camera.position, _closestPt);
      _toMesh.copyFrom(_closestPt).subtractInPlace(camera.position);
      const len = _toMesh.length();
      if (len === 0) continue;
      _toMesh.scaleInPlace(1 / len);
      if (Vector3.Dot(_cameraForward, _toMesh) <= _COS_MAX_HALF_ANGLE) continue;

      // Range check: nearest within range of the anchor (player or camera).
      _closestPointOnBBToRef(m, anchorPos, _closestPt);
      const dist = Vector3.Distance(anchorPos, _closestPt);
      if (dist < bestDist) {
        bestDist = dist;
        target = m;
      }
    }
  }

  // Line-of-sight check — only when a player exists, cast from the player's position.
  // Skipped in free-camera mode: the camera IS the viewpoint, so any aimed-at
  // interactable is reachable and the check would falsely block via floor/environment geometry.
  if (target && _playerMesh) {
    const playerPos = _playerMesh.getAbsolutePosition();
    _toMesh.copyFrom(target.getBoundingInfo().boundingBox.centerWorld).subtractInPlace(playerPos);
    const losLen = _toMesh.length();
    if (losLen > 0) {
      _losRay.origin.copyFrom(playerPos);
      _losRay.direction.copyFromFloats(_toMesh.x / losLen, _toMesh.y / losLen, _toMesh.z / losLen);
      _losRay.length = losLen;
      const losHit = scene.pickWithRay(_losRay, _losPredicate);
      if (
        losHit?.hit &&
        losHit.pickedMesh &&
        losHit.pickedMesh !== target &&
        !_isDescendantOf(losHit.pickedMesh, target) &&
        !_isDescendantOf(target, losHit.pickedMesh)
      ) {
        target = null;
      }
    }
  }

  _currentTarget = target;

  if (!target) {
    _icon.isVisible = false;
    _partsOwner = null;
    _parts = null;
    return;
  }

  // Position icon to the left of the interactable's geometry (camera-relative),
  // scaled to a constant screen size.
  const camPos = camera.position;
  const camF = Vector3.Dot(camPos, _cameraForward);
  const dpr = 1 / engine.getHardwareScalingLevel();
  const sizeScale = (ICON_SIZE_PX * dpr * 2 * Math.tan(camera.fov / 2)) / renderH;

  _geometryExtentsToRef(_placementOwner(target), _extents, camF, sizeScale);
  const midU = (_extents.minU + _extents.maxU) * 0.5;
  const midF = (_extents.minF + _extents.maxF) * 0.5;
  const worldSize = _iconSizeAt(midF, camF, sizeScale);

  _icon.position.copyFrom(_cameraRight).scaleInPlace(_extents.bandMinR - worldSize * 0.5);
  _toMesh.copyFrom(_cameraUp).scaleInPlace(midU);
  _icon.position.addInPlace(_toMesh);
  _toMesh.copyFrom(_cameraForward).scaleInPlace(midF - worldSize * 0.5);
  _icon.position.addInPlace(_toMesh);

  _icon.scaling.setAll(worldSize);
  _icon.isVisible = true;
}

export function detachInteractIndicator() {
  if (_actionCallback && _inputManager) {
    _inputManager.onActionDownObservable.remove(_actionObserver);
    _inputManager.onActionUpObservable.remove(_actionUpObserver);
    _actionCallback = null;
    _actionObserver = null;
    _actionUpCallback = null;
    _actionUpObserver = null;
    _inputManager = null;
  }
  _currentTarget = null;
  _pressedTarget = null;

  if (_observer) {
    const scene = _icon?.getScene?.();
    if (scene) scene.onBeforeRenderObservable.remove(_observer);
    _observer = null;
  }

  const mat = _icon?.material ?? null;

  _texture?.dispose();
  _texture = null;

  _icon?.dispose();
  _icon = null;

  mat?.dispose();

  _ray = null;
  _losRay = null;
  _cameraForward = null;
  _cameraRight = null;
  _cameraUp = null;
  _worldPt = null;
  _partsOwner = null;
  _parts = null;
  _toMesh = null;
  _closestPt = null;
  _candidates = null;
  _predicate = null;
  _losPredicate = null;
  _playerMesh = null;
}
