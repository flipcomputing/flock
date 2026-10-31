import { expect } from 'chai';
import { javascriptGenerator } from 'blockly/javascript';
import { registerMaterialGenerators } from '../generators/generators-material.js';

export function runMaterialGeneratorTests() {
  describe('generators/generators-material @materialgenerators', function () {
    before(function () {
      registerMaterialGenerators(javascriptGenerator);
    });

    // The colour_from_string generator only reads the COLOR field, so a minimal
    // stub block is enough to exercise it without a full Blockly workspace.
    function colourFromString(value) {
      const block = { getFieldValue: () => value };
      const [code] = javascriptGenerator.forBlock['colour_from_string'](block);
      return JSON.parse(code);
    }

    it('expands 3-digit hex to lowercase 6-digit hex', function () {
      expect(colourFromString('f0c')).to.equal('#ff00cc');
      expect(colourFromString('#f0c')).to.equal('#ff00cc');
      expect(colourFromString('FFF')).to.equal('#ffffff');
    });

    it('preserves 6-digit hex (with or without #)', function () {
      expect(colourFromString('800080')).to.equal('#800080');
      expect(colourFromString('#800080')).to.equal('#800080');
    });

    it('preserves named and functional CSS colours', function () {
      expect(colourFromString('red')).to.equal('red');
      expect(colourFromString('rgb(1, 2, 3)')).to.equal('rgb(1, 2, 3)');
    });

    it('falls back to black for invalid input', function () {
      expect(colourFromString('notacolour')).to.equal('#000000');
    });

    // The colour list arrives through valueToCode, so stub it rather than
    // building a workspace just to hold a lists_create_with block.
    function gradientColour(colorsCode, direction) {
      const originalValueToCode = javascriptGenerator.valueToCode;
      javascriptGenerator.valueToCode = () => colorsCode;
      try {
        const block = { getFieldValue: () => direction };
        const [code] = javascriptGenerator.forBlock['gradient_colour'](block);
        return code;
      } finally {
        javascriptGenerator.valueToCode = originalValueToCode;
      }
    }

    it('emits a flat material descriptor carrying the direction', function () {
      expect(gradientColour('["#ff5733", "#fdfd96"]', 45)).to.equal(
        '{ color: ["#ff5733", "#fdfd96"], materialName: "none.png", direction: 45 }'
      );
    });

    it('omits alpha so the surrounding block keeps control of it', function () {
      expect(gradientColour('["#ff5733", "#fdfd96"]', 0)).to.not.include('alpha');
    });

    function gradientMaterial(fields = {}, inputs = {}) {
      const originalValueToCode = javascriptGenerator.valueToCode;
      javascriptGenerator.valueToCode = (_block, name) =>
        name === 'COLORS' ? '["#3a7bd5", "#ffffff"]' : (inputs[name] ?? '');
      const values = {
        TEXTURE_SET: 'none.png',
        STYLE: 'smooth',
        MODE: 'by_height',
        DIRECTION: 0,
        ...fields,
      };
      try {
        const block = { getFieldValue: (name) => values[name] };
        const [code] = javascriptGenerator.forBlock['gradient_texture_material'](block);
        return code;
      } finally {
        javascriptGenerator.valueToCode = originalValueToCode;
      }
    }

    it('emits a smooth height gradient by default', function () {
      expect(gradientMaterial()).to.equal(
        '{ color: ["#3a7bd5", "#ffffff"], materialName: "none.png", direction: "height", bands: false, alpha: 1, scale: 1, noise: 0 }'
      );
    });

    it('marks bands separately from the direction', function () {
      expect(gradientMaterial({ STYLE: 'bands' })).to.include('direction: "height", bands: true');
    });

    it('emits the angle when the colors run across', function () {
      expect(gradientMaterial({ MODE: 'across', DIRECTION: 45 })).to.include('direction: 45,');
    });

    it('ignores the angle field when the colors run by height', function () {
      expect(gradientMaterial({ DIRECTION: 45 })).to.include('direction: "height"');
    });

    it('passes the chosen texture through', function () {
      expect(gradientMaterial({ TEXTURE_SET: 'grass.png' })).to.include(
        'materialName: "grass.png"'
      );
    });

    it('passes alpha and scale through', function () {
      expect(gradientMaterial({}, { ALPHA: '0.5', SCALE: '3' })).to.include('alpha: 0.5, scale: 3');
    });

    it('passes noise through', function () {
      expect(gradientMaterial({}, { NOISE: '0.6' })).to.include('noise: 0.6 }');
    });

    function materialCode(inputs) {
      const originalValueToCode = javascriptGenerator.valueToCode;
      javascriptGenerator.valueToCode = (_block, name) => inputs[name] ?? '';
      try {
        const block = { getFieldValue: () => 'bricks.png' };
        const [code] = javascriptGenerator.forBlock['material'](block);
        return code.replace(/\s+/g, ' ');
      } finally {
        javascriptGenerator.valueToCode = originalValueToCode;
      }
    }

    it('passes the material scale through', function () {
      expect(
        materialCode({ BASE_COLOR: '"#ff0000"', ALPHA: '0.5', SCALE: '2', ANGLE: '45' })
      ).to.include('alpha: 0.5, scale: 2, angle: 45');
    });

    it('defaults alpha, scale and angle when their inputs are empty', function () {
      expect(materialCode({ BASE_COLOR: '"#ff0000"' })).to.include('alpha: 1, scale: 1, angle: 0');
    });

    it('defaults to an empty list and zero degrees', function () {
      expect(gradientColour('', undefined)).to.equal(
        '{ color: [], materialName: "none.png", direction: 0 }'
      );
    });
  });
}
