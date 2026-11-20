import * as Blockly from 'blockly';
import { budgetYield } from './generators-control.js';
import { getVariableInfo } from './generators-utilities.js';
import { localVariableIds } from '../blocks/variableScope.js';

export function registerTablesGenerators(javascriptGenerator) {
  const value = (block, name, fallback) =>
    javascriptGenerator.valueToCode(block, name, javascriptGenerator.ORDER_NONE) || fallback;
  const tableVar = (block, field = 'TABLE') =>
    javascriptGenerator.getVariableName(block.getFieldValue(field));
  const call = (code) => [code, javascriptGenerator.ORDER_FUNCTION_CALL];

  javascriptGenerator.forBlock['table_create'] = function (block) {
    const { generatedName, userVariableName } = getVariableInfo(block, 'VAR');
    const columns = value(block, 'COLUMNS', '[]');
    return `${generatedName} = createTable(${JSON.stringify(userVariableName)}, ${columns});\n`;
  };

  javascriptGenerator.forBlock['table_add_row'] = function (block) {
    return `addTableRow(${tableVar(block)}, ${value(block, 'VALUES', '[]')});\n`;
  };

  javascriptGenerator.forBlock['table_get_value'] = function (block) {
    const row = value(block, 'ROW', '0');
    const column = value(block, 'COLUMN', '""');
    return call(`getTableValue(${tableVar(block)}, ${row}, ${column})`);
  };

  javascriptGenerator.forBlock['table_set_value'] = function (block) {
    const row = value(block, 'ROW', '0');
    const column = value(block, 'COLUMN', '""');
    const newValue = value(block, 'VALUE', '""');
    return `setTableValue(${tableVar(block)}, ${row}, ${column}, ${newValue});\n`;
  };

  javascriptGenerator.forBlock['table_get_column'] = function (block) {
    return call(`getTableColumn(${tableVar(block)}, ${value(block, 'COLUMN', '""')})`);
  };

  javascriptGenerator.forBlock['table_get_row'] = function (block) {
    return call(`getTableRow(${tableVar(block)}, ${value(block, 'ROW', '0')})`);
  };

  javascriptGenerator.forBlock['table_row_count'] = function (block) {
    return call(`getTableRowCount(${tableVar(block)})`);
  };

  javascriptGenerator.forBlock['table_for_each_row'] = function (block, generator) {
    const rowId = block.getFieldValue('VAR');
    const indexId = block.getFieldValue('INDEX');
    const row = generator.getVariableName(rowId);
    const index = generator.getVariableName(indexId);
    const table = tableVar(block);
    const local = localVariableIds(block.workspace);
    const declare = (id) => (local.has(id) ? 'let ' : '');
    const counter = generator.nameDB_.getDistinctName(
      `${row}_index`,
      Blockly.Names.NameType.VARIABLE
    );
    const indexAssignment =
      indexId && indexId !== rowId
        ? `${generator.INDENT}${declare(indexId)}${index} = ${counter};\n`
        : '';
    const branch = generator.statementToCode(block, 'DO');
    const y = budgetYield(generator, `${row}_each`);
    return (
      y.decl +
      `for (let ${counter} = 0; ${counter} < getTableRowCount(${table}); ${counter}++) {\n` +
      `${generator.INDENT}${declare(rowId)}${row} = getTableRow(${table}, ${counter});\n` +
      indexAssignment +
      y.tick +
      branch +
      '}\n'
    );
  };

  javascriptGenerator.forBlock['table_row_value'] = function (block) {
    const column = value(block, 'COLUMN', '""');
    return call(`getRowValue(${value(block, 'ROW', '""')}, ${column})`);
  };
}
