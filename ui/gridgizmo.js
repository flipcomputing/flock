import { flock } from "../flock.js";

const GRID_MODES = ["off", "ground", "volume"];
const GRID_LIMIT = 50;
const GRID_STEP = 10;
const MINOR_GRID_STEP = 1;
const MINOR_GRID_ALPHA = 0.18;
const GRID_Y_MAX = 5;
const GRID_Y_MIN = -5;
const LABEL_DISTANCE = 20;
const CULL_DISTANCE = 20;
const MAJOR_RADIUS = 0.045;
const AXIS_RADIUS = 0.07;

function disablePhysics(mesh) {
  if (!mesh) return;
  mesh.isPickable = false;
  mesh.checkCollisions = false;
  if (mesh.physicsImpostor) mesh.physicsImpostor.dispose();
  mesh.physicsImpostor = null;
}

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
const culledMeshes = [];

function registerCulledMesh(mesh, maxDistance = CULL_DISTANCE) {
  if (!mesh) return;
  culledMeshes.push({ mesh, maxDistance });
}

function createTextLabel(text, position, color, parent) {
  const scene = flock.scene;
  const plane = flock.BABYLON.MeshBuilder.CreatePlane(
    `gridLabel-${text}-${position.x}-${position.y}-${position.z}`,
    { size: 1.2, sideOrientation: flock.BABYLON.Mesh.DOUBLESIDE },
    scene,
  );
  plane.position = position;
  plane.billboardMode = flock.BABYLON.AbstractMesh.BILLBOARDMODE_ALL;
  plane.parent = parent;
  disablePhysics(plane);
  registerCulledMesh(plane, LABEL_DISTANCE);

  const texture = flock.GUI.AdvancedDynamicTexture.CreateForMesh(plane, 512, 256);

  const container = new flock.GUI.Rectangle();
  container.background = "#FFFFFF";
  container.alpha = 0.9;
  container.cornerRadius = 10;
  container.thickness = 4;
  container.color = "#222222";
  container.paddingTop = "6px";
  container.paddingBottom = "6px";
  container.paddingLeft = "10px";
  container.paddingRight = "10px";

  const textBlock = new flock.GUI.TextBlock();
  textBlock.text = text;
  textBlock.color = color.toHexString();
  textBlock.fontSize = 220;
  textBlock.fontFamily = "Atkinson Hyperlegible Next";
  textBlock.textHorizontalAlignment = flock.GUI.Control.HORIZONTAL_ALIGNMENT_CENTER;
  textBlock.textVerticalAlignment = flock.GUI.Control.VERTICAL_ALIGNMENT_CENTER;

  container.addControl(textBlock);
  texture.addControl(container);

  labels.push({ mesh: plane, maxDistance: LABEL_DISTANCE });
  return plane;
}

function createAxisTube(name, from, to, color, parent, radius = AXIS_RADIUS) {
  const tube = flock.BABYLON.MeshBuilder.CreateTube(
    name,
    { path: [from, to], radius },
    flock.scene,
  );
  tube.parent = parent;
  disablePhysics(tube);
  registerCulledMesh(tube);

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
  disablePhysics(marker);

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
  disablePhysics(lineSystem);
  lineSystem.alwaysSelectAsActiveMesh = false;
  registerCulledMesh(lineSystem);
  return lineSystem;
}

function createGroundGrid() {
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

  buildLineSystem({
    lines: minorLines,
    colors: minorColors,
    name: "grid-ground-lines-minor",
    parent: groundParent,
  });

  for (let x = -GRID_LIMIT; x <= GRID_LIMIT; x += GRID_STEP) {
    const color = x === 0 ? xAxisColor : xAxisColor.scale(0.7);
    const radius = x === 0 ? AXIS_RADIUS : MAJOR_RADIUS;
    createAxisTube(
      `grid-axis-x-${x}`,
      new flock.BABYLON.Vector3(x, 0, -GRID_LIMIT),
      new flock.BABYLON.Vector3(x, 0, GRID_LIMIT),
      color,
      groundParent,
      radius,
    );
    if (x !== 0) {
      createTextLabel(
        `${x}`,
        new flock.BABYLON.Vector3(x, 0.6, 1.5),
        color,
        groundParent,
      );
    }
  }

  for (let z = -GRID_LIMIT; z <= GRID_LIMIT; z += GRID_STEP) {
    const color = z === 0 ? zAxisColor : zAxisColor.scale(0.7);
    const radius = z === 0 ? AXIS_RADIUS : MAJOR_RADIUS;
    createAxisTube(
      `grid-axis-z-${z}`,
      new flock.BABYLON.Vector3(-GRID_LIMIT, 0, z),
      new flock.BABYLON.Vector3(GRID_LIMIT, 0, z),
      color,
      groundParent,
      radius,
    );
    if (z !== 0) {
      createTextLabel(
        `${z}`,
        new flock.BABYLON.Vector3(1.5, 0.6, z),
        color,
        groundParent,
      );
    }
  }

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

  const majorColumns = [];
  const majorColors = [];

  for (let x = -GRID_LIMIT; x <= GRID_LIMIT; x += GRID_STEP) {
    for (let z = -GRID_LIMIT; z <= GRID_LIMIT; z += GRID_STEP) {
      const color = yAxisColor.toColor4(0.65);
      majorColumns.push([
        new flock.BABYLON.Vector3(x, GRID_Y_MIN, z),
        new flock.BABYLON.Vector3(x, GRID_Y_MAX, z),
      ]);
      majorColors.push([color, color]);
    }
  }

  buildLineSystem({
    lines: majorColumns,
    colors: majorColors,
    name: "grid-volume-vertical-major",
    parent: volumeParent,
  });

  for (
    let y = Math.ceil(GRID_Y_MIN / GRID_STEP) * GRID_STEP;
    y <= GRID_Y_MAX;
    y += GRID_STEP
  ) {
    createTextLabel(
      `${y}`,
      new flock.BABYLON.Vector3(0.8, y + 0.25, 0.8),
      yAxisColor,
      volumeParent,
    );
  }
}

function createStackedXZGrids() {
  for (let y = GRID_Y_MIN; y <= GRID_Y_MAX; y += 1) {
    const minorLines = [];
    const minorColors = [];
    const majorLines = [];
    const majorColors = [];

    for (let x = -GRID_LIMIT; x <= GRID_LIMIT; x += MINOR_GRID_STEP) {
      const line = [
        new flock.BABYLON.Vector3(x, y, -GRID_LIMIT),
        new flock.BABYLON.Vector3(x, y, GRID_LIMIT),
      ];
      if (x % GRID_STEP === 0) {
        majorLines.push(line);
        majorColors.push([xAxisColor.toColor4(0.65), xAxisColor.toColor4(0.65)]);
      } else {
        minorLines.push(line);
        minorColors.push([xAxisColor.toColor4(MINOR_GRID_ALPHA), xAxisColor.toColor4(MINOR_GRID_ALPHA)]);
      }
    }

    for (let z = -GRID_LIMIT; z <= GRID_LIMIT; z += MINOR_GRID_STEP) {
      const line = [
        new flock.BABYLON.Vector3(-GRID_LIMIT, y, z),
        new flock.BABYLON.Vector3(GRID_LIMIT, y, z),
      ];
      if (z % GRID_STEP === 0) {
        majorLines.push(line);
        majorColors.push([zAxisColor.toColor4(0.65), zAxisColor.toColor4(0.65)]);
      } else {
        minorLines.push(line);
        minorColors.push([zAxisColor.toColor4(MINOR_GRID_ALPHA), zAxisColor.toColor4(MINOR_GRID_ALPHA)]);
      }
    }

    if (minorLines.length) {
      buildLineSystem({
        lines: minorLines,
        colors: minorColors,
        name: `grid-layer-${y}-minor`,
        parent: volumeParent,
      });
    }

    if (majorLines.length) {
      buildLineSystem({
        lines: majorLines,
        colors: majorColors,
        name: `grid-layer-${y}-major`,
        parent: volumeParent,
      });
    }
  }
}

function disposeGrid() {
  if (labelObserver && currentScene) {
    currentScene.onBeforeRenderObservable.remove(labelObserver);
    labelObserver = null;
  }
  labels.splice(0, labels.length);
  culledMeshes.splice(0, culledMeshes.length);
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
    createStackedXZGrids();

    gridRoot.setEnabled(false);
    volumeParent.setEnabled(false);

    labelObserver = scene.onBeforeRenderObservable.add(() => {
      const camera = scene.activeCamera;
      if (!camera) return;
      const camPos = camera.position;
      const updateVisibility = ({ mesh, maxDistance }) => {
        if (!mesh || mesh.isDisposed()) return;
        const info = mesh.getBoundingInfo?.();
        const center = info
          ? info.boundingBox.centerWorld
          : mesh.getAbsolutePosition?.() ?? mesh.position ?? flock.BABYLON.Vector3.Zero();
        const distance = flock.BABYLON.Vector3.Distance(camPos, center);
        mesh.isVisible = mesh.isEnabled() && distance <= maxDistance;
      };

      labels.forEach(updateVisibility);
      culledMeshes.forEach(updateVisibility);
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

