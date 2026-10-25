import { expect } from 'chai';
import * as Blockly from 'blockly';
import { injectTestWorkspace, disposeTestWorkspace } from './utils/blocklyTestUtils.js';
import { defineMaterialsBlocks } from '../blocks/materials.js';
import { defineShapeBlocks } from '../blocks/shapes.js';
import { defineSameNumberBlock, SAME_NUMBER_TYPE } from '../blocks/initialTransformRows.js';
import { javascriptGenerator } from 'blockly/javascript';
import { registerSceneGenerators } from '../generators/generators-scene.js';
import { setNumberInputs } from '../ui/blocklyutil.js';
import {
  FieldRangedNumber,
  nudgeValue,
  rangeForField,
  registerRangedNumberField,
} from '../blocks/fieldRangedNumber.js';
import { defineBlocks } from '../blocks/blocks.js';
import { clampToRange, NUMBER_RANGES, RANGED_INPUTS, rangeForInput } from '../config.js';

const number = (NUM) => ({ shadow: { type: 'math_number', fields: { NUM } } });
const alphaState = (alpha) => ({ type: 'set_alpha', inputs: { ALPHA: number(alpha) } });

function key(target, keyName) {
  target.dispatchEvent(new KeyboardEvent('keydown', { key: keyName, bubbles: true }));
}

function typeInto(input, text) {
  input.value = text;
  input.dispatchEvent(new Event('input', { bubbles: true }));
}

export function runRangedNumberTests(flock) {
  describe('blocks/fieldRangedNumber @rangednumber', function () {
    before(function () {
      registerRangedNumberField();
      if (!Blockly.Blocks['set_alpha']) defineMaterialsBlocks();
      if (!Blockly.Blocks['create_particle_effect']) defineShapeBlocks();
    });

    describe('range table', function () {
      it('names an existing input or field for every ranged input', function () {
        if (!Blockly.Blocks['create_box']) defineBlocks();
        const workspace = new Blockly.Workspace();
        try {
          const missing = Object.keys(RANGED_INPUTS).filter((key) => {
            const [type, name] = key.split('.');
            if (!Blockly.Blocks[type]) return true;
            const block = workspace.newBlock(type);
            return !block.getInput(name) && !block.getField(name);
          });
          expect(missing).to.deep.equal([]);
        } finally {
          workspace.dispose();
        }
      });

      it('looks up ranges by block type and input name', function () {
        expect(rangeForInput('set_alpha', 'ALPHA')).to.equal(NUMBER_RANGES.unit);
        expect(rangeForInput('play_sound', 'SPEED')).to.equal(NUMBER_RANGES.soundSpeed);
        expect(rangeForInput('note', 'PITCH')).to.equal(NUMBER_RANGES.midiNote);
        expect(rangeForInput('speak', 'PITCH')).to.equal(NUMBER_RANGES.speechPitch);
        expect(rangeForInput('create_instrument', 'RELEASE')).to.equal(NUMBER_RANGES.release);
        expect(rangeForInput('material', 'ANGLE')).to.equal(NUMBER_RANGES.angle);
        expect(rangeForInput('load_model', 'SIZE_X')).to.equal(NUMBER_RANGES.nonNegative);
        expect(rangeForInput('clone_mesh', 'SIZE_Z')).to.equal(NUMBER_RANGES.nonNegative);
        expect(rangeForInput('set_alpha', 'MESH')).to.equal(null);
        expect(rangeForInput('move_by_xyz', 'X')).to.equal(null);
      });

      it('clamps to the named range', function () {
        expect(clampToRange(2, 'unit')).to.equal(1);
        expect(clampToRange(-1, 'unit')).to.equal(0);
        expect(clampToRange(0.25, 'unit')).to.equal(0.25);
        expect(clampToRange(10, 'soundSpeed')).to.equal(3);
      });

      it('nudges along the step grid without floating point noise', function () {
        expect(nudgeValue(0.5, 1, NUMBER_RANGES.unit)).to.equal(0.55);
        expect(nudgeValue(0.33, 1, NUMBER_RANGES.unit)).to.equal(0.4);
        expect(nudgeValue(0.33, -1, NUMBER_RANGES.unit)).to.equal(0.3);
        expect(nudgeValue(1, 1, NUMBER_RANGES.unit)).to.equal(1);
        expect(nudgeValue(0, -1, NUMBER_RANGES.unit)).to.equal(0);
        expect(nudgeValue(5, -1, NUMBER_RANGES.unit)).to.equal(0.95);
        expect(nudgeValue(0.1, 1, NUMBER_RANGES.soundSpeed)).to.equal(0.2);
        expect(nudgeValue(60, 1, NUMBER_RANGES.midiNote)).to.equal(61);
        expect(nudgeValue(127, 1, NUMBER_RANGES.midiNote)).to.equal(127);
        expect(nudgeValue(5, 1, NUMBER_RANGES.effectRate)).to.equal(5.1);
        expect(nudgeValue(-30, 1, NUMBER_RANGES.particleAngle)).to.equal(-29);
        expect(nudgeValue(359, 1, NUMBER_RANGES.angle)).to.equal(0);
        expect(nudgeValue(0, -1, NUMBER_RANGES.angle)).to.equal(359);
        expect(nudgeValue(400, 1, NUMBER_RANGES.angle)).to.equal(41);
        expect(nudgeValue(360, 1, NUMBER_RANGES.particleAngle)).to.equal(361);
      });
    });

    describe('field lookup', function () {
      let workspace;

      beforeEach(function () {
        workspace = new Blockly.Workspace();
      });

      afterEach(function () {
        workspace.dispose();
      });

      it('makes every math_number field a ranged number field', function () {
        const block = workspace.newBlock('math_number');
        expect(block.getField('NUM')).to.be.instanceOf(FieldRangedNumber);
      });

      it('finds the range of the input a number is plugged into', function () {
        const setAlpha = Blockly.serialization.blocks.append(alphaState(0.5), workspace);
        const field = setAlpha.getInputTargetBlock('ALPHA').getField('NUM');
        expect(rangeForField(field)).to.equal(NUMBER_RANGES.unit);
      });

      it('finds the range of a number field on the block itself', function () {
        const gradient = workspace.newBlock('gradient_colour');
        expect(rangeForField(gradient.getField('DIRECTION'))).to.equal(NUMBER_RANGES.angle);
      });

      it('has no range for a loose number', function () {
        const field = workspace.newBlock('math_number').getField('NUM');
        expect(rangeForField(field)).to.equal(null);
      });

      it('only ever generates numeric code from saved number fields', function () {
        if (!Blockly.Blocks[SAME_NUMBER_TYPE]) defineSameNumberBlock();
        registerSceneGenerators(javascriptGenerator);
        const payloads = [
          '1);alert(1)//',
          'alert(1)',
          'globalThis',
          '1;fetch("x")',
          '{}',
          '[]',
          'NaN',
          ' ',
          '0x1F',
          '1e3',
          'Infinity',
          '-Infinity',
        ];
        const numeric = /^(null|-?Infinity|-?\d+(\.\d+)?(e[+-]?\d+)?)$/;
        for (const type of ['math_number', SAME_NUMBER_TYPE]) {
          for (const NUM of payloads) {
            const block = Blockly.serialization.blocks.append({ type, fields: { NUM } }, workspace);
            const [code] = javascriptGenerator.forBlock[type](block, javascriptGenerator);
            expect(code, `${type} ${NUM}`).to.match(numeric);
          }
        }
      });

      it('only loads numbers from a crafted project file', function () {
        if (!Blockly.Blocks[SAME_NUMBER_TYPE]) defineSameNumberBlock();
        registerSceneGenerators(javascriptGenerator);
        const payloads = [
          'Infinity;alert(1)',
          'Infinity//',
          'infinityx',
          'Infinity)+alert(1',
          '-Infinity,alert(1)',
          '1e400',
          'INFINITY',
        ];
        const blocks = payloads.flatMap((NUM, i) => [
          { type: 'math_number', id: `n${i}`, x: 0, y: i * 40, fields: { NUM } },
          { type: SAME_NUMBER_TYPE, id: `s${i}`, x: 200, y: i * 40, fields: { NUM } },
        ]);
        const file = JSON.stringify({ blocks: { languageVersion: 0, blocks } });
        const loaded = new Blockly.Workspace();
        try {
          Blockly.serialization.workspaces.load(JSON.parse(file), loaded);
          const numeric = /^(null|-?Infinity|-?\d+(\.\d+)?(e[+-]?\d+)?)$/;
          for (const block of loaded.getAllBlocks(false)) {
            const [code] = javascriptGenerator.forBlock[block.type](block, javascriptGenerator);
            expect(code, `${block.id}`).to.match(numeric);
          }
          expect(loaded.getBlockById('n5').getFieldValue('NUM')).to.equal(Infinity);
          expect(loaded.getBlockById('n6').getFieldValue('NUM')).to.equal(Infinity);
        } finally {
          loaded.dispose();
        }
      });

      it('generates numeric code even if field validation is bypassed', function () {
        registerSceneGenerators(javascriptGenerator);
        for (const type of ['math_number', SAME_NUMBER_TYPE]) {
          const block = { getFieldValue: () => 'alert(1)' };
          const [code] = javascriptGenerator.forBlock[type](block, javascriptGenerator);
          expect(code).to.equal('NaN');
        }
      });

      it('keeps infinite numbers through a JSON save and load', function () {
        for (const value of [Infinity, -Infinity]) {
          const block = workspace.newBlock('math_number');
          block.setFieldValue(value, 'NUM');
          const saved = JSON.parse(JSON.stringify(Blockly.serialization.blocks.save(block)));
          const loaded = Blockly.serialization.blocks.append(saved, workspace);
          expect(loaded.getFieldValue('NUM')).to.equal(value);
        }
        const finite = workspace.newBlock('math_number');
        finite.setFieldValue(1e300, 'NUM');
        expect(Blockly.serialization.blocks.save(finite).fields.NUM).to.equal(1e300);
      });

      it('keeps gizmo writes within the hard ranges', function () {
        if (!Blockly.Blocks['load_model']) defineBlocks();
        const model = Blockly.serialization.blocks.append(
          { type: 'load_model', inputs: { SCALE: number(1), X: number(0) } },
          workspace
        );
        const scale = () => model.getInputTargetBlock('SCALE').getFieldValue('NUM');
        setNumberInputs(model, { SCALE: 150 });
        expect(scale()).to.equal(100);
        setNumberInputs(model, { SCALE: 0.001 });
        expect(scale()).to.equal(0.01);
        setNumberInputs(model, { SCALE: 2.5 });
        expect(scale()).to.equal(2.5);
        setNumberInputs(model, { X: 5000 });
        expect(model.getInputTargetBlock('X').getFieldValue('NUM')).to.equal(5000);
      });

      it('leaves an out-of-range saved value alone on load', function () {
        const setAlpha = Blockly.serialization.blocks.append(alphaState(2), workspace);
        expect(setAlpha.getInputTargetBlock('ALPHA').getFieldValue('NUM')).to.equal(2);
      });
    });

    describe('editor', function () {
      let container;
      let workspace;

      beforeEach(function () {
        container = document.createElement('div');
        container.style.width = '400px';
        container.style.height = '300px';
        document.body.appendChild(container);
        workspace = injectTestWorkspace(container, {});
      });

      afterEach(function () {
        Blockly.WidgetDiv.hide();
        Blockly.DropDownDiv.hideWithoutAnimation();
        disposeTestWorkspace(workspace);
        container.remove();
      });

      function openAlpha(alpha) {
        const setAlpha = Blockly.serialization.blocks.append(alphaState(alpha), workspace);
        const field = setAlpha.getInputTargetBlock('ALPHA').getField('NUM');
        field.showEditor();
        return field;
      }

      const slider = () => Blockly.DropDownDiv.getContentDiv().querySelector('input[type=range]');

      it('shows a slider below a focused text box', function () {
        const field = openAlpha(0.5);
        expect(slider()).to.exist;
        expect(slider().min).to.equal('0');
        expect(slider().max).to.equal('1');
        expect(slider().value).to.equal('0.5');
        expect(document.activeElement).to.equal(field.htmlInput_);
      });

      it('snaps a typed value to the range when confirmed', function () {
        const field = openAlpha(0.5);
        typeInto(field.htmlInput_, '5');
        key(field.htmlInput_, 'Enter');
        expect(field.getValue()).to.equal(1);
        expect(Blockly.WidgetDiv.isVisible()).to.equal(false);
        expect(Blockly.DropDownDiv.isVisible()).to.equal(false);
      });

      it('does not snap a typed angle', function () {
        const particle = Blockly.serialization.blocks.append(
          { type: 'create_particle_effect', inputs: { MIN_INITIAL_ROTATION: number(0) } },
          workspace
        );
        const field = particle.getInputTargetBlock('MIN_INITIAL_ROTATION').getField('NUM');
        field.showEditor();
        expect(slider().max).to.equal('359');
        typeInto(field.htmlInput_, '-45');
        key(field.htmlInput_, 'Enter');
        expect(field.getValue()).to.equal(-45);
      });

      it('wraps a typed material angle into 0-360', function () {
        const material = Blockly.serialization.blocks.append(
          { type: 'material', inputs: { ANGLE: number(0) } },
          workspace
        );
        const field = material.getInputTargetBlock('ANGLE').getField('NUM');
        field.showEditor();
        expect(slider().max).to.equal('359');
        typeInto(field.htmlInput_, '400');
        expect(field.getValue()).to.equal(40);
        typeInto(field.htmlInput_, '-90');
        key(field.htmlInput_, 'Enter');
        expect(field.getValue()).to.equal(270);
      });

      it('wraps a typed gradient direction into 0-360', function () {
        const gradient = workspace.newBlock('gradient_colour');
        gradient.initSvg();
        gradient.render();
        const field = gradient.getField('DIRECTION');
        field.showEditor();
        expect(slider()).to.exist;
        typeInto(field.htmlInput_, '400');
        key(field.htmlInput_, 'Enter');
        expect(field.getValue()).to.equal(40);
      });

      it('keeps the precision of a typed value', function () {
        const field = openAlpha(0.5);
        typeInto(field.htmlInput_, '0.123');
        key(field.htmlInput_, 'Enter');
        expect(field.getValue()).to.equal(0.123);
      });

      it('snaps a saved out-of-range value only once it is edited', function () {
        const field = openAlpha(2);
        expect(field.getValue()).to.equal(2);
        typeInto(field.htmlInput_, '3');
        key(field.htmlInput_, 'Enter');
        expect(field.getValue()).to.equal(1);
      });

      it('steps the value with the arrow keys', function () {
        const field = openAlpha(0.5);
        key(field.htmlInput_, 'ArrowUp');
        expect(field.getValue()).to.equal(0.55);
        expect(field.htmlInput_.value).to.equal('0.55');
        expect(slider().value).to.equal('0.55');
        key(field.htmlInput_, 'ArrowDown');
        key(field.htmlInput_, 'ArrowDown');
        expect(field.getValue()).to.equal(0.45);
      });

      it('updates the value and text box from the slider', function () {
        const field = openAlpha(0.5);
        slider().value = '0.2';
        slider().dispatchEvent(new Event('input', { bubbles: true }));
        expect(field.getValue()).to.equal(0.2);
        expect(field.htmlInput_.value).to.equal('0.2');
      });

      it('restores the original value on Escape', function () {
        const field = openAlpha(0.5);
        key(field.htmlInput_, 'ArrowUp');
        key(field.htmlInput_, 'Escape');
        expect(field.getValue()).to.equal(0.5);
        expect(Blockly.DropDownDiv.isVisible()).to.equal(false);
      });

      it('records one undo step for a slider edit', async function () {
        const field = openAlpha(0.5);
        workspace.clearUndo();
        slider().value = '0.2';
        slider().dispatchEvent(new Event('input', { bubbles: true }));
        slider().value = '0.3';
        slider().dispatchEvent(new Event('input', { bubbles: true }));
        key(field.htmlInput_, 'Enter');
        await new Promise((resolve) => requestAnimationFrame(() => setTimeout(resolve, 0)));
        expect(workspace.getUndoStack()).to.have.length(1);
        workspace.undo(false);
        expect(field.getValue()).to.equal(0.5);
      });

      it('drops the range once the editor closes', function () {
        const setAlpha = workspace.newBlock('set_alpha');
        setAlpha.initSvg();
        setAlpha.render();
        const block = workspace.newBlock('math_number');
        block.initSvg();
        block.render();
        setAlpha.getInput('ALPHA').connection.connect(block.outputConnection);
        const field = block.getField('NUM');
        field.showEditor();
        key(field.htmlInput_, 'Enter');
        block.unplug();
        field.setValue(5);
        expect(field.getValue()).to.equal(5);
      });

      it('snaps a negative size to 0 without a slider', function () {
        const box = Blockly.serialization.blocks.append(
          { type: 'create_box', inputs: { WIDTH: number(1) } },
          workspace
        );
        const field = box.getInputTargetBlock('WIDTH').getField('NUM');
        field.showEditor();
        expect(Blockly.DropDownDiv.isVisible()).to.equal(false);
        typeInto(field.htmlInput_, '-3');
        key(field.htmlInput_, 'Enter');
        expect(field.getValue()).to.equal(0);
        field.showEditor();
        typeInto(field.htmlInput_, '5000');
        key(field.htmlInput_, 'Enter');
        expect(field.getValue()).to.equal(5000);
      });

      it('gives sides a 3-64 slider', function () {
        const ring = Blockly.serialization.blocks.append(
          { type: 'create_ring', inputs: { SIDES: number(24) } },
          workspace
        );
        const field = ring.getInputTargetBlock('SIDES').getField('NUM');
        field.showEditor();
        expect(slider().min).to.equal('3');
        expect(slider().max).to.equal('64');
        typeInto(field.htmlInput_, '1000');
        key(field.htmlInput_, 'Enter');
        expect(field.getValue()).to.equal(64);
      });

      it('edits a loose number as a plain number', function () {
        const block = workspace.newBlock('math_number');
        block.initSvg();
        block.render();
        const field = block.getField('NUM');
        field.setValue(7);
        field.showEditor();
        expect(Blockly.DropDownDiv.isVisible()).to.equal(false);
        typeInto(field.htmlInput_, '42');
        key(field.htmlInput_, 'Enter');
        expect(field.getValue()).to.equal(42);
      });
    });

    describe('API clamps', function () {
      it('caps sides at 64 and treats negative sizes as the minimum', function () {
        expect(flock.donutDimensions({ tessellation: 1000 }).tessellation).to.equal(64);
        expect(flock.donutDimensions({ tessellation: 1 }).tessellation).to.equal(3);
        expect(flock.donutDimensions({ diameter: -2 }).diameter).to.equal(0.01);
      });

      it('keeps light intensity at 0 or above', function () {
        const previous = flock.mainLight.intensity;
        try {
          flock.lightIntensity(-1);
          expect(flock.mainLight.intensity).to.equal(0);
        } finally {
          flock.lightIntensity(previous);
        }
      });

      it('treats a negative resize as the smallest size', async function () {
        const boxId = flock.createBox('rangedResizeBox', { width: 1, height: 1, depth: 1 });
        try {
          await flock.resize(boxId, { width: -2, height: 1, depth: 1 });
          expect(flock.scene.getMeshByName(boxId).scaling.x).to.equal(0.01);
        } finally {
          flock.dispose(boxId);
        }
      });

      it('treats a negative scale as the smallest scale', async function () {
        const boxId = flock.createBox('rangedScaleBox', { width: 1, height: 1, depth: 1 });
        try {
          await flock.scale(boxId, { x: -2, y: 1, z: 1 });
          expect(flock.scene.getMeshByName(boxId).scaling.x).to.equal(0.01);
        } finally {
          flock.dispose(boxId);
        }
      });

      it('clamps fog density to 0-1', function () {
        flock.setFog({ fogColorHex: '#ffffff', fogMode: 'EXP', fogDensity: 4 });
        expect(flock.scene.fogDensity).to.equal(1);
        flock.setFog({ fogColorHex: '#ffffff', fogMode: 'NONE', fogDensity: 0.1 });
      });

      it('clamps particle alphas to 0-1 and rate to 0-500', async function () {
        this.timeout(5000);
        const emitterId = flock.createBox('rangedEmitter', {
          color: '#ffffff',
          width: 1,
          height: 1,
          depth: 1,
          position: [0, 0, 0],
        });
        const effectName = flock.createParticleEffect('rangedEffect', {
          emitterMesh: emitterId,
          emitRate: 1000,
          colors: { start: '#ffffff', end: '#ffffff' },
          alphas: { start: 3, end: -1 },
          sizes: { start: 1, end: 1 },
          lifetime: { min: 0.1, max: 0.2 },
          shape: 'flare.png',
        });
        try {
          await flock.modelReadyPromises.get(effectName);
          const system = flock.scene.particleSystems.find((s) => s.name === effectName);
          expect(system.color1.a).to.equal(1);
          expect(system.color2.a).to.equal(0);
          expect(system.emitRate).to.equal(500);
        } finally {
          flock.scene.particleSystems.find((s) => s.name === effectName)?.dispose();
          flock.dispose(emitterId);
        }
      });

      it('keeps a valid particle rate when none is given', async function () {
        const emitterId = flock.createBox('rangedRatelessEmitter', {
          width: 1,
          height: 1,
          depth: 1,
        });
        const effectName = flock.createParticleEffect('rangedRatelessEffect', {
          emitterMesh: emitterId,
          colors: { start: '#ffffff', end: '#ffffff' },
          alphas: { start: 1, end: 0 },
          sizes: { start: 1, end: 1 },
          lifetime: { min: 0.1, max: 0.2 },
          shape: 'flare.png',
        });
        try {
          await flock.modelReadyPromises.get(effectName);
          const system = flock.scene.particleSystems.find((s) => s.name === effectName);
          expect(Number.isFinite(system.emitRate)).to.equal(true);
        } finally {
          flock.scene.particleSystems.find((s) => s.name === effectName)?.dispose();
          flock.dispose(emitterId);
        }
      });

      it('places characters beyond 1000 without clamping', async function () {
        this.timeout(15000);
        const id = flock.createCharacter({
          modelName: 'Liz3.glb',
          modelId: 'rangedFarLiz',
          position: { x: 2000, y: 0, z: -3000 },
        });
        try {
          const mesh = await flock.whenModelReady(id);
          expect(mesh.position.x).to.be.closeTo(2000, 0.01);
          expect(mesh.position.z).to.be.closeTo(-3000, 0.01);
        } finally {
          flock.dispose(id);
        }
      });

      it('caps camera distance at 5000', async function () {
        const targetId = flock.createBox('rangedCameraTarget', { width: 1, height: 1, depth: 1 });
        const name = flock.createCamera('rangedFarCamera', {
          type: 'follow',
          target: targetId,
          distance: 99999,
        });
        try {
          const camera = await flock.scene.getMeshByName(name).metadata.cameraReady;
          expect(camera.radius).to.equal(5000);
        } finally {
          flock.dispose(name);
          flock.dispose(targetId);
        }
      });

      it('clamps MIDI notes to 0-127', function () {
        expect(flock.midiToFrequency(200)).to.equal(flock.midiToFrequency(127));
        expect(flock.midiToFrequency(-5)).to.equal(flock.midiToFrequency(0));
        expect(flock.midiToFrequency(69)).to.equal(440);
      });

      it('clamps material alpha to 0-1', function () {
        const material = flock.getOrCreateMaterial({ color: '#13579b', alpha: 3 });
        expect(material.alpha).to.equal(1);
      });

      it('clamps a numeric-string material alpha', function () {
        const material = flock.getOrCreateMaterial({ color: '#2468ac', alpha: '3' });
        expect(material.alpha).to.equal(1);
      });
    });
  });
}
