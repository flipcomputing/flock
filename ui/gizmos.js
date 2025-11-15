import * as Blockly from "blockly";
import { meshMap, meshBlockIdMap } from "../generators";
import { flock } from "../flock.js";
import { setPositionValues } from "./addmeshes.js";
import {
  getMeshFromBlockKey,
  getRootMesh,
  updateBlockColorAndHighlight,
} from "./blockmesh.js";
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

      // If gizmos are on, kill them
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
    if ((event.ctrlKey && event.code === "Comma") /*|| event.code === "KeyF"*/) {
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
      // keep this if you want outside-click to exit picking:
      endColorPickingMode();
      // restore cursors
      document.body.style.cursor = "default";
      canvas.style.cursor = "auto";
      return;
    }

    // Inside canvas → paint (stay in mode)
    const [canvasX, canvasY] = getCanvasXAndCanvasYValues(event, canvasRect);
    applyColorAtPosition(canvasX, canvasY);

    // 🔁 Re-assert crosshair in case Babylon/camera changed it
    document.body.style.cursor = "crosshair";
    canvas.style.cursor = "crosshair";
  };

  // Keyboard mode still supported
  startColorPickingKeyboardMode(onPickMesh);

  // Enter persistent pointer mode
  document.body.style.cursor = "crosshair";
  canvas.style.cursor = "crosshair";
  // keep your click wiring (no {once:true})
  setTimeout(() => {
    window.addEventListener("click", onPickMesh);
  }, 200);
}

// treat undefined as pickable; only exclude explicit false
const PICK_OK = (m) => m && m.isPickable !== false;

function isLeafMesh(m) {
  if (!m || m.isDisposed?.()) return false;
  const hasKids = (m.getChildren?.().length ?? 0) > 0;
  const hasGeom = typeof m.getTotalVertices === "function" && m.getTotalVertices() > 0;
  return !hasKids && hasGeom;
}

function isInSubtree(root, node) {
  if (!root || !node) return false;
  if (root === node) return true;
  for (let p = node.parent; p; p = p.parent) if (p === root) return true;
  return false;
}

function pickLeafFromRay(ray, scene) {
  // 1) Prefer a direct leaf hit (skips the composite parent)
  const leafFirst = scene.pickWithRay(ray, m => PICK_OK(m) && isLeafMesh(m));
  if (leafFirst?.pickedMesh) return leafFirst.pickedMesh;

  // 2) Fallback: get primary (likely parent), then search only its subtree
  const primary = scene.pickWithRay(ray, PICK_OK);
  const parent = primary?.pickedMesh;
  if (!parent) return null;

  if (isLeafMesh(parent)) return parent;

  const maxDist = (primary.distance ?? Number.POSITIVE_INFINITY) + 1e-4;
  const ray2 = ray.clone();
  ray2.length = Math.min(ray.length ?? maxDist, maxDist);

  const hits = scene.multiPickWithRay(
    ray2,
    m => PICK_OK(m) && isLeafMesh(m) && isInSubtree(parent, m),
    false
  ) || [];

  if (hits.length) {
    // ensure nearest leaf is chosen
    hits.sort((a, b) => a.distance - b.distance);
    return hits[0].pickedMesh;
  }

  // last resort: color the parent
  return parent;
}

function applyColorAtPosition(canvasX, canvasY) {
  const scene = flock.scene;

  // If you use the selection octree, keep it fresh (cheap if unchanged)
  if (scene.selectionOctree) scene.createOrUpdateSelectionOctree();

  const pickRay = scene.createPickingRay(
    canvasX,
    canvasY,
    flock.BABYLON.Matrix.Identity(),
    scene.activeCamera
  );

  const pickedMesh = pickLeafFromRay(pickRay, scene);

  if (pickedMesh) {
    flock.changeColorMesh(pickedMesh, selectedColor);
    updateBlockColorAndHighlight(pickedMesh, selectedColor);
  } else {
    flock.setSky(selectedColor);
    updateBlockColorAndHighlight(meshMap?.["sky"], selectedColor);
  }
}





let cameraMode = "play";

// --- Color Picking Keyboard Mode Functions ---

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
        // Paint and KEEP GOING (no checks, no exit)
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

  // Get metrics to determine padding
  const metrics = workspace.getMetrics();

  // Calculate desired scroll position
  // For Y: position block at top with some padding (20px)
  // For X: position parent at left with some padding (20px)
  const padding = 20;
  const scrollToY = pixelBlockY - padding;
  const scrollToX = pixelParentX - padding;

  // Convert to canvas directions (negative values)
  const x = -scrollToX;
  const y = -scrollToY;

  // Scroll the workspace
  workspace.scroll(x, y);
}

function highlightBlockById(workspace, block) {
  if (block) {
    // Select the new block
    if (window.codeMode === "both") {
      workspace.getAllBlocks().forEach((b) => b.unselect());
      block.select();

      // Scroll to position the block at the top and its parent at the left
      scrollToBlockTopParentLeft(workspace, block.id);
    }
  }
}

function findParentWithBlockId(mesh) {
  let currentNode = mesh;
  while (currentNode) {
    if (currentNode.metadata.blockKey !== undefined) {
      return currentNode;
    }
    currentNode = currentNode.parent;
  }

  return null;
}

// For composite meshes where visibility needs setting to
// 0.001 in order to show parent mesh's bounding box
function resetBoundingBoxVisibilityIfManuallyChanged(mesh) {
  if (mesh && mesh.visibility === 0.001) mesh.visibility = 0;
}

function showBoundingBox(mesh, focusMode = false) {
  if (mesh.parent) {
    mesh = getRootMesh(mesh.parent);
    mesh.visibility = 0.001;
  } else if (focusMode && !mesh.visibility) {
    // Set mesh visibility even if mesh has no parent
    // focusMode is only used when camera focused on mesh

    /* With this, non-composite meshes can still have their
    visibility set to 0.001. However, this will not be a big
    issue here as, even in past testing, non-composite meshes
    still were not showing, so this may even be preferred. */

    mesh.visibility = 0.001;
  }
  mesh.showBoundingBox = true;
}

function hideBoundingBox(mesh) {
  mesh.showBoundingBox = false;
}

function resetChildMeshesOfAttachedMesh() {
  gizmoManager.attachedMesh
    .getChildMeshes()
    .forEach((child) => hideBoundingBox(child));
}

function resetAttachedMesh() {
  hideBoundingBox(gizmoManager.attachedMesh);
  resetChildMeshesOfAttachedMesh();
}

function resetAttachedMeshIfMeshAttached() {
  if (gizmoManager.attachedMesh) {
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

export function getCanvasXAndCanvasYValues(event, canvasRect) {
  return [event.clientX - canvasRect.left, event.clientY - canvasRect.top];
}
function getCanvasXYFromEvent(ev, canvas, rect) {
  const rw = canvas.width; // render/backing width
  const rh = canvas.height; // render/backing height
  const cw = rect.width; // CSS width
  const ch = rect.height; // CSS height
  const x = (ev.clientX - rect.left) * (rw / cw);
  const y = (ev.clientY - rect.top) * (rh / ch);
  return [x, y];
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

  let selectFocusedMesh = () => {
    // "Select" the focused mesh
    window.currentMesh = mesh;
    gizmoManager.selectGizmoEnabled = true;
    gizmoManager.attachToMesh(mesh); // Unfortunately needed to ensure bounding box gets hidden 
    showBoundingBox(mesh, true);
  }

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
  selectFocusedMesh();
}

export function disableGizmos() {
  if (!gizmoManager) return;
  // Disable all gizmos
  gizmoManager.selectGizmoEnabled = false;
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
          text: "ℹ️ Fly camera, use arrow keys and page up/down",
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
          text: "⚠️ Select a mesh then click delete.",
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
          text: "⚠️ Select a mesh then click duplicate, then click to place copies.",
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

          //console.log("Duplicate", blockKey, meshMap);
          if (originalBlock) {
            // Serialize the block and its children, including shadows

            Blockly.Events.setGroup("duplicate");
            const blockJson = Blockly.serialization.blocks.save(originalBlock, {
              includeShadows: true, // Include shadow blocks in the duplication
            });

            // Remove the "next" connection from the serialized JSON
            if (blockJson.next) {
              delete blockJson.next;
            }
            // Append the duplicated block and its children
            const duplicateBlock = Blockly.serialization.blocks.append(
              blockJson,
              workspace,
            );

            setPositionValues(
              duplicateBlock,
              pickedPosition,
              duplicateBlock.type,
            );

            // Connect the new block as the next block
            if (
              originalBlock.nextConnection &&
              duplicateBlock.previousConnection
            ) {
              originalBlock.nextConnection.connect(
                duplicateBlock.previousConnection,
              );
            } else {
              // If no connection, visually position it
              duplicateBlock.moveBy(50, 50);
            }

            Blockly.Events.setGroup(false);

            // Initialise and render the duplicated block
            duplicateBlock.initSvg();
            duplicateBlock.render();
          }
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
            // Assuming 'mesh' is your Babylon.js mesh object
            const position = pickedMesh.getAbsolutePosition();

            // Round the coordinates to 2 decimal places
            const roundedPosition = new BABYLON.Vector3(
              parseFloat(position.x.toFixed(2)),
              parseFloat(position.y.toFixed(2)),
              parseFloat(position.z.toFixed(2)),
            );
            flock.printText({
              text: "Position: " + roundedPosition,
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
            showBoundingBox(pickedMesh);
          } else {
            if (pickedMesh && pickedMesh.name === "ground") {
              const position = event.pickInfo.pickedPoint;

              // Round the coordinates to 2 decimal places
              const roundedPosition = new BABYLON.Vector3(
                parseFloat(position.x.toFixed(2)),
                parseFloat(position.y.toFixed(2)),
                parseFloat(position.z.toFixed(2)),
              );
              flock.printText({
                text: "Position: " + roundedPosition,
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

          const motionType = mesh.physics.getMotionType();
          mesh.savedMotionType = motionType;

          if (
            mesh.physics &&
            mesh.physics.getMotionType() !=
              flock.BABYLON.PhysicsMotionType.STATIC
          ) {
            mesh.physics.setMotionType(flock.BABYLON.PhysicsMotionType.STATIC);
            mesh.physics.disablePreStep = false;
          }

          const block = meshMap[mesh.metadata.blockKey];

          highlightBlockById(Blockly.getMainWorkspace(), block);
        },
      );

      gizmoManager.boundingBoxDragBehavior.onDragEndObservable.add(function () {
        // Retrieve the mesh associated with the bb gizmo
        const mesh = gizmoManager.attachedMesh;

        if (mesh.savedMotionType) {
          mesh.physics.setMotionType(mesh.savedMotionType);
        }

        mesh.computeWorldMatrix(true);

        const block = meshMap[mesh.metadata.blockKey];

        let meshY = mesh.position.y;

        if (
          mesh.metadata &&
          mesh.metadata.yOffset &&
          mesh.metadata.yOffset != 0
        ) {
          const scale = block
            .getInput("SCALE")
            .connection.targetBlock()
            .getFieldValue("NUM");

          meshY -= scale * mesh.metadata.yOffset;
        }

        if (block) {
          block
            .getInput("X")
            .connection.targetBlock()
            .setFieldValue(
              String(Math.round(mesh.position.x * 10) / 10),
              "NUM",
            );
          block
            .getInput("Y")
            .connection.targetBlock()
            .setFieldValue(String(Math.round(meshY * 10) / 10), "NUM");
          block
            .getInput("Z")
            .connection.targetBlock()
            .setFieldValue(
              String(Math.round(mesh.position.z * 10) / 10),
              "NUM",
            );
        }
      });

      break;

    case "position":
      gizmoManager.positionGizmoEnabled = true;
      gizmoManager.gizmos.positionGizmo.snapDistance = 0.1;
      gizmoManager.gizmos.positionGizmo.xGizmo._coloredMaterial.diffuseColor =
        blueColor;
      gizmoManager.gizmos.positionGizmo.yGizmo._coloredMaterial.diffuseColor =
        greenColor;
      gizmoManager.gizmos.positionGizmo.zGizmo._coloredMaterial.diffuseColor =
        orangeColor;
      gizmoManager.gizmos.positionGizmo.updateGizmoPositionToMatchAttachedMesh = true;
      gizmoManager.gizmos.positionGizmo.onDragStartObservable.add(function () {
        const mesh = gizmoManager.attachedMesh;
        const motionType = mesh.physics?.getMotionType();
        mesh.savedMotionType = motionType;

        if (
          mesh.physics &&
          motionType &&
          motionType != flock.BABYLON.PhysicsMotionType.ANIMATED
        ) {
          mesh.physics.setMotionType(flock.BABYLON.PhysicsMotionType.ANIMATED);
          mesh.physics.disablePreStep = false;
        }

        const block = meshMap[mesh.metadata.blockKey];

        highlightBlockById(Blockly.getMainWorkspace(), block);
      });
      gizmoManager.gizmos.positionGizmo.onDragEndObservable.add(function () {
        // Retrieve the mesh associated with the position gizmo
        const mesh = gizmoManager.attachedMesh;

        if (mesh.savedMotionType) {
          mesh.physics.setMotionType(mesh.savedMotionType);
        }
        mesh.computeWorldMatrix(true);

        const block = meshMap[mesh.metadata.blockKey];

        let meshY = mesh.position.y;

        if (mesh.metadata?.yOffset && mesh.metadata.yOffset != 0) {
          try {
            const scale = block
              .getInput("SCALE")
              .connection.targetBlock()
              .getFieldValue("NUM");

            meshY -= scale * mesh.metadata.yOffset;
          } catch (e) {}
        }

        if (block) {
          try {
            block
              .getInput("X")
              .connection.targetBlock()
              .setFieldValue(
                String(Math.round(mesh.position.x * 10) / 10),
                "NUM",
              );
          } catch (e) {}
          try {
            meshY -=
              mesh.getBoundingInfo().boundingBox.extendSize.y * mesh.scaling.y;
            block
              .getInput("Y")
              .connection.targetBlock()
              .setFieldValue(String(Math.round(meshY * 10) / 10), "NUM");
          } catch (e) {}
          try {
            block
              .getInput("Z")
              .connection.targetBlock()
              .setFieldValue(
                String(Math.round(mesh.position.z * 10) / 10),
                "NUM",
              );
          } catch (e) {}
        }
      });

      break;
    case "rotation":
      gizmoManager.rotationGizmoEnabled = true;
      gizmoManager.gizmos.rotationGizmo.updateGizmoRotationToMatchAttachedMesh = false;
      gizmoManager.gizmos.rotationGizmo.xGizmo._coloredMaterial.diffuseColor =
        blueColor;
      gizmoManager.gizmos.rotationGizmo.yGizmo._coloredMaterial.diffuseColor =
        greenColor;
      gizmoManager.gizmos.rotationGizmo.zGizmo._coloredMaterial.diffuseColor =
        orangeColor;

      gizmoManager.gizmos.rotationGizmo.onDragStartObservable.add(function () {
        let mesh = gizmoManager.attachedMesh;
        while (mesh.parent && !mesh.parent.physicsImpostor) {
          mesh = mesh.parent;
        }

        const motionType =
          mesh.physics.getMotionType() ||
          flock.BABYLON.PhysicsMotionType.STATIC;
        mesh.savedMotionType = motionType;

        if (
          mesh.physics &&
          mesh.physics.getMotionType() !=
            flock.BABYLON.PhysicsMotionType.ANIMATED
        ) {
          mesh.physics.setMotionType(flock.BABYLON.PhysicsMotionType.ANIMATED);
          mesh.physics.disablePreStep = false;
        }

        const block = meshMap[mesh.metadata.blockKey];

        highlightBlockById(Blockly.getMainWorkspace(), block);
      });

      gizmoManager.gizmos.rotationGizmo.onDragEndObservable.add(function () {
        let mesh = gizmoManager.attachedMesh;
        while (mesh.parent && !mesh.parent.physics) {
          mesh = mesh.parent;
        }

        if (mesh.savedMotionType) {
          mesh.physics.setMotionType(mesh.savedMotionType);
        }

        const block = meshMap[mesh.metadata.blockKey];

        //console.log("Rotating", mesh, blockKey, meshMap);
        if (!block) {
          return;
        }

        // Generate a unique group ID for this gizmo action
        const groupId = Blockly.utils.idGenerator.genUid();
        Blockly.Events.setGroup(groupId);

        //console.log("Rotating", block);
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

        function getEulerAnglesFromQuaternion(quaternion) {
          const euler = quaternion.toEulerAngles(); // Converts quaternion to Euler angles
          return {
            x: Math.round(euler.x * (180 / Math.PI) * 10) / 10,
            y: Math.round(euler.y * (180 / Math.PI) * 10) / 10,
            z: Math.round(euler.z * (180 / Math.PI) * 10) / 10,
          };
        }

        // Get the correct rotation values, checking for quaternion
        let rotationX = 0,
          rotationY = 0,
          rotationZ = 0;
        if (mesh.rotationQuaternion) {
          // If using quaternion, convert it to Euler angles
          const rotation = getEulerAnglesFromQuaternion(
            mesh.rotationQuaternion,
          );
          rotationX = rotation.x;
          rotationY = rotation.y;
          rotationZ = rotation.z;
        } else {
          // If using standard Euler rotation
          rotationX = Math.round(mesh.rotation.x * (180 / Math.PI) * 10) / 10;
          rotationY = Math.round(mesh.rotation.y * (180 / Math.PI) * 10) / 10;
          rotationZ = Math.round(mesh.rotation.z * (180 / Math.PI) * 10) / 10;
        }

        // Helper to update the value of the connected block or shadow block
        function setRotationValue(inputName, value) {
          const input = rotateBlock.getInput(inputName);
          const connectedBlock = input.connection.targetBlock();

          if (connectedBlock) {
            connectedBlock.setFieldValue(String(value), "NUM");
          }
        }

        // Set the rotation values (X, Y, Z)
        setRotationValue("X", rotationX);
        setRotationValue("Y", rotationY);
        setRotationValue("Z", rotationZ);

        // End undo group
        Blockly.Events.setGroup(null);
      });

      break;

    case "scale":
      gizmoManager.scaleGizmoEnabled = true;
      gizmoManager.gizmos.scaleGizmo.PreserveScaling = true;
      gizmoManager.gizmos.scaleGizmo.xGizmo._coloredMaterial.diffuseColor =
        blueColor;
      gizmoManager.gizmos.scaleGizmo.yGizmo._coloredMaterial.diffuseColor =
        greenColor;
      gizmoManager.gizmos.scaleGizmo.zGizmo._coloredMaterial.diffuseColor =
        orangeColor;

      gizmoManager.gizmos.scaleGizmo.sensitivity = 4;
      gizmoManager.gizmos.scaleGizmo.uniformScaleGizmo.scaleRatio = 2.5;

      // Track bottom for correct visual anchoring
      let originalBottomY = 0;

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

      gizmoManager.gizmos.scaleGizmo.onDragEndObservable.add(() => {
        const mesh = gizmoManager.attachedMesh;
        const block = meshMap[mesh.metadata.blockKey];

        if (mesh.savedMotionType) {
          mesh.physics.setMotionType(mesh.savedMotionType);
        }

        try {
          // Ensure world matrix and bounding info are current
          mesh.computeWorldMatrix(true);
          mesh.refreshBoundingInfo();

          const newBottomY = mesh.getBoundingInfo().boundingBox.minimumWorld.y;
          const deltaY = originalBottomY - newBottomY;
          mesh.position.y += deltaY;

          const originalSize = mesh
            .getBoundingInfo()
            .boundingBox.extendSize.scale(2);

          const newWidth =
            Math.round(originalSize.x * mesh.scaling.x * 10) / 10;
          const newHeight =
            Math.round(originalSize.y * mesh.scaling.y * 10) / 10;
          const newDepth =
            Math.round(originalSize.z * mesh.scaling.z * 10) / 10;

          switch (block.type) {
            case "create_plane":
              block
                .getInput("WIDTH")
                .connection.targetBlock()
                .setFieldValue(String(newWidth), "NUM");
              block
                .getInput("HEIGHT")
                .connection.targetBlock()
                .setFieldValue(String(newHeight), "NUM");
              break;

            case "create_box":
              block
                .getInput("WIDTH")
                .connection.targetBlock()
                .setFieldValue(String(newWidth), "NUM");
              block
                .getInput("HEIGHT")
                .connection.targetBlock()
                .setFieldValue(String(newHeight), "NUM");
              block
                .getInput("DEPTH")
                .connection.targetBlock()
                .setFieldValue(String(newDepth), "NUM");
              break;

            case "create_capsule":
              block
                .getInput("HEIGHT")
                .connection.targetBlock()
                .setFieldValue(String(newHeight), "NUM");
              block
                .getInput("DIAMETER")
                .connection.targetBlock()
                .setFieldValue(String(newWidth), "NUM");
              break;

            case "create_cylinder": {
              const boundingInfo = mesh.getBoundingInfo();
              const originalSize = boundingInfo.boundingBox.extendSize.scale(2);
              mesh.computeWorldMatrix(true);

              let newCylinderHeight = mesh.scaling.y * originalSize.y;
              block
                .getInput("HEIGHT")
                .connection.targetBlock()
                .setFieldValue(
                  String(Math.round(newCylinderHeight * 10) / 10),
                  "NUM",
                );

              let newScaledDiameter =
                Math.round(originalSize.x * mesh.scaling.x * 10) / 10;

              let currentTop = parseFloat(
                block
                  .getInput("DIAMETER_TOP")
                  .connection.targetBlock()
                  .getFieldValue("NUM"),
              );
              let currentBottom = parseFloat(
                block
                  .getInput("DIAMETER_BOTTOM")
                  .connection.targetBlock()
                  .getFieldValue("NUM"),
              );

              if (currentTop >= currentBottom) {
                let newTop = newScaledDiameter;
                let ratio = currentBottom / currentTop;
                let newBottom = Math.round(newTop * ratio * 10) / 10;
                block
                  .getInput("DIAMETER_TOP")
                  .connection.targetBlock()
                  .setFieldValue(String(newTop), "NUM");
                block
                  .getInput("DIAMETER_BOTTOM")
                  .connection.targetBlock()
                  .setFieldValue(String(newBottom), "NUM");
              } else {
                let newBottom = newScaledDiameter;
                let ratio = currentTop / currentBottom;
                let newTop = Math.round(newBottom * ratio * 10) / 10;
                block
                  .getInput("DIAMETER_BOTTOM")
                  .connection.targetBlock()
                  .setFieldValue(String(newBottom), "NUM");
                block
                  .getInput("DIAMETER_TOP")
                  .connection.targetBlock()
                  .setFieldValue(String(newTop), "NUM");
              }
              break;
            }

            case "create_sphere":
              block
                .getInput("DIAMETER_X")
                .connection.targetBlock()
                .setFieldValue(String(newWidth), "NUM");
              block
                .getInput("DIAMETER_Y")
                .connection.targetBlock()
                .setFieldValue(String(newHeight), "NUM");
              block
                .getInput("DIAMETER_Z")
                .connection.targetBlock()
                .setFieldValue(String(newDepth), "NUM");
              break;

            case "load_multi_object":
            case "load_object":
            case "load_character": {
              // Generate a unique group ID for this gizmo action
              const groupId = Blockly.utils.idGenerator.genUid();
              Blockly.Events.setGroup(groupId);

              let addedDoSection = false;
              if (!block.getInput("DO")) {
                block.appendStatementInput("DO").setCheck(null).appendField("");
                addedDoSection = true;
              }

              let scaleBlock = null;
              let modelVariable = block.getFieldValue("ID_VAR");
              const statementConnection = block.getInput("DO").connection;
              if (statementConnection && statementConnection.targetBlock()) {
                let currentBlock = statementConnection.targetBlock();
                while (currentBlock) {
                  if (currentBlock.type === "scale") {
                    const modelField = currentBlock.getFieldValue("BLOCK_NAME");
                    if (modelField === modelVariable) {
                      scaleBlock = currentBlock;
                      break;
                    }
                  }
                  currentBlock = currentBlock.getNextBlock();
                }
              }

              if (!scaleBlock) {
                scaleBlock = Blockly.getMainWorkspace().newBlock("scale");
                scaleBlock.setFieldValue(modelVariable, "BLOCK_NAME");
                scaleBlock.initSvg();
                scaleBlock.render();

                ["X", "Y", "Z"].forEach((axis) => {
                  const input = scaleBlock.getInput(axis);
                  const shadowBlock =
                    Blockly.getMainWorkspace().newBlock("math_number");
                  shadowBlock.setFieldValue("1", "NUM");
                  shadowBlock.setShadow(true);
                  shadowBlock.initSvg();
                  shadowBlock.render();
                  input.connection.connect(shadowBlock.outputConnection);
                });

                scaleBlock.render();
                block
                  .getInput("DO")
                  .connection.connect(scaleBlock.previousConnection);

                // Track this block for DO section cleanup
                const timestamp = Date.now();
                gizmoCreatedBlocks.set(scaleBlock.id, {
                  parentId: block.id,
                  createdDoSection: addedDoSection,
                  timestamp: timestamp,
                });
              }

              function setScaleValue(inputName, value) {
                const input = scaleBlock.getInput(inputName);
                const connectedBlock = input.connection.targetBlock();

                if (connectedBlock) {
                  connectedBlock.setFieldValue(String(value), "NUM");
                }
              }

              const scaleX = Math.round(mesh.scaling.x * 10) / 10;
              const scaleY = Math.round(mesh.scaling.y * 10) / 10;
              const scaleZ = Math.round(mesh.scaling.z * 10) / 10;

              setScaleValue("X", scaleX);
              setScaleValue("Y", scaleY);
              setScaleValue("Z", scaleZ);

              // End undo group
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

  const focusButton = document.getElementById("focusButton");
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
    focusButton,
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
  focusButton.addEventListener("click", () => toggleGizmo("focus"));
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
  gizmoManager.attachToMesh = (mesh) => {
    if (mesh && mesh.name === "ground") {
      turnOffAllGizmos();
      mesh = null;
    }

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

    let _lastDisposeObs = mesh?.onDisposeObservable.addOnce(() => {
      // Only detach if we're still attached to THIS node
      if (
        gizmoManager?.attachedMesh === mesh ||
        gizmoManager?.attachedNode === mesh
      ) {
        gizmoManager?.attachToMesh(null);
      }
    });
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

      //console.log("Delete", blockKey, meshMap);
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

// Export functions for global access
window.toggleGizmo = toggleGizmo;
window.turnOffAllGizmos = turnOffAllGizmos;
