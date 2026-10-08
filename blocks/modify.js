import * as Blockly from 'blockly';
import { categoryColours } from '../toolbox.js';
import {
  getHelpUrlFor,
  nextVariableIndexes,
  handleBlockCreateEvent,
  registerBlockHandler,
  addDoMutatorWithToggleBehavior,
  handleBlockChange,
} from './blocks.js';
import { translate, getTooltip, getDropdownOption } from '../main/translation.js';
import { watchMirrorSources } from '../ui/blockmesh.js';

const COMBINE_OPERATIONS = ['merge', 'subtract', 'embed', 'intersect', 'hull'];
const TOOL_OPERATIONS = ['subtract', 'embed'];

function rerunOnCombineToggle(block, changeEvent) {
  if (
    changeEvent.type !== Blockly.Events.BLOCK_CHANGE ||
    changeEvent.element !== 'field' ||
    changeEvent.blockId !== block.id ||
    !(
      changeEvent.name === 'ACTIVE' ||
      (changeEvent.name === 'OPERATION' && block.getFieldValue('ACTIVE') === 'TRUE')
    ) ||
    (window.loadingCode && !changeEvent.recordUndo) ||
    block.workspace !== Blockly.getMainWorkspace() ||
    !block.isEnabled() ||
    !block.getRootBlock().isEnabled()
  ) {
    return;
  }
  window.executeCode?.({ focusCanvas: false });
}

export function defineModifyBlocks() {
  Blockly.Blocks['merge_meshes'] = {
    init: function () {
      const variableNamePrefix = 'merged';
      const nextVariableName = variableNamePrefix + nextVariableIndexes[variableNamePrefix];

      this.jsonInit({
        type: 'merge_meshes',
        message0: translate('merge_meshes'),
        args0: [
          {
            type: 'field_variable',
            name: 'RESULT_VAR',
            variable: nextVariableName,
          },
          {
            type: 'input_value',
            name: 'MESH_LIST',
            check: 'Array',
          },
        ],
        colour: categoryColours['Transform'],
        tooltip: getTooltip('merge_meshes'),
        previousStatement: null,
        nextStatement: null,
      });

      this.setHelpUrl(getHelpUrlFor(this.type));
      this.setStyle('transform_blocks');

      registerBlockHandler(this, (changeEvent) =>
        handleBlockCreateEvent(
          this,
          changeEvent,
          variableNamePrefix,
          nextVariableIndexes,
          'RESULT_VAR'
        )
      );
    },
  };

  Blockly.Blocks['subtract_meshes'] = {
    init: function () {
      const variableNamePrefix = 'subtracted';
      const nextVariableName = variableNamePrefix + nextVariableIndexes[variableNamePrefix];

      this.jsonInit({
        type: 'subtract_meshes',
        message0: translate('subtract_meshes'),
        args0: [
          {
            type: 'field_variable',
            name: 'RESULT_VAR',
            variable: nextVariableName,
          },
          {
            type: 'field_variable',
            name: 'BASE_MESH',
            variable: 'object',
          },
          {
            type: 'input_value',
            name: 'MESH_LIST',
            check: 'Array',
          },
        ],
        colour: categoryColours['Transform'],
        tooltip: getTooltip('subtract_meshes'),
        previousStatement: null,
        nextStatement: null,
      });

      this.setHelpUrl(getHelpUrlFor(this.type));
      this.setStyle('transform_blocks');

      registerBlockHandler(this, (changeEvent) =>
        handleBlockCreateEvent(
          this,
          changeEvent,
          variableNamePrefix,
          nextVariableIndexes,
          'RESULT_VAR'
        )
      );
    },
  };

  Blockly.Blocks['embed_meshes'] = {
    init: function () {
      const variableNamePrefix = 'embedded';
      const nextVariableName = variableNamePrefix + nextVariableIndexes[variableNamePrefix];

      this.jsonInit({
        type: 'embed_meshes',
        message0: translate('embed_meshes'),
        args0: [
          {
            type: 'field_variable',
            name: 'RESULT_VAR',
            variable: nextVariableName,
          },
          {
            type: 'field_variable',
            name: 'BASE_MESH',
            variable: 'object',
          },
          {
            type: 'input_value',
            name: 'MESH_LIST',
            check: 'Array',
          },
        ],
        colour: categoryColours['Transform'],
        tooltip: getTooltip('embed_meshes'),
        previousStatement: null,
        nextStatement: null,
      });

      this.setHelpUrl(getHelpUrlFor(this.type));
      this.setStyle('transform_blocks');

      registerBlockHandler(this, (changeEvent) =>
        handleBlockCreateEvent(
          this,
          changeEvent,
          variableNamePrefix,
          nextVariableIndexes,
          'RESULT_VAR'
        )
      );
    },
  };

  Blockly.Blocks['intersection_meshes'] = {
    init: function () {
      const variableNamePrefix = 'intersection';
      const nextVariableName = variableNamePrefix + nextVariableIndexes[variableNamePrefix];

      this.jsonInit({
        type: 'intersection_meshes',
        message0: translate('intersection_meshes'),
        args0: [
          {
            type: 'field_variable',
            name: 'RESULT_VAR',
            variable: nextVariableName,
          },
          {
            type: 'input_value',
            name: 'MESH_LIST',
            check: 'Array',
          },
        ],
        colour: categoryColours['Transform'],
        tooltip: getTooltip('intersection_meshes'),
        previousStatement: null,
        nextStatement: null,
      });

      this.setHelpUrl(getHelpUrlFor(this.type));
      this.setStyle('transform_blocks');

      registerBlockHandler(this, (changeEvent) =>
        handleBlockCreateEvent(
          this,
          changeEvent,
          variableNamePrefix,
          nextVariableIndexes,
          'RESULT_VAR'
        )
      );
    },
  };

  Blockly.Blocks['hull_meshes'] = {
    init: function () {
      const variableNamePrefix = 'hull';
      const nextVariableName = variableNamePrefix + nextVariableIndexes[variableNamePrefix];

      this.jsonInit({
        type: 'hull_meshes',
        message0: translate('hull_meshes'),
        args0: [
          {
            type: 'field_variable',
            name: 'RESULT_VAR',
            variable: nextVariableName,
          },
          {
            type: 'input_value',
            name: 'MESH_LIST',
            check: 'Array',
          },
        ],
        colour: categoryColours['Transform'],
        tooltip: getTooltip('hull_meshes'),
        previousStatement: null,
        nextStatement: null,
      });

      this.setHelpUrl(getHelpUrlFor(this.type));
      this.setStyle('transform_blocks');

      registerBlockHandler(this, (changeEvent) =>
        handleBlockCreateEvent(
          this,
          changeEvent,
          variableNamePrefix,
          nextVariableIndexes,
          'RESULT_VAR'
        )
      );
    },
  };

  Blockly.Blocks['combine'] = {
    init: function () {
      const variableNamePrefix = 'combined';
      const nextVariableName = variableNamePrefix + nextVariableIndexes[variableNamePrefix];

      this.jsonInit({
        type: 'combine',
        message0: translate('combine'),
        args0: [
          {
            type: 'field_variable',
            name: 'RESULT_VAR',
            variable: nextVariableName,
          },
          {
            type: 'field_dropdown',
            name: 'OPERATION',
            options: COMBINE_OPERATIONS.map(getDropdownOption),
          },
          {
            type: 'field_checkbox',
            name: 'ACTIVE',
            checked: true,
          },
        ],
        colour: categoryColours['Transform'],
        tooltip: getTooltip('combine'),
        previousStatement: null,
        nextStatement: null,
        inputsInline: true,
      });

      this.setHelpUrl(getHelpUrlFor(this.type));
      this.setStyle('transform_blocks');
      this.appendStatementInput('PARTS').setCheck(null);
      this.getField('OPERATION').setValidator((operation) => {
        this.updateShape_(operation);
        return operation;
      });

      registerBlockHandler(this, (changeEvent) => {
        handleBlockCreateEvent(
          this,
          changeEvent,
          variableNamePrefix,
          nextVariableIndexes,
          'RESULT_VAR'
        );
        rerunOnCombineToggle(this, changeEvent);
      });
    },

    updateShape_: function (operation) {
      const input = this.getInput('TOOLS');
      if (!TOOL_OPERATIONS.includes(operation)) {
        if (!input) return;
        const orphan = input.connection.targetBlock();
        if (orphan) {
          orphan.unplug();
          orphan.previousConnection?.bumpAwayFrom?.(input.connection);
        }
        this.removeInput('TOOLS_ROW');
        this.removeInput('TOOLS');
        return;
      }
      if (!input) {
        this.appendDummyInput('TOOLS_ROW');
        this.appendStatementInput('TOOLS').setCheck(null);
      }
      const row = this.getInput('TOOLS_ROW');
      row.removeField('TOOLS_LABEL', true);
      row.appendField(translate(`combine_${operation}_label`), 'TOOLS_LABEL');
    },
  };

  Blockly.Blocks['flip'] = {
    init: function () {
      this.jsonInit({
        type: 'flip',
        message0: translate('flip'),
        args0: [
          {
            type: 'field_variable',
            name: 'MESH',
            variable: window.currentMesh,
          },
          {
            type: 'field_dropdown',
            name: 'AXIS',
            options: [
              getDropdownOption('x_coordinate'),
              getDropdownOption('y_coordinate'),
              getDropdownOption('z_coordinate'),
            ],
          },
        ],
        colour: categoryColours['Transform'],
        tooltip: getTooltip('flip'),
        previousStatement: null,
        nextStatement: null,
      });

      this.setHelpUrl(getHelpUrlFor(this.type));
      this.setStyle('transform_blocks');
    },
  };

  Blockly.Blocks['mirror_mesh'] = {
    init: function () {
      const variableNamePrefix = 'mirror';
      const nextVariableName = variableNamePrefix + nextVariableIndexes[variableNamePrefix];

      this.jsonInit({
        type: 'mirror_mesh',
        message0: translate('mirror_mesh'),
        args0: [
          {
            type: 'field_variable',
            name: 'ID_VAR',
            variable: nextVariableName,
          },
          {
            type: 'field_variable',
            name: 'SOURCE_MESH',
            variable: window.currentMesh,
          },
          {
            type: 'field_dropdown',
            name: 'AXIS',
            options: [
              getDropdownOption('x_coordinate'),
              getDropdownOption('y_coordinate'),
              getDropdownOption('z_coordinate'),
            ],
          },
          {
            type: 'field_variable',
            name: 'ABOUT',
            variable: window.currentMesh,
          },
        ],
        inputsInline: true,
        colour: categoryColours['Transform'],
        tooltip: getTooltip('mirror_mesh'),
        previousStatement: null,
        nextStatement: null,
      });

      this.setHelpUrl(getHelpUrlFor(this.type));
      this.setStyle('transform_blocks');

      registerBlockHandler(this, (changeEvent) => {
        handleBlockChange(this, changeEvent, variableNamePrefix);
        watchMirrorSources(this, changeEvent);
      });
      addDoMutatorWithToggleBehavior(this);
    },
  };
}
