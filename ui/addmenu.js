import * as Blockly from "blockly";
import { flock } from "../flock.js";
import {
  multiObjectNames,
  objectNames,
  characterNames,
  objectColours,
} from "../config.js";
import { setPositionValues } from "./addmeshes.js";
import { getCanvasXAndCanvasYValues } from "./gizmos.js";
import { highlightBlockById } from "./blocklyutil.js";
import {
  roundPositionValue,
  addNumberShadow,
  addXYZShadows,
  addColourShadow,
  addPositionShadows,
  addColourShadowSpec,
  buildColorsListShadowSpec,
} from "./blocklyshadowutil.js";

const colorFields = {
  HAIR_COLOR: "#000000", // Hair: black
  SKIN_COLOR: "#A15C33", // Skin: custom skin tone
  EYES_COLOR: "#000000", // Eyes: black
  SLEEVES_COLOR: "#fpo008B8B", // Sleeves: dark cyan
  SHORTS_COLOR: "#00008B", // Shorts: dark blue
  TSHIRT_COLOR: "#FF8F60", // T-Shirt: light orange
};

export function createBlockWithShadows(shapeType, position, colour) {
  const workspace = Blockly.getMainWorkspace();
  const spec = __CREATE_SPEC[shapeType];
  if (!spec) return null;

  const c = colour ? colour : flock.randomColour();
  const posX = position?.x !== undefined ? roundPos(position.x) : 0;
  const posY = position?.y !== undefined ? roundPos(position.y) : 0;
  const posZ = position?.z !== undefined ? roundPos(position.z) : 0;

  const defaults = { ...spec.defaults({ c }), X: posX, Y: posY, Z: posZ };

  let allInputs;
  if (shapeType === "set_sky_color") {
    allInputs = [...spec.inputs];
  } else {
    allInputs = [...spec.inputs, "X", "Y", "Z"];
  }

  const data = { type: shapeType, inputs: {} };
  for (const name of allInputs) {
    const { type, field } = __metaFor(name);
    data.inputs[name] = {
      shadow: makeShadowSpec(type, { [field]: defaults[name] }),
    };
  }

  const existingGroup = Blockly.Events.getGroup();
  const startTempGroup = !existingGroup;
  if (startTempGroup) Blockly.Events.setGroup(true);
  const groupId = Blockly.Events.getGroup();

  const eventsWereEnabled = Blockly.Events.isEnabled();
  if (!eventsWereEnabled) Blockly.Events.enable();

  try {
    Blockly.Events.setGroup(groupId);

    let block;
    try {
      // Modern signature
      block = Blockly.serialization.blocks.append(data, workspace, {
        recordUndo: true,
      });
    } catch {
      block = Blockly.serialization.blocks.append(data, workspace);
      const ev = new Blockly.Events.BlockCreate(block);
      ev.group = groupId;
      ev.recordUndo = true;
      Blockly.Events.fire(ev);
    }

    block?.initSvg?.();
    block?.render?.();
    return block;
  } finally {
    if (startTempGroup) Blockly.Events.setGroup(false);
    else Blockly.Events.setGroup(existingGroup);
    if (!eventsWereEnabled) Blockly.Events.disable();
  }
}

function makeShadowSpec(type, fields) {
  return { type, fields };
}
function roundPos(v) {
  return typeof roundPositionValue === "function" ? roundPositionValue(v) : v;
}

const __CREATE_SPEC = {
  create_box: {
    defaults: ({ c }) => ({ COLOR: c, WIDTH: 1, HEIGHT: 1, DEPTH: 1 }),
    inputs: ["COLOR", "WIDTH", "HEIGHT", "DEPTH"],
  },
  create_sphere: {
    defaults: ({ c }) => ({
      COLOR: c,
      DIAMETER_X: 1,
      DIAMETER_Y: 1,
      DIAMETER_Z: 1,
    }),
    inputs: ["COLOR", "DIAMETER_X", "DIAMETER_Y", "DIAMETER_Z"],
  },
  create_cylinder: {
    defaults: ({ c }) => ({
      COLOR: c,
      HEIGHT: 1,
      DIAMETER_TOP: 1,
      DIAMETER_BOTTOM: 1,
      TESSELLATIONS: 24,
    }),
    inputs: [
      "COLOR",
      "HEIGHT",
      "DIAMETER_TOP",
      "DIAMETER_BOTTOM",
      "TESSELLATIONS",
    ],
  },
  create_capsule: {
    defaults: ({ c }) => ({ COLOR: c, DIAMETER: 1, HEIGHT: 2 }),
    inputs: ["COLOR", "DIAMETER", "HEIGHT"],
  },
  create_plane: {
    defaults: ({ c }) => ({ COLOR: c, WIDTH: 2, HEIGHT: 2 }),
    inputs: ["COLOR", "WIDTH", "HEIGHT"],
  },
  set_sky_color: {
    defaults: ({ c }) => ({ COLOR: c }),
    inputs: ["COLOR"],
  },
};

function __metaFor(name) {
  return name === "COLOR"
    ? { type: "colour", field: "COLOR" }
    : { type: "math_number", field: "NUM" };
}

function addShapeToWorkspace(shapeType, position) {
  const workspace = Blockly.getMainWorkspace();

  const existingGroup = Blockly.Events.getGroup();
  const startTempGroup = !existingGroup;
  if (startTempGroup) Blockly.Events.setGroup(true);
  const groupId = Blockly.Events.getGroup();

  const eventsWereEnabled = Blockly.Events.isEnabled();
  if (!eventsWereEnabled) Blockly.Events.enable();

  try {
    Blockly.Events.setGroup(groupId);
    const block = createBlockWithShadows(shapeType, position);
    if (!block) {
      console.error(`Failed to create block of type: ${shapeType}`);
      return null;
    }

    try {
      setPositionValues(block, position, shapeType);
    } catch (e) {
      console.error("Error setting position values:", e);
    }

    const startSpec = { type: "start" };
    let startBlock;
    try {
      startBlock = Blockly.serialization.blocks.append(startSpec, workspace, {
        recordUndo: true,
      });
    } catch {
      startBlock = Blockly.serialization.blocks.append(startSpec, workspace);
      const ev = new Blockly.Events.BlockCreate(startBlock);
      ev.group = groupId;
      ev.recordUndo = true;
      Blockly.Events.fire(ev);
    }
    startBlock?.initSvg?.();
    startBlock?.render?.();

    const connection = startBlock?.getInput("DO")?.connection;
    if (connection && block.previousConnection) {
      try {
        connection.connect(block.previousConnection);
      } catch (e) {
        console.error("Error connecting to start block:", e);
      }
    }

    try {
      highlightBlockById(workspace, block);
    } catch (e) {
      console.error("Error highlighting block:", e);
    }

    return block;
  } catch (error) {
    console.error("Error in addShapeToWorkspace:", error);
    return null;
  } finally {
    if (startTempGroup) Blockly.Events.setGroup(false);
    else Blockly.Events.setGroup(existingGroup);
    if (!eventsWereEnabled) Blockly.Events.disable();
  }
}

function selectCharacter(characterName) {
  const dd = document.getElementById("shapes-dropdown");
  if (dd) dd.style.display = "none";

  const workspace = Blockly.getMainWorkspace();
  const canvas =
    flock.canvas || flock.scene?.getEngine()?.getRenderingCanvas?.();

  if (flock.activePickHandler) {
    window.removeEventListener("click", flock.activePickHandler, true);
    flock.activePickHandler = null;
  }

  function appendWithUndo(spec, ws, groupId) {
    let block;
    try {
      block = Blockly.serialization.blocks.append(spec, ws, {
        recordUndo: true,
      });
    } catch {
      block = Blockly.serialization.blocks.append(spec, ws);
      const ev = new Blockly.Events.BlockCreate(block);
      ev.group = groupId;
      ev.recordUndo = true;
      Blockly.Events.fire(ev);
    }
    block?.initSvg?.();
    block?.render?.();
    return block;
  }

  function cleanup() {
    document.body.style.cursor = "default";
    if (flock.activePickHandler) {
      window.removeEventListener("click", flock.activePickHandler, true);
      flock.activePickHandler = null;
    }
  }

  flock.activePickHandler = function onPick(event) {
    if (!canvas) return cleanup();
    const rect = canvas.getBoundingClientRect();
    const x = event.clientX - rect.left;
    const y = event.clientY - rect.top;

    if (x < 0 || y < 0 || x > rect.width || y > rect.height) {
      return cleanup();
    }

    const pick = flock.scene.pick(x, y);
    if (!pick?.hit) {
      return cleanup();
    }

    const pickedPosition = pick.pickedPoint;

    const prevGroup = Blockly.Events.getGroup();
    const startTempGroup = !prevGroup;
    if (startTempGroup) Blockly.Events.setGroup(true);
    const groupId = Blockly.Events.getGroup();

    const eventsWereEnabled = Blockly.Events.isEnabled();
    if (!eventsWereEnabled) Blockly.Events.enable();

    try {
      Blockly.Events.setGroup(groupId);

      const spec = {
        type: "load_character",
        fields: { MODELS: characterName },
        inputs: {},
      };
      addPositionShadows(spec, pickedPosition);
      addNumberShadow(spec, "SCALE", 1);

      if (typeof colorFields === "object" && colorFields) {
        for (const [inputName, hex] of Object.entries(colorFields)) {
          const shadowType =
            inputName === "SKIN_COLOR" ? "skin_colour" : "colour";
          addColourShadow(spec, inputName, shadowType, hex);
        }
      }

      const charBlock = appendWithUndo(spec, workspace, groupId);

      try {
        setPositionValues?.(charBlock, pickedPosition, "load_character");
      } catch {}

      const startBlock = appendWithUndo({ type: "start" }, workspace, groupId);
      const conn = startBlock?.getInput("DO")?.connection;
      if (conn && charBlock?.previousConnection) {
        try {
          conn.connect(charBlock.previousConnection);
        } catch (e) {
          console.error(e);
        }
      }

      try {
        highlightBlockById?.(workspace, charBlock);
      } catch {}
    } finally {
      if (startTempGroup) Blockly.Events.setGroup(false);
      else Blockly.Events.setGroup(prevGroup);
      if (!eventsWereEnabled) Blockly.Events.disable();
    }

    cleanup();
  };

  try {
    startKeyboardPlacementMode?.(flock.activePickHandler);
  } catch {}

  document.body.style.cursor = "crosshair";
  setTimeout(() => {
    window.addEventListener("click", flock.activePickHandler, true);
  }, 0);
}

function selectShape(shapeType) {
  document.getElementById("shapes-dropdown").style.display = "none";

  if (flock.activePickHandler) {
    window.removeEventListener("click", flock.activePickHandler);
    flock.activePickHandler = null;
  }

  flock.activePickHandler = function onPick(event) {
    const canvasRect = flock.canvas.getBoundingClientRect();
    const [canvasX, canvasY] = getCanvasXAndCanvasYValues(event, canvasRect);

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

function selectObject(objectName) {
  selectObjectWithCommand(objectName, "shapes-dropdown", "load_object");
}

function selectMultiObject(objectName) {
  selectObjectWithCommand(objectName, "shapes-dropdown", "load_multi_object");
}

function selectObjectWithCommand(objectName, menu, command) {
  // Hide menu
  const menuEl = document.getElementById(menu);
  if (menuEl) menuEl.style.display = "none";

  const workspace = Blockly.getMainWorkspace();
  const canvas = flock.scene.getEngine().getRenderingCanvas();

  // Remove previous handler
  if (flock.activePickHandler) {
    window.removeEventListener("click", flock.activePickHandler, true);
    flock.activePickHandler = null;
  }

  function appendWithUndo(spec, ws, groupId) {
    let block;
    try {
      block = Blockly.serialization.blocks.append(spec, ws, {
        recordUndo: true,
      });
    } catch {
      block = Blockly.serialization.blocks.append(spec, ws);
      const ev = new Blockly.Events.BlockCreate(block);
      ev.group = groupId;
      ev.recordUndo = true;
      Blockly.Events.fire(ev);
    }
    block?.initSvg?.();
    block?.render?.();
    return block;
  }

  function cleanup() {
    document.body.style.cursor = "default";
    if (flock.activePickHandler) {
      window.removeEventListener("click", flock.activePickHandler, true);
      flock.activePickHandler = null;
    }
  }

  flock.activePickHandler = function onPickMesh(event) {
    const rect = canvas.getBoundingClientRect();
    // Outside canvas? cancel
    if (
      event.clientX < rect.left ||
      event.clientX > rect.right ||
      event.clientY < rect.top ||
      event.clientY > rect.bottom
    )
      return cleanup();

    const x = event.clientX - rect.left;
    const y = event.clientY - rect.top;

    // Ray pick with isPickable filter
    const pickRay = flock.scene.createPickingRay(
      x,
      y,
      flock.BABYLON.Matrix.Identity(),
      flock.scene.activeCamera,
    );
    const pick = flock.scene.pickWithRay(pickRay, (m) => m.isPickable);
    if (!pick?.hit) return cleanup();

    const pickedPosition = pick.pickedPoint;

    // --- single undo/redo group for everything ---
    const prevGroup = Blockly.Events.getGroup();
    const startTempGroup = !prevGroup;
    if (startTempGroup) Blockly.Events.setGroup(true);
    const groupId = Blockly.Events.getGroup();

    const eventsWereEnabled = Blockly.Events.isEnabled();
    if (!eventsWereEnabled) Blockly.Events.enable();

    try {
      Blockly.Events.setGroup(groupId);

      // 1) Build base spec for requested command
      const spec = { type: command, fields: {}, inputs: {} };

      // MODELS for load_* commands
      if (
        command === "load_object" ||
        command === "load_multi_object" ||
        command === "load_model" ||
        command === "load_character"
      ) {
        spec.fields.MODELS = objectName;
      }

      // Position + scale shadows
      addXYZShadows(spec, pickedPosition);
      addNumberShadow(spec, "SCALE", 1);

      // Single-object default colour
      if (command === "load_object") {
        const configColors = objectColours?.[objectName];
        const color = Array.isArray(configColors)
          ? configColors[0]
          : configColors || "#FFD700";
        addColourShadowSpec(spec, "COLOR", color, "colour");
      }

      // Multi-object: embed full COLORS list as a shadow so redo restores it
      if (command === "load_multi_object") {
        spec.inputs.COLORS = { shadow: buildColorsListShadowSpec(objectName) };
      }

      const block = appendWithUndo(spec, workspace, groupId);

      try {
        setPositionValues?.(block, pickedPosition, command);
      } catch {}

      const startBlock = appendWithUndo({ type: "start" }, workspace, groupId);
      const conn = startBlock?.getInput("DO")?.connection;
      if (conn && block?.previousConnection) {
        try {
          conn.connect(block.previousConnection);
        } catch (e) {
          console.error("connect error:", e);
        }
      }

      try {
        highlightBlockById?.(workspace, block);
      } catch {}
    } finally {
      if (startTempGroup) Blockly.Events.setGroup(false);
      else Blockly.Events.setGroup(prevGroup);
      if (!eventsWereEnabled) Blockly.Events.disable();
    }

    cleanup();
  };

  try {
    startKeyboardPlacementMode?.(flock.activePickHandler);
  } catch {}

  // Mouse click fallback (capture=true)
  document.body.style.cursor = "crosshair";
  setTimeout(
    () => window.addEventListener("click", flock.activePickHandler, true),
    0,
  );
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

  const shapeRow = dropdown.querySelector("#shape-row");
  if (shapeRow) {
    items.push(...Array.from(shapeRow.querySelectorAll("li")));
  }

  const objectRow = dropdown.querySelector("#object-row");
  if (objectRow) {
    items.push(...Array.from(objectRow.querySelectorAll("li")));
  }

  const modelRow = dropdown.querySelector("#model-row");
  if (modelRow) {
    items.push(...Array.from(modelRow.querySelectorAll("li")));
  }

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

function loadMultiImages() {
  loadImages("model-row", multiObjectNames, "selectMultiObject");
}

function loadObjectImages() {
  loadImages("object-row", objectNames, "selectObject");
}

if (!window.flock) window.flock = {};
flock.activePickHandler = null; // Mouse handler singleton

let placementCallback = null; // Keyboard placement callback singleton
let keyboardPlacementMode = false;
let placementCircle = null;
let placementCirclePosition = { x: 0, y: 0 };

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
    defaultPosition: flock.BABYLON.Vector3.Zero(),
  };

  placementCallback(syntheticEvent);

  // Clean up the active handler to match mouse behavior
  if (flock.activePickHandler) {
    window.removeEventListener("click", flock.activePickHandler);
    flock.activePickHandler = null;
  }

  cancelPlacement();
}

// Export functions to be used globally
window.selectCharacter = selectCharacter;
window.selectShape = selectShape;
window.selectObject = selectObject;
window.selectMultiObject = selectMultiObject;
window.scrollObjects = scrollObjects;
window.scrollCharacters = scrollCharacters;
window.scrollModels = scrollModels;
window.showShapes = showShapes;
