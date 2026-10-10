import * as Blockly from 'blockly';
import { categoryColours } from '../toolbox.js';
import {
  nextVariableIndexes,
  handleBlockChange,
  addDoMutatorWithToggleBehavior,
  handleBlockCreateEvent,
  getHelpUrlFor,
  registerBlockHandler,
  DO_MUTATOR_MINUS,
  DO_MUTATOR_PLUS,
} from './blocks.js';
import { addInitialTransformRows } from './initialTransformRows.js';
import { translate, getTooltip, getDropdownOption } from '../main/translation.js';
import {
  CUBE_FACES,
  ROUNDINGS,
  roundingSettings,
  shapeError,
} from '../api/freeformgeometry.js';
import { setFreeformEditing } from '../ui/freeformedit.js';

const WALL_INPUTS = ['DIAMETER', 'INNER_DIAMETER', 'THICKNESS'];

function readNumberInput(block, inputName) {
  const target = block.getInputTargetBlock(inputName);
  return target?.getField?.('NUM') ? Number(target.getFieldValue('NUM')) : NaN;
}

function linkWallInputs(block, changeEvent) {
  if (
    changeEvent.type !== Blockly.Events.BLOCK_CHANGE ||
    changeEvent.element !== 'field' ||
    changeEvent.name !== 'NUM' ||
    !changeEvent.recordUndo
  ) {
    return;
  }

  const edited = WALL_INPUTS.find(
    (name) => block.getInputTargetBlock(name)?.id === changeEvent.blockId
  );
  if (!edited) return;

  const [diameter, innerDiameter, thickness] = WALL_INPUTS.map((name) =>
    readNumberInput(block, name)
  );
  if (![diameter, innerDiameter, thickness].every(Number.isFinite)) return;

  const [target, current, value] =
    edited === 'INNER_DIAMETER'
      ? ['THICKNESS', thickness, (diameter - innerDiameter) / 2]
      : ['INNER_DIAMETER', innerDiameter, diameter - 2 * thickness];
  const linked = Math.max(0, Math.round(value * 1000) / 1000);
  if (Math.abs(linked - current) < 0.0015) return;

  Blockly.Events.setGroup(changeEvent.group || true);
  try {
    block.getInputTargetBlock(target).setFieldValue(String(linked), 'NUM');
  } finally {
    Blockly.Events.setGroup(false);
  }
}

const cloneFaces = (faces) => faces.map((face) => [...face]);

function parseFaces(text) {
  if (!text) return cloneFaces(CUBE_FACES);
  try {
    const faces = JSON.parse(text);
    if (Array.isArray(faces) && faces.every((f) => Array.isArray(f) && f.every(Number.isInteger))) {
      return faces;
    }
  } catch {
    // Unreadable faces fall back to the cube below.
  }
  return cloneFaces(CUBE_FACES);
}

function extraStateText(block) {
  if (block.saveExtraState) {
    const state = block.saveExtraState();
    return state ? JSON.stringify(state) : '';
  }
  const dom = block.mutationToDom?.();
  return dom ? Blockly.Xml.domToText(dom) : '';
}

function vectorNumberBlocks(vector) {
  if (vector?.type !== 'vector') return null;
  const numbers = ['X', 'Y', 'Z'].map((axis) => vector.getInputTargetBlock(axis));
  return numbers.every((n) => n?.type === 'math_number') ? numbers : null;
}

function vectorState([x, y, z]) {
  const num = (NUM) => ({ shadow: { type: 'math_number', fields: { NUM } } });
  return { type: 'vector', inputs: { X: num(x), Y: num(y), Z: num(z) } };
}

function touchesPointList(block, event) {
  if (
    (event.newParentId === block.id && event.newInputName === 'VERTICES') ||
    (event.oldParentId === block.id && event.oldInputName === 'VERTICES')
  ) {
    return true;
  }
  const list = block.getInputTargetBlock('VERTICES');
  if (!list) return false;
  const ids = new Set(list.getDescendants(false).map((b) => b.id));
  return ids.has(event.blockId) || ids.has(event.newParentId) || ids.has(event.oldParentId);
}

export function defineShapeBlocks() {
  // Define the particle effect block.
  Blockly.Blocks['create_particle_effect'] = {
    init: function () {
      const variableNamePrefix = 'particleEffect';
      let nextVariableName = variableNamePrefix + nextVariableIndexes[variableNamePrefix];
      this.jsonInit({
        message0: translate('create_particle_effect'),
        args0: [
          {
            type: 'field_variable',
            name: 'ID_VAR',
            variable: nextVariableName,
          },
          {
            type: 'field_variable',
            name: 'EMITTER_MESH',
            variable: window.currentMesh,
          },
          {
            type: 'field_grid_dropdown',
            name: 'SHAPE',
            options: [
              [
                {
                  src: './textures/circle_texture.png',
                  width: 32,
                  height: 32,
                  alt: 'Circle',
                },
                'circle_texture.png',
              ],
              [
                {
                  src: './textures/balloon_texture.png',
                  width: 32,
                  height: 32,
                  alt: 'Balloon',
                },
                'balloon_texture.png',
              ],
              [
                {
                  src: './textures/bee_texture.png',
                  width: 32,
                  height: 32,
                  alt: 'Bee',
                },
                'bee_texture.png',
              ],
              [
                {
                  src: './textures/bird_texture.png',
                  width: 32,
                  height: 32,
                  alt: 'Bird',
                },
                'bird_texture.png',
              ],
              [
                {
                  src: './textures/blast_texture.png',
                  width: 32,
                  height: 32,
                  alt: 'Blast',
                },
                'blast_texture.png',
              ],
              [
                {
                  src: './textures/bubble_texture.png',
                  width: 32,
                  height: 32,
                  alt: 'Bubble',
                },
                'bubble_texture.png',
              ],
              [
                {
                  src: './textures/burst_texture.png',
                  width: 32,
                  height: 32,
                  alt: 'Burst',
                },
                'burst_texture.png',
              ],
              [
                {
                  src: './textures/chevron_texture.png',
                  width: 32,
                  height: 32,
                  alt: 'Cheveron',
                },
                'chevron_texture.png',
              ],
              [
                {
                  src: './textures/comet_texture.png',
                  width: 32,
                  height: 32,
                  alt: 'Comet',
                },
                'comet_texture.png',
              ],
              [
                {
                  src: './textures/confetti_texture.png',
                  width: 32,
                  height: 32,
                  alt: 'Confetti',
                },
                'confetti_texture.png',
              ],
              [
                {
                  src: './textures/exclaim_texture.png',
                  width: 32,
                  height: 32,
                  alt: 'Exclaim',
                },
                'exclaim_texture.png',
              ],
              [
                {
                  src: './textures/flock_texture.png',
                  width: 32,
                  height: 32,
                  alt: 'Flock',
                },
                'flock_texture.png',
              ],
              [
                {
                  src: './textures/fish_texture.png',
                  width: 32,
                  height: 32,
                  alt: 'Fish',
                },
                'fish_texture.png',
              ],
              [
                {
                  src: './textures/fragments_texture.png',
                  width: 32,
                  height: 32,
                  alt: 'Fragments',
                },
                'fragments_texture.png',
              ],
              [
                {
                  src: './textures/gem_texture.png',
                  width: 32,
                  height: 32,
                  alt: 'Gem',
                },
                'gem_texture.png',
              ],
              [
                {
                  src: './textures/ghost_texture.png',
                  width: 32,
                  height: 32,
                  alt: 'Ghost',
                },
                'ghost_texture.png',
              ],
              [
                {
                  src: './textures/heart_texture.png',
                  width: 32,
                  height: 32,
                  alt: 'Heart',
                },
                'heart_texture.png',
              ],
              [
                {
                  src: './textures/leaf_texture.png',
                  width: 32,
                  height: 32,
                  alt: 'Leaf',
                },
                'leaf_texture.png',
              ],
              [
                {
                  src: './textures/leaf2_texture.png',
                  width: 32,
                  height: 32,
                  alt: 'Leaf',
                },
                'leaf2_texture.png',
              ],
              [
                {
                  src: './textures/mic_texture.png',
                  width: 32,
                  height: 32,
                  alt: 'Mic',
                },
                'mic_texture.png',
              ],
              [
                {
                  src: './textures/money_texture.png',
                  width: 32,
                  height: 32,
                  alt: 'Money',
                },
                'money_texture.png',
              ],
              [
                {
                  src: './textures/music_texture.png',
                  width: 32,
                  height: 32,
                  alt: 'Music',
                },
                'music_texture.png',
              ],
              [
                {
                  src: './textures/paw_texture.png',
                  width: 32,
                  height: 32,
                  alt: 'Paw',
                },
                'paw_texture.png',
              ],
              [
                {
                  src: './textures/rays_texture.png',
                  width: 32,
                  height: 32,
                  alt: 'Rays',
                },
                'rays_texture.png',
              ],
              [
                {
                  src: './textures/ripple_texture.png',
                  width: 32,
                  height: 32,
                  alt: 'Ripple',
                },
                'ripple_texture.png',
              ],
              [
                {
                  src: './textures/rocket_texture.png',
                  width: 32,
                  height: 32,
                  alt: 'Rocket',
                },
                'rocket_texture.png',
              ],
              [
                {
                  src: './textures/sleep_texture.png',
                  width: 32,
                  height: 32,
                  alt: 'Sleep',
                },
                'sleep_texture.png',
              ],
              [
                {
                  src: './textures/speaking_texture.png',
                  width: 32,
                  height: 32,
                  alt: 'Speaking',
                },
                'speaking_texture.png',
              ],
              [
                {
                  src: './textures/splash_texture.png',
                  width: 32,
                  height: 32,
                  alt: 'Splash',
                },
                'splash_texture.png',
              ],
              [
                {
                  src: './textures/splat_texture.png',
                  width: 32,
                  height: 32,
                  alt: 'Splat',
                },
                'splat_texture.png',
              ],
              [
                {
                  src: './textures/star_texture.png',
                  width: 32,
                  height: 32,
                  alt: 'Star',
                },
                'star_texture.png',
              ],
              [
                {
                  src: './textures/sweet_texture.png',
                  width: 32,
                  height: 32,
                  alt: 'Sweet',
                },
                'sweet_texture.png',
              ],
              [
                {
                  src: './textures/butterfly_texture.png',
                  width: 32,
                  height: 32,
                  alt: 'Butterfly',
                },
                'butterfly_texture.png',
              ],
              [
                {
                  src: './textures/flower_texture.png',
                  width: 32,
                  height: 32,
                  alt: 'Flower',
                },
                'flower_texture.png',
              ],
              [
                {
                  src: './textures/flame_texture.png',
                  width: 32,
                  height: 32,
                  alt: 'Flame',
                },
                'flame_texture.png',
              ],
              [
                {
                  src: './textures/smoke_texture.png',
                  width: 32,
                  height: 32,
                  alt: 'Smoke',
                },
                'smoke_texture.png',
              ],
              [
                {
                  src: './textures/snowflake_texture.png',
                  width: 32,
                  height: 32,
                  alt: 'Snowflake',
                },
                'snowflake_texture.png',
              ],
              [
                {
                  src: './textures/swirl_texture.png',
                  width: 32,
                  height: 32,
                  alt: 'Swirl',
                },
                'swirl_texture.png',
              ],
              [
                {
                  src: './textures/wave_texture.png',
                  width: 32,
                  height: 32,
                  alt: 'Wave',
                },
                'wave_texture.png',
              ],
              [
                {
                  src: './textures/wind_texture.png',
                  width: 32,
                  height: 32,
                  alt: 'Wind',
                },
                'wind_texture.png',
              ],
              [
                {
                  src: './textures/strip_texture.png',
                  width: 32,
                  height: 32,
                  alt: 'Strip',
                },
                'strip_texture.png',
              ],
              [
                {
                  src: './textures/crescent_texture.png',
                  width: 32,
                  height: 32,
                  alt: 'Crescent',
                },
                'crescent_texture.png',
              ],
              [
                {
                  src: './textures/lightning_texture.png',
                  width: 32,
                  height: 32,
                  alt: 'Lightning bolt',
                },
                'lightning_texture.png',
              ],
              [
                {
                  src: './textures/droplet_texture.png',
                  width: 32,
                  height: 32,
                  alt: 'Droplet',
                },
                'droplet_texture.png',
              ],
              [
                {
                  src: './textures/shard_texture.png',
                  width: 32,
                  height: 32,
                  alt: 'Shard',
                },
                'shard_texture.png',
              ],
              [
                {
                  src: './textures/square_texture.png',
                  width: 32,
                  height: 32,
                  alt: 'Square',
                },
                'square_texture.png',
              ],
              [
                {
                  src: './textures/arrow_texture.png',
                  width: 32,
                  height: 32,
                  alt: 'Arrow',
                },
                'arrow_texture.png',
              ],
            ],
          },
          {
            type: 'input_value',
            name: 'START_COLOR',
            check: 'Colour',
          },
          {
            type: 'input_value',
            name: 'END_COLOR',
            check: 'Colour',
          },
          {
            type: 'input_value',
            name: 'START_ALPHA',
            check: 'Number',
          },
          {
            type: 'input_value',
            name: 'END_ALPHA',
            check: 'Number',
          },
          {
            type: 'input_value',
            name: 'RATE',
            check: 'Number',
          },
          {
            type: 'input_value',
            name: 'MIN_SIZE',
            check: 'Number',
          },
          {
            type: 'input_value',
            name: 'MAX_SIZE',
            check: 'Number',
          },
          {
            type: 'input_value',
            name: 'MIN_LIFETIME',
            check: 'Number',
          },
          {
            type: 'input_value',
            name: 'MAX_LIFETIME',
            check: 'Number',
          },
          {
            type: 'field_checkbox',
            name: 'GRAVITY',
            checked: false,
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
            name: 'MIN_ANGULAR_SPEED',
            check: 'Number',
          },
          {
            type: 'input_value',
            name: 'MAX_ANGULAR_SPEED',
            check: 'Number',
          },
          {
            type: 'input_value',
            name: 'MIN_INITIAL_ROTATION',
            check: 'Number',
          },
          {
            type: 'input_value',
            name: 'MAX_INITIAL_ROTATION',
            check: 'Number',
          },
        ],
        inputsInline: true,
        colour: categoryColours['Scene'],
        tooltip: getTooltip('create_particle_effect'),
        previousStatement: null,
        nextStatement: null,
      });
      this.setHelpUrl(getHelpUrlFor(this.type));
      this.setStyle('scene_blocks');

      registerBlockHandler(this, (changeEvent) =>
        handleBlockCreateEvent(this, changeEvent, variableNamePrefix, nextVariableIndexes)
      );
    },
  };

  Blockly.Blocks['create_box'] = {
    init: function () {
      const variableNamePrefix = 'box';
      let nextVariableName = variableNamePrefix + nextVariableIndexes[variableNamePrefix];
      this.jsonInit({
        type: 'create_box',
        message0: translate('create_box'),
        args0: [
          {
            type: 'field_variable',
            name: 'ID_VAR',
            variable: nextVariableName,
          },
          {
            type: 'input_value',
            name: 'COLOR',
            check: ['Colour', 'Material'],
          },
          {
            type: 'input_value',
            name: 'WIDTH',
            check: 'Number',
          },
          {
            type: 'input_value',
            name: 'HEIGHT',
            check: 'Number',
          },
          {
            type: 'input_value',
            name: 'DEPTH',
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
        previousStatement: null,
        nextStatement: null,
        inputsInline: true,
        colour: categoryColours['Scene'],
        tooltip: getTooltip('create_box'),
      });
      this.setHelpUrl(getHelpUrlFor(this.type));
      this.setStyle('scene_blocks');

      // Set up the change handler.
      registerBlockHandler(this, (changeEvent) =>
        handleBlockChange(this, changeEvent, variableNamePrefix)
      );
      // Add the mutator with toggle behaviour.
      addDoMutatorWithToggleBehavior(this);
      addInitialTransformRows(this);
    },
  };

  Blockly.Blocks['create_sphere'] = {
    init: function () {
      const variableNamePrefix = 'sphere';
      let nextVariableName = variableNamePrefix + nextVariableIndexes[variableNamePrefix];
      this.jsonInit({
        type: 'create_sphere',
        message0: translate('create_sphere'),
        args0: [
          {
            type: 'field_variable',
            name: 'ID_VAR',
            variable: nextVariableName,
          },
          {
            type: 'input_value',
            name: 'COLOR',
            check: ['Colour', 'Material'],
          },
          {
            type: 'input_value',
            name: 'DIAMETER_X',
            check: 'Number',
          },
          {
            type: 'input_value',
            name: 'DIAMETER_Y',
            check: 'Number',
          },
          {
            type: 'input_value',
            name: 'DIAMETER_Z',
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
        previousStatement: null,
        nextStatement: null,
        inputsInline: true,
        colour: categoryColours['Scene'],
        tooltip: getTooltip('create_sphere'),
      });
      this.setHelpUrl(getHelpUrlFor(this.type));
      this.setStyle('scene_blocks');

      // Set up the change handler.
      registerBlockHandler(this, (changeEvent) =>
        handleBlockChange(this, changeEvent, variableNamePrefix)
      );
      // Add the mutator with toggle behaviour.
      addDoMutatorWithToggleBehavior(this);
      addInitialTransformRows(this);
    },
  };

  Blockly.Blocks['create_cylinder'] = {
    init: function () {
      const variableNamePrefix = 'cylinder';
      let nextVariableName = variableNamePrefix + nextVariableIndexes[variableNamePrefix];
      this.jsonInit({
        type: 'create_cylinder',
        message0: translate('create_cylinder'),
        args0: [
          {
            type: 'field_variable',
            name: 'ID_VAR',
            variable: nextVariableName,
          },
          {
            type: 'input_value',
            name: 'COLOR',
            check: ['Colour', 'Material'],
          },
          {
            type: 'input_value',
            name: 'HEIGHT',
            check: 'Number',
          },
          {
            type: 'input_value',
            name: 'DIAMETER_TOP',
            check: 'Number',
          },
          {
            type: 'input_value',
            name: 'DIAMETER_BOTTOM',
            check: 'Number',
          },
          {
            type: 'input_value',
            name: 'TESSELLATIONS',
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
        previousStatement: null,
        nextStatement: null,
        inputsInline: true,
        colour: categoryColours['Scene'],
        tooltip: getTooltip('create_cylinder'),
      });
      this.setHelpUrl(getHelpUrlFor(this.type));
      this.setStyle('scene_blocks');

      // Set up the change handler.
      registerBlockHandler(this, (changeEvent) =>
        handleBlockChange(this, changeEvent, variableNamePrefix)
      );
      // Add the mutator with toggle behaviour.
      addDoMutatorWithToggleBehavior(this);
      addInitialTransformRows(this);
    },
  };

  Blockly.Blocks['create_capsule'] = {
    init: function () {
      const variableNamePrefix = 'capsule';
      let nextVariableName = variableNamePrefix + nextVariableIndexes[variableNamePrefix];
      this.jsonInit({
        type: 'create_capsule',
        message0: translate('create_capsule'),
        args0: [
          {
            type: 'field_variable',
            name: 'ID_VAR',
            variable: nextVariableName,
          },
          {
            type: 'input_value',
            name: 'COLOR',
            check: ['Colour', 'Material'],
          },
          {
            type: 'input_value',
            name: 'DIAMETER',
            check: 'Number',
          },
          {
            type: 'input_value',
            name: 'HEIGHT',
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
        previousStatement: null,
        nextStatement: null,
        inputsInline: true,
        colour: categoryColours['Scene'],
        tooltip: getTooltip('create_capsule'),
      });
      this.setHelpUrl(getHelpUrlFor(this.type));
      this.setStyle('scene_blocks');

      // Set up the change handler.
      registerBlockHandler(this, (changeEvent) =>
        handleBlockChange(this, changeEvent, variableNamePrefix)
      );
      // Add the mutator with toggle behaviour.
      addDoMutatorWithToggleBehavior(this);
      addInitialTransformRows(this);
    },
  };

  Blockly.Blocks['create_wedge'] = {
    init: function () {
      const variableNamePrefix = 'wedge';
      let nextVariableName = variableNamePrefix + nextVariableIndexes[variableNamePrefix];
      this.jsonInit({
        type: 'create_wedge',
        message0: translate('create_wedge'),
        args0: [
          {
            type: 'field_variable',
            name: 'ID_VAR',
            variable: nextVariableName,
          },
          {
            type: 'input_value',
            name: 'COLOR',
            check: ['Colour', 'Material'],
          },
          {
            type: 'input_value',
            name: 'WIDTH',
            check: 'Number',
          },
          {
            type: 'input_value',
            name: 'HEIGHT',
            check: 'Number',
          },
          {
            type: 'input_value',
            name: 'DEPTH',
            check: 'Number',
          },
          {
            type: 'input_value',
            name: 'PEAK',
            check: 'Number',
          },
          {
            type: 'field_dropdown',
            name: 'AXIS',
            options: [getDropdownOption('X'), getDropdownOption('Z')],
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
        previousStatement: null,
        nextStatement: null,
        inputsInline: true,
        colour: categoryColours['Scene'],
        tooltip: getTooltip('create_wedge'),
      });
      this.setHelpUrl(getHelpUrlFor(this.type));
      this.setStyle('scene_blocks');

      // Set up the change handler.
      registerBlockHandler(this, (changeEvent) =>
        handleBlockChange(this, changeEvent, variableNamePrefix)
      );
      // Add the mutator with toggle behaviour.
      addDoMutatorWithToggleBehavior(this);
      addInitialTransformRows(this);
    },
  };

  Blockly.Blocks['create_freeform'] = {
    init: function () {
      const variableNamePrefix = 'freeform';
      let nextVariableName = variableNamePrefix + nextVariableIndexes[variableNamePrefix];
      this.jsonInit({
        type: 'create_freeform',
        message0: translate('create_freeform'),
        args0: [
          {
            type: 'field_variable',
            name: 'ID_VAR',
            variable: nextVariableName,
          },
          {
            type: 'input_value',
            name: 'COLOR',
            check: ['Colour', 'Material'],
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
            type: 'field_checkbox',
            name: 'EDIT',
            checked: false,
          },
          {
            type: 'field_dropdown',
            name: 'ROUNDING',
            options: ROUNDINGS.map((rounding) => [
              translate(`freeform_rounding_${rounding}`),
              rounding,
            ]),
          },
          {
            type: 'input_dummy',
            name: 'ROUNDING_ROW',
          },
          {
            type: 'input_value',
            name: 'RADIUS',
            check: 'Number',
          },
        ],
        previousStatement: null,
        nextStatement: null,
        inputsInline: true,
        colour: categoryColours['Scene'],
        tooltip: getTooltip('create_freeform'),
      });
      this.setHelpUrl(getHelpUrlFor(this.type));
      this.setStyle('scene_blocks');
      this.getField('ROUNDING').setValidator((rounding) => {
        this.showRoundingInputs_(rounding);
        return rounding;
      });
      this.showRoundingInputs_('none');

      registerBlockHandler(this, (changeEvent) => {
        this.rejectBrokenShape_(changeEvent);
        if (changeEvent.blockId === this.id || changeEvent.type === Blockly.Events.FINISHED_LOADING) {
          setFreeformEditing(this, this.getFieldValue('EDIT') === 'TRUE' && !this.isInFlyout);
        }
        handleBlockChange(this, changeEvent, variableNamePrefix);
      });
      addDoMutatorWithToggleBehavior(this);
      this.faces_ = cloneFaces(CUBE_FACES);

      this.appendEndRowInput('POINTS_TOGGLE')
        .appendField(translate('freeform_points'))
        .appendField(
          new Blockly.FieldImage(DO_MUTATOR_PLUS, 24, 24, 'toggle points', () =>
            this.togglePoints_()
          ),
          'POINTS_BUTTON'
        );
      this.appendValueInput('VERTICES').setCheck('Array');
      this.setPointsShown_(false);

      const doMutationToDom = this.mutationToDom;
      const doDomToMutation = this.domToMutation;
      this.mutationToDom = function () {
        const container = doMutationToDom.call(this);
        if (this.pointsShown_) container.setAttribute('points', 'true');
        if (JSON.stringify(this.faces_) !== JSON.stringify(CUBE_FACES)) {
          container.setAttribute('faces', JSON.stringify(this.faces_));
        }
        return container;
      };
      this.domToMutation = function (xmlElement) {
        doDomToMutation.call(this, xmlElement);
        this.setPointsShown_(xmlElement.getAttribute('points') === 'true');
        this.faces_ = parseFaces(xmlElement.getAttribute('faces'));
      };
      // A freeform's size lives in its points, so like the other shapes it
      // gets a rotate row but no resize row.
      addInitialTransformRows(this);
      // The points row already ends its line, so the rotate row's own line
      // break is only needed below the point list.
      const syncRows = this.syncInitialTransformRows_;
      this.syncInitialTransformRows_ = this.syncOptionsRow_ = function () {
        syncRows.call(this);
        this.getInput('TRANSFORM_ROW').setVisible(this.optionsOpen_ && this.pointsShown_);
      };
      this.syncInitialTransformRows_();
    },

    // Radius only matters for edges.
    showRoundingInputs_: function (rounding) {
      this.getInput('RADIUS').setVisible(rounding === 'edges');
      if (this.rendered) this.queueRender();
    },

    // The rounding as createFreeform takes it. A radius worked out by code
    // can't be read here, so `codeRadius` stands in for it.
    getRounding: function (codeRadius) {
      const radiusBlock = this.getInputTargetBlock('RADIUS');
      const radius =
        radiusBlock?.type === 'math_number' ? Number(radiusBlock.getFieldValue('NUM')) : codeRadius;
      return roundingSettings({ rounding: this.getFieldValue('ROUNDING'), radius });
    },

    setPointsShown_: function (show) {
      this.pointsShown_ = show;
      this.getInput('VERTICES').setVisible(show);
      this.getField('POINTS_BUTTON')?.setValue(show ? DO_MUTATOR_MINUS : DO_MUTATOR_PLUS);
      this.syncInitialTransformRows_?.();
    },

    togglePoints_: function () {
      const oldState = Blockly.Xml.domToText(this.mutationToDom());
      this.setPointsShown_(!this.pointsShown_);
      if (this.rendered) {
        this.render();
        this.bumpNeighbours();
      }
      const newState = Blockly.Xml.domToText(this.mutationToDom());
      Blockly.Events.fire(
        new Blockly.Events.BlockChange(this, 'mutation', null, oldState, newState)
      );
    },

    getFaces: function () {
      return cloneFaces(this.faces_);
    },

    // Writes points and faces as one undo step, growing the list as needed.
    writeShape: function (points, faces) {
      const list = this.getInputTargetBlock('VERTICES');
      if (list?.type !== 'lists_create_with') return;

      const ownGroup = !Blockly.Events.getGroup();
      if (ownGroup) Blockly.Events.setGroup(true);
      try {
        const oldListState = extraStateText(list);
        while (list.itemCount_ < points.length) list.plus();
        while (list.itemCount_ > points.length) {
          list.getInputTargetBlock('ADD' + (list.itemCount_ - 1))?.dispose(false);
          list.minus();
        }
        const newListState = extraStateText(list);
        if (oldListState !== newListState) {
          Blockly.Events.fire(
            new Blockly.Events.BlockChange(list, 'mutation', null, oldListState, newListState)
          );
        }

        points.forEach((point, i) => {
          const input = list.getInput('ADD' + i);
          const numbers = vectorNumberBlocks(input.connection.targetBlock());
          if (numbers) {
            numbers.forEach((n, axis) => n.setFieldValue(String(point[axis]), 'NUM'));
            return;
          }
          input.connection.targetBlock()?.unplug(false);
          const vector = Blockly.serialization.blocks.append(vectorState(point), this.workspace);
          input.connection.connect(vector.outputConnection);
        });

        const oldState = extraStateText(this);
        this.faces_ = cloneFaces(faces);
        const newState = extraStateText(this);
        if (oldState !== newState) {
          Blockly.Events.fire(new Blockly.Events.BlockChange(this, 'mutation', null, oldState, newState));
        }
      } finally {
        if (ownGroup) Blockly.Events.setGroup(false);
      }
    },

    // Hand edits that would break the shape are undone straight away. Undo and
    // redo are skipped: every state on the stack was already checked.
    rejectBrokenShape_: function (event) {
      if (window.loadingCode || this.isInFlyout || !event.recordUndo || this.checkPending_) return;
      if (!touchesPointList(this, event)) return;
      this.checkPending_ = true;
      setTimeout(() => {
        this.checkPending_ = false;
        if (this.disposed) return;
        const points = this.getPoints();
        if (points === null) return;
        const error = points.some((p) => !p.every(Number.isFinite))
          ? 'missing point'
          : shapeError(points, this.faces_);
        if (!error) {
          this.setWarningText?.(null, 'freeform');
          return;
        }
        this.workspace.undo(false);
        const redo = this.workspace.getRedoStack();
        const group = redo.at(-1)?.group;
        do redo.pop();
        while (group && redo.at(-1)?.group === group);
        this.setWarningText?.(translate('freeform_invalid'), 'freeform');
      });
    },

    // Number blocks for each point's X/Y/Z, or null where a point isn't plain numbers.
    getPointNumberBlocks: function () {
      const list = this.getInputTargetBlock('VERTICES');
      if (list?.type !== 'lists_create_with') return [];
      return list.inputList
        .filter((input) => input.connection)
        .map((input) => vectorNumberBlocks(input.connection.targetBlock()));
    },

    // The points as [x, y, z], or null if any can only be worked out by running
    // the code. An empty slot reads as NaN so it counts as a broken point.
    getPoints: function () {
      const list = this.getInputTargetBlock('VERTICES');
      if (list?.type !== 'lists_create_with') return list ? null : [];
      const items = list.inputList
        .filter((input) => input.connection)
        .map((input) => input.connection.targetBlock());
      if (items.some((item) => item && !vectorNumberBlocks(item))) return null;
      return items.map((item) =>
        item ? vectorNumberBlocks(item).map((n) => Number(n.getFieldValue('NUM'))) : [NaN, NaN, NaN]
      );
    },
  };

  Blockly.Blocks['create_donut'] = {
    init: function () {
      const variableNamePrefix = 'donut';
      let nextVariableName = variableNamePrefix + nextVariableIndexes[variableNamePrefix];
      this.jsonInit({
        type: 'create_donut',
        message0: translate('create_donut'),
        args0: [
          {
            type: 'field_variable',
            name: 'ID_VAR',
            variable: nextVariableName,
          },
          {
            type: 'input_value',
            name: 'COLOR',
            check: ['Colour', 'Material'],
          },
          {
            type: 'input_value',
            name: 'DIAMETER',
            check: 'Number',
          },
          {
            type: 'input_value',
            name: 'INNER_DIAMETER',
            check: 'Number',
          },
          {
            type: 'input_value',
            name: 'THICKNESS',
            check: 'Number',
          },
          {
            type: 'input_value',
            name: 'SIDES',
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
        previousStatement: null,
        nextStatement: null,
        inputsInline: true,
        colour: categoryColours['Scene'],
        tooltip: getTooltip('create_donut'),
      });
      this.setHelpUrl(getHelpUrlFor(this.type));
      this.setStyle('scene_blocks');

      registerBlockHandler(this, (changeEvent) => {
        linkWallInputs(this, changeEvent);
        handleBlockChange(this, changeEvent, variableNamePrefix);
      });
      addDoMutatorWithToggleBehavior(this);
      addInitialTransformRows(this);
    },
  };

  Blockly.Blocks['create_ring'] = {
    init: function () {
      const variableNamePrefix = 'ring';
      let nextVariableName = variableNamePrefix + nextVariableIndexes[variableNamePrefix];
      this.jsonInit({
        type: 'create_ring',
        message0: translate('create_ring'),
        args0: [
          {
            type: 'field_variable',
            name: 'ID_VAR',
            variable: nextVariableName,
          },
          {
            type: 'input_value',
            name: 'COLOR',
            check: ['Colour', 'Material'],
          },
          {
            type: 'input_value',
            name: 'HEIGHT',
            check: 'Number',
          },
          {
            type: 'input_value',
            name: 'DIAMETER',
            check: 'Number',
          },
          {
            type: 'input_value',
            name: 'INNER_DIAMETER',
            check: 'Number',
          },
          {
            type: 'input_value',
            name: 'THICKNESS',
            check: 'Number',
          },
          {
            type: 'input_value',
            name: 'SIDES',
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
        previousStatement: null,
        nextStatement: null,
        inputsInline: true,
        colour: categoryColours['Scene'],
        tooltip: getTooltip('create_ring'),
      });
      this.setHelpUrl(getHelpUrlFor(this.type));
      this.setStyle('scene_blocks');

      registerBlockHandler(this, (changeEvent) => {
        linkWallInputs(this, changeEvent);
        handleBlockChange(this, changeEvent, variableNamePrefix);
      });
      addDoMutatorWithToggleBehavior(this);
      addInitialTransformRows(this);
    },
  };

  Blockly.Blocks['create_plane'] = {
    init: function () {
      const variableNamePrefix = 'plane';
      let nextVariableName = variableNamePrefix + nextVariableIndexes[variableNamePrefix];
      this.jsonInit({
        type: 'create_plane',
        message0: translate('create_plane'),
        args0: [
          {
            type: 'field_variable',
            name: 'ID_VAR',
            variable: nextVariableName,
          },
          {
            type: 'input_value',
            name: 'COLOR',
            check: ['Colour', 'Material'],
          },
          {
            type: 'input_value',
            name: 'WIDTH',
            check: 'Number',
          },
          {
            type: 'input_value',
            name: 'HEIGHT',
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
        previousStatement: null,
        nextStatement: null,
        inputsInline: true,
        colour: categoryColours['Scene'],
        tooltip: getTooltip('create_plane'),
      });
      this.setHelpUrl(getHelpUrlFor(this.type));
      this.setStyle('scene_blocks');

      // Set up the change handler.
      registerBlockHandler(this, (changeEvent) =>
        handleBlockChange(this, changeEvent, variableNamePrefix)
      );
      // Add the mutator with toggle behaviour.
      addDoMutatorWithToggleBehavior(this);
      addInitialTransformRows(this);
    },
  };

  Blockly.Blocks['create_group'] = {
    init: function () {
      const variableNamePrefix = 'group';
      let nextVariableName = variableNamePrefix + nextVariableIndexes[variableNamePrefix];
      this.jsonInit({
        type: 'create_group',
        message0: translate('create_group'),
        args0: [
          {
            type: 'field_variable',
            name: 'ID_VAR',
            variable: nextVariableName,
          },
          {
            type: 'field_checkbox',
            name: 'ACTIVE',
            checked: true,
          },
        ],
        previousStatement: null,
        nextStatement: null,
        inputsInline: true,
        colour: categoryColours['Transform'],
        tooltip: getTooltip('create_group'),
      });
      this.setHelpUrl(getHelpUrlFor(this.type));
      this.setStyle('transform_blocks');

      registerBlockHandler(this, (changeEvent) =>
        handleBlockChange(this, changeEvent, variableNamePrefix)
      );
      this.appendStatementInput('DO').setCheck(null).appendField('');
    },
  };

  Blockly.Blocks['control_particle_system'] = {
    init: function () {
      this.jsonInit({
        type: 'particle_system_control',
        message0: translate('control_particle_system'),
        args0: [
          {
            type: 'field_variable',
            name: 'SYSTEM_NAME',
            variable: window.currentMesh,
          },
          {
            type: 'field_dropdown',
            name: 'ACTION',
            options: [
              getDropdownOption('start'),
              getDropdownOption('stop'),
              getDropdownOption('reset'),
            ],
          },
        ],
        inputsInline: true,
        previousStatement: null,
        nextStatement: null,
        colour: categoryColours['Scene'],
        tooltip: getTooltip('control_particle_system'),
        helpUrl: '',
      });
      this.setHelpUrl(getHelpUrlFor(this.type));
      this.setStyle('scene_blocks');
    },
  };
}
