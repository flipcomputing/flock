import * as Blockly from 'blockly';
import { categoryColours } from '../toolbox.js';
import {
  getHelpUrlFor,
  nextVariableIndexes,
  handleBlockChange,
  addDoMutatorWithToggleBehavior,
  registerBlockHandler,
} from './blocks.js';
import { translate, getTooltip, getDropdownOption } from '../main/translation.js';

export function defineCameraBlocks() {
  Blockly.Blocks['camera_control'] = {
    init: function () {
      this.jsonInit({
        type: 'camera_control',
        message0: translate('camera_control'),
        args0: [
          {
            type: 'field_dropdown',
            name: 'ACTION',
            options: [
              getDropdownOption('rotateLeft'),
              getDropdownOption('rotateRight'),
              getDropdownOption('rotateUp'),
              getDropdownOption('rotateDown'),
              getDropdownOption('moveUp'),
              getDropdownOption('moveDown'),
              getDropdownOption('moveLeft'),
              getDropdownOption('moveRight'),
            ],
          },
          {
            type: 'field_grid_dropdown',
            name: 'KEY',
            columns: 10,
            options: [
              getDropdownOption('0'),
              getDropdownOption('1'),
              getDropdownOption('2'),
              getDropdownOption('3'),
              getDropdownOption('4'),
              getDropdownOption('5'),
              getDropdownOption('6'),
              getDropdownOption('7'),
              getDropdownOption('8'),
              getDropdownOption('9'),
              getDropdownOption('a'),
              getDropdownOption('b'),
              getDropdownOption('c'),
              getDropdownOption('d'),
              getDropdownOption('e'),
              getDropdownOption('f'),
              getDropdownOption('g'),
              getDropdownOption('h'),
              getDropdownOption('i'),
              getDropdownOption('j'),
              getDropdownOption('k'),
              getDropdownOption('l'),
              getDropdownOption('m'),
              getDropdownOption('n'),
              getDropdownOption('o'),
              getDropdownOption('p'),
              getDropdownOption('q'),
              getDropdownOption('r'),
              getDropdownOption('s'),
              getDropdownOption('t'),
              getDropdownOption('u'),
              getDropdownOption('v'),
              getDropdownOption('w'),
              getDropdownOption('x'),
              getDropdownOption('y'),
              getDropdownOption('z'),
              getDropdownOption(' '),
              getDropdownOption(','),
              getDropdownOption('.'),
              getDropdownOption('/'),
              getDropdownOption('ArrowLeft'),
              getDropdownOption('ArrowUp'),
              getDropdownOption('ArrowRight'),
              getDropdownOption('ArrowDown'),
            ],
          },
        ],
        previousStatement: null,
        nextStatement: null,
        colour: categoryColours['Scene'],
        tooltip: getTooltip('camera_control'),
      });
      this.setHelpUrl(getHelpUrlFor(this.type));
      this.setStyle('scene_blocks');
    },
  };

  Blockly.Blocks['camera_follow'] = {
    init: function () {
      this.jsonInit({
        type: 'camera_follow',
        message0: translate('camera_follow'),
        args0: [
          {
            type: 'field_variable',
            name: 'MESH_VAR',
            variable: window.currentMesh,
          },
          {
            type: 'input_value',
            name: 'RADIUS',
            check: 'Number',
          },
          {
            type: 'input_value',
            name: 'ANGLE',
            check: 'Number',
          },
          {
            type: 'field_checkbox',
            name: 'FRONT',
            checked: false,
          },
          {
            type: 'field_variable',
            name: 'CAM_VAR',
            variable: 'playerCamera',
          },
        ],
        previousStatement: null,
        nextStatement: null,
        colour: categoryColours['Scene'],
        tooltip: getTooltip('camera_follow'),
      });
      this.setHelpUrl(getHelpUrlFor(this.type));
      this.setStyle('scene_blocks');
    },
  };

  const cameraButtons = [
    { type: 'field_capture_view', name: 'CAPTURE_VIEW' },
    { type: 'field_view_camera', name: 'VIEW_CAMERA' },
  ];

  const defineCameraBlock = (type, args) => {
    Blockly.Blocks[type] = {
      init: function () {
        const variableNamePrefix = 'camera';
        const nextVariableName = variableNamePrefix + nextVariableIndexes[variableNamePrefix];
        this.jsonInit({
          type,
          message0: translate(type),
          args0: [
            { type: 'field_variable', name: 'ID_VAR', variable: nextVariableName },
            ...args,
            { type: 'field_checkbox', name: 'VISIBLE', checked: false },
            ...cameraButtons,
          ],
          previousStatement: null,
          nextStatement: null,
          inputsInline: true,
          colour: categoryColours['Scene'],
          tooltip: getTooltip(type),
        });
        this.setHelpUrl(getHelpUrlFor(this.type));
        this.setStyle('scene_blocks');

        registerBlockHandler(this, (changeEvent) =>
          handleBlockChange(this, changeEvent, variableNamePrefix)
        );
        if (type === 'create_fly_camera') addDoMutatorWithToggleBehavior(this);
      },
    };
  };

  defineCameraBlock('create_fly_camera', [
    { type: 'input_value', name: 'X', check: 'Number' },
    { type: 'input_value', name: 'Y', check: 'Number' },
    { type: 'input_value', name: 'Z', check: 'Number' },
  ]);

  const targetCameraArgs = [
    { type: 'field_variable', name: 'TARGET', variable: window.currentMesh },
    { type: 'input_value', name: 'DISTANCE', check: 'Number' },
    { type: 'input_value', name: 'UP', check: 'Number' },
    { type: 'input_value', name: 'AROUND', check: 'Number' },
  ];
  defineCameraBlock('create_follow_camera', targetCameraArgs);
  defineCameraBlock('create_orbit_camera', targetCameraArgs);

  Blockly.Blocks['switch_camera'] = {
    init: function () {
      this.jsonInit({
        type: 'switch_camera',
        message0: translate('switch_camera'),
        args0: [
          {
            type: 'field_variable',
            name: 'CAMERA',
            variable: 'camera1',
          },
        ],
        previousStatement: null,
        nextStatement: null,
        colour: categoryColours['Scene'],
        tooltip: getTooltip('switch_camera'),
      });
      this.setHelpUrl(getHelpUrlFor(this.type));
      this.setStyle('scene_blocks');
    },
  };

  Blockly.Blocks['get_camera'] = {
    init: function () {
      this.jsonInit({
        type: 'get_camera',
        message0: translate('get_camera'),
        args0: [
          {
            type: 'field_variable',
            name: 'VAR',
            variable: 'camera', // Default variable is 'camera'
          },
        ],
        previousStatement: null,
        nextStatement: null,
        colour: categoryColours['Scene'],
        tooltip: getTooltip('get_camera'),
      });
      this.setHelpUrl(getHelpUrlFor(this.type));
      this.setStyle('scene_blocks');
    },
  };
}
