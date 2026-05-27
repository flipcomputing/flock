import {
  MeshBuilder,
  StandardMaterial,
  DynamicTexture,
  Color3,
  Vector3,
  Mesh,
} from "@babylonjs/core";

const ICON_MESH_NAME = "__flock_interact_indicator";
const ICON_SIZE_PX = 48;
const TEX_SIZE = 128;

let _icon = null;
let _texture = null;
let _observer = null;

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

export function attachInteractIndicator(scene) {
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

  _observer = scene.onBeforeRenderObservable.add(() => _updateIndicator(scene));
}

function _updateIndicator(scene) {
  const camera = scene.activeCamera;
  if (!camera || !_icon) return;

  const interactables = scene.meshes.filter(
    (m) => m !== _icon && m.actionManager,
  );

  if (interactables.length === 0) {
    _icon.isVisible = false;
    return;
  }

  const camPos = camera.position;
  let closest = null;
  let closestDist = Infinity;

  for (const mesh of interactables) {
    const dist = Vector3.Distance(camPos, mesh.getAbsolutePosition());
    if (dist < closestDist) {
      closestDist = dist;
      closest = mesh;
    }
  }

  const meshPos = closest.getAbsolutePosition();
  const dist = closestDist;

  const renderH = scene.getEngine().getRenderHeight();
  const dpr = typeof window !== "undefined" ? (window.devicePixelRatio || 1) : 1;
  const worldSize =
    (ICON_SIZE_PX * dpr * 2 * dist * Math.tan(camera.fov / 2)) / renderH;

  const toCamera = camPos.subtract(meshPos).normalize();
  _icon.position = meshPos.add(toCamera.scale(worldSize / 2));
  _icon.scaling.setAll(worldSize);
  _icon.isVisible = true;
}

export function detachInteractIndicator() {
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
}
