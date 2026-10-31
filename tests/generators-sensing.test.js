import { expect } from 'chai';
import { javascriptGenerator } from 'blockly/javascript';
import { registerSensingGenerators } from '../generators/generators-sensing.js';

export function runSensingGeneratorTests() {
  describe('generators/generators-sensing @sensinggenerators', function () {
    before(function () {
      registerSensingGenerators(javascriptGenerator);
    });

    function generateGroundLevel(groundBlock) {
      const originalValueToCode = javascriptGenerator.valueToCode;
      javascriptGenerator.valueToCode = (_block, name) => ({ X: 'px', Z: 'pz' })[name] ?? '';
      try {
        return javascriptGenerator.forBlock['ground_level'](groundBlock)[0];
      } finally {
        javascriptGenerator.valueToCode = originalValueToCode;
      }
    }

    // Minimal block tree: type, named inputs holding children, and a parent.
    function block(type, inputs = {}) {
      const node = {
        type,
        parent: null,
        getParent: () => node.parent,
        getInput: (name) => (name in inputs ? {} : null),
        getInputTargetBlock: (name) => inputs[name] ?? null,
        getDescendants: () => [
          node,
          ...Object.values(inputs)
            .filter(Boolean)
            .flatMap((child) => child.getDescendants()),
        ],
      };
      Object.values(inputs)
        .filter(Boolean)
        .forEach((child) => (child.parent = node));
      return node;
    }

    const ground = () => block('ground_level');
    const plus = (a) => block('math_arithmetic', { A: a, B: null });

    it('gives the placeholder directly in a position input', function () {
      const g = ground();
      block('create_box', { X: null, Y: g, Z: null });
      expect(generateGroundLevel(g)).to.equal('-999999');
    });

    it('gives the placeholder outside maths', function () {
      expect(generateGroundLevel(ground())).to.equal('-999999');
      const g = ground();
      block('variables_set', { VALUE: g });
      expect(generateGroundLevel(g)).to.equal('-999999');
    });

    it("waits for the terrain and uses the ground under the block's X and Z inside maths", function () {
      const g = ground();
      block('create_box', { X: null, Y: plus(g), Z: null });
      expect(generateGroundLevel(g)).to.equal('(await groundReady(), groundLevelAt(px, pz))');
    });

    it('uses the origin inside maths with no enclosing position', function () {
      const g = ground();
      plus(g);
      expect(generateGroundLevel(g)).to.equal('(await groundReady(), groundLevelAt(0, 0))');
    });

    it('uses 0 for a coordinate that itself uses ground level, so it does not recurse', function () {
      const inX = ground();
      const inZ = ground();
      block('create_box', { X: plus(inX), Y: null, Z: plus(inZ) });
      expect(generateGroundLevel(inX)).to.equal('(await groundReady(), groundLevelAt(0, 0))');

      const inY = ground();
      block('create_box', { X: plus(ground()), Y: plus(inY), Z: null });
      expect(generateGroundLevel(inY)).to.equal('(await groundReady(), groundLevelAt(0, pz))');
    });

    it('does not await inside a wait until condition, which is checked synchronously', function () {
      const g = ground();
      block('wait_until', { CONDITION: block('logic_compare', { A: plus(g), B: null }) });
      expect(generateGroundLevel(g)).to.equal('groundLevelAt(0, 0)');
    });
  });
}
