import { expect } from 'chai';
import * as Blockly from 'blockly';
import { javascriptGenerator } from 'blockly/javascript';
import { defineModelBlocks } from '../blocks/models.js';
import { defineShapeBlocks } from '../blocks/shapes.js';
import { defineSceneBlocks } from '../blocks/scene.js';
import { defineTextBlocks } from '../blocks/text.js';
import { registerTextGenerators } from '../generators/generators-text.js';
import { registerSceneGenerators } from '../generators/generators-scene.js';
import { DO_MUTATOR_MINUS, DO_MUTATOR_PLUS } from '../blocks/blocks.js';

export function runInitialTransformRowsTests() {
  describe('add block rotate and resize rows @initialtransformrows', function () {
    let ws;
    let savedLoadingCode;

    before(function () {
      if (!Blockly.Blocks['load_model']) defineModelBlocks();
      if (!Blockly.Blocks['create_box']) defineShapeBlocks();
      if (!Blockly.Blocks['clone_mesh']) defineSceneBlocks();
      if (!Blockly.Blocks['create_3d_text']) defineTextBlocks();
      registerSceneGenerators(javascriptGenerator);
      registerTextGenerators(javascriptGenerator);
    });

    beforeEach(function () {
      savedLoadingCode = window.loadingCode;
      window.loadingCode = true;
      ws = new Blockly.Workspace();
    });

    afterEach(function () {
      ws.dispose();
      window.loadingCode = savedLoadingCode;
    });

    const number = (value) => ({ shadow: { type: 'math_number', fields: { NUM: value } } });

    function makeBox(extraState) {
      return Blockly.serialization.blocks.append(
        {
          type: 'create_box',
          ...(extraState ? { extraState } : {}),
          inputs: { X: number(0), Y: number(0), Z: number(0) },
        },
        ws
      );
    }

    function makeModel() {
      return Blockly.serialization.blocks.append(
        {
          type: 'load_model',
          fields: { MODELS: 'lion.glb' },
          inputs: { SCALE: number(1), X: number(0), Y: number(0), Z: number(0) },
        },
        ws
      );
    }

    const visible = (block, name) => block.getInput(name).isVisible();

    function generate(block) {
      javascriptGenerator.init(ws);
      return javascriptGenerator.blockToCode(block, true);
    }

    function reload(block) {
      const state = Blockly.serialization.blocks.save(block);
      block.dispose(false);
      return Blockly.serialization.blocks.append(state, ws);
    }

    it('hides the rotate row until + is pressed', function () {
      const box = makeBox();
      expect(visible(box, 'ROTATE_TOGGLE')).to.be.false;

      box.toggleMainSection();
      expect(visible(box, 'ROTATE_TOGGLE')).to.be.true;
      expect(visible(box, 'ROTATE_X')).to.be.false;
    });

    it('opens the row without DO, and the + on the row adds DO', function () {
      const box = makeBox();
      box.getField('TOGGLE_BUTTON').showEditor_();
      expect(visible(box, 'DO_TOGGLE')).to.be.true;
      expect(box.getInput('DO')).to.be.null;
      expect(box.getField('TOGGLE_BUTTON').getValue()).to.equal(DO_MUTATOR_MINUS);
      expect(box.getField('DO_BUTTON').getValue()).to.equal(DO_MUTATOR_PLUS);

      box.getField('DO_BUTTON').showEditor_();
      expect(visible(box, 'DO')).to.be.true;
      expect(box.getField('DO_BUTTON').getValue()).to.equal(DO_MUTATOR_MINUS);
      const names = box.inputList.map((input) => input.name);
      expect(names.indexOf('DO_TOGGLE')).to.be.lessThan(names.indexOf('DO'));

      box.getField('DO_BUTTON').showEditor_();
      expect(visible(box, 'DO')).to.be.false;
      expect(visible(box, 'ROTATE_TOGGLE')).to.be.true;
    });

    it('closes the row with DO and then, and reopens them as they were', function () {
      const box = makeBox();
      box.toggleDoBlock();
      box.toggleThenBlock();
      box.toggleMainSection();
      for (const name of ['DO_TOGGLE', 'DO', 'THEN', 'THEN_BUTTON']) {
        expect(visible(box, name)).to.be.false;
      }
      expect(box.getField('TOGGLE_BUTTON').getValue()).to.equal(DO_MUTATOR_PLUS);

      box.toggleMainSection();
      expect(visible(box, 'DO')).to.be.true;
      expect(visible(box, 'THEN')).to.be.true;
    });

    it('opens the row when DO is opened from code', function () {
      const box = makeBox();
      box.toggleDoBlock();
      expect(visible(box, 'ROTATE_TOGGLE')).to.be.true;
      expect(visible(box, 'DO')).to.be.true;
    });

    it('restores an open row without DO, and a closed row over DO', function () {
      const box = makeBox();
      box.toggleMainSection();
      const open = reload(box);
      expect(visible(open, 'ROTATE_TOGGLE')).to.be.true;
      expect(open.getInput('DO')).to.be.null;

      open.toggleDoBlock();
      open.toggleMainSection();
      const closed = reload(open);
      expect(visible(closed, 'ROTATE_TOGGLE')).to.be.false;
      expect(visible(closed, 'DO')).to.be.false;
      closed.toggleMainSection();
      expect(visible(closed, 'DO')).to.be.true;
    });

    it('loads an older closed DO with the row closed', function () {
      const box = makeBox('<mutation has_do="true" do_hidden="true"></mutation>');
      expect(visible(box, 'ROTATE_TOGGLE')).to.be.false;
      box.toggleMainSection();
      expect(visible(box, 'DO')).to.be.false;
    });

    it('shows x, y and z at 0 when rotate is pressed', function () {
      const box = makeBox();
      box.toggleMainSection();
      box.toggleRotate();

      for (const axis of ['X', 'Y', 'Z']) {
        expect(visible(box, `ROTATE_${axis}`)).to.be.true;
        expect(box.getInputTargetBlock(`ROTATE_${axis}`).getFieldValue('NUM')).to.equal(0);
      }
      expect(box.mutationToDom().getAttribute('rotate')).to.equal('true');
      expect(generate(box)).to.include('rotation: { x: 0, y: 0, z: 0 }');
    });

    it('generates nothing extra for a block without rows', function () {
      const code = generate(makeBox());
      expect(code).to.not.include('rotation');
      expect(code).to.not.include('size');
    });

    it('hides the rows when closed but keeps applying them', function () {
      const box = makeBox();
      box.toggleMainSection();
      box.toggleRotate();
      box.toggleMainSection();

      expect(visible(box, 'TRANSFORM_ROW')).to.be.false;
      expect(visible(box, 'ROTATE_TOGGLE')).to.be.false;
      expect(visible(box, 'ROTATE_Y')).to.be.false;
      expect(generate(box)).to.include('rotation: { x: 0, y: 0, z: 0 }');

      box.toggleMainSection();
      expect(visible(box, 'ROTATE_Y')).to.be.true;
    });

    it('hides the axis inputs when rotate is turned off', function () {
      const box = makeBox();
      box.toggleMainSection();
      box.toggleRotate();
      box.toggleRotate();

      expect(visible(box, 'ROTATE_TOGGLE')).to.be.true;
      expect(visible(box, 'ROTATE_X')).to.be.false;
      expect(generate(box)).to.not.include('rotation');
    });

    it('restores rotate and its values on load', function () {
      const box = makeBox();
      box.toggleRotate();
      box.getInputTargetBlock('ROTATE_Z').setFieldValue('45', 'NUM');

      const restored = reload(box);
      expect(visible(restored, 'ROTATE_X')).to.be.false;
      restored.toggleMainSection();
      expect(visible(restored, 'ROTATE_X')).to.be.true;
      expect(generate(restored)).to.include('rotation: { x: 0, y: 0, z: 45 }');
    });

    it('loads an existing project with a DO section unchanged', function () {
      const box = makeBox('<mutation has_do="true" has_then="false"></mutation>');
      expect(visible(box, 'DO')).to.be.true;
      expect(visible(box, 'ROTATE_TOGGLE')).to.be.true;
      expect(visible(box, 'ROTATE_X')).to.be.false;
      expect(generate(box)).to.not.include('rotation');
    });

    it('gives primitives no resize row', function () {
      expect(makeBox().getInput('RESIZE_TOGGLE')).to.be.null;
    });

    it('replaces scale with sizes when resize is on', function () {
      const model = makeModel();
      model.toggleMainSection();
      model.setResizeShown(true, { x: 2, y: 3.14, z: 4 });

      expect(visible(model, 'SCALE')).to.be.false;
      expect(visible(model, 'SCALE_HEAD')).to.be.true;
      expect(model.getField('ID_VAR')).to.not.be.null;
      expect(visible(model, 'SIZE_Y')).to.be.true;
      expect(generate(model)).to.include('size: { width: 2, height: 3.1, depth: 4 }');

      model.toggleResize();
      expect(visible(model, 'SCALE')).to.be.true;
      expect(visible(model, 'SIZE_Y')).to.be.false;
      expect(generate(model)).to.not.include('size:');
    });

    it('keeps scale hidden while resize is on and the row is closed', function () {
      const model = makeModel();
      model.toggleMainSection();
      model.setResizeShown(true, { x: 1, y: 1, z: 1 });
      model.toggleMainSection();

      expect(visible(model, 'RESIZE_TOGGLE')).to.be.false;
      expect(visible(model, 'SIZE_Y')).to.be.false;
      expect(visible(model, 'SCALE')).to.be.false;
    });

    it('restores resize on load', function () {
      const model = makeModel();
      model.setResizeShown(true, { x: 2, y: 2, z: 2 });

      const restored = reload(model);
      expect(visible(restored, 'SCALE')).to.be.false;
      expect(generate(restored)).to.include('size: { width: 2, height: 2, depth: 2 }');
    });

    it('shows the rows when the + button is clicked', function () {
      const box = makeBox();
      box.getField('TOGGLE_BUTTON').showEditor_();
      expect(visible(box, 'ROTATE_TOGGLE')).to.be.true;

      box.getField('TOGGLE_BUTTON').showEditor_();
      expect(visible(box, 'ROTATE_TOGGLE')).to.be.false;
    });

    describe('closing DO and then', function () {
      function addSphereTo(box, inputName) {
        const sphere = Blockly.serialization.blocks.append({ type: 'create_sphere' }, ws);
        box.getInput(inputName).connection.connect(sphere.previousConnection);
        return sphere;
      }

      it('keeps the DO blocks and still runs them', function () {
        const box = makeBox();
        box.toggleDoBlock();
        const sphere = addSphereTo(box, 'DO');
        box.toggleDoBlock();

        expect(visible(box, 'DO')).to.be.false;
        expect(sphere.getParent()).to.equal(box);
        expect(box.mutationToDom().getAttribute('do_hidden')).to.equal('true');
        expect(generate(box)).to.include('createSphere(');
      });

      it('restores a closed DO closed, with its blocks', function () {
        const box = makeBox();
        box.toggleDoBlock();
        addSphereTo(box, 'DO');
        box.toggleDoBlock();

        const restored = reload(box);
        expect(visible(restored, 'DO')).to.be.false;
        expect(restored.getInputTargetBlock('DO')?.type).to.equal('create_sphere');
        restored.toggleDoBlock();
        expect(visible(restored, 'DO')).to.be.true;
      });

      it('hides then with DO and brings it back with DO', function () {
        const box = makeBox();
        box.toggleDoBlock();
        box.toggleThenBlock();
        addSphereTo(box, 'THEN');
        box.toggleDoBlock();
        expect(visible(box, 'THEN')).to.be.false;
        expect(visible(box, 'THEN_BUTTON')).to.be.false;

        box.toggleDoBlock();
        expect(visible(box, 'THEN')).to.be.true;
        expect(box.getInputTargetBlock('THEN')?.type).to.equal('create_sphere');
      });

      it('keeps the then button above then after closing and reopening', function () {
        const box = makeBox();
        box.toggleDoBlock();
        box.toggleThenBlock();
        box.toggleThenBlock();
        expect(visible(box, 'THEN')).to.be.false;

        box.toggleThenBlock();
        const names = box.inputList.map((input) => input.name);
        expect(names.indexOf('THEN_BUTTON')).to.be.lessThan(names.indexOf('THEN'));
        expect(visible(box, 'THEN')).to.be.true;
      });

      it('closes DO again when the first + is undone', function () {
        const box = makeBox();
        const closed = box.mutationToDom();
        box.toggleDoBlock();
        box.domToMutation(closed);

        expect(visible(box, 'DO')).to.be.false;
        expect(visible(box, 'ROTATE_TOGGLE')).to.be.false;
        expect(box.getField('TOGGLE_BUTTON').getValue()).to.equal(DO_MUTATOR_PLUS);
      });
    });

    it('gives a clone rotation and size rows that pass to cloneMesh', function () {
      const clone = Blockly.serialization.blocks.append({ type: 'clone_mesh' }, ws);
      clone.toggleMainSection();
      clone.toggleRotate();
      clone.setResizeShown(true, { x: 2, y: 2, z: 2 });

      expect(visible(clone, 'SIZE_X')).to.be.true;
      const code = generate(clone);
      expect(code).to.include('rotation: { x: 0, y: 0, z: 0 }');
      expect(code).to.include('size: { width: 2, height: 2, depth: 2 }');
    });

    it('gives 3D text a rotation row only, passed to create3DText', function () {
      const text = Blockly.serialization.blocks.append(
        { type: 'create_3d_text', inputs: { X: number(0), Y: number(0), Z: number(0) } },
        ws
      );
      expect(text.getInput('RESIZE_TOGGLE')).to.be.null;
      text.toggleMainSection();
      text.toggleRotate();
      expect(generate(text)).to.include('rotation: { x: 0, y: 0, z: 0 },');
    });

    it('records each row change as one undoable mutation', async function () {
      const box = makeBox();
      const events = [];
      ws.addChangeListener((e) => events.push(e));
      box.toggleRotate();
      await new Promise((resolve) => requestAnimationFrame(() => setTimeout(resolve, 0)));

      const mutations = events.filter((e) => e.element === 'mutation');
      expect(mutations).to.have.length(1);
      expect(mutations[0].newValue).to.include('rotate="true"');
    });
  });
}
