import * as Blockly from 'blockly';
import { budgetYield } from './generators-control.js';
import { getVariableInfo } from './generators-utilities.js';
import { localVariableIds } from '../blocks/variableScope.js';
import { startRows } from '../blocks/tableData.js';

export function registerTablesGenerators(javascriptGenerator) {
  const value = (block, name, fallback) =>
    javascriptGenerator.valueToCode(block, name, javascriptGenerator.ORDER_NONE) || fallback;
  const tableVar = (block, field = 'TABLE') =>
    javascriptGenerator.getVariableName(block.getFieldValue(field));
  const call = (code) => [code, javascriptGenerator.ORDER_FUNCTION_CALL];

  javascriptGenerator.forBlock['table_create'] = function (block) {
    const { generatedName, userVariableName } = getVariableInfo(block, 'VAR');
    const columns = value(block, 'COLUMNS', '[]');
    const rows = startRows(block);
    const data = rows.length ? `, ${JSON.stringify(rows)}` : '';
    return `${generatedName} = createTable(${JSON.stringify(userVariableName)}, ${columns}${data});\n`;
  };

  javascriptGenerator.forBlock['table_add_row'] = function (block) {
    const values = value(block, 'VALUES', '[]');
    if (block.getFieldValue('POSITION') === 'ROW') {
      return `insertTableRow(${tableVar(block)}, ${value(block, 'ROW', '0')}, ${values});\n`;
    }
    return `addTableRow(${tableVar(block)}, ${values});\n`;
  };

  javascriptGenerator.forBlock['table_add_column'] = function (block) {
    const name = value(block, 'NAME', '""');
    const values = javascriptGenerator.valueToCode(block, 'VALUES', javascriptGenerator.ORDER_NONE);
    return `addTableColumn(${tableVar(block)}, ${name}${values ? `, ${values}` : ''});\n`;
  };

  javascriptGenerator.forBlock['table_delete_column'] = function (block) {
    return `deleteTableColumn(${tableVar(block)}, ${value(block, 'COLUMN', '""')});\n`;
  };

  javascriptGenerator.forBlock['table_delete_row'] = function (block) {
    if (block.getFieldValue('MODE') === 'ALL') return `deleteAllTableRows(${tableVar(block)});\n`;
    return `deleteTableRow(${tableVar(block)}, ${value(block, 'ROW', '0')});\n`;
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

  javascriptGenerator.forBlock['table_set_row'] = function (block) {
    const row = value(block, 'ROW', '0');
    return `setTableRow(${tableVar(block)}, ${row}, ${value(block, 'VALUES', '[]')});\n`;
  };

  javascriptGenerator.forBlock['table_set_column'] = function (block) {
    const column = value(block, 'COLUMN', '""');
    return `setTableColumn(${tableVar(block)}, ${column}, ${value(block, 'VALUES', '[]')});\n`;
  };

  javascriptGenerator.forBlock['table_get_column'] = function (block) {
    return call(`getTableColumn(${tableVar(block)}, ${value(block, 'COLUMN', '""')})`);
  };

  javascriptGenerator.forBlock['table_column_names'] = function (block) {
    return call(`getTableColumnNames(${tableVar(block)})`);
  };

  javascriptGenerator.forBlock['table_get_row'] = function (block) {
    const picks = { FIRST: 'first', LAST: 'last', RANDOM: 'random' };
    const pick = picks[block.getFieldValue('MODE')];
    if (pick) return call(`pickTableRow(${tableVar(block)}, '${pick}')`);
    return call(`getTableRow(${tableVar(block)}, ${value(block, 'ROW', '0')})`);
  };

  javascriptGenerator.forBlock['table_find_row'] = function (block) {
    const column = value(block, 'COLUMN', '""');
    const which = block.getFieldValue('WHERE') === 'LAST' ? 'last' : 'first';
    const wanted = value(block, 'VALUE', '""');
    return call(`findTableRow(${tableVar(block)}, ${column}, ${wanted}, '${which}')`);
  };

  javascriptGenerator.forBlock['table_sort'] = function (block) {
    const field = block.getFieldValue('ORDER');
    if (field === 'RANDOM') return `shuffleTable(${tableVar(block)});\n`;
    const order = field === 'DESCENDING' ? 'DESCENDING' : 'ASCENDING';
    return `sortTable(${tableVar(block)}, ${value(block, 'COLUMN', '""')}, '${order}');\n`;
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

  javascriptGenerator.forBlock['table_column_menu'] = function (block) {
    const column = javascriptGenerator.quote_(block.getFieldValue('COLUMN'));
    return [column, javascriptGenerator.ORDER_ATOMIC];
  };

  javascriptGenerator.forBlock['table_row_value'] = function (block) {
    const column = value(block, 'COLUMN', '""');
    return call(`getRowValue(${value(block, 'ROW', '""')}, ${column})`);
  };

  javascriptGenerator.forBlock['table_row_values'] = function (block) {
    return call(`getRowValues(${value(block, 'ROW', '""')})`);
  };
}
