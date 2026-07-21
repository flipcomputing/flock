import * as Blockly from "blockly";
import { flock } from "../flock.js";
import {
  multiObjectNames,
  objectNames,
  characterNames,
  objectColours,
} from "../config.js";
import {
  highlightBlockById,
  setPositionValues,
  getCanvasXAndCanvasYValues,
  createBlockForObject,
  createBlockForCharacter,
} from "./blocklyutil.js";
import { roundPositionValue } from "./blocklyshadowutil.js";
import {
  startCanvasKeyboardMode,
  stopCanvasKeyboardMode,
  setCrosshairCursor,
  setDefaultCursor,
} from "./canvas-utils.js";
import { GizmoMenuManager } from "../accessibility/keyboardui.js";
import { showStatus, clearStatus } from "./status.js";
import { translate } from "../main/translation.js";
import { KeyboardDispatcher } from "../main/keyboardDispatcher.js";

const colorFields = {
  HAIR_COLOR: "#000000", // Hair: black
  SKIN_COLOR: "#A15C33", // Skin: custom skin tone
  EYES_COLOR: "#000000", // Eyes: black
  SLEEVES_COLOR: "#fpo008B8B", // Sleeves: dark cyan
  SHORTS_COLOR: "#00008B", // Shorts: dark blue
  TSHIRT_COLOR: "#FF8F60", // T-Shirt: light orange
};

export function createBlockWithShadows(shapeType, position, colour, decimals = 1) {
  const workspace = Blockly.getMainWorkspace();
  const spec = __CREATE_SPEC[shapeType];
  if (!spec) return null;

  const posX =
    position?.x !== undefined ? roundPositionValue(position.x, decimals) : 0;
  const posY =
    position?.y !== undefined ? roundPositionValue(position.y, decimals) : 0;
  const posZ =
    position?.z !== undefined ? roundPositionValue(position.z, decimals) : 0;

  const defaults = {
    ...spec.defaults({ c: colour }),
    X: posX,
    Y: posY,
    Z: posZ,
  };

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

// Matches the ground detection used elsewhere (see api/scene.js).
function isGroundMesh(mesh) {
  if (!mesh) return false;
  const name = mesh?.name?.toLowerCase?.() ?? "";
  return (
    name === "ground" ||
    name.includes("ground") ||
    mesh?.metadata?.blockKey === "ground"
  );
}

// Rotation (in degrees) that makes a default plane — whose normal faces
// world +Z — lie flat against a surface with the given world-space normal.
// Returns null when no rotation is needed (normal already faces +Z).
function planeRotationForNormal(normal) {
  const BABYLON = flock.BABYLON;
  const from = new BABYLON.Vector3(0, 0, 1);
  const to = normal.clone();
  to.normalize();

  const rawDot = BABYLON.Vector3.Dot(from, to);
  if (!Number.isFinite(rawDot)) return null; // bad/degenerate normal
  const dot = Math.max(-1, Math.min(1, rawDot));

  let quat;
  if (dot > 0.999999) {
    return null; // already aligned with +Z
  } else if (dot < -0.999999) {
    // Opposite direction: 180° about the world up axis.
    quat = BABYLON.Quaternion.RotationAxis(new BABYLON.Vector3(0, 1, 0), Math.PI);
  } else {
    const axis = BABYLON.Vector3.Cross(from, to);
    axis.normalize();
    quat = BABYLON.Quaternion.RotationAxis(axis, Math.acos(dot));
  }

  const euler = quat.toEulerAngles();
  const toDeg = (r) => Math.round(BABYLON.Tools.ToDegrees(r) * 10) / 10;
  return { x: toDeg(euler.x), y: toDeg(euler.y), z: toDeg(euler.z) };
}

// Nest a rotate_to block inside a create block's DO section, mirroring the
// rotate gizmo (see findOrCreateRotateBlock in ui/gizmos.js). The rotate_to
// references the create block's own mesh variable (ID_VAR) and is given the
// supplied {x, y, z} rotation in degrees.
// Apply a flat-lying rotation to the live preview mesh. The preview mesh is
// created from the block on a later tick (Blockly fires create events
// asynchronously), and we look it up by metadata.blockKey rather than by name,
// which whenModelReady cannot do. So poll for the mesh, then rotate it
// directly (with physics) the way the rotate gizmo does.
function applyLiveRotationWhenReady(blockId, rotation, attempts = 0) {
  if (!rotation) return;
  // createPlane strips the "<name>__<blockId>" suffix off the mesh name and
  // stores the block id in metadata.blockKey, so look the mesh up by that
  // rather than by name.
  const mesh = (flock.scene?.meshes || []).find(
    (m) => m.metadata?.blockKey === blockId,
  );
  if (mesh) {
    flock.rotateTo(mesh.name, rotation);
    return;
  }
  if (attempts < 60) {
    requestAnimationFrame(() =>
      applyLiveRotationWhenReady(blockId, rotation, attempts + 1),
    );
  }
}

function addRotationToCreateBlock(block, rotation) {
  const workspace = Blockly.getMainWorkspace();
  const modelVariable = block.getFieldValue("ID_VAR");

  if (!block.getInput("DO")) {
    block.appendStatementInput("DO").setCheck(null).appendField("");
  }

  const rotateBlock = workspace.newBlock("rotate_to");
  rotateBlock.setFieldValue(modelVariable, "MODEL");
  rotateBlock.initSvg();
  rotateBlock.render();

  const axisValues = { X: rotation.x, Y: rotation.y, Z: rotation.z };
  for (const axis of ["X", "Y", "Z"]) {
    const input = rotateBlock.getInput(axis);
    const shadow = workspace.newBlock("math_number");
    shadow.setFieldValue(String(axisValues[axis]), "NUM");
    shadow.setShadow(true);
    shadow.initSvg();
    shadow.render();
    input.connection.connect(shadow.outputConnection);
  }
  rotateBlock.render();

  const doConnection = block.getInput("DO").connection;
  const firstBlock = doConnection.targetBlock();
  if (firstBlock) {
    let tail = firstBlock;
    while (tail.getNextBlock()) tail = tail.getNextBlock();
    tail.nextConnection.connect(rotateBlock.previousConnection);
  } else {
    doConnection.connect(rotateBlock.previousConnection);
  }

  return rotateBlock;
}

function addShapeToWorkspace(shapeType, position, decimals = 1, rotation = null) {
  const workspace = Blockly.getMainWorkspace();

  const existingGroup = Blockly.Events.getGroup();
  const startTempGroup = !existingGroup;
  if (startTempGroup) Blockly.Events.setGroup(true);
  const groupId = Blockly.Events.getGroup();

  const eventsWereEnabled = Blockly.Events.isEnabled();
  if (!eventsWereEnabled) Blockly.Events.enable();

  try {
    Blockly.Events.setGroup(groupId);
    const block = createBlockWithShadows(
      shapeType,
      position,
      flock.randomColour(),
      decimals,
    );
    if (!block) {
      console.error(`Failed to create block of type: ${shapeType}`);
      return null;
    }

    try {
      setPositionValues(block, position, shapeType, decimals);
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

    // For a plane placed flat against a surface, nest a rotate_to block
    // inside the create block's DO section — the same shape the rotate gizmo
    // produces — so the orientation lives with the plane and is captured in
    // the program.
    if (rotation) {
      try {
        addRotationToCreateBlock(block, rotation);
      } catch (e) {
        console.error("Error adding rotation block:", e);
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
  removeKeyboardNavigation();

  const workspace = Blockly.getMainWorkspace();
  const canvas =
    flock.canvas || flock.scene?.getEngine()?.getRenderingCanvas?.();

  function cleanup() {
    cleanupPlacementMode();
  }

  flock.activePickHandler = function onPick(event) {
    if (!canvas) return cleanup();

    const rect = canvas.getBoundingClientRect();
    const x = event.clientX - rect.left;
    const y = event.clientY - rect.top;

    if (x < 0 || y < 0 || x > rect.width || y > rect.height) {
      return cleanup();
    }

    // Uses scene.pick(x, y) for raycasting
    const pick = flock.scene.pick(x, y);
    if (!pick?.hit) {
      return cleanup();
    }

    const pickedPosition = pick.pickedPoint;

    createBlockForCharacter(
      workspace,
      characterName,
      pickedPosition,
      colorFields,
      setPositionValues,
      highlightBlockById,
    );

    cleanup();
  };

  try {
    startPlacementKeyboardMode();
  } catch (error) {
    console.warn("Unable to start keyboard placement mode.", error);
  }

  setCrosshairCursor();
  showStatus(translate("place_object_prompt"), { owner: "placement" });
  registerActivePickHandler(flock.activePickHandler, {
    capture: true,
    delay: 0,
  });
}

function selectShape(shapeType) {
  const dropdown = document.getElementById("shapes-dropdown");
  if (dropdown) dropdown.style.display = "none";
  removeKeyboardNavigation();
  detachActivePickHandler();

  const canvas = flock.scene?.getEngine?.().getRenderingCanvas?.();
  if (!canvas || !flock.scene) return;

  flock.activePickHandler = function onPick(event) {
    const canvasRect = canvas.getBoundingClientRect();
    if (
      event.clientX < canvasRect.left ||
      event.clientX > canvasRect.right ||
      event.clientY < canvasRect.top ||
      event.clientY > canvasRect.bottom
    ) {
      cleanupPlacementMode();
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
    if (pickResult && pickResult.hit) {
      // A plane dropped onto another object's surface ends up coplanar with
      // the hit face and z-fights with it. Only in that case do we nudge the
      // plane clear along the surface normal. Planes placed on the ground (or
      // any non-plane shape) keep their exact picked position.
      if (shapeType === "create_plane" && !isGroundMesh(pickResult.pickedMesh)) {
        // Use the geometric face normal (useVerticesNormals = false) in world
        // space, so the plane lies flat against the actual clicked face rather
        // than an interpolated/averaged vertex normal.
        const normal = pickResult.getNormal?.(true, false);
        if (normal) {
          // getNormal returns the geometric face normal with an unreliable sign
          // (winding/scaling can flip it). Normalise it to point OUT of the
          // surface, toward the camera — the side the click came from. The pick
          // ray travels into the surface, so a positive dot means the normal
          // points inward; flip it in that case.
          if (flock.BABYLON.Vector3.Dot(normal, pickRay.direction) > 0) {
            normal.negateInPlace();
          }
          // `normal` now points outward (toward the viewer). The plane's
          // readable face is its -Z side (a default flock plane is double-sided
          // and text reads correctly on -Z), so to face the readable side at
          // the viewer we align the plane's +Z with the INWARD direction — the
          // opposite of the outward normal. planeRotationForNormal aligns +Z
          // with whatever vector it is given, so pass the negated normal.
          const rotation = planeRotationForNormal(normal.scale(-1));
          const p = pickResult.pickedPoint;
          // Round to 2 decimals (0.01 grid), matching the precision the block
          // is stored at below. The default roundPositionValue precision is a
          // 0.1 grid, which moves the pick point up to 0.05 off the true
          // surface — enough that the small normal nudge below either leaves a
          // visible gap (rounded outward) or fails to clear the face and
          // z-fights (rounded inward). The finer grid keeps the point within
          // 0.005 of the surface so the nudge is reliable.
          const base = new flock.BABYLON.Vector3(
            roundPositionValue(p.x, 2),
            roundPositionValue(p.y, 2),
            roundPositionValue(p.z, 2)
          );
          // Nudge along the outward normal so the plane sits just clear of the
          // surface (toward the viewer) and does not z-fight the clicked face.
          const position = base.add(normal.scale(0.02));

          // Compensate for flock's "base rule": when the plane is created it is
          // still upright (height 2), and the base rule places the unrotated
          // bottom at position.y — shifting the centre up by half the height.
          // rotate_to then flattens the plane around that centre, so without
          // this it would float ~1 unit above the surface. Subtract that shift
          // (height/2 of the default plane) so the flat plane lands on the
          // clicked surface. See applyPositionWithCurrentBaseRule in
          // api/transform.js.
          const DEFAULT_PLANE_HALF_HEIGHT = 1; // create_plane default HEIGHT (2) / 2
          position.y -= DEFAULT_PLANE_HALF_HEIGHT;

          const planeBlock = addShapeToWorkspace(shapeType, position, 2, rotation);

          if (rotation && planeBlock) {
            applyLiveRotationWhenReady(planeBlock.id, rotation);
          }
        } else {
          addShapeToWorkspace(shapeType, pickResult.pickedPoint);
        }
      } else {
        addShapeToWorkspace(shapeType, pickResult.pickedPoint);
      }
    }

    cleanupPlacementMode();
  };

  // Start keyboard placement mode with singleton handler
  startPlacementKeyboardMode();

  // Also set up mouse click as fallback
  setCrosshairCursor();
  showStatus(translate("place_object_prompt"), { owner: "placement" });
  registerActivePickHandler(flock.activePickHandler, {
    capture: true,
    delay: 0,
  });
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
  removeKeyboardNavigation();

  const workspace = Blockly.getMainWorkspace();
  const canvas = flock.scene?.getEngine?.().getRenderingCanvas?.();
  if (!canvas || !flock.scene) return;

  function cleanup() {
    cleanupPlacementMode();
  }

  flock.activePickHandler = function onPickMesh(event) {
    const rect = canvas.getBoundingClientRect();
    if (
      event.clientX < rect.left ||
      event.clientX > rect.right ||
      event.clientY < rect.top ||
      event.clientY > rect.bottom
    )
      return cleanup();

    const x = event.clientX - rect.left;
    const y = event.clientY - rect.top;

    const pickRay = flock.scene.createPickingRay(
      x,
      y,
      flock.BABYLON.Matrix.Identity(),
      flock.scene.activeCamera,
    );
    const pick = flock.scene.pickWithRay(pickRay, (m) => m.isPickable);
    if (!pick?.hit) return cleanup();

    const pickedPosition = pick.pickedPoint;

    createBlockForObject(
      workspace,
      command,
      objectName,
      pickedPosition,
      objectColours,
      setPositionValues,
      highlightBlockById,
    );

    cleanup();
  };

  try {
    startPlacementKeyboardMode();
  } catch (error) {
    console.warn("Unable to start keyboard placement mode.", error);
  }

  // Mouse click fallback (capture=true)
  setCrosshairCursor();
  showStatus(translate("place_object_prompt"), { owner: "placement" });
  registerActivePickHandler(flock.activePickHandler, {
    capture: true,
    delay: 0,
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

function scrollRowWithWrap(row, direction, step = 68) {
  if (!row) return;

  const max = Math.max(0, row.scrollWidth - row.clientWidth);
  const current = row.scrollLeft;

  // Work in whole-icon steps so every resting position lands on the icon
  // grid. Clamp to the last grid position at or before `max` — `max` itself
  // sits in the trailing ::after spacer, so scrolling to it leaves the icons
  // out of alignment. Flooring keeps us on a grid line and stops at the end
  // instead of wrapping back to the start.
  const maxStep = Math.floor(max / step);
  const nextStep = Math.max(
    0,
    Math.min(maxStep, Math.round(current / step) + direction),
  );
  const next = nextStep * step;

  if (Math.abs(next - current) < 1) return; // already at this position

  row.scrollTo({ left: next, behavior: "smooth" });
}

function scrollModels(direction) {
  scrollRowWithWrap(document.getElementById("model-row"), direction, 68);
}
function scrollObjects(direction) {
  scrollRowWithWrap(document.getElementById("object-row"), direction, 68);
}
function scrollCharacters(direction) {
  scrollRowWithWrap(document.getElementById("character-row"), direction, 68);
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
flock.activePickHandlerCapture = false;

function detachActivePickHandler() {
  if (flock.activePickHandler) {
    window.removeEventListener(
      "click",
      flock.activePickHandler,
      flock.activePickHandlerCapture,
    );
    flock.activePickHandler = null;
  }
  flock.activePickHandlerCapture = false;
}

function registerActivePickHandler(
  handler,
  { capture = false, delay = 0 } = {},
) {
  detachActivePickHandler();
  document.getElementById("showShapesButton")?.classList.add("active");
  flock.activePickHandler = handler;
  flock.activePickHandlerCapture = capture;

  setTimeout(() => {
    if (flock.activePickHandler === handler) {
      window.addEventListener("click", handler, flock.activePickHandlerCapture);
    }
  }, delay);
}

function cleanupPlacementMode() {
  detachActivePickHandler();
  stopCanvasKeyboardMode();
  setDefaultCursor();
  clearStatus("placement");
  document.getElementById("showShapesButton")?.classList.remove("active");
}

// The two phone layouts in style.css, where the popup opens into space that can
// be shorter than the full menu: portrait (below the toolbar) and landscape
// (rightward from the plus button, across the docked toolbar).
const isPhoneShapesLayout = () =>
  window.matchMedia("(max-width: 600px)").matches ||
  window.matchMedia(
    "(max-width: 1024px) and (orientation: landscape) and (max-height: 500px)",
  ).matches;

// In those layouts the menu can run off the bottom of the canvas. Cap its
// height to the gap between its top and the bottom view-toggle bar (mirroring
// the colour picker) and scroll inside, so all of it stays reachable. No-op on
// wider layouts.
function fitShapesDropdownToViewport(dropdown) {
  // Always measure unclipped: a cap left over from a previous open would hide
  // how tall the menu actually wants to be.
  dropdown.style.maxHeight = "";
  dropdown.style.overflow = "";
  if (!isPhoneShapesLayout()) return;

  const top = dropdown.getBoundingClientRect().top;
  const bottomBar = document.getElementById("bottomBar");
  const limit = bottomBar
    ? bottomBar.getBoundingClientRect().top
    : window.innerHeight;
  // Stop the menu just above the bar. No lower floor here: a floor taller than
  // the available space would push the menu's bottom down over the bar, which
  // is exactly the overlap we're avoiding. When space is tight it scrolls.
  const available = Math.max(0, limit - top - 8);
  // Only clip when it genuinely doesn't fit: scrolling y forces x to clip too,
  // which would cut off the row chevrons where they sit outside the menu box.
  if (dropdown.scrollHeight <= available) return;
  dropdown.style.maxHeight = `${available}px`;
  dropdown.style.overflow = "hidden auto"; // clip x, scroll y when needed
}

function showShapes() {
  cancelPlacement(); // Always remove all placement modes when menu is opened/closed

  const dropdown = document.getElementById("shapes-dropdown");
  if (!dropdown) return;
  const isVisible = dropdown.style.display !== "none";

  if (isVisible) {
    dropdown.style.display = "none";
    removeKeyboardNavigation();
  } else {
    dropdown.style.display = "block";
    loadObjectImages();
    loadMultiImages();
    loadCharacterImages();
    // After the rows are filled: the fit measures how tall the menu actually
    // is, which is nothing until its tiles exist.
    fitShapesDropdownToViewport(dropdown);
    setupKeyboardNavigation();
  }
}

// Close the shapes menu if the user clicks outside of it
document.addEventListener("click", function (event) {
  const dropdown = document.getElementById("shapes-dropdown");
  if (!dropdown) return;

  const isClickInside = dropdown.contains(event.target);
  const showShapesButton = document.getElementById("showShapesButton");
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
  cleanupPlacementMode();
}

// Close the add-shape dropdown when the gizmo overlay opens (e.g. Ctrl+G),
// so it doesn't sit on top of the gizmo buttons it's meant to reveal.
GizmoMenuManager.registerCloseHook(() => {
  const dropdown = document.getElementById("shapes-dropdown");
  if (!dropdown || dropdown.style.display === "none") return;
  dropdown.style.display = "none";
  removeKeyboardNavigation();
  cancelPlacement();
});

// --- Keyboard Navigation ---

let currentFocusedElement = null;
let keyboardNavigationActive = false;

function setupKeyboardNavigation() {
  KeyboardDispatcher.clearModes(); // flush any lingering gizmo keyboard modes (e.g. axis-keyboard)
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

// --- Menu Keyboard Navigation Handling ---

function handleShapeMenuKeydown(event) {
  if (!keyboardNavigationActive) return;
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
    case "Escape": {
      event.preventDefault();
      const dropdown = document.getElementById("shapes-dropdown");
      if (dropdown) dropdown.style.display = "none";
      removeKeyboardNavigation();
      cancelPlacement();
      const shapesButton = document.getElementById("showShapesButton");
      if (shapesButton) shapesButton.focus();
      break;
    }
  }
}

function startPlacementKeyboardMode() {
  const canvas = flock.scene?.getEngine?.().getRenderingCanvas?.();
  if (!flock.scene || !canvas) return;
  const isValidHit = (x, y) =>
    !!flock.scene.pick(x, y, (mesh) => mesh.isPickable)?.hit;

  startCanvasKeyboardMode(
    (x, y) => {
      const canvasRect = canvas.getBoundingClientRect();
      flock.activePickHandler({
        clientX: canvasRect.left + x,
        clientY: canvasRect.top + y,
        defaultPosition: flock.BABYLON.Vector3.Zero(),
      });
      cancelPlacement();
    },
    keyboardNavigationActive,
    isValidHit,
  );
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
