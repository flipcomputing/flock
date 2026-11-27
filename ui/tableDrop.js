import * as Blockly from 'blockly';
import { translate } from '../main/translation.js';
import { nextFreeVariableName } from '../main/blocklyinit.js';
import { CsvImportError } from '../main/tableCsv.js';
import { tableFlyoutBlocks } from '../toolbox.js';
import { highlightBlockById } from './blocklyutil.js';
import { openTableImport, parseCsvFile } from './tableEditor.js';

const MAX_NAME_LENGTH = 30;

export function tableNameFromFile(fileName) {
  const base = fileName.normalize('NFC').replace(/\.[^.]*$/, '');
  const name = (base.match(/[\p{L}\p{M}\p{N}]+/gu) ?? []).join(' ');
  return Array.from(name).slice(0, MAX_NAME_LENGTH).join('').trim();
}

export function freeTableName(workspace, fileName) {
  const wanted = tableNameFromFile(fileName);
  if (!wanted) return nextFreeVariableName(workspace, 'table');
  const taken = new Set(
    workspace
      .getVariableMap()
      .getAllVariables()
      .map((variable) => variable.name.toLowerCase())
  );
  let name = wanted;
  for (let suffix = 2; taken.has(name.toLowerCase()); suffix++) name = `${wanted} ${suffix}`;
  return name;
}

function tableStack(name) {
  const table = { ...tableFlyoutBlocks(name, name)[0] };
  delete table.kind;
  delete table.keyword;
  return { type: 'start', inputs: { DO: { block: table } } };
}

function removeStack(workspace, start, group, redo, restoreFocus) {
  const variable = start.getInputTargetBlock('DO')?.getField('VAR')?.getVariable();
  Blockly.Events.disable();
  try {
    if (!start.isDeadOrDying()) start.dispose(false);
    if (variable && workspace.getVariableMap().getVariableById(variable.getId())) {
      workspace.getVariableMap().deleteVariable(variable);
    }
  } finally {
    Blockly.Events.enable();
  }
  const undo = workspace.getUndoStack();
  for (let i = undo.length - 1; i >= 0; i--) {
    if (undo[i].group === group) undo.splice(i, 1);
  }
  workspace.getRedoStack().splice(0, Infinity, ...redo);
  if (restoreFocus && workspace.rendered) Blockly.getFocusManager().focusTree(workspace);
}

export async function importTableFile(file, workspace) {
  let parsed;
  try {
    parsed = await parseCsvFile(file);
  } catch (error) {
    if (!(error instanceof CsvImportError)) console.error('Error reading CSV file:', error);
    alert(translate(error.key ?? 'table_csv_read_failed'));
    return null;
  }

  const redo = [...workspace.getRedoStack()];
  const group = Blockly.utils.idGenerator.genUid();
  const outer = Blockly.Events.getGroup();
  Blockly.Events.setGroup(group);
  let start;
  try {
    start = Blockly.serialization.blocks.append(
      tableStack(freeTableName(workspace, file.name)),
      workspace,
      { recordUndo: true }
    );
  } finally {
    Blockly.Events.setGroup(outer || false);
  }

  const table = start.getInputTargetBlock('DO');
  if (workspace.rendered) highlightBlockById(workspace, table);
  openTableImport(table, file.name, parsed, {
    group,
    onCancel: ({ restoreFocus }) => removeStack(workspace, start, group, redo, restoreFocus),
  });
  return table;
}
