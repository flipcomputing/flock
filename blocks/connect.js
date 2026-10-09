import * as Blockly from 'blockly';
import { categoryColours } from '../toolbox.js';
import { getHelpUrlFor } from './blocks.js';
import { translate, getTooltip, getDropdownOption } from '../main/translation.js';

import { getAttachNames } from '../config.js';

export function defineConnectBlocks() {
  Blockly.Blocks['parent'] = {
    init: function () {
      this.jsonInit({
        type: 'parent',
        message0: translate('parent'),
        args0: [
          {
            type: 'field_variable',
            name: 'PARENT_MESH',
            variable: 'parent',
          },
          {
            type: 'field_variable',
            name: 'CHILD_MESH',
            variable: window.currentMesh,
          },
        ],
        previousStatement: null,
        nextStatement: null,
        colour: categoryColours['Transform'],
        inputsInline: true,
        tooltip: getTooltip('parent'),
      });
      this.setHelpUrl(getHelpUrlFor(this.type));
      this.setStyle('transform_blocks');
    },
  };

  Blockly.Blocks['parent_children'] = {
    init: function () {
      this.jsonInit({
        type: 'parent_children',
        message0: translate('parent_children'),
        args0: [
          {
            type: 'field_variable',
            name: 'PARENT_MESH',
            variable: 'parent',
          },
          {
            type: 'input_value',
            name: 'MESH_LIST',
            check: 'Array',
          },
        ],
        previousStatement: null,
        nextStatement: null,
        colour: categoryColours['Transform'],
        inputsInline: true,
        tooltip: getTooltip('parent_children'),
      });
      this.setHelpUrl(getHelpUrlFor(this.type));
      this.setStyle('transform_blocks');
    },
  };

  Blockly.Blocks['parent_child'] = {
    init: function () {
      this.jsonInit({
        type: 'parent_child',
        message0: translate('parent_child'),
        args0: [
          {
            type: 'field_variable',
            name: 'PARENT_MESH',
            variable: 'parent',
          },
          {
            type: 'field_variable',
            name: 'CHILD_MESH',
            variable: window.currentMesh,
          },
          {
            type: 'input_value',
            name: 'X_OFFSET',
            check: 'Number',
          },
          {
            type: 'input_value',
            name: 'Y_OFFSET',
            check: 'Number',
          },
          {
            type: 'input_value',
            name: 'Z_OFFSET',
            check: 'Number',
          },
        ],
        previousStatement: null,
        nextStatement: null,
        colour: categoryColours['Transform'],
        inputsInline: true,
        tooltip: getTooltip('parent_child'),
      });
      this.setHelpUrl(getHelpUrlFor(this.type));
      this.setStyle('transform_blocks');
    },
  };

  Blockly.Blocks['remove_parent'] = {
    init: function () {
      this.jsonInit({
        type: 'remove_parent',
        message0: translate('remove_parent'),
        args0: [
          {
            type: 'field_variable',
            name: 'CHILD_MESH',
            variable: window.currentMesh,
          },
        ],
        previousStatement: null,
        nextStatement: null,
        colour: categoryColours['Transform'],
        tooltip: getTooltip('remove_parent'),
      });
      this.setHelpUrl(getHelpUrlFor(this.type));
      this.setStyle('transform_blocks');
    },
  };

  Blockly.Blocks['stop_follow'] = {
    init: function () {
      this.jsonInit({
        type: 'stop_follow',
        message0: translate('stop_follow'),
        args0: [
          {
            type: 'field_variable',
            name: 'FOLLOWER_MESH',
            variable: window.currentMesh,
          },
        ],
        previousStatement: null,
        nextStatement: null,
        colour: categoryColours['Transform'],
        tooltip: getTooltip('stop_follow'),
      });
      this.setHelpUrl(getHelpUrlFor(this.type));
      this.setStyle('transform_blocks');
    },
  };

  Blockly.Blocks['hold'] = {
    init: function () {
      this.jsonInit({
        type: 'hold',
        message0: translate('hold'),
        args0: [
          {
            type: 'field_variable',
            name: 'TARGET_MESH',
            variable: 'target',
          },
          {
            type: 'field_variable',
            name: 'MESH_TO_ATTACH',
            variable: 'object',
          },
          {
            type: 'input_value',
            name: 'X_OFFSET',
            check: 'Number',
            align: 'RIGHT',
          },
          {
            type: 'input_value',
            name: 'Y_OFFSET',
            check: 'Number',
            align: 'RIGHT',
          },
          {
            type: 'input_value',
            name: 'Z_OFFSET',
            check: 'Number',
            align: 'RIGHT',
          },
        ],
        previousStatement: null,
        nextStatement: null,
        colour: categoryColours['Transform'],
        inputsInline: true,
        tooltip: getTooltip('hold'),
      });
      this.setHelpUrl(getHelpUrlFor(this.type));
      this.setStyle('transform_blocks');
    },
  };

  Blockly.Blocks['attach'] = {
    init: function () {
      this.jsonInit({
        type: 'attach',
        message0: translate('attach'),
        args0: [
          {
            type: 'field_variable',
            name: 'MESH_TO_ATTACH',
            variable: 'object',
          },
          {
            type: 'field_variable',
            name: 'TARGET_MESH',
            variable: 'target',
          },
          {
            type: 'field_dropdown',
            name: 'BONE_NAME',
            options: getAttachNames(),
          },
          {
            type: 'input_value',
            name: 'X_OFFSET',
            check: 'Number',
            align: 'LEFT',
          },
          {
            type: 'input_value',
            name: 'Y_OFFSET',
            check: 'Number',
            align: 'LEFT',
          },
          {
            type: 'input_value',
            name: 'Z_OFFSET',
            check: 'Number',
            align: 'LEFT',
          },
        ],
        previousStatement: null,
        nextStatement: null,
        colour: categoryColours['Transform'],
        inputsInline: true,
        tooltip: getTooltip('attach'),
      });
      this.setHelpUrl(getHelpUrlFor(this.type));
      this.setStyle('transform_blocks');
    },
  };
  Blockly.Blocks['drop'] = {
    init: function () {
      this.jsonInit({
        type: 'drop',
        message0: translate('drop'),
        args0: [
          {
            type: 'field_variable',
            name: 'MESH_TO_DETACH',
            variable: 'object',
          },
        ],
        previousStatement: null,
        nextStatement: null,
        colour: categoryColours['Transform'],
        inputsInline: true,
        tooltip: getTooltip('drop'),
      });
      this.setHelpUrl(getHelpUrlFor(this.type));
      this.setStyle('transform_blocks');
    },
  };

  Blockly.Blocks['follow'] = {
    init: function () {
      this.jsonInit({
        type: 'follow',
        message0: translate('follow'),
        args0: [
          {
            type: 'field_variable',
            name: 'FOLLOWER_MESH',
            variable: 'follower',
          },
          {
            type: 'field_variable',
            name: 'TARGET_MESH',
            variable: 'target',
          },
          {
            type: 'field_dropdown',
            name: 'FOLLOW_POSITION',
            options: [
              getDropdownOption('TOP'),
              getDropdownOption('CENTER'),
              getDropdownOption('BOTTOM'),
            ],
          },
          {
            type: 'input_value',
            name: 'X_OFFSET',
            check: 'Number',
          },
          {
            type: 'input_value',
            name: 'Y_OFFSET',
            check: 'Number',
          },
          {
            type: 'input_value',
            name: 'Z_OFFSET',
            check: 'Number',
          },
        ],
        previousStatement: null,
        nextStatement: null,
        colour: categoryColours['Transform'],
        inputsInline: true,
        tooltip: getTooltip('follow'),
      });
      this.setHelpUrl(getHelpUrlFor(this.type));
      this.setStyle('transform_blocks');
    },
  };

  Blockly.Blocks['export_mesh'] = {
    init: function () {
      this.jsonInit({
        type: 'export_mesh',
        message0: translate('export_mesh'),
        args0: [
          {
            type: 'field_variable',
            name: 'MESH_VAR',
            variable: window.currentMesh,
          },
          {
            type: 'field_dropdown',
            name: 'FORMAT',
            options: [
              ['STL', 'STL'],
              ['OBJ', 'OBJ'],
              ['GLB', 'GLB'],
            ],
          },
        ],
        previousStatement: null,
        nextStatement: null,
        colour: categoryColours['Scene'],
        tooltip: getTooltip('export_mesh'),
        inputsInline: true,
      });
      this.setHelpUrl(getHelpUrlFor(this.type));
      this.setStyle('scene_blocks');
      this.appendDummyInput('UNIT_ROW')
        .appendField(translate('export_mesh_unit_label'))
        .appendField(new Blockly.FieldNumber(10, 0), 'UNIT_SIZE')
        .appendField(
          new Blockly.FieldDropdown([
            ['mm', 'mm'],
            ['cm', 'cm'],
            ['m', 'm'],
          ]),
          'UNIT'
        );
      this.getField('FORMAT').setValidator((format) => {
        const previous = this.getFieldValue('FORMAT');
        if ((previous === 'STL') !== (format === 'STL')) {
          const [unitSize, unit] = format === 'STL' ? [10, 'mm'] : [0.5, 'm'];
          this.setFieldValue(unitSize, 'UNIT_SIZE');
          this.setFieldValue(unit, 'UNIT');
        }
        return format;
      });
    },
  };
}
