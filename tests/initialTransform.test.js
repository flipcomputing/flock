import { expect } from 'chai';
import * as Blockly from 'blockly';
import { defineModelBlocks } from '../blocks/models.js';
import { defineShapeBlocks } from '../blocks/shapes.js';
import { defineSceneBlocks } from '../blocks/scene.js';
import { defineTransformBlocks } from '../blocks/transform.js';
import {
  supportsInitialSize,
  getInitialTransformOwner,
  findInitialRotation,
  findInitialSize,
  ensureInitialRotation,
  ensureInitialSize,
  getInitialRotationValues,
  setInitialRotationValues,
  getInitialSizeValues,
  setInitialSizeValues,
  placeMoveAfterInitialTransforms,
} from '../ui/initialTransform.js';
import { updateMeshFromBlock } from '../ui/blockmesh.js';

export function runInitialTransformTests(flock) {
  describe('ui/initialTransform @initialtransform', function () {
    let ws;
    let stubs;
    let existingBlockIds;

    before(function () {
      if (!Blockly.Blocks['load_model']) defineModelBlocks();
      if (!Blockly.Blocks['create_box']) defineShapeBlocks();
      if (!Blockly.Blocks['clone_mesh']) defineSceneBlocks();
      if (!Blockly.Blocks['rotate_to']) defineTransformBlocks();
      if (!Blockly.getMainWorkspace()) Blockly.common.setMainWorkspace(new Blockly.Workspace());
      ws = Blockly.getMainWorkspace();
    });

    beforeEach(function () {
      existingBlockIds = new Set(ws.getTopBlocks(false).map((b) => b.id));
      stubs = ['initSvg', 'render'].filter((name) => !Blockly.Block.prototype[name]);
      stubs.forEach((name) => (Blockly.Block.prototype[name] = function () {}));
    });

    afterEach(function () {
      ws.getTopBlocks(false)
        .filter((b) => !existingBlockIds.has(b.id))
        .forEach((b) => b.dispose(false));
      stubs.forEach((name) => delete Blockly.Block.prototype[name]);
    });

    const ownVar = (block) => block.getFieldValue('ID_VAR');

    function otherVariable() {
      const map = ws.getVariableMap();
      return (
        map.getVariable('initialTransformOther') ?? map.createVariable('initialTransformOther')
      );
    }

    function doTypes(block) {
      const types = [];
      for (let cur = block.getInputTargetBlock('DO'); cur; cur = cur.getNextBlock()) {
        types.push(cur.type);
      }
      return types;
    }

    function appendTransform(owner, type, varId) {
      const number = (n) => ({ shadow: { type: 'math_number', fields: { NUM: n } } });
      const block = Blockly.serialization.blocks.append(
        {
          type,
          fields: { [type === 'resize' ? 'BLOCK_NAME' : 'MODEL']: { id: varId } },
          inputs: { X: number(1), Y: number(2), Z: number(3) },
        },
        ws
      );
      if (!owner.getInput('DO')) owner.toggleDoBlock();
      let tail = owner.getInputTargetBlock('DO');
      if (!tail) {
        owner.getInput('DO').connection.connect(block.previousConnection);
      } else {
        while (tail.getNextBlock()) tail = tail.getNextBlock();
        tail.nextConnection.connect(block.previousConnection);
      }
      return block;
    }

    describe('ensureInitialRotation', function () {
      it('opens DO through the mutator and adds a seeded rotate_to for the own variable', function () {
        const box = ws.newBlock('create_box');
        const result = ensureInitialRotation(box, { x: 0, y: 90, z: 0 });

        expect(result.created).to.be.true;
        expect(result.addedDoSection).to.be.true;
        expect(box.mutationToDom().getAttribute('has_do')).to.equal('true');
        expect(doTypes(box)).to.deep.equal(['rotate_to']);
        expect(result.block.getFieldValue('MODEL')).to.equal(ownVar(box));
        expect(getInitialRotationValues(result.block)).to.deep.equal({ x: 0, y: 90, z: 0 });
      });

      it('returns the existing rotate_to rather than adding another', function () {
        const box = ws.newBlock('create_box');
        const first = ensureInitialRotation(box);
        const second = ensureInitialRotation(box);

        expect(second.created).to.be.false;
        expect(second.addedDoSection).to.be.false;
        expect(second.block).to.equal(first.block);
        expect(doTypes(box)).to.deep.equal(['rotate_to']);
      });

      it('appends after existing DO statements', function () {
        const box = ws.newBlock('create_box');
        const other = otherVariable();
        appendTransform(box, 'rotate_to', other.getId());
        ensureInitialRotation(box);

        const first = box.getInputTargetBlock('DO');
        expect(first.getFieldValue('MODEL')).to.equal(other.getId());
        expect(first.getNextBlock().getFieldValue('MODEL')).to.equal(ownVar(box));
      });
    });

    describe('findInitialRotation', function () {
      it('ignores a rotate_to naming another variable', function () {
        const box = ws.newBlock('create_box');
        appendTransform(box, 'rotate_to', otherVariable().getId());
        expect(findInitialRotation(box)).to.be.null;
      });
    });

    describe('ensureInitialSize', function () {
      it('splices the resize ahead of an existing rotate_to', function () {
        const model = ws.newBlock('load_model');
        ensureInitialRotation(model);
        const result = ensureInitialSize(model, null, () => ({ x: 2, y: 3.14, z: 0 }));

        expect(result.created).to.be.true;
        expect(doTypes(model)).to.deep.equal(['resize', 'rotate_to']);
        expect(result.block.getFieldValue('BLOCK_NAME')).to.equal(ownVar(model));
        expect(getInitialSizeValues(result.block)).to.deep.equal({ x: 2, y: 3.1, z: 1 });
      });

      it('only measures when creating', function () {
        const model = ws.newBlock('load_model');
        let measured = 0;
        const measure = () => {
          measured++;
          return { x: 1, y: 1, z: 1 };
        };
        ensureInitialSize(model, null, measure);
        const again = ensureInitialSize(model, null, measure);

        expect(measured).to.equal(1);
        expect(again.created).to.be.false;
        expect(findInitialSize(model, null)).to.equal(again.block);
      });

      it('does nothing for a block with its own dimensions', function () {
        const box = ws.newBlock('create_box');
        expect(ensureInitialSize(box, null, () => ({ x: 1, y: 1, z: 1 }))).to.be.null;
        expect(box.getInput('DO')).to.be.null;
      });
    });

    describe('supportsInitialSize', function () {
      it('covers models, groups and clones but not cloned groups or primitives', function () {
        const group = { metadata: { shapeType: 'Group' } };
        expect(supportsInitialSize(ws.newBlock('load_model'), null)).to.be.true;
        expect(supportsInitialSize(ws.newBlock('create_group'), null)).to.be.true;
        expect(supportsInitialSize(ws.newBlock('clone_mesh'), null)).to.be.true;
        expect(supportsInitialSize(ws.newBlock('clone_mesh'), group)).to.be.false;
        expect(supportsInitialSize(ws.newBlock('create_box'), null)).to.be.false;
      });
    });

    describe('values', function () {
      it('writes only the requested rotation axes, rounded to one decimal', function () {
        const box = ws.newBlock('create_box');
        const { block } = ensureInitialRotation(box);
        setInitialRotationValues(block, { x: 10.04, y: 20.06, z: 30 }, { axes: ['y'] });

        expect(getInitialRotationValues(block)).to.deep.equal({ x: 0, y: 20.1, z: 0 });
      });

      it('writes sizes at the requested precision', function () {
        const model = ws.newBlock('load_model');
        const { block } = ensureInitialSize(model, null, () => ({ x: 1, y: 1, z: 1 }));
        setInitialSizeValues(block, { x: 1.234, y: 2.345, z: 3.456 }, { decimals: 2 });

        expect(getInitialSizeValues(block)).to.deep.equal({ x: 1.23, y: 2.35, z: 3.46 });
      });
    });

    describe('getInitialTransformOwner', function () {
      it('is the add block for its own enabled transform', function () {
        const box = ws.newBlock('create_box');
        const { block } = ensureInitialRotation(box);
        expect(getInitialTransformOwner(block)).to.equal(box);
      });

      it('is null for a transform naming another variable', function () {
        const box = ws.newBlock('create_box');
        const rotate = appendTransform(box, 'rotate_to', otherVariable().getId());
        expect(getInitialTransformOwner(rotate)).to.be.null;
      });

      it('is null for a disabled transform', function () {
        const box = ws.newBlock('create_box');
        const { block } = ensureInitialRotation(box);
        block.setDisabledReason(true, 'test');
        expect(getInitialTransformOwner(block)).to.be.null;
      });
    });

    describe('placeMoveAfterInitialTransforms', function () {
      it('moves a clone move below its own rotate and resize', function () {
        const clone = ws.newBlock('clone_mesh');
        const cloneVar = clone.getFieldValue('CLONE_VAR');
        appendTransform(clone, 'move_to_xyz', cloneVar);
        ensureInitialRotation(clone);
        ensureInitialSize(clone, null, () => ({ x: 1, y: 1, z: 1 }));
        placeMoveAfterInitialTransforms(clone);

        expect(doTypes(clone)).to.deep.equal(['resize', 'rotate_to', 'move_to_xyz']);
      });

      it('leaves statements after the move in place', function () {
        const clone = ws.newBlock('clone_mesh');
        const cloneVar = clone.getFieldValue('CLONE_VAR');
        appendTransform(clone, 'move_to_xyz', cloneVar);
        ensureInitialRotation(clone);
        appendTransform(clone, 'rotate_to', otherVariable().getId());
        placeMoveAfterInitialTransforms(clone);

        expect(doTypes(clone)).to.deep.equal(['rotate_to', 'move_to_xyz', 'rotate_to']);
      });
    });

    describe('live position edits', function () {
      let calls;
      let restore;

      beforeEach(function () {
        calls = [];
        const originals = {
          positionAt: flock.positionAt,
          _positionAtBase: flock._positionAtBase,
          updatePhysics: flock.updatePhysics,
        };
        flock.positionAt = (name, opts) => calls.push({ rule: 'anchor', name, opts });
        flock._positionAtBase = (name, opts) => calls.push({ rule: 'base', name, opts });
        flock.updatePhysics = () => {};
        restore = () => Object.assign(flock, originals);
      });

      afterEach(function () {
        restore();
      });

      function editY(box, value, { isPrefab = false } = {}) {
        const shadow = box.getInputTargetBlock('Y');
        shadow.setFieldValue(String(value), 'NUM');
        const mesh = { name: 'liveBox', parent: null, metadata: { blockKey: box.id, isPrefab } };
        updateMeshFromBlock(mesh, box, {
          type: Blockly.Events.BLOCK_CHANGE,
          element: 'field',
          name: 'NUM',
          blockId: shadow.id,
        });
      }

      function makeBox() {
        const number = (n) => ({ shadow: { type: 'math_number', fields: { NUM: n } } });
        return Blockly.serialization.blocks.append(
          { type: 'create_box', inputs: { X: number(0), Y: number(0), Z: number(0) } },
          ws
        );
      }

      it('places an add block by its unrotated base, as creation does', function () {
        const box = makeBox();
        ensureInitialRotation(box, { x: 0, y: 0, z: 45 });
        editY(box, 2);
        expect(calls.map((c) => c.rule)).to.deep.equal(['base']);
        expect(Number(calls[0].opts.y)).to.equal(2);
      });

      it('places a prefab by its anchor, as creation does', function () {
        editY(makeBox(), 2, { isPrefab: true });
        expect(calls.map((c) => c.rule)).to.deep.equal(['anchor']);
      });
    });
  });
}
