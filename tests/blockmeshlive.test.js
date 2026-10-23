import { expect } from 'chai';
import * as Blockly from 'blockly';
import { meshMap } from '../generators/generators.js';
import {
  updateMeshFromBlock,
  colourSourceIsRandom,
  readColourValue,
  recordLiveEdit,
  reconcileSpawnedMesh,
  resetLiveEditsForRun,
} from '../ui/blockmesh.js';

export function runBlockmeshLiveTests(flock) {
  describe('Live mesh update — late binding & random colour @blockmeshlive', function () {
    this.timeout(10000);

    let workspace;
    let restore;
    let applied; // colours captured from flock.applyMaterialToHierarchy
    let randomCounter;

    // Distinct, deterministic colours so "random" is actually testable.
    const nextColour = () => `#${(++randomCounter).toString(16).padStart(6, '0')}`;

    before(function () {
      // updateMeshFromBlock needs a main workspace; the harness injects none.
      if (Blockly.common?.setMainWorkspace && !Blockly.getMainWorkspace()) {
        workspace = new Blockly.Workspace();
        Blockly.common.setMainWorkspace(workspace);
      }
    });

    after(function () {
      if (workspace) {
        workspace.dispose();
        workspace = null;
      }
    });

    beforeEach(function () {
      applied = [];
      randomCounter = 0;

      const origApply = flock.applyMaterialToHierarchy;
      const origRandom = flock.randomColour;
      const origPos = flock.getBlockPositionFromMesh;
      const origPhysics = flock.updatePhysics;

      flock.applyMaterialToHierarchy = (root, input) => {
        applied.push({ mesh: root, colour: typeof input === 'string' ? input : input?.color });
      };
      flock.randomColour = () => nextColour();
      flock.getBlockPositionFromMesh = () => ({ x: 0, y: 0, z: 0 });
      flock.updatePhysics = () => {};

      restore = () => {
        flock.applyMaterialToHierarchy = origApply;
        flock.randomColour = origRandom;
        flock.getBlockPositionFromMesh = origPos;
        flock.updatePhysics = origPhysics;
      };
    });

    afterEach(function () {
      restore?.();
      resetLiveEditsForRun();
    });

    // Plain-object mesh, kept out of the scene so onNewMeshAdded can't skew results.
    const makeMesh = (blockKey, name) => ({ name, parent: null, metadata: { blockKey } });

    const makeBoxBlock = (colorTarget, id = 'box1') => ({
      id,
      type: 'create_box',
      isEnabled: () => true,
      disposed: false,
      getParent: () => null,
      getField: () => null,
      getFieldValue: () => null,
      getInput: () => null,
      getInputTargetBlock: (name) => (name === 'COLOR' ? colorTarget : null),
    });

    const withDescendants = (block, children = []) => ({
      ...block,
      getDescendants: () => [block, ...children],
    });

    const randomTarget = withDescendants({
      id: 'rc1',
      type: 'random_colour',
      getInputTargetBlock: () => null,
    });

    const fixedTarget = (hex) =>
      withDescendants({
        id: 'c1',
        type: 'colour',
        getInputTargetBlock: () => null,
        getField: (f) => (f === 'COLOR' || f === 'COLOUR' ? { getValue: () => hex } : null),
      });

    // COLOR-input change event; blockId is the colour source so it reads as COLOR.
    const colourChange = (blockId) => ({
      type: Blockly.Events.BLOCK_CHANGE,
      element: 'field',
      name: 'COLOR',
      blockId,
    });

    describe('colourSourceIsRandom', function () {
      it('detects a random_colour on the COLOR input', function () {
        expect(colourSourceIsRandom(makeBoxBlock(randomTarget))).to.equal(true);
      });

      it('is false for a fixed colour', function () {
        expect(colourSourceIsRandom(makeBoxBlock(fixedTarget('#123456')))).to.equal(false);
      });

      it('detects random inside a colour list', function () {
        const list = withDescendants({ type: 'lists_create_with' }, [
          { type: 'random_colour' },
          { type: 'colour' },
        ]);
        expect(colourSourceIsRandom(makeBoxBlock(list))).to.equal(true);
      });

      it('detects random as a material base colour', function () {
        const material = withDescendants({ type: 'material' }, [{ type: 'random_colour' }]);
        expect(colourSourceIsRandom(makeBoxBlock(material))).to.equal(true);
      });

      it('detects random inside a gradient', function () {
        const gradient = withDescendants({ type: 'gradient_colour' }, [
          { type: 'lists_create_with' },
          { type: 'random_colour' },
        ]);
        expect(colourSourceIsRandom(makeBoxBlock(gradient))).to.equal(true);
      });
    });

    describe('readColourValue', function () {
      const fieldBlock = (type, value) => ({
        type,
        getField: (f) => (f === 'COLOR' ? { getValue: () => value } : null),
      });

      it('normalises colour_from_string like its generator', function () {
        expect(readColourValue(fieldBlock('colour_from_string', 'F0C')).value).to.equal('#ff00cc');
        expect(readColourValue(fieldBlock('colour_from_string', 'not a colour')).value).to.equal(
          '#000000'
        );
      });

      it('reads skin_colour and greyscale_colour fields', function () {
        expect(readColourValue(fieldBlock('skin_colour', '#a0522d')).value).to.equal('#a0522d');
        expect(readColourValue(fieldBlock('greyscale_colour', '#808080')).value).to.equal(
          '#808080'
        );
      });

      it('reads gradient_material as an untextured material', function () {
        const inputs = {
          COLOR: fieldBlock('colour', '#112233'),
          ALPHA: { getField: (f) => (f === 'NUM' ? { getValue: () => '0.5' } : null) },
        };
        const block = { type: 'gradient_material', getInputTargetBlock: (n) => inputs[n] ?? null };
        expect(readColourValue(block).value).to.deep.equal({
          color: '#112233',
          materialName: 'none.png',
          alpha: 0.5,
        });
      });

      it('reads a computed colour as unknown, and anything built from one', function () {
        const variable = { type: 'variables_get', getField: () => null };
        const item = (block) => ({ connection: { targetBlock: () => block } });
        expect(readColourValue(variable)).to.deep.equal({ value: null, kind: 'unknown' });

        const list = {
          type: 'lists_create_with',
          inputList: [item(fieldBlock('colour', '#010203')), item(variable)],
        };
        expect(readColourValue(list).kind).to.equal('unknown');

        const gradient = { type: 'gradient_colour', getInputTargetBlock: () => list };
        expect(readColourValue(gradient).kind).to.equal('unknown');

        const material = {
          type: 'material',
          getInputTargetBlock: (n) => (n === 'BASE_COLOR' ? variable : null),
        };
        expect(readColourValue(material).kind).to.equal('unknown');
      });

      it('reads every item of a colour list through the same rules', function () {
        const item = (block) => ({ connection: { targetBlock: () => block } });
        const list = {
          type: 'lists_create_with',
          inputList: [
            item(fieldBlock('colour', '#010203')),
            item(fieldBlock('colour_from_string', 'abc')),
            item(null),
          ],
        };
        expect(readColourValue(list).value).to.deep.equal(['#010203', '#aabbcc']);
      });
    });

    describe('random colour rolls per mesh', function () {
      it('gives each existing copy its own colour', function () {
        const block = makeBoxBlock(randomTarget);
        const meshes = [makeMesh('box1', 'a'), makeMesh('box1', 'b'), makeMesh('box1', 'c')];

        updateMeshFromBlock(meshes, block, colourChange('rc1'));

        const colours = applied.map((a) => a.colour);
        expect(colours).to.have.lengthOf(3);
        expect(new Set(colours).size).to.equal(3);
      });

      it('paints every copy the same fixed colour', function () {
        const block = makeBoxBlock(fixedTarget('#123456'));
        const meshes = [makeMesh('box1', 'a'), makeMesh('box1', 'b')];

        updateMeshFromBlock(meshes, block, colourChange('c1'));

        expect(applied.map((a) => a.colour)).to.deep.equal(['#123456', '#123456']);
      });
    });

    describe('late binding — reconcile spawned mesh', function () {
      afterEach(function () {
        delete meshMap['box1'];
        delete meshMap['load1'];
      });

      it('applies a recorded edit to a mesh spawned afterwards', function () {
        const block = makeBoxBlock(fixedTarget('#123456'));
        meshMap['box1'] = block;
        recordLiveEdit(block, colourChange('c1'));

        reconcileSpawnedMesh(makeMesh('box1', 'late'));

        expect(applied.map((a) => a.colour)).to.deep.equal(['#123456']);
      });

      it('applies the block current colour after a random source is dragged out', function () {
        // Move event still points at the removed random block; the spawn must
        // pick up the fixed shadow colour, not the stale random one.
        const block = makeBoxBlock(fixedTarget('#abcdef'));
        meshMap['box1'] = block;
        recordLiveEdit(block, {
          type: Blockly.Events.BLOCK_MOVE,
          blockId: 'rc1',
          oldParentId: 'box1',
          oldInputName: 'COLOR',
        });

        reconcileSpawnedMesh(makeMesh('box1', 'late'));

        expect(applied.map((a) => a.colour)).to.deep.equal(['#abcdef']);
      });

      it('does nothing once resetLiveEditsForRun clears the record', function () {
        const block = makeBoxBlock(fixedTarget('#123456'));
        meshMap['box1'] = block;
        recordLiveEdit(block, colourChange('c1'));
        resetLiveEditsForRun();

        reconcileSpawnedMesh(makeMesh('box1', 'late'));

        expect(applied).to.have.lengthOf(0);
      });

      it('does not record edits for non late-bound block types', function () {
        const loadBlock = { ...makeBoxBlock(fixedTarget('#123456'), 'load1'), type: 'load_object' };
        meshMap['load1'] = loadBlock;
        recordLiveEdit(loadBlock, colourChange('c1'));

        reconcileSpawnedMesh(makeMesh('load1', 'late'));

        expect(applied).to.have.lengthOf(0);
      });

      it('flags colour when a shadow respawns into the colour input (source removed)', function () {
        // Drag-out respawns the shadow (a CREATE on the block); must be recorded
        // so spawns get the reverted colour without a prior drag-in.
        const block = makeBoxBlock(fixedTarget('#abcdef'));
        meshMap['box1'] = block;
        recordLiveEdit(block, { type: Blockly.Events.BLOCK_CREATE, blockId: 'c1' });

        reconcileSpawnedMesh(makeMesh('box1', 'late'));

        expect(applied.map((a) => a.colour)).to.deep.equal(['#abcdef']);
      });

      it('applies recorded marker edit and type changes to a marker spawned afterwards', function () {
        const fields = { EDIT: 'FALSE', TYPE: 'sphere' };
        const block = {
          ...makeBoxBlock(null, 'marker1'),
          type: 'create_marker',
          getFieldValue: (name) => fields[name] ?? null,
        };
        meshMap['marker1'] = block;
        const calls = [];
        const origEdit = flock.setMarkerEdit;
        const origType = flock.setMarkerType;
        flock.setMarkerEdit = (name, edit) => calls.push(['edit', name, edit]);
        flock.setMarkerType = (name, type) => calls.push(['type', name, type]);
        try {
          for (const name of ['EDIT', 'TYPE']) {
            recordLiveEdit(block, {
              type: Blockly.Events.BLOCK_CHANGE,
              element: 'field',
              name,
              blockId: 'marker1',
            });
          }
          reconcileSpawnedMesh(makeMesh('marker1', 'late'));
        } finally {
          flock.setMarkerEdit = origEdit;
          flock.setMarkerType = origType;
          delete meshMap['marker1'];
        }

        expect(calls).to.deep.equal([
          ['edit', 'late', false],
          ['type', 'late', 'sphere'],
        ]);
      });

      it('ignores unrelated event types', function () {
        const block = makeBoxBlock(fixedTarget('#123456'));
        meshMap['box1'] = block;
        recordLiveEdit(block, { type: Blockly.Events.BLOCK_DELETE, blockId: 'c1' });

        reconcileSpawnedMesh(makeMesh('box1', 'late'));

        expect(applied).to.have.lengthOf(0);
      });
    });
  });
}
