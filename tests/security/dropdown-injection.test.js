import { expect } from 'chai';
import * as Blockly from 'blockly';
import { javascriptGenerator } from 'blockly/javascript';
import { parse } from 'acorn';
import * as walk from 'acorn-walk';

// One payload per context a raw value could land in: code, each kind of quote,
// a template literal, a line comment and a block comment.
const PAYLOADS = [
  'INJECTED();x',
  "');INJECTED();('",
  '");INJECTED();("',
  '`+INJECTED()+`',
  '${INJECTED()}',
  '\nINJECTED();\n',
  '*/INJECTED();/*',
];

function analyse(code) {
  let program;
  try {
    program = parse(code, {
      ecmaVersion: 'latest',
      sourceType: 'script',
      allowAwaitOutsideFunction: true,
      allowReturnOutsideFunction: true,
    });
  } catch {
    return { parses: false, injected: false };
  }
  let injected = false;
  walk.full(program, (node) => {
    if (node.type === 'CallExpression' && node.callee.type === 'Identifier') {
      injected ||= node.callee.name === 'INJECTED';
    }
  });
  return { parses: true, injected };
}

function dropdownFields(workspace) {
  const found = [];
  for (const type of Object.keys(Blockly.Blocks)) {
    let block;
    try {
      block = workspace.newBlock(type);
    } catch {
      continue;
    }
    for (const input of block.inputList) {
      for (const field of input.fieldRow) {
        if (field instanceof Blockly.FieldDropdown && field.name) found.push([type, field.name]);
      }
    }
    block.dispose();
  }
  return found;
}

export function runDropdownInjectionTests() {
  describe('Dropdown value injection @security', function () {
    this.timeout(5000);

    const workspace = new Blockly.Workspace();

    after(function () {
      workspace.dispose();
    });

    afterEach(function () {
      workspace.clear();
    });

    function generate(type, fieldName, value) {
      const block = workspace.newBlock(type);
      if (value !== undefined) block.getField(fieldName).value_ = value;
      javascriptGenerator.init(workspace);
      let code = javascriptGenerator.blockToCode(block);
      if (Array.isArray(code)) code = `(${code[0]});`;
      return javascriptGenerator.finish(code);
    }

    for (const [type, fieldName] of dropdownFields(workspace)) {
      it(`${type}.${fieldName} never turns its value into code`, function () {
        let baseline;
        try {
          baseline = analyse(generate(type, fieldName));
        } catch {
          this.skip();
        }
        if (!baseline.parses) this.skip();

        for (const payload of PAYLOADS) {
          workspace.clear();
          let code;
          try {
            code = generate(type, fieldName, payload);
          } catch {
            continue;
          }
          const result = analyse(code);
          expect(result.injected, `${JSON.stringify(payload)} ran as code:\n${code}`).to.equal(false);
          // An unknown value that a lookup turns into nothing can break the code
          // without reaching it; only a break that carries the payload is raw.
          const raw = !result.parses && code.includes(payload);
          expect(raw, `${JSON.stringify(payload)} was written raw:\n${code}`).to.equal(false);
        }
      });
    }
  });
}
