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
  });
}
