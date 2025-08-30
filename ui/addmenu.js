import * as Blockly from "blockly";
import { flock } from "../flock.js";
import {
  multiObjectNames,
  objectNames,
  characterNames,
  objectColours,
} from "../config.js";

const colorFields = {
  HAIR_COLOR: "#000000", // Hair: black
  SKIN_COLOR: "#A15C33", // Skin: custom skin tone
  EYES_COLOR: "#000000", // Eyes: black
  SLEEVES_COLOR: "#fpo008B8B", // Sleeves: dark cyan
  SHORTS_COLOR: "#00008B", // Shorts: dark blue
  TSHIRT_COLOR: "#FF8F60", // T-Shirt: light orange
};

// Helper function to create and attach shadow blocks
function addShadowBlock(block, inputName, blockType, defaultValue) {
  const shadowBlock = Blockly.getMainWorkspace().newBlock(blockType);

  // Determine the correct field based on block type
  const fieldName = ["colour", "skin_colour"].includes(blockType)
    ? "COLOR"
    : "NUM";

  shadowBlock.setFieldValue(String(defaultValue), fieldName);
  shadowBlock.setShadow(true); // Ensure it's treated as a shadow block
  shadowBlock.setMovable(false); // Prevent dragging
  shadowBlock.setDeletable(false); // Prevent deletion
  shadowBlock.initSvg();
  shadowBlock.render();
  block.getInput(inputName).connection.connect(shadowBlock.outputConnection);
}



// Helper function to set a numeric input value or create a shadow block if missing
function setNumberInput(block, inputName, value) {
  let inputConnection = block.getInput(inputName).connection;
  let targetBlock = inputConnection.targetBlock();

  if (!targetBlock) {
    // Create a shadow block for the input if none exists
    const shadowBlock = Blockly.getMainWorkspace().newBlock("math_number");
    shadowBlock.setFieldValue(String(Math.round(value * 10) / 10), "NUM");
    shadowBlock.setShadow(true); // Ensure it's treated as a shadow block
    shadowBlock.setMovable(false); // Prevent dragging
    shadowBlock.setDeletable(false); // Prevent deletion
    shadowBlock.initSvg();
    shadowBlock.render();
    inputConnection.connect(shadowBlock.outputConnection);
  } else {
    // Set the value if a block is already connected
    targetBlock.setFieldValue(String(Math.round(value * 10) / 10), "NUM");
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

export function highlightBlockById(workspace, block) {
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

import { setPositionValues } from "./addmeshes.js";

function addShapeToWorkspace(shapeType, position) {
  //console.log("Adding shape to workspace", shapeType, position);
  Blockly.Events.setGroup(true);

  // Create the shape block in the Blockly workspace

  const block = Blockly.getMainWorkspace().newBlock(shapeType);

  Blockly.Events.disable();
  let color,
    width,
    height,
    depth,
    diameterX,
    diameterY,
    diameterZ,
    diameter,
    diameterTop,
    diameterBottom,
    sides;

  // Set different fields based on the shape type and capture the actual values
  switch (shapeType) {
    case "create_box":
      color = flock.randomColour();
      width = 1;
      height = 1;
      depth = 1;
      addShadowBlock(block, "COLOR", "colour", color);
      addShadowBlock(block, "WIDTH", "math_number", width);
      addShadowBlock(block, "HEIGHT", "math_number", height);
      addShadowBlock(block, "DEPTH", "math_number", depth);
      break;

    case "create_sphere":
      color = flock.randomColour();
      diameterX = 1;
      diameterY = 1;
      diameterZ = 1;
      addShadowBlock(block, "COLOR", "colour", color);
      addShadowBlock(block, "DIAMETER_X", "math_number", diameterX);
      addShadowBlock(block, "DIAMETER_Y", "math_number", diameterY);
      addShadowBlock(block, "DIAMETER_Z", "math_number", diameterZ);
      break;

    case "create_cylinder":
      color = flock.randomColour();
      height = 1;
      diameterTop = 1;
      diameterBottom = 1;
      sides = 24;
      addShadowBlock(block, "COLOR", "colour", color);
      addShadowBlock(block, "HEIGHT", "math_number", height);
      addShadowBlock(block, "DIAMETER_TOP", "math_number", diameterTop);
      addShadowBlock(block, "DIAMETER_BOTTOM", "math_number", diameterBottom);
      addShadowBlock(block, "TESSELLATIONS", "math_number", sides);
      break;

    case "create_capsule":
      color = flock.randomColour();
      diameter = 1;
      height = 2;
      addShadowBlock(block, "COLOR", "colour", color);
      addShadowBlock(block, "DIAMETER", "math_number", diameter);
      addShadowBlock(block, "HEIGHT", "math_number", height);
      break;

    case "create_plane":
      color = flock.randomColour();
      width = 2;
      height = 2;
      addShadowBlock(block, "COLOR", "colour", color);
      addShadowBlock(block, "WIDTH", "math_number", width);
      addShadowBlock(block, "HEIGHT", "math_number", height);
      break;

    default:
      Blockly.Events.setGroup(false);
      return;
  }

  // Set position values (X, Y, Z) from the picked position
  setPositionValues(block, position, shapeType);
  // Initialize and render the shape block
  block.initSvg();
  block.render();
  Blockly.Events.enable();

  // Create a new 'start' block and connect the shape block to it
  const startBlock = Blockly.getMainWorkspace().newBlock("start");
  startBlock.initSvg();
  startBlock.render();

  const connection = startBlock.getInput("DO").connection;
  if (connection) {
    connection.connect(block.previousConnection);
  }

  Blockly.Events.setGroup(false);

  highlightBlockById(Blockly.getMainWorkspace(), block);
}

function selectCharacter(characterName) {
  document.getElementById("shapes-dropdown").style.display = "none";

  // Remove any previous handler before adding a new one!
  if (flock.activePickHandler) {
    window.removeEventListener("click", flock.activePickHandler);
    flock.activePickHandler = null;
  }

  flock.activePickHandler = function onPick(event) {
    const canvasRect = flock.canvas.getBoundingClientRect();
    const canvasX = event.clientX - canvasRect.left;
    const canvasY = event.clientY - canvasRect.top;

    const pickResult = flock.scene.pick(canvasX, canvasY);
    if (pickResult.hit) {
      const pickedPosition = pickResult.pickedPoint;

      Blockly.Events.setGroup(true);
      try {
        const block = Blockly.getMainWorkspace().newBlock("load_character");
        block.setFieldValue(characterName, "MODELS");

        setPositionValues(block, pickedPosition, "load_character");

        const scale = 1;
        addShadowBlock(block, "SCALE", "math_number", scale);
        Object.keys(colorFields).forEach((colorInputName) => {
          addShadowBlock(
            block,
            colorInputName,
            colorInputName === "SKIN_COLOR" ? "skin_colour" : "colour",
            colorFields[colorInputName],
          );
        });

        block.initSvg();
        block.render();
        highlightBlockById(Blockly.getMainWorkspace(), block);

        const startBlock = Blockly.getMainWorkspace().newBlock("start");
        startBlock.initSvg();
        startBlock.render();
        const connection = startBlock.getInput("DO").connection;
        if (connection) {
          connection.connect(block.previousConnection);
        }
      } finally {
        Blockly.Events.setGroup(false);
      }
    }

    document.body.style.cursor = "default";
    window.removeEventListener("click", flock.activePickHandler);
    flock.activePickHandler = null;
  };

  // Start keyboard placement mode with singleton handler
  startKeyboardPlacementMode(flock.activePickHandler);

  // Also set up mouse click as fallback
  document.body.style.cursor = "crosshair";
  setTimeout(() => {
    window.addEventListener("click", flock.activePickHandler);
  }, 300);
}

function selectShape(shapeType) {
  document.getElementById("shapes-dropdown").style.display = "none";

  // Remove any previous handler before adding a new one!
  if (flock.activePickHandler) {
    window.removeEventListener("click", flock.activePickHandler);
    flock.activePickHandler = null;
  }

  flock.activePickHandler = function onPick(event) {
    const canvasRect = flock.canvas.getBoundingClientRect();
    const canvasX = event.clientX - canvasRect.left;
    const canvasY = event.clientY - canvasRect.top;

    const pickResult = flock.scene.pick(canvasX, canvasY);
    if (pickResult && pickResult.hit) {
      addShapeToWorkspace(shapeType, pickResult.pickedPoint);
    }

    document.body.style.cursor = "default";
    window.removeEventListener("click", flock.activePickHandler);
    flock.activePickHandler = null;
  };

  // Start keyboard placement mode with singleton handler
  startKeyboardPlacementMode(flock.activePickHandler);

  // Also set up mouse click as fallback
  document.body.style.cursor = "crosshair";
  setTimeout(() => {
    window.addEventListener("click", flock.activePickHandler);
  }, 300);
}

function selectModel(modelName) {
  // Close the shapes menu after selecting a model
  document.getElementById("shapes-dropdown").style.display = "none";

  const onPick = function (event) {
    const canvasRect = flock.canvas.getBoundingClientRect();
    const canvasX = event.clientX - canvasRect.left;
    const canvasY = event.clientY - canvasRect.top;

    const pickResult = flock.scene.pick(canvasX, canvasY);
    if (pickResult.hit) {
      const pickedPosition = pickResult.pickedPoint;

      // Start a Blockly event group to ensure undo/redo tracks all changes
      Blockly.Events.setGroup(true);

      try {
        // Add the load_model block to the workspace at the picked location
        const block = Blockly.getMainWorkspace().newBlock("load_model");
        block.setFieldValue(modelName, "MODELS"); // Set the selected model

        setPositionValues(block, pickedPosition, "load_model"); // Set X, Y, Z

        // Create shadow block for SCALE using the addShadowBlock helper function
        const scale = 1; // Default scale value
        addShadowBlock(block, "SCALE", "math_number", scale);

        block.initSvg();
        block.render();

        highlightBlockById(Blockly.getMainWorkspace(), block);

        // Create a new start block and connect the model block to it
        const startBlock = Blockly.getMainWorkspace().newBlock("start");
        startBlock.initSvg();
        startBlock.render();
        const connection = startBlock.getInput("DO").connection;
        if (connection) {
          connection.connect(block.previousConnection);
        }
      } finally {
        // End the event group to ensure undo/redo works properly
        Blockly.Events.setGroup(false);
      }
    }

    document.body.style.cursor = "default"; // Reset cursor after picking
    window.removeEventListener("click", onPick); // Remove the click listener after pick
  };

  // Start keyboard placement mode
  startKeyboardPlacementMode(onPick);

  // Also set up mouse click as fallback
  document.body.style.cursor = "crosshair";
  setTimeout(() => {
    window.addEventListener("click", onPick);
  }, 300);
}

function selectObject(objectName) {
  selectObjectWithCommand(objectName, "shapes-dropdown", "load_object");
}

function selectMultiObject(objectName) {
  selectObjectWithCommand(objectName, "shapes-dropdown", "load_multi_object");
}

function selectObjectWithCommand(objectName, menu, command) {
  document.getElementById(menu).style.display = "none";
  const canvas = flock.scene.getEngine().getRenderingCanvas();

  // Remove any previous handler!
  if (flock.activePickHandler) {
    window.removeEventListener("click", flock.activePickHandler);
    flock.activePickHandler = null;
  }

  flock.activePickHandler = function onPickMesh(event) {
    const canvasRect = canvas.getBoundingClientRect();

    // Check if the click happened outside the canvas
    if (
      event.clientX < canvasRect.left ||
      event.clientX > canvasRect.right ||
      event.clientY < canvasRect.top ||
      event.clientY > canvasRect.bottom
    ) {
      window.removeEventListener("click", flock.activePickHandler);
      flock.activePickHandler = null;
      document.body.style.cursor = "default";
      return;
    }

    const canvasX = event.clientX - canvasRect.left;
    const canvasY = event.clientY - canvasRect.top;

    // Create a picking ray using the adjusted canvas coordinates
    const pickRay = flock.scene.createPickingRay(
      canvasX,
      canvasY,
      flock.BABYLON.Matrix.Identity(),
      flock.scene.activeCamera,
    );

    // Perform the picking
    const pickResult = flock.scene.pickWithRay(
      pickRay,
      (mesh) => mesh.isPickable,
    );

    if (pickResult.hit) {
      const pickedPosition = pickResult.pickedPoint;

      Blockly.Events.setGroup(true);

      try {
        const block = Blockly.getMainWorkspace().newBlock(command);
        block.initSvg();
        highlightBlockById(Blockly.getMainWorkspace(), block);

        block.setFieldValue(objectName, "MODELS");
        setPositionValues(block, pickedPosition, command);
        addShadowBlock(block, "SCALE", "math_number", 1);

        if (command === "load_object") {
          const configColors = objectColours[objectName];
          const color = Array.isArray(configColors)
            ? configColors[0]
            : configColors || "#FFD700";
          addShadowBlock(block, "COLOR", "colour", color);
        } else if (command === "load_multi_object") {
          if (Blockly.Blocks["load_multi_object"].updateColorsField) {
            Blockly.Blocks["load_multi_object"].updateColorsField.call(block);
          }
        }

        block.render();

        const startBlock = Blockly.getMainWorkspace().newBlock("start");
        startBlock.initSvg();
        startBlock.render();

        const connection = startBlock.getInput("DO").connection;
        if (connection) {
          connection.connect(block.previousConnection);
        }
      } finally {
        Blockly.Events.setGroup(false);
      }
    }

    document.body.style.cursor = "default";
    window.removeEventListener("click", flock.activePickHandler);
    flock.activePickHandler = null;
  };

  // Start keyboard placement mode (reuses the same handler, so also cancels click)
  startKeyboardPlacementMode(flock.activePickHandler);

  // Set up mouse click as fallback
  document.body.style.cursor = "crosshair";
  setTimeout(() => {
    window.addEventListener("click", flock.activePickHandler);
  }, 200);
}

// Scroll function to move the object row left or right
function scrollObjects(direction) {
  const objectRow = document.getElementById("object-row");
  const scrollAmount = 100; // Adjust scroll amount as needed
  objectRow.scrollBy({
    left: direction * scrollAmount,
    behavior: "smooth",
  });
}

// Function to load characters into the menu
function loadCharacterImages() {
  const characterRow = document.getElementById("character-row");
  characterRow.replaceChildren();
  // Clear existing characters

  characterNames.forEach((name) => {
    const baseName = name.replace(/\.[^/.]+$/, ""); // Remove extension

    const img = document.createElement("img");
    img.src = `./images/${baseName}.png`;
    img.alt = baseName;
    img.addEventListener("click", () => selectCharacter(name));

    const li = document.createElement("li");
    li.appendChild(img);

    characterRow.appendChild(li);
  });
}

// Scroll function to move the character row left or right
function scrollCharacters(direction) {
  const characterRow = document.getElementById("character-row");
  const scrollAmount = 100; // Adjust scroll amount as needed
  characterRow.scrollBy({
    left: direction * scrollAmount,
    behavior: "smooth",
  });
}

function getAllNavigableItems() {
  const dropdown = document.getElementById("shapes-dropdown");
  if (!dropdown) return [];

  // Get all clickable items from all rows
  const items = [];

  // Shape row items
  const shapeRow = dropdown.querySelector("#shape-row");
  if (shapeRow) {
    items.push(...Array.from(shapeRow.querySelectorAll("li")));
  }

  // Object row items
  const objectRow = dropdown.querySelector("#object-row");
  if (objectRow) {
    items.push(...Array.from(objectRow.querySelectorAll("li")));
  }

  // Model row items
  const modelRow = dropdown.querySelector("#model-row");
  if (modelRow) {
    items.push(...Array.from(modelRow.querySelectorAll("li")));
  }

  // Character row items
  const characterRow = dropdown.querySelector("#character-row");
  if (characterRow) {
    items.push(...Array.from(characterRow.querySelectorAll("li")));
  }

  return items;
}

function focusItem(item) {
  if (currentFocusedElement) {
    currentFocusedElement.classList.remove("keyboard-focused");
    currentFocusedElement.setAttribute("tabindex", "-1");
  }

  currentFocusedElement = item;
  item.classList.add("keyboard-focused");
  item.setAttribute("tabindex", "0");
  item.focus();

  // Scroll item into view if needed
  item.scrollIntoView({ block: "nearest", inline: "nearest" });
}

function navigateHorizontal(allItems, currentIndex, direction) {
  if (currentIndex === -1) {
    focusItem(allItems[0]);
    return;
  }

  const currentItem = allItems[currentIndex];
  const currentRect = currentItem.getBoundingClientRect();
  const currentY = Math.round(currentRect.top);

  // Find all items in the same row (same Y position)
  const rowItems = allItems.filter((item) => {
    const rect = item.getBoundingClientRect();
    return Math.abs(Math.round(rect.top) - currentY) < 5; // 5px tolerance
  });

  if (rowItems.length <= 1) return; // No other items in this row

  // Sort row items by X position
  rowItems.sort(
    (a, b) => a.getBoundingClientRect().left - b.getBoundingClientRect().left,
  );

  const currentRowIndex = rowItems.indexOf(currentItem);
  let nextRowIndex;

  if (direction > 0) {
    // Moving right
    nextRowIndex =
      currentRowIndex < rowItems.length - 1 ? currentRowIndex + 1 : 0;
  } else {
    // Moving left
    nextRowIndex =
      currentRowIndex > 0 ? currentRowIndex - 1 : rowItems.length - 1;
  }

  focusItem(rowItems[nextRowIndex]);
}

function navigateVertical(allItems, currentIndex, direction) {
  if (currentIndex === -1) {
    focusItem(allItems[0]);
    return;
  }

  const currentItem = allItems[currentIndex];
  const currentRect = currentItem.getBoundingClientRect();
  const currentX = currentRect.left + currentRect.width / 2; // Use center X
  const currentY = Math.round(currentRect.top);

  // Group all items by their Y position (rows)
  const itemsByRow = new Map();
  allItems.forEach((item) => {
    const rect = item.getBoundingClientRect();
    const y = Math.round(rect.top);

    if (!itemsByRow.has(y)) {
      itemsByRow.set(y, []);
    }
    itemsByRow.get(y).push(item);
  });

  // Sort rows by Y position
  const sortedRows = Array.from(itemsByRow.entries()).sort(
    ([y1], [y2]) => y1 - y2,
  );

  // Find current row index
  const currentRowIndex = sortedRows.findIndex(([y]) => y === currentY);
  if (currentRowIndex === -1) return;

  // Calculate target row
  let targetRowIndex;
  if (direction > 0) {
    // Moving down
    targetRowIndex =
      currentRowIndex < sortedRows.length - 1 ? currentRowIndex + 1 : 0;
  } else {
    // Moving up
    targetRowIndex =
      currentRowIndex > 0 ? currentRowIndex - 1 : sortedRows.length - 1;
  }

  const targetRowItems = sortedRows[targetRowIndex][1];

  // Find the item in target row closest to current X position
  let closestItem = targetRowItems[0];
  let closestDistance = Math.abs(
    closestItem.getBoundingClientRect().left +
      closestItem.getBoundingClientRect().width / 2 -
      currentX,
  );

  targetRowItems.forEach((item) => {
    const itemX =
      item.getBoundingClientRect().left +
      item.getBoundingClientRect().width / 2;
    const distance = Math.abs(itemX - currentX);
    if (distance < closestDistance) {
      closestDistance = distance;
      closestItem = item;
    }
  });

  focusItem(closestItem);
}

function scrollModels(direction) {
  const modelRow = document.getElementById("model-row");
  const scrollAmount = 100; // Adjust as needed
  modelRow.scrollBy({
    left: direction * scrollAmount,
    behavior: "smooth",
  });
}

// Shared function to load images into the menu
function loadImages(rowId, namesArray, selectCallback) {
  const row = document.getElementById(rowId);
  row.replaceChildren(); // Clear existing items

  namesArray.forEach((name) => {
    const baseName = name.replace(/\.[^/.]+$/, ""); // Remove extension

    const img = document.createElement("img");
    img.src = `./images/${baseName}.png`;
    img.alt = baseName;
    img.addEventListener("click", () => {
      // Use a global function or bind properly if needed
      window[selectCallback](name);
    });

    const li = document.createElement("li");
    li.appendChild(img);

    row.appendChild(li);
  });
}

// Refactored loadModelImages using the shared function
function loadMultiImages() {
  loadImages("model-row", multiObjectNames, "selectMultiObject");
}

// Refactored loadObjectImages using the shared function
function loadObjectImages() {
  loadImages("object-row", objectNames, "selectObject");
}

// --- Placement & Navigation State (Globals) ---
if (!window.flock) window.flock = {};
flock.activePickHandler = null; // Mouse handler singleton

let placementCallback = null; // Keyboard placement callback singleton
let keyboardPlacementMode = false;
let placementCircle = null;
let placementCirclePosition = { x: 0, y: 0 };

// --- Menu Show/Hide ---

function showShapes() {
  cancelPlacement(); // Always remove all placement modes when menu is opened/closed

  const dropdown = document.getElementById("shapes-dropdown");
  const isVisible = dropdown.style.display !== "none";

  if (isVisible) {
    dropdown.style.display = "none";
    removeKeyboardNavigation();
  } else {
    dropdown.style.display = "block";
    loadObjectImages();
    loadMultiImages();
    loadCharacterImages();
    setupKeyboardNavigation();
  }
}

// Close the shapes menu if the user clicks outside of it
document.addEventListener("click", function (event) {
  const dropdown = document.getElementById("shapes-dropdown");
  if (!dropdown) return;

  const isClickInside = dropdown.contains(event.target);
  const isClickOnToggle =
    showShapesButton && showShapesButton.contains(event.target);

  if (!isClickInside && !isClickOnToggle) {
    dropdown.style.display = "none";
    removeKeyboardNavigation();
    cancelPlacement(); // Clean up any pending placements
  }
});

// --- Singleton Placement Cancellation ---
function cancelPlacement() {
  if (flock.activeMousePickHandler) {
    window.removeEventListener("click", flock.activeMousePickHandler);
    flock.activeMousePickHandler = null;
    console.log("[cancelPlacement] Mouse handler removed.");
  }
  endKeyboardPlacementMode();
  document.body.style.cursor = "default";
}

// --- Keyboard Navigation ---

let currentFocusedElement = null;
let keyboardNavigationActive = false;

function setupKeyboardNavigation() {
  keyboardNavigationActive = true;
  currentFocusedElement = null;

  document.addEventListener("keydown", handleShapeMenuKeydown);

  const allItems = getAllNavigableItems();
  allItems.forEach((item, index) => {
    item.setAttribute("tabindex", index === 0 ? "0" : "-1");
    item.classList.add("keyboard-navigable");
  });

  if (allItems.length > 0) {
    focusItem(allItems[0]);
  }
}

function removeKeyboardNavigation() {
  keyboardNavigationActive = false;
  currentFocusedElement = null;

  document.removeEventListener("keydown", handleShapeMenuKeydown);

  const allItems = getAllNavigableItems();
  allItems.forEach((item) => {
    item.removeAttribute("tabindex");
    item.classList.remove("keyboard-navigable", "keyboard-focused");
  });
}

function endKeyboardPlacementMode() {
  keyboardPlacementMode = false;
  placementCallback = null;

  if (placementCircle) {
    placementCircle.remove();
    placementCircle = null;
  }

  document.removeEventListener("keydown", handlePlacementKeydown);

  document.body.style.cursor = "default";
}

function createPlacementCircle() {
  if (placementCircle) placementCircle.remove();
  placementCircle = document.createElement("div");
  placementCircle.style.position = "fixed";
  placementCircle.style.width = "20px";
  placementCircle.style.height = "20px";
  placementCircle.style.borderRadius = "50%";
  placementCircle.style.border = "2px solid #FFD700";
  placementCircle.style.backgroundColor = "rgba(255, 215, 0, 0.3)";
  placementCircle.style.pointerEvents = "none";
  placementCircle.style.zIndex = "9999";
  placementCircle.style.transform = "translate(-50%, -50%)";

  // Initialize position here:
  const canvas = flock.scene.getEngine().getRenderingCanvas();
  const canvasRect = canvas.getBoundingClientRect();
  placementCirclePosition.x = canvasRect.width / 2;
  placementCirclePosition.y = canvasRect.height * 0.7;

  updatePlacementCirclePosition();
  document.body.appendChild(placementCircle);
}

function updatePlacementCirclePosition() {
  if (!placementCircle) return;

  const canvas = flock.scene.getEngine().getRenderingCanvas();
  const canvasRect = canvas.getBoundingClientRect();

  // Constrain position to canvas bounds
  placementCirclePosition.x = Math.max(
    10,
    Math.min(canvasRect.width - 10, placementCirclePosition.x),
  );
  placementCirclePosition.y = Math.max(
    10,
    Math.min(canvasRect.height - 10, placementCirclePosition.y),
  );

  // Position relative to canvas
  placementCircle.style.left =
    canvasRect.left + placementCirclePosition.x + "px";
  placementCircle.style.top = canvasRect.top + placementCirclePosition.y + "px";
}

// --- Menu Keyboard Navigation Handling ---

function handleShapeMenuKeydown(event) {
  if (!keyboardNavigationActive) return;
  if (keyboardPlacementMode) return;
  const allItems = getAllNavigableItems();
  if (allItems.length === 0) return;

  const currentIndex = currentFocusedElement
    ? allItems.indexOf(currentFocusedElement)
    : -1;

  switch (event.key) {
    case "ArrowRight":
      event.preventDefault();
      navigateHorizontal(allItems, currentIndex, 1);
      break;
    case "ArrowLeft":
      event.preventDefault();
      navigateHorizontal(allItems, currentIndex, -1);
      break;
    case "ArrowDown":
      event.preventDefault();
      navigateVertical(allItems, currentIndex, 1);
      break;
    case "ArrowUp":
      event.preventDefault();
      navigateVertical(allItems, currentIndex, -1);
      break;
    case "Enter":
    case " ":
      event.preventDefault();
      if (currentFocusedElement) {
        const img = currentFocusedElement.querySelector("img");
        if (img) {
          const altText = img.alt;
          const parentRow = currentFocusedElement.closest(
            "#shape-row, #object-row, #model-row, #character-row",
          );
          if (parentRow) {
            const rowId = parentRow.id;
            if (rowId === "shape-row") {
              const shapeTypeMap = {
                box: "create_box",
                sphere: "create_sphere",
                cylinder: "create_cylinder",
                capsule: "create_capsule",
                plane: "create_plane",
              };
              const shapeType = shapeTypeMap[altText.toLowerCase()];
              if (shapeType) selectShape(shapeType);
            } else if (rowId === "object-row") {
              selectObject(altText + ".glb");
            } else if (rowId === "model-row") {
              selectMultiObject(altText + ".glb");
            } else if (rowId === "character-row") {
              selectCharacter(altText + ".glb");
            }
          }
        }
      }
      break;
    case "Escape":
      event.preventDefault();
      document.getElementById("shapes-dropdown").style.display = "none";
      removeKeyboardNavigation();
      cancelPlacement();
      const shapesButton = document.getElementById("showShapesButton");
      if (shapesButton) shapesButton.focus();
      break;
  }
}

function startKeyboardPlacementMode(callback) {
  endKeyboardPlacementMode();
  keyboardPlacementMode = true;
  placementCallback = callback;
  document.addEventListener("keydown", handlePlacementKeydown);
  document.body.style.cursor = "crosshair";
}

function handlePlacementKeydown(event) {
  if (!keyboardPlacementMode) return;

  const moveDistance = event.shiftKey ? 10 : 2;
  switch (event.key) {
    case "ArrowRight":
      event.preventDefault();
      if (!placementCircle) {
        createPlacementCircle();
        document.body.style.cursor = "none";
      }
      placementCirclePosition.x += moveDistance;
      updatePlacementCirclePosition();
      break;

    case "ArrowLeft":
      event.preventDefault();
      if (!placementCircle) {
        createPlacementCircle();
        document.body.style.cursor = "none";
      }
      placementCirclePosition.x -= moveDistance;
      updatePlacementCirclePosition();
      break;

    case "ArrowDown":
      event.preventDefault();
      if (!placementCircle) {
        createPlacementCircle();
        document.body.style.cursor = "none";
      }
      placementCirclePosition.y += moveDistance;
      updatePlacementCirclePosition();
      break;

    case "ArrowUp":
      event.preventDefault();
      if (!placementCircle) {
        createPlacementCircle();
        document.body.style.cursor = "none";
      }
      placementCirclePosition.y -= moveDistance;
      updatePlacementCirclePosition();
      break;

    case "Enter":
    case " ":
    case "Spacebar":
    case "Space":
      event.preventDefault();
      triggerPlacement();
      break;

    case "Escape":
      event.preventDefault();
      cancelPlacement();
      break;

    default:
      break;
  }
}

function triggerPlacement() {
  if (!placementCallback || !keyboardPlacementMode) return;
  // Use placementCirclePosition as the "click" location for keyboard placement
  const canvas = flock.scene.getEngine().getRenderingCanvas();
  const canvasRect = canvas.getBoundingClientRect();
  const syntheticEvent = {
    clientX: canvasRect.left + placementCirclePosition.x,
    clientY: canvasRect.top + placementCirclePosition.y,
    defaultPosition: new flock.BABYLON.Vector3.Zero(),
  };

  placementCallback(syntheticEvent);
  cancelPlacement();
}

// Export functions to be used globally
window.selectCharacter = selectCharacter;
window.selectShape = selectShape;
window.selectModel = selectModel;
window.selectObject = selectObject;
window.selectMultiObject = selectMultiObject;
window.scrollObjects = scrollObjects;
window.scrollCharacters = scrollCharacters;
window.scrollModels = scrollModels;
window.showShapes = showShapes;