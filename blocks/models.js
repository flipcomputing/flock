import * as Blockly from 'blockly';
import { categoryColours } from '../toolbox.js';
import {
  nextVariableIndexes,
  handleBlockChange,
  handleBlockCreateEvent,
  handleMeshLifecycleChange,
  handleFieldOrChildChange,
  addDoMutatorWithToggleBehavior,
  handleParentLinkedUpdate,
  getHelpUrlFor,
  registerBlockHandler,
} from './blocks.js';
import {
  characterNames,
  objectNames,
  multiObjectNames,
  objectColours,
  modelNames,
  getModelDisplayName,
} from '../config.js';
import { flock } from '../flock.js';
import { translate, getTooltip } from '../main/translation.js';
import { updateOrCreateMeshFromBlock } from '../ui/blockmesh.js';

function updateColorsListField(block) {
  const selectedObject = block.getFieldValue('MODELS');
  const colours = objectColours[selectedObject] || ['#000000', '#FFFFFF', '#CCCCCC'];
  const requiredItemCount = colours.length;
  const colorsInput = block.getInput('COLORS');
  let listBlock = colorsInput.connection?.targetBlock();

  // Create a mutation element with the correct number of items.
  const mutation = document.createElement('mutation');
  mutation.setAttribute('items', requiredItemCount);

  if (listBlock && listBlock.type === 'lists_create_with') {
    // Apply the mutation to update the block's inputs.
    listBlock.domToMutation(mutation);

    // Remove any extra inputs beyond the required count.
    listBlock.inputList
      .filter((input) => input.name && input.name.startsWith('ADD'))
      .forEach((input) => {
        const index = parseInt(input.name.substring(3));
        if (index >= requiredItemCount) {
          listBlock.removeInput(input.name);
        }
      });

    // For each required input, update or create its shadow colour block.
    for (let i = 0; i < requiredItemCount; i++) {
      let input = listBlock.getInput('ADD' + i);
      if (!input) {
        input = listBlock.appendValueInput('ADD' + i).setCheck('Colour');
      }
      let shadowBlock = input.connection?.targetBlock();
      if (!shadowBlock || !shadowBlock.isShadow()) {
        shadowBlock = listBlock.workspace.newBlock('colour');
        shadowBlock.setFieldValue(colours[i] || '#000000', 'COLOR');
        shadowBlock.setShadow(true);
        shadowBlock.initSvg();
        input.connection.connect(shadowBlock.outputConnection);
      } else {
        shadowBlock.setFieldValue(colours[i] || '#000000', 'COLOR');
      }
    }
    listBlock.initSvg();
    listBlock.render();
  } else if (!listBlock) {
    // Create a new list block.
    listBlock = block.workspace.newBlock('lists_create_with');
    listBlock.setShadow(true);
    listBlock.domToMutation(mutation);
    for (let i = 0; i < requiredItemCount; i++) {
      let input = listBlock.getInput('ADD' + i);
      if (!input) {
        input = listBlock.appendValueInput('ADD' + i).setCheck('Colour');
      }
      const shadowBlock = listBlock.workspace.newBlock('colour');
      shadowBlock.setFieldValue(colours[i] || '#000000', 'COLOR');
      shadowBlock.setShadow(true);
      shadowBlock.initSvg();
      input.connection.connect(shadowBlock.outputConnection);
    }
    listBlock.setInputsInline(true);
    listBlock.setTooltip(Blockly.Msg['LISTS_CREATE_WITH_TOOLTIP'] || 'Create a list of colours.');
    listBlock.setHelpUrl(
      'https://developers.google.com/blockly/guides/create-custom-blocks/define-blocks'
    );

    listBlock.initSvg();
    listBlock.render();
    colorsInput.connection.connect(listBlock.outputConnection);
  }
}

function updateColorListAtIndex(block, colour, colourIndex) {
  const colorsInput = block.getInput('COLORS');
  if (!colorsInput || !colorsInput.connection) {
    return;
  }
  const listBlock = colorsInput.connection.targetBlock();
  if (!listBlock || listBlock.type !== 'lists_create_with') {
    console.log('List block not found or of incorrect type.');
    return;
  }

  const inputName = 'ADD' + colourIndex;
  let input = listBlock.getInput(inputName);
  if (!input) {
    return;
  }

  let shadowBlock = input.connection?.targetBlock();
  if (!shadowBlock || !shadowBlock.isShadow()) {
    shadowBlock = listBlock.workspace.newBlock('colour');
    shadowBlock.setShadow(true);
    shadowBlock.initSvg();
    input.connection.connect(shadowBlock.outputConnection);
  }

  shadowBlock.setFieldValue(colour, 'COLOR');
  shadowBlock.render();
  listBlock.render();
}

function isInSubtree(rootBlock, blockId) {
  return !!blockId && rootBlock.getDescendants(false).some((b) => b.id === blockId);
}

const CHARACTER_COLOR_INPUTS = [
  'HAIR_COLOR',
  'SKIN_COLOR',
  'EYES_COLOR',
  'TSHIRT_COLOR',
  'SHORTS_COLOR',
  'SLEEVES_COLOR',
];

function isColorsListEdit(block, changeEvent, inputNames = ['COLORS']) {
  const targets = inputNames.map((name) => block.getInputTargetBlock(name)).filter(Boolean);

  if (changeEvent.type === Blockly.Events.BLOCK_MOVE) {
    if (changeEvent.newParentId === block.id && inputNames.includes(changeEvent.newInputName)) {
      return true;
    }
    if (changeEvent.oldParentId === block.id && inputNames.includes(changeEvent.oldInputName)) {
      return true;
    }
    return targets.some(
      (target) =>
        isInSubtree(target, changeEvent.newParentId) || isInSubtree(target, changeEvent.oldParentId)
    );
  }

  if (
    changeEvent.type === Blockly.Events.BLOCK_CHANGE &&
    (changeEvent.element === 'field' || changeEvent.element === 'mutation')
  ) {
    return targets.some((target) => isInSubtree(target, changeEvent.blockId));
  }

  return false;
}

function handleColorsListMove(block, changeEvent, inputNames = ['COLORS']) {
  if (
    changeEvent.type !== Blockly.Events.BLOCK_MOVE ||
    !isColorsListEdit(block, changeEvent, inputNames)
  ) {
    return false;
  }
  updateOrCreateMeshFromBlock(block, changeEvent);
  return true;
}

export function defineModelBlocks() {
  Blockly.Blocks['load_character'] = {
    init: function () {
      const variableNamePrefix = 'character';
      let nextVariableName = variableNamePrefix + nextVariableIndexes[variableNamePrefix];
      this.jsonInit({
        message0: translate('load_character'),
        args0: [
          {
            type: 'field_variable',
            name: 'ID_VAR',
            variable: nextVariableName,
          },
          {
            type: 'field_grid_dropdown',
            name: 'MODELS',
            columns: 6,
            options: characterNames.map((name) => {
              const baseName = name.replace(/\.[^/.]+$/, '');
              return [
                {
                  src: `${flock.imagePath}${baseName}.png`,
                  width: 50,
                  height: 50,
                  alt: getModelDisplayName(name),
                },
                name,
              ];
            }),
          },
          {
            type: 'input_value',
            name: 'SCALE',
            check: 'Number',
          },
          {
            type: 'input_value',
            name: 'X',
            check: 'Number',
          },
          {
            type: 'input_value',
            name: 'Y',
            check: 'Number',
          },
          {
            type: 'input_value',
            name: 'Z',
            check: 'Number',
          },
          {
            type: 'input_value',
            name: 'HAIR_COLOR',
            check: ['Colour', 'Material'],
          },
          {
            type: 'input_value',
            name: 'SKIN_COLOR',
            check: ['Colour', 'Material'],
          },
          {
            type: 'input_value',
            name: 'EYES_COLOR',
            check: ['Colour', 'Material'],
          },
          {
            type: 'input_value',
            name: 'TSHIRT_COLOR',
            check: ['Colour', 'Material'],
          },
          {
            type: 'input_value',
            name: 'SHORTS_COLOR',
            check: ['Colour', 'Material'],
          },
          {
            type: 'input_value',
            name: 'SLEEVES_COLOR',
            check: ['Colour', 'Material'],
          },
          {
            type: 'field_pick_position',
            name: 'PICK_POSITION',
          },
        ],
        inputsInline: true,
        colour: categoryColours['Scene'],
        tooltip: getTooltip('load_character'),
        previousStatement: null,
        nextStatement: null,
      });
      this.setHelpUrl(getHelpUrlFor(this.type));
      this.setStyle('scene_blocks');

      registerBlockHandler(this, (changeEvent) => {
        // Always handle variable naming first (even if mesh is skipped)
        handleBlockCreateEvent(this, changeEvent, variableNamePrefix, nextVariableIndexes);

        // Mesh lifecycle events on this block directly (e.g. enable/disable, move),
        // or when this block is part of a snippet creation (its id is in changeEvent.ids).
        const isThisBlockCreated =
          changeEvent.type === Blockly.Events.BLOCK_CREATE &&
          Array.isArray(changeEvent.ids) &&
          changeEvent.ids.includes(this.id);
        if (changeEvent.blockId === this.id || isThisBlockCreated) {
          if (handleMeshLifecycleChange(this, changeEvent)) return;
        }

        if (handleColorsListMove(this, changeEvent, CHARACTER_COLOR_INPUTS)) return;

        // Linked children like MODELS or color inputs
        if (handleParentLinkedUpdate(this, changeEvent)) {
          // 🔹 Additional side-effect unique to this block type
          window.updateCurrentMeshName(this, 'ID_VAR');
          return;
        }

        if (handleFieldOrChildChange(this, changeEvent)) {
          return;
        }
      });

      addDoMutatorWithToggleBehavior(this);
    },
  };

  Blockly.Blocks['load_object'] = {
    init: function () {
      const defaultObject = 'Star.glb';
      const defaultColours = objectColours[defaultObject];
      const defaultColour = Array.isArray(defaultColours)
        ? defaultColours[0]
        : defaultColours || '#FFD700';
      const variableNamePrefix = 'item';
      let nextVariableName = variableNamePrefix + nextVariableIndexes[variableNamePrefix];

      // Add the main inputs of the block
      this.jsonInit({
        message0: translate('load_object'),
        args0: [
          {
            type: 'field_variable',
            name: 'ID_VAR',
            variable: nextVariableName,
          },
          {
            type: 'field_grid_dropdown',
            name: 'MODELS',
            columns: 6,
            options: objectNames.map((name) => {
              const baseName = name.replace(/\.[^/.]+$/, '');
              return [
                {
                  src: `${flock.imagePath}${baseName}.png`,
                  width: 50,
                  height: 50,
                  alt: getModelDisplayName(name),
                },
                name,
              ];
            }),
          },
          {
            type: 'input_value',
            name: 'COLOR',
            check: ['Colour', 'Array', 'Material'],
          },
          {
            type: 'input_value',
            name: 'SCALE',
            check: 'Number',
          },
          {
            type: 'input_value',
            name: 'X',
            check: 'Number',
          },
          {
            type: 'input_value',
            name: 'Y',
            check: 'Number',
          },
          {
            type: 'input_value',
            name: 'Z',
            check: 'Number',
          },
          {
            type: 'field_pick_position',
            name: 'PICK_POSITION',
          },
        ],
        inputsInline: true,
        colour: categoryColours['Scene'],
        tooltip: getTooltip('load_object'),
        previousStatement: null,
        nextStatement: null,
      });
      this.setHelpUrl(getHelpUrlFor(this.type));
      this.setStyle('scene_blocks');

      // Function to update the COLOR field based on the selected model
      const updateColorField = () => {
        const selectedObject = this.getFieldValue('MODELS');
        const configColors = objectColours[selectedObject];
        const colour = Array.isArray(configColors)
          ? configColors[0]
          : configColors || defaultColour;
        const colorInput = this.getInput('COLOR');
        const colorField = colorInput.connection.targetBlock();
        if (colorField?.getField?.('COLOR')) {
          colorField.setFieldValue(colour, 'COLOR');
        }
      };

      updateColorField();

      registerBlockHandler(this, (changeEvent) => {
        if (
          changeEvent.type === Blockly.Events.BLOCK_CHANGE &&
          changeEvent.element === 'field' &&
          changeEvent.name === 'MODELS' &&
          changeEvent.blockId === this.id
        ) {
          updateColorField();
        }

        handleBlockChange(this, changeEvent, variableNamePrefix);

        if (this.id !== changeEvent.blockId && changeEvent.type !== Blockly.Events.BLOCK_CHANGE)
          return;
        if (handleMeshLifecycleChange(this, changeEvent)) return;
        // if (handleFieldOrChildChange(this, changeEvent)) return;
      });

      addDoMutatorWithToggleBehavior(this);
    },
  };

  Blockly.Blocks['load_multi_object'] = {
    init: function () {
      const variableNamePrefix = 'object';
      let nextVariableName = variableNamePrefix + nextVariableIndexes[variableNamePrefix];

      this.jsonInit({
        message0: translate('load_multi_object'),
        args0: [
          {
            type: 'field_variable',
            name: 'ID_VAR',
            variable: nextVariableName,
          },
          {
            type: 'field_grid_dropdown',
            name: 'MODELS',
            columns: 6,
            options: multiObjectNames.map((name) => {
              const baseName = name.replace(/\.[^/.]+$/, '');
              return [
                {
                  src: `${flock.imagePath}${baseName}.png`,
                  width: 50,
                  height: 50,
                  alt: getModelDisplayName(name),
                },
                name,
              ];
            }),
          },
          {
            type: 'input_value',
            name: 'SCALE',
            check: 'Number',
          },
          {
            type: 'input_value',
            name: 'X',
            check: 'Number',
          },
          {
            type: 'input_value',
            name: 'Y',
            check: 'Number',
          },
          {
            type: 'input_value',
            name: 'Z',
            check: 'Number',
          },
          {
            type: 'input_value',
            name: 'COLORS',
            check: 'Array',
          },
          {
            type: 'field_pick_position',
            name: 'PICK_POSITION',
          },
        ],
        inputsInline: true,
        colour: categoryColours['Scene'],
        tooltip: getTooltip('load_multi_object'),
        previousStatement: null,
        nextStatement: null,
      });
      this.setHelpUrl(getHelpUrlFor(this.type));
      this.setStyle('scene_blocks');

      Blockly.Blocks['load_multi_object'].updateColorsField = function () {
        updateColorsListField(this);
      };

      Blockly.Blocks['load_multi_object'].updateColorAtIndex = function (colour, colourIndex) {
        updateColorListAtIndex(this, colour, colourIndex);
      };

      registerBlockHandler(this, (changeEvent) => {
        // PRIORITY: Handle MODELS field change first (before other handlers can return early)
        if (
          changeEvent.type === Blockly.Events.BLOCK_CHANGE &&
          changeEvent.element === 'field' &&
          changeEvent.name === 'MODELS' &&
          changeEvent.blockId === this.id
        ) {
          const blockInWorkspace = Blockly.getMainWorkspace().getBlockById(this.id);
          if (blockInWorkspace) {
            this.updateColorsField();
          }
          // Don't return here - let other handlers process this event too
        }

        handleBlockCreateEvent(this, changeEvent, variableNamePrefix, nextVariableIndexes);

        // Always handle mesh lifecycle if the event targets this block,
        // or when this block is part of a snippet creation (its id is in changeEvent.ids).
        const isThisBlockCreated =
          changeEvent.type === Blockly.Events.BLOCK_CREATE &&
          Array.isArray(changeEvent.ids) &&
          changeEvent.ids.includes(this.id);
        if (changeEvent.blockId === this.id || isThisBlockCreated) {
          if (handleMeshLifecycleChange(this, changeEvent)) return;
        }

        // For attached children or value inputs
        if (
          handleColorsListMove(this, changeEvent) ||
          handleParentLinkedUpdate(this, changeEvent) ||
          handleFieldOrChildChange(this, changeEvent)
        ) {
          return;
        }
      });

      addDoMutatorWithToggleBehavior(this);
    },
  };

  Blockly.Blocks['load_model'] = {
    init: function () {
      const variableNamePrefix = 'model';
      let nextVariableName = variableNamePrefix + nextVariableIndexes[variableNamePrefix]; // Start with "model1"

      this.jsonInit({
        message0: translate('load_model'),
        args0: [
          {
            type: 'field_variable',
            name: 'ID_VAR',
            variable: nextVariableName,
          },
          {
            type: 'field_grid_dropdown',
            name: 'MODELS',
            columns: 6,
            options: modelNames.map((name) => {
              const baseName = name.replace(/\.[^/.]+$/, '');
              return [
                {
                  src: `${flock.imagePath}${baseName}.png`,
                  width: 50,
                  height: 50,
                  alt: getModelDisplayName(name),
                },
                name,
              ];
            }),
          },
          {
            type: 'input_value',
            name: 'SCALE',
            check: 'Number',
          },
          {
            type: 'input_value',
            name: 'X',
            check: 'Number',
          },
          {
            type: 'input_value',
            name: 'Y',
            check: 'Number',
          },
          {
            type: 'input_value',
            name: 'Z',
            check: 'Number',
          },
          {
            type: 'field_pick_position',
            name: 'PICK_POSITION',
          },
          {
            type: 'input_value',
            name: 'COLORS',
            check: 'Array',
          },
        ],
        inputsInline: true,
        colour: categoryColours['Scene'],
        tooltip: getTooltip('load_model'),
        previousStatement: null,
        nextStatement: null,
      });

      this.setHelpUrl(getHelpUrlFor(this.type));
      this.setStyle('scene_blocks');

      this.colorsEdited = false;
      let colorResetGroup = null;

      this.updateColorsField = function () {
        updateColorsListField(this);
      };

      this.updateColorAtIndex = function (colour, colourIndex) {
        updateColorListAtIndex(this, colour, colourIndex);
      };

      registerBlockHandler(this, (changeEvent) => {
        if (
          changeEvent.type === Blockly.Events.BLOCK_CHANGE &&
          changeEvent.element === 'field' &&
          changeEvent.name === 'MODELS' &&
          changeEvent.blockId === this.id
        ) {
          colorResetGroup = changeEvent.group || Blockly.utils.idGenerator.genUid();
          const prevGroup = Blockly.Events.getGroup();
          Blockly.Events.setGroup(colorResetGroup);
          try {
            this.updateColorsField();
          } finally {
            Blockly.Events.setGroup(prevGroup);
          }
          const colors = this.getInputTargetBlock('COLORS');
          this.colorsEdited = !!colors && colors.type !== 'lists_create_with';
        } else if (
          !window.loadingCode &&
          !(changeEvent.group && changeEvent.group === colorResetGroup) &&
          isColorsListEdit(this, changeEvent)
        ) {
          this.colorsEdited = true;
        }

        handleBlockCreateEvent(this, changeEvent, variableNamePrefix, nextVariableIndexes);

        const isThisBlockCreated =
          changeEvent.type === Blockly.Events.BLOCK_CREATE &&
          Array.isArray(changeEvent.ids) &&
          changeEvent.ids.includes(this.id);
        if (changeEvent.blockId === this.id || isThisBlockCreated) {
          if (handleMeshLifecycleChange(this, changeEvent)) return;
        }

        if (
          handleColorsListMove(this, changeEvent) ||
          handleParentLinkedUpdate(this, changeEvent) ||
          handleFieldOrChildChange(this, changeEvent)
        ) {
          return;
        }
      });

      addDoMutatorWithToggleBehavior(this);

      const doMutationToDom = this.mutationToDom;
      this.mutationToDom = function () {
        const container = doMutationToDom.call(this);
        if (this.colorsEdited) container.setAttribute('colors_edited', 'true');
        return container;
      };

      const doDomToMutation = this.domToMutation;
      this.domToMutation = function (xmlElement) {
        doDomToMutation.call(this, xmlElement);
        this.colorsEdited = xmlElement.getAttribute('colors_edited') === 'true';
      };
    },
  };
}
