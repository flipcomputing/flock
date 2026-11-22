import * as Blockly from 'blockly';
import { columnSpec, typedCell, uniqueColumnNames } from '../api/tables.js';
import { translate } from '../main/translation.js';

export const CURRENCY_SYMBOLS = { USD: '$', GBP: '£', EUR: '€' };
export const CURRENCIES = Object.keys(CURRENCY_SYMBOLS);

export function currencyOptions() {
  return CURRENCIES.map((code) => [CURRENCY_SYMBOLS[code], code]);
}

export function formatMoney(amount, currency) {
  const symbol = CURRENCY_SYMBOLS[currency] ?? `${currency} `;
  const digits = new Intl.NumberFormat('en', { style: 'currency', currency }).resolvedOptions()
    .maximumFractionDigits;
  const text = new Intl.NumberFormat('en', {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  }).format(Math.abs(amount));
  return `${amount < 0 ? '-' : ''}${symbol}${text}`;
}

const fillPlaceholders = (key, values) =>
  translate(key).replace(/\{(\w+)\}/g, (match, name) => values[name] ?? match);

export function typeProblem(table, spec, value) {
  if (!spec?.type) return null;
  const result = typedCell(spec, value);
  if (result.ok) return null;
  return fillPlaceholders(`table_value_not_${spec.type}`, {
    table,
    column: spec.name,
    value: String(result.value),
    values: (spec.values ?? []).join(', '),
  });
}

const emptyData = () => ({ columns: [], rows: [], types: {} });

function setOwn(object, key, value) {
  Object.defineProperty(object, key, {
    value,
    writable: true,
    enumerable: true,
    configurable: true,
  });
}

const typeOf = (types, name) => (Object.hasOwn(types, name) ? types[name] : undefined);

function positionalTypes(types, oldColumns, specs, newColumns) {
  const result = {};
  for (const [name, spec] of Object.entries(types)) {
    if (!oldColumns.includes(name)) setOwn(result, name, spec);
  }
  newColumns.forEach((name, i) => {
    if (specs[i]) setOwn(result, name, specs[i]);
  });
  return result;
}

export function cellFromText(text, spec = null) {
  if (spec?.type) return typedCell(spec, String(text)).value;
  const trimmed = String(text).trim();
  const number = Number(trimmed);
  if (trimmed !== '' && Number.isFinite(number) && String(number) === trimmed) return number;
  return String(text);
}

export function startData(block) {
  block.tableData_ ??= emptyData();
  block.tableData_.types ??= {};
  return block.tableData_;
}

function typeState(spec) {
  const state = columnSpec({ ...spec, name: '' });
  delete state.name;
  return state.type ? state : null;
}

export function saveStartData(block) {
  const { columns, rows, types } = startData(block);
  const hasTypes = Object.keys(types).length > 0;
  if (!rows.length && !hasTypes) return null;
  return {
    columns: [...columns],
    rows: rows.map((row) => [...row]),
    ...(hasTypes && { types: structuredClone(Object.entries(types)) }),
  };
}

export function loadStartData(block, state) {
  const columns = Array.isArray(state?.columns) ? state.columns.map(String) : [];
  const rows = Array.isArray(state?.rows)
    ? state.rows.map((row) => (Array.isArray(row) ? [...row] : []))
    : [];
  const types = {};
  const entries = Array.isArray(state?.types)
    ? state.types.filter((entry) => Array.isArray(entry) && entry.length === 2)
    : state?.types && typeof state.types === 'object'
      ? Object.entries(state.types)
      : [];
  for (const [name, spec] of entries) {
    const kept = typeState(spec);
    if (kept) setOwn(types, String(name), kept);
  }
  block.tableData_ = { columns, rows, types };
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

export function columnTypeFor(block, name) {
  return columnSpec({ ...typeOf(startData(block).types, name), name });
}

export function startColumnSpecs(block) {
  return startColumns(block)?.map((name) => columnTypeFor(block, name)) ?? null;
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

function writeStartData(block, columns, rows, types = startData(block).types) {
  const before = Blockly.Events.BlockChange.getExtraBlockState_(block);
  block.tableData_ = { columns: [...columns], rows, types };
  const after = Blockly.Events.BlockChange.getExtraBlockState_(block);
  if (before !== after) {
    Blockly.Events.fire(new Blockly.Events.BlockChange(block, 'mutation', null, before, after));
  }
  block.updateRowCount_?.();
}

function renamedTypes(types, renames) {
  return Object.fromEntries(
    Object.entries(types).map(([name, spec]) => [renames.get(name) ?? name, spec])
  );
}

export function renameStartDataColumns(block, renames) {
  const data = startData(block);
  const touched = [...data.columns, ...Object.keys(data.types)].some((name) => renames.has(name));
  if (!touched) return;
  const columns = data.columns.map((name) => renames.get(name) ?? name);
  writeStartData(block, uniqueColumnNames(columns), data.rows, renamedTypes(data.types, renames));
}

function editable(block) {
  const columns = startColumns(block);
  return columns ? { columns, rows: startRows(block, columns) } : null;
}

export function setStartCell(block, row, column, text) {
  const current = editable(block);
  if (!current?.rows[row] || column >= current.columns.length) return null;
  const name = current.columns[column];
  const spec = columnTypeFor(block, name);
  const value = cellFromText(text, spec);
  current.rows[row][column] = value;
  const added =
    spec.type === 'category' && value !== '' && !spec.values.includes(String(value))
      ? String(value)
      : null;
  const types = startData(block).types;
  const nextTypes = added
    ? { ...types, [name]: { ...typeOf(types, name), values: [...spec.values, added] } }
    : types;
  inGroup(() => writeStartData(block, current.columns, current.rows, nextTypes));
  return added ? { added } : {};
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

export function moveStartRow(block, index, to) {
  const current = editable(block);
  if (!current?.rows[index] || !current.rows[to]) return false;
  current.rows.splice(to, 0, current.rows.splice(index, 1)[0]);
  inGroup(() => writeStartData(block, current.columns, current.rows));
  return true;
}

export function renameStartColumn(block, index, name) {
  const found = columnItems(block);
  const item = found?.items[index];
  if (!item || name === '' || item.getFieldValue('TEXT') === name) return;
  const current = editable(block);
  const texts = found.items.map((each) => each.getFieldValue('TEXT'));
  texts[index] = name;
  const columns = uniqueColumnNames(texts);
  const old = startData(block).types;
  const specs = current.columns.map((column) => typeOf(old, column));
  const types = positionalTypes(old, current.columns, specs, columns);
  inGroup(() => {
    writeStartData(block, columns, current.rows, types);
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
  const old = startData(block).types;
  const specs = current.columns.map((column) => typeOf(old, column));
  const result = change({ items, texts, rows: current.rows, columns: current.columns, specs });
  if (result === false) return null;
  const columns = uniqueColumnNames(texts);
  const types = positionalTypes(old, current.columns, specs, columns);
  inGroup(() => {
    writeStartData(block, columns, current.rows, types);
    rebuildColumnList(block, found.list, items);
  });
  return result;
}

export function insertStartColumn(block, index) {
  return changeColumns(block, ({ items, texts, rows, columns, specs }) => {
    const name = newColumnName(columns);
    specs.splice(index, 0, undefined);
    items.splice(index, 0, { shadow: { type: 'text', fields: { TEXT: name } } });
    texts.splice(index, 0, name);
    for (const row of rows) row.splice(index, 0, '');
    return name;
  });
}

export function deleteStartColumn(block, index) {
  return changeColumns(block, ({ items, texts, rows, columns, specs }) => {
    if (index < 0 || index >= columns.length) return false;
    items.splice(index, 1);
    texts.splice(index, 1);
    specs.splice(index, 1);
    for (const row of rows) row.splice(index, 1);
    return columns[index];
  });
}

export function moveStartColumn(block, index, to) {
  return changeColumns(block, ({ items, texts, rows, columns, specs }) => {
    if (index < 0 || index >= columns.length || to < 0 || to >= columns.length) return false;
    const move = (array) => array.splice(to, 0, array.splice(index, 1)[0]);
    move(items);
    move(texts);
    move(specs);
    rows.forEach(move);
    return columns[index];
  });
}

export function distinctValues(cells) {
  return [...new Set(cells.filter((cell) => cell !== '').map(String))];
}

const sameType = (a, b) => JSON.stringify(typeState(a)) === JSON.stringify(typeState(b));

export function configureStartColumn(block, index, settings) {
  const current = editable(block);
  const oldName = current?.columns[index];
  if (oldName === undefined) return null;
  const before = columnTypeFor(block, oldName);
  const { name = oldName, renames = new Map() } = settings;
  const type = settings.type ?? null;
  const values =
    type === 'category'
      ? (settings.values ??
        (before.type === 'category' && before.values.length
          ? before.values
          : distinctValues(current.rows.map((row) => row[index]))))
      : undefined;
  const currency = settings.currency ?? before.currency ?? translate('table_default_currency');
  const after = { type, currency: type === 'money' ? currency : undefined, values };
  const typeChanged = !sameType(before, after) || renames.size > 0;
  if (name === oldName && !typeChanged) return null;
  return inGroup(() => {
    if (name !== oldName && name !== '') renameStartColumn(block, index, name);
    if (!typeChanged) return name;
    const columns = startColumns(block);
    const finalName = columns[index];
    const rows = startRows(block, columns);
    const kept = typeState(after);
    const types = { ...startData(block).types };
    delete types[finalName];
    if (kept) setOwn(types, finalName, kept);
    const spec = columnSpec({ ...kept, name: finalName });
    for (const row of rows) {
      const cell = row[index];
      row[index] = typedCell(spec, renames.get(String(cell)) ?? cell).value;
    }
    writeStartData(block, columns, rows, types);
    return finalName;
  });
}

export function setStartColumnType(block, index, type, currency) {
  return configureStartColumn(block, index, { type, currency });
}
