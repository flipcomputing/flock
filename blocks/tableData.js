import * as Blockly from 'blockly';
import { uniqueColumnNames } from '../api/tables.js';
import { translate } from '../main/translation.js';

const emptyData = () => ({ columns: [], rows: [] });

export function cellFromText(text) {
  const trimmed = String(text).trim();
  const number = Number(trimmed);
  if (trimmed !== '' && Number.isFinite(number) && String(number) === trimmed) return number;
  return String(text);
}

export function startData(block) {
  block.tableData_ ??= emptyData();
  return block.tableData_;
}

export function saveStartData(block) {
  const { columns, rows } = startData(block);
  return rows.length ? { columns: [...columns], rows: rows.map((row) => [...row]) } : null;
}

export function loadStartData(block, state) {
  const columns = Array.isArray(state?.columns) ? state.columns.map(String) : [];
  const rows = Array.isArray(state?.rows)
    ? state.rows.map((row) => (Array.isArray(row) ? [...row] : []))
    : [];
  block.tableData_ = { columns, rows };
}

function columnItems(block) {
  const list = block.getInputTargetBlock('COLUMNS');
  if (!list) return { list: null, items: [] };
  if (list.type !== 'lists_create_with') return null;
  const items = list.inputList
    .filter((input) => input.name?.startsWith('ADD'))
    .map((input) => input.connection?.targetBlock());
  if (!items.every((item) => item?.type === 'text')) return null;
  return { list, items };
}

export function startColumns(block) {
  const found = columnItems(block);
  if (!found) return null;
  return uniqueColumnNames(found.items.map((item) => item.getFieldValue('TEXT')));
}

export function startRows(block, columns = startColumns(block)) {
  const data = startData(block);
  if (!columns) return data.rows.map((row) => [...row]);
  const from = columns.map((name) => data.columns.indexOf(name));
  return data.rows.map((row) => from.map((i) => (i === -1 ? '' : (row[i] ?? ''))));
}

function inGroup(action) {
  const outer = Blockly.Events.getGroup();
  if (!outer) Blockly.Events.setGroup(true);
  try {
    return action();
  } finally {
    if (!outer) Blockly.Events.setGroup(false);
  }
}

function writeStartData(block, columns, rows) {
  const before = Blockly.Events.BlockChange.getExtraBlockState_(block);
  block.tableData_ = { columns: [...columns], rows };
  const after = Blockly.Events.BlockChange.getExtraBlockState_(block);
  if (before !== after) {
    Blockly.Events.fire(new Blockly.Events.BlockChange(block, 'mutation', null, before, after));
  }
  block.updateRowCount_?.();
}

export function renameStartDataColumns(block, renames) {
  const data = startData(block);
  if (!data.columns.some((name) => renames.has(name))) return;
  const columns = data.columns.map((name) => renames.get(name) ?? name);
  writeStartData(block, uniqueColumnNames(columns), data.rows);
}

function editable(block) {
  const columns = startColumns(block);
  return columns ? { columns, rows: startRows(block, columns) } : null;
}

export function setStartCell(block, row, column, text) {
  const current = editable(block);
  if (!current?.rows[row] || column >= current.columns.length) return;
  current.rows[row][column] = cellFromText(text);
  inGroup(() => writeStartData(block, current.columns, current.rows));
}

export function insertStartRow(block, index) {
  const current = editable(block);
  if (!current) return;
  current.rows.splice(
    index,
    0,
    current.columns.map(() => '')
  );
  inGroup(() => writeStartData(block, current.columns, current.rows));
}

export function deleteStartRow(block, index) {
  const current = editable(block);
  if (!current?.rows[index]) return;
  current.rows.splice(index, 1);
  inGroup(() => writeStartData(block, current.columns, current.rows));
}

export function renameStartColumn(block, index, name) {
  const found = columnItems(block);
  const item = found?.items[index];
  if (!item || name === '' || item.getFieldValue('TEXT') === name) return;
  const current = editable(block);
  const texts = found.items.map((each) => each.getFieldValue('TEXT'));
  texts[index] = name;
  inGroup(() => {
    writeStartData(block, uniqueColumnNames(texts), current.rows);
    item.startDataRenamed_ = name;
    item.setFieldValue(name, 'TEXT');
  });
}

function newColumnName(columns) {
  const base = translate('table_editor_new_column');
  let n = columns.length + 1;
  while (columns.includes(`${base} ${n}`)) n++;
  return `${base} ${n}`;
}

function itemState(item) {
  const state = Blockly.serialization.blocks.save(item, { saveIds: false });
  return item.isShadow() ? { shadow: state } : { block: state };
}

function rebuildColumnList(block, list, items) {
  const input = block.getInput('COLUMNS');
  const saved =
    list && Blockly.serialization.blocks.save(list, { addInputBlocks: false, saveIds: false });
  const state = {
    ...saved,
    type: 'lists_create_with',
    inline: true,
    extraState: { itemCount: items.length },
    inputs: Object.fromEntries(items.map((item, i) => [`ADD${i}`, item])),
  };
  if (list?.isShadow()) {
    input.connection.setShadowState(state);
    return;
  }
  list?.dispose(false);
  const created = Blockly.serialization.blocks.append(state, block.workspace);
  input.connection.connect(created.outputConnection);
}

function changeColumns(block, change) {
  const found = columnItems(block);
  const current = editable(block);
  if (!found || !current) return null;
  const items = found.items.map(itemState);
  const texts = found.items.map((item) => item.getFieldValue('TEXT'));
  const result = change({ items, texts, rows: current.rows, columns: current.columns });
  if (result === false) return null;
  inGroup(() => {
    writeStartData(block, uniqueColumnNames(texts), current.rows);
    rebuildColumnList(block, found.list, items);
  });
  return result;
}

export function insertStartColumn(block, index) {
  return changeColumns(block, ({ items, texts, rows, columns }) => {
    const name = newColumnName(columns);
    items.splice(index, 0, { shadow: { type: 'text', fields: { TEXT: name } } });
    texts.splice(index, 0, name);
    for (const row of rows) row.splice(index, 0, '');
    return name;
  });
}

export function deleteStartColumn(block, index) {
  return changeColumns(block, ({ items, texts, rows, columns }) => {
    if (index < 0 || index >= columns.length) return false;
    items.splice(index, 1);
    texts.splice(index, 1);
    for (const row of rows) row.splice(index, 1);
    return columns[index];
  });
}

export function moveStartColumn(block, index, to) {
  return changeColumns(block, ({ items, texts, rows, columns }) => {
    if (index < 0 || index >= columns.length || to < 0 || to >= columns.length) return false;
    const move = (array) => array.splice(to, 0, array.splice(index, 1)[0]);
    move(items);
    move(texts);
    rows.forEach(move);
    return columns[index];
  });
}
