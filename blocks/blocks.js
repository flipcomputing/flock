import * as Blockly from "blockly";
//import "@blockly/block-plus-minus";
import * as BlockDynamicConnection from "@blockly/block-dynamic-connection";
import { toolbox } from "../toolbox.js";
import { getOption, translate } from "../main/translation.js";

import {
  deleteMeshFromBlock,
  updateOrCreateMeshFromBlock,
  getMeshFromBlock,
  applySceneBackgroundFromWorkspace,
  clearSkyMesh,
  setClearSkyToBlack,
} from "../ui/blockmesh.js";
import { registerFieldColour } from "@blockly/field-colour";
import { createThemeConfig } from "../main/themes.js";

registerFieldColour();

export let nextVariableIndexes = {};

export const inlineIcon =
  "data:image/svg+xml,%3C%3Fxml%20version%3D%221.0%22%20encoding%3D%22utf-8%22%3F%3E%3Csvg%20version%3D%221.1%22%20id%3D%22Layer_1%22%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%20xmlns%3Axlink%3D%22http%3A%2F%2Fwww.w3.org%2F1999%2Fxlink%22%20x%3D%220px%22%20y%3D%220px%22%20width%3D%22122.88px%22%20height%3D%2280.593px%22%20viewBox%3D%220%200%20122.88%2080.593%22%20enable-background%3D%22new%200%200%20122.88%2080.593%22%20xml%3Aspace%3D%22preserve%22%3E%3Cg%3E%3Cpolygon%20fill%3D%22white%22%20points%3D%22122.88%2C80.593%20122.88%2C49.772%2061.44%2C0%200%2C49.772%200%2C80.593%2061.44%2C30.82%20122.88%2C80.593%22%2F%3E%3C%2Fg%3E%3C%2Fsvg%3E";

const baseHelpUrl = "https://docs.flockxr.com/blocks/";

export function getHelpUrlFor(blockType) {
  //return baseHelpUrl + blockType;
  return "https://flockxr.com";
}

// Shared utility to add the toggle button to a block
export function addToggleButton(block) {
  const toggleButton = new Blockly.FieldImage(
    inlineIcon, // Custom icon
    30,
    30,
    "*", // Width, Height, Alt text
    () => {
      block.toggleDoBlock();
    },
  );

  block
    .appendDummyInput()
    .setAlign(Blockly.inputs.Align.RIGHT)
    .appendField(toggleButton, "TOGGLE_BUTTON");
}

// Shared utility for the mutationToDom function
export function mutationToDom(block) {
  const container = document.createElement("mutation");
  container.setAttribute("inline", block.isInline);
  return container;
}

// Shared utility for the domToMutation function
export function domToMutation(block, xmlElement) {
  const isInline = xmlElement.getAttribute("inline") === "true";
  block.updateShape_(isInline);
}

// Shared utility to update the shape of the block
export function updateShape(block, isInline) {
  block.isInline = isInline;
  if (isInline) {
    block.setPreviousStatement(true);
    block.setNextStatement(true);
  } else {
    block.setPreviousStatement(false);
    block.setNextStatement(false);
  }
}
export function handleBlockSelect(event) {
  if (event.type === Blockly.Events.SELECTED) {
    const block = Blockly.getMainWorkspace().getBlockById(event.newElementId); // Get the selected block

    if (
      block &&
      block.type !== "create_ground" &&
      block.type !== "create_map" &&
      (block.type.startsWith("create_") || block.type.startsWith("load_"))
    ) {
      // If the block is a create block, update the window.currentMesh variable
      window.updateCurrentMeshName(block, "ID_VAR");
    }
  }
}

export function handleBlockDelete(event) {
  if (event.type === Blockly.Events.BLOCK_DELETE) {
    // Recursively delete meshes for qualifying blocks
    function deleteMeshesRecursively(blockJson) {
      // Check if block type matches the prefixes
      if (
        blockJson.type.startsWith("load_") ||
        blockJson.type.startsWith("create_")
      ) {
        deleteMeshFromBlock(blockJson.id);
      } else if (blockJson.type === "set_background_color") {
        deleteMeshFromBlock(blockJson.id);
        if (
          !applySceneBackgroundFromWorkspace(blockJson.id, {
            allowSkyFallback: false,
          })
        ) {
          clearSkyMesh();
          setClearSkyToBlack();
        }
      } else if (blockJson.type === "set_sky_color") {
        clearSkyMesh();
        if (
          !applySceneBackgroundFromWorkspace(blockJson.id, {
            allowSkyFallback: false,
          })
        ) {
          setClearSkyToBlack();
        }
      }

      // Check inputs for child blocks
      if (blockJson.inputs) {
        for (const key in blockJson.inputs) {
          const inputBlock = blockJson.inputs[key].block;
          if (inputBlock) {
            deleteMeshesRecursively(inputBlock);
          }
        }
      }

      // Check 'next' for connected blocks
      if (blockJson.next && blockJson.next.block) {
        deleteMeshesRecursively(blockJson.next.block);
      }
    }

    // Process the main deleted block and its connections
    deleteMeshesRecursively(event.oldJson);
  }
}

export function handleMeshLifecycleChange(block, changeEvent) {
  const mesh = getMeshFromBlock(block);

  if (
    changeEvent.type === Blockly.Events.BLOCK_MOVE &&
    changeEvent.blockId === block.id
  ) {
    if (block.getParent() && !mesh) {
      updateOrCreateMeshFromBlock(block, changeEvent);
    }
    return true;
  }

  if (
    changeEvent.type === Blockly.Events.BLOCK_CHANGE &&
    changeEvent.blockId === block.id &&
    changeEvent.element === "disabled"
  ) {
    const isDisabling =
      changeEvent.newValue === true || changeEvent.newValue === "true";

    if (!isDisabling) {
      setTimeout(() => {
        const stillExists = Blockly.getMainWorkspace()?.getBlockById?.(
          block.id,
        );

        if (stillExists) {
          updateOrCreateMeshFromBlock(block, changeEvent);
        }
      }, 0);
    } else {
      deleteMeshFromBlock(block.id);
      if (block.type === "set_background_color") {
        if (
          !applySceneBackgroundFromWorkspace(block.id, {
            allowSkyFallback: false,
          })
        ) {
          clearSkyMesh();
          setClearSkyToBlack();
        }
      } else if (block.type === "set_sky_color") {
        clearSkyMesh();
        if (
          !applySceneBackgroundFromWorkspace(block.id, {
            allowSkyFallback: false,
          })
        ) {
          setClearSkyToBlack();
        }
      }
    }
    return true;
  }

  if (
    changeEvent.type === Blockly.Events.BLOCK_CREATE &&
    Blockly.getMainWorkspace().getBlockById(block.id)
  ) {
    const createdBlockIds = Array.isArray(changeEvent.ids)
      ? changeEvent.ids
      : [changeEvent.blockId];

    if (!createdBlockIds.includes(block.id)) return false;
    if (window.loadingCode) return true;
    updateOrCreateMeshFromBlock(block, changeEvent);
    return true;
  }

  return false;
}

export function handleFieldOrChildChange(containerBlock, changeEvent) {
  if (
    changeEvent.type !== Blockly.Events.BLOCK_CHANGE ||
    changeEvent.element !== "field"
  ) {
    return false;
  }

  const ws = Blockly.getMainWorkspace?.();
  const changedBlock = ws?.getBlockById?.(changeEvent.blockId);
  if (!changedBlock) return false;

  if (changedBlock.id === containerBlock.id) {
    updateOrCreateMeshFromBlock(containerBlock, changeEvent);
    return true;
  }

  const parent = changedBlock.getParent?.();
  if (parent && parent.id === containerBlock.id) {
    if (changedBlock.nextConnection || changedBlock.previousConnection)
      return false;
    updateOrCreateMeshFromBlock(containerBlock, changeEvent);
    return true;
  }

  if (containerBlock.type === "create_map") {
    const materialBlock = containerBlock.getInputTargetBlock?.("MATERIAL");
    if (materialBlock) {
      // If the MATERIAL block itself changed, forward.
      if (changedBlock.id === materialBlock.id) {
        updateOrCreateMeshFromBlock(containerBlock, changeEvent);
        return true;
      }

      // Forward if the change occurred in the MATERIAL subtree via VALUE inputs only (not statement chains).
      const INPUT_VALUE =
        typeof Blockly?.INPUT_VALUE !== "undefined" ? Blockly.INPUT_VALUE : 1;

      // Walk up from the changed block to the MATERIAL block,
      // ensuring each step is through a VALUE input connection.
      let node = changedBlock;
      while (node && node !== materialBlock) {
        const p = node.getParent?.();
        if (!p) break;

        const viaValueInput = (p.inputList || []).some(
          (inp) =>
            inp?.type === INPUT_VALUE &&
            inp?.connection?.targetBlock?.() === node,
        );

        if (!viaValueInput) {
          // Left the MATERIAL value-input subtree → do not forward.
          node = null;
          break;
        }
        node = p;
      }

      if (node === materialBlock) {
        updateOrCreateMeshFromBlock(containerBlock, changeEvent);
        return true;
      }
    }
  }

  return false;
}

export function handleParentLinkedUpdate(containerBlock, changeEvent) {
  if (
    changeEvent.type !== Blockly.Events.BLOCK_CREATE &&
    changeEvent.type !== Blockly.Events.BLOCK_CHANGE
  )
    return false;

  const ws = Blockly.getMainWorkspace();
  const changedBlocks =
    changeEvent.type === Blockly.Events.BLOCK_CREATE &&
    Array.isArray(changeEvent.ids)
      ? changeEvent.ids.map((id) => ws.getBlockById(id)).filter(Boolean)
      : [ws.getBlockById(changeEvent.blockId)].filter(Boolean);

  for (const changed of changedBlocks) {
    const parent = findCreateBlock(changed);

    if (parent === containerBlock && changed) {
      if (!window.loadingCode) {
        updateOrCreateMeshFromBlock(containerBlock, changeEvent);
      }
      return true;
    }
  }

  return false;
}

export function findCreateBlock(block) {
  if (!block || typeof block.getParent !== "function") {
    //console.log("no id");
    return null;
  }

  let parent = block;

  while (parent) {
    if (parent.type === "scale" || parent.type === "rotate_to") {
      // Don't update parent if we're modifying a nested scale or rotate
      return null;
    }

    if (
      parent.type.startsWith("create_") ||
      parent.type.startsWith("load_") ||
      parent.type === "set_sky_color" ||
      parent.type === "set_background_color"
    ) {
      return parent;
    }

    // Move up the hierarchy
    parent = parent.getParent();
  }

  // No matching parent found
  return null;
}

export function handleBlockChange(block, changeEvent, variableNamePrefix) {
  // Always run first to handle variable naming
  handleBlockCreateEvent(
    block,
    changeEvent,
    variableNamePrefix,
    nextVariableIndexes,
  );

  // Handle lifecycle events like enable/disable/move on the block directly
  if (changeEvent.blockId === block.id) {
    if (handleMeshLifecycleChange(block, changeEvent)) return;
  }

  // Handle field changes on self or attached unchainable children
  if (handleFieldOrChildChange(block, changeEvent)) return;

  // Handle BLOCK_CREATE or BLOCK_CHANGE if a child is attached
  if (
    (changeEvent.type === Blockly.Events.BLOCK_CREATE ||
      changeEvent.type === Blockly.Events.BLOCK_CHANGE ||
      changeEvent.type === Blockly.Events.BLOCK_MOVE) &&
    changeEvent.workspaceId === Blockly.getMainWorkspace().id
  ) {
    if (flock.blockDebug)
      console.log("The changed block is", changeEvent.block);
    if (flock.blockDebug)
      console.log("The changed block is", changeEvent.blockId);
    const changedBlock = Blockly.getMainWorkspace().getBlockById(
      changeEvent.blockId,
    );

    const createdBlocks =
      changeEvent.type === Blockly.Events.BLOCK_CREATE &&
      Array.isArray(changeEvent.ids)
        ? changeEvent.ids
            .map((id) => Blockly.getMainWorkspace().getBlockById(id))
            .filter(Boolean)
        : [changedBlock].filter(Boolean);

    if (!createdBlocks.length) {
      if (flock.blockDebug) console.log("Changed block not found in workspace");
      return;
    }

    const parents = createdBlocks.map((cb) => findCreateBlock(cb));
    if (flock.blockDebug)
      console.log("The type of the changed block is", changedBlock.type);
    if (changedBlock.getParent()) {
      if (flock.blockDebug)
        console.log(
          "The ID of the parent of the changed block is",
          changedBlock.getParent().id,
        );
      if (flock.blockDebug)
        console.log(
          "The type of the parent of the changed block is",
          changedBlock.getParent().type,
        );
    }
    if (flock.blockDebug) console.log("This block is", block.id);
    // if (flock.blockDebug) console.log("The parent is", parent);
    if (flock.blockDebug) console.log("The type of this block is", block.type);
    if (parents.includes(block)) {
      const blockInWorkspace = Blockly.getMainWorkspace().getBlockById(
        block.id,
      );
      if (blockInWorkspace) {
        updateOrCreateMeshFromBlock(block, changeEvent);
      }
    }
  }
}

function applyDisabledBlockStyle(block, isDisabled) {
  const root = block.getSvgRoot?.();

  if (!root) {
    return;
  }

  const paths = root.querySelectorAll(
    ".blocklyPath, .blocklyPathLight, .blocklyPathDark, .blocklyPathHighlight",
  );

  const textNodes = root.querySelectorAll(
    ".blocklyText, .blocklyEditableText > text",
  );

  root.classList.remove("blocklyDisabledPattern");

  if (isDisabled) {
    root.style.opacity = "0.55";

    paths.forEach((path) => {
      path.style.removeProperty("fill");
      path.style.fillOpacity = "1";
      path.style.strokeOpacity = "1";
    });

    textNodes.forEach((node) => {
      node.style.opacity = "1";
      node.style.fillOpacity = "1";
      node.style.strokeOpacity = "1";
    });
  } else {
    root.style.removeProperty("opacity");

    paths.forEach((path) => {
      path.style.removeProperty("fill");
      path.style.removeProperty("fillOpacity");
      path.style.removeProperty("strokeOpacity");
    });

    textNodes.forEach((node) => {
      node.style.removeProperty("opacity");
      node.style.removeProperty("fillOpacity");
      node.style.removeProperty("strokeOpacity");
    });
  }
}

export function syncDisabledBlockStyles(workspace) {
  workspace?.getAllBlocks(false).forEach((block) => {
    if (!block.isEnabled()) {
      applyDisabledBlockStyle(block, true);
    }
  });
}

export function handleDisabledStyleChange(changeEvent) {
  if (
    changeEvent.type !== Blockly.Events.BLOCK_CHANGE ||
    changeEvent.element !== "disabled"
  ) {
    return;
  }

  const block = Blockly.getMainWorkspace()?.getBlockById(changeEvent.blockId);

  if (!block) {
    return;
  }

  const isDisabled =
    changeEvent.newValue === true || changeEvent.newValue === "true";

  applyDisabledBlockStyle(block, isDisabled);
}

// smart-variable-duplication.js (final)
// - Split variable on duplicate (duplicate-parent safe)
// - Retarget descendants oldVar -> newVar
// - Adopt isolated default-looking vars in subtree -> newVar
// - Normalize creator var name to the LOWEST available suffix (fixes “skipped 3”)
// - Recompute nextVariableIndexes[prefix] from workspace state

const _pendingRetarget = new WeakMap(); // block -> { from, to, type, prefix } | undefined

function getBlockly(opts) {
  return (
    (opts && opts.Blockly) || (typeof Blockly !== "undefined" ? Blockly : null)
  );
}

function getVariableFieldsOnBlock(block, BlocklyNS) {
  const out = [];
  for (const input of block.inputList || []) {
    for (const field of input.fieldRow || []) {
      if (field instanceof BlocklyNS.FieldVariable) out.push(field);
    }
  }
  return out;
}

function isVariableUsedElsewhere(
  workspace,
  varId,
  excludingBlockId,
  BlocklyNS,
) {
  if (!varId) return false;
  const blocks = workspace.getAllBlocks(false);
  for (const b of blocks) {
    if (b.id === excludingBlockId) continue;
    const fields = getVariableFieldsOnBlock(b, BlocklyNS);
    for (const f of fields) {
      if (f.getValue && f.getValue() === varId) return true;
    }
  }
  return false;
}

function getFieldVariableType(block, fieldName, BlocklyNS) {
  const field = block.getField(fieldName);
  if (!field) return "";
  const model =
    typeof field.getVariable === "function" ? field.getVariable() : null;
  if (model && typeof model.type === "string") return model.type || "";
  const varId = field.getValue && field.getValue();
  const byId = varId ? block.workspace.getVariableById(varId) : null;
  return (byId && byId.type) || "";
}

function parseNumericSuffix(name, prefix) {
  if (!name || !name.startsWith(prefix)) return null;
  const rest = name.slice(prefix.length);
  if (!/^\d+$/.test(rest)) return null;
  return parseInt(rest, 10);
}

function createFreshVariable(workspace, prefix, type, nextVariableIndexes) {
  // Pick the smallest available suffix >= 1 (not just "next"), to be robust to temp vars.
  let n = 1;
  while (workspace.getVariable(`${prefix}${n}`, type)) n += 1;
  // Also keep your counter roughly in sync (but we’ll normalize later).
  nextVariableIndexes[prefix] = Math.max(
    nextVariableIndexes[prefix] || 1,
    n + 1,
  );
  return workspace.getVariableMap().createVariable(`${prefix}${n}`, type); // VariableModel
}

function retargetDescendantsVariables(
  rootBlock,
  fromVarId,
  toVarId,
  BlocklyNS,
) {
  if (!fromVarId || !toVarId || fromVarId === toVarId) return 0;
  const descendants = rootBlock.getDescendants(false);
  let changes = 0;
  for (const b of descendants) {
    const fields = getVariableFieldsOnBlock(b, BlocklyNS);
    for (const f of fields) {
      if (f.getValue && f.getValue() === fromVarId) {
        f.setValue(toVarId);
        changes++;
      }
    }
  }
  return changes;
}

function subtreeHasVarId(rootBlock, fromVarId, BlocklyNS) {
  const descendants = rootBlock.getDescendants(false);
  for (const b of descendants) {
    const fields = getVariableFieldsOnBlock(b, BlocklyNS);
    for (const f of fields) {
      if (f.getValue && f.getValue() === fromVarId) return true;
    }
  }
  return false;
}

function buildDescendantIdSet(rootBlock) {
  const set = new Set();
  for (const b of rootBlock.getDescendants(false)) set.add(b.id);
  return set;
}

function countVarUses(workspace, varId, BlocklyNS) {
  let count = 0;
  const blocks = workspace.getAllBlocks(false);
  for (const b of blocks) {
    const fields = getVariableFieldsOnBlock(b, BlocklyNS);
    for (const f of fields) {
      if (f.getValue && f.getValue() === varId) count++;
    }
  }
  return count;
}

/**
 * Adopt single-use "default-looking" variables inside the creator's subtree:
 * - type matches
 * - name startsWith prefix
 * - ALL uses are inside this subtree (none outside)
 */
function adoptIsolatedDefaultVarsTo(
  rootBlock,
  toVarId,
  varType,
  prefix,
  workspace,
  BlocklyNS,
) {
  const descendantIds = buildDescendantIdSet(rootBlock);
  let adopted = 0;

  for (const b of rootBlock.getDescendants(false)) {
    const fields = getVariableFieldsOnBlock(b, BlocklyNS);
    for (const f of fields) {
      const vid = f.getValue && f.getValue();
      if (!vid || vid === toVarId) continue;

      const model = workspace.getVariableById(vid);
      if (!model) continue;

      const typeOk = model.type === varType || !model.type || !varType;
      if (!typeOk) continue;
      if (!model.name || !model.name.startsWith(prefix)) continue;

      // ensure all uses are within subtree
      let usedOutside = false;
      const allBlocks = workspace.getAllBlocks(false);
      for (const bb of allBlocks) {
        const fields2 = getVariableFieldsOnBlock(bb, BlocklyNS);
        for (const f2 of fields2) {
          if (f2.getValue && f2.getValue() === vid) {
            if (!descendantIds.has(bb.id)) {
              usedOutside = true;
              break;
            }
          }
        }
        if (usedOutside) break;
      }
      if (usedOutside) continue;

      // adopt
      f.setValue(toVarId);
      adopted++;

      // clean up orphan if now unused
      if (countVarUses(workspace, vid, BlocklyNS) === 0) {
        try {
          workspace.deleteVariableById(vid);
        } catch (_) {
          /* ignore */
        }
      }
    }
  }

  return adopted;
}

/** Find the LOWEST available numeric suffix for prefix+N (type-scoped). */
function lowestAvailableSuffix(workspace, prefix, type) {
  let n = 1;
  while (workspace.getVariable(`${prefix}${n}`, type)) n += 1;
  return n;
}

/** Compute the max numeric suffix currently present for prefix (type-scoped). */
function maxExistingSuffix(workspace, prefix, type) {
  let max = 0;
  const vars = type
    ? workspace.getVariablesOfType(type)
    : workspace.getAllVariables();
  for (const v of vars) {
    const n = parseNumericSuffix(v.name, prefix);
    if (n && n > max) max = n;
  }
  return max;
}

/**
 * After adoption, normalize the creator variable's NAME to the LOWEST free suffix.
 * Then recompute nextVariableIndexes[prefix] = maxSuffix + 1.
 */
function normalizeVarNameAndIndex(
  workspace,
  varId,
  prefix,
  type,
  nextVariableIndexes,
) {
  const model = workspace.getVariableById(varId);
  if (!model) return;

  const currentSuffix = parseNumericSuffix(model.name, prefix);
  const targetSuffix = lowestAvailableSuffix(workspace, prefix, type);

  // If our current name isn't the lowest available, and the lowest is different, rename.
  if (targetSuffix && targetSuffix !== currentSuffix) {
    try {
      workspace
        .getVariableMap()
        .renameVariable(model, `${prefix}${targetSuffix}`);
    } catch (_) {
      /* ignore rename failures */
    }
  }

  const maxSuffix = maxExistingSuffix(workspace, prefix, type);
  nextVariableIndexes[prefix] = maxSuffix + 1;
}

/**
 * Public entry: call from your existing handleBlockCreateEvent (or in setOnChange).
 */
export function ensureFreshVarOnDuplicate(
  block,
  changeEvent,
  variableNamePrefix,
  nextVariableIndexes,
  opts = {},
) {
  const BlocklyNS = getBlockly(opts);
  if (!BlocklyNS) return;

  const fieldName = opts.fieldName || "ID_VAR";

  // Finish any pending work (retarget, adopt, normalize) from earlier in the same dup group.
  const pending = _pendingRetarget.get(block);
  if (pending && pending.from && pending.to) {
    BlocklyNS.Events.setGroup(changeEvent.group || null);
    try {
      BlocklyNS.Events.disable();

      retargetDescendantsVariables(block, pending.from, pending.to, BlocklyNS);
      adoptIsolatedDefaultVarsTo(
        block,
        pending.to,
        pending.type,
        pending.prefix,
        block.workspace,
        BlocklyNS,
      );
      normalizeVarNameAndIndex(
        block.workspace,
        pending.to,
        pending.prefix,
        pending.type,
        nextVariableIndexes,
      );

      if (!subtreeHasVarId(block, pending.from, BlocklyNS)) {
        _pendingRetarget.set(block, undefined);
      }
    } finally {
      BlocklyNS.Events.enable();
      BlocklyNS.Events.setGroup(false);
    }
  }

  // Only act on *this block's* create event.
  if (changeEvent.type !== BlocklyNS.Events.BLOCK_CREATE) return;
  if (changeEvent.blockId !== block.id) return;

  const ws = block.workspace;
  const idField = block.getField(fieldName);
  if (!idField) return;

  const oldVarId = idField.getValue && idField.getValue();
  if (!oldVarId) return;

  // Duplicate/copy/duplicate-parent case?
  if (!isVariableUsedElsewhere(ws, oldVarId, block.id, BlocklyNS)) return;

  const varType = getFieldVariableType(block, fieldName, BlocklyNS);
  const group = changeEvent.group || `auto-split-${block.id}-${Date.now()}`;

  BlocklyNS.Events.setGroup(group);
  try {
    BlocklyNS.Events.disable();

    // Mint a new var with the *lowest* available suffix now.
    const newVarModel = createFreshVariable(
      ws,
      variableNamePrefix,
      varType,
      nextVariableIndexes,
    );
    const newVarId =
      newVarModel.id ||
      (typeof newVarModel.getId === "function" ? newVarModel.getId() : null);
    if (!newVarId) return;

    // Point the creator at the fresh variable.
    idField.setValue(newVarId);

    // Pass 1: retarget descendants old -> new (for those already present)
    retargetDescendantsVariables(block, oldVarId, newVarId, BlocklyNS);

    // Pass 2: adopt any isolated default-looking vars inside subtree to the new var
    adoptIsolatedDefaultVarsTo(
      block,
      newVarId,
      varType,
      variableNamePrefix,
      ws,
      BlocklyNS,
    );

    // Normalize the creator var’s name to the LOWEST free suffix (fixes visible gaps)
    normalizeVarNameAndIndex(
      ws,
      newVarId,
      variableNamePrefix,
      varType,
      nextVariableIndexes,
    );

    // If more children will connect later, remember to finish on subsequent events.
    _pendingRetarget.set(block, {
      from: oldVarId,
      to: newVarId,
      type: varType,
      prefix: variableNamePrefix,
    });
  } finally {
    BlocklyNS.Events.enable();
    BlocklyNS.Events.setGroup(false);
  }
}

/*
export default Blockly.Theme.defineTheme("flock", {
  base: Blockly.Themes.Modern,
  componentStyles: {
    workspaceBackgroundColour: "white",
    toolboxBackgroundColour: "#ffffff66",
    //'toolboxForegroundColour': '#fff',
    //'flyoutBackgroundColour': '#252526',
    //'flyoutForegroundColour': '#ccc',
    //'flyoutOpacity': 1,
    //'scrollbarColour': '#797979',
    insertionMarkerColour: "#defd6c",
    insertionMarkerOpacity: 0.3,
    scrollbarOpacity: 0.4,
    cursorColour: "#defd6c",
    //'blackBackground': '#333',
  },
});
*/

export class CustomConstantProvider extends Blockly.zelos.ConstantProvider {
  constructor() {
    super();

    this.NOTCH_OFFSET_LEFT = 2 * this.GRID_UNIT;
    this.NOTCH_HEIGHT = 2 * this.GRID_UNIT;
    this.FIELD_DROPDOWN_SVG_ARROW_DATAURI =
      "data:image/svg+xml;base64,PHN2ZyBpZD0iTGF5ZXJfMSIgZGF0YS1uYW1lPSJMYXllciAxIiB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSIxMi43MSIgaGVpZ2h0PSI4Ljc5IiB2aWV3Qm94PSIwIDAgMTIuNzEgOC43OSI+PHRpdGxlPmRyb3Bkb3duLWFycm93PC90aXRsZT48ZyBvcGFjaXR5PSIwLjEiPjxwYXRoIGQ9Ik0xMi43MSwyLjQ0QTIuNDEsMi40MSwwLDAsMSwxMiw0LjE2TDguMDgsOC4wOGEyLjQ1LDIuNDUsMCwwLDEtMy40NSwwTDAuNzIsNC4xNkEyLjQyLDIuNDIsMCwwLDEsMCwyLjQ0LDIuNDgsMi40OCwwLDAsMSwuNzEuNzFDMSwwLjQ3LDEuNDMsMCw2LjM2LDBTMTEuNzUsMC40NiwxMiwuNzFBMi40NCwyLjQ0LDAsMCwxLDEyLjcxLDIuNDRaIiBmaWxsPSIjMjMxZjIwIi8+PC9nPjxwYXRoIGQ9Ik02LjM2LDcuNzlhMS40MywxLjQzLDAsMCwxLTEuNDItTDEuNDIsMy40NWExLjQ0LDEuNDQsMCwwLDEsMC0yYzAuNTYtLjU2LDkuMzEtMC41Niw5Ljg3LDBhMS40NCwxLjQ0LDAsMCwxLDAsMkw3LjM3LDcuMzdBMS40MywxLjQzLDAsMCwxLDYuMzYsNy43OVoiIGZpbGw9IiMwMDAiLz48L3N2Zz4=";
  }

  /**
   * Override renderer CSS so disabled blocks keep their colour but become
   * subtly transparent instead of being completely greyed out.
   *
   * @param {string} selector CSS selector provided by Blockly.
   * @returns {string[]} Renderer CSS rules.
   */
  getCSS_(selector) {
    const css = super.getCSS_(selector);

    css.push(
      `${selector}.blocklyDisabled {`,
      "  opacity: 0.55;",
      "}",
      `${selector}.blocklyDisabled > .blocklyPath,`,
      `${selector}.blocklyDisabled > .blocklyPathLight,`,
      `${selector}.blocklyDisabled > .blocklyPathDark,`,
      `${selector}.blocklyDisabled > .blocklyPathHighlight,`,
      `${selector}.blocklyDisabled .blocklyText,`,
      `${selector}.blocklyDisabled .blocklyEditableText > text {`,
      "  fill-opacity: 1;",
      "  stroke-opacity: 1;",
      "}",
    );

    return css;
  }
}

class CustomRenderInfo extends Blockly.zelos.RenderInfo {
  constructor(renderer, block) {
    super(renderer, block);
  }

  adjustXPosition_() {}
}

export class CustomZelosRenderer extends Blockly.zelos.Renderer {
  constructor(name) {
    super(name);
  }

  // Override the method to return our custom constant provider
  makeConstants_() {
    return new CustomConstantProvider();
  }

  // Override the method to return our custom RenderInfo
  makeRenderInfo_(block) {
    return new CustomRenderInfo(this, block);
  }
}

const mediaPath = window.location.pathname.includes("/flock")
  ? "/flock/blockly/media/" // For GitHub Pages
  : "/blockly/media/"; // For local dev

export const options = {
  //theme: FlockTheme,
  theme: createThemeConfig("light"),
  //theme: "flockTheme",
  //renderer: "zelos",
  renderer: "custom_zelos_renderer",
  media: mediaPath,
  modalInputs: false,
  zoom: {
    controls: true,
    wheel: false,
    startScale: 0.7,
    maxScale: 3,
    minScale: 0.3,
    scaleSpeed: 1.2,
  },
  move: {
    scrollbars: {
      horizontal: true,
      vertical: true,
    },
    drag: true,
    //dragSurface: false,
    wheel: true,
  },
  toolbox: toolbox,
  oneBasedIndex: false,
  searchAllBlocks: false,
  plugins: {
    connectionPreviewer: BlockDynamicConnection.decoratePreviewer(),
  },
  // Double click the blocks to collapse/expand
  // them (A feature from MIT App Inventor).
  useDoubleClick: false,
  // Bump neighbours after dragging to avoid overlapping.
  bumpNeighbours: false,

  // Keep the fields of multiple selected same-type blocks with the same value
  // See note below.
  multiFieldUpdate: true,

  // Auto focus the workspace when the mouse enters.
  workspaceAutoFocus: true,

  // Use custom icon for the multi select controls.
  multiselectIcon: {
    hideIcon: true,
    weight: 3,
    enabledIcon:
      "https://github.com/mit-cml/workspace-multiselect/raw/main/test/media/select.svg",
    disabledIcon:
      "https://github.com/mit-cml/workspace-multiselect/raw/main/test/media/unselect.svg",
  },

  multiSelectKeys: ["Shift"],

  multiselectCopyPaste: {
    crossTab: true,
    menu: true,
  },
  comments: true,
};

export function initializeVariableIndexes() {
  nextVariableIndexes = {
    model: 1,
    box: 1,
    sphere: 1,
    cylinder: 1,
    capsule: 1,
    plane: 1,
    wall: 1,
    text: 1,
    "3dtext": 1,
    sound: 1,
    character: 1,
    object: 1,
    instrument: 1,
    animation: 1,
    clone: 1,
  };

  const allVariables = Blockly.getMainWorkspace()
    .getVariableMap()
    .getAllVariables(); // Retrieve all variables in the workspace

  // Process each type of variable
  Object.keys(nextVariableIndexes).forEach(function (type) {
    let maxIndex = 0; // To keep track of the highest index used so far
    // Regular expression to match variable names like 'type1', 'type2', etc.
    const varPattern = new RegExp(`^${type}(\\d+)$`);

    allVariables.forEach(function (variable) {
      const match = variable.name.match(varPattern);
      if (match) {
        const currentIndex = parseInt(match[1], 10);
        if (currentIndex > maxIndex) {
          maxIndex = currentIndex;
        }
      }
    });

    nextVariableIndexes[type] = maxIndex + 1;
  });

  // Optionally return the indexes if needed elsewhere
  return nextVariableIndexes;
}

export function defineBlocks() {
  //BlockDynamicConnection.overrideOldBlockDefinitions();
  //Blockly.Blocks['dynamic_list_create'].minInputs = 1;

  //     Blockly.Blocks['lists_create_with'] = Blockly.Blocks['dynamic_list_create'];

  //     Blockly.Blocks['text_join'] = Blockly.Blocks['dynamic_text_join'];

  function updateCurrentMeshName(block, variableFieldName) {
    const variableName = block.getField(variableFieldName).getText(); // Get the selected variable name

    if (variableName) {
      window.currentMesh = variableName;
      window.currentBlock = block;
    }
  }

  window.updateCurrentMeshName = updateCurrentMeshName;

  Blockly.Blocks["create_wall"] = {
    init: function () {
      const variableNamePrefix = "wall";
      let nextVariableName =
        variableNamePrefix + nextVariableIndexes[variableNamePrefix]; // Start with "wall1";
      this.jsonInit({
        type: "create_wall",
        message0:
          "new wall %1 type %2 colour %3 \n start x %4 z %5 end x %6 z %7 y position %8",
        args0: [
          {
            type: "field_variable",
            name: "ID_VAR",
            variable: nextVariableName,
          },
          {
            type: "field_dropdown",
            name: "WALL_TYPE",
            options: [
              ["solid", "SOLID_WALL"],
              ["door", "WALL_WITH_DOOR"],
              ["window", "WALL_WITH_WINDOW"],
              ["floor/roof", "FLOOR"],
            ],
          },
          {
            type: "input_value",
            name: "COLOR",
            check: "Colour",
          },
          {
            type: "input_value",
            name: "START_X",
            check: "Number",
          },
          {
            type: "input_value",
            name: "START_Z",
            check: "Number",
          },
          {
            type: "input_value",
            name: "END_X",
            check: "Number",
          },
          {
            type: "input_value",
            name: "END_Z",
            check: "Number",
          },
          {
            type: "input_value",
            name: "Y_POSITION",
            check: "Number",
          },
        ],
        inputsInline: true,
        previousStatement: null,
        nextStatement: null,
        colour: categoryColours["Scene"],
        tooltip:
          "Create a wall with the selected type and color between specified start and end positions.\nKeyword: wall",
      });
      this.setHelpUrl(getHelpUrlFor(this.type));
      this.setOnChange((changeEvent) => {
        if (
          changeEvent.type === Blockly.Events.BLOCK_CREATE ||
          changeEvent.type === Blockly.Events.BLOCK_CHANGE
        ) {
          const blockInWorkspace = Blockly.getMainWorkspace().getBlockById(
            this.id,
          ); // Check if block is in the main workspace

          if (blockInWorkspace) {
            window.updateCurrentMeshName(this, "ID_VAR"); // Call the function to update window.currentMesh
          }
        }

        handleBlockCreateEvent(
          this,
          changeEvent,
          variableNamePrefix,
          nextVariableIndexes,
        );
      });
    },
  };

  Blockly.Extensions.register("dynamic_mesh_dropdown", function () {
    const dropdown = new Blockly.FieldDropdown(function () {
      const options = [["everywhere", "__everywhere__"]];
      const workspace = this.sourceBlock_ && this.sourceBlock_.workspace;
      if (workspace) {
        const variables = workspace.getVariableMap().getAllVariables();
        variables.forEach((v) => {
          options.push([v.name, v.name]);
        });
      }
      return options;
    });

    // Attach the dropdown to the block
    this.getInput("MESH_INPUT").appendField(dropdown, "MESH_NAME");
  });

  Blockly.Blocks["rotate_camera"] = {
    init: function () {
      this.jsonInit({
        type: "rotate_camera",
        message0: "rotate camera by %1 degrees",
        args0: [
          {
            type: "input_value",
            name: "DEGREES",
            check: "Number",
          },
        ],
        inputsInline: true,
        previousStatement: null,
        nextStatement: null,
        colour: categoryColours["Transform"],
        tooltip:
          "Rotate the camera left or right by the given degrees.\nKeyword: rotate",
      });
      this.setHelpUrl(getHelpUrlFor(this.type));
    },
  };

  Blockly.Blocks["up"] = {
    init: function () {
      this.jsonInit({
        type: "up",
        message0: "up %1 force %2",
        args0: [
          {
            type: "field_variable",
            name: "MODEL_VAR",
            variable: window.currentMesh,
          },
          {
            type: "input_value",
            name: "UP_FORCE",
            check: "Number",
          },
        ],
        previousStatement: null,
        nextStatement: null,
        colour: categoryColours["Transform"],
        tooltip: "Apply the specified upwards force.\nKeyword: up",
      });
      this.setHelpUrl(getHelpUrlFor(this.type));
    },
  };

  Blockly.Blocks["random_seeded_int"] = {
    init: function () {
      this.jsonInit({
        type: "random_seeded_int",
        message0: "random integer from %1 to %2 seed: %3",
        args0: [
          {
            type: "input_value",
            name: "FROM",
            check: "Number",
            align: "RIGHT",
          },
          {
            type: "input_value",
            name: "TO",
            check: "Number",
            align: "RIGHT",
          },
          {
            type: "input_value",
            name: "SEED",
            check: "Number",
            align: "RIGHT",
          },
        ],
        inputsInline: true,
        output: "Number",
        colour: 230,
        tooltip: "Generate a random integer with a seed.\n Keyword: seed",
      });
      this.setHelpUrl(getHelpUrlFor(this.type));
    },
  };

  Blockly.Blocks["to_number"] = {
    init: function () {
      this.jsonInit({
        type: "to_number",
        message0: "convert %1 to %2",
        args0: [
          {
            type: "input_value",
            name: "STRING",
            check: "String",
          },
          {
            type: "field_dropdown",
            name: "TYPE",
            options: [
              ["integer", "INT"],
              ["float", "FLOAT"],
            ],
          },
        ],
        inputsInline: true,
        output: "Number",
        colour: 230,
        tooltip: "Convert a string to an integer or float.",
      });
      this.setHelpUrl(getHelpUrlFor(this.type));
    },
  };

  Blockly.Blocks["keyword_block"] = {
    init: function () {
      this.appendDummyInput().appendField(
        new Blockly.FieldTextInput("type a keyword to add a block"),
        "KEYWORD",
      );
      this.setTooltip("Type a keyword to change this block.");
      this.setHelpUrl(getHelpUrlFor(this.type));

      this.setOnChange(function (changeEvent) {
        // Prevent infinite loops or multiple replacements.
        if (this.isDisposed() || this.isReplaced) {
          return;
        }
        // Get the entered keyword.
        const keyword = this.getFieldValue("KEYWORD").trim();
        // Lookup the new block type based on the keyword.
        const blockType = findBlockTypeByKeyword(keyword);
        if (blockType) {
          // Mark the block as replaced.
          this.isReplaced = true;
          const workspace = this.workspace;
          // Create the new block.
          const newBlock = workspace.newBlock(blockType);

          // Apply toolbox settings if defined.
          const blockDefinition = findBlockDefinitionInToolbox(blockType);
          if (blockDefinition && blockDefinition.inputs) {
            applyToolboxSettings(newBlock, blockDefinition.inputs);
          }

          newBlock.initSvg();
          newBlock.render();

          // Position the new block where the old keyword block is.
          const pos = this.getRelativeToSurfaceXY();
          newBlock.moveBy(pos.x, pos.y);

          if (
            this.previousConnection &&
            this.previousConnection.isConnected()
          ) {
            const parentConnection = this.previousConnection.targetConnection;
            if (parentConnection) {
              parentConnection.disconnect();
              parentConnection.connect(newBlock.previousConnection);
            }
          }

          // Reattach any block that was connected to the keyword block's next connection.
          const nextBlock = this.getNextBlock();
          if (nextBlock && newBlock.nextConnection) {
            newBlock.nextConnection.connect(nextBlock.previousConnection);
          }

          // Select the new block for immediate editing.
          const selectedBlock = Blockly.getSelected();
          if (selectedBlock) {
            selectedBlock.unselect();
          }
          newBlock.select();
          window.currentBlock = newBlock;

          // Dispose of the old keyword block.
          this.dispose();
        }
      });
    },
  };

  Blockly.Blocks["keyword"] = {
    init: function () {
      // Call the original keyword_block init method.
      Blockly.Blocks["keyword_block"].init.call(this);
      // Add chaining connections.
      this.setPreviousStatement(true);
      this.setNextStatement(true);
    },
  };

  function findBlockTypeByKeyword(keyword) {
    // Recursive helper to search through a contents array.
    function searchContents(contents) {
      if (!Array.isArray(contents)) {
        return null;
      }
      for (const item of contents) {
        // If this item is a block with the matching keyword, return its type.
        if (item.kind === "block" && item.keyword === keyword) {
          return item.type;
        }
        // If the item is a category with its own contents, search recursively.
        if (item.kind === "category" && Array.isArray(item.contents)) {
          const result = searchContents(item.contents);
          if (result !== null) {
            return result;
          }
        }
      }
      return null;
    }
    return searchContents(toolbox.contents);
  }

  // Function to find block definition in the toolbox by block type
  function findBlockDefinitionInToolbox(blockType) {
    // Recursive helper to search through a contents array.
    function searchContents(contents) {
      if (!Array.isArray(contents)) {
        return null;
      }
      for (const item of contents) {
        // If this item is a block with the matching type, return its definition.
        if (item.kind === "block" && item.type === blockType) {
          return item;
        }
        // If the item is a category with its own contents, search recursively.
        if (item.kind === "category" && Array.isArray(item.contents)) {
          const result = searchContents(item.contents);
          if (result !== null) {
            return result;
          }
        }
      }
      return null;
    }
    return searchContents(toolbox.contents);
  }

  // Function to apply settings from the toolbox definition to the new block
  function applyToolboxSettings(newBlock, inputs) {
    for (const inputName in inputs) {
      const input = inputs[inputName];
      if (input.shadow) {
        const shadowBlock = Blockly.getMainWorkspace().newBlock(
          input.shadow.type,
        );
        shadowBlock.setShadow(true);
        // Apply fields (default values) to the shadow block
        for (const fieldName in input.shadow.fields) {
          shadowBlock.setFieldValue(input.shadow.fields[fieldName], fieldName);
        }
        shadowBlock.initSvg();
        shadowBlock.render();
        newBlock
          .getInput(inputName)
          .connection.connect(shadowBlock.outputConnection);

        Blockly.getMainWorkspace().cleanUp();
      }
    }
  }
}

export function addDoMutatorWithToggleBehavior(block) {
  // Custom function to toggle the "do" block mutation
  block.toggleDoBlock = function () {
    const hasDo = this.getInput("DO") ? true : false;
    if (hasDo) {
      this.removeInput("DO");
    } else {
      this.appendStatementInput("DO").setCheck(null).appendField("");
    }
  };

  // Add the toggle button to the block
  const toggleButton = new Blockly.FieldImage(
    "data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMzAiIGhlaWdodD0iMzAiIHZpZXdCb3g9IjAgMCAzMCAzMCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj4gPHBhdGggZmlsbD0id2hpdGUiIGQ9Ik0xNSA2djloLTl2M2g5djloM3YtOWg5di0zaC05di05eiIvPjwvc3ZnPg==", // Custom icon
    30,
    30,
    "*", // Width, Height, Alt text
    block.toggleDoBlock.bind(block), // Bind the event handler to the block
  );

  // Add the button to the block
  block
    .appendDummyInput()
    .setAlign(Blockly.inputs.Align.RIGHT)
    .appendField(toggleButton, "TOGGLE_BUTTON");

  // Save the mutation state
  block.mutationToDom = function () {
    const container = document.createElement("mutation");
    container.setAttribute("has_do", this.getInput("DO") ? "true" : "false");
    return container;
  };

  // Restore the mutation state
  block.domToMutation = function (xmlElement) {
    const hasDo = xmlElement.getAttribute("has_do") === "true";
    if (hasDo) {
      this.appendStatementInput("DO").setCheck(null).appendField("");
    }
  };
}

export function handleBlockCreateEvent(
  blockInstance,
  changeEvent,
  variableNamePrefix,
  nextVariableIndexes,
  fieldName = "ID_VAR", // Default field name to handle
) {
  if (window.loadingCode) return; // Don't rename variables during code loading

  ensureFreshVarOnDuplicate(
    blockInstance,
    changeEvent,
    variableNamePrefix,
    nextVariableIndexes,
    {
      fieldName: "ID_VAR",
    },
  );
  if (blockInstance.id !== changeEvent.blockId) return;
  // Check if this is an undo/redo operation
  const isUndo = !changeEvent.recordUndo;

  if (
    !blockInstance.isInFlyout &&
    changeEvent.type === Blockly.Events.BLOCK_CREATE &&
    changeEvent.ids.includes(blockInstance.id)
  ) {
    if (isUndo) return;

    // Check if the specified field already has a value
    const variableField = blockInstance.getField(fieldName);
    if (variableField) {
      const variableId = variableField.getValue();
      const variable = blockInstance.workspace
        .getVariableMap()
        .getVariableById(variableId);

      // Check if the variable name matches the pattern "prefixn"
      const variableNamePattern = new RegExp(`^${variableNamePrefix}\\d+$`);
      const variableName = variable ? variable.name : "";

      if (!variableNamePattern.test(variableName)) {
        // Handle custom variables
        if (variableName) {
          const numberMatch = variableName.match(/^(.+?)(\d+)$/);
          let newVariableName;
          if (numberMatch) {
            newVariableName = numberMatch[1] + (parseInt(numberMatch[2]) + 1);
          } else {
            newVariableName = variableName + "1";
          }

          let newVariable = blockInstance.workspace
            .getVariableMap()
            .getVariable(newVariableName);
          if (!newVariable) {
            newVariable = blockInstance.workspace
              .getVariableMap()
              .createVariable(newVariableName, null);
          }
          variableField.setValue(newVariable.getId());
        }
      } else {
        // Handle prefix-numbered variables (existing logic)
        if (!nextVariableIndexes[variableNamePrefix]) {
          nextVariableIndexes[variableNamePrefix] = 1;
        }
        let newVariableName =
          variableNamePrefix + nextVariableIndexes[variableNamePrefix];
        let newVariable = blockInstance.workspace
          .getVariableMap()
          .getVariable(newVariableName);
        if (!newVariable) {
          newVariable = blockInstance.workspace
            .getVariableMap()
            .createVariable(newVariableName, null);
        }
        variableField.setValue(newVariable.getId());
        nextVariableIndexes[variableNamePrefix] += 1;
      }
    }
  }
}

// Extend the built-in Blockly procedures_defreturn block to add custom toggle functionality

// Reference to the original init function of the procedures_defreturn block
Blockly.Blocks["procedures_defreturn"].init = (function (originalInit) {
  return function () {
    // Call the original initialization function to ensure the block retains its default behaviour
    originalInit.call(this);

    // Use the existing addToggleButton helper to add the button to the block
    addToggleButton(this);
  };
})(Blockly.Blocks["procedures_defreturn"].init);

// Create an extension that adds extra UI logic without modifying the core mutator methods
Blockly.Extensions.register("custom_procedure_ui_extension", function () {
  this.toggleDoBlock = function () {
    const isInline = !this.isInline;

    // Disconnect block from parent if switching to top-level mode
    if (!isInline) {
      this.unplug(true);
    }

    // Update block shape (delegated to your helper)
    updateShape(this, isInline);

    // Optionally re-enable if previously disabled (for orphaned block UX)
    if (this.hasDisabledReason && this.hasDisabledReason("ORPHANED_BLOCK")) {
      this.setDisabledReason(false, "ORPHANED_BLOCK");
    }

    // Fire Blockly events so undo/redo and UI updates are tracked
    Blockly.Events.fire(
      new Blockly.Events.BlockChange(this, "mutation", null, "", ""),
    );
    Blockly.Events.fire(new Blockly.Events.BlockMove(this));
  };
});

// Apply the extension to the built-in 'procedures_defreturn' block
Blockly.Extensions.apply(
  "custom_procedure_ui_extension",
  Blockly.Blocks["procedures_defreturn"],
);

// Extend the built-in Blockly procedures_defnoreturn block to add custom toggle functionality

// Reference to the original init function of the procedures_defnoreturn block
Blockly.Blocks["procedures_defnoreturn"].init = (function (originalInit) {
  return function () {
    // Call the original initialization function to ensure the block retains its default behaviour
    originalInit.call(this);

    // Use the existing addToggleButton helper to add the button to the block
    addToggleButton(this);
  };
})(Blockly.Blocks["procedures_defnoreturn"].init);

// Apply the extension to the built-in 'procedures_defnoreturn' block
Blockly.Extensions.apply(
  "custom_procedure_ui_extension",
  Blockly.Blocks["procedures_defnoreturn"],
);

// Define unique IDs for each option
Blockly.FieldVariable.ADD_VARIABLE_ID = "ADD_VARIABLE_ID";
Blockly.FieldVariable.RENAME_VARIABLE_ID = "RENAME_VARIABLE_ID";
Blockly.FieldVariable.DELETE_VARIABLE_ID = "DELETE_VARIABLE_ID";

// Extend `getOptions` to include "New variable..." at the top of the dropdown
const originalGetOptions = Blockly.FieldVariable.prototype.getOptions;
Blockly.FieldVariable.prototype.getOptions = function () {
  // Retrieve the default options
  const options = originalGetOptions.call(this);

  // Add the "New variable..." option at the beginning
  options.unshift([
    translate("new_variable_decision"),
    Blockly.FieldVariable.ADD_VARIABLE_ID,
  ]);

  return options;
};

// Save a reference to the original `onItemSelected_` method
const originalOnItemSelected = Blockly.FieldVariable.prototype.onItemSelected_;
Blockly.FieldVariable.prototype.onItemSelected_ = function (menu, menuItem) {
  const id = menuItem.getValue();

  if (id === Blockly.FieldVariable.ADD_VARIABLE_ID) {
    // Open the variable creation dialog, receiving the new variable name
    Blockly.Variables.createVariableButtonHandler(
      this.sourceBlock_.workspace,
      (newVariableName) => {
        if (newVariableName) {
          // Find the variable by its name to get the full variable object
          const newVariable = this.sourceBlock_.workspace
            .getVariableMap()
            .getVariable(newVariableName);

          if (newVariable) {
            // Set the new variable as selected
            this.doValueUpdate_(newVariable.getId());
            this.forceRerender(); // Refresh the UI to show the new selection
          } else {
            console.log("New variable not found in workspace.");
          }
        } else {
          console.log("Variable creation was cancelled.");
        }
      },
    );
  } else {
    // Use the stored reference to avoid recursion
    originalOnItemSelected.call(this, menu, menuItem);
  }
};

(function () {
  const dynamicIf = Blockly.Blocks["dynamic_if"];
  if (!dynamicIf) return;

  const originalFinalize = dynamicIf.finalizeConnections;
  const originalMutationToDom = dynamicIf.mutationToDom;

  dynamicIf.mutationToDom = function () {
    if (this._skipFinalizeInMutationToDom) {
      if (!this.elseifCount && !this.elseCount) return null;
      const container = Blockly.utils.xml.createElement("mutation");
      if (this.elseifCount) {
        container.setAttribute("elseif", `${this.elseifCount}`);
      }
      if (this.elseCount) {
        container.setAttribute("else", "1");
      }
      return container;
    }
    return originalMutationToDom.call(this);
  };

  dynamicIf.finalizeConnections = function () {
    // Capture the old state without causing recursion.
    this._skipFinalizeInMutationToDom = true;
    const oldStateDOM = this.mutationToDom();
    const oldState = oldStateDOM ? Blockly.Xml.domToText(oldStateDOM) : null;
    this._skipFinalizeInMutationToDom = false;

    // Disable events during the rebuild so extra events aren’t recorded.
    Blockly.Events.disable();
    try {
      originalFinalize.call(this);
    } finally {
      Blockly.Events.enable();
    }

    // Capture the new state.
    this._skipFinalizeInMutationToDom = true;
    const newStateDOM = this.mutationToDom();
    const newState = newStateDOM ? Blockly.Xml.domToText(newStateDOM) : null;
    this._skipFinalizeInMutationToDom = false;

    // Fire one synthetic mutation event to represent the entire rebuild.
    let mutationEvent;
    if (typeof Blockly.Events.Mutation === "function") {
      mutationEvent = new Blockly.Events.Mutation(this, oldState, newState);
    } else {
      mutationEvent = new Blockly.Events.BlockChange(
        this,
        "mutation",
        "",
        oldState,
        newState,
      );
    }
    Blockly.Events.fire(mutationEvent);
  };
})();

// Message overrides are now handled by the translation system in main/translation.js
