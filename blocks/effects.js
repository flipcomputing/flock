import * as Blockly from 'blockly';
import { categoryColours } from '../toolbox.js';
import { getHelpUrlFor } from './blocks.js';
import { translate, getTooltip, getDropdownOption } from '../main/translation.js';
import { flock } from '../flock.js';
import { attachSceneSettingLiveUpdate } from './scene.js';
import { readLiveColour, readLiveNumber } from '../ui/blockmesh.js';

function applyMainLight(block) {
  const light = flock.mainLight;
  if (!light) return;
  flock.lightIntensity(readLiveNumber(block, 'INTENSITY', 1, light.intensity));
  flock.lightColor(
    readLiveColour(block, 'DIFFUSE', '#ffffff', light.diffuse.toHexString()),
    readLiveColour(block, 'GROUND_COLOR', '#808080', light.groundColor.toHexString())
  );
  flock.lightStyle(block.getFieldValue('STYLE'));
}

function resetMainLight() {
  if (!flock.mainLight) return;
  flock.lightIntensity(1);
  flock.lightColor('#ffffff', '#808080');
  flock.lightStyle('SOFT');
}

function applyFog(block) {
  const scene = flock.scene;
  flock.setFog({
    fogColorHex: readLiveColour(block, 'FOG_COLOR', '#9932cc', scene.fogColor.toHexString()),
    fogMode: block.getFieldValue('FOG_MODE'),
    fogDensity: readLiveNumber(block, 'DENSITY', 0.1, scene.fogDensity),
    fogStart: readLiveNumber(block, 'START', 50, scene.fogStart),
    fogEnd: readLiveNumber(block, 'END', 100, scene.fogEnd),
  });
}

function resetFog() {
  const scene = flock.scene;
  flock.setFog({
    fogColorHex: scene.fogColor.toHexString(),
    fogMode: 'NONE',
    fogDensity: scene.fogDensity,
    fogStart: scene.fogStart,
    fogEnd: scene.fogEnd,
  });
}

function applyShadows(block) {
  if (!flock.shadowLight) return;
  flock.enableShadows({
    enabled: block.getFieldValue('ENABLED') === 'TRUE',
    all: block.getFieldValue('ALL') === 'TRUE',
  });
}

function resetShadows() {
  if (flock.shadowLight) flock.enableShadows({ enabled: false });
}

export function defineEffectsBlocks() {
  Blockly.Blocks['main_light'] = {
    init: function () {
      this.jsonInit({
        type: 'main_light',
        message0: translate('main_light'),
        args0: [
          {
            type: 'input_value',
            name: 'INTENSITY',
            check: 'Number',
          },
          {
            type: 'input_value',
            name: 'DIFFUSE',
            check: 'Colour',
          },
          {
            type: 'input_value',
            name: 'GROUND_COLOR',
            check: 'Colour',
          },
          {
            type: 'field_dropdown',
            name: 'STYLE',
            options: [getDropdownOption('SOFT'), getDropdownOption('CLASSIC')],
          },
        ],
        inputsInline: true,
        previousStatement: null,
        nextStatement: null,
        colour: categoryColours['Scene'],
        tooltip: getTooltip('main_light'),
      });
      this.setHelpUrl(getHelpUrlFor(this.type));
      this.setStyle('scene_blocks');
      attachSceneSettingLiveUpdate(this, { apply: applyMainLight, reset: resetMainLight });
    },
  };

  Blockly.Blocks['set_fog'] = {
    init: function () {
      this.jsonInit({
        type: 'set_fog',
        message0: translate('set_fog'),
        args0: [
          {
            type: 'input_value',
            name: 'FOG_COLOR',
            colour: '#ffffff',
            check: 'Colour',
          },
          {
            type: 'field_dropdown',
            name: 'FOG_MODE',
            options: [
              getDropdownOption('LINEAR'),
              getDropdownOption('NONE'),
              getDropdownOption('EXP'),
              getDropdownOption('EXP2'),
            ],
          },
          {
            type: 'input_value',
            name: 'DENSITY',
            check: 'Number',
          },
          {
            type: 'input_value',
            name: 'START',
            check: 'Number',
          },
          {
            type: 'input_value',
            name: 'END',
            check: 'Number',
          },
        ],
        inputsInline: true,
        previousStatement: null,
        nextStatement: null,
        colour: categoryColours['Scene'],
        tooltip: getTooltip('set_fog'),
      });
      this.setHelpUrl(getHelpUrlFor(this.type));
      this.setStyle('scene_blocks');
      attachSceneSettingLiveUpdate(this, { apply: applyFog, reset: resetFog });
    },
  };

  Blockly.Blocks['enable_shadows'] = {
    init: function () {
      this.jsonInit({
        type: 'enable_shadows',
        message0: translate('enable_shadows'),
        args0: [
          {
            type: 'field_checkbox',
            name: 'ENABLED',
            checked: true,
          },
          {
            type: 'field_checkbox',
            name: 'ALL',
            checked: false,
          },
        ],
        inputsInline: true,
        previousStatement: null,
        nextStatement: null,
        colour: categoryColours['Scene'],
        tooltip: getTooltip('enable_shadows'),
      });
      this.setHelpUrl(getHelpUrlFor(this.type));
      this.setStyle('scene_blocks');
      attachSceneSettingLiveUpdate(this, { apply: applyShadows, reset: resetShadows });
    },
  };

  Blockly.Blocks['set_shadow'] = {
    init: function () {
      this.jsonInit({
        type: 'set_shadow',
        message0: translate('set_shadow'),
        args0: [
          {
            type: 'field_variable',
            name: 'MESH',
            variable: window.currentMesh,
          },
          {
            type: 'field_checkbox',
            name: 'CAST',
            checked: true,
          },
        ],
        inputsInline: true,
        previousStatement: null,
        nextStatement: null,
        colour: categoryColours['Scene'],
        tooltip: getTooltip('set_shadow'),
      });
      this.setHelpUrl(getHelpUrlFor(this.type));
      this.setStyle('scene_blocks');
    },
  };

  Blockly.Blocks['get_light'] = {
    init: function () {
      this.jsonInit({
        type: 'get_light',
        message0: translate('get_light'),
        args0: [
          {
            type: 'field_variable',
            name: 'VAR',
            variable: 'light', // Default variable is 'camera'
          },
        ],
        previousStatement: null,
        nextStatement: null,
        colour: categoryColours['Scene'],
        tooltip: getTooltip('get_light'),
      });
      this.setHelpUrl(getHelpUrlFor(this.type));
      this.setStyle('scene_blocks');
    },
  };
}
