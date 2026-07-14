import * as Blockly from "blockly";
import {
  addNumberShadow,
  addXYZShadows,
  addColourShadowSpec,
  buildColorsListShadowSpec,
  addPositionShadows,
  addColourShadow,
} from "./blocklyshadowutil.js";
let lastAddMenuHighlighted = null;

// Whether a block has been locked (non-editable / non-movable / non-deletable).
export function isBlockLocked(block) {
  return !!block?.locked;
}

// Recursively remove lock-related serialized attributes from a block-save JSON
// node and its inputs/next, so a pasted/duplicated copy is created unlocked.
export function stripLockState(node) {
  if (!node || typeof node !== "object") return;
  delete node.movable;
  delete node.editable;
  delete node.deletable;
  if (node.inputs) {
    for (const name of Object.keys(node.inputs)) {
      stripLockState(node.inputs[name]?.block);
      stripLockState(node.inputs[name]?.shadow);
    }
  }
  if (node.next) {
    stripLockState(node.next.block);
    stripLockState(node.next.shadow);
  }
}

// Lock or unlock a block and all of its descendants (including connected shadow
// blocks, so nested X/Y/Z, size and colour fields can't be edited either). Only
// the top block carries the persisted `locked` flag; descendants are re-cascaded
// on load by the flockLock serializer.
// Collect the block plus everything nested *inside* it: blocks plugged into its
// value/statement inputs (recursively), including the full statement stack of a
// DO-style input. Blocks connected after the root via its next connection are
// siblings, not nested, so they are deliberately excluded.
function getLockTargets(rootBlock) {
  const targets = [];
  const visit = (b, isRoot) => {
    targets.push(b);
    for (const input of b.inputList || []) {
      const child = input.connection?.targetBlock?.();
      if (child) visit(child, false);
    }
    // Follow the next chain only below the root: a statement stack inside a DO
    // is nested and should be locked; the root's own next block is a sibling.
    if (!isRoot) {
      const next = b.getNextBlock?.();
      if (next) visit(next, false);
    }
  };
  visit(rootBlock, true);
  return targets;
}

// A drag strategy that reports the block as movable (so Blockly treats a press
// as a block drag rather than falling back to panning the workspace) but does
// nothing — a locked block neither moves nor drags the canvas.
function makeNoopDragStrategy(block) {
  return {
    isMovable: () => true,
    startDrag: () => block,
    drag: () => {},
    endDrag: () => {},
    revertDrag: () => {},
  };
}

// Apply (or clear) the locked state on a single block. Does not cascade.
export function applyBlockLockState(b, locked) {
  if (!b) return;
  b.locked = locked;
  if (typeof b.setEditable === "function") b.setEditable(!locked);
  // Shadow blocks are inherently non-movable/non-deletable; toggling those on
  // them would wrongly make them draggable/removable when unlocked.
  if (!b.isShadow?.()) {
    if (typeof b.setDeletable === "function") b.setDeletable(!locked);
    if (typeof b.setMovable === "function") b.setMovable(!locked);
    // Swap in a no-op drag strategy while locked. setMovable(false) alone
    // makes Blockly pan the workspace when you try to drag the block; a
    // movable-but-no-op strategy consumes the drag gesture instead.
    if (typeof b.setDragStrategy === "function") {
      if (locked) {
        if (!b._origDragStrategy) b._origDragStrategy = b.getDragStrategy?.();
        b.setDragStrategy(makeNoopDragStrategy(b));
      } else if (b._origDragStrategy) {
        b.setDragStrategy(b._origDragStrategy);
        delete b._origDragStrategy;
      }
    }
  }
  // Tag each locked block individually so the "no entry" cursor applies to the
  // locked subtree only, not to sibling blocks nested below it in the SVG DOM.
  b.getSvgRoot?.()?.classList.toggle("blockly-locked", locked);
}

// Colour-swatch blocks carry only a colour field. They stay editable even
// inside a locked block so the colour can still be changed while every other
// input stays frozen.
const COLOUR_BLOCK_TYPES = new Set(["colour", "skin_colour", "colour_picker"]);
function isColourBlock(b) {
  return COLOUR_BLOCK_TYPES.has(b?.type);
}

export function setBlockLocked(block, locked) {
  if (!block) return;
  for (const b of getLockTargets(block)) {
    // When locking, leave colour swatches editable; unlocking clears them all.
    applyBlockLockState(b, locked && !isColourBlock(b));
  }
}

// Toggle a comment on a block: remove it if present, otherwise add an empty one
// and open its bubble for editing. Used by the floating block toolbar's comment
// button (which is an add/remove affordance).
export function toggleBlockComment(block) {
  if (!block) return;
  if (block.getCommentText() !== null) {
    block.setCommentText(null);
  } else {
    block.setCommentText("");
    getCommentIcon(block)?.setBubbleVisible(true);
  }
}

function getCommentIcon(block) {
  return (
    block?.getIcons?.().find((i) => typeof i.setBubbleVisible === "function") ??
    null
  );
}

// Toggle the comment bubble open/closed, creating the comment if the block
// doesn't have one yet. When opening, move keyboard focus into the comment
// editor so the user can type straight away. Used by the 'K' shortcut; never
// deletes (use deleteBlockComment for that). Async because Blockly's
// setBubbleVisible resolves once the bubble has been (re)rendered.
export async function toggleCommentBubble(block) {
  if (!block) return;
  if (block.getCommentText() === null) block.setCommentText("");
  const icon = getCommentIcon(block);
  if (!icon) return;
  if (icon.bubbleIsVisible?.()) {
    await icon.setBubbleVisible(false);
    return;
  }
  await icon.setBubbleVisible(true);
  // performAction() is the comment bubble's documented keyboard-navigation
  // entry point: it focuses the editor's text area.
  icon.getBubble?.()?.performAction?.();
}

// Remove a block's comment entirely (icon and text), if it has one.
export function deleteBlockComment(block) {
  if (!block) return;
  if (block.getCommentText() !== null) block.setCommentText(null);
}

function trackBlockHighlight(workspace, blockId) {
  lastAddMenuHighlighted = { workspace, blockId };
  const block = workspace.getBlockById(blockId);
  block.select();
  ensurePassiveFocusWrapper(workspace);
}

function ensurePassiveFocusWrapper(workspace) {
    if (!workspace || workspace.__addMenuPassiveFocusWrapped) return;
    const orig = workspace.getRestoredFocusableNode?.bind(workspace);
    if (!orig) return;
    workspace.getRestoredFocusableNode = (prevTree, prevNode) => {
      if (lastAddMenuHighlighted?.workspace === workspace) {
        const block = workspace.getBlockById(lastAddMenuHighlighted.blockId);
        if (block) return block;
      }
      return orig(prevTree, prevNode);
    };
    workspace.__addMenuPassiveFocusWrapped = true;
}

function clearAddMenuHighlight(workspace, newSelectedId) {
  if (
    !lastAddMenuHighlighted ||
    lastAddMenuHighlighted.workspace !== workspace ||
    lastAddMenuHighlighted.blockId === newSelectedId
  ) {
    return;
  }

  const block = workspace.getBlockById(lastAddMenuHighlighted.blockId);
  block?.unselect?.();

  lastAddMenuHighlighted = null;
}

export function appendWithUndo(spec, ws, groupId) {
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

export function getLastHighlightedBlockId(workspace) {
  return lastAddMenuHighlighted?.workspace === workspace
    ? lastAddMenuHighlighted.blockId
    : null;
}

export function restoreBlockFocus(workspace, blockId) {
  if (!workspace || !blockId) return;
  const block = workspace.getBlockById(blockId);
  if (!block) return;

  // On a view switch (canvas -> code) just bring the block back into view.
  // Deliberately do NOT select or focus it: re-selecting armed the persistent
  // getRestoredFocusableNode override, which hijacked focus on the next tap
  // (first tap showed no toolbar) and left a stale selection ring on the old
  // block. Leaving nothing selected means the next tap selects cleanly.
  scrollToBlockTopParentLeft(workspace, blockId);
}

export function highlightBlockById(workspace, block) {
  if (!workspace || !block || block.workspace !== workspace) return;

  // Select and scroll only when the code view is actually visible. `window.codeMode`
  // only tracks the wide-screen split-view toggle (switchView) — the narrow-screen
  // canvas/code tab toggle (showCanvasView/showCodeView) hides #codePanel via
  // style.display without ever updating codeMode, so check the DOM directly.
  const codePanel = document.getElementById("codePanel");
  const codeVisible = !codePanel || codePanel.style.display !== "none";
  if (codeVisible) {
    ensureAddMenuSelectionCleanup(workspace);

    clearAddMenuHighlight(workspace, block.id);

    trackBlockHighlight(workspace, block.id);

    // Scroll to position the block at the top and its parent at the left
    scrollToBlockTopParentLeft(workspace, block.id);
  }
}

function ensureAddMenuSelectionCleanup(workspace) {
  if (!workspace || workspace.__addMenuSelectionCleanupAttached) return;

  const listener = (event) => {
    const isSelectEvent =
      event.type === Blockly.Events.SELECTED ||
      (event.type === Blockly.Events.UI && event.element === "selected");

    if (isSelectEvent) {
      clearAddMenuHighlight(workspace, event.newElementId);
    }
  };

  workspace.addChangeListener(listener);
  workspace.__addMenuSelectionCleanupAttached = true;
}

export function scrollToBlockTopParentLeft(workspace, blockId) {
  if (!workspace.isMovable()) {
    console.warn("Tried to move a non-movable workspace.");
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

  workspace.scroll(x, y);
}

// Updated setPositionValues function with rounding behavior
export function setPositionValues(block, position, blockType, decimals = 1) {
  // Helper function to set position values on blocks
  if (block && position) {
    try {
      // Helper function to set or create shadow block for position input
      function setOrCreatePositionInput(inputName, value) {
        const input = block.getInput(inputName);
        if (!input) return;

        // Round the value to the requested number of decimal places
        const factor = 10 ** decimals;
        const roundedValue = Math.round(value * factor) / factor;

        let targetBlock = input.connection.targetBlock();
        if (!targetBlock) {
          // Create a shadow block if none exists
          const shadowBlock =
            Blockly.getMainWorkspace().newBlock("math_number");
          shadowBlock.setFieldValue(String(roundedValue), "NUM");
          shadowBlock.setShadow(true);
          shadowBlock.setMovable(false);
          shadowBlock.setDeletable(false);
          shadowBlock.initSvg();
          shadowBlock.render();
          input.connection.connect(shadowBlock.outputConnection);
        } else {
          // Set the value if a block is already connected
          targetBlock.setFieldValue(String(roundedValue), "NUM");
        }
      }

      setOrCreatePositionInput("X", position.x);
      setOrCreatePositionInput("Y", position.y);
      setOrCreatePositionInput("Z", position.z);
    } catch (e) {
      console.warn("Could not set position values for block:", blockType, e);
    }
  }
}

export function getCanvasXAndCanvasYValues(event, canvasRect) {
  return [event.clientX - canvasRect.left, event.clientY - canvasRect.top];
}

export function createBlockForObject(
  workspace,
  command,
  objectName,
  pickedPosition,
  objectColours,
  setPositionValues,
  highlightBlockById,
) {
  const prevGroup = Blockly.Events.getGroup();
  const startTempGroup = !prevGroup;
  if (startTempGroup) Blockly.Events.setGroup(true);
  const groupId = Blockly.Events.getGroup();

  const eventsWereEnabled = Blockly.Events.isEnabled();
  if (!eventsWereEnabled) Blockly.Events.enable();

  try {
    Blockly.Events.setGroup(groupId);

    const spec = { type: command, fields: {}, inputs: {} };

    if (
      command === "load_object" ||
      command === "load_multi_object" ||
      command === "load_model" ||
      command === "load_character"
    ) {
      spec.fields.MODELS = objectName;
    }

    addXYZShadows(spec, pickedPosition);
    addNumberShadow(spec, "SCALE", 1);

    if (command === "load_object") {
      const configColors = objectColours?.[objectName];
      const color = Array.isArray(configColors)
        ? configColors[0]
        : configColors || "#FFD700";
      addColourShadowSpec(spec, "COLOR", color, "colour");
    }

    if (command === "load_multi_object") {
      spec.inputs.COLORS = {
        shadow: buildColorsListShadowSpec(objectName),
      };
    }

    const block = appendWithUndo(spec, workspace, groupId);

    try {
      setPositionValues?.(block, pickedPosition, command);
    } catch (error) {
      console.warn("setPositionValues failed for object block:", error);
    }

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
    } catch (error) {
      console.warn("highlightBlockById failed for object block:", error);
    }
  } finally {
    if (startTempGroup) Blockly.Events.setGroup(false);
    else Blockly.Events.setGroup(prevGroup);
    if (!eventsWereEnabled) Blockly.Events.disable();
  }
}

/**
 * Handles the creation of the "load_character" Blockly block
 * and connects it to the 'start' block.
 */
export function createBlockForCharacter(
  workspace,
  characterName,
  pickedPosition,
  colorFields,
  setPositionValues,
  highlightBlockById,
) {
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
    } catch (error) {
      console.warn("setPositionValues failed for character block:", error);
    }

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
    } catch (error) {
      console.warn("highlightBlockById failed for character block:", error);
    }
  } finally {
    if (startTempGroup) Blockly.Events.setGroup(false);
    else Blockly.Events.setGroup(prevGroup);
    if (!eventsWereEnabled) Blockly.Events.disable();
  }
}

const roundToOneDecimal = (value) => Math.round(value * 10) / 10;

export function setBlockXYZ(block, x, y, z) {
  const setInputValue = (inputName, value) => {
    const input = block.getInput(inputName);
    if (!input?.connection) return;
    const connectedBlock = input.connection.targetBlock();

    if (connectedBlock?.getField?.("NUM")) {
      connectedBlock.setFieldValue(String(value), "NUM");
    }
  };

  setInputValue("X", roundToOneDecimal(x));
  setInputValue("Y", roundToOneDecimal(y));
  setInputValue("Z", roundToOneDecimal(z));
}

export function duplicateBlockAndInsert(
  originalBlock,
  workspace,
  pickedPosition,
) {
  if (!originalBlock) {
    return null;
  }

  Blockly.Events.setGroup("duplicate");

  const blockJson = Blockly.serialization.blocks.save(originalBlock, {
    includeShadows: true,
  });

  if (blockJson.next) {
    delete blockJson.next;
  }

  // A copy of a locked block must come out unlocked/movable.
  stripLockState(blockJson);

  const duplicateBlock = Blockly.serialization.blocks.append(
    blockJson,
    workspace,
  );

  setPositionValues(duplicateBlock, pickedPosition, duplicateBlock.type);

  if (originalBlock.nextConnection && duplicateBlock.previousConnection) {
    originalBlock.nextConnection.connect(duplicateBlock.previousConnection);
  } else {
    duplicateBlock.moveBy(50, 50);
  }

  Blockly.Events.setGroup(false);

  // Trigger update of mesh from block values
  queueMicrotask(() => {
    Blockly.Events.setGroup("duplicate");

    const descendants = duplicateBlock.getDescendants(false);

    for (const b of descendants) {
      const transformChildTypes = ["rotate_to", "resize"];
      if (!transformChildTypes.includes(b.type)) continue;

      for (const input of b.inputList ?? []) {
        const numBlock = input.connection?.targetBlock?.();
        if (!numBlock) continue;

        if (typeof numBlock.getFieldValue !== "function") continue;
        const current = numBlock.getFieldValue("NUM");
        if (current === null || current === undefined) continue;

        const currNum = Number(current);
        const oldValue = Number.isFinite(currNum)
          ? String(currNum - 1e-6)
          : "__refresh_old__";
        const newValue = String(current);

        Blockly.Events.fire(
          new Blockly.Events.BlockChange(
            numBlock,
            "field",
            "NUM",
            oldValue,
            newValue,
          ),
        );
      }
    }

    Blockly.Events.setGroup(false);
  });

  duplicateBlock.initSvg();
  duplicateBlock.render();

  return duplicateBlock;
}

export function findParentWithBlockId(mesh) {
  let currentNode = mesh;
  while (currentNode) {
    if (currentNode.metadata?.blockKey !== undefined) {
      return currentNode;
    }
    currentNode = currentNode.parent;
  }

  return null;
}

export function calculateYPosition(mesh) {
  if (!mesh) return 0;

  mesh.computeWorldMatrix?.(true);
  mesh.refreshBoundingInfo?.();

  const boundingInfo = mesh.getBoundingInfo?.();
  const minY = boundingInfo?.boundingBox?.minimumWorld?.y;

  return Number.isFinite(minY) ? minY : mesh.position.y;
}

export function setNumberInputs(block, valuesByInputName) {
  if (!block || !valuesByInputName) return;

  for (const [inputName, value] of Object.entries(valuesByInputName)) {
    if (value === undefined || value === null) continue;

    const n = Number(value);
    if (!Number.isFinite(n)) continue;

    const target = block.getInput(inputName)?.connection?.targetBlock?.();
    if (!target?.getField?.("NUM")) continue;
    target.setFieldValue(String(roundToOneDecimal(n)), "NUM");
  }
}

export function getNumberInput(block, inputName) {
  const target = block?.getInput(inputName)?.connection?.targetBlock?.();
  if (!target?.getFieldValue) return NaN;

  const n = Number(target.getFieldValue("NUM"));
  return Number.isFinite(n) ? n : NaN;
}

