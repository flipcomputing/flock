import * as Blockly from "blockly";
import { meshMap, meshBlockIdMap } from "../generators/generators.js";
import { flock } from "../flock.js";
import { translate } from "../main/translation.js";
import {
  getMeshFromBlockKey,
  getRootMesh,
  updateBlockColorAndHighlight,
} from "./blockmesh.js";
import {
  highlightBlockById,
  getCanvasXAndCanvasYValues,
  setBlockXYZ,
  duplicateBlockAndInsert,
  findParentWithBlockId,
  calculateYPosition,
  setNumberInputs,
  getNumberInput,
} from "./blocklyutil.js";
import {
  getMeshRotationInDegrees,
  roundVectorToFixed,
  pickLeafFromRay,
} from "./meshhelpers.js";
export let gizmoManager;

const blueColor = flock.BABYLON.Color3.FromHexString("#0072B2"); // Colour for X-axis
const greenColor = flock.BABYLON.Color3.FromHexString("#009E73"); // Colour for Y-axis
const orangeColor = flock.BABYLON.Color3.FromHexString("#D55E00"); // Colour for Z-axis

window.selectedColor = "#ffffff"; // Default color
let colorPicker = null;

// Color picking keyboard mode variables
let colorPickingKeyboardMode = false;
let colorPickingCallback = null;
let colorPickingCircle = null;
let colorPickingCirclePosition = { x: 0, y: 0 };

document.addEventListener("DOMContentLoaded", function () {
  const colorButton = document.getElementById("colorPickerButton");

  window.addEventListener(
    "keydown",
    (e) => {
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
        if (
          typeof areGizmosEnabled === "function" ? areGizmosEnabled() : true
        ) {
          disableGizmos();
          e.stopPropagation(); // avoid duplicate handlers upstream
          // don't e.preventDefault() globally unless you *need* to stop other Esc behavior
        }
      } catch (err) {
        // fail-safe: still attempt to disable
        disableGizmos?.();
      }

      // Broadcast a generic Esc event apps can listen to if they want
      window.dispatchEvent(new CustomEvent("global:escape"));
    },
    true,
  ); // capture=true so we run before scene/camera handlers

  window.addEventListener("keydown", (event) => {
    // Check if both Ctrl and the comma key (,) are pressed
    if (event.ctrlKey && event.code === "Comma" /*|| event.code === "KeyF"*/) {
      focusCameraOnMesh();
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
      target: document.body,
    });
    // Make accessible globally for translation updates
    window.flockColorPicker = colorPicker;
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

let _onPickMeshRef = null;

function pickMeshFromCanvas() {
  const canvas = flock.scene.getEngine().getRenderingCanvas();

  const onPickMesh = function (event) {
    const canvasRect = canvas.getBoundingClientRect();

    // Exit if outside canvas
    if (eventIsOutOfCanvasBounds(event, canvasRect)) {
      window.removeEventListener("click", onPickMesh);
      endColorPickingMode();
      // restore cursors
      document.body.style.cursor = "default";
      canvas.style.cursor = "auto";
      return;
    }

    const [canvasX, canvasY] = getCanvasXAndCanvasYValues(event, canvasRect);
    applyColorAtPosition(canvasX, canvasY);
    document.body.style.cursor = "crosshair";
    canvas.style.cursor = "crosshair";
  };

  startColorPickingKeyboardMode(onPickMesh);
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
    updateBlockColorAndHighlight(pickedMesh, selectedColor);
  } else {
    flock.setSky(selectedColor);
    updateBlockColorAndHighlight(meshMap?.["sky"], selectedColor);
  }
}

let cameraMode = "play";

// Color Picking Keyboard Mode Functions

function startColorPickingKeyboardMode(callback) {
  endColorPickingMode();
  colorPickingKeyboardMode = true;
  colorPickingCallback = callback;
  document.addEventListener("keydown", handleColorPickingKeydown);
  document.body.style.cursor = "crosshair";
}

function handleColorPickingKeydown(event) {
  function preventDefaultEventAndDefineColourPickingCircle() {
    event.preventDefault();
    if (!colorPickingCircle) {
      createColorPickingCircle();
      document.body.style.cursor = "none";
    }
  }

  if (!colorPickingKeyboardMode) return;

  const moveDistance = event.shiftKey ? 10 : 2;
  switch (event.key) {
    case "ArrowRight":
      preventDefaultEventAndDefineColourPickingCircle();
      colorPickingCirclePosition.x += moveDistance;
      updateColorPickingCirclePosition();
      break;
    case "ArrowLeft":
      preventDefaultEventAndDefineColourPickingCircle();
      colorPickingCirclePosition.x -= moveDistance;
      updateColorPickingCirclePosition();
      break;
    case "ArrowUp":
      preventDefaultEventAndDefineColourPickingCircle();
      colorPickingCirclePosition.y -= moveDistance;
      updateColorPickingCirclePosition();
      break;
    case "ArrowDown":
      preventDefaultEventAndDefineColourPickingCircle();
      colorPickingCirclePosition.y += moveDistance;
      updateColorPickingCirclePosition();
      break;
    case "Enter":
      event.preventDefault();
      if (colorPickingCircle) {
        applyColorAtPosition(
          colorPickingCirclePosition.x,
          colorPickingCirclePosition.y,
        );
      }
      break;
    case "Escape":
      event.preventDefault();
      break;
  }
}

function createColorPickingCircle() {
  if (colorPickingCircle) return;

  // Create the visual indicator circle
  colorPickingCircle = document.createElement("div");
  colorPickingCircle.style.cssText = `
    position: fixed;
    width: 20px;
    height: 20px;
    border: 3px solid #ffff00;
    border-radius: 50%;
    pointer-events: none;
    z-index: 10000;
    box-shadow: 0 0 0 1px rgba(0, 0, 0, 0.3), 0 0 8px rgba(255, 255, 0, 0.5);
    transform: translate(-50%, -50%);
  `;
  document.body.appendChild(colorPickingCircle);

  // Initialize position to canvas center
  const canvas = flock.scene.getEngine().getRenderingCanvas();
  const canvasRect = canvas.getBoundingClientRect();
  colorPickingCirclePosition.x = canvasRect.width / 2;
  colorPickingCirclePosition.y = canvasRect.height / 2;

  updateColorPickingCirclePosition();
}

function updateColorPickingCirclePosition() {
  if (!colorPickingCircle) return;

  const canvas = flock.scene.getEngine().getRenderingCanvas();
  const canvasRect = canvas.getBoundingClientRect();

  // Constrain position to canvas bounds
  colorPickingCirclePosition.x = Math.max(
    10,
    Math.min(canvasRect.width - 10, colorPickingCirclePosition.x),
  );
  colorPickingCirclePosition.y = Math.max(
    10,
    Math.min(canvasRect.height - 10, colorPickingCirclePosition.y),
  );

  // Position relative to canvas
  colorPickingCircle.style.left =
    canvasRect.left + colorPickingCirclePosition.x + "px";
  colorPickingCircle.style.top =
    canvasRect.top + colorPickingCirclePosition.y + "px";
}

function endColorPickingMode() {
  colorPickingKeyboardMode = false;
  colorPickingCallback = null;

  // Remove keyboard listener(s)
  document.removeEventListener("keydown", handleColorPickingKeydown, {
    capture: true,
  });
  document.removeEventListener("keydown", handleColorPickingKeydown);

  // Remove pointer listener if active
  if (_onPickMeshRef) {
    document.removeEventListener("pointerdown", _onPickMeshRef, true);
    _onPickMeshRef = null;
  }

  document.body.style.cursor = "default";

  if (colorPickingCircle) {
    colorPickingCircle.remove();
    colorPickingCircle = null;
  }
}

function scrollToBlockTopParentLeft(workspace, blockId) {
  if (!workspace.isMovable()) {
    console.warn(
      "Tried to move a non-movable workspace. This could result" +
        " in blocks becoming inaccessible.",
    );
    return;
  }

  const block = blockId ? workspace.getBlockById(blockId) : null;
  if (!block) {
    return;
  }

  // Find the ultimate parent block
  let ultimateParent = block;
  while (ultimateParent.getParent()) {
    ultimateParent = ultimateParent.getParent();
  }

  // Get the position of the target block (for top positioning)
  const blockXY = block.getRelativeToSurfaceXY();

  // Get the position of the ultimate parent (for left positioning)
  const parentXY = ultimateParent.getRelativeToSurfaceXY();

  // Workspace scale, used to convert from workspace coordinates to pixels
  const scale = workspace.scale;

  // Convert block positions to pixels
  const pixelBlockY = blockXY.y * scale;
  const pixelParentX = parentXY.x * scale;

  const padding = 20;
  const scrollToY = pixelBlockY - padding;
  const scrollToX = pixelParentX - padding;

  // Convert to canvas directions (negative values)
  const x = -scrollToX;
  const y = -scrollToY;

  // Scroll the workspace
  workspace.scroll(x, y);
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
  if (!mesh && window.currentMesh) {
    const blockKey = Object.keys(meshMap).find(
      (key) => meshMap[key] === window.currentBlock,
    );
    mesh = getMeshFromBlockKey(blockKey);
  }
  if (!mesh) return;

  mesh.computeWorldMatrix(true);
  const boundingInfo = mesh.getBoundingInfo();
  const newTarget = boundingInfo.boundingBox.centerWorld; // Center of the new mesh
  const camera = flock.scene.activeCamera;

  if (camera.metadata && camera.metadata.following) {
    const player = camera.metadata.following; // The player (mesh) the camera is following
    const playerDistance = 5; // Fixed distance between player and target

    // Keep the player's original Y position
    const originalPlayerY = player.position.y;

    // Position the player further away from camera than the target
    player.position = new flock.BABYLON.Vector3(
      newTarget.x,
      originalPlayerY,
      newTarget.z + playerDistance, // Higher Z value to be further from camera
    );

    // Calculate direction to target
    const directionToTarget = newTarget.subtract(player.position);
    directionToTarget.normalize();

    // Calculate the angle to face the target
    let angle = Math.atan2(directionToTarget.x, directionToTarget.z);

    // Set player rotation directly
    player.rotation.y = angle;

    // Calculate camera position behind the player
    const cameraDistance = camera.radius;
    const cameraPosition = new flock.BABYLON.Vector3(
      player.position.x,
      player.position.y + camera.radius * 0.3, // Slight elevation for better view
      player.position.z + cameraDistance, // Camera is now behind player (higher Z)
    );

    // Update camera position and target
    camera.setPosition(cameraPosition);
    camera.setTarget(player.position);
  } else {
    // For other types of cameras
    const currentDistance = camera.radius || 10;
    const currentYPosition = camera.position.y;

    // Position camera in front of the mesh
    const newCameraPosition = new flock.BABYLON.Vector3(
      newTarget.x,
      currentYPosition,
      newTarget.z - currentDistance, // Camera closer to screen than target
    );

    camera.position = newCameraPosition;
    camera.setTarget(newTarget);
  }
}

export function disableGizmos() {
  if (!gizmoManager) return;
  // Disable all gizmos
  gizmoManager.positionGizmoEnabled = false;
  gizmoManager.rotationGizmoEnabled = false;
  gizmoManager.scaleGizmoEnabled = false;
  gizmoManager.boundingBoxGizmoEnabled = false;
  endColorPickingMode();
}

export function toggleGizmo(gizmoType) {
  disableGizmos();
  resetAttachedMeshIfMeshAttached();

  document.body.style.cursor = "default";

  let blockKey, blockId, canvas, onPickMesh;

  // Enable the selected gizmo
  switch (gizmoType) {
    case "camera":
      if (cameraMode === "play") {
        cameraMode = "fly";
        flock.printText({
          text: translate("fly_camera_instructions"),
          duration: 15,
          color: "white",
        });
      } else {
        cameraMode = "play";
      }

      let currentCamera = flock.scene.activeCamera;
      console.log("Camera", flock.savedCamera);
      flock.scene.activeCamera = flock.savedCamera;
      flock.savedCamera = currentCamera;
      break;
    case "delete":
      if (!gizmoManager.attachedMesh) {
        flock.printText({
          text: translate("select_mesh_delete_prompt"),
          duration: 30,
          color: "black",
        });
        return;
      }
      blockKey = findParentWithBlockId(gizmoManager.attachedMesh).metadata
        .blockKey;
      blockId = meshBlockIdMap[blockKey];
      deleteBlockWithUndo(blockId);
      break;

    case "duplicate":
      if (!gizmoManager.attachedMesh) {
        flock.printText({
          text: translate("select_mesh_duplicate_prompt"),
          duration: 30,
          color: "black",
        });
        return;
      }
      blockKey = findParentWithBlockId(gizmoManager.attachedMesh).metadata
        .blockKey;
      blockId = meshBlockIdMap[blockKey];

      document.body.style.cursor = "crosshair"; // Change cursor to indicate picking mode

      canvas = flock.scene.getEngine().getRenderingCanvas(); // Get the flock.BABYLON.js canvas

      onPickMesh = function (event) {
        const canvasRect = canvas.getBoundingClientRect();

        if (eventIsOutOfCanvasBounds(event, canvasRect)) {
          window.removeEventListener("click", onPickMesh);
          document.body.style.cursor = "default";
          return;
        }

        const [canvasX, canvasY] = getCanvasXAndCanvasYValues(
          event,
          canvasRect,
        );

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
          duplicateBlockAndInsert(originalBlock, workspace, pickedPosition);
        }
      };

      // Use setTimeout to defer listener setup
      document.body.style.cursor = "crosshair";
      setTimeout(() => {
        window.addEventListener("click", onPickMesh);
      }, 50);

      break;
    case "select": {
      gizmoManager.selectGizmoEnabled = true;

      // Store the pointer observable
      const pointerObservable = flock.scene.onPointerObservable;

      // Add the observer
      const pointerObserver = pointerObservable.add((event) => {
        if (event.type === flock.BABYLON.PointerEventTypes.POINTERPICK) {
          if (gizmoManager.attachedMesh) {
            resetAttachedMesh();
            blockKey = findParentWithBlockId(gizmoManager.attachedMesh).metadata
              .blockKey;
          }
          let pickedMesh = event.pickInfo.pickedMesh;

          if (pickedMesh && pickedMesh.name !== "ground") {
            const position = pickedMesh.getAbsolutePosition();

            // Round the coordinates to 2 decimal places
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

            const block = meshMap[blockKey];
            highlightBlockById(Blockly.getMainWorkspace(), block);

            // Attach the gizmo to the selected mesh
            gizmoManager.attachToMesh(pickedMesh);

            // Show bounding box for the selected mesh
            pickedMesh.showBoundingBox = true;
          } else {
            if (pickedMesh && pickedMesh.name === "ground") {
              const position = event.pickInfo.pickedPoint;

              const roundedPosition = roundVectorToFixed(position, 2);

              flock.printText({
                text: translate("position_readout").replace(
                  "{position}",
                  String(roundedPosition),
                ),
                duration: 30,
                color: "black",
              });
            }

            // Deselect if no mesh is picked
            if (gizmoManager.attachedMesh) {
              resetChildMeshesOfAttachedMesh();
              gizmoManager.attachToMesh(null); // Detach the gizmo
            }
          }

          pointerObservable.remove(pointerObserver);
        }
      });

      break;
    }
    case "bounds":
      gizmoManager.boundingBoxGizmoEnabled = true;
      gizmoManager.boundingBoxDragBehavior.onDragStartObservable.add(
        function () {
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

          const block = meshMap[mesh.metadata.blockKey];
          highlightBlockById(Blockly.getMainWorkspace(), block);
        },
      );

      gizmoManager.boundingBoxDragBehavior.onDragEndObservable.add(function () {
        const mesh = gizmoManager.attachedMesh;

        if (mesh.savedMotionType && mesh.physics) {
          mesh.physics.setMotionType(mesh.savedMotionType);
        }

        mesh.computeWorldMatrix(true);

        const block = meshMap[mesh.metadata.blockKey];

        if (block) {
          const meshY = calculateYPosition(mesh, block);
          setBlockXYZ(block, mesh.position.x, meshY, mesh.position.z);
        }
      });

      break;

    case "position":
      configurePositionGizmo(gizmoManager);
      gizmoManager.onAttachedToMeshObservable.add((mesh) => {
        if (!mesh) return;

        const blockKey = mesh?.metadata?.blockKey;
        const blockId = blockKey ? meshMap[blockKey] : null;
        if (!blockId) return;

        highlightBlockById(Blockly.getMainWorkspace(), blockId);
      });

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

      gizmoManager.gizmos.positionGizmo.onDragEndObservable.add(function () {
        const mesh = gizmoManager.attachedMesh;

        if (mesh.savedMotionType && mesh.physics) {
          mesh.physics.setMotionType(mesh.savedMotionType);
        }
        mesh.computeWorldMatrix(true);

        const block = meshMap[mesh.metadata.blockKey];

        if (block) {
          const meshY = calculateYPosition(mesh, block);
          setBlockXYZ(block, mesh.position.x, meshY, mesh.position.z);
        }
      });

      break;
    case "rotation":
      configureRotationGizmo(gizmoManager);

      gizmoManager.onAttachedToMeshObservable.add((mesh) => {
        if (!mesh) return;

        const blockKey = mesh?.metadata?.blockKey;
        const blockId = blockKey ? meshMap[blockKey] : null;
        if (!blockId) return;

        highlightBlockById(Blockly.getMainWorkspace(), blockId);
      });

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

      gizmoManager.gizmos.rotationGizmo.onDragEndObservable.add(function () {
        let mesh = gizmoManager.attachedMesh;
        while (mesh?.parent && !mesh.parent.physics) {
          mesh = mesh.parent;
        }

        if (!mesh?.physics) return;

        if (mesh.savedMotionType) {
          mesh.physics.setMotionType(mesh.savedMotionType);
        }

        const block = meshMap[mesh.metadata.blockKey];

        if (!block) return;

        const groupId = Blockly.utils.idGenerator.genUid();
        Blockly.Events.setGroup(groupId);

        let addedDoSection = false;
        if (!block.getInput("DO")) {
          block.appendStatementInput("DO").setCheck(null).appendField("");
          addedDoSection = true;
        }

        // Check if the 'rotate_to' block already exists in the 'DO' section
        let rotateBlock = null;
        let modelVariable = block.getFieldValue("ID_VAR");
        const statementConnection = block.getInput("DO").connection;
        if (statementConnection && statementConnection.targetBlock()) {
          // Iterate through the blocks in the 'do' section to find 'rotate_to'
          let currentBlock = statementConnection.targetBlock();
          while (currentBlock) {
            if (currentBlock.type === "rotate_to") {
              const modelField = currentBlock.getFieldValue("MODEL");
              if (modelField === modelVariable) {
                rotateBlock = currentBlock;
                break;
              }
            }
            currentBlock = currentBlock.getNextBlock();
          }
        }

        // Create a new 'rotate_to' block if it doesn't exist
        if (!rotateBlock) {
          rotateBlock = Blockly.getMainWorkspace().newBlock("rotate_to");
          rotateBlock.setFieldValue(modelVariable, "MODEL");
          rotateBlock.initSvg();
          rotateBlock.render();

          // Add shadow blocks for X, Y, Z inputs
          ["X", "Y", "Z"].forEach((axis) => {
            const input = rotateBlock.getInput(axis);
            const shadowBlock =
              Blockly.getMainWorkspace().newBlock("math_number");
            shadowBlock.setFieldValue("1", "NUM");
            shadowBlock.setShadow(true);
            shadowBlock.initSvg();
            shadowBlock.render();
            input.connection.connect(shadowBlock.outputConnection);
          });

          rotateBlock.render(); // Render the new block
          // Connect the new 'rotate_to' block to the 'do' section
          block
            .getInput("DO")
            .connection.connect(rotateBlock.previousConnection);

          // Track this block for DO section cleanup
          const timestamp = Date.now();
          gizmoCreatedBlocks.set(rotateBlock.id, {
            parentId: block.id,
            createdDoSection: addedDoSection,
            timestamp: timestamp,
          });
        }

        const currentRotation = getMeshRotationInDegrees(mesh);

        setBlockXYZ(
          rotateBlock,
          currentRotation.x,
          currentRotation.y,
          currentRotation.z,
        );

        // End undo group
        Blockly.Events.setGroup(null);
      });

      break;

    case "scale":
      configureScaleGizmo(gizmoManager);
      gizmoManager.onAttachedToMeshObservable.add((mesh) => {
        if (!mesh) return;

        const blockKey = mesh?.metadata?.blockKey;
        const blockId = blockKey ? meshMap[blockKey] : null;
        if (!blockId) return;

        highlightBlockById(Blockly.getMainWorkspace(), blockId);
      });

      // Track bottom for correct visual anchoring
      let originalBottomY = 0;

      gizmoManager.gizmos.scaleGizmo.onDragObservable.add(() => {
        const mesh = gizmoManager.attachedMesh;

        mesh.computeWorldMatrix(true);
        mesh.refreshBoundingInfo();

        const newBottomY = mesh.getBoundingInfo().boundingBox.minimumWorld.y;
        const deltaY = originalBottomY - newBottomY;
        mesh.position.y += deltaY;

        const block = Blockly.getMainWorkspace().getBlockById(
          mesh.metadata.blockKey,
        );
        if (gizmoManager.scaleGizmoEnabled) {
          switch (block?.type) {
            case "create_capsule":
            case "create_cylinder":
              mesh.scaling.z = mesh.scaling.x;
              break;
          }
        }
      });

      gizmoManager.gizmos.scaleGizmo.onDragStartObservable.add(() => {
        const mesh = gizmoManager.attachedMesh;
        flock.ensureUniqueGeometry(mesh);
        mesh.computeWorldMatrix(true);
        mesh.refreshBoundingInfo();
        originalBottomY = mesh.getBoundingInfo().boundingBox.minimumWorld.y;

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

        const block = meshMap[mesh.metadata.blockKey];
        highlightBlockById(Blockly.getMainWorkspace(), block);
      });

      gizmoManager.gizmos.scaleGizmo.onDragEndObservable.add(() => {
        const mesh = gizmoManager.attachedMesh;
        const block = meshMap[mesh.metadata.blockKey];

        if (mesh.savedMotionType) {
          mesh.physics.setMotionType(mesh.savedMotionType);
        }

        try {
          const ensureFreshBounds = (m) => {
            m.computeWorldMatrix(true);
            m.refreshBoundingInfo();
            return m.getBoundingInfo().boundingBox;
          };

          const bbox = ensureFreshBounds(mesh);

          const newBottomY = bbox.minimumWorld.y;
          mesh.position.y += originalBottomY - newBottomY;

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
                  const shadow =
                    Blockly.getMainWorkspace().newBlock("math_number");
                  shadow.setFieldValue("1", "NUM");
                  shadow.setShadow(true);
                  shadow.initSvg();
                  shadow.render();
                  input.connection.connect(shadow.outputConnection);
                });

                resizeBlock.render();
                block
                  .getInput("DO")
                  .connection.connect(resizeBlock.previousConnection);

                gizmoCreatedBlocks.set(resizeBlock.id, {
                  parentId: block.id,
                  createdDoSection: addedDoSection,
                  timestamp: Date.now(),
                });
              }

              function getScaledSize(mesh) {
                const { originalMin, originalMax } = mesh.metadata || {};
                const min =
                  originalMin ?? mesh.getBoundingInfo().boundingBox.minimum;
                const max =
                  originalMax ?? mesh.getBoundingInfo().boundingBox.maximum;

                const baseX = max.x - min.x;
                const baseY = max.y - min.y;
                const baseZ = max.z - min.z;

                return {
                  x: baseX * Math.abs(mesh.scaling.x),
                  y: baseY * Math.abs(mesh.scaling.y),
                  z: baseZ * Math.abs(mesh.scaling.z),
                };
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
      });

      break;
    case "boundingBox":
      gizmoManager.boundingBoxGizmoEnabled = true;

      break;
    case "focus":
      focusCameraOnMesh();
      break;
    default:
      break;
  }
}

function turnOffAllGizmos() {
  if (!gizmoManager) return;
  resetBoundingBoxVisibilityIfManuallyChanged(gizmoManager.attachedMesh);
  resetAttachedMeshIfMeshAttached();
  gizmoManager.attachToMesh(null);
  disableGizmos();
}

// Track DO sections and their associated blocks for cleanup
const gizmoCreatedBlocks = new Map(); // blockId -> { parentId, createdDoSection, timestamp }

// Add undo handler to clean up DO sections when undoing block creation
function addUndoHandler() {
  const workspace = Blockly.getMainWorkspace();

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
  const hideButton = document.getElementById("hideButton");
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
    hideButton,
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

  buttons.forEach((button) => button.removeAttribute("disabled"));

  // Attach event listeners
  positionButton.addEventListener("click", () => toggleGizmo("position"));
  rotationButton.addEventListener("click", () => toggleGizmo("rotation"));
  scaleButton.addEventListener("click", () => toggleGizmo("scale"));
  hideButton.addEventListener("click", () => toggleGizmo("select"));
  cameraButton.addEventListener("click", () => toggleGizmo("camera"));
  duplicateButton.addEventListener("click", () => toggleGizmo("duplicate"));
  deleteButton.addEventListener("click", () => toggleGizmo("delete"));
  showShapesButton.addEventListener("click", window.showShapes);
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
          mesh.metadata.blockKey,
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

    if (mesh) {
      const block = meshMap[mesh.metadata.blockKey];
      //highlightBlockById(Blockly.getMainWorkspace(), block);
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

      const blockKey = findParentWithBlockId(gizmoManager.attachedMesh).metadata
        .blockKey;
      const blockId = meshBlockIdMap[blockKey];

      deleteBlockWithUndo(blockId);
    }
  });
}

export function disposeGizmoManager() {
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
