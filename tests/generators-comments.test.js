import { expect } from 'chai';
import * as Blockly from 'blockly';
import { javascriptGenerator } from 'blockly/javascript';
import { defineGenerators } from '../generators/generators.js';
import { defineTextBlocks } from '../blocks/text.js';
import { generateWorkspaceCode } from '../blocks/sectionContainment.js';
import { isProjectLoading, setProjectLoading } from '../main/projectLoading.js';

export function runCommentGeneratorTests() {
  describe('generators/generators-comments @commentgenerators', function () {
    let workspace;
    let savedLoadingCode;

    before(function () {
      if (!Blockly.Blocks['comment']) defineTextBlocks();
      if (!javascriptGenerator.forBlock['comment']) defineGenerators();
    });

    beforeEach(function () {
      savedLoadingCode = isProjectLoading();
      setProjectLoading(true);
      workspace = new Blockly.Workspace();
    });

    afterEach(function () {
      workspace.dispose();
      setProjectLoading(savedLoadingCode);
    });

    const run = (blocks, workspaceComments) => {
      Blockly.serialization.workspaces.load(
        { blocks: { languageVersion: 0, blocks }, ...(workspaceComments && { workspaceComments }) },
        workspace
      );
      const code = generateWorkspaceCode(workspace, javascriptGenerator);
      const ran = [];
      new Function('INJECTED', code)(() => ran.push('INJECTED'));
      return { code, ran };
    };

    const breaks = [
      ['a carriage return', '\r'],
      ['a line separator', String.fromCharCode(0x2028)],
      ['a paragraph separator', String.fromCharCode(0x2029)],
      ['a CRLF', '\r\n'],
      ['a newline', '\n'],
    ];

    for (const [label, sep] of breaks) {
      describe(`with ${label}`, function () {
        it('should keep an attached block comment as comment lines', function () {
          const { code, ran } = run([
            { type: 'math_number', fields: { NUM: 1 }, icons: { comment: { text: `hi${sep}INJECTED()` } } },
          ]);
          expect(ran).to.deep.equal([]);
          expect(code).to.include('// hi\n// INJECTED()\n');
        });

        it('should keep a comment on a nested block as comment lines', function () {
          const { code, ran } = run([
            {
              type: 'math_arithmetic',
              fields: { OP: 'ADD' },
              inputs: {
                A: {
                  block: {
                    type: 'math_number',
                    fields: { NUM: 1 },
                    icons: { comment: { text: `hi${sep}INJECTED()` } },
                  },
                },
                B: { block: { type: 'math_number', fields: { NUM: 2 } } },
              },
            },
          ]);
          expect(ran).to.deep.equal([]);
          expect(code).to.include('// hi\n// INJECTED()\n');
        });

        it('should leave workspace comments out of the code', function () {
          const { code, ran } = run(
            [{ type: 'math_number', fields: { NUM: 1 } }],
            [{ id: 'note', x: 0, y: 0, text: `hi${sep}INJECTED()` }]
          );
          expect(workspace.getTopComments()).to.have.length(1);
          expect(ran).to.deep.equal([]);
          expect(code).to.not.include('INJECTED');
        });

        it('should keep a comment block as comment lines', function () {
          const { code, ran } = run([
            {
              type: 'comment',
              inputs: {
                COMMENT: { block: { type: 'text_multiline', fields: { TEXT: `hi${sep}INJECTED()` } } },
              },
            },
          ]);
          expect(ran).to.deep.equal([]);
          expect(code).to.include('// hi\n// INJECTED()\n');
        });
      });
    }

    it('should keep backslashes, slashes, backticks and tabs in comment text', function () {
      const text = 'C:\\new folder\\ // see `notes` */\tend\\';
      const { code, ran } = run([
        { type: 'math_number', fields: { NUM: 1 }, icons: { comment: { text } } },
        {
          type: 'comment',
          inputs: { COMMENT: { block: { type: 'text_multiline', fields: { TEXT: text } } } },
        },
      ]);
      expect(ran).to.deep.equal([]);
      expect(code.split('\n').filter((line) => line === `// ${text}`)).to.have.length(2);
    });

    it('should drop invisible control characters from comment text', function () {
      const text = `a${String.fromCharCode(0)}b${String.fromCharCode(0x85)}c`;
      const { code } = run([
        { type: 'math_number', fields: { NUM: 1 }, icons: { comment: { text } } },
      ]);
      expect(code).to.include('// abc\n');
    });

    it('should wrap a long attached comment without losing words', function () {
      const words = Array.from({ length: 20 }, (_, i) => `word${i}`);
      const { code } = run([
        { type: 'math_number', fields: { NUM: 1 }, icons: { comment: { text: words.join(' ') } } },
      ]);
      const commentWords = code
        .split('\n')
        .filter((line) => line.startsWith('// '))
        .flatMap((line) => line.slice(3).split(' '));
      expect(commentWords).to.deep.equal(words);
    });
  });
}
