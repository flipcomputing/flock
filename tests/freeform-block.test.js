import { expect } from 'chai';
import * as Blockly from 'blockly';
import { javascriptGenerator } from 'blockly/javascript';
import { defineGenerators } from '../generators/generators.js';
import { defineBlocks } from '../blocks/blocks.js';
import { defineShapeBlocks } from '../blocks/shapes.js';
import { CUBE_FACES, extrudeFace, mergePoints } from '../api/freeformgeometry.js';

const vectorState = (x, y, z) => ({
  block: {
    type: 'vector',
    inputs: Object.fromEntries(
      Object.entries({ X: x, Y: y, Z: z }).map(([axis, NUM]) => [
        axis,
        { shadow: { type: 'math_number', fields: { NUM } } },
      ])
    ),
  },
});

const cube = [
  [-0.5, -0.5, -0.5],
  [0.5, -0.5, -0.5],
  [0.5, -0.5, 0.5],
  [-0.5, -0.5, 0.5],
  [-0.5, 0.5, -0.5],
  [0.5, 0.5, -0.5],
  [0.5, 0.5, 0.5],
  [-0.5, 0.5, 0.5],
];

function freeformState(items = cube.map((p) => vectorState(...p))) {
  return {
    type: 'create_freeform',
    inputs: {
      COLOR: { shadow: { type: 'colour', fields: { COLOR: '#66cc99' } } },
      VERTICES: {
        block: {
          type: 'lists_create_with',
          extraState: { itemCount: items.length },
          inputs: Object.fromEntries(items.map((item, i) => [`ADD${i}`, item])),
        },
      },
      X: { shadow: { type: 'math_number', fields: { NUM: 0 } } },
      Y: { shadow: { type: 'math_number', fields: { NUM: 0 } } },
      Z: { shadow: { type: 'math_number', fields: { NUM: 0 } } },
    },
  };
}

export function runFreeformBlockTests() {
  describe('blocks/create_freeform @freeformblock', function () {
    let workspace;
    let savedLoadingCode;

    before(function () {
      if (!Blockly.Blocks['vector']) defineBlocks();
      if (!Blockly.Blocks['create_freeform']) defineShapeBlocks();
      if (!javascriptGenerator.forBlock['create_freeform']) defineGenerators();
    });

    beforeEach(function () {
      savedLoadingCode = window.loadingCode;
      window.loadingCode = true;
      workspace = new Blockly.Workspace();
    });

    afterEach(function () {
      workspace.dispose();
      window.loadingCode = savedLoadingCode;
    });

    it('generates a vector as createVector3', function () {
      const vector = Blockly.serialization.blocks.append(vectorState(1, 2.5, -3).block, workspace);
      javascriptGenerator.init(workspace);
      const [code] = javascriptGenerator.forBlock['vector'](vector, javascriptGenerator);
      expect(code).to.equal('createVector3(1, 2.5, (-3))');
    });

    it('passes the point list to createFreeform', function () {
      const block = Blockly.serialization.blocks.append(freeformState(), workspace);
      javascriptGenerator.init(workspace);
      const code = javascriptGenerator.blockToCode(block);
      expect(code).to.include('createFreeform(');
      expect(code).to.include('vertices: [createVector3((-0.5), (-0.5), (-0.5)), ');
      expect(code).to.include('position: [0, 0, 0]');
    });

    it('reads the points as numbers', function () {
      const block = Blockly.serialization.blocks.append(freeformState(), workspace);
      expect(block.getPoints()).to.deep.equal(cube);
    });

    it('gives no points when one is not plain numbers', function () {
      const items = cube.map((p) => vectorState(...p));
      items[3] = { block: { type: 'variables_get', fields: { VAR: { name: 'corner' } } } };
      const block = Blockly.serialization.blocks.append(freeformState(items), workspace);

      expect(block.getPoints()).to.equal(null);
      const numberBlocks = block.getPointNumberBlocks();
      expect(numberBlocks[3]).to.equal(null);
      expect(numberBlocks[0].map((n) => n.type)).to.deep.equal([
        'math_number',
        'math_number',
        'math_number',
      ]);
    });

    it('hides the point list until toggled, and remembers it', function () {
      const block = Blockly.serialization.blocks.append(freeformState(), workspace);
      expect(block.getInput('VERTICES').isVisible()).to.equal(false);

      block.togglePoints_();
      block.toggleDoBlock();
      expect(block.getInput('VERTICES').isVisible()).to.equal(true);

      const state = Blockly.serialization.blocks.save(block);
      block.dispose();
      const restored = Blockly.serialization.blocks.append(state, workspace);
      expect(restored.getInput('VERTICES').isVisible()).to.equal(true);
      expect(restored.getInput('DO')).to.exist;
    });

    it('writes an extruded shape back, growing the list and saving the faces', function () {
      const block = Blockly.serialization.blocks.append(freeformState(), workspace);
      const { points, faces } = extrudeFace(cube, CUBE_FACES, 1, 1);
      block.writeShape(points, faces);

      expect(block.getPoints()).to.deep.equal(points);
      expect(block.getFaces()).to.deep.equal(faces);

      const state = Blockly.serialization.blocks.save(block);
      block.dispose();
      const restored = Blockly.serialization.blocks.append(state, workspace);
      expect(restored.getPoints()).to.deep.equal(points);
      expect(restored.getFaces()).to.deep.equal(faces);

      javascriptGenerator.init(workspace);
      expect(javascriptGenerator.blockToCode(restored)).to.include(
        `faces: ${JSON.stringify(faces)}`
      );
    });

    it('shrinks the list when points merge, leaving no loose vectors', function () {
      const block = Blockly.serialization.blocks.append(freeformState(), workspace);
      const { points, faces } = mergePoints(cube, CUBE_FACES, 7, 4);
      block.writeShape(points, faces);

      expect(block.getPoints()).to.deep.equal(points);
      expect(block.getInputTargetBlock('VERTICES').itemCount_).to.equal(7);
      expect(workspace.getTopBlocks(false)).to.have.length(1);
      expect(workspace.getBlocksByType('vector', false)).to.have.length(7);
    });

    it('leaves faces out of the code for the plain cube', function () {
      const block = Blockly.serialization.blocks.append(freeformState(), workspace);
      javascriptGenerator.init(workspace);
      expect(javascriptGenerator.blockToCode(block)).to.not.include('faces:');
    });

    describe('hand edits', function () {
      const settle = () => new Promise((resolve) => setTimeout(resolve, 50));

      // The app's dispatcher only listens to the main workspace.
      beforeEach(function () {
        window.loadingCode = false;
        workspace.addChangeListener((event) =>
          workspace.getBlocksByType('create_freeform').forEach((b) => b.rejectBrokenShape_(event))
        );
      });

      it('undoes a typed value that would push a corner through the shape', async function () {
        const block = Blockly.serialization.blocks.append(freeformState(), workspace);
        await settle();
        const [x] = block.getPointNumberBlocks()[6];
        x.setFieldValue('-2', 'NUM');
        await settle();

        expect(block.getPoints()[6]).to.deep.equal([0.5, 0.5, 0.5]);
        expect(workspace.getRedoStack()).to.have.length(0);
      });

      it('keeps a typed value that leaves the shape valid', async function () {
        const block = Blockly.serialization.blocks.append(freeformState(), workspace);
        await settle();
        const [x] = block.getPointNumberBlocks()[6];
        x.setFieldValue('1.5', 'NUM');
        await settle();

        expect(block.getPoints()[6]).to.deep.equal([1.5, 0.5, 0.5]);
      });

      it('undoes adding a point the faces do not use', async function () {
        const block = Blockly.serialization.blocks.append(freeformState(), workspace);
        await settle();
        const list = block.getInputTargetBlock('VERTICES');
        Blockly.Events.setGroup(true);
        const oldState = JSON.stringify(list.saveExtraState());
        list.plus();
        Blockly.Events.fire(
          new Blockly.Events.BlockChange(
            list,
            'mutation',
            null,
            oldState,
            JSON.stringify(list.saveExtraState())
          )
        );
        Blockly.Events.setGroup(false);
        await settle();

        expect(list.itemCount_).to.equal(8);
      });
    });
  });
}
