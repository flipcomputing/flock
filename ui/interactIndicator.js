import {
  MeshBuilder,
  StandardMaterial,
  DynamicTexture,
  Color3,
  Vector3,
  Mesh,
  ActionManager,
  ActionEvent,
  Ray,
} from "@babylonjs/core";
import { getPlayerMesh } from "../accessibility/accessibility.js";

const ICON_MESH_NAME = "__flock_interact_indicator";
const ICON_SIZE_PX = 48;
const TEX_SIZE = 128;
const MAX_RANGE = 4;
const MAX_HALF_ANGLE = Math.PI / 4; // 45 degrees
const _COS_MAX_HALF_ANGLE = Math.cos(MAX_HALF_ANGLE);

// Module-level local axis constants (no per-frame allocation).
const _LOCAL_FORWARD = new Vector3(0, 0, 1);
const _LOCAL_RIGHT = new Vector3(1, 0, 0);

let _icon = null;
let _texture = null;
let _observer = null;
let _currentTarget = null;
let _actionCallback = null;
let _inputManager = null;

// Single Ray allocated on attach, reused across frames.
let _ray = null;
// Second Ray for line-of-sight occlusion check.
let _losRay = null;
// Scratch vectors reused across frames — no per-frame allocation in targeting path.
let _cameraForward = null;
let _cameraRight = null;
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
    if (typeof document === "undefined") {
      resolve(null);
      return;
    }
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => resolve(null);
    img.src = new URL("../assets/interaction-indicator.svg", import.meta.url).href;
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

function _isDescendantOf(mesh, ancestor) {
  let node = mesh.parent;
  while (node) {
    if (node === ancestor) return true;
    node = node.parent;
  }
  return false;
}

export function attachInteractIndicator(scene, inputManager) {
  if (_icon) return;

  _icon = MeshBuilder.CreatePlane(ICON_MESH_NAME, { size: 1 }, scene);
  _icon.billboardMode = Mesh.BILLBOARDMODE_ALL;
  _icon.renderingGroupId = 1;
  _icon.isPickable = false;
  _icon.checkCollisions = false;
  _icon.isVisible = false;

  const mat = new StandardMaterial(ICON_MESH_NAME + "_mat", scene);
  _texture = new DynamicTexture(ICON_MESH_NAME + "_tex", TEX_SIZE, scene, false);
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
  _toMesh = new Vector3();
  _closestPt = new Vector3();
  _candidates = [];
  _playerMesh = null;
  _predicate = (m) => {
    if (m === _icon || !m.actionManager) return false;
    if (_playerMesh && (m === _playerMesh || _isDescendantOf(m, _playerMesh))) return false;
    return true;
  };
  _losPredicate = (m) => {
    if (m === _icon || !m.isVisible || !m.isPickable) return false;
    if (_playerMesh && (m === _playerMesh || _isDescendantOf(m, _playerMesh))) return false;
    return true;
  };

  _observer = scene.onBeforeRenderObservable.add(() => _updateIndicator(scene));

  if (inputManager) {
    _inputManager = inputManager;
    _actionCallback = (action) => {
      if (action !== "BUTTON2") return;
      if (_inputManager?.hasActionOverride("BUTTON2")) return;
      if (!_currentTarget?.actionManager) return;
      const target = _currentTarget;
      target.actionManager.processTrigger(
        ActionManager.OnPickTrigger,
        ActionEvent.CreateNew(target),
      );
      target.actionManager.processTrigger(
        ActionManager.OnLeftPickTrigger,
        ActionEvent.CreateNew(target),
      );
    };
    inputManager.onActionDownObservable.add(_actionCallback);
  }
}

function _updateIndicator(scene) {
  const camera = scene.activeCamera;
  if (!camera || !_icon) return;

  // Suppress icon and click when BUTTON2 has been rebound.
  if (_inputManager?.hasActionOverride("BUTTON2")) {
    _icon.isVisible = false;
    _currentTarget = null;
    return;
  }

  // Refresh player mesh and camera directions (no allocation).
  _playerMesh = getPlayerMesh(scene);
  camera.getDirectionToRef(_LOCAL_FORWARD, _cameraForward);
  camera.getDirectionToRef(_LOCAL_RIGHT, _cameraRight);

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

  // Range filter only applies when a player mesh is present (anchor = player position).
  // Without a player, any aimed-at interactable is reachable regardless of distance.
  if (target && _playerMesh) {
    const playerPos = _playerMesh.getAbsolutePosition();
    _closestPointOnBBToRef(target, playerPos, _closestPt);
    if (Vector3.Distance(playerPos, _closestPt) > MAX_RANGE) target = null;
  }

  // Line-of-sight check — hide icon if a solid mesh occludes the path to the target.
  if (target) {
    _toMesh.copyFrom(target.getAbsolutePosition()).subtractInPlace(camera.position);
    const losLen = _toMesh.length();
    if (losLen > 0) {
      _losRay.origin.copyFrom(camera.position);
      _losRay.direction.copyFromFloats(
        _toMesh.x / losLen,
        _toMesh.y / losLen,
        _toMesh.z / losLen,
      );
      _losRay.length = losLen;
      const losHit = scene.pickWithRay(_losRay, _losPredicate);
      if (losHit?.hit && losHit.pickedMesh &&
          losHit.pickedMesh !== target &&
          !_isDescendantOf(losHit.pickedMesh, target)) {
        target = null;
      }
    }
  }

  _currentTarget = target;

  if (!target) {
    _icon.isVisible = false;
    return;
  }

  // Position icon to the left of target (camera-relative), scaled to a constant screen size.
  const meshPos = target.getAbsolutePosition();
  const camPos = camera.position;
  const dist = Vector3.Distance(camPos, meshPos);

  const dpr = typeof window !== "undefined" ? (window.devicePixelRatio || 1) : 1;
  const worldSize =
    (ICON_SIZE_PX * dpr * 2 * dist * Math.tan(camera.fov / 2)) / renderH;

  // Offset icon toward camera slightly to prevent z-fighting.
  _toMesh.copyFrom(camPos).subtractInPlace(meshPos);
  const len = _toMesh.length();
  if (len > 0) _toMesh.scaleInPlace(worldSize / (2 * len));
  meshPos.addToRef(_toMesh, _icon.position);

  // Offset to camera-left so the icon sits beside rather than on top of the object.
  // Use projected half-extent onto camera-right so the offset matches the object's
  // apparent width rather than its full diagonal.
  const bb = target.getBoundingInfo().boundingBox;
  const ext = bb.extendSizeWorld;
  const halfWidth =
    Math.abs(ext.x * _cameraRight.x) +
    Math.abs(ext.y * _cameraRight.y) +
    Math.abs(ext.z * _cameraRight.z);
  _toMesh.copyFrom(_cameraRight).scaleInPlace(-(halfWidth + worldSize * 0.5));
  _icon.position.addInPlace(_toMesh);

  _icon.scaling.setAll(worldSize);
  _icon.isVisible = true;
}

export function detachInteractIndicator() {
  if (_actionCallback && _inputManager) {
    _inputManager.onActionDownObservable.remove(_actionCallback);
    _actionCallback = null;
    _inputManager = null;
  }
  _currentTarget = null;

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
  _toMesh = null;
  _closestPt = null;
  _candidates = null;
  _predicate = null;
  _losPredicate = null;
  _playerMesh = null;
}
