import { flock } from "../flock.js";

const GRID_MODES = ["off", "ground", "volume"];
const GRID_LIMIT = 50;
const GRID_STEP = 10;
const MINOR_GRID_STEP = 1;
const MINOR_GRID_ALPHA = 0.18;
const GRID_Y_MAX = 5;
const GRID_Y_MIN = -5;
const LABEL_DISTANCE = 35;

const xAxisColor = flock.BABYLON.Color3.FromHexString("#0072B2");
const yAxisColor = flock.BABYLON.Color3.FromHexString("#009E73");
const zAxisColor = flock.BABYLON.Color3.FromHexString("#D55E00");
const whiteColor = flock.BABYLON.Color3.FromHexString("#FFFFFF");

let gridRoot = null;
let groundParent = null;
let volumeParent = null;
let labelObserver = null;
let currentScene = null;
let gridModeIndex = 0;

const labels = [];

function createTextLabel(text, position, color, parent) {
  const scene = flock.scene;
  const plane = flock.BABYLON.MeshBuilder.CreatePlane(
    `gridLabel-${text}-${position.x}-${position.y}-${position.z}`,
    { size: 0.85, sideOrientation: flock.BABYLON.Mesh.DOUBLESIDE },
    scene,
  );
  plane.position = position;
  plane.billboardMode = flock.BABYLON.AbstractMesh.BILLBOARDMODE_ALL;
  plane.isPickable = false;
  plane.parent = parent;

  const texture = flock.GUI.AdvancedDynamicTexture.CreateForMesh(plane);
  const textBlock = new flock.GUI.TextBlock();
  textBlock.text = text;
  textBlock.color = color.toHexString();
  textBlock.fontSize = 200;
  textBlock.fontFamily = "Atkinson Hyperlegible Next";
  textBlock.background = "#000000AA";
  textBlock.paddingTop = "5px";
  textBlock.paddingBottom = "5px";
  textBlock.paddingLeft = "8px";
  textBlock.paddingRight = "8px";
  texture.addControl(textBlock);

  labels.push({ mesh: plane, maxDistance: LABEL_DISTANCE });
  return plane;
}

function createAxisTube(name, from, to, color, parent) {
  const tube = flock.BABYLON.MeshBuilder.CreateTube(
    name,
    { path: [from, to], radius: 0.06 },
    flock.scene,
  );
  tube.parent = parent;
  tube.isPickable = false;

  const material = new flock.BABYLON.StandardMaterial(`${name}-mat`, flock.scene);
  material.diffuseColor = color;
  material.emissiveColor = color.scale(0.6);
  tube.material = material;

  return tube;
}

function createMajorMarker(parent) {
  const marker = flock.BABYLON.MeshBuilder.CreateBox(
    "grid-center-marker",
    { size: 0.3 },
    flock.scene,
  );
  marker.parent = parent;
  marker.position = flock.BABYLON.Vector3.Zero();
  marker.isPickable = false;

  const material = new flock.BABYLON.StandardMaterial("grid-center-mat", flock.scene);
  material.diffuseColor = whiteColor;
  material.emissiveColor = whiteColor;
  marker.material = material;

  return marker;
}

function buildLineSystem({ lines, colors, name, parent }) {
  const lineSystem = flock.BABYLON.MeshBuilder.CreateLineSystem(
    name,
    { lines, colors },
    flock.scene,
  );
  lineSystem.parent = parent;
  lineSystem.isPickable = false;
  lineSystem.alwaysSelectAsActiveMesh = false;
  return lineSystem;
}

function createGroundGrid() {
  const lines = [];
  const colors = [];

  const minorLines = [];
  const minorColors = [];

  for (let x = -GRID_LIMIT; x <= GRID_LIMIT; x += MINOR_GRID_STEP) {
    if (x % GRID_STEP === 0) continue;
    minorLines.push([
      new flock.BABYLON.Vector3(x, 0, -GRID_LIMIT),
      new flock.BABYLON.Vector3(x, 0, GRID_LIMIT),
    ]);
    minorColors.push([
      xAxisColor.toColor4(MINOR_GRID_ALPHA),
      xAxisColor.toColor4(MINOR_GRID_ALPHA),
    ]);
  }

  for (let z = -GRID_LIMIT; z <= GRID_LIMIT; z += MINOR_GRID_STEP) {
    if (z % GRID_STEP === 0) continue;
    minorLines.push([
      new flock.BABYLON.Vector3(-GRID_LIMIT, 0, z),
      new flock.BABYLON.Vector3(GRID_LIMIT, 0, z),
    ]);
    minorColors.push([
      zAxisColor.toColor4(MINOR_GRID_ALPHA),
      zAxisColor.toColor4(MINOR_GRID_ALPHA),
    ]);
  }

  for (let x = -GRID_LIMIT; x <= GRID_LIMIT; x += GRID_STEP) {
    lines.push([
      new flock.BABYLON.Vector3(x, 0, -GRID_LIMIT),
      new flock.BABYLON.Vector3(x, 0, GRID_LIMIT),
    ]);
    const color = x === 0 ? xAxisColor : xAxisColor.scale(0.7);
    colors.push([color.toColor4(1), color.toColor4(1)]);
    if (x !== 0) {
      createTextLabel(
        `${x}`,
        new flock.BABYLON.Vector3(x, 0.35, 1.4),
        color,
        groundParent,
      );
    }
  }

  for (let z = -GRID_LIMIT; z <= GRID_LIMIT; z += GRID_STEP) {
    lines.push([
      new flock.BABYLON.Vector3(-GRID_LIMIT, 0, z),
      new flock.BABYLON.Vector3(GRID_LIMIT, 0, z),
    ]);
    const color = z === 0 ? zAxisColor : zAxisColor.scale(0.7);
    colors.push([color.toColor4(1), color.toColor4(1)]);
    if (z !== 0) {
      createTextLabel(
        `${z}`,
        new flock.BABYLON.Vector3(1.4, 0.35, z),
        color,
        groundParent,
      );
    }
  }

  buildLineSystem({
    lines: minorLines,
    colors: minorColors,
    name: "grid-ground-lines-minor",
    parent: groundParent,
  });

  buildLineSystem({
    lines,
    colors,
    name: "grid-ground-lines",
    parent: groundParent,
  });

  createAxisTube(
    "grid-axis-x",
    new flock.BABYLON.Vector3(-GRID_LIMIT, 0, 0),
    new flock.BABYLON.Vector3(GRID_LIMIT, 0, 0),
    xAxisColor,
    groundParent,
  );
  createAxisTube(
    "grid-axis-z",
    new flock.BABYLON.Vector3(0, 0, -GRID_LIMIT),
    new flock.BABYLON.Vector3(0, 0, GRID_LIMIT),
    zAxisColor,
    groundParent,
  );

  createMajorMarker(groundParent);
}

function createVerticalPlanes() {
  const xyLines = [];
  const xyColors = [];
  const yzLines = [];
  const yzColors = [];

  for (let y = GRID_Y_MIN; y <= GRID_Y_MAX; y += 1) {
    xyLines.push([
      new flock.BABYLON.Vector3(-GRID_LIMIT, y, 0),
      new flock.BABYLON.Vector3(GRID_LIMIT, y, 0),
    ]);
    xyColors.push([xAxisColor.toColor4(0.8), xAxisColor.toColor4(0.8)]);

    yzLines.push([
      new flock.BABYLON.Vector3(0, y, -GRID_LIMIT),
      new flock.BABYLON.Vector3(0, y, GRID_LIMIT),
    ]);
    yzColors.push([zAxisColor.toColor4(0.8), zAxisColor.toColor4(0.8)]);
  }

  for (let x = -GRID_LIMIT; x <= GRID_LIMIT; x += GRID_STEP) {
    xyLines.push([
      new flock.BABYLON.Vector3(x, GRID_Y_MIN, 0),
      new flock.BABYLON.Vector3(x, GRID_Y_MAX, 0),
    ]);
    xyColors.push([yAxisColor.toColor4(0.8), yAxisColor.toColor4(0.8)]);
  }

  for (let z = -GRID_LIMIT; z <= GRID_LIMIT; z += GRID_STEP) {
    yzLines.push([
      new flock.BABYLON.Vector3(0, GRID_Y_MIN, z),
      new flock.BABYLON.Vector3(0, GRID_Y_MAX, z),
    ]);
    yzColors.push([yAxisColor.toColor4(0.8), yAxisColor.toColor4(0.8)]);
  }

  buildLineSystem({
    lines: xyLines,
    colors: xyColors,
    name: "grid-xy-plane",
    parent: volumeParent,
  });

  buildLineSystem({
    lines: yzLines,
    colors: yzColors,
    name: "grid-yz-plane",
    parent: volumeParent,
  });

  createAxisTube(
    "grid-axis-y",
    new flock.BABYLON.Vector3(0, GRID_Y_MIN, 0),
    new flock.BABYLON.Vector3(0, GRID_Y_MAX, 0),
    yAxisColor,
    volumeParent,
  );

  for (let y = GRID_Y_MIN; y <= GRID_Y_MAX; y += 1) {
    if (y === 0) continue;
    createTextLabel(
      `${y}`,
      new flock.BABYLON.Vector3(0.8, y, 0.8),
      yAxisColor,
      volumeParent,
    );
  }
}

function disposeGrid() {
  if (labelObserver && currentScene) {
    currentScene.onBeforeRenderObservable.remove(labelObserver);
    labelObserver = null;
  }
  labels.splice(0, labels.length);
  gridRoot?.dispose();
  gridRoot = null;
  groundParent = null;
  volumeParent = null;
  currentScene = null;
}

function ensureGrid(scene) {
  if (!scene) return null;
  const disposedFlag =
    typeof scene.isDisposed === "function" ? scene.isDisposed() : scene.isDisposed;
  if (disposedFlag) return null;
  if (scene !== currentScene || !gridRoot || gridRoot.isDisposed()) {
    disposeGrid();
    currentScene = scene;
    gridRoot = new flock.BABYLON.TransformNode("grid-root", scene);
    groundParent = new flock.BABYLON.TransformNode("grid-ground", scene);
    volumeParent = new flock.BABYLON.TransformNode("grid-volume", scene);

    groundParent.parent = gridRoot;
    volumeParent.parent = gridRoot;

    createGroundGrid();
    createVerticalPlanes();

    gridRoot.setEnabled(false);
    volumeParent.setEnabled(false);

    labelObserver = scene.onBeforeRenderObservable.add(() => {
      const camera = scene.activeCamera;
      if (!camera) return;
      const camPos = camera.position;
      labels.forEach(({ mesh, maxDistance }) => {
        if (!mesh || mesh.isDisposed()) return;
        const distance = flock.BABYLON.Vector3.Distance(camPos, mesh.getAbsolutePosition());
        mesh.isVisible = mesh.isEnabled() && distance <= maxDistance;
      });
    });

    scene.onDisposeObservable.addOnce(() => {
      disposeGrid();
      gridModeIndex = 0;
      updateButtonLabel();
    });
  }
  return gridRoot;
}

function updateButtonLabel() {
  const button = document.getElementById("gridToggleButton");
  if (!button) return;
  const mode = GRID_MODES[gridModeIndex];
  const labelSpan = button.querySelector(".grid-toggle-label");
  let label = "Grid off";
  let pressed = "false";

  switch (mode) {
    case "ground":
      label = "Ground grid";
      pressed = "true";
      break;
    case "volume":
      label = "3D grid";
      pressed = "true";
      break;
    default:
      break;
  }

  button.setAttribute("aria-pressed", pressed);
  button.setAttribute("aria-label", label);
  button.setAttribute("title", label);
  if (labelSpan) labelSpan.textContent = label;
}

export function cycleGridMode() {
  const scene = flock.scene;
  if (!scene) return;

  ensureGrid(scene);
  gridModeIndex = (gridModeIndex + 1) % GRID_MODES.length;
  const mode = GRID_MODES[gridModeIndex];

  if (!gridRoot) return;

  switch (mode) {
    case "ground":
      gridRoot.setEnabled(true);
      volumeParent.setEnabled(false);
      groundParent.setEnabled(true);
      break;
    case "volume":
      gridRoot.setEnabled(true);
      groundParent.setEnabled(true);
      volumeParent.setEnabled(true);
      break;
    default:
      gridRoot.setEnabled(false);
      break;
  }

  updateButtonLabel();
}

export function initializeGridToggle() {
  const button = document.getElementById("gridToggleButton");
  if (!button) return;

  updateButtonLabel();
  button.addEventListener("click", cycleGridMode);
}

export function resetGridToggle() {
  gridModeIndex = 0;
  updateButtonLabel();
  if (gridRoot) {
    gridRoot.setEnabled(false);
    volumeParent?.setEnabled(false);
  }
}

