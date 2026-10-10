import { expect } from 'chai';
import * as Blockly from 'blockly';
import { defineModelBlocks } from '../blocks/models.js';
import { defineShapeBlocks } from '../blocks/shapes.js';
import { defineSceneBlocks } from '../blocks/scene.js';
import { defineTransformBlocks } from '../blocks/transform.js';
import { defineModifyBlocks } from '../blocks/modify.js';
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
import { updateMeshFromBlock, applyInitialTransformRows } from '../ui/blockmesh.js';

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
      if (!Blockly.Blocks['mirror_mesh']) defineModifyBlocks();
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
      it('opens the row, not DO, and turns on rotate, seeded', function () {
        const box = ws.newBlock('create_box');
        const result = ensureInitialRotation(box, { x: 0, y: 90, z: 0 });

        expect(result.created).to.be.true;
        expect(result.addedDoSection).to.be.true;
        expect(result.block).to.equal(box);
        expect(box.rotateShown_).to.be.true;
        expect(box.getInput('ROTATE_X').isVisible()).to.be.true;
        expect(box.getInput('DO')).to.be.null;
        expect(getInitialRotationValues(box)).to.deep.equal({ x: 0, y: 90, z: 0 });
      });

      it('returns the row again rather than reseeding it', function () {
        const box = ws.newBlock('create_box');
        ensureInitialRotation(box, { x: 0, y: 90, z: 0 });
        const second = ensureInitialRotation(box);

        expect(second.created).to.be.false;
        expect(second.block).to.equal(box);
        expect(getInitialRotationValues(box).y).to.equal(90);
      });

      it('keeps writing to an existing rotate_to in DO', function () {
        const box = ws.newBlock('create_box');
        const legacy = appendTransform(box, 'rotate_to', ownVar(box));
        const result = ensureInitialRotation(box);

        expect(result.block).to.equal(legacy);
        expect(box.rotateShown_).to.be.false;
      });

      it('adds a rotate_to after existing DO statements for a block without rows', function () {
        const mirror = ws.newBlock('mirror_mesh');
        const other = otherVariable();
        appendTransform(mirror, 'rotate_to', other.getId());
        ensureInitialRotation(mirror);

        const first = mirror.getInputTargetBlock('DO');
        expect(first.getFieldValue('MODEL')).to.equal(other.getId());
        expect(first.getNextBlock().getFieldValue('MODEL')).to.equal(ownVar(mirror));
      });

      it('rotates a freeform with its own row', function () {
        const freeform = ws.newBlock('create_freeform');
        const result = ensureInitialRotation(freeform, { x: 0, y: 45, z: 0 });

        expect(result.block).to.equal(freeform);
        expect(freeform.rotateShown_).to.be.true;
        expect(freeform.getInput('DO')).to.be.null;
        expect(getInitialRotationValues(freeform)).to.deep.equal({ x: 0, y: 45, z: 0 });
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
      it('turns on the resize row, measured', function () {
        const model = ws.newBlock('load_model');
        const result = ensureInitialSize(model, null, () => ({ x: 2, y: 3.14, z: 1 }));

        expect(result.created).to.be.true;
        expect(result.block).to.equal(model);
        expect(model.resizeShown_).to.be.true;
        expect(doTypes(model)).to.deep.equal([]);
        expect(getInitialSizeValues(model)).to.deep.equal({ x: 2, y: 3.1, z: 1 });
      });

      it('splices a resize ahead of an existing rotate_to for a block without rows', function () {
        const group = ws.newBlock('create_group');
        ensureInitialRotation(group);
        const result = ensureInitialSize(group, null, () => ({ x: 2, y: 3.14, z: 0 }));

        expect(result.created).to.be.true;
        expect(doTypes(group)).to.deep.equal(['resize', 'rotate_to']);
        expect(result.block.getFieldValue('BLOCK_NAME')).to.equal(ownVar(group));
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
        const rotate = appendTransform(box, 'rotate_to', ownVar(box));
        expect(getInitialTransformOwner(rotate)).to.equal(box);
      });

      it('is null for a transform naming another variable', function () {
        const box = ws.newBlock('create_box');
        const rotate = appendTransform(box, 'rotate_to', otherVariable().getId());
        expect(getInitialTransformOwner(rotate)).to.be.null;
      });

      it('is null for a disabled transform', function () {
        const box = ws.newBlock('create_box');
        const rotate = appendTransform(box, 'rotate_to', ownVar(box));
        rotate.setDisabledReason(true, 'test');
        expect(getInitialTransformOwner(rotate)).to.be.null;
      });
    });

    describe('placeMoveAfterInitialTransforms', function () {
      it('moves a clone move below its own rotate and resize', function () {
        const clone = ws.newBlock('clone_mesh');
        const cloneVar = clone.getFieldValue('CLONE_VAR');
        appendTransform(clone, 'move_to_xyz', cloneVar);
        appendTransform(clone, 'resize', cloneVar);
        appendTransform(clone, 'rotate_to', cloneVar);
        placeMoveAfterInitialTransforms(clone);

        expect(doTypes(clone)).to.deep.equal(['resize', 'rotate_to', 'move_to_xyz']);
      });

      it('leaves statements after the move in place', function () {
        const clone = ws.newBlock('clone_mesh');
        const cloneVar = clone.getFieldValue('CLONE_VAR');
        appendTransform(clone, 'move_to_xyz', cloneVar);
        appendTransform(clone, 'rotate_to', cloneVar);
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
          _getAnchor: flock._getAnchor,
          _applyInitialTransform: flock._applyInitialTransform,
          getBlockPositionFromMesh: flock.getBlockPositionFromMesh,
          setBlockPositionOnMesh: flock.setBlockPositionOnMesh,
        };
        flock.positionAt = (name, opts) => calls.push({ rule: 'anchor', name, opts });
        flock._positionAtBase = (name, opts) => calls.push({ rule: 'base', name, opts });
        flock.updatePhysics = () => {};
        flock._getAnchor = () => ({ x: 0, y: 0, z: 0 });
        flock._applyInitialTransform = () => {};
        flock.getBlockPositionFromMesh = () => ({ x: 0, y: 0, z: 0 });
        flock.setBlockPositionOnMesh = () => {};
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
        appendTransform(box, 'rotate_to', ownVar(box));
        editY(box, 2);
        expect(calls.map((c) => c.rule)).to.deep.equal(['base']);
        expect(Number(calls[0].opts.y)).to.equal(2);
      });

      it('places an add block with rows by its anchor, as creation does', function () {
        const box = makeBox();
        ensureInitialRotation(box, { x: 0, y: 0, z: 45 });
        editY(box, 2);
        expect(calls.map((c) => c.rule)).to.deep.equal(['anchor']);
      });

      it('places a prefab by its anchor, as creation does', function () {
        editY(makeBox(), 2, { isPrefab: true });
        expect(calls.map((c) => c.rule)).to.deep.equal(['anchor']);
      });
    });

    describe('live row edits', function () {
      const created = [];

      afterEach(function () {
        created.splice(0).forEach((id) => flock.dispose(id));
      });

      function makeBoxWithMesh(position) {
        const number = (n) => ({ shadow: { type: 'math_number', fields: { NUM: n } } });
        const box = Blockly.serialization.blocks.append(
          {
            type: 'create_box',
            inputs: { X: number(position.x), Y: number(position.y), Z: number(position.z) },
          },
          ws
        );
        const id = flock.createBox(`liveRowBox_${Date.now()}`, {
          width: 1,
          height: 2,
          depth: 1,
          position: [position.x, position.y, position.z],
        });
        created.push(id);
        return { box, mesh: flock.scene.getMeshByName(id) };
      }

      function worldBox(mesh) {
        mesh.computeWorldMatrix(true);
        mesh.refreshBoundingInfo();
        return mesh.getBoundingInfo().boundingBox;
      }

      it('rotates the mesh and rests its anchor on the block position, as Play does', function () {
        const { box, mesh } = makeBoxWithMesh({ x: 2, y: 0, z: -1 });
        ensureInitialRotation(box, { x: 0, y: 0, z: 90 });
        applyInitialTransformRows(box, [mesh]);

        const bounds = worldBox(mesh);
        expect(bounds.minimumWorld.y).to.be.closeTo(0, 0.01);
        expect(bounds.centerWorld.x).to.be.closeTo(2, 0.01);
        expect(bounds.centerWorld.z).to.be.closeTo(-1, 0.01);
        expect(bounds.maximumWorld.x - bounds.minimumWorld.x).to.be.closeTo(2, 0.01);
      });

      it('keeps a rotated plane centred on its block position, clear of a wall', function () {
        const number = (n) => ({ shadow: { type: 'math_number', fields: { NUM: n } } });
        const block = Blockly.serialization.blocks.append(
          { type: 'create_plane', inputs: { X: number(1.02), Y: number(1), Z: number(0) } },
          ws
        );
        const id = flock.createPlane(`liveRowPlane_${Date.now()}`, {
          width: 2,
          height: 2,
          position: [1.02, 1, 0],
        });
        created.push(id);
        const plane = flock.scene.getMeshByName(id);
        ensureInitialRotation(block, { x: 0, y: -90, z: 0 });
        applyInitialTransformRows(block, [plane]);

        const bounds = worldBox(plane);
        expect(bounds.minimumWorld.x).to.be.closeTo(1.02, 0.001);
        expect(bounds.maximumWorld.x).to.be.closeTo(1.02, 0.001);
        expect(bounds.centerWorld.y).to.be.closeTo(1, 0.001);
      });

      it('turns a rotation edit about the centre and records the new centre base', function () {
        const { box, mesh } = makeBoxWithMesh({ x: 2, y: 0, z: -1 });
        ensureInitialRotation(box, { x: 0, y: 0, z: 90 });
        applyInitialTransformRows(box, [mesh], { aboutCentre: true });

        const bounds = worldBox(mesh);
        expect(bounds.centerWorld.y).to.be.closeTo(1, 0.01);
        expect(bounds.centerWorld.x).to.be.closeTo(2, 0.01);
        expect(getInitialRotationValues(box).z).to.equal(90);
        expect(Number(box.getInputTargetBlock('Y').getFieldValue('NUM'))).to.equal(0.5);
        expect(Number(box.getInputTargetBlock('X').getFieldValue('NUM'))).to.equal(2);
        expect(Number(box.getInputTargetBlock('Z').getFieldValue('NUM'))).to.equal(-1);
      });

      it('records a rotated clone in its move, and places it there after', async function () {
        const sourceId = flock.createBox(`liveRowCloneSource_${Date.now()}`, {
          width: 1,
          height: 2,
          depth: 1,
          position: [3, 0, 0],
        });
        created.push(sourceId);
        const cloneId = flock.cloneMesh({
          sourceMeshName: sourceId,
          cloneId: `liveRowClone_${Date.now()}`,
        });
        created.push(cloneId);
        const cloneMesh = await flock.whenModelReady(cloneId);
        const clone = Blockly.serialization.blocks.append({ type: 'clone_mesh' }, ws);

        ensureInitialRotation(clone, { x: 0, y: 0, z: 90 });
        applyInitialTransformRows(clone, [cloneMesh], { aboutCentre: true });
        const move = clone.getInputTargetBlock('DO');
        expect(move?.type).to.equal('move_to_xyz');
        const read = (name) => Number(move.getInputTargetBlock(name).getFieldValue('NUM'));
        expect(read('Y')).to.equal(0.5);
        expect(worldBox(cloneMesh).centerWorld.y).to.be.closeTo(1, 0.01);

        move.getInputTargetBlock('X').setFieldValue('-2', 'NUM');
        applyInitialTransformRows(clone, [cloneMesh]);
        const bounds = worldBox(cloneMesh);
        expect(bounds.centerWorld.x).to.be.closeTo(-2, 0.01);
        expect(bounds.minimumWorld.y).to.be.closeTo(0.5, 0.01);
      });

      it('stands the mesh back up when rotate is turned off', function () {
        const { box, mesh } = makeBoxWithMesh({ x: 0, y: 0, z: 0 });
        ensureInitialRotation(box, { x: 0, y: 0, z: 90 });
        applyInitialTransformRows(box, [mesh]);
        box.setRotateShown(false);
        applyInitialTransformRows(box, [mesh]);

        const bounds = worldBox(mesh);
        expect(bounds.maximumWorld.y - bounds.minimumWorld.y).to.be.closeTo(2, 0.01);
        expect(bounds.minimumWorld.y).to.be.closeTo(0, 0.01);
      });
    });
  });
}
