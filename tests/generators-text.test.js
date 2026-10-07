import { expect } from 'chai';
import { javascriptGenerator } from 'blockly/javascript';
import { registerTextGenerators } from '../generators/generators-text.js';

export function runTextGeneratorTests() {
  describe('generators/generators-text @textgenerators', function () {
    before(function () {
      registerTextGenerators(javascriptGenerator);
    });

    function printTextCode(textCode) {
      const originalValueToCode = javascriptGenerator.valueToCode;
      javascriptGenerator.valueToCode = (_block, name) => (name === 'TEXT' ? textCode : '');
      try {
        return javascriptGenerator.forBlock['print_text']({});
      } finally {
        javascriptGenerator.valueToCode = originalValueToCode;
      }
    }

    it('passes text through unchanged, including URLs, line breaks and backticks', function () {
      const textCode = JSON.stringify('see https://flockxr.com\nand `this` */');
      expect(printTextCode(textCode)).to.contain(`text: ${textCode},`);
    });

    it('passes joined text through as an expression', function () {
      expect(printTextCode("'a' + 'b'")).to.contain("text: 'a' + 'b',");
    });
  });
}
