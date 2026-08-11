import * as Blockly from 'blockly';
import { categoryColours } from '../toolbox.js';
import { getHelpUrlFor } from './blocks.js';
import { translate, getTooltip, getDropdownOption } from '../main/translation.js';
import {
  syncMicrobitDeviceField,
  refreshMicrobitBlocks,
  isMicrobitRefreshEvent,
} from './sensing.js';
import './fieldMicrobitImage.js'; // registers field_microbit_image

// Shared by the micro:bit display blocks (show image / scroll text): keep
// the device menu in sync with variable renames/deletes and the
// untethered-device warning current.
function wireMicrobitDeviceBlock(block) {
  syncMicrobitDeviceField(block);
  block.setOnChange((changeEvent) => {
    if (
      changeEvent.type === Blockly.Events.VAR_RENAME ||
      changeEvent.type === Blockly.Events.VAR_DELETE
    ) {
      syncMicrobitDeviceField(block);
    }
    if (isMicrobitRefreshEvent(changeEvent)) {
      // Keeps the untethered-device warning current; the manager's
      // status listener covers connect/disconnect transitions.
      refreshMicrobitBlocks(block.workspace);
    }
  });
}

export function defineXRBlocks() {
  if (!Blockly.Extensions.isRegistered('teleport_target_dropdown')) {
    Blockly.Extensions.register('teleport_target_dropdown', function () {
      const dropdown = new Blockly.FieldDropdown(function () {
        const options = [
          [translate('all_option'), 'all'],
          [translate('ground_option'), 'ground'],
        ];
        const workspace = this.sourceBlock_?.workspace;
        workspace
          ?.getVariableMap()
          .getAllVariables()
          .forEach((variable) => options.push([variable.name, variable.name]));
        return options;
      });
      this.getInput('TARGET_INPUT').appendField(dropdown, 'TARGET');
    });
  }

  Blockly.Blocks['microbit_show_image'] = {
    init: function () {
      this.jsonInit({
        type: 'microbit_show_image',
        message0: translate('microbit_show_image'),
        args0: [
          {
            // Same device menu as microbit_input: "any" plus the variables
            // defined by add_microbit blocks.
            type: 'field_microbit_device',
            name: 'DEVICE',
          },
          {
            type: 'field_microbit_image',
            name: 'IMAGE',
          },
        ],
        previousStatement: null,
        nextStatement: null,
        colour: categoryColours['Scene'],
        tooltip: getTooltip('microbit_show_image'),
      });
      this.setHelpUrl(getHelpUrlFor(this.type));
      this.setStyle('scene_blocks');
      wireMicrobitDeviceBlock(this);
    },
  };

  Blockly.Blocks['microbit_scroll_text'] = {
    init: function () {
      this.jsonInit({
        type: 'microbit_scroll_text',
        message0: translate('microbit_scroll_text'),
        args0: [
          {
            type: 'field_microbit_device',
            name: 'DEVICE',
          },
          {
            type: 'input_value',
            name: 'TEXT',
            check: 'String',
          },
        ],
        inputsInline: true,
        previousStatement: null,
        nextStatement: null,
        colour: categoryColours['Scene'],
        tooltip: getTooltip('microbit_scroll_text'),
      });
      this.setHelpUrl(getHelpUrlFor(this.type));
      this.setStyle('scene_blocks');
      wireMicrobitDeviceBlock(this);
    },
  };

  Blockly.Blocks['device_camera_background'] = {
    init: function () {
      this.jsonInit({
        type: 'device_camera_background',
        message0: translate('device_camera_background'),
        args0: [
          {
            type: 'field_dropdown',
            name: 'CAMERA',
            options: [getDropdownOption('user'), getDropdownOption('environment')],
          },
        ],
        previousStatement: null,
        nextStatement: null,
        colour: categoryColours['Scene'],
        tooltip: getTooltip('device_camera_background'),
      });
      this.setHelpUrl(getHelpUrlFor(this.type));
      this.setStyle('scene_blocks');
    },
  };

  Blockly.Blocks['set_xr_mode'] = {
    init: function () {
      this.jsonInit({
        type: 'set_xr_mode',
        message0: translate('set_xr_mode'),
        args0: [
          {
            type: 'field_dropdown',
            name: 'MODE',
            options: [
              getDropdownOption('VR'),
              getDropdownOption('AR'),
              getDropdownOption('MAGIC_WINDOW'),
            ],
          },
        ],
        previousStatement: null,
        nextStatement: null,
        colour: categoryColours['Scene'],
        tooltip: getTooltip('set_xr_mode'),
      });
      this.setHelpUrl(getHelpUrlFor(this.type));
      this.setStyle('scene_blocks');
    },
  };

  Blockly.Blocks['set_xr_view_mode'] = {
    init: function () {
      const watchMotionOptions = [
        getDropdownOption('none'),
        getDropdownOption('comfort'),
        getDropdownOption('smooth'),
      ];
      const embodyMotionOptions = [
        getDropdownOption('none'),
        getDropdownOption('teleport'),
        getDropdownOption('smooth'),
      ];
      this.jsonInit({
        type: 'set_xr_view_mode',
        message0: translate('set_xr_view_mode'),
        args0: [
          {
            type: 'field_dropdown',
            name: 'VIEW',
            options: [getDropdownOption('watch'), getDropdownOption('embody')],
          },
          {
            type: 'field_dropdown',
            name: 'MOTION',
            options: watchMotionOptions,
          },
        ],
        previousStatement: null,
        nextStatement: null,
        colour: categoryColours['Scene'],
        tooltip: getTooltip('set_xr_view_mode'),
      });
      const motionField = this.getField('MOTION');
      const viewField = this.getField('VIEW');
      motionField.menuGenerator_ = () =>
        this.getFieldValue('VIEW') === 'embody' ? embodyMotionOptions : watchMotionOptions;
      viewField.setValidator((view) => {
        const options = view === 'embody' ? embodyMotionOptions : watchMotionOptions;
        motionField.menuGenerator_ = options;
        const motion = motionField.getValue();
        const values = options.map(([, value]) => value);
        if (!values.includes(motion)) {
          motionField.setValue(view === 'embody' ? 'teleport' : 'comfort');
        }
        return view;
      });
      this.setHelpUrl(getHelpUrlFor(this.type));
      this.setStyle('scene_blocks');
    },
  };

  Blockly.Blocks['set_xr_ui_placement'] = {
    init: function () {
      this.jsonInit({
        type: 'set_xr_ui_placement',
        message0: translate('set_xr_ui_placement'),
        args0: [
          {
            type: 'field_dropdown',
            name: 'PLACEMENT',
            options: [getDropdownOption('hud'), getDropdownOption('wrist')],
          },
        ],
        previousStatement: null,
        nextStatement: null,
        colour: categoryColours['Scene'],
        tooltip: getTooltip('set_xr_ui_placement'),
      });
      this.setHelpUrl(getHelpUrlFor(this.type));
      this.setStyle('scene_blocks');
    },
  };

  for (const [type, messageKey] of [
    ['add_teleport_target', 'add_teleport_target'],
    ['remove_teleport_target', 'remove_teleport_target'],
  ]) {
    Blockly.Blocks[type] = {
      init: function () {
        this.jsonInit({
          type,
          message0: translate(messageKey),
          args0: [{ type: 'input_dummy', name: 'TARGET_INPUT' }],
          previousStatement: null,
          nextStatement: null,
          colour: categoryColours['Scene'],
          tooltip: getTooltip(messageKey),
          extensions: ['teleport_target_dropdown'],
        });
        this.setHelpUrl(getHelpUrlFor(this.type));
        this.setStyle('scene_blocks');
      },
    };
  }

  Blockly.Blocks['play_rumble_pattern'] = {
    init: function () {
      this.jsonInit({
        type: 'play_rumble_pattern',
        message0: translate('play_rumble_pattern'),
        args0: [
          {
            type: 'field_dropdown',
            name: 'PATTERN',
            options: [
              getDropdownOption('objectGrab'),
              getDropdownOption('objectDrop'),
              getDropdownOption('smallCollision'),
              getDropdownOption('heavyCollision'),
              getDropdownOption('snapToGrid'),
              getDropdownOption('errorInvalid'),
              getDropdownOption('successConfirmation'),
              getDropdownOption('slidingGravel'),
              getDropdownOption('slidingMetal'),
              getDropdownOption('machineRunning'),
              getDropdownOption('explosion'),
              getDropdownOption('teleport'),
            ],
          },
        ],
        previousStatement: null,
        nextStatement: null,
        colour: categoryColours['Scene'],
        tooltip: getTooltip('play_rumble_pattern'),
      });
      this.setHelpUrl(getHelpUrlFor(this.type));
      this.setStyle('scene_blocks');
    },
  };

  Blockly.Blocks['controller_rumble'] = {
    init: function () {
      this.jsonInit({
        type: 'controller_rumble',
        message0: translate('controller_rumble'),
        args0: [
          {
            type: 'field_dropdown',
            name: 'MOTOR',
            options: [
              getDropdownOption('all'),
              getDropdownOption('left'),
              getDropdownOption('right'),
            ],
          },
          {
            type: 'input_value',
            name: 'STRENGTH',
            check: 'Number',
          },
          {
            type: 'input_value',
            name: 'DURATION',
            check: 'Number',
          },
        ],
        previousStatement: null,
        nextStatement: null,
        colour: categoryColours['Scene'],
        tooltip: getTooltip('controller_rumble'),
      });
      this.setHelpUrl(getHelpUrlFor(this.type));
      this.setStyle('scene_blocks');
    },
  };

  Blockly.Blocks['controller_rumble_pattern'] = {
    init: function () {
      this.jsonInit({
        type: 'controller_rumble_pattern',
        message0: translate('controller_rumble_pattern'),
        args0: [
          {
            type: 'field_dropdown',
            name: 'MOTOR',
            options: [
              getDropdownOption('all'),
              getDropdownOption('left'),
              getDropdownOption('right'),
            ],
          },
          {
            type: 'input_value',
            name: 'STRENGTH',
            check: 'Number',
          },
          {
            type: 'input_value',
            name: 'ON_DURATION',
            check: 'Number',
          },
          {
            type: 'input_value',
            name: 'OFF_DURATION',
            check: 'Number',
          },
          {
            type: 'input_value',
            name: 'REPEATS',
            check: 'Number',
          },
        ],
        previousStatement: null,
        nextStatement: null,
        colour: categoryColours['Scene'],
        tooltip: getTooltip('controller_rumble_pattern'),
      });
      this.setHelpUrl(getHelpUrlFor(this.type));
      this.setStyle('scene_blocks');
    },
  };
}
