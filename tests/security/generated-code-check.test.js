import { expect } from 'chai';
import * as Blockly from 'blockly';
import { javascriptGenerator } from 'blockly/javascript';
import { parse } from 'acorn';
import { toolbox } from '../../toolbox.js';
import { generateWorkspaceCode } from '../../blocks/sectionContainment.js';
import { isProjectLoading, setProjectLoading } from '../../main/projectLoading.js';
import { flockSandbox } from '../../runtime/sandbox.js';

const examples = Object.keys(import.meta.glob('../../examples/*.flock'));

function toolboxBlocks(node, found = []) {
  if (Array.isArray(node)) node.forEach((item) => toolboxBlocks(item, found));
  else if (node?.kind === 'block') {
    const { kind: _kind, ...state } = node;
    found.push(state);
  } else if (node?.contents) toolboxBlocks(node.contents, found);
  return found;
}

// Longer dropdowns list assets (colours, textures, models), which only reach code as strings.
const MAX_OPTIONS = 20;

// Generators branch on combinations such as MODE and WHERE, so every pair of options on one
// block is tried, with its other dropdowns left at their defaults.
function dropdownVariants(workspace) {
  const variants = [];
  workspace.getAllBlocks(true).forEach((block, index) => {
    const fields = [];
    for (const input of block.inputList) {
      for (const field of input.fieldRow) {
        if (!(field instanceof Blockly.FieldDropdown)) continue;
        const values = field
          .getOptions(false)
          .map(([, value]) => value)
          .filter((value) => typeof value === 'string');
        if (values.length <= MAX_OPTIONS) fields.push({ name: field.name, values });
      }
    }
    if (fields.length === 1) {
      for (const value of fields[0].values) variants.push([{ index, name: fields[0].name, value }]);
    }
    fields.forEach((first, i) => {
      for (const second of fields.slice(i + 1)) {
        for (const a of first.values) {
          for (const b of second.values) {
            variants.push([
              { index, name: first.name, value: a },
              { index, name: second.name, value: b },
            ]);
          }
        }
      }
    });
  });
  return variants;
}

export function runGeneratedCodeCheckTests() {
  describe('Generated code check @security', function () {
    this.timeout(600000);
    let workspace;
    let savedLoading;
    let failures;
    let checked;

    beforeEach(function () {
      savedLoading = isProjectLoading();
      setProjectLoading(true);
      workspace = new Blockly.Workspace();
      failures = [];
      checked = 0;
    });

    afterEach(function () {
      workspace.dispose();
      setProjectLoading(savedLoading);
    });

    const load = (state) => {
      workspace.clear();
      Blockly.serialization.workspaces.load(state, workspace);
    };

    // Code that fails to generate or parse never runs, so only the check is tested here.
    const check = (label) => {
      let code;
      try {
        code = generateWorkspaceCode(workspace, javascriptGenerator);
        parse(code, { ecmaVersion: 'latest', allowAwaitOutsideFunction: true });
      } catch {
        return;
      }
      checked++;
      try {
        flockSandbox.prepareUserCode(code);
      } catch (error) {
        failures.push(`${label}: ${error.message}`);
      }
    };

    it('should accept every toolbox block with every pair of dropdown options @slow', function () {
      for (const block of toolboxBlocks(toolbox.contents)) {
        const state = { blocks: { languageVersion: 0, blocks: [block] } };
        try {
          load(state);
        } catch {
          continue; // a few flyout entries only load in a rendered workspace
        }
        check(block.type);
        for (const settings of dropdownVariants(workspace)) {
          load(state);
          const blocks = workspace.getAllBlocks(true);
          for (const { index, name, value } of settings) blocks[index].setFieldValue(value, name);
          check(`${block.type} ${settings.map(({ name, value }) => `${name}=${value}`).join(' ')}`);
        }
      }
      expect(failures).to.deep.equal([]);
      expect(checked).to.be.above(0);
    });

    for (const [op, expected] of [
      ['MIN', 3],
      ['MAX', 7],
    ]) {
      it(`should find the ${op} of a list without .apply`, function () {
        const number = (NUM) => ({ block: { type: 'math_number', fields: { NUM } } });
        const block = Blockly.serialization.blocks.append(
          {
            type: 'math_on_list',
            fields: { OP: op },
            inputs: {
              LIST: {
                block: {
                  type: 'lists_create_with',
                  extraState: { itemCount: 3 },
                  inputs: { ADD0: number(5), ADD1: number(3), ADD2: number(7) },
                },
              },
            },
          },
          workspace
        );
        javascriptGenerator.init(workspace);
        const [code] = javascriptGenerator.blockToCode(block);
        expect(code).to.not.include('apply');
        expect(new Function(`return ${code};`)()).to.equal(expected);
      });
    }

    const listItems = {
      block: {
        type: 'variables_get',
        fields: { VAR: { name: 'items' } },
      },
    };
    const listEnds = [
      ['lists_getIndex', { MODE: 'GET_REMOVE', WHERE: 'FIRST' }, { VALUE: listItems }],
      ['lists_getIndex', { MODE: 'GET_REMOVE', WHERE: 'LAST' }, { VALUE: listItems }],
      ['lists_getIndex', { MODE: 'REMOVE', WHERE: 'FIRST' }, { VALUE: listItems }],
      ['lists_getIndex', { MODE: 'REMOVE', WHERE: 'LAST' }, { VALUE: listItems }],
      [
        'lists_setIndex',
        { MODE: 'INSERT', WHERE: 'FIRST' },
        { LIST: listItems, TO: { block: { type: 'math_number', fields: { NUM: 5 } } } },
      ],
    ];

    for (const [type, fields, inputs] of listEnds) {
      it(`should accept ${type} with ${fields.MODE} ${fields.WHERE}`, function () {
        const block = Blockly.serialization.blocks.append({ type, inputs }, workspace);
        for (const [name, value] of Object.entries(fields)) block.setFieldValue(value, name);
        const code = generateWorkspaceCode(workspace, javascriptGenerator);
        expect(code).to.match(/\.(pop|shift|unshift)\(/);
        expect(() => flockSandbox.prepareUserCode(code)).to.not.throw();
      });
    }

    it('should accept every example project', async function () {
      for (const path of examples) {
        load(await (await fetch(new URL(path, import.meta.url))).json());
        check(path);
      }
      expect(failures).to.deep.equal([]);
      expect(checked).to.equal(examples.length);
    });
  });
}
