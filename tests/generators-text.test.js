import { expect } from 'chai';
import * as Blockly from 'blockly';
import { javascriptGenerator } from 'blockly/javascript';
import { registerTextGenerators } from '../generators/generators-text.js';
import { defineGenerators } from '../generators/generators.js';
import { defineTextBlocks } from '../blocks/text.js';

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

    describe('create_3d_text', function () {
      let workspace;

      before(function () {
        if (!Blockly.Blocks['create_3d_text']) defineTextBlocks();
        if (!javascriptGenerator.forBlock['comment']) defineGenerators();
      });

      beforeEach(function () {
        workspace = new Blockly.Workspace();
      });

      afterEach(function () {
        workspace.dispose();
      });

      const text = (TEXT) => ({ type: 'text', fields: { TEXT } });

      function shownText(child) {
        const block = Blockly.serialization.blocks.append(
          { type: 'create_3d_text', inputs: { TEXT: { block: child } } },
          workspace
        );
        javascriptGenerator.init(workspace);
        const code = javascriptGenerator.blockToCode(block);
        const expression = code.match(/^\s*text: (.*),$/m)[1];
        return new Function(`return ${expression};`)();
      }

      const cases = [
        ['plain text', text('Hello'), 'Hello'],
        ['an apostrophe', text("it's"), "it's"],
        ['a backslash', text(String.raw`a\b`), String.raw`a\b`],
        ['a URL and backticks', text('see http://x.com `a` */'), 'see http://x.com `a` */'],
      ];

      for (const [label, child, expected] of cases) {
        it(`should show ${label} unchanged`, function () {
          expect(shownText(child)).to.equal(expected);
        });
      }

      it('should show the value of joined text, not its code', function () {
        expect(
          shownText({
            type: 'text_join',
            extraState: { itemCount: 2 },
            inputs: { ADD0: { block: text('a') }, ADD1: { block: text('b') } },
          })
        ).to.equal('ab');
      });

      it('should default to Hello World with nothing plugged in', function () {
        const block = Blockly.serialization.blocks.append({ type: 'create_3d_text' }, workspace);
        javascriptGenerator.init(workspace);
        expect(javascriptGenerator.blockToCode(block)).to.contain('text: "Hello World",');
      });
    });
  });
}
