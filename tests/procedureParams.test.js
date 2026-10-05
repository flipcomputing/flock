import { expect } from 'chai';
import * as Blockly from 'blockly';
import { javascriptGenerator } from 'blockly/javascript';
import { defineGenerators } from '../generators/generators.js';
import '../blocks/blocks.js';
import { defineShapeBlocks } from '../blocks/shapes.js';
import { getParamDefaultShadowState } from '../blocks/procedureParams.js';
import { localVariableIds, unavailableVariableUses } from '../blocks/variableScope.js';

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

    before(function () {
      if (!Blockly.Blocks['create_box']) defineShapeBlocks();
      if (!javascriptGenerator.forBlock['procedures_defnoreturn']) defineGenerators();
    });

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

    describe('variable dropdown scope', function () {
      const getter = (variable) => ({
        type: 'variables_get',
        fields: { VAR: { id: variable.getId() } },
      });
      const optionNames = (block) =>
        block
          .getField('VAR')
          .getOptions(false)
          .map(([name]) => name);
      const setter = (variable) => ({
        type: 'variables_set',
        fields: { VAR: { id: variable.getId() } },
      });

      it('lists a parameter only inside its function', function () {
        const score = workspace.getVariableMap().createVariable('score');
        const definition = appendDefinition(workspace, ['size'], {
          STACK: {
            block: {
              type: 'variables_set',
              fields: { VAR: { id: score.getId() } },
              inputs: { VALUE: { block: getter(score) } },
            },
          },
        });
        const inside = definition.getInput('STACK').connection.targetBlock();
        const outside = Blockly.serialization.blocks.append(getter(score), workspace);

        expect(optionNames(inside)).to.include.members(['score', 'size']);
        expect(optionNames(outside)).to.include('score');
        expect(optionNames(outside)).to.not.include('size');
      });

      it('lists a parameter outside its function when it is also set as a global', function () {
        appendDefinition(workspace, ['size']);
        const size = workspace.getVariableMap().getVariable('size');
        const score = workspace.getVariableMap().createVariable('score');
        Blockly.serialization.blocks.append(setter(size), workspace);
        const outside = Blockly.serialization.blocks.append(getter(score), workspace);

        expect(optionNames(outside)).to.include.members(['score', 'size']);
      });

      it('treats a parameter as parameter-only until it is set outside its function', function () {
        appendDefinition(workspace, ['size']);
        const size = workspace.getVariableMap().getVariable('size');
        expect([...localVariableIds(workspace)]).to.deep.equal([size.getId()]);

        const read = Blockly.serialization.blocks.append(getter(size), workspace);
        expect([...localVariableIds(workspace)]).to.deep.equal([size.getId()]);
        expect(unavailableVariableUses(workspace).get(read)).to.deep.equal([size.getId()]);

        Blockly.serialization.blocks.append(setter(size), workspace);
        expect(localVariableIds(workspace).size).to.equal(0);
        expect(unavailableVariableUses(workspace).size).to.equal(0);
      });

      it('scopes name-based variable menus and keeps a loaded parameter selection', function () {
        workspace.getVariableMap().createVariable('score');
        const definition = appendDefinition(workspace, ['size'], {
          STACK: { block: { type: 'play_theme', fields: { MESH_NAME: 'size' } } },
        });
        const inside = definition.getInput('STACK').connection.targetBlock();
        const outside = Blockly.serialization.blocks.append({ type: 'play_theme' }, workspace);
        const meshNames = (block) =>
          block
            .getField('MESH_NAME')
            .getOptions(false)
            .map(([, value]) => value);

        expect(inside.getFieldValue('MESH_NAME')).to.equal('size');
        expect(meshNames(inside)).to.include.members(['score', 'size']);
        expect(meshNames(outside)).to.include('score');
        expect(meshNames(outside)).to.not.include('size');
      });

      it('scopes add block variables to their function and declares them inside it', function () {
        const score = workspace.getVariableMap().createVariable('score');
        const definition = appendDefinition(workspace, [], {
          STACK: {
            block: {
              type: 'create_box',
              fields: { ID_VAR: { name: 'crate' } },
              next: { block: { type: 'variables_set', fields: { VAR: { name: 'crate' } } } },
            },
          },
        });
        const crate = workspace.getVariableMap().getVariable('crate');
        const inside = definition.getInput('STACK').connection.targetBlock().getNextBlock();
        const outside = Blockly.serialization.blocks.append(getter(score), workspace);

        expect([...localVariableIds(workspace)]).to.deep.equal([crate.getId()]);
        expect(optionNames(inside)).to.include('crate');
        expect(optionNames(outside)).to.not.include('crate');

        javascriptGenerator.init(workspace);
        expect(javascriptGenerator.blockToCode(definition)).to.match(
          /^async function build\(\) \{\n {2}let crate = "crate";\n/
        );

        Blockly.serialization.blocks.append(getter(crate), workspace);
        expect(localVariableIds(workspace).size).to.equal(0);
        javascriptGenerator.init(workspace);
        expect(javascriptGenerator.blockToCode(definition)).to.not.include('let crate');
      });

      it('scopes a local block variable to its function without declaring it twice', function () {
        const score = workspace.getVariableMap().createVariable('score');
        const definition = appendDefinition(workspace, [], {
          STACK: {
            block: {
              type: 'local_variable',
              fields: { VAR: { name: 'count' } },
              inputs: { VALUE: { shadow: { type: 'math_number', fields: { NUM: 0 } } } },
              next: { block: { type: 'variables_set', fields: { VAR: { name: 'count' } } } },
            },
          },
        });
        const count = workspace.getVariableMap().getVariable('count');
        const inside = definition.getInput('STACK').connection.targetBlock().getNextBlock();
        const outside = Blockly.serialization.blocks.append(getter(score), workspace);

        expect([...localVariableIds(workspace)]).to.deep.equal([count.getId()]);
        expect(optionNames(inside)).to.include('count');
        expect(optionNames(outside)).to.not.include('count');

        javascriptGenerator.init(workspace);
        const code = javascriptGenerator.blockToCode(definition);
        expect(code.match(/\blet count\b/g)).to.have.length(1);
        expect(code).to.include('let count = 0;');
      });

      it('scopes a local block variable to the blocks below it in its container', function () {
        const score = workspace.getVariableMap().createVariable('score');
        const setter = (name, next) => ({
          type: 'variables_set',
          fields: { VAR: { name } },
          ...(next && { next: { block: next } }),
        });
        const start = Blockly.serialization.blocks.append(
          {
            type: 'start',
            inputs: {
              DO: {
                block: setter('score', {
                  type: 'local_variable',
                  fields: { VAR: { name: 'count' } },
                  next: {
                    block: {
                      type: 'controls_repeat_ext',
                      inputs: { DO: { block: setter('count') } },
                    },
                  },
                }),
              },
            },
          },
          workspace
        );
        const before = start.getInputTargetBlock('DO');
        const nested = before.getNextBlock().getNextBlock().getInputTargetBlock('DO');
        const outside = Blockly.serialization.blocks.append(getter(score), workspace);
        const count = workspace.getVariableMap().getVariable('count');

        expect(optionNames(nested)).to.include('count');
        expect(optionNames(before)).to.not.include('count');
        expect(optionNames(outside)).to.not.include('count');

        const read = Blockly.serialization.blocks.append(getter(count), workspace);
        expect(optionNames(outside)).to.not.include('count');
        expect(unavailableVariableUses(workspace).get(read)).to.deep.equal([count.getId()]);
        javascriptGenerator.init(workspace);
        expect(javascriptGenerator.definitions_['variables'] ?? '').to.not.match(/\blet count\b/);

        Blockly.serialization.blocks.append(setter('count'), workspace);
        expect(optionNames(outside)).to.include('count');
        expect(unavailableVariableUses(workspace).size).to.equal(0);
      });

      it('scopes a loop variable to the loop body', function () {
        const score = workspace.getVariableMap().createVariable('score');
        const loop = Blockly.serialization.blocks.append(
          {
            type: 'controls_for',
            fields: { VAR: { name: 'i' } },
            inputs: {
              DO: { block: { type: 'variables_set', fields: { VAR: { name: 'i' } } } },
            },
            next: {
              block: { type: 'variables_set', fields: { VAR: { id: score.getId() } } },
            },
          },
          workspace
        );
        const body = loop.getInputTargetBlock('DO');
        const after = loop.getNextBlock();
        const outside = Blockly.serialization.blocks.append(getter(score), workspace);

        expect(optionNames(body)).to.include('i');
        expect(optionNames(after)).to.not.include('i');
        expect(optionNames(outside)).to.not.include('i');
      });

      it('scopes a for each item to the loop body and declares it there', function () {
        const score = workspace.getVariableMap().createVariable('score');
        const loop = Blockly.serialization.blocks.append(
          {
            type: 'controls_forEach',
            fields: { VAR: { name: 'item' } },
            inputs: {
              DO: { block: { type: 'variables_set', fields: { VAR: { name: 'item' } } } },
            },
          },
          workspace
        );
        const body = loop.getInputTargetBlock('DO');
        const outside = Blockly.serialization.blocks.append(getter(score), workspace);

        expect(optionNames(body)).to.include('item');
        expect(optionNames(outside)).to.not.include('item');
        javascriptGenerator.init(workspace);
        expect(javascriptGenerator.blockToCode(loop)).to.match(/\blet item = /);

        Blockly.serialization.blocks.append(
          setter(workspace.getVariableMap().getVariable('item')),
          workspace
        );
        javascriptGenerator.init(workspace);
        expect(javascriptGenerator.blockToCode(loop)).to.not.match(/\blet item\b/);
      });

      it('keeps a global visible when a local block shadows it', function () {
        const score = workspace.getVariableMap().createVariable('score');
        const definition = appendDefinition(workspace, [], {
          STACK: {
            block: {
              type: 'local_variable',
              fields: { VAR: { id: score.getId() } },
              next: { block: setter(score) },
            },
          },
        });
        Blockly.serialization.blocks.append(setter(score), workspace);
        const outside = Blockly.serialization.blocks.append(getter(score), workspace);

        expect(optionNames(outside)).to.include('score');
        expect(localVariableIds(workspace).has(score.getId())).to.equal(false);
        expect(unavailableVariableUses(workspace).size).to.equal(0);

        javascriptGenerator.init(workspace);
        expect(javascriptGenerator.definitions_['variables']).to.match(/\blet score\b/);
        expect(javascriptGenerator.blockToCode(definition)).to.match(/\blet score\b/);
      });
    });
  });
}
