import * as Blockly from "blockly";
import { meshMap, meshBlockIdMap } from "../generators/generators.js";
import { flock } from "../flock.js";
import { translate } from "../main/translation.js";
import {
  getBlockKeyFromBlock,
  getMeshFromBlockKey,
  getMeshFromBlock,
  getRootMesh,
  updateBlockColorAndHighlight,
} from "./blockmesh.js";
import {
  highlightBlockById,
  getCanvasXAndCanvasYValues,
  setBlockXYZ,
  duplicateBlockAndInsert,
  findParentWithBlockId,
  setNumberInputs,
  getNumberInput,
} from "./blocklyutil.js";
import {
  getMeshRotationInDegrees,
  roundVectorToFixed,
  pickLeafFromRay,
} from "./meshhelpers.js";
import {
  startCanvasKeyboardMode,
  stopCanvasKeyboardMode,
  getCanvasCircle,
  setCrosshairCursor,
  setDefaultCursor,
} from "./canvas-utils.js";
import { createAxisKeyboardHandler } from "./axis-keyboard.js";
export let gizmoManager;

// Enable debug messages
const DEBUG = true;

const blueColor = flock.BABYLON.Color3.FromHexString("#0072B2"); // Colour for X-axis
const greenColor = flock.BABYLON.Color3.FromHexString("#009E73"); // Colour for Y-axis
const orangeColor = flock.BABYLON.Color3.FromHexString("#D55E00"); // Colour for Z-axis

const FAST_CURSOR = 1; // Step for moving KB cursor quickly
const DEFAULT_CURSOR = 0.1; // Step for moving KB cursor slowly (default)
const FAST_ROTATION = 0.5;
const DEFAULT_ROTATION = 0.05;
const FAST_SCALE = 0.5;
const DEFAULT_SCALE = 0.05;

window.selectedColor = "#ffffff"; // Default color
let colorPicker = null;

// 3D text scale gizmo axis tracking
let textScaleAxis = null;
let textOrigScaleZ = 1;

// Track state
let cameraMode = "play";
let activePick = null; // [Select mesh?]
let activeDuplicatePickHandler = null; // [Clone mesh?]
let stopAxisKeyboard = null; // Axis keyboard active?

// Keep track of things to clean up
const cleanupFns = [];

// Track DO sections and their associated blocks for cleanup
const gizmoCreatedBlocks = new Map(); // blockId -> { parentId, createdDoSection, timestamp }

document.addEventListener("DOMContentLoaded", function () {
  const colorButton = document.getElementById("colorPickerButton");

  window.addEventListener(
    "keydown",
    (e) => {
      // If they press Tab while a gizmo button
      // is active, exit the gizmo state
      if (e.key === "Tab" && document.querySelector(".gizmo-button.active")) {
        e.preventDefault();
        exitGizmoState();
      }

      // Handle Delete key to delete selected mesh
      if (e.key === "Delete" && gizmoManager?.attachedMesh) {
        const t = e.target;
        const tag = (t?.tagName || "").toLowerCase();
        if (
          !t?.isContentEditable &&
          tag !== "input" &&
          tag !== "textarea" &&
          tag !== "select"
        ) {
          if (Blockly.getMainWorkspace()?.getInjectionDiv()?.contains(t))
            return;
          e.stopPropagation();
          const blockKey = findParentWithBlockId(gizmoManager.attachedMesh)
            ?.metadata?.blockKey;
          deleteBlockWithUndo(meshBlockIdMap[blockKey]);
          return;
        }
      }

      // Only plain Esc (no modifiers)
      if (e.key !== "Escape" || e.ctrlKey || e.altKey || e.metaKey) return;

      // Don’t hijack when typing
      const t = e.target;
      const tag = (t?.tagName || "").toLowerCase();
      if (
        t?.isContentEditable ||
        tag === "input" ||
        tag === "textarea" ||
        tag === "select"
      ) {
        return;
      }

      // If gizmos are on, disable them
      try {
        exitGizmoState();
        gizmoManager?.attachToMesh(null);
      } catch {
        // fail-safe: still attempt to disable
        disableGizmos?.();
      }

      // Broadcast a generic Esc event apps can listen to if they want
      window.dispatchEvent(new CustomEvent("global:escape"));
    },
    true,
  ); // capture=true so we run before scene/camera handlers

  window.addEventListener("keydown", (event) => {
    if (event.ctrlKey || event.altKey || event.metaKey) return;
    const t = event.target;
    const tag = (t?.tagName || "").toLowerCase();
    if (
      t?.isContentEditable ||
      tag === "input" ||
      tag === "textarea" ||
      tag === "select"
    )
      return;

    if (event.code === "KeyF") {
      focusCameraOnMesh();
    } else if (event.code === "KeyV") {
      viewMeshWithCamera();
    }
  });

  // Initialize custom color picker
  if (!colorPicker) {
    colorPicker = new window.CustomColorPicker({
      color: window.selectedColor,
      onColorChange: (newColor) => {
        window.selectedColor = newColor;
      },
      onClose: () => {
        // After color picker closes, start mesh selection
        pickMeshFromCanvas();
      },
      excludeFromClose: (target) => {
        // Don't close picker when clicking on the 3D canvas — we handle it directly
        const canvas = document.getElementById("renderCanvas");
        return canvas && (canvas === target || canvas.contains(target));
      },
      target: document.body,
    });
    // Make accessible globally for translation updates
    window.flockColorPicker = colorPicker;

    // Direct painting: clicking/tapping the canvas while picker is open applies colour
    const renderCanvas = document.getElementById("renderCanvas");
    if (renderCanvas) {
      renderCanvas.addEventListener("click", (event) => {
        if (!colorPicker?.isOpen) return;
        // Use picker's live colour (not yet confirmed via "Use")
        window.selectedColor = colorPicker.currentColor || window.selectedColor;
        const canvasRect = renderCanvas.getBoundingClientRect();
        const [canvasX, canvasY] = getCanvasXAndCanvasYValues(
          event,
          canvasRect,
        );
        applyColorAtPosition(canvasX, canvasY);
      });
    }
  }

  // Attach click event to open custom color picker
  if (colorButton) {
    colorButton.addEventListener("click", (event) => {
      event.preventDefault();
      if (colorPicker) {
        colorPicker.open(window.selectedColor);
      }
    });
  }
});

function pickMeshFromCanvas() {
  const canvas = flock.scene?.getEngine?.().getRenderingCanvas?.();
  if (!canvas || !flock.scene) return;

  const onPickMesh = function (event) {
    const canvasRect = canvas.getBoundingClientRect();

    // Exit if outside canvas
    if (eventIsOutOfCanvasBounds(event, canvasRect)) {
      window.removeEventListener("click", onPickMesh);
      stopCanvasKeyboardMode();
      // restore cursors
      document.body.style.cursor = "default";
      flock.scene.defaultCursor = "";
      return;
    }

    const [canvasX, canvasY] = getCanvasXAndCanvasYValues(event, canvasRect);
    applyColorAtPosition(canvasX, canvasY);
    document.body.style.cursor = "crosshair";
    canvas.style.cursor = "crosshair";
  };

  startCanvasKeyboardMode((x, y) => applyColorAtPosition(x, y));
  document.body.style.cursor = "crosshair";
  canvas.style.cursor = "crosshair";

  setTimeout(() => {
    window.addEventListener("click", onPickMesh);
  }, 200);
}

function applyColorAtPosition(canvasX, canvasY) {
  const scene = flock.scene;

  if (scene.selectionOctree) scene.createOrUpdateSelectionOctree();

  const pickRay = scene.createPickingRay(
    canvasX,
    canvasY,
    flock.BABYLON.Matrix.Identity(),
    scene.activeCamera,
  );

  const pickedMesh = pickLeafFromRay(pickRay, scene);

  if (pickedMesh) {
    updateBlockColorAndHighlight(pickedMesh, window.selectedColor);
  } else {
    flock.setSky(window.selectedColor);
    updateBlockColorAndHighlight(meshMap?.["sky"], window.selectedColor);
  }
}

// For composite meshes where visibility needs setting to
// 0.001 in order to show parent mesh's bounding box
function resetBoundingBoxVisibilityIfManuallyChanged(mesh) {
  if (mesh && mesh.visibility === 0.001) mesh.visibility = 0;
}

function hideBoundingBox(mesh) {
  mesh.showBoundingBox = false;
}

function resetChildMeshesOfAttachedMesh() {
  gizmoManager?.attachedMesh
    .getChildMeshes()
    .forEach((child) => hideBoundingBox(child));
}

function resetAttachedMesh() {
  if (!gizmoManager?.attachedMesh) return;
  hideBoundingBox(gizmoManager.attachedMesh);
  resetChildMeshesOfAttachedMesh();
}

function resetAttachedMeshIfMeshAttached() {
  if (gizmoManager?.attachedMesh) {
    resetAttachedMesh();
  }
}

function attachMeshForActiveTool(pickedMesh) {
  if (!gizmoManager) return null;

  if (!pickedMesh || pickedMesh.name === "ground") {
    gizmoManager.attachToMesh(null);
    return null;
  }

  if (pickedMesh.parent) {
    pickedMesh = getRootMesh(pickedMesh.parent);
  }

  gizmoManager.attachToMesh(pickedMesh);

  const blockId = meshMap[pickedMesh?.metadata?.blockKey];
  if (blockId) {
    highlightBlockById(Blockly.getMainWorkspace(), blockId);
  }

  return pickedMesh;
}

function eventIsOutOfCanvasBounds(event, canvasRect) {
  return (
    event.clientX < canvasRect.left ||
    event.clientX > canvasRect.right ||
    event.clientY < canvasRect.top ||
    event.clientY > canvasRect.bottom
  );
}

function deleteBlockWithUndo(blockId) {
  const workspace = Blockly.getMainWorkspace();
  const block = workspace.getBlockById(blockId);

  if (block) {
    Blockly.Events.setGroup(true);
    try {
      const parentBlock = block.getParent();

      // Store reference to parent block before deletion
      let shouldCheckStartBlock = false;
      let startBlock = null;
      if (parentBlock && parentBlock.type === "start") {
        startBlock = parentBlock;
        shouldCheckStartBlock = true;
      }

      // Delete the selected block
      block.dispose(true);

      // After deletion, check if the start block is now empty
      if (shouldCheckStartBlock && startBlock) {
        let remainingChildren = 0;

        // Count remaining input-connected blocks
        startBlock.inputList.forEach((input) => {
          if (input.connection && input.connection.targetBlock()) {
            remainingChildren++;
          }
        });

        // Check if the start block still has a next block
        if (
          startBlock.nextConnection &&
          startBlock.nextConnection.targetBlock()
        ) {
          remainingChildren++;
        }

        // If no children remain, delete the start block
        if (remainingChildren === 0) {
          startBlock.dispose(true);
        }
      }
    } finally {
      Blockly.Events.setGroup(false);
    }

    gizmoManager.attachToMesh(null);
    turnOffAllGizmos();
  } else {
    console.log(`Block with ID ${blockId} not found.`);
  }
}

function focusCameraOnMesh() {
  let mesh = gizmoManager.attachedMesh;
  if (mesh && mesh.name === "ground") mesh = null;
  if (!mesh && window.currentBlock) {
    mesh = getMeshFromBlock(window.currentBlock);
    if (mesh && mesh.name === "ground") mesh = null;
  }
  if (!mesh) return;

  mesh.computeWorldMatrix(true);
  const { min, max } = mesh.getHierarchyBoundingVectors(true);
  const newTarget = flock.BABYLON.Vector3.Center(min, max);

  if (flock.scene.activeCamera?.metadata?.following) {
    handleCameraGizmo();
  }

  const camera = flock.scene.activeCamera;
  const currentDistance = camera.radius || 10;
  const currentYPosition = camera.position.y;

  camera.position = new flock.BABYLON.Vector3(
    newTarget.x,
    currentYPosition,
    newTarget.z - currentDistance,
  );
  camera.setTarget(newTarget);
}

function viewMeshWithCamera() {
  let mesh = gizmoManager.attachedMesh;
  if (mesh && mesh.name === "ground") mesh = null;

  if (!mesh && window.currentBlock) {
    mesh = getMeshFromBlock(window.currentBlock);
    if (mesh && mesh.name === "ground") mesh = null;
  }

  const camera = flock.scene.activeCamera;

  if (!camera?.metadata?.following) {
    if (mesh) focusCameraOnMesh();
    return;
  }

  if (!mesh) return;

  const BABYLON = flock.BABYLON;
  const player = camera.metadata.following;

  mesh.computeWorldMatrix(true);
  const { min, max } = mesh.getHierarchyBoundingVectors(true);
  const target = BABYLON.Vector3.Center(min, max);

  const size = max.subtract(min);
  const extent = Math.max(size.x, size.y, size.z);

  const playerY = player.position.y;
  const playerDistance = Math.max(extent * 2, 4);

  // Try a few candidate directions around the mesh.
  const candidateAngles = [
    -Math.PI / 2,
    0,
    Math.PI / 2,
    Math.PI,
    -Math.PI / 4,
    Math.PI / 4,
    (3 * Math.PI) / 4,
    (-3 * Math.PI) / 4,
  ];

  let chosenPlayerPos = null;
  let chosenYaw = null;

  const scene = flock.scene;
  const ignoreSet = new Set([mesh, player]);
  mesh.getChildMeshes?.(false).forEach((m) => ignoreSet.add(m));
  player.getChildMeshes?.(false).forEach((m) => ignoreSet.add(m));

  function isBlockingMesh(hitMesh) {
    if (!hitMesh) return false;
    if (ignoreSet.has(hitMesh)) return false;
    if (hitMesh.name === "ground") return false;
    if (!hitMesh.isEnabled?.()) return false;
    if (!hitMesh.isVisible) return false;
    return hitMesh.isPickable !== false;
  }

  function getYawToTarget(fromPos, toPos) {
    const dir = toPos.subtract(fromPos);
    return Math.atan2(dir.x, dir.z);
  }

  function hasClearView(playerPos, yaw) {
    // Camera behind player, looking towards player/mesh.
    const testRadius = Math.max(extent / 2, 5);
    const testBeta = Math.PI / 3;

    // For ArcRotateCamera around player:
    // x offset = radius * cos(alpha) * sin(beta)
    // z offset = radius * sin(alpha) * sin(beta)
    // To put camera behind player relative to yaw:
    const alpha = -yaw - Math.PI / 2;

    const camPos = new BABYLON.Vector3(
      playerPos.x + testRadius * Math.cos(alpha) * Math.sin(testBeta),
      playerPos.y + testRadius * Math.cos(testBeta),
      playerPos.z + testRadius * Math.sin(alpha) * Math.sin(testBeta),
    );

    const direction = target.subtract(camPos);
    const length = direction.length();
    if (length < 0.001) return true;

    const ray = new BABYLON.Ray(camPos, direction.normalize(), length);
    const hit = scene.pickWithRay(ray, (candidate) =>
      isBlockingMesh(candidate),
    );
    return !hit?.hit;
  }

  for (const angle of candidateAngles) {
    const playerPos = new BABYLON.Vector3(
      target.x - Math.cos(angle) * playerDistance,
      playerY,
      target.z - Math.sin(angle) * playerDistance,
    );

    const yaw = getYawToTarget(playerPos, target);

    if (hasClearView(playerPos, yaw)) {
      chosenPlayerPos = playerPos;
      chosenYaw = yaw;
      break;
    }

    if (!chosenPlayerPos) {
      chosenPlayerPos = playerPos;
      chosenYaw = yaw;
    }
  }

  if (!chosenPlayerPos) return;

  const PLAYER_FORWARD_OFFSET = Math.PI;
  const playerRotation = BABYLON.Quaternion.FromEulerAngles(
    0,
    chosenYaw + PLAYER_FORWARD_OFFSET,
    0,
  );

  player.position.copyFrom(chosenPlayerPos);
  player.rotationQuaternion = playerRotation;

  if (player.physics) {
    player.physics.setTargetTransform(chosenPlayerPos, playerRotation);
  }

  // Keep camera following player, but place it behind the player.
  if ("lockedTarget" in camera) {
    camera.lockedTarget = player;
  }

  camera.beta = Math.PI / 2;
  camera.radius = Math.max(extent / 2, 5);

  // Behind player relative to the direction the player is facing toward the mesh.
  camera.alpha = -chosenYaw - Math.PI / 2;
}

function getScaledSize(mesh) {
  const { originalMin, originalMax } = mesh.metadata || {};
  const min = originalMin ?? mesh.getBoundingInfo().boundingBox.minimum;
  const max = originalMax ?? mesh.getBoundingInfo().boundingBox.maximum;

  const baseX = max.x - min.x;
  const baseY = max.y - min.y;
  const baseZ = max.z - min.z;

  return {
    x: baseX * Math.abs(mesh.scaling.x),
    y: baseY * Math.abs(mesh.scaling.y),
    z: baseZ * Math.abs(mesh.scaling.z),
  };
}

// Clean up gizmo state if aborted
export function exitGizmoState() {
  cleanupScenePick(); // Stop picking

  // Properly clean up if duplicating
  if (activeDuplicatePickHandler) {
    window.removeEventListener("click", activeDuplicatePickHandler);
    activeDuplicatePickHandler = null;
  }

  // Stop the axis keyboard
  stopAxisKeyboard?.();
  stopAxisKeyboard = null;

  // Run all queued cleanup functions
  runCleanups();

  // Remove active class from all buttons
  document
    .querySelectorAll(".gizmo-button")
    .forEach((btn) => btn.classList.remove("active"));
  disableGizmos();
  document.body.style.cursor = "default";
}

// Start the keyboard handler for moving a mesh
function startMoveKeyboardHandler(mesh) {
  document.body.style.cursor = "default";
  stopAxisKeyboard?.();
  stopAxisKeyboard = null;
  setTimeout(() => {
    stopAxisKeyboard = createAxisKeyboardHandler({
      onMove: (dx, dy, dz) => {
        mesh.position.x += dx;
        mesh.position.y += dy;
        mesh.position.z += dz;
        mesh.computeWorldMatrix(true);
        const block = meshMap[mesh?.metadata?.blockKey];
        if (block) {
          const pos = flock.getBlockPositionFromMesh(mesh);
          setBlockXYZ(block, pos.x, pos.y, pos.z);
        }
      },
      onConfirm: () => {
        exitGizmoState();
        document.getElementById("positionButton")?.focus();
      },
      onCancel: () => {
        exitGizmoState();
        // Deselect so you get [select mesh] for next tool
        gizmoManager.attachToMesh(null);
        document.getElementById("positionButton")?.focus();
      },
      stepNormal: DEFAULT_CURSOR,
      stepFast: FAST_CURSOR,
    });
  }, 0);
}

// Rotate a mesh using the keyboard
function startRotateKeyboardHandler(mesh) {
  document.body.style.cursor = "default";
  stopAxisKeyboard?.();
  stopAxisKeyboard = null;
  setTimeout(() => {
    stopAxisKeyboard = createAxisKeyboardHandler({
      onMove: (dx, dy, dz) => {
        if (mesh.rotationQuaternion) {
          mesh.rotation = mesh.rotationQuaternion.toEulerAngles();
          mesh.rotationQuaternion = null;
        }
        mesh.rotation.x += dx;
        mesh.rotation.y += dy;
        mesh.rotation.z += dz;
      },
      onConfirm: () => {
        updateRotationBlock(mesh); // Update/create blockly block
        exitGizmoState();
        document.getElementById("rotationButton")?.focus();
      },
      onCancel: () => {
        updateRotationBlock(mesh); // Update/create blockly block
        exitGizmoState();
        gizmoManager.attachToMesh(null);
        document.getElementById("rotationButton")?.focus();
      },
      stepNormal: DEFAULT_ROTATION,
      stepFast: FAST_ROTATION,
    });
  }, 0);
}

// Scale a mesh using the keyboard
function startScaleKeyboardHandler(mesh) {
  document.body.style.cursor = "default";
  stopAxisKeyboard?.();
  stopAxisKeyboard = null;
  setTimeout(() => {
    stopAxisKeyboard = createAxisKeyboardHandler({
      onMove: (dx, dy, dz) => {
        mesh.scaling.x = Math.max(0.01, mesh.scaling.x + dx);
        mesh.scaling.y = Math.max(0.01, mesh.scaling.y + dy);
        mesh.scaling.z = Math.max(0.01, mesh.scaling.z + dz);
        flock.updatePhysics(mesh);
      },
      onConfirm: () => {
        updateScaleBlock(mesh);
        exitGizmoState();
        document.getElementById("scaleButton")?.focus();
      },
      onCancel: () => {
        updateScaleBlock(mesh);
        exitGizmoState();
        gizmoManager.attachToMesh(null);
        document.getElementById("scaleButton")?.focus();
      },
      stepNormal: DEFAULT_SCALE,
      stepFast: FAST_SCALE,
    });
  }, 0);
}

// Update the blockly block after a rotation
function updateRotationBlock(mesh) {
  const block = meshMap[mesh?.metadata?.blockKey];
  if (!block) return;

  const groupId = Blockly.utils.idGenerator.genUid();
  Blockly.Events.setGroup(groupId);

  let addedDoSection = false;
  if (!block.getInput("DO")) {
    block.appendStatementInput("DO").setCheck(null).appendField("");
    addedDoSection = true;
  }

  let rotateBlock = null;
  const modelVariable = block.getFieldValue("ID_VAR");
  const statementConnection = block.getInput("DO").connection;
  if (statementConnection?.targetBlock()) {
    let currentBlock = statementConnection.targetBlock();
    while (currentBlock) {
      if (
        currentBlock.type === "rotate_to" &&
        currentBlock.getFieldValue("MODEL") === modelVariable
      ) {
        rotateBlock = currentBlock;
        break;
      }
      currentBlock = currentBlock.getNextBlock();
    }
  }

  if (!rotateBlock) {
    rotateBlock = Blockly.getMainWorkspace().newBlock("rotate_to");
    rotateBlock.setFieldValue(modelVariable, "MODEL");
    rotateBlock.initSvg();
    rotateBlock.render();
    ["X", "Y", "Z"].forEach((axis) => {
      const input = rotateBlock.getInput(axis);
      const shadow = Blockly.getMainWorkspace().newBlock("math_number");
      shadow.setFieldValue("1", "NUM");
      shadow.setShadow(true);
      shadow.initSvg();
      shadow.render();
      input.connection.connect(shadow.outputConnection);
    });
    rotateBlock.render();

    // Make sure not to replace any existing blocks in DO
    const firstBlock = statementConnection.targetBlock();
    if (firstBlock) {
      let tail = firstBlock;
      while (tail.getNextBlock()) tail = tail.getNextBlock();
      tail.nextConnection.connect(rotateBlock.previousConnection);
    } else {
      block.getInput("DO").connection.connect(rotateBlock.previousConnection);
    }

    gizmoCreatedBlocks.set(rotateBlock.id, {
      parentId: block.id,
      createdDoSection: addedDoSection,
      timestamp: Date.now(),
    });
  }

  const currentRotation = getMeshRotationInDegrees(mesh);
  setBlockXYZ(
    rotateBlock,
    currentRotation.x,
    currentRotation.y,
    currentRotation.z,
  );
  Blockly.Events.setGroup(null);
}

// Pick a mesh (used by multiple gizmos)
function pickMeshFromScene(onPicked, persistent = false) {
  cleanupScenePick(); // Stop picking
  resetAttachedMesh();

  const pointerObservable = flock.scene.onPointerObservable;
  const pointerObserver = pointerObservable.add((event) => {
    if (event.type === flock.BABYLON.PointerEventTypes.POINTERPICK) {
      if (!persistent) cleanupScenePick();
      onPicked(event.pickInfo.pickedMesh, event.pickInfo.pickedPoint);
    }
  });

  activePick = { pointerObservable, pointerObserver };

  setTimeout(() => {
    startCanvasKeyboardMode(
      (x, y) => {
        const pick = flock.scene.pick(x, y);
        if (!persistent) cleanupScenePick();
        onPicked(pick?.pickedMesh, pick?.pickedPoint);
      },
      false,
      (x, y) =>
        !!flock.scene.pick(x, y, (m) => m.isPickable && m.name !== "ground")
          ?.hit,
    );
    document.body.style.cursor = "crosshair";
    flock.scene.defaultCursor = "crosshair";
  }, 0);
}

// Update blockly block after a scale
function updateScaleBlock(mesh, originalBottomY = null) {
  const block = meshMap[mesh?.metadata?.blockKey];
  if (!block) return;

  flock.updatePhysics(mesh);

  try {
    const ensureFreshBounds = (m) => {
      m.computeWorldMatrix(true);
      m.refreshBoundingInfo();
      return m.getBoundingInfo().boundingBox;
    };

    const bbox = ensureFreshBounds(mesh);
    const newBottomY = bbox.minimumWorld.y;
    if (originalBottomY !== null) {
      mesh.position.y += originalBottomY - newBottomY;
    }

    const sizeLocal = bbox.extendSize.scale(2);
    const w = sizeLocal.x * mesh.scaling.x;
    const h = sizeLocal.y * mesh.scaling.y;
    const d = sizeLocal.z * mesh.scaling.z;

    switch (block.type) {
      case "create_plane":
        setNumberInputs(block, { WIDTH: w, HEIGHT: h });
        break;

      case "create_box":
        setNumberInputs(block, { WIDTH: w, HEIGHT: h, DEPTH: d });
        break;

      case "create_capsule":
        setNumberInputs(block, { HEIGHT: h, DIAMETER: w });
        break;

      case "create_cylinder": {
        const newScaledDiameter = w;

        const currentTop = getNumberInput(block, "DIAMETER_TOP");
        const currentBottom = getNumberInput(block, "DIAMETER_BOTTOM");

        let newTop;
        let newBottom;

        if (
          Number.isFinite(currentTop) &&
          Number.isFinite(currentBottom) &&
          currentTop > 0 &&
          currentBottom > 0
        ) {
          if (currentTop >= currentBottom) {
            newTop = newScaledDiameter;
            newBottom = newTop * (currentBottom / currentTop);
          } else {
            newBottom = newScaledDiameter;
            newTop = newBottom * (currentTop / currentBottom);
          }
        } else {
          newTop = newScaledDiameter;
          newBottom = newScaledDiameter;
        }

        setNumberInputs(block, {
          HEIGHT: h,
          DIAMETER_TOP: newTop,
          DIAMETER_BOTTOM: newBottom,
        });
        break;
      }

      case "create_sphere":
        setNumberInputs(block, {
          DIAMETER_X: w,
          DIAMETER_Y: h,
          DIAMETER_Z: d,
        });
        break;

      case "create_3d_text": {
        const currentSize = getNumberInput(block, "SIZE");
        const currentDepth = getNumberInput(block, "DEPTH");
        setNumberInputs(block, {
          SIZE: currentSize * mesh.scaling.y,
          DEPTH: currentDepth * mesh.scaling.z,
        });
        break;
      }

      case "load_model":
      case "load_multi_object":
      case "load_object":
      case "load_character": {
        const groupId = Blockly.utils.idGenerator.genUid();
        Blockly.Events.setGroup(groupId);

        let addedDoSection = false;
        if (!block.getInput("DO")) {
          block.appendStatementInput("DO").setCheck(null).appendField("");
          addedDoSection = true;
        }

        let resizeBlock = null;
        const modelVariable = block.getFieldValue("ID_VAR");

        const stmt = block.getInput("DO")?.connection?.targetBlock?.();
        for (let cur = stmt; cur; cur = cur.getNextBlock?.()) {
          if (
            cur.type === "resize" &&
            cur.getFieldValue?.("BLOCK_NAME") === modelVariable
          ) {
            resizeBlock = cur;
            break;
          }
        }

        if (!resizeBlock) {
          resizeBlock = Blockly.getMainWorkspace().newBlock("resize");
          resizeBlock.setFieldValue(modelVariable, "BLOCK_NAME");
          resizeBlock.initSvg();
          resizeBlock.render();

          ["X", "Y", "Z"].forEach((axis) => {
            const input = resizeBlock.getInput(axis);
            const shadow = Blockly.getMainWorkspace().newBlock("math_number");
            shadow.setFieldValue("1", "NUM");
            shadow.setShadow(true);
            shadow.initSvg();
            shadow.render();
            input.connection.connect(shadow.outputConnection);
          });

          resizeBlock.render();

          const doFirstBlock = block.getInput("DO").connection.targetBlock();
          if (doFirstBlock) {
            let tail = doFirstBlock;
            while (tail.getNextBlock()) tail = tail.getNextBlock();
            tail.nextConnection.connect(resizeBlock.previousConnection);
          } else {
            block
              .getInput("DO")
              .connection.connect(resizeBlock.previousConnection);
          }

          gizmoCreatedBlocks.set(resizeBlock.id, {
            parentId: block.id,
            createdDoSection: addedDoSection,
            timestamp: Date.now(),
          });
        }
        mesh.computeWorldMatrix(true);
        mesh.refreshBoundingInfo();
        const sizeLocalScaled = getScaledSize(mesh);

        setNumberInputs(resizeBlock, {
          X: sizeLocalScaled.x,
          Y: sizeLocalScaled.y,
          Z: sizeLocalScaled.z,
        });

        Blockly.Events.setGroup(null);
        break;
      }
    }
  } catch (e) {
    console.error("Error updating block values:", e);
  }
}

function startDuplicatePlacement() {
  let blockKey, blockId, canvas, onPickMesh;
  if (!gizmoManager.attachedMesh) {
    flock.printText({
      text: translate("select_mesh_duplicate_prompt"),
      duration: 30,
      color: "black",
    });
    return;
  }
  blockKey = findParentWithBlockId(gizmoManager.attachedMesh)?.metadata
    ?.blockKey;

  // Make sure that if there is already a selected mesh
  // its bounding box is visible so the user knows what they are duplicating
  const meshToClone = gizmoManager.attachedMesh;
  meshToClone.showBoundingBox = true;

  blockId = meshBlockIdMap[blockKey];

  setCrosshairCursor();

  canvas = flock.scene.getEngine().getRenderingCanvas(); // Get the flock.BABYLON.js canvas

  onPickMesh = function (event) {
    const canvasRect = canvas.getBoundingClientRect();

    if (eventIsOutOfCanvasBounds(event, canvasRect)) {
      window.removeEventListener("click", onPickMesh);
      meshToClone.showBoundingBox = false;
      exitGizmoState();
      return;
    }

    const [canvasX, canvasY] = getCanvasXAndCanvasYValues(event, canvasRect);

    const pickRay = flock.scene.createPickingRay(
      canvasX,
      canvasY,
      flock.BABYLON.Matrix.Identity(),
      flock.scene.activeCamera,
    );

    const pickResult = flock.scene.pickWithRay(
      pickRay,
      (mesh) => mesh.isPickable,
    );

    if (pickResult.hit) {
      const pickedPosition = pickResult.pickedPoint;
      const workspace = Blockly.getMainWorkspace();
      const originalBlock = workspace.getBlockById(blockId);
      // If they deleted the original block while picking, exit gracefully
      if (!originalBlock) {
        meshToClone.showBoundingBox = false;
        exitGizmoState();
        return;
      }
      // Otherwise carry on adding the new block
      const newBlock = duplicateBlockAndInsert(
        originalBlock,
        workspace,
        pickedPosition,
      );
      if (newBlock) {
        highlightBlockById(workspace, newBlock);
      }
    }
  };

  // Store a reference to this listener so we can get rid of it
  // if they abort half way through a duplication
  activeDuplicatePickHandler = onPickMesh;

  // Use setTimeout to defer listener setup
  setTimeout(() => {
    window.addEventListener("click", onPickMesh);
  }, 50);

  // Keyboard mode: use canvas circle to place the duplicate
  setTimeout(() => {
    startCanvasKeyboardMode(
      (x, y) => {
        const pickResult = flock.scene.pick(x, y, (mesh) => mesh.isPickable);
        if (pickResult?.hit) {
          const workspace = Blockly.getMainWorkspace();
          const originalBlock = workspace.getBlockById(blockId);
          // If they deleted the original block while picking, exit gracefully
          if (!originalBlock) {
            meshToClone.showBoundingBox = false;
            exitGizmoState();
            return;
          }
          const newBlock = duplicateBlockAndInsert(
            originalBlock,
            workspace,
            pickResult.pickedPoint,
          );
          if (newBlock) {
            highlightBlockById(workspace, newBlock);
          }
        }
      },
      false,
      (x, y) => !!flock.scene.pick(x, y, (mesh) => mesh.isPickable)?.hit,
    );
    flock.scene.defaultCursor = "crosshair";
  }, 0);
}

// Clean up after picking
function cleanupScenePick() {
  if (activePick) {
    activePick.pointerObservable.remove(activePick.pointerObserver);
    activePick = null;
  }
  stopCanvasKeyboardMode();
  setDefaultCursor();
}

// Add to list of cleanup we need to run
function onExit(fn) {
  cleanupFns.push(fn);
}

// Run all the cleanup functions
function runCleanups() {
  cleanupFns.forEach((fn) => fn());
  cleanupFns.length = 0;
}

export function disableGizmos() {
  if (!gizmoManager) return;
  // Disable all gizmos
  gizmoManager.positionGizmoEnabled = false;
  gizmoManager.rotationGizmoEnabled = false;
  gizmoManager.scaleGizmoEnabled = false;
  gizmoManager.boundingBoxGizmoEnabled = false;
  stopCanvasKeyboardMode();
}

// Toggle which Gizmo is being used
export function toggleGizmo(gizmoType) {
  // Is this gizmo already active? If so, toggle it off
  const button = document.getElementById(`${gizmoType}Button`);
  if (button?.classList.contains("active")) {
    exitGizmoState();
    return;
  }

  // No buttons should be highlighted
  document
    .querySelectorAll(".gizmo-button")
    .forEach((btn) => btn.classList.remove("active"));

  // If they abandoned a duplicate half way, remove listener
  if (gizmoType === "duplicate" && activeDuplicatePickHandler) {
    exitGizmoState();
    return;
  }

  exitGizmoState(); // Clean up any existing gizmo state
  resetAttachedMeshIfMeshAttached();

  document.body.style.cursor = "default";

  // Enable the selected gizmo
  switch (gizmoType) {
    case "camera":
      handleCameraGizmo();
      break;
    case "delete":
      handleDeleteGizmo();
      break;
    case "duplicate":
      handleDuplicateGizmo();
      break;
    case "select":
      handleSelectGizmo();
      break;
    case "position":
      handlePositionGizmo();
      break;
    case "rotation":
      handleRotationGizmo();
      break;
    case "scale":
      handleScaleGizmo();
      break;
    /*
    case "boundingBox":
      gizmoManager.boundingBoxGizmoEnabled = true;
      break;
    case "bounds":
      handleBoundsGizmo();
      break;
    */
    case "focus":
      focusCameraOnMesh();
      break;
    default:
      break;
  }
}

// Scale: Allow the user to scale the mesh by dragging it
function handleScaleGizmo() {
  configureScaleGizmo(gizmoManager);
  {
    const sg = gizmoManager.gizmos.scaleGizmo;
    if (!sg._textAxisObserversRegistered) {
      sg.xGizmo.dragBehavior.onDragStartObservable.add(
        () => (textScaleAxis = "x"),
      );
      sg.yGizmo.dragBehavior.onDragStartObservable.add(
        () => (textScaleAxis = "y"),
      );
      sg.zGizmo.dragBehavior.onDragStartObservable.add(
        () => (textScaleAxis = "z"),
      );
      sg.uniformScaleGizmo.dragBehavior.onDragStartObservable.add(
        () => (textScaleAxis = "uniform"),
      );
      sg._textAxisObserversRegistered = true;
    }
  }

  // Highlight scale button
  const scaleButton = document.getElementById("scaleButton");
  scaleButton.classList.add("active");

  const mesh = gizmoManager.attachedMesh;
  if (mesh) {
    startScaleKeyboardHandler(mesh);
  } else {
    pickMeshFromScene((pickedMesh) => {
      if (!pickedMesh || pickedMesh.name === "ground") {
        exitGizmoState();
        return;
      }
      attachMeshForActiveTool(pickedMesh);
    });
  }

  let lastScaledMesh = gizmoManager.attachedMesh;
  const scaleObs = gizmoManager.onAttachedToMeshObservable.add((mesh) => {
    if (!mesh) {
      updateScaleBlock(lastScaledMesh); // update blockly block
      exitGizmoState();
      gizmoManager.attachToMesh(null); // unselect
      return;
    }

    lastScaledMesh = mesh;
    startScaleKeyboardHandler(mesh);

    const blockKey = mesh?.metadata?.blockKey;
    const blockId = blockKey ? meshMap[blockKey] : null;
    if (!blockId) return;

    highlightBlockById(Blockly.getMainWorkspace(), blockId);
  });

  onExit(() => gizmoManager.onAttachedToMeshObservable.remove(scaleObs));

  // Track bottom for correct visual anchoring
  let originalBottomY = 0;

  const scaleDrag = gizmoManager.gizmos.scaleGizmo.onDragObservable.add(() => {
    const mesh = gizmoManager.attachedMesh;

    mesh.computeWorldMatrix(true);
    mesh.refreshBoundingInfo();

    const newBottomY = mesh.getBoundingInfo().boundingBox.minimumWorld.y;
    const deltaY = originalBottomY - newBottomY;
    mesh.position.y += deltaY;

    const block = Blockly.getMainWorkspace().getBlockById(
      mesh?.metadata?.blockKey,
    );
    if (gizmoManager.scaleGizmoEnabled) {
      switch (block?.type) {
        case "create_capsule":
        case "create_cylinder":
          mesh.scaling.z = mesh.scaling.x;
          break;
        case "create_3d_text":
          if (textScaleAxis === "z") {
            // Z handle: depth only — lock X and Y
            mesh.scaling.x = 1;
            mesh.scaling.y = 1;
          } else if (textScaleAxis === "x" || textScaleAxis === "uniform") {
            // X or uniform: size only — keep Y = X, lock Z
            mesh.scaling.y = mesh.scaling.x;
            mesh.scaling.z = textOrigScaleZ;
          } else if (textScaleAxis === "y") {
            // Y handle: size only — keep X = Y, lock Z
            mesh.scaling.x = mesh.scaling.y;
            mesh.scaling.z = textOrigScaleZ;
          }
          break;
      }
    }
  });

  onExit(() =>
    gizmoManager.gizmos.scaleGizmo.onDragObservable.remove(scaleDrag),
  );

  const scaleDragStart =
    gizmoManager.gizmos.scaleGizmo.onDragStartObservable.add(() => {
      const mesh = gizmoManager.attachedMesh;
      flock.ensureUniqueGeometry(mesh);
      mesh.computeWorldMatrix(true);
      mesh.refreshBoundingInfo();
      originalBottomY = mesh.getBoundingInfo().boundingBox.minimumWorld.y;
      textOrigScaleZ = mesh.scaling.z;
      textScaleAxis = null;

      const motionType = mesh.physics?.getMotionType();
      mesh.savedMotionType = motionType;

      if (
        mesh.physics &&
        mesh.physics.getMotionType() !==
          flock.BABYLON.PhysicsMotionType.ANIMATED
      ) {
        mesh.physics.setMotionType(flock.BABYLON.PhysicsMotionType.ANIMATED);
        mesh.physics.disablePreStep = false;
      }

      const block = meshMap[mesh?.metadata?.blockKey];
      highlightBlockById(Blockly.getMainWorkspace(), block);
    });

  onExit(() =>
    gizmoManager.gizmos.scaleGizmo.onDragStartObservable.remove(scaleDragStart),
  );

  const scaleDragEnd = gizmoManager.gizmos.scaleGizmo.onDragEndObservable.add(
    () => {
      const mesh = gizmoManager.attachedMesh;
      textScaleAxis = null;

      if (mesh.savedMotionType != null) {
        mesh.physics.setMotionType(mesh.savedMotionType);
      }
      updateScaleBlock(mesh, originalBottomY);
    },
  );

  onExit(() =>
    gizmoManager.gizmos.scaleGizmo.onDragEndObservable.remove(scaleDragEnd),
  );
}

// Rotation: Allow the user to rotate the mesh by dragging it
function handleRotationGizmo() {
  configureRotationGizmo(gizmoManager);

  // Show that rotation is active
  const rotationButton = document.getElementById("rotationButton");
  rotationButton.classList.add("active");

  const mesh = gizmoManager.attachedMesh;
  if (mesh) {
    startRotateKeyboardHandler(mesh);
  } else {
    pickMeshFromScene((pickedMesh) => {
      if (!pickedMesh || pickedMesh.name === "ground") {
        exitGizmoState();
        return;
      }
      attachMeshForActiveTool(pickedMesh);
    });
  }

  let lastRotatedMesh = gizmoManager.attachedMesh;

  const rotateObs = gizmoManager.onAttachedToMeshObservable.add((mesh) => {
    if (!mesh) {
      updateRotationBlock(lastRotatedMesh); // properly update block if they click out
      exitGizmoState();
      gizmoManager.attachToMesh(null);
      return;
    }

    lastRotatedMesh = mesh;

    startRotateKeyboardHandler(mesh);

    const blockKey = mesh?.metadata?.blockKey;
    const blockId = blockKey ? meshMap[blockKey] : null;
    if (!blockId) return;

    highlightBlockById(Blockly.getMainWorkspace(), blockId);
  });

  onExit(() => gizmoManager.onAttachedToMeshObservable.remove(rotateObs));

  const rotDragStart =
    gizmoManager.gizmos.rotationGizmo.onDragStartObservable.add(() => {
      let mesh = gizmoManager.attachedMesh;
      if (!mesh) return;

      if (!mesh.physics) return;

      const motionType =
        mesh.physics?.getMotionType?.() ??
        flock.BABYLON.PhysicsMotionType.STATIC;
      mesh.savedMotionType = motionType;

      if (
        mesh.physics &&
        mesh.physics.getMotionType?.() !==
          flock.BABYLON.PhysicsMotionType.ANIMATED
      ) {
        mesh.physics.setMotionType(flock.BABYLON.PhysicsMotionType.ANIMATED);
        mesh.physics.disablePreStep = false;
      }
    });

  onExit(() =>
    gizmoManager.gizmos.rotationGizmo.onDragStartObservable.remove(
      rotDragStart,
    ),
  );

  const rotDragEnd = gizmoManager.gizmos.rotationGizmo.onDragEndObservable.add(
    function () {
      let mesh = gizmoManager.attachedMesh;
      while (mesh?.parent && !mesh.parent.physics) {
        mesh = mesh.parent;
      }

      // Is there any physics to restore?
      if (mesh?.physics && mesh.savedMotionType != null) {
        mesh.physics.setMotionType(mesh.savedMotionType);
      }

      updateRotationBlock(mesh); // Update blockly block
    },
  );

  onExit(() =>
    gizmoManager.gizmos.rotationGizmo.onDragEndObservable.remove(rotDragEnd),
  );
}

// Position: Allow the user to move the mesh by dragging it
function handlePositionGizmo() {
  configurePositionGizmo(gizmoManager);

  // Highlight the move button
  const positionButton = document.getElementById("positionButton");
  positionButton.classList.add("active");

  const mesh = gizmoManager.attachedMesh;
  if (mesh) {
    startMoveKeyboardHandler(mesh);
  } else {
    pickMeshFromScene((pickedMesh) => {
      if (!pickedMesh || pickedMesh.name === "ground") {
        exitGizmoState();
        return;
      }
      if (pickedMesh.parent) pickedMesh = getRootMesh(pickedMesh.parent);
      gizmoManager.attachToMesh(pickedMesh);
    });
  }

  const posObs = gizmoManager.onAttachedToMeshObservable.add((mesh) => {
    if (!mesh) {
      exitGizmoState();
      return;
    }

    startMoveKeyboardHandler(mesh); // Reattach

    const blockKey = mesh?.metadata?.blockKey;
    const blockId = blockKey ? meshMap[blockKey] : null;
    if (!blockId) return;

    highlightBlockById(Blockly.getMainWorkspace(), blockId);
  });

  onExit(() => gizmoManager.onAttachedToMeshObservable.remove(posObs));

  const posDragStart =
    gizmoManager.gizmos.positionGizmo.onDragStartObservable.add(() => {
      const mesh = gizmoManager.attachedMesh;
      if (!mesh) return;

      const motionType = mesh.physics?.getMotionType?.();
      mesh.savedMotionType = motionType;

      if (
        mesh.physics &&
        motionType &&
        motionType !== flock.BABYLON.PhysicsMotionType.ANIMATED
      ) {
        mesh.physics.setMotionType(flock.BABYLON.PhysicsMotionType.ANIMATED);
        mesh.physics.disablePreStep = false;
      }
    });

  onExit(() =>
    gizmoManager.gizmos.positionGizmo.onDragStartObservable.remove(
      posDragStart,
    ),
  );

  const posDragEnd = gizmoManager.gizmos.positionGizmo.onDragEndObservable.add(
    function () {
      const mesh = gizmoManager.attachedMesh;

      if (mesh.savedMotionType != null && mesh.physics) {
        mesh.physics.setMotionType(mesh.savedMotionType);
      }
      mesh.computeWorldMatrix(true);

      const block = meshMap[mesh?.metadata?.blockKey];

      if (block) {
        const blockPosition = flock.getBlockPositionFromMesh(mesh);
        setBlockXYZ(block, blockPosition.x, blockPosition.y, blockPosition.z);
      }
    },
  );

  onExit(() =>
    gizmoManager.gizmos.positionGizmo.onDragEndObservable.remove(posDragEnd),
  );
}

// Bounds: Allow the user to move the mesh
// Legacy?
function handleBoundsGizmo() {
  gizmoManager.boundingBoxGizmoEnabled = true;
  gizmoManager.boundingBoxDragBehavior.onDragStartObservable.add(function () {
    const mesh = gizmoManager.attachedMesh;

    if (!mesh?.physics) return;

    const motionType = mesh.physics.getMotionType?.();
    mesh.savedMotionType = motionType;

    if (
      mesh.physics &&
      motionType != null &&
      motionType !== flock.BABYLON.PhysicsMotionType.STATIC
    ) {
      mesh.physics.setMotionType(flock.BABYLON.PhysicsMotionType.STATIC);
      mesh.physics.disablePreStep = false;
    }

    const block = meshMap[mesh?.metadata?.blockKey];
    highlightBlockById(Blockly.getMainWorkspace(), block);
  });

  gizmoManager.boundingBoxDragBehavior.onDragEndObservable.add(function () {
    const mesh = gizmoManager.attachedMesh;

    if (mesh.savedMotionType != null && mesh.physics) {
      mesh.physics.setMotionType(mesh.savedMotionType);
    }

    mesh.computeWorldMatrix(true);

    const block = meshMap[mesh?.metadata?.blockKey];

    if (block) {
      const blockPosition = flock.getBlockPositionFromMesh(mesh);
      setBlockXYZ(block, blockPosition.x, blockPosition.y, blockPosition.z);
    }
  });
}

// Select: Allow the user to select a mesh by clicking on it
function handleSelectGizmo() {
  gizmoManager.selectGizmoEnabled = true;
  document.getElementById("selectButton")?.classList.add("active");

  function applySelection(pickedMesh, pickedPoint) {
    if (pickedMesh && pickedMesh.name !== "ground") {
      const position = pickedMesh.getAbsolutePosition();
      const roundedPosition = roundVectorToFixed(position, 2);
      flock.printText({
        text: translate("position_readout").replace(
          "{position}",
          String(roundedPosition),
        ),
        duration: 30,
        color: "black",
      });
      if (flock.meshDebug) console.log(pickedMesh.parent);
      if (pickedMesh.parent) {
        pickedMesh = getRootMesh(pickedMesh.parent);
        if (flock.meshDebug) console.log(pickedMesh.visibility);
        pickedMesh.visibility = 0.001;
        if (flock.meshDebug) console.log(pickedMesh.visibility);
      }
      const block = meshMap[pickedMesh?.metadata?.blockKey];
      highlightBlockById(Blockly.getMainWorkspace(), block);
      gizmoManager.attachToMesh(pickedMesh);
      pickedMesh.showBoundingBox = true;
    } else {
      if (pickedMesh && pickedMesh.name === "ground") {
        const roundedPosition = roundVectorToFixed(pickedPoint, 2);
        flock.printText({
          text: translate("position_readout").replace(
            "{position}",
            String(roundedPosition),
          ),
          duration: 30,
          color: "black",
        });
      }
      if (gizmoManager.attachedMesh) {
        resetChildMeshesOfAttachedMesh();
        gizmoManager.attachToMesh(null);
      }
    }
    setTimeout(() => {
      if (!getCanvasCircle()) document.body.style.cursor = "crosshair";
    }, 0);
  }

  // Use helper function to pick the mesh
  pickMeshFromScene(applySelection, true);
}

// Duplicate: Create a copy of the selected mesh and its corresponding block,
// and allow the user to place it by clicking on the canvas
function handleDuplicateGizmo() {
  // Set button active state
  const duplicateButton = document.getElementById("duplicateButton");
  duplicateButton.classList.add("active");

  // Check if mesh already selected, if not prompt to select
  if (!gizmoManager.attachedMesh) {
    flock.printText({
      text: translate("select_mesh_duplicate_prompt"),
      duration: 30,
      color: "black",
    });
    pickMeshFromScene((pickedMesh) => {
      if (!pickedMesh || pickedMesh.name === "ground") {
        exitGizmoState();
        return;
      }
      attachMeshForActiveTool(pickedMesh);
      startDuplicatePlacement();
    });
    return;
  }

  // Place the duplicate
  startDuplicatePlacement();
}

// Delete: Remove the selected mesh and its corresponding block
function handleDeleteGizmo() {
  // Highlight the button
  document.getElementById("deleteButton")?.classList.add("active");

  function applyDelete(pickedMesh) {
    if (!pickedMesh || pickedMesh.name === "ground") {
      if (
        document.getElementById("deleteButton")?.classList.contains("active")
      ) {
        pickMeshFromScene(applyDelete, false);
      }
      return;
    }
    const blockKey = findParentWithBlockId(pickedMesh)?.metadata?.blockKey;
    const blockId = meshBlockIdMap[blockKey];
    deleteBlockWithUndo(blockId);
    setTimeout(() => {
      if (
        document.getElementById("deleteButton")?.classList.contains("active")
      ) {
        pickMeshFromScene(applyDelete, false);
      }
    }, 0);
  }

  // If a mesh selected, delete it instantly
  if (gizmoManager.attachedMesh) {
    applyDelete(gizmoManager.attachedMesh);
    return;
  }

  // Explain how to delete
  flock.printText({
    text: translate("select_mesh_delete_prompt"),
    duration: 30,
    color: "black",
  });

  pickMeshFromScene(applyDelete);
}

// Camera: Toggle between play and fly camera modes
function handleCameraGizmo() {
  const cameraButton = document.getElementById("cameraButton");

  if (cameraMode === "play") {
    cameraMode = "fly";
    flock.printText({
      text: translate("fly_camera_instructions"),
      duration: 15,
      color: "white",
    });
    cameraButton.classList.add("active");
  } else {
    cameraMode = "play";
    cameraButton.classList.remove("active");
  }

  const currentCamera = flock.scene.activeCamera;

  flock.scene.activeCamera = flock.savedCamera;
  flock.savedCamera = currentCamera;
  // Focus the canvas so you can use the camera controls
  const canvas = flock.scene.getEngine().getRenderingCanvas();
  canvas.focus();
}

function turnOffAllGizmos() {
  if (!gizmoManager) return;
  resetBoundingBoxVisibilityIfManuallyChanged(gizmoManager.attachedMesh);
  resetAttachedMeshIfMeshAttached();
  gizmoManager.attachToMesh(null);
  disableGizmos();
}

// Add undo handler to clean up DO sections when undoing block creation
function addUndoHandler() {
  const workspace = Blockly.getMainWorkspace();

  if (workspace._gizmoUndoHandlerRegistered) return;
  workspace._gizmoUndoHandlerRegistered = true;

  workspace.addChangeListener(function (event) {
    if (event.type === Blockly.Events.BLOCK_DELETE && event.oldJson) {
      const deletedBlockId = event.blockId;

      // Check if this was a gizmo-created block
      if (gizmoCreatedBlocks.has(deletedBlockId)) {
        const blockInfo = gizmoCreatedBlocks.get(deletedBlockId);
        const { parentId, createdDoSection, timestamp } = blockInfo;

        // Remove from tracking
        gizmoCreatedBlocks.delete(deletedBlockId);

        // If this block created the DO section, check if we should remove it
        if (createdDoSection) {
          const parentBlock = workspace.getBlockById(parentId);
          if (parentBlock) {
            const doInput = parentBlock.getInput("DO");

            // Check if DO section is now empty or only contains blocks created after this one
            let shouldRemoveDoSection = true;
            if (doInput && doInput.connection.targetBlock()) {
              let currentBlock = doInput.connection.targetBlock();

              // Check all blocks in the DO section
              while (currentBlock) {
                const blockInfo = gizmoCreatedBlocks.get(currentBlock.id);

                // If there's a block that wasn't created by gizmos, or was created before this block, keep DO section
                if (!blockInfo || blockInfo.timestamp < timestamp) {
                  shouldRemoveDoSection = false;
                  break;
                }

                currentBlock = currentBlock.getNextBlock();
              }
            }

            // Remove DO section if it should be removed
            if (shouldRemoveDoSection && doInput) {
              parentBlock.removeInput("DO");
            }
          }
        }
      }
    }
  });
}

export function enableGizmos() {
  // Initialize undo handler for DO section cleanup
  addUndoHandler();

  const positionButton = document.getElementById("positionButton");
  const rotationButton = document.getElementById("rotationButton");
  const scaleButton = document.getElementById("scaleButton");
  const selectButton = document.getElementById("selectButton");
  const duplicateButton = document.getElementById("duplicateButton");
  const deleteButton = document.getElementById("deleteButton");
  const cameraButton = document.getElementById("cameraButton");
  const showShapesButton = document.getElementById("showShapesButton");
  const colorPickerButton = document.getElementById("colorPickerButton");
  const aboutButton = document.getElementById("logo");

  const scrollModelsLeftButton = document.getElementById(
    "scrollModelsLeftButton",
  );
  const scrollModelsRightButton = document.getElementById(
    "scrollModelsRightButton",
  );
  const scrollObjectsLeftButton = document.getElementById(
    "scrollObjectsLeftButton",
  );
  const scrollObjectsRightButton = document.getElementById(
    "scrollObjectsRightButton",
  );
  const scrollCharactersLeftButton = document.getElementById(
    "scrollCharactersLeftButton",
  );
  const scrollCharactersRightButton = document.getElementById(
    "scrollCharactersRightButton",
  );

  // Enable the buttons

  const buttons = [
    positionButton,
    rotationButton,
    scaleButton,
    selectButton,
    duplicateButton,
    deleteButton,
    cameraButton,
    showShapesButton,
    colorPickerButton,
    aboutButton,
    scrollModelsLeftButton,
    scrollModelsRightButton,
    scrollObjectsLeftButton,
    scrollObjectsRightButton,
    scrollCharactersLeftButton,
    scrollCharactersRightButton,
  ];

  const requiredButtons = [
    positionButton,
    rotationButton,
    scaleButton,
    selectButton,
    duplicateButton,
    deleteButton,
    cameraButton,
    showShapesButton,
    scrollModelsLeftButton,
    scrollModelsRightButton,
    scrollObjectsLeftButton,
    scrollObjectsRightButton,
    scrollCharactersLeftButton,
    scrollCharactersRightButton,
  ];
  if (requiredButtons.some((button) => !button)) return;
  buttons.forEach((button) => button?.removeAttribute("disabled"));

  // Attach event listeners
  positionButton.addEventListener("click", () => toggleGizmo("position"));
  rotationButton.addEventListener("click", () => toggleGizmo("rotation"));
  scaleButton.addEventListener("click", () => toggleGizmo("scale"));
  selectButton.addEventListener("click", () => toggleGizmo("select"));
  cameraButton.addEventListener("click", () => toggleGizmo("camera"));
  duplicateButton.addEventListener("click", () => toggleGizmo("duplicate"));
  deleteButton.addEventListener("click", () => toggleGizmo("delete"));
  showShapesButton.addEventListener("click", () => {
    exitGizmoState(); // Unhighlight other buttons
    window.showShapes();
  });
  scrollModelsLeftButton.addEventListener("click", () =>
    window.scrollModels(-1),
  );
  scrollModelsRightButton.addEventListener("click", () =>
    window.scrollModels(1),
  );
  scrollObjectsLeftButton.addEventListener("click", () =>
    window.scrollObjects(-1),
  );
  scrollObjectsRightButton.addEventListener("click", () =>
    window.scrollObjects(1),
  );
  scrollCharactersLeftButton.addEventListener("click", () =>
    window.scrollCharacters(-1),
  );
  scrollCharactersRightButton.addEventListener("click", () =>
    window.scrollCharacters(1),
  );
}

export function setGizmoManager(value) {
  gizmoManager = value;

  const originalAttach = gizmoManager.attachToMesh.bind(gizmoManager);
  let attachedMeshDisposeObserver = null;
  let meshWithDisposeObserver = null;

  const clearAttachedMeshDisposeObserver = () => {
    if (attachedMeshDisposeObserver && meshWithDisposeObserver) {
      meshWithDisposeObserver.onDisposeObservable.remove(
        attachedMeshDisposeObserver,
      );
    }

    attachedMeshDisposeObserver = null;
    meshWithDisposeObserver = null;
  };
  gizmoManager.attachToMesh = (mesh) => {
    if (mesh && mesh.name === "ground") {
      turnOffAllGizmos();
      mesh = null;
    }

    clearAttachedMeshDisposeObserver();

    if (gizmoManager.attachedMesh) {
      resetAttachedMesh();

      if (mesh) {
        while (mesh && mesh.parent && !mesh.parent.physics) {
          mesh = mesh.parent;
        }

        const block = Blockly.getMainWorkspace().getBlockById(
          mesh?.metadata?.blockKey,
        );

        if (block && gizmoManager.scaleGizmoEnabled) {
          switch (block.type) {
            case "create_plane":
            case "create_capsule":
            case "create_cylinder":
              gizmoManager.gizmos.scaleGizmo.zGizmo.isEnabled = false;

              break;

            default:
              gizmoManager.gizmos.scaleGizmo.zGizmo.isEnabled = true;
          }
        }
      }
    }

    if (mesh && mesh.physics) {
      mesh.physics.disablePreStep = false;
    }

    originalAttach(mesh);

    if (mesh) {
      meshWithDisposeObserver = mesh;
      attachedMeshDisposeObserver = mesh.onDisposeObservable.add(() => {
        clearAttachedMeshDisposeObserver();
        turnOffAllGizmos();
      });
    }
  };

  const canvas = flock.scene.getEngine().getRenderingCanvas();

  // Add event listener for keydown events on the canvas
  canvas.addEventListener("keydown", function (event) {
    if (event.keyCode === 46) {
      // KeyCode for 'Delete' key is 46
      // Handle delete action

      const blockKey = findParentWithBlockId(gizmoManager.attachedMesh)
        ?.metadata?.blockKey;
      const blockId = meshBlockIdMap[blockKey];

      deleteBlockWithUndo(blockId);
    }
  });
}

export function disposeGizmoManager() {
  exitGizmoState(); // Clear up gizmo state and event listeners
  if (cameraMode === "fly") cameraMode = "play"; // Reset camera mode
  if (gizmoManager) {
    gizmoManager.dispose();
    gizmoManager = null; // Clear the global reference for garbage collection
  }
}

export function configurePositionGizmo(
  gizmoManager,
  {
    enable = true,
    snapDistance = 0.1,
    dragDeltaRatio = 0.2,
    smoothDrag = true,
    xColor = blueColor,
    yColor = greenColor,
    zColor = orangeColor,
    updateToMatchAttachedMesh = true,
  } = {},
) {
  if (!gizmoManager) return;

  gizmoManager.positionGizmoEnabled = enable;

  const pg = gizmoManager.gizmos?.positionGizmo;
  if (!pg) return;

  pg.snapDistance = snapDistance;

  [pg.xGizmo, pg.yGizmo, pg.zGizmo].forEach((axisGizmo) => {
    const dragBehavior = axisGizmo?.dragBehavior;
    if (!dragBehavior) return;
    dragBehavior.dragDeltaRatio = dragDeltaRatio;
    dragBehavior.smoothDrag = smoothDrag;
  });

  if (pg.xGizmo?._coloredMaterial)
    pg.xGizmo._coloredMaterial.diffuseColor = xColor;
  if (pg.yGizmo?._coloredMaterial)
    pg.yGizmo._coloredMaterial.diffuseColor = yColor;
  if (pg.zGizmo?._coloredMaterial)
    pg.zGizmo._coloredMaterial.diffuseColor = zColor;

  pg.updateGizmoPositionToMatchAttachedMesh = updateToMatchAttachedMesh;
}

export function configureRotationGizmo(
  gizmoManager,
  {
    enable = true,
    xColor = blueColor,
    yColor = greenColor,
    zColor = orangeColor,
    updateToMatchAttachedMesh = false,
  } = {},
) {
  if (!gizmoManager) return;

  gizmoManager.rotationGizmoEnabled = enable;

  const rg = gizmoManager.gizmos?.rotationGizmo;
  if (!rg) return;

  if (rg.xGizmo?._coloredMaterial)
    rg.xGizmo._coloredMaterial.diffuseColor = xColor;
  if (rg.yGizmo?._coloredMaterial)
    rg.yGizmo._coloredMaterial.diffuseColor = yColor;
  if (rg.zGizmo?._coloredMaterial)
    rg.zGizmo._coloredMaterial.diffuseColor = zColor;

  rg.updateGizmoRotationToMatchAttachedMesh = updateToMatchAttachedMesh;
}

export function configureScaleGizmo(
  gizmoManager,
  {
    enable = true,
    preserveScaling = true,
    xColor = blueColor,
    yColor = greenColor,
    zColor = orangeColor,
    sensitivity = 4,
    uniformScaleRatio = 2.5,
  } = {},
) {
  if (!gizmoManager) return;

  gizmoManager.scaleGizmoEnabled = enable;

  const sg = gizmoManager.gizmos?.scaleGizmo;
  if (!sg) return;

  sg.PreserveScaling = preserveScaling;

  if (sg.xGizmo?._coloredMaterial)
    sg.xGizmo._coloredMaterial.diffuseColor = xColor;
  if (sg.yGizmo?._coloredMaterial)
    sg.yGizmo._coloredMaterial.diffuseColor = yColor;
  if (sg.zGizmo?._coloredMaterial)
    sg.zGizmo._coloredMaterial.diffuseColor = zColor;

  sg.sensitivity = sensitivity;

  if (sg.uniformScaleGizmo) sg.uniformScaleGizmo.scaleRatio = uniformScaleRatio;
}

// Export functions for global access
window.toggleGizmo = toggleGizmo;
window.turnOffAllGizmos = turnOffAllGizmos;
if (DEBUG) {
  window._debugPick = () => flock.scene.onPointerObservable._observers.length;
}
