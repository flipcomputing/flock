import * as Blockly from 'blockly';
import { meshMap, meshBlockIdMap } from './mesh-state.js';
import { getVariableInfo, maybeParentToGroup, withGroupParent } from './generators-utilities.js';

export function registerFunctionsGenerators(javascriptGenerator) {
  // -------------------------------
  // FUNCTIONS
  // -------------------------------

  // Function definition, no return --------------------------------
  javascriptGenerator.forBlock['procedures_defnoreturn'] = function (block) {
    const functionName = javascriptGenerator.nameDB_.getName(
      block.getFieldValue('NAME'),
      Blockly.PROCEDURE_CATEGORY_NAME
    );
    const args = block.argData_.map((elem) =>
      javascriptGenerator.nameDB_.getName(elem.model.name, Blockly.Names.NameType.VARIABLE)
    );
    const params = args.join(', ');

    const branch =
      javascriptGenerator.statementToCode(block, 'STACK', javascriptGenerator.ORDER_NONE) || '';

    const code = `async function ${functionName}(${params}) {\n${branch}\n}`;
    return code;
  };

  // Function definition with return -------------------------------
  javascriptGenerator.forBlock['procedures_defreturn'] = function (block) {
    const functionName = javascriptGenerator.nameDB_.getName(
      block.getFieldValue('NAME'),
      Blockly.PROCEDURE_CATEGORY_NAME
    );
    const args = block.argData_.map((elem) =>
      javascriptGenerator.nameDB_.getName(elem.model.name, Blockly.Names.NameType.VARIABLE)
    );
    const params = args.join(', ');
    const branch =
      javascriptGenerator.statementToCode(block, 'STACK', javascriptGenerator.ORDER_NONE) || '';
    const returnValue =
      javascriptGenerator.valueToCode(block, 'RETURN', javascriptGenerator.ORDER_NONE) || '';

    const code = `async function ${functionName}(${params}) {\n${branch}return ${returnValue};\n}`;
    return code;
  };

  // If condition, return ------------------------------------------
  javascriptGenerator.forBlock['procedures_callreturn'] = function (block) {
    const functionName = javascriptGenerator.nameDB_.getName(
      block.getFieldValue('NAME'),
      Blockly.PROCEDURE_CATEGORY_NAME
    );
    const args = [];
    const variables = block.arguments_ || [];
    for (let i = 0; i < variables.length; i++) {
      args[i] =
        javascriptGenerator.valueToCode(block, 'ARG' + i, javascriptGenerator.ORDER_NONE) || 'null';
    }

    const code = `await ${functionName}(${args.join(', ')})`;
    return [code, javascriptGenerator.ORDER_ATOMIC];
  };

  // Call function -------------------------------------------------
  javascriptGenerator.forBlock['procedures_callnoreturn'] = function (block) {
    const functionName = javascriptGenerator.nameDB_.getName(
      block.getFieldValue('NAME'),
      Blockly.PROCEDURE_CATEGORY_NAME
    );
    const args = [];
    const variables = block.arguments_;
    for (let i = 0; i < variables.length; i++) {
      args[i] =
        javascriptGenerator.valueToCode(block, 'ARG' + i, javascriptGenerator.ORDER_NONE) || 'null';
    }
    const code = `await ${functionName}(${args.join(', ')});\n`;
    return code;
  };

  // Prefab definition ---------------------------------------------
  javascriptGenerator.forBlock['procedures_defprefab'] = function (block) {
    const functionName = javascriptGenerator.nameDB_.getName(
      block.getFieldValue('NAME'),
      Blockly.PROCEDURE_CATEGORY_NAME
    );
    const args = block.argData_.map((elem) =>
      javascriptGenerator.nameDB_.getName(elem.model.name, Blockly.Names.NameType.VARIABLE)
    );
    const group = javascriptGenerator.nameDB_.getDistinctName(
      'prefab',
      Blockly.Names.NameType.VARIABLE
    );
    const branch = withGroupParent(
      group,
      () =>
        javascriptGenerator.statementToCode(block, 'STACK', javascriptGenerator.ORDER_NONE) || ''
    );

    return `async function ${functionName}(${[...args, group].join(', ')}) {\n${branch}\n}`;
  };

  // Add prefab ----------------------------------------------------
  javascriptGenerator.forBlock['procedures_callprefab'] = function (block) {
    const functionName = javascriptGenerator.nameDB_.getName(
      block.getFieldValue('NAME'),
      Blockly.PROCEDURE_CATEGORY_NAME
    );
    const { generatedName: variableName, userVariableName } = getVariableInfo(block, 'ID_VAR');
    meshMap[block.id] = block;
    meshBlockIdMap[block.id] = block.id;

    const group = javascriptGenerator.nameDB_.getDistinctName(
      'prefab',
      Blockly.Names.NameType.VARIABLE
    );
    const values = javascriptGenerator.nameDB_.getDistinctName(
      'args',
      Blockly.Names.NameType.VARIABLE
    );
    const args = (block.arguments_ || []).map(
      (_, i) =>
        javascriptGenerator.valueToCode(block, 'ARG' + i, javascriptGenerator.ORDER_NONE) || 'null'
    );
    const value = (name) =>
      javascriptGenerator.valueToCode(block, name, javascriptGenerator.ORDER_NONE) || '0';

    return `${variableName} = await addPrefab(${JSON.stringify(`${userVariableName}__${block.id}`)}, {
  x: ${value('X')},
  y: ${value('Y')},
  z: ${value('Z')},
  rotationY: ${value('ROTATE_Y')},
  args: [${args.join(', ')}],
  build: async function (${group}, ${values}) {
    await ${functionName}(...${values}, ${group});
  },
});\n${maybeParentToGroup(variableName)}`;
  };
}
