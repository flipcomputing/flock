import { expect } from 'chai';
import * as Blockly from 'blockly';
import { javascriptGenerator } from 'blockly/javascript';
import { parse } from 'acorn';
import { initializeBlocks } from '../../main/blocklyinit.js';

initializeBlocks(); // registers all Flock custom blocks + generators

// Assert the code is a single expression statement and return its expression,
// so the payload can be checked structurally rather than by executing it.
function soleExpression(code) {
  const program = parse(code, { ecmaVersion: 'latest' });
  expect(program.body).to.have.lengthOf(1);
  expect(program.body[0].type).to.equal('ExpressionStatement');
  return program.body[0].expression;
}

function classifyField(field) {
  if (field instanceof Blockly.FieldVariable) return 'variable-name';
  if (field instanceof Blockly.FieldDropdown) return 'dropdown';
  if (field instanceof Blockly.FieldTextInput) return 'free-text';
  return null; // labels, checkboxes, numbers, images — not a text surface
}

function scanRegisteredBlocks(workspace) {
  const found = [];
  for (const type of Object.keys(Blockly.Blocks)) {
    let block;
    try {
      block = workspace.newBlock(type);
    } catch {
      continue; // blocks whose init needs a full UI environment
    }
    for (const input of block.inputList) {
      for (const field of input.fieldRow) {
        const kind = classifyField(field);
        if (kind === 'free-text') {
          found.push(`${type}.${field.name}`);
        }
      }
    }
    block.dispose();
  }
  return found.sort();
}

const TESTED_TEXT_FIELDS = [
  'text.TEXT',
  'colour_from_string.COLOR',
  'procedures_defnoreturn.NAME',
  'procedures_defreturn.NAME',
  'procedures_mutatorarg.NAME',
  'text_prompt.TEXT',
  'play_tune.ABC_TEXT',
  'keyword.KEYWORD',
  'keyword_value.KEYWORD',
  'section.NAME',
  'section.COMMENT',
  'text_multiline.TEXT',
];

const payload = '"; alert(1); //';

export function runTextFieldValidationTests() {
  describe('Text Field Validation @security', function () {
    this.timeout(5000);

    let workspace = new Blockly.Workspace();

    after(function () {
      workspace.dispose();
    });

    afterEach(function () {
      workspace.clear();
    });

    // all tested blocks are  value blocks, so blockToCode returns
    // [code, order] — unwrap to just the code string.
    function generate(block) {
      javascriptGenerator.init(workspace);
      const code = javascriptGenerator.blockToCode(block);
      return Array.isArray(code) ? code[0] : code;
    }

    for (const block of scanRegisteredBlocks(workspace)) {
      it(block + ' has a test', function () {
        expect(TESTED_TEXT_FIELDS).to.include(block);
      });
    }

    it('stringifies text field', function () {
      const block = Blockly.serialization.blocks.append(
        {
          type: 'text',
          fields: { TEXT: payload },
        },
        workspace
      );
      const expression = soleExpression(generate(block));
      expect(expression.type).to.equal('Literal');
      expect(expression.value).to.equal(payload);
    });

    it('stringifies multiline text field', function () {
      const block = Blockly.serialization.blocks.append(
        {
          type: 'text_multiline',
          fields: { TEXT: payload },
        },
        workspace
      );
      const expression = soleExpression(generate(block));
      expect(expression.type).to.equal('Literal');
      expect(expression.value).to.equal(payload);
    });

    it('comment block never lets an embedded newline turn into real code', function () {
      const maliciousComment = 'safe first line\nalert(1);\n*/ evil() /*\n// nested comment';
      const block = Blockly.serialization.blocks.append(
        {
          type: 'comment',
          inputs: {
            COMMENT: {
              shadow: { type: 'text_multiline', fields: { TEXT: maliciousComment } },
            },
          },
        },
        workspace
      );

      const code = generate(block);

      const program = parse(code, { ecmaVersion: 'latest' });
      expect(program.body).to.have.lengthOf(0);

      expect(code).to.include('// safe first line');
      expect(code).to.include('alert(1);');
      expect(code).not.to.include('*/');
      expect(code.match(/\/\//g).length).to.be.at.least(4);
    });

    it('comment block treats U+2028/U+2029 as line terminators too, not just \\n', function () {
      // ECMAScript also ends a `//` comment at U+2028/U+2029.
      const payloadWithLineSeparators = 'safe text alert(1); more(2);';
      const block = Blockly.serialization.blocks.append(
        {
          type: 'comment',
          inputs: {
            COMMENT: {
              shadow: { type: 'text_multiline', fields: { TEXT: payloadWithLineSeparators } },
            },
          },
        },
        workspace
      );

      const code = generate(block);
      const program = parse(code, { ecmaVersion: 'latest' });
      expect(program.body).to.have.lengthOf(0);
      expect(code).not.to.include('alert(1)');
      expect(code).not.to.include('more(2)');
    });

    it('fixes name of procedure without return', function () {
      const block = Blockly.serialization.blocks.append(
        {
          type: 'procedures_defnoreturn',
          fields: { NAME: payload },
        },
        workspace
      );
      block.argData_ = [];
      expect(generate(block)).not.to.include(payload);
    });

    it('fixes name of procedure with return', function () {
      const block = Blockly.serialization.blocks.append(
        {
          type: 'procedures_defreturn',
          fields: { NAME: payload },
        },
        workspace
      );
      block.argData_ = [];
      expect(generate(block)).not.to.include(payload);
    });

    it('sanitizes a procedure argument name', function () {
      const block = Blockly.serialization.blocks.append(
        {
          type: 'procedures_defnoreturn',
          extraState: { params: [{ name: payload, id: 'arg1' }] },
          fields: { NAME: 'safe' },
        },
        workspace
      );
      expect(generate(block)).not.to.include(payload);
    });

    it('stringifies text prompt input', function () {
      const block = Blockly.serialization.blocks.append(
        {
          type: 'text_prompt',
          fields: { TEXT: payload },
        },
        workspace
      );
      const call = soleExpression(generate(block));
      expect(call.type).to.equal('CallExpression');
      expect(call.callee.type).to.equal('MemberExpression');
      expect(call.callee.computed).to.equal(false);
      expect(call.callee.object.name).to.equal('window');
      expect(call.callee.property.name).to.equal('prompt');
      expect(call.arguments).to.have.lengthOf(1);
      expect(call.arguments[0].type).to.equal('Literal');
      expect(call.arguments[0].value).to.equal(payload);
    });

    it('the play tune block generates an empty string', function () {
      const block = Blockly.serialization.blocks.append(
        {
          type: 'play_tune',
        },
        workspace
      );
      expect(generate(block)).to.equal('');
    });

    it('an unresolved keyword block generates nothing, not its typed text', function () {
      const block = Blockly.serialization.blocks.append(
        {
          type: 'keyword',
          fields: { KEYWORD: payload },
        },
        workspace
      );
      expect(generate(block)).to.equal('');
    });

    it('an unresolved value keyword block generates null, not its typed text', function () {
      const block = Blockly.serialization.blocks.append(
        {
          type: 'keyword_value',
          fields: { KEYWORD: payload },
        },
        workspace
      );
      expect(generate(block)).to.equal('null');
    });

    it('section name is never emitted into generated code', function () {
      const block = Blockly.serialization.blocks.append(
        {
          type: 'section',
          fields: { NAME: payload },
        },
        workspace
      );
      expect(generate(block)).not.to.include(payload);
    });

    it('section comment is never emitted into generated code', function () {
      const block = Blockly.serialization.blocks.append(
        {
          type: 'section',
          fields: { COMMENT: payload },
        },
        workspace
      );
      expect(generate(block)).not.to.include(payload);
    });

    it('an unresolved keyword block does not stop the blocks below it', function () {
      const block = Blockly.serialization.blocks.append(
        {
          type: 'keyword',
          fields: { KEYWORD: payload },
          next: { block: { type: 'wait_seconds' } },
        },
        workspace
      );
      const code = generate(block);
      expect(code).not.to.include(payload);
      expect(code).to.include('wait');
    });
  });
}
