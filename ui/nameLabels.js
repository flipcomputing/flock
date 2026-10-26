import { flock } from '../flock.js';

export const NAME_LABELS_TEXTURE = 'NameLabels';
const SYNC_MS = 500;
const LIFT = 0.15;

let enabled = false;
let timer = null;
let texture = null;
let textureScene = null;
let renderObserver = null;
const labels = new Map();

function labelText(name, record) {
  if (!record.generated) return name;
  return `${name.replace(/_\d+$/, '')} (${name})`;
}

function findNode(scene, name) {
  return scene.getMeshByName(name) ?? scene.getTransformNodeByName(name);
}

function topOffset(node) {
  const position = node.getAbsolutePosition();
  const min = { x: Infinity, y: Infinity, z: Infinity };
  const max = { x: -Infinity, y: -Infinity, z: -Infinity };
  const meshes = node.getChildMeshes(false, (mesh) => mesh.billboardMode === 0);
  if (node.getTotalVertices?.() > 0) meshes.push(node);
  for (const mesh of meshes) {
    if (!mesh.isEnabled() || !mesh.isVisible || !mesh.getTotalVertices()) continue;
    const box = mesh.getBoundingInfo().boundingBox;
    for (const axis of ['x', 'y', 'z']) {
      min[axis] = Math.min(min[axis], box.minimumWorld[axis]);
      max[axis] = Math.max(max[axis], box.maximumWorld[axis]);
    }
  }
  if (!Number.isFinite(max.y)) return { x: 0, y: LIFT, z: 0 };
  return {
    x: (min.x + max.x) / 2 - position.x,
    y: max.y + LIFT - position.y,
    z: (min.z + max.z) / 2 - position.z,
  };
}

function createLabel(text) {
  const GUI = flock.GUI;
  const box = new GUI.Rectangle();
  box.adaptWidthToChildren = true;
  box.adaptHeightToChildren = true;
  box.background = 'rgba(0, 0, 0, 0.55)';
  box.color = 'transparent';
  box.cornerRadius = 4;
  box.isPointerBlocker = false;
  box.isHitTestVisible = false;
  box.linkOffsetY = -12;

  const block = new GUI.TextBlock();
  block.text = text;
  block.color = 'white';
  block.fontSize = 14;
  block.resizeToFit = true;
  block.paddingLeft = '6px';
  block.paddingRight = '6px';
  block.paddingTop = '2px';
  block.paddingBottom = '2px';
  box.addControl(block);
  texture.addControl(box);
  return { box, block, offset: { x: 0, y: LIFT, z: 0 }, node: null };
}

function removeLabel(name) {
  labels.get(name)?.box.dispose();
  labels.delete(name);
}

function teardown() {
  labels.clear();
  if (textureScene && renderObserver) {
    textureScene.onBeforeRenderObservable.remove(renderObserver);
  }
  renderObserver = null;
  const old = texture;
  texture = null;
  textureScene = null;
  old?.dispose();
}

function place(scene) {
  const point = new flock.BABYLON.Vector3();
  for (const label of labels.values()) {
    if (!label.box.isVisible) continue;
    const position = label.node.getAbsolutePosition();
    point.set(
      position.x + label.offset.x,
      position.y + label.offset.y,
      position.z + label.offset.z
    );
    label.box.moveToVector3(point, scene);
  }
}

function ensureTexture(scene) {
  if (texture && textureScene === scene) return;
  teardown();
  texture = flock.GUI.AdvancedDynamicTexture.CreateFullscreenUI(NAME_LABELS_TEXTURE, true, scene);
  textureScene = scene;
  texture.onDisposeObservable.addOnce(() => {
    if (textureScene !== scene) return;
    labels.clear();
    scene.onBeforeRenderObservable.remove(renderObserver);
    renderObserver = null;
    texture = null;
    textureScene = null;
  });
  renderObserver = scene.onBeforeRenderObservable.add(() => place(scene));
}

function sync() {
  const scene = flock.scene;
  const registry = flock._nameRegistry;
  if (!scene || scene.isDisposed || !registry || !flock.GUI) return;
  ensureTexture(scene);

  const seen = new Set();
  for (const [name, record] of registry) {
    if (record.tag) continue;
    const node = findNode(scene, name);
    if (!node) continue;
    seen.add(name);

    let label = labels.get(name);
    if (!label) {
      label = createLabel(labelText(name, record));
      labels.set(name, label);
    }
    label.node = node;
    label.box.isVisible = node.isEnabled();
    if (label.box.isVisible) label.offset = topOffset(node);
  }

  for (const name of [...labels.keys()]) {
    if (!seen.has(name)) removeLabel(name);
  }
}

export function setNameLabelsVisible(visible) {
  enabled = !!visible;
  clearInterval(timer);
  timer = null;
  if (!enabled) {
    teardown();
    return;
  }
  sync();
  timer = setInterval(sync, SYNC_MS);
}

export function areNameLabelsVisible() {
  return enabled;
}
