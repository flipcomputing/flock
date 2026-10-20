import { expect } from 'chai';
import { javascriptGenerator } from 'blockly/javascript';
import { registerTransformGenerators } from '../generators/generators-transform.js';

export function runTransformGeneratorTests() {
  describe('generators/generators-transform @transformgenerators', function () {
    before(function () {
      registerTransformGenerators(javascriptGenerator);
    });

    function generate(type, block) {
      const originalNameDB = javascriptGenerator.nameDB_;
      const originalValueToCode = javascriptGenerator.valueToCode;
      javascriptGenerator.nameDB_ = { getName: (id) => id };
      javascriptGenerator.valueToCode = (_block, name) =>
        ({ X: '1', Y: '2', Z: '3', MESH_LIST: '[item1, item2]' })[name] ?? '0';
      try {
        return javascriptGenerator.forBlock[type](block);
      } finally {
        javascriptGenerator.nameDB_ = originalNameDB;
        javascriptGenerator.valueToCode = originalValueToCode;
      }
    }

    const fields = (values) => ({ getFieldValue: (name) => values[name] ?? null });

    it('awaits embed_meshes with the base and tool list', function () {
      const code = generate('embed_meshes', {
        id: 'blockId',
        ...fields({ RESULT_VAR: 'embedded1', BASE_MESH: 'object' }),
      });
      expect(code).to.match(
        /^embedded1 = await embedMeshes\("embedded1__blockId", object, \[item1, item2\]\);\n/
      );
    });

    // Later blocks rely on the hierarchy existing, so parenting must finish first.
    it('awaits parent', function () {
      const code = generate('parent', fields({ PARENT_MESH: 'box1', CHILD_MESH: 'item1' }));
      expect(code).to.equal('await setParent(box1, item1);\n');
    });

    it('awaits parent_children with the child list', function () {
      const code = generate('parent_children', fields({ PARENT_MESH: 'box1' }));
      expect(code).to.equal('await setParent(box1, [item1, item2]);\n');
    });

    it('awaits parent_child', function () {
      const code = generate('parent_child', fields({ PARENT_MESH: 'box1', CHILD_MESH: 'item1' }));
      expect(code).to.match(/^await parentChild\(box1, item1,/);
    });

    it('awaits remove_parent', function () {
      const code = generate('remove_parent', fields({ CHILD_MESH: 'item1' }));
      expect(code).to.equal('await removeParent(item1);\n');
    });

    // An object's DO can run after it has been parented, so a world-space
    // rotation there would discard the parent's rotation.
    it("keeps rotate_to relative to the parent in the object's own DO", function () {
      const owner = {
        getFieldValue: (name) => (name === 'ID_VAR' ? 'item1' : null),
        getInputWithBlock: () => ({ name: 'DO' }),
      };
      const rotate = {
        type: 'rotate_to',
        isEnabled: () => true,
        getFieldValue: (name) => (name === 'MODEL' ? 'item1' : null),
        getPreviousBlock: () => null,
        getParent: () => owner,
      };
      const code = generate('rotate_to', rotate);
      expect(code).to.equal('await rotateTo(item1, { x: 1, y: 2, z: 3 });\n');
    });

    it('sets position to xyz including y', function () {
      const code = generate('move_to_xyz', fields({ MODEL: 'item1' }));
      expect(code).to.equal('await positionAt(item1, { x: 1, y: 2, z: 3 });\n');
    });

    it('sets position to another object including y', function () {
      const code = generate('move_to', fields({ MODEL1: 'item1', MODEL2: 'box1' }));
      expect(code).to.equal(
        'await moveTo(item1, { target: box1, offsetX: 0, offsetY: 0, offsetZ: 0 });\n'
      );
    });

    it('follows the center of another object', function () {
      const block = fields({ FOLLOWER_MESH: 'item1', TARGET_MESH: 'box1', SIDE: 'PLACE_CENTER' });
      expect(generate('follow', block).trim()).to.equal(
        'makeFollow(item1, box1, "center", 0, 0, 0);'
      );
    });

    it('follows at another object', function () {
      const block = fields({ FOLLOWER_MESH: 'item1', TARGET_MESH: 'box1', SIDE: 'PLACE_AT' });
      expect(generate('follow', block).trim()).to.equal('makeFollow(item1, box1, "at", 0, 0, 0);');
    });

    it('sets position against a side of another object', function () {
      const block = fields({ MODEL1: 'item1', MODEL2: 'box1', SIDE: 'PLACE_ON_TOP' });
      const code = generate('move_to', block);
      expect(code).to.equal(
        'await moveTo(item1, { target: box1, side: "on_top", offsetX: 0, offsetY: 0, offsetZ: 0 });\n'
      );
    });

    function pointBlock(type, parent) {
      return {
        type,
        isEnabled: () => true,
        getFieldValue: (name) => (name === 'MESH' ? 'item1' : null),
        getPreviousBlock: () => null,
        getParent: () => parent,
      };
    }

    const owner = {
      getFieldValue: (name) => (name === 'ID_VAR' ? 'item1' : null),
      getInputWithBlock: () => ({ name: 'DO' }),
    };
    const start = { getFieldValue: () => null, getInputWithBlock: () => ({ name: 'DO' }) };

    // Neither block depends on being in the object's own DO.
    for (const parent of [owner, start]) {
      const where = parent === owner ? "in the object's own DO" : 'outside its DO';

      it(`sets the pivot ${where}`, function () {
        const code = generate('set_pivot', pointBlock('set_pivot', parent));
        expect(code).to.equal('await setPivot(item1, { x: 0, y: 0, z: 0 });\n');
      });

      it(`sets the anchor ${where}`, function () {
        const code = generate('set_anchor', pointBlock('set_anchor', parent));
        expect(code).to.equal('await setAnchor(item1, { x: 0, y: 0, z: 0 });\n');
      });
    }
  });
}
