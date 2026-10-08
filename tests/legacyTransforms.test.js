import { expect } from 'chai';
import * as Blockly from 'blockly';
import { defineModelBlocks } from '../blocks/models.js';
import { defineShapeBlocks } from '../blocks/shapes.js';
import { defineTransformBlocks } from '../blocks/transform.js';
import { defineSceneBlocks } from '../blocks/scene.js';
import { defineTextBlocks } from '../blocks/text.js';
import { findFoldableTransforms, foldLegacyInitialTransforms } from '../ui/legacyTransforms.js';
import { getInitialRotationValues, getInitialSizeValues } from '../ui/initialTransform.js';

export function runLegacyTransformTests(flock) {
  describe('folding old DO rotate and resize into the rows @legacytransforms', function () {
    this.timeout(20000);
    let ws;
    let stubs;
    const created = [];

    before(function () {
      if (!Blockly.Blocks['load_object']) defineModelBlocks();
      if (!Blockly.Blocks['create_box']) defineShapeBlocks();
      if (!Blockly.Blocks['rotate_to']) defineTransformBlocks();
      if (!Blockly.Blocks['clone_mesh']) defineSceneBlocks();
      if (!Blockly.Blocks['create_3d_text']) defineTextBlocks();
      if (!Blockly.getMainWorkspace()) Blockly.common.setMainWorkspace(new Blockly.Workspace());
      ws = Blockly.getMainWorkspace();
    });

    beforeEach(function () {
      stubs = ['initSvg', 'render'].filter((name) => !Blockly.Block.prototype[name]);
      stubs.forEach((name) => (Blockly.Block.prototype[name] = function () {}));
    });

    afterEach(function () {
      created.splice(0).forEach((id) => flock.dispose(id));
      ws.getTopBlocks(false).forEach((b) => b.dispose(false));
      stubs.forEach((name) => delete Blockly.Block.prototype[name]);
    });

    const number = (n) => ({ shadow: { type: 'math_number', fields: { NUM: n } } });
    const xyz = ([x, y, z]) => ({ X: number(x), Y: number(y), Z: number(z) });

    function ownerWithDo(type, position, statements) {
      const owner = Blockly.serialization.blocks.append(
        {
          type,
          ...(position ? { inputs: xyz(position) } : {}),
          extraState: '<mutation has_do="true"></mutation>',
        },
        ws
      );
      const ownVar = owner.getFieldValue(type === 'clone_mesh' ? 'CLONE_VAR' : 'ID_VAR');
      let previous = owner.getInput('DO').connection;
      for (const { type: statementType, values, varId, fields = {} } of statements) {
        const varField = statementType === 'resize' ? 'BLOCK_NAME' : 'MODEL';
        if (statementType === 'move_to_xyz') fields.USE_Y = 'TRUE';
        const statement = Blockly.serialization.blocks.append(
          {
            type: statementType,
            fields: { [varField]: { id: varId ?? ownVar }, ...fields },
            inputs: xyz(values),
          },
          ws
        );
        previous.connect(statement.previousConnection);
        previous = statement.nextConnection;
      }
      return owner;
    }

    function doTypes(owner) {
      const types = [];
      for (let cur = owner.getInputTargetBlock('DO'); cur; cur = cur.getNextBlock()) {
        types.push(cur.type);
      }
      return types;
    }

    function bounds(mesh) {
      mesh.computeWorldMatrix(true);
      mesh.refreshBoundingInfo();
      const box = mesh.getBoundingInfo().boundingBox;
      return { min: box.minimumWorld.clone(), max: box.maximumWorld.clone() };
    }

    function expectSameBounds(a, b, tolerance) {
      for (const key of ['min', 'max']) {
        for (const axis of ['x', 'y', 'z']) {
          expect(a[key][axis], `${key}.${axis}`).to.be.closeTo(b[key][axis], tolerance);
        }
      }
    }

    const readPosition = (owner) =>
      ['X', 'Y', 'Z'].map((name) => Number(owner.getInputTargetBlock(name).getFieldValue('NUM')));

    const whenReady = (id) => new Promise((resolve) => flock.whenModelReady(id, resolve));

    it('folds a rotate_to on a box without moving it, and Play matches', async function () {
      const id = flock.createBox(`legacyBox_${Date.now()}`, {
        width: 1,
        height: 2,
        depth: 1,
        position: [2, 0, -1],
      });
      created.push(id);
      await flock.rotateTo(id, { x: 0, y: 0, z: 45, world: true });
      const mesh = flock.scene.getMeshByName(id);
      const legacy = bounds(mesh);

      const owner = ownerWithDo(
        'create_box',
        [2, 0, -1],
        [{ type: 'rotate_to', values: [0, 0, 45] }]
      );
      expect(foldLegacyInitialTransforms(owner, mesh)).to.be.true;

      expect(owner.getInput('DO')).to.be.null;
      expect(owner.getInput('ROTATE_X').isVisible()).to.be.true;
      expect(owner.rotateShown_).to.be.true;
      expect(getInitialRotationValues(owner)).to.deep.equal({ x: 0, y: 0, z: 45 });
      expectSameBounds(bounds(mesh), legacy, 1e-6);

      const [x, y, z] = readPosition(owner);
      const replayId = flock.createBox(`legacyBoxReplay_${Date.now()}`, {
        width: 1,
        height: 2,
        depth: 1,
        position: [x, y, z],
        rotation: getInitialRotationValues(owner),
      });
      created.push(replayId);
      expectSameBounds(bounds(flock.scene.getMeshByName(replayId)), legacy, 0.006);
    });

    it('folds a resize and rotate_to on a model, and Play matches', async function () {
      const legacyId = flock.createObject({
        modelName: 'tree.glb',
        modelId: `legacyTree_${Date.now()}`,
        position: { x: 1, y: 0, z: 3 },
      });
      created.push(legacyId);
      await whenReady(legacyId);
      await flock.resize(legacyId, { width: 2, height: 3, depth: 2 });
      await flock.rotateTo(legacyId, { x: 0, y: 30, z: 20, world: true });
      const mesh = flock.scene.getMeshByName(legacyId);
      const legacy = bounds(mesh);

      const owner = ownerWithDo(
        'load_object',
        [1, 0, 3],
        [
          { type: 'resize', values: [2, 3, 2] },
          { type: 'rotate_to', values: [0, 30, 20] },
        ]
      );
      expect(foldLegacyInitialTransforms(owner, mesh)).to.be.true;
      expect(doTypes(owner)).to.deep.equal([]);
      expect(getInitialSizeValues(owner)).to.deep.equal({ x: 2, y: 3, z: 2 });
      expectSameBounds(bounds(mesh), legacy, 1e-6);

      const [x, y, z] = readPosition(owner);
      const replayId = flock.createObject({
        modelName: 'tree.glb',
        modelId: `legacyTreeReplay_${Date.now()}`,
        position: { x, y, z },
        rotation: getInitialRotationValues(owner),
        size: { width: 2, height: 3, depth: 2 },
      });
      created.push(replayId);
      await whenReady(replayId);
      expectSameBounds(bounds(flock.scene.getMeshByName(replayId)), legacy, 0.006);
    });

    it('folds 3D text placed by its origin, and Play matches', async function () {
      const legacyId = flock.create3DText({
        text: 'Hi',
        font: '/fonts/FreeSansBold.ttf',
        size: 1,
        depth: 0.2,
        position: { x: 1, y: 0.5, z: 2 },
        modelId: `legacyText_${Date.now()}`,
      });
      created.push(legacyId);
      const mesh = await whenReady(legacyId);
      await flock.rotateTo(legacyId, { x: 0, y: 40, z: 15, world: true });
      const legacy = bounds(mesh);

      const owner = ownerWithDo(
        'create_3d_text',
        [1, 0.5, 2],
        [{ type: 'rotate_to', values: [0, 40, 15] }]
      );
      expect(foldLegacyInitialTransforms(owner, mesh)).to.be.true;
      expectSameBounds(bounds(mesh), legacy, 1e-6);

      const [x, y, z] = readPosition(owner);
      const replayId = flock.create3DText({
        text: 'Hi',
        font: '/fonts/FreeSansBold.ttf',
        size: 1,
        depth: 0.2,
        position: { x, y, z },
        rotation: getInitialRotationValues(owner),
        modelId: `legacyTextReplay_${Date.now()}`,
      });
      created.push(replayId);
      expectSameBounds(bounds(await whenReady(replayId)), legacy, 0.006);
    });

    it('folds a clone whose own move comes straight after, keeping the move', function () {
      const owner = ownerWithDo('clone_mesh', null, [
        { type: 'resize', values: [2, 2, 2] },
        { type: 'rotate_to', values: [0, 45, 0] },
        { type: 'move_to_xyz', values: [1, 0, 1] },
      ]);
      expect(foldLegacyInitialTransforms(owner)).to.be.true;
      expect(doTypes(owner)).to.deep.equal(['move_to_xyz']);
      expect(owner.getInput('DO').isVisible()).to.be.true;
      expect(getInitialRotationValues(owner)).to.deep.equal({ x: 0, y: 45, z: 0 });
      expect(getInitialSizeValues(owner)).to.deep.equal({ x: 2, y: 2, z: 2 });
    });

    it('keeps the statements after the folded blocks', function () {
      const other = ws.getVariableMap().createVariable(`legacyOther_${Date.now()}`);
      const owner = ownerWithDo(
        'create_box',
        [0, 0, 0],
        [
          { type: 'rotate_to', values: [0, 90, 0] },
          { type: 'rotate_to', values: [0, 10, 0], varId: other.getId() },
        ]
      );
      const mesh = flock.scene.getMeshByName(
        flock.createBox(`legacyKeep_${Date.now()}`, { position: [0, 0, 0] })
      );
      created.push(mesh.name);
      foldLegacyInitialTransforms(owner, mesh);
      expect(doTypes(owner)).to.deep.equal(['rotate_to']);
      expect(owner.getInputTargetBlock('DO').getFieldValue('MODEL')).to.equal(other.getId());
    });

    describe('leaves the old blocks when folding could change the result', function () {
      it('when a value is not a plain number', function () {
        const owner = ownerWithDo(
          'create_box',
          [0, 0, 0],
          [{ type: 'rotate_to', values: [0, 0, 0] }]
        );
        const rotate = owner.getInputTargetBlock('DO');
        const variable = ws.getVariableMap().createVariable(`legacyAngle_${Date.now()}`);
        const getter = Blockly.serialization.blocks.append(
          { type: 'variables_get', fields: { VAR: { id: variable.getId() } } },
          ws
        );
        rotate.getInput('Z').connection.connect(getter.outputConnection);
        expect(findFoldableTransforms(owner)).to.be.null;
      });

      it('when another statement comes first', function () {
        const other = ws.getVariableMap().createVariable(`legacyFirst_${Date.now()}`);
        const owner = ownerWithDo(
          'create_box',
          [0, 0, 0],
          [
            { type: 'rotate_to', values: [0, 10, 0], varId: other.getId() },
            { type: 'rotate_to', values: [0, 90, 0] },
          ]
        );
        expect(findFoldableTransforms(owner)).to.be.null;
      });

      it('when rotate_to comes before resize', function () {
        const owner = ownerWithDo(
          'load_object',
          [0, 0, 0],
          [
            { type: 'rotate_to', values: [0, 90, 0] },
            { type: 'resize', values: [1, 1, 1] },
          ]
        );
        expect(findFoldableTransforms(owner).resize).to.be.null;
      });

      it('when the block is disabled', function () {
        const owner = ownerWithDo(
          'create_box',
          [0, 0, 0],
          [{ type: 'rotate_to', values: [0, 90, 0] }]
        );
        owner.getInputTargetBlock('DO').setDisabledReason(true, 'test');
        expect(findFoldableTransforms(owner)).to.be.null;
      });

      it('when DO sets the pivot', function () {
        const owner = ownerWithDo(
          'create_box',
          [0, 0, 0],
          [{ type: 'rotate_to', values: [0, 90, 0] }]
        );
        const pivot = Blockly.serialization.blocks.append(
          { type: 'set_pivot', fields: { MESH: { id: owner.getFieldValue('ID_VAR') } } },
          ws
        );
        owner.getInputTargetBlock('DO').nextConnection.connect(pivot.previousConnection);
        expect(findFoldableTransforms(owner)).to.be.null;
      });

      it('when a clone has no move straight after', function () {
        const owner = ownerWithDo('clone_mesh', null, [{ type: 'rotate_to', values: [0, 45, 0] }]);
        expect(findFoldableTransforms(owner)).to.be.null;
      });

      it('when a primitive has a resize', function () {
        const owner = ownerWithDo('create_box', [0, 0, 0], [{ type: 'resize', values: [1, 1, 1] }]);
        expect(findFoldableTransforms(owner)).to.be.null;
      });
    });
  });
}
