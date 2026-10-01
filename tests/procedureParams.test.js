import { expect } from 'chai';
import * as Blockly from 'blockly';
import '../generators/generators.js';
import '../blocks/blocks.js';
import { getParamDefaultShadowState } from '../blocks/procedureParams.js';

function appendDefinition(workspace, params, inputs = {}) {
  return Blockly.serialization.blocks.append(
    {
      type: 'procedures_defnoreturn',
      fields: { NAME: 'build' },
      extraState: { params: params.map((name) => ({ name, argId: name })) },
      inputs,
    },
    workspace
  );
}

function appendCaller(workspace, params, inputs) {
  return Blockly.serialization.blocks.append(
    { type: 'procedures_callnoreturn', extraState: { name: 'build', params }, inputs },
    workspace
  );
}

function argTarget(caller, i) {
  return caller.getInput('ARG' + i).connection.targetBlock();
}

export function runProcedureParamsTests() {
  describe('blocks/procedureParams @procedureParams', function () {
    let workspace;
    let savedLoadingCode;

    beforeEach(function () {
      savedLoadingCode = window.loadingCode;
      window.loadingCode = false;
      workspace = new Blockly.Workspace();
    });

    afterEach(function () {
      workspace.dispose();
      window.loadingCode = savedLoadingCode;
    });

    it('gives a new definition parameter a number shadow of 0', function () {
      const definition = appendDefinition(workspace, ['size']);
      const target = definition.getInput('size').connection.targetBlock();
      expect(target.isShadow()).to.equal(true);
      expect(target.type).to.equal('math_number');
      expect(Number(target.getFieldValue('NUM'))).to.equal(0);
    });

    it('copies a number default to a new caller as a shadow', function () {
      appendDefinition(workspace, ['size'], {
        size: { block: { type: 'math_number', fields: { NUM: 5 } } },
      });
      const caller = appendCaller(workspace, ['size']);
      const target = argTarget(caller, 0);
      expect(target.isShadow()).to.equal(true);
      expect(Number(target.getFieldValue('NUM'))).to.equal(5);
    });

    it('turns a nested default block into a shadow tree', function () {
      appendDefinition(workspace, ['finish'], {
        finish: {
          block: {
            type: 'material',
            fields: { TEXTURE_SET: 'wood.png' },
            inputs: {
              BASE_COLOR: { block: { type: 'colour', fields: { COLOR: '#deb887' } } },
              ALPHA: { shadow: { type: 'math_number', fields: { NUM: 1 } } },
            },
          },
        },
      });
      const caller = appendCaller(workspace, ['finish']);
      const material = argTarget(caller, 0);
      expect(material.type).to.equal('material');
      expect(material.isShadow()).to.equal(true);
      const colour = material.getInput('BASE_COLOR').connection.targetBlock();
      expect(colour.isShadow()).to.equal(true);
      expect(colour.getFieldValue('COLOR')).to.equal('#deb887');
    });

    it('leaves the caller socket empty when the default uses a variable', function () {
      const definition = appendDefinition(workspace, ['size'], {
        size: { block: { type: 'variables_get', fields: { VAR: { name: 'width' } } } },
      });
      expect(getParamDefaultShadowState(definition, 'size')).to.equal(null);
      const caller = appendCaller(workspace, ['size']);
      expect(argTarget(caller, 0)).to.equal(null);
    });

    it('leaves empty sockets empty while a project is loading', function () {
      appendDefinition(workspace, ['size'], {
        size: { block: { type: 'math_number', fields: { NUM: 5 } } },
      });
      window.loadingCode = true;
      const caller = appendCaller(workspace, ['size']);
      expect(argTarget(caller, 0)).to.equal(null);
    });

    it('keeps values saved on the caller over the default', function () {
      appendDefinition(workspace, ['size'], {
        size: { block: { type: 'math_number', fields: { NUM: 5 } } },
      });
      const caller = appendCaller(workspace, ['size'], {
        ARG0: { shadow: { type: 'math_number', fields: { NUM: 9 } } },
      });
      expect(Number(argTarget(caller, 0).getFieldValue('NUM'))).to.equal(9);
    });

    it('fills only the new socket when a parameter is added', function () {
      const definition = appendDefinition(workspace, ['size']);
      window.loadingCode = true;
      const caller = appendCaller(workspace, ['size']);
      window.loadingCode = false;

      definition.plus();

      expect(argTarget(caller, 0)).to.equal(null);
      const added = argTarget(caller, 1);
      expect(added.isShadow()).to.equal(true);
      expect(Number(added.getFieldValue('NUM'))).to.equal(0);
    });

    it('lays out definitions and callers inline', function () {
      const definition = appendDefinition(workspace, ['size']);
      const caller = appendCaller(workspace, ['size']);
      expect(definition.getInputsInline()).to.equal(true);
      expect(caller.getInputsInline()).to.equal(true);
    });

    it('copies a row break on the definition to its callers', function () {
      const definition = appendDefinition(workspace, ['x', 'y', 'z']);
      const caller = appendCaller(workspace, ['x', 'y', 'z']);

      definition.setRowBreak_('x', true);
      Blockly.Procedures.mutateCallers(definition);

      expect(definition.getInput('x_ROW')).to.be.instanceOf(Blockly.inputs.EndRowInput);
      expect(definition.getInput('y_ROW')).to.not.be.instanceOf(Blockly.inputs.EndRowInput);
      const names = caller.inputList.map((input) => input.name);
      expect(names.indexOf('ROW_0')).to.equal(names.indexOf('ARG0') + 1);
      expect(caller.getInput('ROW_0')).to.be.instanceOf(Blockly.inputs.EndRowInput);
      expect(caller.getInput('ROW_1')).to.equal(null);
    });

    it('saves and restores row breaks', function () {
      const definition = appendDefinition(workspace, ['x', 'y']);
      definition.setRowBreak_('x', true);
      const state = Blockly.serialization.blocks.save(definition);
      expect(state.extraState.params[0].rowBreak).to.equal(true);
      expect(state.extraState.params[1].rowBreak).to.equal(undefined);

      definition.dispose();
      const restored = Blockly.serialization.blocks.append(state, workspace);
      expect(restored.argData_[0].rowBreak).to.equal(true);
      expect(restored.getInput('x_ROW')).to.be.instanceOf(Blockly.inputs.EndRowInput);
      const names = restored.inputList.map((input) => input.name);
      expect(names.slice(names.indexOf('x'), names.indexOf('STACK'))).to.deep.equal([
        'x',
        'x_ROW',
        'y',
        'y_ROW',
      ]);
    });

    it('keeps default blocks attached when the definition reloads its state', function () {
      const definition = appendDefinition(workspace, ['x', 'y'], {
        y: { block: { type: 'math_number', fields: { NUM: 5 } } },
      });
      const five = definition.getInput('y').connection.targetBlock();
      const before = definition.saveExtraState();
      definition.plus();
      definition.loadExtraState(before);

      expect(definition.argData_.map((arg) => arg.argId)).to.deep.equal(['x', 'y']);
      expect(definition.getInput('y').connection.targetBlock()).to.equal(five);
    });
  });
}
