import { expect } from 'chai';
import * as Blockly from 'blockly';
import { injectTestWorkspace, disposeTestWorkspace } from './utils/blocklyTestUtils.js';
import { defineAnimateBlocks } from '../blocks/animate.js';
import { defineModelBlocks } from '../blocks/models.js';
import { defineShapeBlocks } from '../blocks/shapes.js';
import { animationWarningFor, installAnimationWarnings } from '../blocks/animationWarnings.js';
import {
  characterNames,
  modelAnimations,
  modelNames,
  multiObjectNames,
  objectNames,
} from '../config.js';

const animation = (ANIMATION_NAME) => ({
  shadow: { type: 'animation_name', fields: { ANIMATION_NAME } },
});

function playState(name, varId, type = 'play_animation') {
  return { type, fields: { MODEL: { id: varId } }, inputs: { ANIMATION_NAME: animation(name) } };
}

async function glbAnimationNames(file) {
  const buffer = await (await fetch(`/models/${file}`)).arrayBuffer();
  const view = new DataView(buffer);
  const json = new TextDecoder().decode(new Uint8Array(buffer, 20, view.getUint32(12, true)));
  return (JSON.parse(json).animations ?? []).map((group) => group.name).sort();
}

export function runAnimationWarningsTests() {
  describe('blocks/animationWarnings @animationwarnings', function () {
    before(function () {
      if (!Blockly.Blocks['load_model']) defineModelBlocks();
      if (!Blockly.Blocks['create_box']) defineShapeBlocks();
      if (!Blockly.Blocks['play_animation']) defineAnimateBlocks();
    });

    describe('animationWarningFor', function () {
      let workspace;

      beforeEach(function () {
        workspace = new Blockly.Workspace();
        workspace.createVariable('thing', '', 'thing-id');
      });

      afterEach(function () {
        workspace.dispose();
      });

      const append = (state) => Blockly.serialization.blocks.append(state, workspace);
      const creator = (type, MODELS) =>
        append({ type, fields: { ID_VAR: { id: 'thing-id' }, ...(MODELS && { MODELS }) } });

      it('names the missing animation and lists what the model has', function () {
        creator('load_model', 'Flock.glb');
        const text = animationWarningFor(append(playState('Dance1', 'thing-id')));
        expect(text).to.include('Flock bird');
        expect(text).to.include('dance1');
        expect(text).to.include('fly, idle, walk, wave');
      });

      it('has no warning when the model has the animation', function () {
        creator('load_model', 'Flock.glb');
        expect(animationWarningFor(append(playState('Fly', 'thing-id')))).to.equal(null);
        expect(
          animationWarningFor(append(playState('Fly', 'thing-id', 'switch_animation')))
        ).to.equal(null);
      });

      it('warns on switch animation too', function () {
        creator('load_model', 'lion.glb');
        const block = append(playState('Walk', 'thing-id', 'switch_animation'));
        expect(animationWarningFor(block)).to.include('walk');
      });

      it('says an object without animations has none, whatever the name', function () {
        creator('load_multi_object', 'tree.glb');
        expect(animationWarningFor(append(playState('Idle', 'thing-id')))).to.include(
          "doesn't have any animations"
        );
        creator('load_object', 'Star.glb');
        expect(animationWarningFor(append(playState('Idle', 'thing-id')))).to.include('Star');
      });

      it('lets an airplane fly', function () {
        creator('load_multi_object', 'airplane.glb');
        expect(animationWarningFor(append(playState('Fly', 'thing-id')))).to.equal(null);
      });

      it('warns that shapes have no animations', function () {
        creator('create_box');
        expect(animationWarningFor(append(playState('Walk', 'thing-id')))).to.include('Shapes');
      });

      it('has no warning for characters', function () {
        creator('load_character', 'Liz1.glb');
        expect(animationWarningFor(append(playState('Dance1', 'thing-id')))).to.equal(null);
      });

      it('has no warning when the variable is only set at runtime', function () {
        append({
          type: 'variables_set',
          fields: { VAR: { id: 'thing-id' } },
          inputs: { VALUE: { block: { type: 'text', fields: { TEXT: 'bird' } } } },
        });
        expect(animationWarningFor(append(playState('Dance1', 'thing-id')))).to.equal(null);
      });

      it('checks a plain text animation name but not a computed one', function () {
        creator('load_model', 'Bunny.glb');
        const textName = append({
          type: 'play_animation',
          fields: { MODEL: { id: 'thing-id' } },
          inputs: { ANIMATION_NAME: { block: { type: 'text', fields: { TEXT: 'Run' } } } },
        });
        expect(animationWarningFor(textName)).to.include('run');

        workspace.createVariable('which', '', 'which-id');
        const computed = append({
          type: 'play_animation',
          fields: { MODEL: { id: 'thing-id' } },
          inputs: {
            ANIMATION_NAME: {
              block: { type: 'variables_get', fields: { VAR: { id: 'which-id' } } },
            },
          },
        });
        expect(animationWarningFor(computed)).to.equal(null);
      });
    });

    describe('installAnimationWarnings', function () {
      let workspace;
      let container;

      const nextFrame = () => new Promise((resolve) => requestAnimationFrame(resolve));
      const flushEvents = async () => {
        await new Promise((resolve) => setTimeout(resolve, 20));
        await nextFrame();
        await nextFrame();
      };
      const warningText = (block) =>
        block
          .getIcons()
          .map((icon) => icon.getText?.() ?? '')
          .join('\n');

      beforeEach(function () {
        container = document.createElement('div');
        container.style.width = '300px';
        container.style.height = '200px';
        document.body.appendChild(container);
        workspace = injectTestWorkspace(container, {});
        workspace.createVariable('bird', '', 'bird-id');
        installAnimationWarnings(workspace);
      });

      afterEach(function () {
        disposeTestWorkspace(workspace);
        container.remove();
      });

      it('updates as the animation and model change', async function () {
        const model = Blockly.serialization.blocks.append(
          { type: 'load_model', fields: { ID_VAR: { id: 'bird-id' }, MODELS: 'Flock.glb' } },
          workspace
        );
        const play = Blockly.serialization.blocks.append(playState('Dance1', 'bird-id'), workspace);
        await flushEvents();
        expect(warningText(play)).to.include('dance1');

        play.getInputTargetBlock('ANIMATION_NAME').setFieldValue('Wave', 'ANIMATION_NAME');
        await flushEvents();
        expect(warningText(play)).to.equal('');

        model.setFieldValue('rhino.glb', 'MODELS');
        await flushEvents();
        expect(warningText(play)).to.include('wave');

        model.dispose();
        await flushEvents();
        expect(warningText(play)).to.equal('');
      });
    });

    describe('modelAnimations', function () {
      it('matches the animations inside every model file', async function () {
        const files = [...modelNames, ...objectNames, ...multiObjectNames].filter(
          (file) => !characterNames.includes(file)
        );
        const mismatches = [];
        for (const file of new Set(files)) {
          const actual = await glbAnimationNames(file);
          const expected = [...(modelAnimations[file] ?? [])].sort();
          if (actual.join() !== expected.join()) mismatches.push(`${file}: ${actual.join(', ')}`);
        }
        expect(mismatches).to.deep.equal([]);
      });
    });
  });
}
