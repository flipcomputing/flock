import * as Blockly from 'blockly';
import { WorkspaceSearch } from '@blockly/plugin-workspace-search';
import * as BlockDynamicConnection from '@blockly/block-dynamic-connection';
import { initializeTheme } from './themes.js';
import { translate } from './translation.js';
import {
  options,
  defineBlocks,
  handleBlockSelect,
  handleBlockDelete,
  CustomZelosRenderer,
  initializeVariableIndexes,
  nextVariableIndexes,
  applyInputAriaLabels,
} from '../blocks/blocks';
import { defineBaseBlocks } from '../blocks/base';
import { defineShapeBlocks } from '../blocks/shapes';
import { defineSceneBlocks } from '../blocks/scene.js';
import { defineModelBlocks } from '../blocks/models.js';
import { defineEffectsBlocks } from '../blocks/effects.js';
import { defineCameraBlocks } from '../blocks/camera.js';
import { defineXRBlocks } from '../blocks/xr.js';
import { defineEventsBlocks } from '../blocks/events.js';
import { definePhysicsBlocks } from '../blocks/physics.js';
import { defineConnectBlocks } from '../blocks/connect.js';
import { defineCombineBlocks } from '../blocks/combine.js';
import { defineTransformBlocks } from '../blocks/transform.js';
import { defineControlBlocks } from '../blocks/control.js';
import { defineConditionBlocks } from '../blocks/condition.js';
import { defineAnimateBlocks } from '../blocks/animate.js';
import { defineSoundBlocks } from '../blocks/sound.js';
import { defineMaterialsBlocks } from '../blocks/materials.js';
import { defineColourBlocks } from '../blocks/colour.js';
import { defineSensingBlocks } from '../blocks/sensing.js';
import { defineTextBlocks } from '../blocks/text.js';
import { defineGenerators } from '../generators/generators.js';
import { registerCustomCommentIcon } from './customCommentIcon.js';
import { getMeshFromBlock } from '../ui/blockmesh.js';
import { toolbox as toolboxDef } from '../toolbox.js';

// Blockly v13 moved variable methods off the workspace onto VariableMap/Variables.
// @blockly/block-plus-minus still calls them as workspace methods, so shim them back.
{
  const proto = Blockly.Workspace.prototype;
  if (!proto.getVariableUsesById)
    proto.getVariableUsesById = function (id) {
      return Blockly.Variables.getVariableUsesById(this, id);
    };
  if (!proto.getVariable)
    proto.getVariable = function (name, opt_type) {
      return this.getVariableMap().getVariable(name, opt_type);
    };
  if (!proto.getVariableById)
    proto.getVariableById = function (id) {
      return this.getVariableMap().getVariableById(id);
    };
  if (!proto.createVariable)
    proto.createVariable = function (name, opt_type, opt_id) {
      return this.getVariableMap().createVariable(name, opt_type, opt_id);
    };
  if (!proto.renameVariableById)
    proto.renameVariableById = function (id, newName) {
      const model = this.getVariableMap().getVariableById(id);
      if (model) this.getVariableMap().renameVariable(model, newName);
    };
  if (!proto.deleteVariableById)
    proto.deleteVariableById = function (id) {
      const model = this.getVariableMap().getVariableById(id);
      if (model) this.getVariableMap().deleteVariable(model);
    };
}

// After jsonInit builds a block's inputs, give its value/statement inputs ARIA
// labels so screen readers announce each input's context on focus. A block can
// supply an `ariaLabels` map (keyed by input name) in its definition to
// override or suppress individual labels; the key is ignored by jsonInit.
{
  const originalJsonInit = Blockly.Block.prototype.jsonInit;
  Blockly.Block.prototype.jsonInit = function (json) {
    originalJsonInit.call(this, json);
    applyInputAriaLabels(this, json && json.ariaLabels);
  };
}

// A "simple reporter" (e.g. a number plugged into scale's X slot) announces
// only its field's value, with no per-input context. We prepend the parent
// input's ARIA label ("x") to the field's announced element so navigating onto
// it reads "x, number: 0". This is done in recomputeAriaContext (which sets the
// element's aria-label), NOT computeAriaLabel: the parent block composes its own
// readout from each child's computeAriaLabel, so prefixing there would make the
// block say the slot label twice (once as its field-row label, once via the
// child). The element-only prefix keeps the block readout clean.
{
  // The slot label and whether to set one at all (sibling-disambiguation,
  // overrides) are decided in applyInputAriaLabels; here we just surface
  // whatever provider the parent input carries.
  const parentSlotLabel = (field) => {
    const block = field.getSourceBlock?.();
    if (!block || !block.isSimpleReporter?.() || block.getFullBlockField?.() !== field) {
      return null;
    }
    const conn =
      block.outputConnection?.targetConnection ?? block.previousConnection?.targetConnection;
    return conn?.getParentInput?.()?.getAriaLabelText?.() ?? null;
  };
  // Several field types define their own recomputeAriaContext, each calling
  // super: Field, FieldInput (base of FieldTextInput/FieldNumber; not exported,
  // so reached via the prototype chain), FieldDropdown (→ FieldVariable) and
  // FieldCheckbox. Wrap every prototype that owns the method; a per-instance
  // re-entrancy guard ensures the slot is prepended once, to the final label.
  const textInputProto = Blockly.FieldTextInput?.prototype;
  const candidateProtos = [
    Blockly.Field?.prototype,
    textInputProto && Object.getPrototypeOf(textInputProto), // FieldInput
    textInputProto,
    Blockly.FieldDropdown?.prototype,
    Blockly.FieldCheckbox?.prototype,
  ];
  const ariaProtos = [
    ...new Set(candidateProtos.filter((p) => p && Object.hasOwn(p, 'recomputeAriaContext'))),
  ];
  for (const proto of ariaProtos) {
    const original = proto.recomputeAriaContext;
    proto.recomputeAriaContext = function () {
      if (this._ariaSlotInProgress) return original.call(this);
      this._ariaSlotInProgress = true;
      try {
        const inTree = original.call(this);
        const slot = parentSlotLabel(this);
        if (inTree && slot) {
          const el = this.getFocusableElement?.();
          const current = el?.getAttribute?.('aria-label');
          if (el && current) {
            el.setAttribute('aria-label', `${slot}, ${current}`);
          }
        }
        return inTree;
      } finally {
        this._ariaSlotInProgress = false;
      }
    };
  }
}

let workspace = null;
export { workspace };

function installWorkspaceJumpDebug(workspace) {
  if (!workspace || workspace.__jumpDebugInstalled) return;
  workspace.__jumpDebugInstalled = true;

  let lastFieldEdit = null;
  workspace.addChangeListener((event) => {
    if (event?.type === Blockly.Events.BLOCK_CHANGE && event?.element === 'field') {
      lastFieldEdit = {
        timestamp: performance.now(),
      };
    }
  });

  const workspaceScroll = workspace.scroll?.bind(workspace);
  if (workspaceScroll) {
    workspace.scroll = function (...args) {
      const beforeX = this.scrollX;
      const requestedX = args[0];
      const stack =
        new Error().stack
          ?.split('\n')
          .slice(1, 7)
          .map((line) => line.trim()) || [];
      const msSinceFieldEdit = lastFieldEdit
        ? Math.round(performance.now() - lastFieldEdit.timestamp)
        : null;
      const fromFocusScroll = stack.some(
        (line) => line.includes('scrollBoundsIntoView') || line.includes('onNodeFocus')
      );
      const largeHorizontalJump =
        typeof requestedX === 'number' && Math.abs(requestedX - beforeX) > 100;

      if (
        fromFocusScroll &&
        typeof msSinceFieldEdit === 'number' &&
        msSinceFieldEdit < 1500 &&
        largeHorizontalJump
      ) {
        return;
      }

      return workspaceScroll(...args);
    };
  }
}

export function initializeBlocks() {
  defineBaseBlocks();
  defineBlocks();
  defineSceneBlocks();
  defineModelBlocks();
  defineShapeBlocks();
  defineEffectsBlocks();
  defineCameraBlocks();
  defineXRBlocks();
  defineEventsBlocks();
  definePhysicsBlocks();
  defineConnectBlocks();
  defineCombineBlocks();
  defineTransformBlocks();
  defineControlBlocks();
  defineConditionBlocks();
  defineAnimateBlocks();
  defineSoundBlocks();
  defineMaterialsBlocks();
  defineColourBlocks();
  defineSensingBlocks();
  defineTextBlocks();
  defineGenerators();
}

Blockly.utils.colour.setHsvSaturation(0.3); // 0 (inclusive) to 1 (exclusive), defaulting to 0.45
Blockly.utils.colour.setHsvValue(0.85); // 0 (inclusive) to 1 (exclusive), defaulting to 0.65

const MODE = { IF: 'IF', ELSEIF: 'ELSEIF', ELSE: 'ELSE' };

function initializeIfClauseConnectionChecker(workspace) {
  const connectionChecker = workspace.connectionChecker;

  // Store the original doTypeChecks method
  const originalDoTypeChecks = connectionChecker.doTypeChecks.bind(connectionChecker);

  function isRealBlock(block) {
    return !!block && !(typeof block.isInsertionMarker === 'function' && block.isInsertionMarker());
  }

  function realTargetBlock(connection) {
    const t = connection?.targetBlock?.();
    return isRealBlock(t) ? t : null;
  }

  function realNext(block) {
    return realTargetBlock(block?.nextConnection);
  }

  function realPrev(block) {
    return realTargetBlock(block?.previousConnection);
  }

  // Helper function to get all blocks in a stack (excluding insertion markers)
  function getAllBlocksInStack(block) {
    const blocks = [block];
    let current = block;

    while (current?.nextConnection) {
      const next = realNext(current);
      if (!next) break;
      blocks.push(next);
      current = next;
    }

    return blocks;
  }

  // Helper function to check if a block or its descendants contain if_clause blocks
  function hasIfClauseInStack(block) {
    const stack = getAllBlocksInStack(block);
    // Check if any block after the first one is an if_clause
    for (let i = 1; i < stack.length; i++) {
      if (stack[i].type === 'if_clause') {
        return true;
      }
    }
    return false;
  }

  // Helper function to check if a connection is a statement input (like DO)
  function isStatementInputConnection(connection) {
    const block = connection.getSourceBlock();
    for (let i = 0; i < block.inputList.length; i++) {
      const input = block.inputList[i];
      if (
        input.type === Blockly.inputs.inputTypes.VALUE ||
        input.type === Blockly.inputs.inputTypes.DUMMY
      ) {
        continue;
      }
      if (input.connection === connection) {
        return true;
      }
    }
    return false;
  }

  // Override the doTypeChecks method
  connectionChecker.doTypeChecks = function (a, b) {
    // First do the standard type checking
    if (!originalDoTypeChecks(a, b)) {
      return false;
    }

    // Get the blocks involved
    const blockA = a.getSourceBlock();
    const blockB = b.getSourceBlock();

    // Check if either block is an if_clause
    const aIsIfClause = blockA.type === 'if_clause';
    const bIsIfClause = blockB.type === 'if_clause';

    if (!aIsIfClause && !bIsIfClause) {
      return true; // Neither is if_clause, allow
    }

    // Determine the type of connection
    let movingBlock, targetBlock, targetConnection;

    if (a.type === Blockly.PREVIOUS_STATEMENT && b.type === Blockly.NEXT_STATEMENT) {
      movingBlock = blockA;
      targetBlock = blockB;
      targetConnection = b;
    } else if (a.type === Blockly.NEXT_STATEMENT && b.type === Blockly.PREVIOUS_STATEMENT) {
      movingBlock = blockB;
      targetBlock = blockA;
      targetConnection = a;
    } else {
      return true; // Not a statement connection
    }

    // Check if target connection is a statement input (like DO)
    const isTargetStatementInput = isStatementInputConnection(targetConnection);

    if (isTargetStatementInput) {
      // This is connecting into a statement input (like DO)
      // ELSEIF and ELSE cannot go inside DO blocks
      if (movingBlock.type === 'if_clause') {
        const movingMode = movingBlock.getFieldValue('MODE');
        if (movingMode === MODE.ELSEIF || movingMode === MODE.ELSE) {
          return false;
        }
      }
      // Everything else (including IF) is allowed in statement inputs
      return true;
    }

    // This is a chain connection (previous connecting to next)
    const connectingToNext = targetConnection === targetBlock.nextConnection;
    const movingIsIfClause = movingBlock.type === 'if_clause';
    const targetIsIfClause = targetBlock.type === 'if_clause';

    // If moving block is if_clause, validate its rules
    if (movingIsIfClause) {
      const movingMode = movingBlock.getFieldValue('MODE');
      const movingHasIfClauseBelow = hasIfClauseInStack(movingBlock);

      // IF blocks can connect anywhere (they start a new chain)
      if (movingMode === MODE.IF) {
        return true;
      }

      if (connectingToNext) {
        // Moving block is connecting AFTER target

        if (targetIsIfClause) {
          const targetMode = targetBlock.getFieldValue('MODE');

          // Rule 1: Nothing can connect after ELSE.
          // During drag-and-drop reject to give visual feedback.
          // During healing / field-changes (not dragging) allow the connection;
          // validateIfClausePositions will disable the block in-place.
          if (targetMode === MODE.ELSE) {
            if (workspace.isDragging()) return false;
          }

          // Rule 2: ELSE cannot connect if it has if_clause blocks after it
          if (movingMode === MODE.ELSE && movingHasIfClauseBelow) {
            return false;
          }

          // Rule 3: ELSE cannot be inserted in middle of chain (drag only).
          // When not dragging (e.g. a MODE field change), keep the connection
          // and let validateIfClausePositions disable the block in-place.
          const targetHasNext = realNext(targetBlock);
          if (targetHasNext && targetHasNext.type === 'if_clause' && movingMode === MODE.ELSE) {
            if (workspace.isDragging()) return false;
          }
        } else {
          // Target is NOT if_clause.
          // During drag-and-drop reject to give visual feedback.
          // During healing / undo-redo (not dragging) allow the connection;
          // validateIfClausePositions will disable the block in-place.
          if (movingMode === MODE.ELSEIF || movingMode === MODE.ELSE) {
            if (workspace.isDragging()) return false;
          }
        }
      } else {
        // Moving block is connecting BEFORE target

        if (targetIsIfClause) {
          // Rule 1: ELSE cannot connect if it has if_clause blocks after it
          if (movingMode === MODE.ELSE && movingHasIfClauseBelow) {
            return false;
          }

          // Rule 2: Cannot insert if target is part of a chain after ELSE
          let current = targetBlock;
          while (current && current.type === 'if_clause') {
            const prev = realPrev(current);
            if (!prev || prev.type !== 'if_clause') break;

            const prevMode = prev.getFieldValue('MODE');
            if (prevMode === MODE.ELSE) {
              return false;
            }
            current = prev;
          }
        } else {
          // Target is NOT if_clause
          // ELSEIF and ELSE cannot connect before non-if_clause blocks
          if (movingMode === MODE.ELSEIF || movingMode === MODE.ELSE) {
            return false;
          }
        }
      }
    }

    // If target is if_clause but moving block is not, additional checks
    if (targetIsIfClause && !movingIsIfClause) {
      const targetMode = targetBlock.getFieldValue('MODE');

      if (connectingToNext) {
        // Non-if_clause connecting after if_clause
        // Only allow if target is at the end of chain (no if_clause blocks after)
        const targetHasNext = realNext(targetBlock);

        if (targetHasNext && targetHasNext.type === 'if_clause') {
          // Target has if_clause blocks after it, cannot insert non-if_clause
          return false;
        }

        // Otherwise it's fine - connecting at the end of the chain
        return true;
      } else {
        // Non-if_clause connecting before if_clause
        // Only allow before IF (which can start a new chain)
        // Don't allow before ELSEIF or ELSE
        if (targetMode === MODE.ELSEIF || targetMode === MODE.ELSE) {
          return false;
        }
      }
    }

    return true;
  };

  // Disable reason used to mark if_clause blocks that are structurally
  // connected but in an invalid position (e.g. ELSEIF after a regular block).
  const INVALID_IF_CLAUSE_REASON = 'INVALID_IF_CLAUSE_POSITION';

  // Scan all if_clause blocks and disable/enable them based on whether their
  // predecessor is a valid if_clause.  Runs with events disabled so the
  // enable/disable state is derived (not recorded in the undo stack).
  function validateIfClausePositions() {
    Blockly.Events.disable();
    try {
      for (const block of workspace.getAllBlocks(false)) {
        if (block.type !== 'if_clause') continue;

        const mode = block.getFieldValue('MODE');

        // IF blocks can start a chain anywhere — always positionally valid.
        if (mode === MODE.IF) {
          block.setDisabledReason(false, INVALID_IF_CLAUSE_REASON);
          continue;
        }

        // ELSEIF / ELSE: valid only when the immediately preceding connected
        // block is an if_clause whose mode is IF or ELSEIF (not ELSE).
        const prevBlock = realPrev(block);

        if (!prevBlock) {
          // Orphaned — disableOrphans handles the disabled state; clear ours.
          block.setDisabledReason(false, INVALID_IF_CLAUSE_REASON);
          continue;
        }

        const validPrev =
          prevBlock.type === 'if_clause' && prevBlock.getFieldValue('MODE') !== MODE.ELSE;

        block.setDisabledReason(!validPrev, INVALID_IF_CLAUSE_REASON);
      }
    } finally {
      Blockly.Events.enable();
    }
  }

  // Re-validate after any structural change so that if_clause blocks that
  // land in an invalid position are disabled immediately, and those that
  // become valid again are re-enabled.
  workspace.addChangeListener(function (event) {
    if (
      !event.isUiEvent &&
      (event.type === Blockly.Events.BLOCK_MOVE ||
        event.type === Blockly.Events.BLOCK_CREATE ||
        event.type === Blockly.Events.BLOCK_DELETE ||
        (event.type === Blockly.Events.BLOCK_CHANGE &&
          event.element === 'field' &&
          event.name === 'MODE'))
    ) {
      validateIfClausePositions();
    }
  });

  // Run once on initialisation to catch any blocks already in invalid positions.
  validateIfClausePositions();
}

export function initializeWorkspace() {
  // Set Blockly color configuration
  Blockly.utils.colour.setHsvSaturation(0.3);
  Blockly.utils.colour.setHsvValue(0.85);

  // Register variable category callback
  workspace.registerToolboxCategoryCallback('VARIABLE', function (ws) {
    const xmlList = Blockly.Variables.flyoutCategory(ws);

    xmlList.forEach((xmlBlock) => {
      if (xmlBlock.getAttribute && xmlBlock.getAttribute('type') === 'variables_set') {
        const valueElement = document.createElement('value');
        valueElement.setAttribute('name', 'VALUE');

        const shadowElement = document.createElement('shadow');
        shadowElement.setAttribute('type', 'math_number');

        const fieldElement = document.createElement('field');
        fieldElement.setAttribute('name', 'NUM');
        fieldElement.textContent = '0';

        shadowElement.appendChild(fieldElement);
        valueElement.appendChild(shadowElement);
        xmlBlock.appendChild(valueElement);
      }
    });

    const defaultBlock = xmlList.find(
      (xmlBlock) => xmlBlock.getAttribute && xmlBlock.getAttribute('type') === 'variables_set'
    );
    if (defaultBlock) {
      const xmlBlockText = defaultBlock.cloneNode(true);

      const valueElements = xmlBlockText.getElementsByTagName('value');
      for (let i = 0; i < valueElements.length; i++) {
        if (valueElements[i].getAttribute('name') === 'VALUE') {
          while (valueElements[i].firstChild) {
            valueElements[i].removeChild(valueElements[i].firstChild);
          }
          const shadowText = document.createElement('shadow');
          shadowText.setAttribute('type', 'text');

          const fieldText = document.createElement('field');
          fieldText.setAttribute('name', 'TEXT');
          fieldText.textContent = '';
          shadowText.appendChild(fieldText);
          valueElements[i].appendChild(shadowText);
          break;
        }
      }

      const defaultIndex = xmlList.indexOf(defaultBlock);
      if (defaultIndex !== -1) {
        xmlList.splice(defaultIndex + 1, 0, xmlBlockText);
      }
    }
    return xmlList;
  });

  workspace.registerToolboxCategoryCallback('LIST', function (ws) {
    const xmlList = [];
    const variableMap = ws.getVariableMap();
    const getNextListName = () => {
      const vars = variableMap.getAllVariables();
      let maxSuffix = 0;
      vars.forEach((model) => {
        const match = model.name.match(/^list(\d+)$/);
        if (match) {
          maxSuffix = Math.max(maxSuffix, parseInt(match[1], 10));
        }
      });
      return `list${maxSuffix + 1}`;
    };

    const createSetListBlock = (valueBuilder) => {
      const block = document.createElement('block');
      block.setAttribute('type', 'variables_set');

      const field = document.createElement('field');
      field.setAttribute('name', 'VAR');
      field.setAttribute('variabletype', '');
      field.textContent = getNextListName();
      block.appendChild(field);

      const value = document.createElement('value');
      value.setAttribute('name', 'VALUE');
      value.appendChild(valueBuilder());
      block.appendChild(value);

      return block;
    };

    const createListShadow = (shadowType, values) => {
      const shadow = document.createElement('shadow');
      shadow.setAttribute('type', 'lists_create_with');
      shadow.setAttribute('inline', 'true');

      const mutation = document.createElement('mutation');
      mutation.setAttribute('items', '2');
      shadow.appendChild(mutation);

      values.forEach((value, index) => {
        const valueNode = document.createElement('value');
        valueNode.setAttribute('name', `ADD${index}`);
        const childShadow = document.createElement('shadow');
        childShadow.setAttribute('type', shadowType);
        const field = document.createElement('field');
        field.setAttribute(
          'name',
          shadowType === 'math_number' ? 'NUM' : shadowType === 'colour' ? 'COLOR' : 'TEXT'
        );
        field.textContent = String(value);
        childShadow.appendChild(field);
        valueNode.appendChild(childShadow);
        shadow.appendChild(valueNode);
      });

      return shadow;
    };

    xmlList.push(
      createSetListBlock(() => {
        const shadow = document.createElement('shadow');
        shadow.setAttribute('type', 'lists_create_empty');
        return shadow;
      })
    );
    xmlList.push(createSetListBlock(() => createListShadow('math_number', [1, 2])));
    xmlList.push(createSetListBlock(() => createListShadow('text', ['', ''])));
    xmlList.push(createSetListBlock(() => createListShadow('colour', ['#ff0000', '#0000ff'])));

    const addItemBlock = document.createElement('block');
    addItemBlock.setAttribute('type', 'lists_add_item');

    const toValue = document.createElement('value');
    toValue.setAttribute('name', 'TO');
    const toShadow = document.createElement('shadow');
    toShadow.setAttribute('type', 'text');
    const toField = document.createElement('field');
    toField.setAttribute('name', 'TEXT');
    toField.textContent = '';
    toShadow.appendChild(toField);
    toValue.appendChild(toShadow);
    addItemBlock.appendChild(toValue);

    xmlList.push(addItemBlock);

    const deleteItemBlock = document.createElement('block');
    deleteItemBlock.setAttribute('type', 'lists_delete_nth');

    const indexValue = document.createElement('value');
    indexValue.setAttribute('name', 'INDEX');
    const indexShadow = document.createElement('shadow');
    indexShadow.setAttribute('type', 'math_number');
    const indexField = document.createElement('field');
    indexField.setAttribute('name', 'NUM');
    indexField.textContent = '1';
    indexShadow.appendChild(indexField);
    indexValue.appendChild(indexShadow);
    deleteItemBlock.appendChild(indexValue);

    xmlList.push(deleteItemBlock);

    [
      'lists_create_empty',
      'lists_create_with',
      'lists_repeat',
      'lists_length',
      'lists_isEmpty',
      'lists_indexOf',
      'lists_getIndex',
      'lists_setIndex',
      'lists_getSublist',
      'lists_split',
      'lists_sort',
    ].forEach((type) => {
      const block = document.createElement('block');
      block.setAttribute('type', type);
      if (type === 'lists_create_with') {
        block.setAttribute('inline', 'true');
      }
      xmlList.push(block);
    });

    return xmlList;
  });

  // Add change listeners
  workspace.addChangeListener(BlockDynamicConnection.finalizeConnections);
  workspace.addChangeListener(handleBlockSelect);
  workspace.addChangeListener(handleBlockDelete);

  // Initialize workspace search
  const workspaceSearch = new WorkspaceSearch(workspace);
  const originalWorkspaceSearchKeydown = workspaceSearch.onWorkspaceKeyDown?.bind(workspaceSearch);
  if (originalWorkspaceSearchKeydown) {
    workspaceSearch.onWorkspaceKeyDown = (e) => {
      const activeElement = document.activeElement;
      const inToolboxContext = !!activeElement?.closest?.(
        '.blocklyToolboxDiv, .blocklyToolbox, .blocklyFlyout'
      );
      if ((e.ctrlKey || e.metaKey) && e.key === 'f' && inToolboxContext) {
        return;
      }
      originalWorkspaceSearchKeydown(e);
    };
  }
  workspaceSearch.init();
  workspaceSearch.setSearchPlaceholder(translate('workspace_search_placeholder'));
  window.flockWorkspaceSearch = workspaceSearch;

  // Shared label map populated by buildSearchIndex (overrideSearchPlugin), used by getBlockLabel
  workspace.flockBlockLabelMap ??= new Map();

  // Mobile: custom HTML search results panel (bypasses the SVG flyout entirely)
  requestAnimationFrame(() => {
    let searchInput = document.querySelector(".blocklyToolbox input[type='search']");
    if (!searchInput) return;
    searchInput.placeholder = translate('toolbox_search_placeholder');

    let originalParent = searchInput.parentElement;
    const isMobile = () => window.matchMedia('(max-width: 768px)').matches;
    const isMobileResults = () => window.matchMedia('(max-width: 480px)').matches;

    // Get the toolbox search category to reuse its trigram blockSearcher
    let searchCategory = workspace
      .getToolbox()
      ?.getToolboxItems?.()
      .find((item) => item.getId?.() === 'toolbox-search-input');

    // Resolve a categorystyle name to a hex color via the current theme
    const getCategoryColor = (categorystyle) => {
      if (!categorystyle) return null;
      let themeColour = workspace.getTheme()?.categoryStyles?.[categorystyle]?.colour;
      if (themeColour === undefined || themeColour === null) return null;
      // Resolve Blockly message references e.g. "%{BKY_LOOPS_HUE}"
      if (
        typeof themeColour === 'string' &&
        themeColour.startsWith('%{BKY_') &&
        themeColour.endsWith('}')
      ) {
        const key = themeColour.slice(6, -1);
        themeColour = Blockly.Msg?.[key] ?? themeColour;
      }
      if (typeof themeColour === 'string' && themeColour.startsWith('#')) return themeColour;
      const hue = parseFloat(themeColour);
      if (isNaN(hue)) return null;
      return Blockly.utils.colour.hueToHex(hue);
    };

    // Build block type → { name, color } map from the toolbox definition
    const blockCategoryMap = new Map();
    const buildCategoryMap = () => {
      blockCategoryMap.clear();
      const walk = (node, categoryName, categoryColor) => {
        if (!node) return;
        if (node.kind === 'block' && node.type && !blockCategoryMap.has(node.type)) {
          blockCategoryMap.set(node.type, { name: categoryName, color: categoryColor });
        }
        if (node.contents) {
          let name = node.name || categoryName;
          if (name?.startsWith('%{BKY_') && name.endsWith('}')) {
            const key = name.slice(6, -1);
            name =
              Blockly.Msg?.[key] ||
              key
                .replace(/^CATEGORY_/, '')
                .replace(/_/g, ' ')
                .toLowerCase()
                .replace(/^./, (c) => c.toUpperCase());
          }
          let color = categoryColor;
          if (node.categorystyle) {
            color = getCategoryColor(node.categorystyle) ?? categoryColor;
          }
          node.contents.forEach((child) => walk(child, name, color));
        }
      };
      walk(toolboxDef, '', null);
    };
    buildCategoryMap();

    const getBlockLabel = (blockDef) => {
      const type = blockDef.type;
      return (
        workspace.flockBlockLabelMap?.get(type) ||
        type.replace(/_/g, ' ').replace(/^./, (c) => c.toUpperCase())
      );
    };

    const applyMatchBlocksOverride = (sc) => {
      if (!sc) return;
      sc.matchBlocks = function () {
        const query = this.searchField?.value?.trim() || '';
        let items = query ? this.blockSearcher.blockTypesMatching(query) : [];
        if (items.length === 0) {
          this.flyoutItems_ = [{ kind: 'label', text: translate('search_no_matching') }];
        } else {
          const q = query.toLowerCase();
          const scoreItem = (blockDef) => {
            if (!blockDef.type) return 4;
            const label = getBlockLabel(blockDef).toLowerCase();
            const type = blockDef.type.toLowerCase();
            if (label.startsWith(q)) return 0;
            if (label.includes(q)) return 1;
            if (type.includes(q)) return 2;
            return 3;
          };
          const seenTypes = new Set();
          this.flyoutItems_ = items
            .filter((b) => {
              if (!b.type || seenTypes.has(b.type)) return false;
              seenTypes.add(b.type);
              return true;
            })
            .sort((a, b) => scoreItem(a) - scoreItem(b));
        }
        this.parentToolbox_.refreshSelection();
      };
    };
    applyMatchBlocksOverride(searchCategory);

    // Build overlay bar
    const overlay = document.createElement('div');
    overlay.className = 'mobile-search-overlay';

    const cancelBtn = document.createElement('button');
    cancelBtn.type = 'button';
    cancelBtn.className = 'mobile-search-cancel';
    cancelBtn.setAttribute('aria-label', translate('close'));
    cancelBtn.textContent = '×';
    overlay.appendChild(cancelBtn);

    // Build results panel
    const resultsPanel = document.createElement('div');
    resultsPanel.className = 'mobile-search-results';

    const addBlockToCenter = (blockDef) => {
      if (!Blockly.Blocks[blockDef.type]) return;
      const metrics = workspace.getMetrics();

      // Place below all existing top-level blocks
      const topBlocks = workspace.getTopBlocks(false);
      let placeY;
      if (topBlocks.length === 0) {
        placeY = -workspace.scrollY / workspace.scale + 50;
      } else {
        placeY =
          Math.max(
            ...topBlocks.map((b) => {
              const pos = b.getRelativeToSurfaceXY();
              return pos.y + (b.height || 50);
            })
          ) + 30;
      }
      const placeX = (metrics.viewWidth / 2 - workspace.scrollX) / workspace.scale;

      const state = { ...blockDef, x: placeX, y: placeY };
      delete state.kind;
      delete state.keyword;
      Blockly.serialization.blocks.append(state, workspace);

      // Scroll so the new block is visible
      const scale = workspace.scale;
      workspace.scroll(
        metrics.viewWidth / 2 - placeX * scale,
        metrics.viewHeight * 0.4 - placeY * scale
      );
    };

    const updateResults = () => {
      const query = searchInput.value.trim();
      if (!query) {
        resultsPanel.innerHTML = '';
        return;
      }

      const matches = searchCategory?.blockSearcher?.blockTypesMatching(query) ?? [];

      if (matches.length === 0) {
        resultsPanel.innerHTML = `<div class="mobile-search-empty">${translate('search_no_matching')}</div>`;
        return;
      }

      const q = query.toLowerCase();
      const getLabel = (blockDef) => getBlockLabel(blockDef).toLowerCase();
      const score = (blockDef) => {
        const label = getLabel(blockDef);
        const type = blockDef.type.toLowerCase();
        if (label.startsWith(q)) return 0;
        if (label.includes(q)) return 1;
        if (type.includes(q)) return 2;
        return 3;
      };
      matches.sort((a, b) => score(a) - score(b));

      const seenTypes = new Set();
      const filtered = matches.filter((blockDef) => {
        if (seenTypes.has(blockDef.type)) return false;
        seenTypes.add(blockDef.type);
        return true;
      });

      resultsPanel.innerHTML = '';
      filtered.slice(0, 60).forEach((blockDef) => {
        const type = blockDef.type;
        if (!type || !Blockly.Blocks[type]) return;

        const label = getBlockLabel(blockDef);
        const { name: category, color } = blockCategoryMap.get(type) ?? { name: '', color: null };

        const item = document.createElement('button');
        item.type = 'button';
        item.className = 'mobile-search-result-item';
        const pillStyle = color ? ` style="background-color:${color}"` : '';
        item.innerHTML = `<span class="mobile-search-result-name">${label}</span>${category ? `<span class="mobile-search-result-category"${pillStyle}>${category}</span>` : ''}`;

        item.addEventListener('click', () => {
          if (overlay.isConnected) {
            addBlockToCenter(blockDef);
            closeOverlay();
          }
        });

        resultsPanel.appendChild(item);
      });
    };

    let blurTimeout = null;
    let suppressBlurClose = false;

    const openOverlay = () => {
      if (!isMobileResults()) overlay.classList.add('expanding');
      document.body.appendChild(overlay);
      overlay.insertBefore(searchInput, cancelBtn);
      if (isMobileResults()) {
        workspace.getToolbox()?.clearSelection?.();
        document.body.appendChild(resultsPanel);
        updateResults();
        if (searchCategory) {
          searchCategory._mobileMatchBlocks = searchCategory.matchBlocks;
          searchCategory.matchBlocks = () => {};
        }
      }
      requestAnimationFrame(() => searchInput.focus());
    };

    const collapseOverlay = () => {
      clearTimeout(blurTimeout);
      blurTimeout = null;
      overlay.classList.remove('expanding');
      overlay.classList.add('collapsing');
      overlay.addEventListener(
        'animationend',
        () => {
          overlay.classList.remove('collapsing');
          if (searchCategory?._mobileMatchBlocks) {
            searchCategory.matchBlocks = searchCategory._mobileMatchBlocks;
            delete searchCategory._mobileMatchBlocks;
          }
          if (resultsPanel.isConnected) {
            resultsPanel.remove();
            resultsPanel.innerHTML = '';
          }
          originalParent.appendChild(searchInput);
          overlay.remove();
        },
        { once: true }
      );
    };

    const closeOverlay = () => {
      clearTimeout(blurTimeout);
      blurTimeout = null;
      // Restore flyout behaviour
      if (searchCategory?._mobileMatchBlocks) {
        searchCategory.matchBlocks = searchCategory._mobileMatchBlocks;
        delete searchCategory._mobileMatchBlocks;
      }
      workspace.getToolbox()?.clearSelection?.();
      searchInput.value = '';
      originalParent.appendChild(searchInput);
      overlay.remove();
      resultsPanel.remove();
      resultsPanel.innerHTML = '';
    };

    const attachInputListeners = (input) => {
      let openRequested = false;

      const requestOpen = () => {
        openRequested = true;
        clearTimeout(blurTimeout);
        blurTimeout = null;
        if (!overlay.isConnected && isMobile()) openOverlay();
      };

      input.setAttribute('autocomplete', 'one-time-code');
      input.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') {
          e.preventDefault();
          suppressBlurClose = true;
          const query = input.value;
          input.blur();
          requestAnimationFrame(() => {
            input.value = query;
            if (resultsPanel.isConnected) updateResults();
          });
        }
      });
      input.addEventListener('blur', () => {
        if (!overlay.isConnected) return;
        if (suppressBlurClose) {
          suppressBlurClose = false;
          return;
        }
        blurTimeout = setTimeout(() => {
          if (!overlay.isConnected) return;
          const active = document.activeElement;
          const blocklyDiv = document.getElementById('blocklyDiv');
          if (!active || active === document.body || overlay.contains(active)) return;
          if (blocklyDiv?.contains(active)) {
            collapseOverlay();
            return;
          }
          closeOverlay();
        }, 150);
      });
      input.addEventListener('focus', () => {
        clearTimeout(blurTimeout);
        blurTimeout = null;
        if (!overlay.isConnected && isMobile() && openRequested) {
          openRequested = false;
          openOverlay();
        } else {
          openRequested = false;
        }
      });
      input.addEventListener('pointerdown', requestOpen);
      input.addEventListener('mousedown', requestOpen);
      input.addEventListener('touchstart', requestOpen, { passive: true });
      input.addEventListener('click', requestOpen);

      const searchRow = input
        .closest('.blocklyToolboxCategory')
        ?.querySelector(':scope > .blocklyTreeRowContentContainer');
      if (searchRow) {
        searchRow.addEventListener('pointerdown', requestOpen);
        searchRow.addEventListener('touchstart', requestOpen, { passive: true });
        searchRow.addEventListener('click', requestOpen);
      }

      input.addEventListener('input', () => {
        if (resultsPanel.isConnected) updateResults();
      });
      input.addEventListener('keyup', () => {
        if (resultsPanel.isConnected) updateResults();
      });
    };

    cancelBtn.addEventListener('mousedown', (e) => e.preventDefault());
    cancelBtn.addEventListener('click', closeOverlay);

    // Close search overlay if screen resizes above tablet size (768px)
    window.matchMedia('(max-width: 768px)').addEventListener('change', (e) => {
      if (!e.matches && overlay.isConnected) closeOverlay();
    });

    // Scrolling the results panel should not trigger the blur-close timeout
    resultsPanel.addEventListener(
      'touchstart',
      () => {
        clearTimeout(blurTimeout);
        blurTimeout = null;
      },
      { passive: true }
    );

    attachInputListeners(searchInput);

    // Re-bind when the toolbox rebuilds (theme change, language change, etc.)
    const toolboxEl = document.querySelector('.blocklyToolbox');
    if (toolboxEl) {
      new MutationObserver(() => {
        if (searchInput.isConnected) return;
        if (overlay.isConnected) closeOverlay();
        const newInput = document.querySelector(".blocklyToolbox input[type='search']");
        if (!newInput) return;
        newInput.placeholder = translate('toolbox_search_placeholder');
        searchInput = newInput;
        originalParent = newInput.parentElement;
        searchCategory = workspace
          .getToolbox()
          ?.getToolboxItems?.()
          .find((item) => item.getId?.() === 'toolbox-search-input');
        buildCategoryMap();
        applyMatchBlocksOverride(searchCategory);
        attachInputListeners(newInput);
      }).observe(toolboxEl, { childList: true, subtree: true });
    }
  });

  // Fade non-matching blocks during search
  const blocklyDiv = document.getElementById('blocklyDiv');
  const originalOpen = workspaceSearch.open.bind(workspaceSearch);
  const originalClose = workspaceSearch.close.bind(workspaceSearch);

  // Mobile workspace search bar (≤480px): full-width fixed bar with prev/next
  const isMobileWS = () => window.matchMedia('(max-width: 768px)').matches;

  const wsMobileBar = document.createElement('div');
  wsMobileBar.className = 'ws-search-mobile-bar';

  const wsMobileInput = document.createElement('input');
  wsMobileInput.type = 'text';
  wsMobileInput.className = 'ws-search-mobile-input';
  wsMobileInput.placeholder = translate('workspace_search_placeholder');
  wsMobileInput.setAttribute('autocomplete', 'one-time-code');

  const wsMobileCount = document.createElement('span');
  wsMobileCount.className = 'ws-search-mobile-count';
  wsMobileCount.setAttribute('aria-live', 'polite');

  const wsMobilePrev = document.createElement('button');
  wsMobilePrev.type = 'button';
  wsMobilePrev.className = 'ws-search-mobile-btn';
  wsMobilePrev.setAttribute('aria-label', translate('shortcut_select_previous_result'));
  wsMobilePrev.textContent = '▲';

  const wsMobileNext = document.createElement('button');
  wsMobileNext.type = 'button';
  wsMobileNext.className = 'ws-search-mobile-btn';
  wsMobileNext.setAttribute('aria-label', translate('shortcut_select_next_result'));
  wsMobileNext.textContent = '▼';

  const wsMobileClose = document.createElement('button');
  wsMobileClose.type = 'button';
  wsMobileClose.className = 'ws-search-mobile-btn ws-search-mobile-close';
  wsMobileClose.setAttribute('aria-label', translate('close'));
  wsMobileClose.textContent = '×';

  wsMobileBar.append(wsMobileInput, wsMobileCount, wsMobilePrev, wsMobileNext, wsMobileClose);

  const updateWsMobileCount = () => {
    const total = workspaceSearch.blocks?.length ?? 0;
    const idx = workspaceSearch.currentBlockIndex ?? -1;
    wsMobileCount.textContent = wsMobileInput.value.trim()
      ? total === 0
        ? '0'
        : `${idx + 1}/${total}`
      : '';
  };

  const originalSetCurrentBlock = workspaceSearch.setCurrentBlock?.bind(workspaceSearch);
  if (originalSetCurrentBlock) {
    workspaceSearch.setCurrentBlock = function (index) {
      originalSetCurrentBlock(index);
      if (wsMobileBar.isConnected) updateWsMobileCount();
    };
  }

  const originalSearchAndHighlight = workspaceSearch.searchAndHighlight.bind(workspaceSearch);
  workspaceSearch.searchAndHighlight = function (text, preserve) {
    originalSearchAndHighlight(text, preserve);
    if (wsMobileBar.isConnected) updateWsMobileCount();
  };

  wsMobileInput.addEventListener('input', () => {
    workspaceSearch.searchAndHighlight(
      wsMobileInput.value.trim(),
      workspaceSearch.preserveSelected
    );
  });
  wsMobileInput.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') workspaceSearch.close();
    else if (e.key === 'Enter') e.shiftKey ? workspaceSearch.previous() : workspaceSearch.next();
  });
  wsMobilePrev.addEventListener('mousedown', (e) => e.preventDefault());
  wsMobilePrev.addEventListener('click', () => workspaceSearch.previous());
  wsMobileNext.addEventListener('mousedown', (e) => e.preventDefault());
  wsMobileNext.addEventListener('click', () => workspaceSearch.next());
  wsMobileClose.addEventListener('mousedown', (e) => e.preventDefault());
  wsMobileClose.addEventListener('click', () => workspaceSearch.close());

  window.matchMedia('(max-width: 768px)').addEventListener('change', (e) => {
    if (!e.matches && wsMobileBar.isConnected) workspaceSearch.close();
  });

  workspaceSearch.open = function () {
    if (isMobileWS()) {
      document.body.appendChild(wsMobileBar);
      wsMobileInput.value = workspaceSearch.searchText || '';
      if (wsMobileInput.value) {
        workspaceSearch.searchAndHighlight(wsMobileInput.value, workspaceSearch.preserveSelected);
      }
      updateWsMobileCount();
      wsMobileInput.focus();
    } else {
      originalOpen();
    }
    blocklyDiv?.classList.add('blockly-search-active');
  };
  workspaceSearch.close = function () {
    if (wsMobileBar.isConnected) {
      wsMobileInput.value = '';
      wsMobileBar.remove();
    }
    originalClose();
    blocklyDiv?.classList.remove('blockly-search-active');
  };

  // Override highlight methods to work at block-group level so the plugin's
  // injected fill: #000 rule never applies to matched block paths.
  workspaceSearch.highlightSearchGroup = function (blocks) {
    const matchTopIds = new Set();
    blocks.forEach((block) => {
      block.getSvgRoot()?.classList.add('ws-search-match');
      let top = block;
      while (top.getSurroundParent()) top = top.getSurroundParent();
      matchTopIds.add(top.id);
    });
    workspace.getTopBlocks(false).forEach((block) => {
      if (!matchTopIds.has(block.id)) {
        block.getSvgRoot()?.classList.add('ws-search-fade');
      }
    });
  };
  workspaceSearch.unhighlightSearchGroup = function (blocks) {
    blocks.forEach((block) => block.getSvgRoot()?.classList.remove('ws-search-match'));
    workspace.getTopBlocks(false).forEach((block) => {
      block.getSvgRoot()?.classList.remove('ws-search-fade');
    });
  };
  workspaceSearch.highlightCurrentSelection = function (block) {
    const svg = block.getSvgRoot();
    if (svg) {
      svg.classList.add('ws-search-current');
      let top = block;
      while (top.getSurroundParent()) top = top.getSurroundParent();
      const topSvg = top.getSvgRoot();
      if (topSvg) topSvg.parentNode?.appendChild(topSvg);
    }
  };
  workspaceSearch.unhighlightCurrentSelection = function (block) {
    block.getSvgRoot()?.classList.remove('ws-search-current');
  };

  // Override the workspace centering for workspace search as it jumps all over the place by default!
  const originalCenter = workspace.centerOnBlock.bind(workspace);

  workspace.centerOnBlock = function (blockId) {
    if (workspaceSearch && workspaceSearch.htmlDiv.style.display !== 'none') {
      const block = this.getBlockById(blockId);
      if (block) {
        const scale = this.scale;
        const blockXY = block.getRelativeToSurfaceXY();
        let yOffset = 0;

        const searchTerm = workspaceSearch.inputElement.value.toLowerCase();
        if (searchTerm) {
          for (const input of block.inputList) {
            const match = input.fieldRow.some((f) =>
              f.getText().toLowerCase().includes(searchTerm)
            );
            if (match) {
              const fieldGui = input.fieldRow[0]?.getSvgRoot();
              if (fieldGui && fieldGui.getBBox) {
                yOffset = fieldGui.getBBox().y;
              }
              break;
            }
          }
        }

        const workspaceMetrics = this.getMetrics();
        const currentBlockX = blockXY.x * scale + this.scrollX;
        const currentBlockY = blockXY.y * scale + this.scrollY;

        const blockHW = block.getHeightWidth();
        const blockWidth = blockHW.width * scale;

        const viewportWidth = workspaceMetrics.viewWidth;
        const viewportHeight = workspaceMetrics.viewHeight;
        const searchBarHeight = 50;
        const leftMargin = 10;
        const buffer = 5;

        // 1. HORIZONTAL LOGIC:
        // Only move X if the block's left edge is hidden or too far right.
        // We ignore the specific row's internal X offset to keep it stable.
        let finalScrollX = this.scrollX;
        const isHorizontallyVisible =
          currentBlockX >= leftMargin - buffer && currentBlockX + blockWidth <= viewportWidth;

        if (!isHorizontallyVisible) {
          finalScrollX = -blockXY.x * scale + leftMargin;
        }

        // 2. VERTICAL LOGIC:
        // Strict check for the specific row (y + yOffset)
        const currentRowY = currentBlockY + yOffset * scale;
        const isRowVisible =
          currentRowY >= searchBarHeight + buffer &&
          currentRowY + 20 * scale <= viewportHeight - buffer;

        let finalScrollY = this.scrollY;
        if (!isRowVisible) {
          finalScrollY = -(blockXY.y + yOffset) * scale + 50;
        }

        // 3. EXECUTION:
        if (finalScrollX === this.scrollX && finalScrollY === this.scrollY) {
          return;
        }

        this.scroll(finalScrollX, finalScrollY);
        return;
      }
    }

    originalCenter(blockId);
  };

  // Set up auto value behavior
  setupAutoValueBehavior(workspace);

  return workspace;
}

// Patch the workspace Navigator so keyboard navigation skips redundant stops
// on value blocks whose only interactive content is a text-input field.
//
// Applies to two cases:
//   Shadow blocks  — e.g. the " " text block inside print_text's TEXT input.
//   Standalone text-input reporters — e.g. `text` and `colour_from_string`.
//
// In all cases: right-arrow and left-arrow skip the block entirely and land
// on the field (right) or the parent (left). Up/down navigate as if standing
// on the block itself.
function installShadowNavigationPatch(ws) {
  const nav = ws.getNavigator?.();
  if (!nav) return;

  // First field in a block that a keyboard user can interact with.
  const getPrimaryEditableField = (block) => {
    for (const input of block.inputList) {
      for (const field of input.fieldRow) {
        if (
          field.canBeFocused?.() &&
          field.isVisible?.() &&
          (field.isClickable?.() || field.isCurrentlyEditable?.()) &&
          field.getParentInput?.()?.isVisible?.()
        ) {
          return field;
        }
      }
    }
    return null;
  };

  // A shadow value block whose primary field is *separately* navigable, which
  // creates a redundant block+field double-stop during keyboard navigation
  // (e.g. the " " `text` block in print_text's TEXT input).
  //
  // Simple reporters (single field + output, e.g. `math_number`) are excluded:
  // Blockly already makes their full-block field non-navigable and treats the
  // block itself as the single stop (Enter edits it directly), so there is no
  // redundant stop to skip — and redirecting to their non-navigable field
  // would break navigation.
  const isSkippableShadow = (node) =>
    typeof node?.isShadow === 'function' &&
    node.isShadow() &&
    !!node.outputConnection &&
    !(typeof node.isSimpleReporter === 'function' && node.isSimpleReporter());

  // A standalone (non-shadow) reporter block whose sole interactive content is
  // a text-input field, e.g. `text` (" ") or `colour_from_string` (# hex).
  // These create the same redundant block+field double-stop as skippable shadows.
  //
  // Variable/dropdown reporters are excluded because their primary field is a
  // FieldDropdown/FieldVariable, not a FieldTextInput.
  // Simple reporters are excluded for the same reason as isSkippableShadow.
  const isSkippableStandalone = (node) =>
    !!node?.outputConnection &&
    !node.isShadow?.() &&
    !(typeof node.isSimpleReporter === 'function' && node.isSimpleReporter()) &&
    getPrimaryEditableField(node) != null;

  // If node is a skippable block (shadow or standalone), return its primary
  // field instead.
  const skipBlock = (node) => {
    if (!isSkippableShadow(node) && !isSkippableStandalone(node)) return node;
    return getPrimaryEditableField(node) ?? node;
  };

  // The shortcut handler calls getInNode/getOutNode/getNextNode/getPreviousNode
  // with no arguments, relying on the focused node. A skippable block's
  // full-block field resolves back to its block via getFocusedNode(), so we
  // read document.activeElement to recover the field that actually owns focus.
  const getFocusedSkippableField = () => {
    const el = document.activeElement;
    if (!el?.id) return null;
    const sep = el.id.indexOf('_field_');
    if (sep === -1) return null;
    const block = ws.getBlockById(el.id.substring(0, sep));
    if (!isSkippableShadow(block) && !isSkippableStandalone(block)) return null;
    for (const input of block.inputList) {
      for (const field of input.fieldRow) {
        if (field.getFocusableElement?.()?.id === el.id) return field;
      }
    }
    return null;
  };

  const origIn = nav.getInNode.bind(nav);
  const origOut = nav.getOutNode.bind(nav);
  const origNext = nav.getNextNode.bind(nav);
  const origPrev = nav.getPreviousNode.bind(nav);

  // Right-arrow: if the target is a skippable block, land on its field instead
  // of the redundant block stop. From a skippable field, pass the field
  // explicitly so the traversal bubbles up to the next inline sibling.
  nav.getInNode = function (node) {
    const field = getFocusedSkippableField();
    return skipBlock(field ? origIn(field) : origIn(node));
  };

  // Left-arrow: from a skippable block's field, go to the block's parent
  // (skip the block itself in both the shadow and standalone cases).
  nav.getOutNode = function (node) {
    const field = getFocusedSkippableField();
    if (field) return skipBlock(origOut(field.getSourceBlock()));
    return origOut(node);
  };

  // Down-arrow: navigate as if standing on the skippable block itself.
  nav.getNextNode = function (node) {
    const field = getFocusedSkippableField();
    if (field) return skipBlock(origNext(field.getSourceBlock()));
    return skipBlock(origNext(node));
  };

  // Up-arrow: same idea.
  nav.getPreviousNode = function (node) {
    const field = getFocusedSkippableField();
    if (field) return skipBlock(origPrev(field.getSourceBlock()));
    return skipBlock(origPrev(node));
  };

  // The built-in DISCONNECT shortcut (X key) checks that the focused node is
  // a Block instance, which fails when focus is on a skippable block's field
  // (because we skip the block stop). Register an additional shortcut for the
  // same key that fires only when a skippable field is focused.
  // The built-in DISCONNECT (X), DUPLICATE (D), and DELETE shortcuts check
  // that the focused node is a Block instance, which fails when focus is on a
  // skippable block's field. Register additional shortcuts for the same keys
  // that fire only when a skippable field is focused.
  const shortcutRegistry = Blockly.ShortcutRegistry.registry;

  const skippableFieldBlock = () => {
    const field = getFocusedSkippableField();
    return field ? field.getSourceBlock() : null;
  };

  // Registers a shortcut that fires only when a skippable field is focused.
  // canRun(workspace, block) → extra conditions beyond the common workspace checks.
  // run(workspace, event, block) → performs the action, returns true on success.
  const registerSkippableFieldShortcut = (name, keyCode, canRun, run) => {
    shortcutRegistry.register({
      name,
      allowCollision: true,
      keyCodes: [shortcutRegistry.createSerializedKey(keyCode)],
      preconditionFn: (workspace) => {
        const block = skippableFieldBlock();
        return (
          !!block && !workspace.isDragging() && !workspace.isReadOnly() && canRun(workspace, block)
        );
      },
      callback: (workspace, event) => {
        const block = skippableFieldBlock();
        return !!block && run(workspace, event, block);
      },
    });
  };

  registerSkippableFieldShortcut(
    'disconnect_from_skippable_field',
    Blockly.utils.KeyCodes.X,
    (_ws, block) => !block.isShadow?.(),
    (_ws, event, block) => {
      block.unplug(!(event instanceof KeyboardEvent && event.shiftKey));
      return true;
    }
  );

  registerSkippableFieldShortcut(
    'duplicate_from_skippable_field',
    Blockly.utils.KeyCodes.D,
    (ws, block) => !ws.isFlyout && !block.isShadow?.() && !!block.isDuplicatable?.(),
    (ws, _event, block) => {
      const copyData = block.toCopyData?.();
      if (!copyData) return false;
      Blockly.clipboard.paste(copyData, ws);
      return true;
    }
  );

  // Delete key is safe to bind here — Del doesn't conflict with text editing
  // (users use Backspace for that). Backspace is intentionally excluded.
  registerSkippableFieldShortcut(
    'delete_from_skippable_field',
    Blockly.utils.KeyCodes.DELETE,
    (_ws, block) => !block.isShadow?.() && !!block.isDeletable?.(),
    (_ws, event, block) => {
      event.preventDefault();
      block.checkAndDelete();
      return true;
    }
  );
}

export function createBlocklyWorkspace() {
  // Register the custom renderer
  Blockly.registry.register(
    Blockly.registry.Type.RENDERER,
    'custom_zelos_renderer',
    CustomZelosRenderer
  );

  registerCustomCommentIcon();

  // Manually create a navigation-deferring toolbox
  class NavigationDeferringToolbox extends Blockly.Toolbox {
    #keyboardActive = false;
    #onKeyDown = () => {
      this.#keyboardActive = true;
    };
    #onPointerDown = () => {
      this.#keyboardActive = false;
    };

    onKeyDown_() {
      return false; // Defer to keyboard navigation plugin
    }

    init(workspace) {
      super.init(workspace);
      // Track whether the last user interaction was keyboard or pointer so
      // selectItem_ can limit accordion auto-collapse to keyboard navigation.
      document.addEventListener('keydown', this.#onKeyDown, true);
      document.addEventListener('pointerdown', this.#onPointerDown, true);
    }

    dispose() {
      document.removeEventListener('keydown', this.#onKeyDown, true);
      document.removeEventListener('pointerdown', this.#onPointerDown, true);
      super.dispose();
    }

    selectItem_(oldItem, newItem) {
      super.selectItem_(oldItem, newItem);
      if (newItem && this.#keyboardActive) {
        this.collapseUnrelatedCategories_(newItem);
      }
    }

    // Accordion behaviour: navigating to a category collapses every other
    // expandable category, keeping only the selected item and its ancestors
    // open.
    collapseUnrelatedCategories_(selectedItem) {
      if (!selectedItem) return;
      const keepOpen = new Set();
      const visited = new Set();
      let current = selectedItem;
      while (current && !visited.has(current)) {
        visited.add(current);
        keepOpen.add(current);
        current = current.getParent?.() ?? null;
      }
      for (const candidate of this.getToolboxItems()) {
        if (keepOpen.has(candidate)) continue;
        if (
          typeof candidate.isExpanded !== 'function' ||
          typeof candidate.setExpanded !== 'function'
        ) {
          continue;
        }
        if (candidate.isExpanded()) {
          candidate.setExpanded(false);
        }
      }
    }
  }

  // Register it before inject
  Blockly.registry.unregister(Blockly.registry.Type.TOOLBOX, Blockly.registry.DEFAULT);
  Blockly.registry.register(
    Blockly.registry.Type.TOOLBOX,
    Blockly.registry.DEFAULT,
    NavigationDeferringToolbox
  );

  workspace = Blockly.inject('blocklyDiv', options);

  // Stop trashcan flyout from covering the whole workspace on small screens when it has wide blocks in it
  // The trashcan flyout is as wide as its widest deleted block, so a wide block
  // can make it cover the whole workspace with nothing left to click to dismiss
  // it. Cap its rendered width to the visible workspace minus a small gap.
  // Blockly keeps the flyout right-aligned, so the right edge (and its vertical
  // scrollbar) stay pinned to the workspace edge while the left edge can never
  // cross the gap; wider blocks overflow to the right. Recomputed from live
  // metrics on every position() call, so it tracks the panel resizer; the gap
  // is capped to a fraction of the visible workspace so it stays sensible on
  // narrow panels.
  const trashcan = workspace.trashcan;
  const trashcanFlyout = trashcan?.flyout;
  if (trashcan && trashcanFlyout) {
    const TRASHCAN_FLYOUT_LEFT_GAP = 48;
    trashcanFlyout.getWidth = function () {
      if (!this.isVisible()) return this.width_;
      const viewWidth = this.targetWorkspace.getMetricsManager().getViewMetrics().width;
      const gap = Math.min(TRASHCAN_FLYOUT_LEFT_GAP, Math.max(0, viewWidth * 0.25));
      return Math.min(this.width_, viewWidth - gap);
    };

    // The flyout is a separate, higher z-index SVG that would otherwise hide the
    // trashcan icon. While the flyout is open, lift the icon into an overlay SVG
    // that shares the workspace's coordinate space, so it stays in place but
    // The flyout is a separate, higher z-index SVG that would otherwise hide the
    // trashcan icon. While the flyout is open, lift the icon into an overlay SVG
    // that shares the workspace's coordinate space, so it stays in place but
    // renders on top; clicking the lifted icon then closes the flyout.
    const injectionDiv = workspace.getInjectionDiv();
    let trashIcon = null;
    try {
      trashIcon = trashcan.getFocusableElement();
    } catch {
      trashIcon = null;
    }
    const iconHome = trashIcon?.parentNode;
    if (injectionDiv && trashIcon && iconHome) {
      const iconOverlay = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
      iconOverlay.setAttribute('class', 'blocklyTrashcanIconOverlay');
      Object.assign(iconOverlay.style, {
        position: 'absolute',
        top: '0',
        left: '0',
        width: '100%',
        height: '100%',
        overflow: 'visible',
        pointerEvents: 'none',
        zIndex: '21',
      });
      injectionDiv.appendChild(iconOverlay);

      // pointer-events is inherited, so the overlay's `none` (which lets clicks
      // pass through its empty area to the flyout) would also disable the icon.
      // Force the icon itself back to clickable so it can close the flyout.
      trashIcon.style.pointerEvents = 'auto';

      // Clicking the lifted icon closes the flyout. The icon's own pointerup
      // still calls openFlyout(), so swallow that one reopen for a moment.
      let suppressOpenUntil = 0;
      const originalOpenFlyout = trashcan.openFlyout.bind(trashcan);
      trashcan.openFlyout = function () {
        if (Date.now() < suppressOpenUntil) return;
        originalOpenFlyout();
      };
      trashIcon.addEventListener(
        'pointerdown',
        (e) => {
          if (!trashcan.contentsIsOpen()) return;
          e.preventDefault();
          e.stopPropagation();
          suppressOpenUntil = Date.now() + 400;
          trashcan.closeFlyout();
        },
        true
      );

      workspace.addChangeListener((e) => {
        if (e.type !== Blockly.Events.TRASHCAN_OPEN) return;
        if (e.isOpen) {
          if (trashIcon.parentNode !== iconOverlay) iconOverlay.appendChild(trashIcon);
        } else if (trashIcon.parentNode !== iconHome) {
          iconHome.appendChild(trashIcon);
        }
      });
    }
  }

  if (navigator.maxTouchPoints > 0 && window.innerWidth < 768) {
    // Make it harder to accidentally drag blocks on mobile.
    Blockly.config.dragRadius = 20;
    Blockly.config.flyoutDragRadius = 20;

    const blocklyDiv = document.getElementById('blocklyDiv');

    let selectedBlock = null;

    blocklyDiv.addEventListener(
      'pointerdown',
      (e) => {
        if (e.pointerType !== 'touch') return;
        const blockRoot = e.target.closest('.blocklyDraggable');

        if (
          blockRoot &&
          !blockRoot.classList.contains('blocklySelected') &&
          !blockRoot.closest('.blocklyFlyout')
        ) {
          e.stopPropagation();
          const blockId = blockRoot.getAttribute('data-id');
          if (blockId) {
            const block = workspace.getBlockById(blockId);
            if (block) {
              selectedBlock?.unselect();
              block.select();
              selectedBlock = block;
            }
          }
        } else if (!blockRoot) {
          selectedBlock?.unselect();
          selectedBlock = null;
        }
      },
      true
    );

    workspace.addChangeListener((e) => {
      if (e.type === Blockly.Events.BLOCK_DRAG && !e.isStart) {
        setTimeout(() => {
          Blockly.common.getSelected()?.unselect();
          selectedBlock = null;
        }, 0);
      }
    });
  }

  installWorkspaceJumpDebug(workspace);

  let activeXyzBlock = null;

  workspace.addChangeListener((event) => {
    if (event.type !== Blockly.Events.SELECTED) return;

    if (!event.newElementId) {
      const widgetDiv = document.querySelector('.blocklyWidgetDiv');
      if (widgetDiv?.childElementCount > 0) return;
      activeXyzBlock?.getSvgRoot()?.removeAttribute('data-xyz-active');
      activeXyzBlock = null;
      return;
    }

    let block = workspace.getBlockById(event.newElementId);
    while (block && !block.inputList?.some((i) => ['X', 'Y', 'Z'].includes(i.name))) {
      block = block.getParent?.() ?? null;
    }

    if (block !== activeXyzBlock) {
      activeXyzBlock?.getSvgRoot()?.removeAttribute('data-xyz-active');
      activeXyzBlock = block ?? null;
      activeXyzBlock?.getSvgRoot()?.setAttribute('data-xyz-active', '');
    }
  });

  // Initialize keyboard navigation.

  const toolbox = workspace.getToolbox();
  toolbox.onKeyDown_ = function () {
    return false;
  };

  (function wireToolboxKeyboardOverrides() {
    if (!toolbox) return;
    const host = workspace.getInjectionDiv?.() || document;
    const toolboxDiv = toolbox.HtmlDiv || document.querySelector('.blocklyToolboxDiv');
    if (!toolboxDiv) return;
    let categoryTypePrefix = '';
    const TOOLBOX_OR_FLYOUT_SELECTOR = '.blocklyToolboxDiv, .blocklyToolbox, .blocklyFlyout';

    const resetCategoryTypePrefix = () => {
      categoryTypePrefix = '';
    };
    const stopEvent = (event) => {
      event.preventDefault();
      event.stopPropagation();
      event.stopImmediatePropagation();
    };
    const isInToolboxOrFlyout = (element) => !!element?.closest?.(TOOLBOX_OR_FLYOUT_SELECTOR);
    const isEditableTarget = (target) =>
      !!(
        target &&
        (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable)
      );

    const isToolboxContext = (element) =>
      !!element?.closest?.('.blocklyToolboxDiv, .blocklyToolbox');
    const isFlyoutContext = (element) =>
      !!element?.closest?.('.blocklyFlyout, .blocklyFlyoutEntry');

    const normalizeLabel = (label) =>
      (label || '')
        .toLowerCase()
        .normalize('NFD')
        .replace(/\p{Diacritic}/gu, '')
        .trim();

    const getMatchableCategories = () =>
      (toolbox.getToolboxItems?.() || []).filter((item) => {
        const def = item.getToolboxItemDef?.() || item.toolboxItemDef || item.toolboxItemDef_;
        const kind = (def?.kind || '').toLowerCase();
        return kind === 'category';
      });

    const getParentCategory = (item) =>
      item?.getParent?.() || item?.parentToolboxItem_ || item?.parentItem_ || item?.parent_;

    const expandCategoryBranch = (item) => {
      const seen = new Set();
      let current = item;
      while (current && !seen.has(current)) {
        seen.add(current);
        if (typeof current.setExpanded === 'function') {
          current.setExpanded(true);
        }
        current = getParentCategory(current);
      }
    };

    const applyPrefixMatch = (prefix) => {
      if (!prefix) return false;
      const normalizedPrefix = normalizeLabel(prefix);
      if (!normalizedPrefix) return false;

      const match = getMatchableCategories().find((item) => {
        const label = item.getName?.() || item.getToolboxItemDef?.()?.name || '';
        return normalizeLabel(label).startsWith(normalizedPrefix);
      });
      if (!match) return false;

      const focusManager = Blockly.getFocusManager?.();
      const currentlySelected = toolbox.getSelectedItem?.();
      if (currentlySelected === match) {
        focusManager?.focusTree?.(toolbox);
        focusManager?.focusNode?.(match);
        return true;
      }

      expandCategoryBranch(match);
      toolbox.setSelectedItem?.(match);
      const selectedItem = toolbox.getSelectedItem?.();
      if (selectedItem !== match) return false;

      focusManager?.focusTree?.(toolbox);
      const isSelectable =
        typeof selectedItem.isSelectable === 'function' ? selectedItem.isSelectable() : true;
      if (isSelectable) {
        focusManager?.focusNode?.(selectedItem);
      } else {
        toolboxDiv.focus();
      }
      const selectedClickTarget = selectedItem.getClickTarget?.() || selectedItem.getDiv?.();
      selectedClickTarget?.scrollIntoView?.({
        block: 'nearest',
        inline: 'nearest',
      });
      if (focusManager?.getFocusedTree?.() !== toolbox) {
        focusManager?.focusTree?.(toolbox);
      }
      if (isSelectable && focusManager?.getFocusedNode?.() !== selectedItem) {
        const clickTarget = selectedItem.getClickTarget?.() || selectedItem.getDiv?.();
        clickTarget?.focus?.();
        focusManager?.focusTree?.(toolbox);
        focusManager?.focusNode?.(selectedItem);
      }

      return true;
    };

    // Ctrl+F should focus the toolbox search when focus is in the toolbox
    const getSearchToolboxItem = () =>
      (toolbox.getToolboxItems?.() || []).find((item) => {
        const def = item.getToolboxItemDef?.() || item.toolboxItemDef || item.toolboxItemDef_;
        const kind = (def?.kind || '').toLowerCase();
        return (
          kind === 'search' ||
          item.SEARCH_INPUT_ID === 'toolbox-search-input' ||
          item.searchField?.id === 'toolbox-search-input'
        );
      });

    const focusToolboxSearch = () => {
      const focusExistingInput = (searchItem) => {
        const searchInput =
          searchItem?.searchField instanceof HTMLInputElement
            ? searchItem.searchField
            : toolbox.HtmlDiv?.querySelector?.("input#toolbox-search-input, input[type='search']");

        if (!(searchInput instanceof HTMLInputElement)) return null;

        searchInput.scrollIntoView?.({ block: 'nearest', inline: 'nearest' });
        searchInput.focus();
        searchInput.select?.();
        return searchInput;
      };

      const searchItem = getSearchToolboxItem();
      if (!searchItem) return false;

      resetCategoryTypePrefix();
      toolbox.setSelectedItem?.(searchItem);
      const triggerMatchBlocks = (searchInput) => {
        if (!searchInput) return;
        searchInput.dispatchEvent(new Event('input', { bubbles: true }));
        searchItem.matchBlocks?.();
      };

      const focusedInput = focusExistingInput(searchItem);
      if (focusedInput) {
        triggerMatchBlocks(focusedInput);
        setTimeout(() => {
          triggerMatchBlocks(focusExistingInput(searchItem));
        }, 0);
        return true;
      }

      setTimeout(() => {
        triggerMatchBlocks(focusExistingInput(searchItem));
      }, 0);
      return true;
    };

    host.addEventListener(
      'keydown',
      (e) => {
        const isFindShortcut = (e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'f';
        if (!isFindShortcut) return;

        const activeElement = document.activeElement;
        const targetElement = e.target instanceof Element ? e.target : null;
        const inToolboxContext =
          isInToolboxOrFlyout(targetElement) || isInToolboxOrFlyout(activeElement);
        if (!inToolboxContext) return;

        stopEvent(e);
        focusToolboxSearch();
      },
      true
    );

    host.addEventListener(
      'focusin',
      (e) => {
        const target = e.target instanceof Element ? e.target : null;
        if (!target) return;

        if (target.matches?.("input[type='search'], input#toolbox-search-input")) {
          resetCategoryTypePrefix();
          return;
        }

        if (isFlyoutContext(target)) {
          resetCategoryTypePrefix();
          return;
        }

        if (!isToolboxContext(target)) {
          resetCategoryTypePrefix();
        }
      },
      true
    );

    host.addEventListener(
      'focusout',
      (e) => {
        const next = e.relatedTarget instanceof Element ? e.relatedTarget : null;
        if (!next || !isToolboxContext(next)) {
          resetCategoryTypePrefix();
        }
      },
      true
    );

    toolboxDiv.addEventListener(
      'click',
      () => {
        resetCategoryTypePrefix();
      },
      true
    );

    toolboxDiv.addEventListener(
      'keydown',
      (e) => {
        const target = e.target;

        const isFindShortcut = (e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'f';
        if (isFindShortcut) {
          const targetElement = target instanceof Element ? target : null;
          const activeElement = document.activeElement;
          const inToolboxContext =
            isInToolboxOrFlyout(targetElement) || isInToolboxOrFlyout(activeElement);

          if (inToolboxContext) {
            stopEvent(e);
            focusToolboxSearch();
            return;
          }
        }

        if (isEditableTarget(target)) {
          return;
        }

        if (e.key === 'Escape') {
          resetCategoryTypePrefix();
          return;
        }

        if (
          e.key === 'ArrowUp' ||
          e.key === 'ArrowDown' ||
          e.key === 'ArrowLeft' ||
          e.key === 'ArrowRight'
        ) {
          resetCategoryTypePrefix();
        }

        if (e.key === 'Backspace') {
          if (!categoryTypePrefix) return;
          categoryTypePrefix = categoryTypePrefix.slice(0, -1);
          if (!categoryTypePrefix) return;
          if (applyPrefixMatch(categoryTypePrefix)) {
            stopEvent(e);
          }
          return;
        }

        const isPrintableKey =
          e.key.length === 1 && e.key !== ' ' && !e.ctrlKey && !e.metaKey && !e.altKey;
        if (isPrintableKey) {
          stopEvent(e);

          const nextPrefix = `${categoryTypePrefix}${e.key}`;
          if (applyPrefixMatch(nextPrefix)) {
            categoryTypePrefix = nextPrefix;
          } else if (applyPrefixMatch(e.key)) {
            categoryTypePrefix = e.key;
          }
          if (!isInToolboxOrFlyout(document.activeElement)) {
            toolboxDiv.focus();
            Blockly.getFocusManager?.()?.focusTree?.(toolbox);
          }
          return;
        }

        const flyout = toolbox.getFlyout?.();
        const flyoutVisible = !!flyout && !!flyout.isVisible?.();

        if (e.key === 'ArrowRight' && flyoutVisible) {
          resetCategoryTypePrefix();
          stopEvent(e);
          const flyoutWorkspace = flyout.getWorkspace?.();
          if (flyoutWorkspace) {
            Blockly.getFocusManager().focusTree(flyoutWorkspace);
          }
          return;
        }

        if (e.key === 'Enter' || e.key === ' ' || e.key === 'Spacebar') {
          resetCategoryTypePrefix();
          const selectedItem = toolbox.getSelectedItem?.();
          if (selectedItem && typeof selectedItem.toggleExpanded === 'function') {
            stopEvent(e);
            selectedItem.toggleExpanded();
          }
        }
      },
      true
    );
  })();

  initializeIfClauseConnectionChecker(workspace);

  (function wireToolboxSearchArrowDown() {
    const host = workspace.getInjectionDiv?.() || document;
    if (!host) {
      return;
    }

    host.addEventListener(
      'keydown',
      (e) => {
        const t = e.target;
        if (!t || t.tagName !== 'INPUT') return;
        if (t.type !== 'search') return;

        if (e.key === 'Enter') {
          const flyout = toolbox.getFlyout?.();
          const flyoutVisible = !!flyout && !!flyout.isVisible?.();
          const flyoutWorkspace = flyout?.getWorkspace?.();
          const firstResult = flyoutWorkspace?.getTopBlocks?.(false)?.[0];

          if (flyoutVisible && firstResult) {
            e.preventDefault();
            e.stopPropagation();
            e.stopImmediatePropagation();
            Blockly.getFocusManager().focusTree(flyoutWorkspace);
            flyoutWorkspace.getCursor?.()?.setCurNode?.(firstResult);
          }
          return;
        }

        if (e.key !== 'ArrowDown') return;

        e.preventDefault();
        e.stopPropagation();
        e.stopImmediatePropagation();

        const toolboxDiv =
          document.querySelector('.blocklyToolbox') ||
          host.querySelector('.blocklyToolbox') ||
          t.closest('.blocklyToolbox');

        if (toolboxDiv) {
          t.blur();
          toolboxDiv.focus();

          setTimeout(() => {
            const arrowEvent = new KeyboardEvent('keydown', {
              key: 'ArrowDown',
              keyCode: 40,
              code: 'ArrowDown',
              bubbles: true,
              cancelable: true,
            });
            toolboxDiv.dispatchEvent(arrowEvent);
          }, 10);
        }
      },
      true
    );
  })();

  (function simpleNoBumpTranslate() {
    const ws = Blockly.getMainWorkspace();
    const original = ws.translate.bind(ws);
    ws.translate = function (requestedX, newY) {
      const tb = this.getToolbox?.();
      const fo = this.getFlyout?.();
      const mm = this.getMetricsManager?.();
      const tbW =
        (tb && tb.getWidth?.()) ??
        (mm && mm.getAbsoluteMetrics ? mm.getAbsoluteMetrics().left : 0) ??
        0;
      let x = requestedX;
      if (fo && fo.isVisible?.()) {
        const foW = fo.getWidth?.() || 0;
        // Ignore stale flyout widths - a real flyout will be wider than a collapsed/empty one
        if (foW > 50) {
          const EPS = 1;
          if (x >= tbW + foW - EPS) {
            x -= foW;
          } else if (x - this.scrollX >= foW - EPS) {
            x -= foW;
          }
        }
      }
      return original(x, newY);
    };
  })();

  // ------- Pointer tracking for "paste at pointer" -------
  const mainWs = Blockly.getMainWorkspace();
  let lastCM = { x: 0, y: 0 };
  (mainWs.getInjectionDiv() || document).addEventListener(
    'contextmenu',
    (e) => {
      lastCM = { x: e.clientX, y: e.clientY };
    },
    { capture: true }
  );

  // Screen -> workspace coords
  function screenToWs(ws, xy) {
    const c = new Blockly.utils.Coordinate(xy.x, xy.y);
    return Blockly.utils.svgMath.screenToWsCoordinates(ws, c);
  }

  // Add a context menu item that mirrors the keyboard-navigation "detach" (X) shortcut.
  (function registerDetachContextMenuItem() {
    const registry = Blockly.ContextMenuRegistry.registry;
    const id = 'detachBlockWithShortcut';
    if (registry.getItem && registry.getItem(id)) return;

    function renderShortcut(label, shortcut) {
      const wrapper = document.createElement('span');
      wrapper.style.display = 'flex';
      wrapper.style.alignItems = 'center';
      wrapper.style.justifyContent = 'space-between';
      wrapper.style.gap = '1.5em';
      wrapper.style.width = '100%';

      const labelEl = document.createElement('span');
      labelEl.textContent = label;

      const shortcutEl = document.createElement('span');
      shortcutEl.textContent = shortcut;
      shortcutEl.style.color = 'var(--blockly-text-disabled, #aaa)';

      wrapper.append(labelEl, shortcutEl);
      return wrapper;
    }

    registry.register({
      id,
      weight: 80,
      displayText: () => {
        const text = translate('detach_block_option');
        const label = text === 'detach_block_option' ? 'Detach' : text;
        return renderShortcut(label, 'X');
      },
      preconditionFn: (scope) => {
        const block = scope.block;
        if (!block || block.isInFlyout) return 'hidden';

        const hasParent =
          !!block.getParent() ||
          !!block.previousConnection?.targetConnection ||
          !!block.outputConnection?.targetConnection;
        return hasParent ? 'enabled' : 'disabled';
      },
      callback: (scope) => {
        const block = scope.block;
        if (!block) return;

        const healStack = !block.outputConnection?.isConnected();
        const prevGroup = Blockly.Events.getGroup();
        Blockly.Events.setGroup('contextmenu_detach');
        block.unplug(healStack);
        const cursor = block.workspace?.getCursor?.();
        if (cursor?.setCurNode) cursor.setCurNode(block);
        Blockly.Events.setGroup(prevGroup || null);
      },
      scopeType: Blockly.ContextMenuRegistry.ScopeType.BLOCK,
    });
  })();

  // Add a context menu item to focus the canvas camera on a block's mesh.
  (function registerViewInCanvasContextMenuItem() {
    const registry = Blockly.ContextMenuRegistry.registry;
    const id = 'viewBlockInCanvas';
    if (registry.getItem && registry.getItem(id)) return;

    function renderShortcut(label, shortcut) {
      const wrapper = document.createElement('span');
      wrapper.style.cssText =
        'display:flex;align-items:center;justify-content:space-between;gap:1.5em;width:100%';
      const labelEl = document.createElement('span');
      labelEl.textContent = label;
      const shortcutEl = document.createElement('span');
      shortcutEl.textContent = shortcut;
      shortcutEl.style.color = 'var(--blockly-text-disabled, #aaa)';
      wrapper.append(labelEl, shortcutEl);
      return wrapper;
    }

    registry.register({
      id,
      weight: 8,
      displayText: () => {
        const text = translate('view_in_canvas_option');
        const label = text === 'view_in_canvas_option' ? 'View in canvas' : text;
        return renderShortcut(label, 'V');
      },
      preconditionFn: (scope) => {
        const block = scope.block;
        if (!block || block.isInFlyout) return 'hidden';
        try {
          const mesh = getMeshFromBlock(block);
          return mesh && mesh.name !== 'ground' ? 'enabled' : 'hidden';
        } catch {
          return 'hidden';
        }
      },
      callback: (scope) => {
        const block = scope.block;
        if (!block) return;
        Promise.all([import('./view.js'), import('../ui/gizmos.js')]).then(
          ([{ showCanvasView }, { viewMeshWithCamera }]) => {
            showCanvasView();
            window.currentBlock = block;
            viewMeshWithCamera(block);
          }
        );
      },
      scopeType: Blockly.ContextMenuRegistry.ScopeType.BLOCK,
    });
  })();

  // Reorder block context menu items for better grouping.
  // Cut/copy/paste are registered at weights 1/2/3; push everything else above that.
  (function adjustBlockContextMenuWeights() {
    const registry = Blockly.ContextMenuRegistry.registry;

    const weights = {
      blockDuplicate: 9,
      detachBlockWithShortcut: 10,
      viewBlockInCanvas: 10.5,
      blockComment: 12,
      blockInline: 13,
      blockCollapseExpand: 14,
      blockDisable: 15,
      blockDelete: 20,
      blockHelp: 999,
    };
    for (const [id, weight] of Object.entries(weights)) {
      const item = registry.getItem?.(id);
      if (item) item.weight = weight;
    }
  })();

  // Remove undo/redo (toolbar buttons cover this) and clean up (flock does this automatically).
  // Also remove the separate collapse/expand workspace items — replaced by a single toggle below.
  (function removeRedundantContextMenuItems() {
    const registry = Blockly.ContextMenuRegistry.registry;
    [
      'undoWorkspace',
      'redoWorkspace',
      'cleanWorkspace',
      'collapseWorkspace',
      'expandWorkspace',
    ].forEach((id) => {
      try {
        registry.unregister(id);
      } catch (_) {}
    });
  })();

  // Replace separate "Collapse all" / "Expand all" workspace items with a single toggle.
  (function registerCollapseExpandWorkspaceToggle() {
    const registry = Blockly.ContextMenuRegistry.registry;
    const WORKSPACE = Blockly.ContextMenuRegistry.ScopeType.WORKSPACE;
    if (registry.getItem?.('flockCollapseExpandWorkspace')) return;

    const hasAnyExpanded = (ws) => {
      for (const block of ws.getTopBlocks(false)) {
        let b = block;
        while (b) {
          if (!b.isCollapsed()) return true;
          b = b.getNextBlock();
        }
      }
      return false;
    };

    registry.register({
      id: 'flockCollapseExpandWorkspace',
      weight: 4,
      scopeType: WORKSPACE,
      displayText: (scope) =>
        hasAnyExpanded(scope.workspace)
          ? translate('context_collapse_all_option')
          : translate('context_expand_all_option'),
      preconditionFn: (scope) => {
        if (!scope.workspace?.options?.collapse) return 'hidden';
        return scope.workspace.getTopBlocks(false).length ? 'enabled' : 'hidden';
      },
      callback: (scope) => {
        const ws = scope.workspace;
        const shouldCollapse = hasAnyExpanded(ws);
        Blockly.Events.setGroup(true);
        for (const block of ws.getTopBlocks(true)) {
          let b = block;
          while (b) {
            b.setCollapsed(shouldCollapse);
            b = b.getNextBlock();
          }
        }
        Blockly.Events.setGroup(false);
      },
    });
  })();

  // Rename built-in workspace "Delete" item to the localized "Delete all blocks" label.
  (function renameWorkspaceDeleteMenuItem() {
    const item = Blockly.ContextMenuRegistry.registry.getItem?.('workspaceDelete');
    if (item) item.displayText = () => translate('context_delete_all_blocks_option');
  })();

  // Add "Find in workspace" to the workspace context menu.
  (function registerWorkspaceSearchContextMenuItem() {
    const registry = Blockly.ContextMenuRegistry.registry;
    const id = 'workspaceFindInWorkspace';
    if (registry.getItem?.(id)) return;
    registry.register({
      id,
      weight: 50,
      displayText: () => translate('workspace_search_placeholder'),
      preconditionFn: () => 'enabled',
      callback: () => window.flockWorkspaceSearch?.open(),
      scopeType: Blockly.ContextMenuRegistry.ScopeType.WORKSPACE,
    });
  })();

  // Register cut/copy/paste at the top of the block context menu (weights 1/2/3).
  (function registerClipboardContextMenuItems() {
    const registry = Blockly.ContextMenuRegistry.registry;
    const BLOCK = Blockly.ContextMenuRegistry.ScopeType.BLOCK;

    const notInFlyout = (scope) => (scope.block?.isInFlyout ? 'hidden' : 'enabled');
    const hasCopiedData = () => !!Blockly.clipboard?.getLastCopiedData?.();

    registry.register({
      id: 'blockCut',
      weight: 1,
      displayText: () => Blockly.Msg['CUT_SHORTCUT'] || 'Cut',
      preconditionFn: notInFlyout,
      callback: (scope) => {
        const block = scope.block;
        if (!block) return;
        copyWithoutToast(block);
        Blockly.Events.setGroup('contextmenu_cut');
        block.dispose(true);
        Blockly.Events.setGroup(false);
      },
      scopeType: BLOCK,
    });

    registry.register({
      id: 'blockCopy',
      weight: 2,
      displayText: () => Blockly.Msg['COPY_SHORTCUT'] || 'Copy',
      preconditionFn: notInFlyout,
      callback: (scope) => {
        const block = scope.block;
        if (block) copyWithoutToast(block);
      },
      scopeType: BLOCK,
    });

    registry.register({
      id: 'blockPaste',
      weight: 3,
      displayText: () => Blockly.Msg['PASTE_SHORTCUT'] || 'Paste',
      preconditionFn: (scope) => {
        if (scope.block?.isInFlyout) return 'hidden';
        return hasCopiedData() ? 'enabled' : 'disabled';
      },
      callback: (scope) => {
        const data = Blockly.clipboard?.getLastCopiedData?.();
        if (!data) return;
        const ws = scope?.block?.workspace ?? mainWs;
        if (!ws) return;
        const selected = Blockly.common?.getSelected?.() || null;
        if (selected && selected.isInFlyout) return;
        pasteAsChildOrHere(selected || null, ws, data);
      },
      scopeType: BLOCK,
    });
  })();

  // Add separators to the block context menu to group related items.
  // Weights: clipboard(1-3) | 5 | block-ops(9-10) | 10.5 | comment(11-14) | 18 | delete(20) | 50 | export(100-200) | 500 | help(999)
  (function registerBlockContextMenuSeparators() {
    const registry = Blockly.ContextMenuRegistry.registry;
    const BLOCK = Blockly.ContextMenuRegistry.ScopeType.BLOCK;
    const separators = [
      { id: 'flock_sep_after_clipboard', weight: 5 },
      { id: 'flock_sep_before_comment', weight: 10.5 },
      { id: 'flock_sep_before_delete', weight: 18 },
      { id: 'flock_sep_before_export', weight: 50 },
      { id: 'flock_sep_before_help', weight: 500 },
    ];
    for (const { id, weight } of separators) {
      if (!registry.getItem?.(id)) {
        registry.register({ id, weight, separator: true, scopeType: BLOCK });
      }
    }
  })();

  // ===== OVERRIDE CLIPBOARD METHODS =====
  const origCopy = Blockly.clipboard.copy;
  const origToastShow = Blockly.Toast?.show;

  Blockly.clipboard.copy = function (block) {
    origCopy.call(Blockly.clipboard, block);

    if (block?.isInFlyout) {
      const tb = Blockly.getMainWorkspace()?.getToolbox?.();
      tb?.getFlyout?.()?.hide?.();
      tb?.getSelectedItem?.()?.setSelected?.(false);
    }
  };

  // Assuming Blockly 13 has removed toasts, this is not needed
  function copyWithoutToast(block) {
    if (!block) return;
    if (Blockly.Toast?.show) Blockly.Toast.show = () => {};
    try {
      Blockly.clipboard.copy.call(Blockly.clipboard, block);
    } finally {
      if (Blockly.Toast?.show) Blockly.Toast.show = origToastShow;
    }
  }

  function overrideContextMenuCopyItem() {
    const ids = [
      'blockCopyToStorage', // Blockly core (common)
      'blockCopyFromContextMenu', // possible variant
    ];

    let item = null;
    for (const id of ids) {
      item = Blockly.ContextMenuRegistry.registry.getItem(id);
      if (item) break;
    }
    if (!item) return false;

    const original = item.callback;

    item.callback = function (scope, menuOpenEvent, location) {
      const block = scope?.block;
      if (block) {
        copyWithoutToast(block);
        return;
      }
      return original?.call(this, scope, menuOpenEvent, location);
    };

    return true;
  }

  (function installCopyOverrideWithRetry(maxAttempts = 20, delayMs = 50) {
    let attempts = 0;
    const t = setInterval(() => {
      attempts++;
      if (overrideContextMenuCopyItem() || attempts >= maxAttempts) {
        clearInterval(t);
      }
    }, delayMs);
  })();

  function isTypingInInput() {
    const el = document.activeElement;
    if (!el) return false;
    const tag = el.tagName?.toLowerCase();
    return tag === 'input' || tag === 'textarea' || !!el.isContentEditable;
  }

  const host = mainWs.getInjectionDiv() || document;
  let __fcLastPointer = { x: 0, y: 0 };
  let __fcLastPointerType = 'mouse'; // 'mouse' | 'touch' | 'pen'
  let __fcMenuPoint = null;
  let __fcMenuPointerType = 'mouse';

  host.addEventListener(
    'pointerdown',
    (e) => {
      if (!e.isPrimary) return;
      __fcLastPointer = { x: e.clientX, y: e.clientY };
      __fcLastPointerType = e.pointerType || 'mouse';
    },
    { capture: true }
  );

  host.addEventListener(
    'pointermove',
    (e) => {
      if (!e.isPrimary) return;
      __fcLastPointer = { x: e.clientX, y: e.clientY };
      __fcLastPointerType = e.pointerType || __fcLastPointerType;
    },
    { capture: true }
  );

  // Capture the *actual* coordinates that opened the context menu (works for long-press)
  const __origShow = Blockly.ContextMenu.show;
  Blockly.ContextMenu.show = function (e, options, rtl) {
    __fcMenuPoint = { x: e.clientX, y: e.clientY };
    __fcMenuPointerType = e.pointerType || __fcLastPointerType || 'mouse';
    return __origShow.call(Blockly.ContextMenu, e, options, rtl);
  };
  host.addEventListener(
    'contextmenu',
    (e) => {
      lastCM = { x: e.clientX, y: e.clientY };
    },
    { capture: true }
  );
  host.addEventListener(
    'mousemove',
    (e) => {
      lastCM = { x: e.clientX, y: e.clientY };
    },
    { capture: true }
  );

  function pasteAsChildOrHere(targetBlock /* may be null */, ws, data) {
    if (!data) return;
    const at = screenToWs(ws, lastCM);
    const pasted = Blockly.clipboard.paste(data, ws, at);
    const pb = /** @type {Blockly.BlockSvg} */ (pasted);
    if (!targetBlock) return;

    const checker = ws.getConnectionChecker
      ? ws.getConnectionChecker()
      : new Blockly.ConnectionChecker();
    const can = (a, b) => checker.canConnect(a, b, /*isDragging=*/ false);

    // 1) stack after: target.next ⟷ pb.previous
    if (
      targetBlock.nextConnection &&
      pb.previousConnection &&
      can(targetBlock.nextConnection, pb.previousConnection)
    ) {
      targetBlock.nextConnection.connect(pb.previousConnection);
      return;
    }
    // 2) empty statement input ⟷ pb.previous
    for (const input of targetBlock.inputList) {
      if (
        input.type === Blockly.NEXT_STATEMENT &&
        input.connection &&
        !input.connection.targetBlock() &&
        pb.previousConnection &&
        can(input.connection, pb.previousConnection)
      ) {
        input.connection.connect(pb.previousConnection);
        return;
      }
    }
    // 2b) top-level block: insert pb as first child in statement input,
    //     pushing existing children after pb
    const isTopLevel = !targetBlock.previousConnection && !targetBlock.nextConnection;
    if (isTopLevel && pb.previousConnection) {
      for (const input of targetBlock.inputList) {
        if (
          input.type === Blockly.NEXT_STATEMENT &&
          input.connection &&
          input.connection.targetBlock() &&
          can(input.connection, pb.previousConnection)
        ) {
          const firstChild = input.connection.targetBlock();
          input.connection.disconnect();
          input.connection.connect(pb.previousConnection);
          // Append previous first child after pb chain
          let lastPb = pb;
          while (lastPb.nextConnection && lastPb.nextConnection.targetBlock()) {
            lastPb = lastPb.nextConnection.targetBlock();
          }
          if (
            lastPb.nextConnection &&
            firstChild.previousConnection &&
            can(lastPb.nextConnection, firstChild.previousConnection)
          ) {
            lastPb.nextConnection.connect(firstChild.previousConnection);
          }
          return;
        }
      }
    }
    // 3) empty value input ⟷ pb.output
    for (const input of targetBlock.inputList) {
      if (
        input.type === Blockly.INPUT_VALUE &&
        input.connection &&
        !input.connection.targetBlock() &&
        pb.outputConnection &&
        can(input.connection, pb.outputConnection)
      ) {
        input.connection.connect(pb.outputConnection);
        return;
      }
    }
    // 4) insert above: target.previous ⟷ pb.next
    if (
      targetBlock.previousConnection &&
      pb.nextConnection &&
      can(targetBlock.previousConnection, pb.nextConnection)
    ) {
      targetBlock.previousConnection.connect(pb.nextConnection);
      return;
    }
    // else: stays at pointer
  }

  // ---- Bind Ctrl/Cmd+V ----
  host.addEventListener(
    'keydown',
    (e) => {
      if (!(e.ctrlKey || e.metaKey)) return;
      if ((e.key || '').toLowerCase() !== 'v') return;
      if (isTypingInInput()) return;

      const data = Blockly.clipboard?.getLastCopiedData?.();
      if (!data) return;

      // Selected block (if any, and not from flyout)
      const selected = Blockly.common?.getSelected?.() || null;
      if (selected && selected.isInFlyout) return; // never paste in the flyout

      e.preventDefault();
      e.stopPropagation();
      pasteAsChildOrHere(selected || null, mainWs, data);
    },
    { capture: true }
  );

  // ---- Touch-friendly confirm dialog ----
  if (navigator.maxTouchPoints > 0) {
    Blockly.dialog.setConfirm((message, callback) => {
      const overlay = document.createElement('div');
      overlay.className = 'fc-confirm-overlay';

      const dialog = document.createElement('div');
      dialog.className = 'fc-confirm-dialog';
      dialog.setAttribute('role', 'alertdialog');
      dialog.setAttribute('aria-modal', 'true');

      const msg = document.createElement('p');
      msg.className = 'fc-confirm-message';
      msg.textContent = message;

      const btnRow = document.createElement('div');
      btnRow.className = 'fc-confirm-buttons';

      // Icons: Font Awesome Free 6.7.2 by @fontawesome - https://fontawesome.com
      // License: https://fontawesome.com/license/free  Copyright 2025 Fonticons, Inc.
      const cancelBtn = document.createElement('button');
      cancelBtn.type = 'button';
      cancelBtn.className = 'fc-confirm-btn fc-confirm-btn--cancel';
      cancelBtn.setAttribute('aria-label', translate('cancel') || 'Cancel');
      cancelBtn.innerHTML =
        '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 384 512" width="24" height="24" fill="currentColor"><path d="M342.6 150.6c12.5-12.5 12.5-32.8 0-45.3s-32.8-12.5-45.3 0L192 210.7 86.6 105.4c-12.5-12.5-32.8-12.5-45.3 0s-12.5 32.8 0 45.3L146.7 256 41.4 361.4c-12.5 12.5-12.5 32.8 0 45.3s32.8 12.5 45.3 0L192 301.3 297.4 406.6c12.5 12.5 32.8 12.5 45.3 0s12.5-32.8 0-45.3L237.3 256 342.6 150.6z"/></svg>';

      const okBtn = document.createElement('button');
      okBtn.type = 'button';
      okBtn.className = 'fc-confirm-btn fc-confirm-btn--ok';
      okBtn.setAttribute('aria-label', Blockly.Msg['DIALOG_OK'] || 'OK');
      okBtn.innerHTML =
        '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 448 512" width="24" height="24" fill="currentColor"><path d="M438.6 105.4c12.5 12.5 12.5 32.8 0 45.3l-256 256c-12.5 12.5-32.8 12.5-45.3 0l-128-128c-12.5-12.5-12.5-32.8 0-45.3s32.8-12.5 45.3 0L160 338.7 393.4 105.4c12.5-12.5 32.8-12.5 45.3 0z"/></svg>';

      const close = (result) => {
        overlay.remove();
        callback(result);
      };

      cancelBtn.addEventListener('pointerdown', () => close(false));
      okBtn.addEventListener('pointerdown', () => close(true));
      overlay.addEventListener('pointerdown', (e) => {
        if (e.target === overlay) close(false);
      });

      btnRow.append(cancelBtn, okBtn);
      dialog.append(msg, btnRow);
      overlay.append(dialog);
      document.body.appendChild(overlay);
    });
  }

  // ---- Tablet floating block toolbar ----
  if (navigator.maxTouchPoints > 0) {
    const blockToolbar = document.createElement('div');
    blockToolbar.className = 'fc-block-toolbar';
    blockToolbar.setAttribute('role', 'toolbar');
    document.body.appendChild(blockToolbar);

    const mkFaSvg = (path, vw = '0 0 448 512') =>
      `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${vw}" width="20" height="20" fill="currentColor">${path}</svg>`;

    const duplicateBtn = document.createElement('button');
    duplicateBtn.type = 'button';
    duplicateBtn.className = 'fc-block-toolbar-btn';
    duplicateBtn.setAttribute('aria-label', translate('duplicate_button') || 'Duplicate');
    duplicateBtn.innerHTML = mkFaSvg(
      '<path d="M208 0L332.1 0c12.7 0 24.9 5.1 33.9 14.1l67.9 67.9c9 9 14.1 21.2 14.1 33.9L448 336c0 26.5-21.5 48-48 48l-192 0c-26.5 0-48-21.5-48-48l0-288c0-26.5 21.5-48 48-48zM48 128l80 0 0 64-64 0 0 256 192 0 0-32 64 0 0 48c0 26.5-21.5 48-48 48L48 512c-26.5 0-48-21.5-48-48L0 176c0-26.5 21.5-48 48-48z"/>'
    );

    const deleteBtn = document.createElement('button');
    deleteBtn.type = 'button';
    deleteBtn.className = 'fc-block-toolbar-btn fc-block-toolbar-btn--delete';
    deleteBtn.setAttribute('aria-label', 'Delete');
    deleteBtn.innerHTML = mkFaSvg(
      '<path d="M135.2 17.7L128 32 32 32C14.3 32 0 46.3 0 64S14.3 96 32 96l384 0c17.7 0 32-14.3 32-32s-14.3-32-32-32l-96 0-7.2-14.3C307.4 6.8 296.3 0 284.2 0L163.8 0c-12.1 0-23.2 6.8-28.6 17.7zM416 128L32 128 53.2 467c1.6 25.3 22.6 45 47.9 45l245.8 0c25.3 0 46.3-19.7 47.9-45L416 128z"/>'
    );

    const detachBtn = document.createElement('button');
    detachBtn.type = 'button';
    detachBtn.className = 'fc-block-toolbar-btn';
    detachBtn.setAttribute('aria-label', translate('detach_block_option') || 'Detach');
    detachBtn.innerHTML = mkFaSvg(
      '<path d="M38.8 5.1C28.4-3.1 13.3-1.2 5.1 9.2S-1.2 34.7 9.2 42.9l592 464c10.4 8.2 25.5 6.3 33.7-4.1s6.3-25.5-4.1-33.7L489.3 358.2l90.5-90.5c56.5-56.5 56.5-148 0-204.5c-50-50-128.8-56.5-186.3-15.4l-1.6 1.1c-14.4 10.3-17.7 30.3-7.4 44.6s30.3 17.7 44.6 7.4l1.6-1.1c32.1-22.9 76-19.3 103.8 8.6c31.5 31.5 31.5 82.5 0 114l-96 96-31.9-25C430.9 239.6 420.1 175.1 377 132c-52.2-52.3-134.5-56.2-191.3-11.7L38.8 5.1zM239 162c30.1-14.9 67.7-9.9 92.8 15.3c20 20 27.5 48.3 21.7 74.5L239 162zM406.6 416.4L220.9 270c-2.1 39.8 12.2 80.1 42.2 110c38.9 38.9 94.4 51 143.6 36.3zm-290-228.5L60.2 244.3c-56.5 56.5-56.5 148 0 204.5c50 50 128.8 56.5 186.3 15.4l1.6-1.1c14.4-10.3 17.7-30.3 7.4-44.6s-30.3-17.7-44.6-7.4l-1.6 1.1c-32.1 22.9-76 19.3-103.8-8.6C74 372 74 321 105.5 289.5l61.8-61.8-50.6-39.9z"/>',
      '0 0 640 512'
    );

    const commentBtn = document.createElement('button');
    commentBtn.type = 'button';
    commentBtn.className = 'fc-block-toolbar-btn';
    commentBtn.setAttribute('aria-label', 'Add comment');
    const commentAddSvg = mkFaSvg(
      '<path d="M256 448c141.4 0 256-93.1 256-208S397.4 32 256 32S0 125.1 0 240c0 49.6 21.4 95 57 130.7C44.5 421.1 2.7 466 2.2 466.5c-2.2 2.4-2.8 5.7-1.5 8.7S4.8 480 8 480c66.3 0 116-31.8 140.6-51.4C169.2 433.6 212.3 448 256 448z"/>',
      '0 0 512 512'
    );
    const commentDeleteSvg = mkFaSvg(
      '<path d="M38.8 5.1C28.4-3.1 13.3-1.2 5.1 9.2S-1.2 34.7 9.2 42.9l592 464c10.4 8.2 25.5 6.3 33.7-4.1s6.3-25.5-4.1-33.7L512.9 376.7C552.2 340.2 576 292.3 576 240C576 125.1 461.4 32 320 32c-67.7 0-129.3 21.4-175.1 56.3L38.8 5.1zm385.2 425L82.9 161.3C70.7 185.6 64 212.2 64 240c0 45.1 17.7 86.8 47.7 120.9c-1.9 24.5-11.4 46.3-21.4 62.9c-5.5 9.2-11.1 16.6-15.2 21.6c-2.1 2.5-3.7 4.4-4.9 5.7c-.6 .6-1 1.1-1.3 1.4l-.3 .3c0 0 0 0 0 0c0 0 0 0 0 0s0 0 0 0s0 0 0 0c-4.6 4.6-5.9 11.4-3.4 17.4c2.5 6 8.3 9.9 14.8 9.9c28.7 0 57.6-8.9 81.6-19.3c22.9-10 42.4-21.9 54.3-30.6c31.8 11.5 67 17.9 104.1 17.9c37 0 72.3-6.4 104.1-17.9z"/>',
      '0 0 640 512'
    );
    commentBtn.innerHTML = commentAddSvg;

    const viewBtn = document.createElement('button');
    viewBtn.type = 'button';
    viewBtn.className = 'fc-block-toolbar-btn';
    viewBtn.setAttribute('aria-label', 'View in canvas');
    viewBtn.innerHTML = mkFaSvg(
      '<path d="M288 32c-80.8 0-145.5 36.8-192.6 80.6C48.6 156 17.3 208 2.5 243.7c-3.3 7.9-3.3 16.7 0 24.6C17.3 304 48.6 356 95.4 399.4C142.5 443.2 207.2 480 288 480s145.5-36.8 192.6-80.6c46.8-43.5 78.1-95.4 93-131.1c3.3-7.9 3.3-16.7 0-24.6c-14.9-35.7-46.2-87.7-93-131.1C433.5 68.8 368.8 32 288 32zM144 256a144 144 0 1 1 288 0 144 144 0 1 1 -288 0zm144-64c0 35.3-28.7 64-64 64c-7.1 0-13.9-1.2-20.3-3.3c-5.5-1.8-11.9 1.6-11.7 7.4c.3 6.9 1.3 13.8 3.2 20.7c13.7 51.2 66.4 81.6 117.6 67.9s81.6-66.4 67.9-117.6c-11.1-41.5-47.8-69.4-88.6-71.1c-5.8-.2-9.2 6.1-7.4 11.7c2.1 6.4 3.3 13.2 3.3 20.3z"/>',
      '0 0 576 512'
    );

    blockToolbar.append(duplicateBtn, detachBtn, commentBtn, viewBtn, deleteBtn);

    let toolbarBlock = null;
    let toolbarShowTimer = null;

    const isDetachable = (block) =>
      !!block?.getParent() ||
      !!block?.previousConnection?.targetConnection ||
      !!block?.outputConnection?.targetConnection;

    function positionBlockToolbar() {
      if (!toolbarBlock) return;
      const svgRoot = toolbarBlock.getSvgRoot?.();
      if (!svgRoot) return;
      const rect = svgRoot.getBoundingClientRect();
      const blockCenterX = Math.round(rect.left + rect.width / 2);
      blockToolbar.style.left = `${blockCenterX}px`;
      blockToolbar.style.top = `${Math.round(rect.top)}px`;
      blockToolbar.style.removeProperty('--caret-shift');

      // Clamp to viewport; shift caret opposite so it still points at the block
      const margin = 8;
      const tbRect = blockToolbar.getBoundingClientRect();
      let adj = 0;
      if (tbRect.left < margin) adj = margin - tbRect.left;
      else if (tbRect.right > window.innerWidth - margin) adj = window.innerWidth - margin - tbRect.right;
      if (adj !== 0) {
        blockToolbar.style.left = `${blockCenterX + adj}px`;
        blockToolbar.style.setProperty('--caret-shift', `${-adj}px`);
      }
    }

    function showBlockToolbar(block) {
      toolbarBlock = block;
      detachBtn.disabled = !isDetachable(block);
      const hasComment = block.getCommentText() !== null;
      commentBtn.setAttribute('aria-label', hasComment ? 'Delete comment' : 'Add comment');
      commentBtn.innerHTML = hasComment ? commentDeleteSvg : commentAddSvg;
      let mesh = null;
      try {
        mesh = getMeshFromBlock(block);
      } catch {
        /* scene not ready */
      }
      viewBtn.style.display = (!mesh || mesh.name === 'ground') ? 'none' : '';
      positionBlockToolbar();
      blockToolbar.classList.add('visible');
    }

    function hideBlockToolbar() {
      clearTimeout(toolbarShowTimer);
      toolbarShowTimer = null;
      toolbarBlock = null;
      blockToolbar.classList.remove('visible');
    }

    const isToolbarBlock = (block) =>
      block && !block.isInFlyout && !block.isShadow();

    workspace.addChangeListener((e) => {
      if (e.type === Blockly.Events.SELECTED) {
        clearTimeout(toolbarShowTimer);
        toolbarShowTimer = null;
        if (e.newElementId) {
          const block = workspace.getBlockById(e.newElementId);
          if (isToolbarBlock(block)) {
            toolbarShowTimer = setTimeout(() => showBlockToolbar(block), 400);
          } else {
            hideBlockToolbar();
          }
        } else {
          hideBlockToolbar();
        }
      } else if (
        (e.type === Blockly.Events.BLOCK_MOVE || e.type === Blockly.Events.VIEWPORT_CHANGE) &&
        toolbarBlock
      ) {
        positionBlockToolbar();
      } else if (e.type === Blockly.Events.BLOCK_DRAG && e.isStart) {
        hideBlockToolbar();
      }
    });

    duplicateBtn.addEventListener('pointerdown', (e) => {
      e.preventDefault();
      e.stopPropagation();
      if (!toolbarBlock) return;
      const block = toolbarBlock;
      Blockly.Events.setGroup('toolbar_duplicate');
      const json = Blockly.serialization.blocks.save(block, { includeShadows: true });
      delete json.next;
      const copy = Blockly.serialization.blocks.append(json, workspace);
      const orig = block.getRelativeToSurfaceXY();
      copy.moveTo(new Blockly.utils.Coordinate(orig.x + 30, orig.y + 30));
      Blockly.Events.setGroup(false);
    });

    detachBtn.addEventListener('pointerdown', (e) => {
      e.preventDefault();
      e.stopPropagation();
      if (!toolbarBlock || !isDetachable(toolbarBlock)) return;
      const block = toolbarBlock;
      const healStack = !block.outputConnection?.isConnected();
      Blockly.Events.setGroup('toolbar_detach');
      block.unplug(healStack);
      Blockly.Events.setGroup(false);
    });

    commentBtn.addEventListener('pointerdown', (e) => {
      e.preventDefault();
      e.stopPropagation();
      if (!toolbarBlock) return;
      const block = toolbarBlock;
      if (block.getCommentText() !== null) {
        block.setCommentText(null);
      } else {
        block.setCommentText('');
        const icon = block.getIcons?.().find((i) => typeof i.setBubbleVisible === 'function');
        icon?.setBubbleVisible(true);
      }
      hideBlockToolbar();
    });

    viewBtn.addEventListener('pointerdown', async (e) => {
      e.preventDefault();
      e.stopPropagation();
      if (!toolbarBlock || viewBtn.style.display === 'none') return;
      const block = toolbarBlock;
      hideBlockToolbar();
      const [{ showCanvasView }, { viewMeshWithCamera }] = await Promise.all([
        import('./view.js'),
        import('../ui/gizmos.js'),
      ]);
      showCanvasView();
      window.currentBlock = block;
      viewMeshWithCamera(block);
    });

    deleteBtn.addEventListener('pointerdown', (e) => {
      e.preventDefault();
      e.stopPropagation();
      if (!toolbarBlock) return;
      const block = toolbarBlock;
      // Count only blocks that will actually be deleted: the block + its input
      // descendants, but NOT the top-level next chain (which gets healed, not deleted).
      const countDeleted = (b, followNext) => {
        if (!b || b.isShadow()) return 0;
        let n = 1;
        for (const input of b.inputList) {
          n += countDeleted(input.connection?.targetBlock(), true);
        }
        if (followNext) n += countDeleted(b.nextConnection?.targetBlock(), true);
        return n;
      };
      const count = countDeleted(block, false);
      if (count > 1) {
        const msg = (Blockly.Msg['DELETE_ALL_BLOCKS'] || 'Delete all %1 blocks?').replace(
          '%1',
          count
        );
        Blockly.dialog.confirm(msg, (ok) => {
          if (!ok) return;
          hideBlockToolbar();
          block.checkAndDelete();
          Blockly.Toast.show(workspace, {
            message: translate('DELETE_UNDO_HINT'),
            id: 'delete-undo-tip',
            oncePerSession: true,
            duration: 8,
          });
        });
      } else {
        hideBlockToolbar();
        block.checkAndDelete();
      }
    });
  }

  initializeTheme();

  // Register comment options for workspace comments
  Blockly.ContextMenuItems.registerCommentOptions();

  installShadowNavigationPatch(workspace);

  window.mainWorkspace = workspace;

  return workspace;
}

export function getWorkspace() {
  return workspace;
}

function setupAutoValueBehavior(workspace) {
  workspace.addChangeListener(function (event) {
    if (event.type === Blockly.Events.BLOCK_CHANGE || event.type === Blockly.Events.BLOCK_CREATE) {
      var block = workspace.getBlockById(event.blockId);
      if (block && block.type === 'lists_create_with') {
        var inputCount = 0;
        while (block.getInput('ADD' + inputCount)) {
          inputCount++;
        }
        if (inputCount >= 2) {
          var previousInput = block.getInput('ADD' + (inputCount - 2));
          var lastInput = block.getInput('ADD' + (inputCount - 1));
          if (
            previousInput &&
            previousInput.connection.targetConnection &&
            lastInput &&
            !lastInput.connection.targetConnection
          ) {
            var sourceBlock = previousInput.connection.targetConnection.sourceBlock_;

            function deepCopyBlock(originalBlock) {
              var newBlock = workspace.newBlock(originalBlock.type);

              if (originalBlock.isShadow()) {
                newBlock.setShadow(true);
              }

              var fieldMap = {
                math_number: 'NUM',
                text: 'TEXT',
                logic_boolean: 'BOOL',
                variables_get: 'VAR',
              };

              if (fieldMap[originalBlock.type]) {
                var fieldName = fieldMap[originalBlock.type];
                newBlock.setFieldValue(originalBlock.getFieldValue(fieldName), fieldName);
              }

              for (var i = 0; i < originalBlock.inputList.length; i++) {
                var originalInput = originalBlock.inputList[i];
                var newInput = newBlock.getInput(originalInput.name);

                if (originalInput.connection && originalInput.connection.targetConnection) {
                  var originalNestedBlock = originalInput.connection.targetConnection.sourceBlock_;

                  var newNestedBlock = deepCopyBlock(originalNestedBlock);

                  if (newInput && newNestedBlock.outputConnection) {
                    newInput.connection.connect(newNestedBlock.outputConnection);
                  }
                }
              }

              newBlock.initSvg();
              newBlock.render();

              return newBlock;
            }

            var newBlock = deepCopyBlock(sourceBlock);
            lastInput.connection.connect(newBlock.outputConnection);
          }
        }
      }
    }
  });
}

export function overrideSearchPlugin(workspace) {
  function getBlocksFromToolbox(workspace) {
    const toolboxBlocks = [];
    const seenTypes = new Set();

    function collectBlocks(schema, categoryName = '') {
      if (!schema) {
        return;
      }

      if ('contents' in schema) {
        const currentCategory = schema.name || categoryName;
        if (currentCategory === 'Snippets') {
          return;
        }

        schema.contents?.forEach((item) => {
          collectBlocks(item, currentCategory);
        });
        return;
      }

      if (schema.kind?.toLowerCase() === 'block' && schema.type && !seenTypes.has(schema.type)) {
        seenTypes.add(schema.type);
        toolboxBlocks.push({
          type: schema.type,
          text: schema.type,
          full: schema,
          keyword: schema.keyword,
        });
      }
    }

    workspace.options.languageTree?.contents?.forEach((item) => {
      collectBlocks(item);
    });

    return toolboxBlocks;
  }

  const SearchCategory = Blockly.registry.getClass(Blockly.registry.Type.TOOLBOX_ITEM, 'search');

  if (!SearchCategory) {
    console.error('Search category not found in registry!');
    return;
  }

  const originalInitBlockSearcher = SearchCategory.prototype.initBlockSearcher;

  SearchCategory.prototype.initBlockSearcher = function () {
    // Let the official plugin initialize its own behaviour first.
    if (typeof originalInitBlockSearcher === 'function') {
      originalInitBlockSearcher.call(this);
    }

    const blockSearcher = this.blockSearcher;

    const rebuildSearchIndex = () => {
      const cachedIndex = workspace.flockSearchIndexedBlocks;
      if (Array.isArray(cachedIndex)) {
        blockSearcher.indexedBlocks_ = cachedIndex;
        return;
      }

      const newIndex = buildSearchIndex();
      xmlCache.clear();
      workspace.flockSearchIndexedBlocks = newIndex;
      blockSearcher.indexedBlocks_ = newIndex;

      const showAllBlocksAsync = () => {
        const searchCategory = workspace.flockSearchCategory;
        if (!searchCategory) return;
        if (!isSearchCategorySelected(searchCategory)) return;
        if (searchCategory.searchField?.value.toLowerCase().trim()) {
          return;
        }
        searchCategory.showMatchingBlocks(newIndex);
      };

      if (typeof requestIdleCallback === 'function') {
        requestIdleCallback(showAllBlocksAsync);
      } else {
        setTimeout(showAllBlocksAsync, 0);
      }
    };

    this.blockSearcher.indexBlocks = rebuildSearchIndex;
    blockSearcher.indexedBlocks_ = workspace.flockSearchIndexedBlocks || null;

    if (!workspace.flockSearchIndexScheduled) {
      workspace.flockSearchIndexScheduled = true;
      const scheduleBuild = () => {
        workspace.flockSearchIndexScheduled = false;
        if (!workspace.flockSearchIndexedBlocks) {
          rebuildSearchIndex();
        }
      };

      if (typeof requestIdleCallback === 'function') {
        requestIdleCallback(scheduleBuild, {
          timeout: 1000,
        });
      } else {
        setTimeout(scheduleBuild, 0);
      }
    }

    // Keep a reference so other helpers can see the active search category.
    workspace.flockSearchCategory = this;
  };

  const toolboxBlocks = getBlocksFromToolbox(workspace);
  const isSearchCategorySelected = (category = null) => {
    const toolbox = workspace.getToolbox?.();
    const selectedItem = toolbox?.getSelectedItem?.();
    const selectedDef =
      selectedItem?.getToolboxItemDef?.() ||
      selectedItem?.toolboxItemDef ||
      selectedItem?.toolboxItemDef_;
    const isSelectedSearch =
      selectedDef?.kind?.toLowerCase?.() === 'search' || (category && selectedItem === category);

    return isSelectedSearch;
  };

  function getBlockMessage(blockType) {
    const definition = Blockly.Blocks?.[blockType];
    if (!definition) {
      return '';
    }

    const message0 =
      (typeof definition.message0 === 'string' && definition.message0) ||
      (typeof definition.json?.message0 === 'string' && definition.json.message0) ||
      '';

    if (!message0) {
      return '';
    }

    const resolvedMessage = Blockly.utils.replaceMessageReferences(message0);
    return translate(resolvedMessage);
  }

  function buildBlockLabel(block) {
    const parts = [];
    for (const input of block.inputList) {
      for (const field of input.fieldRow) {
        const text = field.getText().trim();
        if (!text || text === '*') continue;
        if (field instanceof Blockly.FieldDropdown) {
          parts.push(`[${text}]`);
        } else if (!field.EDITABLE) {
          parts.push(text);
        } else {
          parts.push(`(${text})`);
        }
      }
      if (input.type === (Blockly.inputTypes?.VALUE ?? 1)) {
        parts.push('( )');
      }
    }
    return parts.join(' ').replace(/\s+/g, ' ').trim();
  }

  function buildSearchIndex() {
    if (!Object.keys(nextVariableIndexes).length) {
      initializeVariableIndexes();
    }

    const blockCreationWorkspace = new Blockly.Workspace();
    const indexedBlocks = [];

    function applyFieldValues(block, fieldValues) {
      if (!block || !fieldValues) {
        return;
      }

      Object.entries(fieldValues).forEach(([fieldName, value]) => {
        if (value === undefined || value === null || !block.getField(fieldName)) {
          return;
        }

        const normalizedValue = typeof value === 'string' ? value : String(value);
        block.setFieldValue(normalizedValue, fieldName);
      });
    }

    function addBlockFieldTerms(block, searchTerms, runDebugFields) {
      block.inputList.forEach((input) => {
        input.fieldRow.forEach((field) => {
          const fieldText = field.getText();
          if (fieldText) {
            searchTerms.add(fieldText);
            runDebugFields.push({
              name: field.name,
              text: fieldText,
              kind: field.constructor?.name,
            });
          }

          if (field instanceof Blockly.FieldVariable) {
            return;
          }

          if (!fieldText && typeof field.getValue === 'function') {
            const fieldValue = field.getValue();
            if (typeof fieldValue === 'string' && fieldValue.trim()) {
              searchTerms.add(fieldValue);
              runDebugFields.push({
                name: field.name,
                value: fieldValue,
                kind: field.constructor?.name,
              });
            }
          }

          if (field instanceof Blockly.FieldDropdown) {
            field.getOptions(true).forEach((option) => {
              if (typeof option[0] === 'string') {
                searchTerms.add(option[0]);
                runDebugFields.push({
                  name: field.name,
                  option: option[0],
                  kind: field.constructor?.name,
                });
              } else if ('alt' in option[0]) {
                searchTerms.add(option[0].alt);
                runDebugFields.push({
                  name: field.name,
                  option: option[0].alt,
                  kind: field.constructor?.name,
                });
              }
            });
          }
        });
      });
    }

    try {
      toolboxBlocks.forEach((blockInfo) => {
        const type = blockInfo.type;
        if (!type || type === '') {
          return;
        }

        const searchTerms = new Set();
        searchTerms.add(type.replaceAll('_', ' '));

        const runDebugFields = [];

        const keyword = blockInfo.keyword || blockInfo.full?.keyword;
        if (keyword) {
          searchTerms.add(keyword);
        }

        const block = blockCreationWorkspace.newBlock(type);
        if (!block) {
          return;
        }
        applyFieldValues(block, blockInfo.full?.fields);

        const labelText = typeof block.toString === 'function' ? block.toString().trim() : '';
        if (labelText) {
          searchTerms.add(labelText);
        } else {
          const fallbackMessage = getBlockMessage(type);
          if (fallbackMessage) searchTerms.add(fallbackMessage);
        }

        const blockLabel = buildBlockLabel(block) || getBlockMessage(type) || '';

        addBlockFieldTerms(block, searchTerms, runDebugFields);

        const inputDefinitions = blockInfo.full?.inputs;
        if (inputDefinitions) {
          Object.values(inputDefinitions).forEach((definition) => {
            const shadowType = definition?.shadow?.type;
            if (!shadowType) {
              return;
            }

            const shadowBlock = blockCreationWorkspace.newBlock(shadowType);
            if (!shadowBlock) {
              return;
            }
            applyFieldValues(shadowBlock, definition?.shadow?.fields);
            addBlockFieldTerms(shadowBlock, searchTerms, runDebugFields);
            shadowBlock.dispose(true);
          });
        }

        (workspace.flockBlockLabelMap ??= new Map()).set(type, blockLabel);
        indexedBlocks.push({
          ...blockInfo,
          text: Array.from(searchTerms).join(' ').toLowerCase(),
        });
      });
    } finally {
      blockCreationWorkspace.dispose();
    }

    return indexedBlocks;
  }

  const searchToolboxItem = workspace
    .getToolbox()
    ?.getToolboxItems?.()
    ?.find(
      (item) =>
        item instanceof SearchCategory ||
        item.getToolboxItemDef?.().kind === 'search' ||
        item.toolboxItemDef?.kind === 'search'
    );

  if (searchToolboxItem?.initBlockSearcher) {
    searchToolboxItem.initBlockSearcher();
  }

  function debounce(fn, delayMs) {
    return function (...args) {
      clearTimeout(this.flockSearchMatchTimer);
      this.flockSearchMatchTimer = setTimeout(() => fn.apply(this, args), delayMs);
    };
  }

  SearchCategory.prototype.matchBlocks = function () {
    if (!this.hasInputStarted) {
      this.hasInputStarted = true;
    }

    const query = this.searchField?.value.toLowerCase().trim() || '';

    if (!query) {
      const showAllBlocksAsync = () => {
        if (!isSearchCategorySelected(this)) {
          return;
        }
        if (!Array.isArray(this.blockSearcher.indexedBlocks_)) {
          return;
        }

        if (this.searchField?.value.toLowerCase().trim()) {
          return;
        }

        this.showMatchingBlocks(this.blockSearcher.indexedBlocks_);
      };

      const requestType = this.flockSearchAllBlocksRequest?.type;
      const requestId = this.flockSearchAllBlocksRequest?.id;
      if (
        requestType === 'idle' &&
        typeof cancelIdleCallback === 'function' &&
        typeof requestId === 'number'
      ) {
        cancelIdleCallback(requestId);
      } else if (requestType === 'timeout' && typeof requestId === 'number') {
        clearTimeout(requestId);
      }

      if (!Array.isArray(this.blockSearcher.indexedBlocks_) && this.blockSearcher.indexBlocks) {
        if (typeof requestIdleCallback === 'function') {
          const idleId = requestIdleCallback(() => {
            this.blockSearcher.indexBlocks();
            showAllBlocksAsync();
          });
          this.flockSearchAllBlocksRequest = {
            type: 'idle',
            id: idleId,
          };
        } else {
          const timeoutId = setTimeout(() => {
            this.blockSearcher.indexBlocks();
            showAllBlocksAsync();
          }, 0);
          this.flockSearchAllBlocksRequest = {
            type: 'timeout',
            id: timeoutId,
          };
        }
      } else if (typeof requestIdleCallback === 'function') {
        const idleId = requestIdleCallback(showAllBlocksAsync);
        this.flockSearchAllBlocksRequest = {
          type: 'idle',
          id: idleId,
        };
      } else {
        const timeoutId = setTimeout(showAllBlocksAsync, 0);
        this.flockSearchAllBlocksRequest = {
          type: 'timeout',
          id: timeoutId,
        };
      }
      return;
    }

    if (this.flockSearchAllBlocksRequest?.type === 'idle') {
      if (typeof cancelIdleCallback === 'function') {
        cancelIdleCallback(this.flockSearchAllBlocksRequest.id);
      }
    } else if (this.flockSearchAllBlocksRequest?.type === 'timeout') {
      clearTimeout(this.flockSearchAllBlocksRequest.id);
    }

    if (!Array.isArray(this.blockSearcher.indexedBlocks_)) {
      if (this.blockSearcher.indexBlocks) {
        this.blockSearcher.indexBlocks();
      }
    }

    const indexedBlocks = Array.isArray(this.blockSearcher.indexedBlocks_)
      ? this.blockSearcher.indexedBlocks_
      : [];

    const matches = indexedBlocks.filter((block) => {
      if (block.text) {
        return block.text.includes(query);
      }
      return false;
    });

    this.showMatchingBlocks(matches);
  };

  SearchCategory.prototype.matchBlocks = debounce(SearchCategory.prototype.matchBlocks, 120);

  const xmlCache = new Map();

  function getCachedXml(blockFull) {
    const key = blockFull.type;
    if (!xmlCache.has(key)) {
      xmlCache.set(key, createXmlFromJson(blockFull));
    }
    return xmlCache.get(key).cloneNode(true);
  }

  function createXmlFromJson(blockJson, isShadow = false, isTopLevel = true) {
    const blockXml = Blockly.utils.xml.createElement(isShadow ? 'shadow' : 'block');
    blockXml.setAttribute('type', blockJson.type);

    if (isTopLevel && blockJson.type === 'lists_create_with') {
      blockXml.setAttribute('inline', 'true');
    }

    if (blockJson.type === 'lists_create_with' && blockJson.extraState) {
      const mutation = Blockly.utils.xml.createElement('mutation');
      mutation.setAttribute('items', blockJson.extraState.itemCount);
      blockXml.appendChild(mutation);
    }

    if (blockJson.inputs) {
      Object.entries(blockJson.inputs).forEach(([name, input]) => {
        const valueXml = Blockly.utils.xml.createElement('value');
        valueXml.setAttribute('name', name);

        if (input.block) {
          const nestedXml = createXmlFromJson(input.block, false, false);
          valueXml.appendChild(nestedXml);
        }

        if (input.shadow) {
          const shadowXml = createXmlFromJson(input.shadow, true, false);
          valueXml.appendChild(shadowXml);
        }

        blockXml.appendChild(valueXml);
      });
    }

    if (blockJson.fields) {
      Object.entries(blockJson.fields).forEach(([name, value]) => {
        const fieldXml = Blockly.utils.xml.createElement('field');
        fieldXml.setAttribute('name', name);
        fieldXml.textContent = value;
        blockXml.appendChild(fieldXml);
      });
    }

    return blockXml;
  }

  SearchCategory.prototype.showMatchingBlocks = function (matches) {
    if (!isSearchCategorySelected(this)) {
      return;
    }
    const flyout = this.workspace_.getToolbox().getFlyout();
    if (!flyout) {
      console.error('Flyout not found!');
      return;
    }

    const xmlList = matches.map((match) => getCachedXml(match.full));
    flyout.show(xmlList);
  };

  const toolboxDef = workspace.options.languageTree;
  workspace.updateToolbox(toolboxDef);
}
