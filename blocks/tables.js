import * as Blockly from 'blockly';
import { loops } from 'blockly/blocks';
import '@blockly/field-date';
import './fieldTimes.js';
import { DEFAULT_EMOJI } from './fieldEmoji.js';
import { getHelpUrlFor } from './blocks.js';
import { nextVariableName } from './variableNames.js';
import { translate, getTooltip } from '../main/translation.js';
import { normaliseDate, normaliseMoney, uniqueColumnNames } from '../api/tables.js';
import {
  CURRENCIES,
  columnTypeFor,
  currencyOptions,
  loadStartData,
  renameStartDataColumns,
  saveStartData,
  startColumnSpecs,
  startData,
  startRows,
  typeProblem,
} from './tableData.js';
import { openTableEditor } from '../ui/tableEditor.js';
import { makeTableDataField, TABLE_DATA_FIELD_NAME } from './fieldTableData.js';

export const TABLE_LOOP_TYPE = 'table_for_each_row';
const TABLE_VARIABLE_TYPE = 'Table';
export const TABLE_FIELD = 'field_table_variable';

class FieldTableVariable extends Blockly.FieldVariable {
  static fromJson(options) {
    return super.fromJson({
      ...options,
      variableTypes: [TABLE_VARIABLE_TYPE],
      defaultType: TABLE_VARIABLE_TYPE,
    });
  }

  loadState(state) {
    if (state && typeof state === 'object' && !state.type) {
      const variableMap = this.getSourceBlock()?.workspace.getVariableMap();
      const untyped =
        (state.id && variableMap?.getVariableById(state.id)) ||
        (state.name && variableMap?.getVariable(state.name, ''));
      if (untyped?.getType() === '') variableMap.changeVariableType(untyped, TABLE_VARIABLE_TYPE);
      state = { ...state, type: TABLE_VARIABLE_TYPE };
    }
    super.loadState(state);
  }

  getOptions(useCache) {
    const name = this.getText();
    const labels = {
      [Blockly.FieldVariable.ADD_VARIABLE_ID]: translate('new_table_decision'),
      [Blockly.RENAME_VARIABLE_ID]: translate('rename_table_option').replace('%1', name),
      [Blockly.DELETE_VARIABLE_ID]: translate('delete_table_option').replace('%1', name),
    };
    return super.getOptions(useCache).map(([label, id]) => [labels[id] ?? label, id]);
  }

  onItemSelected_(menu, menuItem) {
    const workspace = this.getSourceBlock().workspace;
    if (menuItem.getValue() !== Blockly.FieldVariable.ADD_VARIABLE_ID) {
      withTableMessages(() => super.onItemSelected_(menu, menuItem));
      return;
    }
    withTableMessages(() =>
      Blockly.Variables.createVariableButtonHandler(
        workspace,
        (name) => {
          const variable =
            name && workspace.getVariableMap().getVariable(name, TABLE_VARIABLE_TYPE);
          if (variable) this.setValue(variable.getId());
        },
        TABLE_VARIABLE_TYPE
      )
    );
  }
}

function withTableMessages(action) {
  const messages = {
    NEW_VARIABLE_TITLE: translate('new_table_title'),
    RENAME_VARIABLE_TITLE: translate('rename_table_title'),
    DELETE_VARIABLE_CONFIRMATION: translate('delete_table_confirmation'),
  };
  const saved = Object.fromEntries(Object.keys(messages).map((key) => [key, Blockly.Msg[key]]));
  Object.assign(Blockly.Msg, messages);
  try {
    action();
  } finally {
    Object.assign(Blockly.Msg, saved);
  }
}

Blockly.fieldRegistry.register(TABLE_FIELD, FieldTableVariable);

export const TABLE_COLUMN_MENU = 'table_column_menu';
const TABLE_ADD_COLUMN = 'table_add_column';
const COLUMN_FIELD = 'field_table_column';

const sameName = (a, b) => a?.toLowerCase() === b?.toLowerCase();

const columnText = (item, renamed) => {
  if (item && item === renamed?.textBlock) return renamed.name;
  return item?.type === 'text' ? item.getFieldValue('TEXT') : '';
};

export function tableStartRows(block, field = 'TABLE') {
  const name = block.getField(field)?.getText();
  const creator = block.workspace
    ?.getBlocksByType('table_create', false)
    .find((each) => each.isEnabled() && sameName(each.getField('VAR')?.getText(), name));
  return creator ? startRows(creator) : [];
}

export function tableColumnInfo(workspace, tableName, renamed = null) {
  const columns = [];
  const named = new Map();
  const specs = new Map();
  const layouts = new Set();
  let found = false;
  let complete = true;
  for (const creator of workspace?.getBlocksByType('table_create', false) ?? []) {
    if (tableName !== undefined && !sameName(creator.getField('VAR')?.getText(), tableName)) {
      continue;
    }
    found = true;
    const list = creator.getInputTargetBlock('COLUMNS');
    if (list?.type !== 'lists_create_with') {
      complete = false;
      continue;
    }
    const items = list.inputList
      .filter((input) => input.connection)
      .map((input) => input.connection.targetBlock());
    const given = items.map((item) => columnText(item, renamed));
    const unique = uniqueColumnNames(given);
    const layout = [];
    given.forEach((name, i) => {
      if (!name) {
        complete = false;
        return;
      }
      named.set(items[i].id, unique[i]);
      const spec = columnTypeFor(creator, unique[i]);
      layout.push(spec);
      if (!columns.includes(unique[i])) {
        columns.push(unique[i]);
        specs.set(unique[i], spec);
      } else if (JSON.stringify(specs.get(unique[i])) !== JSON.stringify(spec)) {
        specs.set(unique[i], { name: unique[i], type: null });
      }
    });
    layouts.add(JSON.stringify(layout));
  }
  for (const adder of workspace?.getBlocksByType(TABLE_ADD_COLUMN, false) ?? []) {
    if (tableName !== undefined && !sameName(adder.getField('TABLE')?.getText(), tableName)) {
      continue;
    }
    const name = addedColumnName(adder, renamed);
    if (!name) {
      complete = false;
      continue;
    }
    const unique = uniqueColumnNames([...columns, name]).at(-1);
    named.set(adder.getInputTargetBlock('NAME').id, unique);
    columns.push(unique);
    specs.set(unique, { name: unique, type: null });
  }
  const positional = found && complete && layouts.size === 1;
  return { columns, complete: found && complete, positional, named, specs };
}

function addedColumnName(adder, renamed = null) {
  return columnText(adder.getInputTargetBlock('NAME'), renamed);
}

export const tableColumns = (workspace, tableName) => tableColumnInfo(workspace, tableName).columns;

function loopTableFor(block, rowVariableId) {
  for (let outer = block.getSurroundParent(); outer; outer = outer.getSurroundParent()) {
    if (outer.type === TABLE_LOOP_TYPE && outer.getFieldValue('VAR') === rowVariableId) {
      return outer.getField('TABLE')?.getText();
    }
  }
  return undefined;
}

function columnTableName(owner) {
  if (!owner) return undefined;
  const tableField = owner.getField('TABLE');
  if (tableField) return tableField.getText();
  const row = owner.getInputTargetBlock('ROW');
  if (row?.type === 'table_get_row') return row.getField('TABLE')?.getText();
  if (row?.type === 'variables_get') return loopTableFor(owner, row.getFieldValue('VAR'));
  return undefined;
}

const defaultColumnName = () => translate('table_default_column_name');

const DATE_BLOCK = 'date_value';
const MONEY_BLOCK = 'money_value';
const TIME_BLOCK = 'time_value';
const DATETIME_BLOCK = 'datetime_value';
const EMOJI_BLOCK = 'emoji_value';

class FieldTableColumn extends Blockly.FieldDropdown {
  constructor(value) {
    super(function () {
      return this.columnOptions();
    });
    this.candidate = null;
    if (value) this.setValue(value);
  }

  static fromJson(options) {
    return new FieldTableColumn(options.value);
  }

  columnOptions() {
    const menu = this.getSourceBlock();
    const workspace = menu?.isInFlyout ? menu.workspace.targetWorkspace : menu?.workspace;
    const columns = menu ? tableColumns(workspace, columnTableName(menu.getParent())) : [];
    for (const extra of [this.candidate, this.getValue()]) {
      if (extra && !columns.includes(extra)) columns.push(extra);
    }
    if (columns.length === 0) columns.push(defaultColumnName());
    return columns.map((name) => [name, name]);
  }

  doClassValidation_(newValue) {
    if (typeof newValue !== 'string' || newValue === '') return null;
    this.candidate = newValue;
    this.getOptions(false);
    this.candidate = null;
    return newValue;
  }
}

Blockly.fieldRegistry.register(COLUMN_FIELD, FieldTableColumn);

const COLUMN_WARNING = 'table-column';
const COLUMN_BLOCKS = [
  'table_get_value',
  'table_set_value',
  'table_set_column',
  'table_delete_column',
  'table_get_column',
  'table_row_value',
  'table_find_row',
  'table_sort',
];

function literalColumnName(owner) {
  const target = owner.getInputTargetBlock('COLUMN');
  if (target?.type === TABLE_COLUMN_MENU) return target.getFieldValue('COLUMN');
  if (target?.type === 'text') return target.getFieldValue('TEXT');
  return null;
}

export function tableColumnWarningFor(owner) {
  if (owner.getInput('COLUMN')?.isVisible() === false) return null;
  const column = literalColumnName(owner);
  const table = columnTableName(owner);
  if (!column || table === undefined) return null;
  const { columns, complete } = tableColumnInfo(owner.workspace, table);
  if (!complete || columns.includes(column)) return null;
  return translate('table_column_missing_warning')
    .replace('%1', table)
    .replace('%2', column)
    .replace('%3', columns.join(', '));
}

export function installTableColumnWarnings(workspace) {
  const shown = new WeakMap();

  function refresh() {
    for (const type of COLUMN_BLOCKS) {
      for (const owner of workspace.getBlocksByType(type, false)) {
        const text = tableColumnWarningFor(owner);
        if ((shown.get(owner) ?? null) === text) continue;
        shown.set(owner, text);
        owner.setWarningText(text, COLUMN_WARNING);
      }
    }
  }

  workspace.addChangeListener(function (event) {
    if (event.isUiEvent && event.type !== Blockly.Events.FINISHED_LOADING) return;
    if (
      event.type === Blockly.Events.BLOCK_MOVE ||
      event.type === Blockly.Events.BLOCK_CREATE ||
      event.type === Blockly.Events.BLOCK_DELETE ||
      event.type === Blockly.Events.BLOCK_CHANGE ||
      event.type === Blockly.Events.VAR_RENAME ||
      event.type === Blockly.Events.FINISHED_LOADING
    ) {
      refresh();
    }
  });

  refresh();
  return refresh;
}

const VALUE_WARNING = 'table-value';
const START_DATA_WARNING = 'table-start-data';
const VALUE_BLOCKS = ['table_set_value', 'table_add_row', 'table_set_row', 'table_set_column'];

function literalValue(block) {
  switch (block?.type) {
    case 'text':
      return { value: block.getFieldValue('TEXT') };
    case 'math_number':
      return { value: Number(block.getFieldValue('NUM')) };
    case DATE_BLOCK:
      return { value: block.getFieldValue('DATE') };
    case TIME_BLOCK:
      return { value: block.getFieldValue('TIME') };
    case DATETIME_BLOCK:
      return { value: block.getFieldValue('DATETIME') };
    case MONEY_BLOCK:
      return { value: Number(block.getFieldValue('AMOUNT')) };
    case EMOJI_BLOCK:
      return { value: block.getFieldValue('EMOJI') };
    case 'colour':
    case 'colour_from_string':
      return { value: block.getFieldValue('COLOR') };
    case 'colour_picker':
      return { value: block.getFieldValue('COLOUR') };
    default:
      return null;
  }
}

function listLiterals(list) {
  if (list?.type !== 'lists_create_with') return [];
  return list.inputList
    .filter((input) => input.name?.startsWith('ADD'))
    .map((input) => literalValue(input.connection?.targetBlock()));
}

export function tableValueWarningFor(owner) {
  const table = owner.getField('TABLE')?.getText();
  if (table === undefined) return null;
  const { columns, specs, positional } = tableColumnInfo(owner.workspace, table);
  const checks = [];
  if (owner.type === 'table_set_value' || owner.type === 'table_set_column') {
    const column = literalColumnName(owner);
    if (!column) return null;
    const literals =
      owner.type === 'table_set_value'
        ? [literalValue(owner.getInputTargetBlock('VALUE'))]
        : listLiterals(owner.getInputTargetBlock('VALUES'));
    for (const literal of literals) checks.push([specs.get(column), literal]);
  } else {
    if (!positional) return null;
    listLiterals(owner.getInputTargetBlock('VALUES')).forEach((literal, i) =>
      checks.push([specs.get(columns[i]), literal])
    );
  }
  for (const [spec, literal] of checks) {
    const problem = literal && typeProblem(table, spec, literal.value);
    if (problem) return problem;
  }
  return null;
}

export function tableStartDataWarningFor(creator) {
  const specs = startColumnSpecs(creator);
  if (!specs) return null;
  const table = creator.getField('VAR')?.getText() ?? '';
  for (const [r, row] of startRows(creator).entries()) {
    for (const [c, spec] of specs.entries()) {
      const problem = typeProblem(table, spec, row[c]);
      if (problem) {
        return translate('table_start_data_warning')
          .replace('%1', String(r))
          .replace('%2', problem);
      }
    }
  }
  return null;
}

export function installTableValueWarnings(workspace) {
  const shown = new WeakMap();
  const show = (block, id, text) => {
    const current = shown.get(block) ?? {};
    if ((current[id] ?? null) === text) return;
    shown.set(block, { ...current, [id]: text });
    block.setWarningText(text, id);
  };

  function refresh() {
    for (const type of VALUE_BLOCKS) {
      for (const owner of workspace.getBlocksByType(type, false)) {
        show(owner, VALUE_WARNING, tableValueWarningFor(owner));
      }
    }
    for (const creator of workspace.getBlocksByType('table_create', false)) {
      show(creator, START_DATA_WARNING, tableStartDataWarningFor(creator));
    }
  }

  workspace.addChangeListener(function (event) {
    if (event.isUiEvent && event.type !== Blockly.Events.FINISHED_LOADING) return;
    refresh();
  });

  refresh();
  return refresh;
}

function addedColumnFor(textBlock) {
  const adder = textBlock?.getParent();
  if (adder?.type !== TABLE_ADD_COLUMN) return null;
  return adder.getInputTargetBlock('NAME') === textBlock ? adder : null;
}

function columnListCreator(textBlock) {
  const list = textBlock?.getParent();
  const creator = list?.getParent();
  if (list?.type !== 'lists_create_with' || creator?.type !== 'table_create') return null;
  return creator.getInputTargetBlock('COLUMNS') === list ? creator : null;
}

function columnListTable(textBlock) {
  const adder = addedColumnFor(textBlock);
  if (adder) return adder.getField('TABLE')?.getText();
  return columnListCreator(textBlock)?.getField('VAR')?.getText();
}

function renameCreatorStartData(creator, before, after) {
  const renames = new Map();
  for (const input of creator.getInputTargetBlock('COLUMNS').inputList) {
    const id = input.connection?.targetBlock()?.id;
    const was = before.get(id);
    const now = after.get(id);
    if (was !== undefined && now !== undefined && was !== now) renames.set(was, now);
  }
  renameStartDataColumns(creator, renames);
}

function renameColumnMenus(workspace, tableName, textBlock, oldName, updateStartData) {
  const before = tableColumnInfo(workspace, tableName, { textBlock, name: oldName }).named;
  const after = tableColumnInfo(workspace, tableName).named;
  if (!after.has(textBlock.id)) return 'waiting';
  const kept = new Set();
  const renames = new Map();
  for (const [id, now] of after) {
    const was = before.get(id);
    if (was === now) kept.add(now);
    else if (was !== undefined) renames.set(was, now);
  }
  for (const was of kept) renames.delete(was);
  const creator = updateStartData && columnListCreator(textBlock);
  if (creator) renameCreatorStartData(creator, before, after);
  setColumnMenus(workspace, tableName, renames);
  return 'renamed';
}

function setColumnMenus(workspace, tableName, renames) {
  if (renames.size === 0) return;
  for (const menu of workspace.getBlocksByType(TABLE_COLUMN_MENU, false)) {
    const renamed = renames.get(menu.getFieldValue('COLUMN'));
    if (renamed === undefined) continue;
    if (!sameName(columnTableName(menu.getParent()), tableName)) continue;
    menu.setFieldValue(renamed, 'COLUMN');
  }
}

export function installTableColumnRenames(workspace) {
  const following = new Map();

  workspace.addChangeListener(function (event) {
    if (event.isUiEvent || event.type !== Blockly.Events.BLOCK_CHANGE) return;
    if (event.element !== 'field') return;
    const textBlock = workspace.getBlockById(event.blockId);
    if (event.name !== 'TEXT') return;
    const tableName = columnListTable(textBlock);
    if (tableName === undefined) return;
    const handled = textBlock.startDataRenamed_ === event.newValue;
    delete textBlock.startDataRenamed_;
    if (!event.recordUndo) {
      following.delete(textBlock.id);
      return;
    }
    const oldName = following.get(textBlock.id) ?? event.oldValue;
    if (!event.group) event.group = Blockly.utils.idGenerator.genUid();
    const previousGroup = Blockly.Events.getGroup();
    Blockly.Events.setGroup(event.group);
    try {
      const result = renameColumnMenus(workspace, tableName, textBlock, oldName, !handled);
      following.set(textBlock.id, result === 'waiting' ? oldName : event.newValue);
    } finally {
      Blockly.Events.setGroup(previousGroup);
    }
  });
}

function rowCountText(count) {
  return count === 1
    ? translate('table_editor_row_count_one')
    : translate('table_editor_row_count').replace('%1', String(count));
}

function setupStartData() {
  const block = this;
  const openEditor = () => {
    if (!block.isInFlyout) openTableEditor(block);
  };
  this.appendDummyInput('DATA')
    .appendField(makeTableDataField(openEditor), TABLE_DATA_FIELD_NAME)
    .appendField(new Blockly.FieldLabel(''), 'ROW_COUNT');
  this.saveExtraState = () => saveStartData(this);
  this.loadExtraState = (state) => {
    loadStartData(this, state);
    this.updateRowCount_();
  };
  this.mutationToDom = () => {
    const state = saveStartData(this);
    if (!state) return null;
    const mutation = Blockly.utils.xml.createElement('mutation');
    mutation.setAttribute('start_data', JSON.stringify(state));
    return mutation;
  };
  this.domToMutation = (xml) => {
    let state;
    try {
      state = JSON.parse(xml.getAttribute('start_data') ?? 'null');
    } catch {
      state = null;
    }
    this.loadExtraState(state);
  };
  this.updateRowCount_ = () => {
    const field = this.getField('ROW_COUNT');
    const count = startData(this).rows.length;
    field?.setValue(count ? rowCountText(count) : '');
    field?.setVisible(count > 0);
    if (this.rendered) this.queueRender();
  };
  this.customContextMenu = (options) => {
    if (this.isInFlyout) return;
    options.push({ text: translate('table_edit_data'), enabled: true, callback: openEditor });
  };
  this.updateRowCount_();
}

const tableField = (name = 'TABLE') => ({ type: TABLE_FIELD, name, variable: 'table1' });

function defineTableBlock(type, json, setup) {
  Blockly.Blocks[type] = {
    init: function () {
      this.jsonInit({
        type,
        message0: translate(type),
        inputsInline: true,
        tooltip: getTooltip(type),
        ...json(this),
      });
      this.setHelpUrl(getHelpUrlFor(type));
      this.setStyle('list_blocks');
      setup?.call(this);
    },
  };
}

export function defineTableBlocks() {
  loops.loopTypes.add(TABLE_LOOP_TYPE);

  defineTableBlock(
    'table_create',
    (block) => ({
      args0: [
        { type: TABLE_FIELD, name: 'VAR', variable: nextVariableName(block, 'table') },
        { type: 'input_value', name: 'COLUMNS', check: 'Array' },
      ],
      previousStatement: null,
      nextStatement: null,
    }),
    setupStartData
  );

  defineTableBlock(TABLE_ADD_COLUMN, () => ({
    args0: [
      { type: 'input_value', name: 'NAME', check: 'String' },
      tableField(),
      { type: 'input_value', name: 'VALUES', check: 'Array' },
    ],
    previousStatement: null,
    nextStatement: null,
  }));

  defineTableBlock('table_delete_column', () => ({
    args0: [{ type: 'input_value', name: 'COLUMN', check: 'String' }, tableField()],
    previousStatement: null,
    nextStatement: null,
  }));

  const showRowFor = (block, hiddenModes, fieldName = 'MODE') => {
    const showRow = (mode) => block.getInput('ROW').setVisible(!hiddenModes.includes(mode));
    const field = block.getField(fieldName);
    field.setValidator((mode) => {
      showRow(mode);
      return mode;
    });
    showRow(field.getValue());
  };

  defineTableBlock(
    'table_add_row',
    () => ({
      args0: [
        tableField(),
        {
          type: 'field_dropdown',
          name: 'POSITION',
          options: [
            [translate('table_add_row_end_option'), 'END'],
            [translate('table_add_row_at_option'), 'ROW'],
          ],
        },
        { type: 'input_dummy', name: 'POSITION_ROW' },
        { type: 'input_value', name: 'ROW', check: 'Number' },
        { type: 'input_value', name: 'VALUES', check: 'Array' },
      ],
      previousStatement: null,
      nextStatement: null,
    }),
    function () {
      showRowFor(this, ['END'], 'POSITION');
    }
  );

  defineTableBlock(
    'table_delete_row',
    () => ({
      args0: [
        {
          type: 'field_dropdown',
          name: 'MODE',
          options: [
            [translate('table_delete_row_option'), 'ROW'],
            [translate('table_delete_all_rows_option'), 'ALL'],
          ],
        },
        { type: 'input_dummy', name: 'MODE_ROW' },
        { type: 'input_value', name: 'ROW', check: 'Number' },
        tableField(),
      ],
      previousStatement: null,
      nextStatement: null,
    }),
    function () {
      showRowFor(this, ['ALL']);
    }
  );

  defineTableBlock('table_get_value', () => ({
    args0: [
      tableField(),
      { type: 'input_value', name: 'ROW', check: 'Number' },
      { type: 'input_value', name: 'COLUMN', check: 'String' },
    ],
    output: null,
  }));

  defineTableBlock('table_set_value', () => ({
    args0: [
      tableField(),
      { type: 'input_value', name: 'ROW', check: 'Number' },
      { type: 'input_value', name: 'COLUMN', check: 'String' },
      { type: 'input_value', name: 'VALUE' },
    ],
    previousStatement: null,
    nextStatement: null,
  }));

  defineTableBlock('table_set_row', () => ({
    args0: [
      tableField(),
      { type: 'input_value', name: 'ROW', check: 'Number' },
      { type: 'input_value', name: 'VALUES', check: 'Array' },
    ],
    previousStatement: null,
    nextStatement: null,
  }));

  defineTableBlock('table_set_column', () => ({
    args0: [
      tableField(),
      { type: 'input_value', name: 'COLUMN', check: 'String' },
      { type: 'input_value', name: 'VALUES', check: 'Array' },
    ],
    previousStatement: null,
    nextStatement: null,
  }));

  defineTableBlock('table_get_column', () => ({
    args0: [{ type: 'input_value', name: 'COLUMN', check: 'String' }, tableField()],
    output: 'Array',
  }));

  defineTableBlock('table_column_names', () => ({
    args0: [tableField()],
    output: 'Array',
  }));

  defineTableBlock(
    'table_get_row',
    () => ({
      args0: [
        {
          type: 'field_dropdown',
          name: 'MODE',
          options: [
            [translate('table_get_row_option'), 'ROW'],
            [translate('table_get_first_row_option'), 'FIRST'],
            [translate('table_get_last_row_option'), 'LAST'],
            [translate('table_get_random_row_option'), 'RANDOM'],
          ],
        },
        { type: 'input_dummy', name: 'MODE_ROW' },
        { type: 'input_value', name: 'ROW', check: 'Number' },
        tableField(),
      ],
      output: null,
    }),
    function () {
      showRowFor(this, ['FIRST', 'LAST', 'RANDOM']);
    }
  );

  defineTableBlock('table_find_row', () => ({
    args0: [
      {
        type: 'field_dropdown',
        name: 'WHERE',
        options: [
          [translate('table_find_first_option'), 'FIRST'],
          [translate('table_find_last_option'), 'LAST'],
        ],
      },
      tableField(),
      { type: 'input_value', name: 'COLUMN', check: 'String' },
      { type: 'input_value', name: 'VALUE' },
    ],
    output: 'Number',
  }));

  defineTableBlock(
    'table_sort',
    () => ({
      args0: [
        tableField(),
        { type: 'input_dummy', name: 'TABLE_ROW' },
        { type: 'input_value', name: 'COLUMN', check: 'String' },
        {
          type: 'field_dropdown',
          name: 'ORDER',
          options: [
            [translate('table_sort_ascending_option'), 'ASCENDING'],
            [translate('table_sort_descending_option'), 'DESCENDING'],
            [translate('table_sort_random_option'), 'RANDOM'],
          ],
        },
      ],
      previousStatement: null,
      nextStatement: null,
    }),
    function () {
      this.getField('ORDER').setValidator((order) => {
        this.getInput('COLUMN').setVisible(order !== 'RANDOM');
        return order;
      });
    }
  );

  defineTableBlock('table_row_count', () => ({
    args0: [tableField()],
    output: 'Number',
  }));

  defineTableBlock('table_get', () => ({
    args0: [tableField()],
    output: 'Table',
  }));

  defineTableBlock(
    TABLE_LOOP_TYPE,
    () => ({
      message1: '%1',
      args0: [
        { type: 'field_variable', name: 'VAR', variable: 'row' },
        { type: 'field_variable', name: 'INDEX', variable: 'count' },
        tableField(),
      ],
      args1: [{ type: 'input_statement', name: 'DO' }],
      inputsInline: false,
      previousStatement: null,
      nextStatement: null,
    }),
    function () {
      this.getField('VAR').defaultVariableName = 'row';
      this.getField('INDEX').defaultVariableName = 'count';
      this.setOnChange(function () {
        if (this.isInFlyout) return;
        const same = this.getFieldValue('VAR') === this.getFieldValue('INDEX');
        this.setWarningText(
          same ? translate('table_loop_same_variable') : null,
          'table_loop_same_variable'
        );
      });
    }
  );

  defineTableBlock(
    DATE_BLOCK,
    () => ({
      args0: [{ type: 'field_date', name: 'DATE', date: '2026-01-01' }],
      output: 'String',
    }),
    function () {
      this.setStyle('variable_blocks');
      const field = this.getField('DATE');
      field.setValidator((value) => normaliseDate(value));
    }
  );

  for (const [type, field, fieldType, value] of [
    [TIME_BLOCK, 'TIME', 'field_time', '12:00'],
    [DATETIME_BLOCK, 'DATETIME', 'field_datetime', '2026-01-01 12:00'],
  ]) {
    defineTableBlock(
      type,
      () => ({ args0: [{ type: fieldType, name: field, value }], output: 'String' }),
      function () {
        this.setStyle('variable_blocks');
      }
    );
  }

  defineTableBlock(
    MONEY_BLOCK,
    () => ({
      args0: [
        { type: 'field_dropdown', name: 'CURRENCY', options: currencyOptions() },
        { type: 'field_input', name: 'AMOUNT', text: '0' },
      ],
      output: 'Number',
    }),
    function () {
      this.setStyle('variable_blocks');
      const currency = translate('table_default_currency');
      if (CURRENCIES.includes(currency)) this.getField('CURRENCY').setValue(currency);
      this.getField('CURRENCY').setValidator((code) => {
        const amount = normaliseMoney(this.getFieldValue('AMOUNT'), code);
        if (amount !== null && String(amount) !== this.getFieldValue('AMOUNT')) {
          this.setFieldValue(String(amount), 'AMOUNT');
        }
        return code;
      });
      this.getField('AMOUNT').setValidator((value) => {
        const amount = normaliseMoney(value, this.getFieldValue('CURRENCY'));
        return amount === null ? null : String(amount);
      });
    }
  );

  defineTableBlock(
    EMOJI_BLOCK,
    () => ({
      message0: '%1',
      args0: [{ type: 'field_emoji', name: 'EMOJI', value: DEFAULT_EMOJI }],
      output: 'String',
    }),
    function () {
      this.setStyle('variable_blocks');
    }
  );

  defineTableBlock(TABLE_COLUMN_MENU, () => ({
    message0: '%1',
    args0: [{ type: COLUMN_FIELD, name: 'COLUMN', value: defaultColumnName() }],
    output: 'String',
  }));

  defineTableBlock('table_row_value', () => ({
    args0: [
      { type: 'input_value', name: 'COLUMN', check: 'String' },
      { type: 'input_value', name: 'ROW' },
    ],
    output: null,
  }));

  defineTableBlock('table_row_values', () => ({
    args0: [{ type: 'input_value', name: 'ROW' }],
    output: 'Array',
  }));
}
