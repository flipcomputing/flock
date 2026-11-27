import { normaliseColourInput } from '../blocks/colourvalidation.js';
import { normaliseEmoji } from '../blocks/emoji.js';

let flock;

export function setFlockReference(ref) {
  flock = ref;
}

function allTables() {
  flock.tables ??= new Map();
  return flock.tables;
}

function cellValue(value) {
  if (typeof value === 'string' || typeof value === 'boolean') return value;
  if (typeof value === 'number') return Number.isFinite(value) ? value : '';
  return '';
}

function report(api, key, values) {
  flock.reportBlockError({ api, key, values });
}

function findTable(api, name) {
  if (typeof name !== 'string' || name === '') {
    report(api, 'table_not_made');
    return null;
  }
  const table = allTables().get(name);
  if (!table) report(api, 'table_not_found', { table: name });
  return table ?? null;
}

export function tableContents(api, name) {
  const table = findTable(api, name);
  return { columns: table?.columns ?? [], rows: table?.rows ?? [] };
}

function findColumn(api, table, name, column) {
  const index = table.columns.indexOf(String(column));
  if (index === -1) report(api, 'table_column_not_found', { table: name, column: String(column) });
  return index;
}

function findRow(api, table, name, row) {
  const index = Number(row);
  if (Number.isInteger(index) && index >= 0 && index < table.rows.length) return index;
  const count = table.rows.length;
  if (count === 0) {
    report(api, 'table_no_rows', { table: name, row: String(row) });
  } else if (count === 1) {
    report(api, 'table_row_out_of_range_one', { table: name, row: String(row) });
  } else {
    report(api, 'table_row_out_of_range', {
      table: name,
      count,
      last: count - 1,
      row: String(row),
    });
  }
  return -1;
}

function rowOf(name, table, r) {
  return Object.freeze(
    Object.assign(Object.create(null), {
      table: name,
      number: r,
      columns: Object.freeze([...table.columns]),
      values: Object.freeze([...table.rows[r]]),
    })
  );
}

function cellNumber(value) {
  if (typeof value === 'number') return value;
  if (typeof value !== 'string' || value.trim() === '') return null;
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
}

function compareCells(a, b) {
  const x = cellNumber(a);
  const y = cellNumber(b);
  if (x !== null && y !== null) return x - y;
  if (x !== null) return -1;
  if (y !== null) return 1;
  return String(a).localeCompare(String(b), undefined, { numeric: true, sensitivity: 'base' });
}

export const COLUMN_TYPES = [
  'text',
  'number',
  'money',
  'date',
  'time',
  'datetime',
  'category',
  'color',
  'emoji',
];

export function columnSpec(column) {
  if (column === null || typeof column !== 'object' || Array.isArray(column)) {
    return { name: String(cellValue(column)), type: null };
  }
  const name = String(cellValue(column.name));
  const type = COLUMN_TYPES.includes(column.type) ? column.type : null;
  if (type === 'category') {
    const values = Array.isArray(column.values) ? column.values : [];
    return { name, type, values: [...new Set(values.map((v) => String(cellValue(v))))] };
  }
  if (type === 'money') {
    const currency = String(column.currency ?? '').toUpperCase();
    return { name, type, currency: /^[A-Z]{3}$/.test(currency) ? currency : 'USD' };
  }
  return { name, type };
}

export function normaliseDate(value) {
  const match = /^(\d{4})-(\d{1,2})-(\d{1,2})$/.exec(String(value).trim());
  if (!match) return null;
  const [year, month, day] = match.slice(1).map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));
  if (date.getUTCMonth() !== month - 1 || date.getUTCDate() !== day) return null;
  const pad = (n) => String(n).padStart(2, '0');
  return `${match[1]}-${pad(month)}-${pad(day)}`;
}

export function normaliseTime(value) {
  const match = /^(\d{1,2}):(\d{2})(?::(\d{2}))?\s*([ap]\.?m\.?)?$/i.exec(String(value).trim());
  if (!match) return null;
  let hours = Number(match[1]);
  const minutes = Number(match[2]);
  const seconds = match[3] === undefined ? null : Number(match[3]);
  const half = match[4]?.[0].toLowerCase();
  if (half) {
    if (hours < 1 || hours > 12) return null;
    hours = (hours % 12) + (half === 'p' ? 12 : 0);
  }
  if (hours > 23 || minutes > 59 || (seconds ?? 0) > 59) return null;
  const pad = (n) => String(n).padStart(2, '0');
  return `${pad(hours)}:${pad(minutes)}${seconds === null ? '' : `:${pad(seconds)}`}`;
}

export function normaliseDateTime(value) {
  const match = /^(\S+)[T\s]+(\S.*)$/i.exec(String(value).trim());
  if (!match) return null;
  const date = normaliseDate(match[1]);
  const time = normaliseTime(match[2]);
  return date && time ? `${date} ${time}` : null;
}

export function parseNumberText(value) {
  if (typeof value === 'number') return Number.isFinite(value) ? value : null;
  if (typeof value !== 'string') return null;
  const stripped = value.replace(/[\s,]/g, '');
  if (stripped === '') return null;
  const number = Number(stripped);
  return Number.isFinite(number) ? number : null;
}

export function currencyDigits(currency) {
  try {
    return new Intl.NumberFormat('en', { style: 'currency', currency }).resolvedOptions()
      .maximumFractionDigits;
  } catch {
    return 2;
  }
}

export function normaliseMoney(value, currency) {
  const text = typeof value === 'string' ? value.replace(/[\s,]/g, '') : value;
  const amount =
    typeof text === 'string'
      ? parseNumberText(
          text.replace(/^(-?)[^\d.-]{1,3}(?=[\d.])/, '$1').replace(/(?<=[\d.])[^\d.]{1,3}$/, '')
        )
      : parseNumberText(text);
  if (amount === null) return null;
  return roundDecimal(amount, currencyDigits(currency));
}

function roundDecimal(amount, digits) {
  const shifted = Math.round(Number(`${Math.abs(amount)}e${digits}`));
  const rounded = Number(`${shifted}e-${digits}`);
  if (!Number.isFinite(rounded)) return Math.round(amount * 10 ** digits) / 10 ** digits;
  return amount < 0 ? -rounded : rounded;
}

export function normaliseColour(value) {
  const colour = normaliseColourInput(String(value));
  return colour && /^#([0-9a-f]{6}|[0-9a-f]{8})$/i.test(colour) ? colour.toLowerCase() : colour;
}

export function typedCell(spec, value) {
  const cell = cellValue(value);
  const type = spec?.type;
  if (!type || cell === '') return { value: cell, ok: true };
  if (type === 'text') return { value: String(cell), ok: true };
  const checks = {
    number: parseNumberText,
    money: (v) => normaliseMoney(v, spec.currency),
    date: normaliseDate,
    time: normaliseTime,
    datetime: normaliseDateTime,
    color: normaliseColour,
    emoji: normaliseEmoji,
  };
  if (checks[type]) {
    const result = checks[type](cell);
    return result === null ? { value: cell, ok: false } : { value: result, ok: true };
  }
  const text = String(cell).trim();
  const values = spec.values ?? [];
  if (values.length === 0) return { value: String(cell), ok: true };
  const match =
    values.find((v) => v === String(cell)) ??
    values.find((v) => v.toLowerCase() === text.toLowerCase());
  return match === undefined ? { value: cell, ok: false } : { value: match, ok: true };
}

function colourHue(value) {
  const hex = /^#([0-9a-f]{2})([0-9a-f]{2})([0-9a-f]{2})$/.exec(String(value));
  if (!hex) return null;
  const [r, g, b] = hex.slice(1).map((part) => parseInt(part, 16) / 255);
  const max = Math.max(r, g, b);
  const range = max - Math.min(r, g, b);
  if (range === 0) return 361 - max;
  const hue =
    max === r ? ((g - b) / range) % 6 : max === g ? (b - r) / range + 2 : (r - g) / range + 4;
  return (hue * 60 + 360) % 360;
}

function compareTyped(spec, a, b) {
  if (spec?.type === 'text') {
    return String(a).localeCompare(String(b), undefined, { numeric: true, sensitivity: 'base' });
  }
  if (spec?.type === 'category' && spec.values.length) {
    const rank = (v) => {
      const i = spec.values.indexOf(v);
      return i === -1 ? spec.values.length : i;
    };
    return rank(a) - rank(b) || compareCells(a, b);
  }
  if (spec?.type === 'color') {
    const x = colourHue(a);
    const y = colourHue(b);
    if (x !== null && y !== null) return x - y;
    if (x !== null) return -1;
    if (y !== null) return 1;
  }
  return compareCells(a, b);
}

export function uniqueColumnNames(columns, onRenamed = () => {}) {
  const result = [];
  for (const column of Array.isArray(columns) ? columns : []) {
    const base = columnSpec(column).name;
    let unique = base;
    for (let n = 2; result.includes(unique); n++) unique = `${base} ${n}`;
    if (unique !== base) onRenamed(base, unique);
    result.push(unique);
  }
  return result;
}

function rowFrom(api, name, table, values) {
  const given = Array.isArray(values) ? values : [values];
  const count = table.columns.length;
  if (given.length !== count) {
    report(api, 'table_row_length', { table: name, given: given.length, count });
  }
  const row = [];
  for (let i = 0; i < count; i++) {
    row.push(i < given.length ? typed(api, name, table, i, given[i]) : '');
  }
  return row;
}

function typed(api, name, table, c, value) {
  const spec = table.specs[c];
  const result = typedCell(spec, value);
  if (!result.ok) {
    report(api, `table_value_not_${spec.type}`, {
      table: name,
      column: table.columns[c],
      value: String(result.value),
      values: (spec.values ?? []).join(', '),
    });
  }
  return result.value;
}

function uniqueColumns(api, name, columns) {
  return uniqueColumnNames(columns, (column, renamed) =>
    report(api, 'table_duplicate_column', { table: name, column, renamed })
  );
}

export const flockTables = {
  createTable(name, columns, rows, types) {
    if (typeof name !== 'string' || name === '') return '';
    const given = Array.isArray(columns) ? columns : [];
    const names = uniqueColumns('createTable', name, given);
    const pairs = Array.isArray(types)
      ? types.filter((entry) => Array.isArray(entry) && entry.length === 2)
      : types && typeof types === 'object'
        ? Object.entries(types)
        : [];
    const typed = new Map(pairs);
    const typeOf = (column) => {
      const spec = typed.get(column);
      return spec && typeof spec === 'object' ? spec : null;
    };
    const specs = names.map((column, i) =>
      columnSpec({ ...(typeOf(column) ?? columnSpec(given[i])), name: column })
    );
    const table = { columns: names, specs, rows: [] };
    allTables().set(name, table);
    if (Array.isArray(rows)) {
      for (const values of rows) table.rows.push(rowFrom('createTable', name, table, values));
    }
    return name;
  },
  addTableRow(name, values) {
    const table = findTable('addTableRow', name);
    if (table) table.rows.push(rowFrom('addTableRow', name, table, values));
  },
  insertTableRow(name, row, values) {
    const table = findTable('insertTableRow', name);
    if (!table) return;
    const index = Number(row);
    if (Number.isInteger(index) && index >= 0 && index <= table.rows.length) {
      table.rows.splice(index, 0, rowFrom('insertTableRow', name, table, values));
    } else {
      findRow('insertTableRow', table, name, row);
    }
  },
  setTableRow(name, row, values) {
    const table = findTable('setTableRow', name);
    if (!table) return;
    const r = findRow('setTableRow', table, name, row);
    if (r !== -1) table.rows[r] = rowFrom('setTableRow', name, table, values);
  },
  addTableColumn(name, column, values) {
    const table = findTable('addTableColumn', name);
    if (!table) return;
    const columns = uniqueColumns('addTableColumn', name, [...table.columns, column]);
    const count = table.rows.length;
    const given = values === undefined ? null : Array.isArray(values) ? values : [values];
    if (given && given.length !== count) {
      report('addTableColumn', 'table_column_length', { table: name, given: given.length, count });
    }
    table.columns = columns;
    table.specs.push({ ...columnSpec(column), name: columns.at(-1) });
    const c = columns.length - 1;
    table.rows.forEach((row, i) =>
      row.push(given && i < given.length ? typed('addTableColumn', name, table, c, given[i]) : '')
    );
  },
  deleteTableColumn(name, column) {
    const table = findTable('deleteTableColumn', name);
    if (!table) return;
    const c = findColumn('deleteTableColumn', table, name, column);
    if (c === -1) return;
    table.columns.splice(c, 1);
    table.specs.splice(c, 1);
    for (const row of table.rows) row.splice(c, 1);
  },
  deleteTableRow(name, row) {
    const table = findTable('deleteTableRow', name);
    if (!table) return;
    const r = findRow('deleteTableRow', table, name, row);
    if (r !== -1) table.rows.splice(r, 1);
  },
  deleteAllTableRows(name) {
    const table = findTable('deleteAllTableRows', name);
    if (table) table.rows = [];
  },
  getTableValue(name, row, column) {
    const table = findTable('getTableValue', name);
    if (!table) return '';
    const r = findRow('getTableValue', table, name, row);
    const c = findColumn('getTableValue', table, name, column);
    return r === -1 || c === -1 ? '' : table.rows[r][c];
  },
  setTableValue(name, row, column, value) {
    const table = findTable('setTableValue', name);
    if (!table) return;
    const r = findRow('setTableValue', table, name, row);
    const c = findColumn('setTableValue', table, name, column);
    if (r !== -1 && c !== -1) table.rows[r][c] = typed('setTableValue', name, table, c, value);
  },
  setTableColumn(name, column, values) {
    const table = findTable('setTableColumn', name);
    if (!table) return;
    const c = findColumn('setTableColumn', table, name, column);
    if (c === -1) return;
    const given = Array.isArray(values) ? values : [values];
    const count = table.rows.length;
    if (given.length !== count) {
      report('setTableColumn', 'table_column_length', { table: name, given: given.length, count });
    }
    table.rows.forEach((row, i) => {
      row[c] = i < given.length ? typed('setTableColumn', name, table, c, given[i]) : '';
    });
  },
  getTableColumn(name, column) {
    const table = findTable('getTableColumn', name);
    if (!table) return [];
    const c = findColumn('getTableColumn', table, name, column);
    return c === -1 ? [] : table.rows.map((row) => row[c]);
  },
  getTableColumnNames(name) {
    const table = findTable('getTableColumnNames', name);
    return table ? [...table.columns] : [];
  },
  getTableRow(name, row) {
    const table = findTable('getTableRow', name);
    if (!table) return '';
    const r = findRow('getTableRow', table, name, row);
    return r === -1 ? '' : rowOf(name, table, r);
  },
  pickTableRow(name, which) {
    const table = findTable('pickTableRow', name);
    if (!table) return '';
    const count = table.rows.length;
    if (count === 0) {
      report('pickTableRow', 'table_empty', { table: name });
      return '';
    }
    const picks = { first: 0, last: count - 1 };
    const r = picks[which] ?? Math.floor(Math.random() * count);
    return rowOf(name, table, r);
  },
  findTableRow(name, column, value, which = 'first') {
    const table = findTable('findTableRow', name);
    if (!table) return -1;
    const c = findColumn('findTableRow', table, name, column);
    if (c === -1) return -1;
    const wanted = String(cellValue(value));
    const matches = (row) => String(row[c]) === wanted;
    return which === 'last' ? table.rows.findLastIndex(matches) : table.rows.findIndex(matches);
  },
  sortTable(name, column, order) {
    const table = findTable('sortTable', name);
    if (!table) return;
    const c = findColumn('sortTable', table, name, column);
    if (c === -1) return;
    const direction = order === 'DESCENDING' ? -1 : 1;
    table.rows.sort((a, b) => direction * compareTyped(table.specs[c], a[c], b[c]));
  },
  shuffleTable(name) {
    const table = findTable('shuffleTable', name);
    if (!table) return;
    const rows = table.rows;
    for (let i = rows.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [rows[i], rows[j]] = [rows[j], rows[i]];
    }
  },
  getRowValue(row, column) {
    if (!checkRow('getRowValue', row)) return '';
    const index = row.columns.indexOf(String(column));
    if (index === -1) {
      report('getRowValue', 'table_column_not_found', { table: row.table, column: String(column) });
      return '';
    }
    return row.values[index];
  },
  getRowValues(row) {
    return checkRow('getRowValues', row) ? [...row.values] : [];
  },
  getTableRowCount(name) {
    const table = findTable('getTableRowCount', name);
    return table ? table.rows.length : 0;
  },
};

export function isTableRow(value) {
  return (
    value != null &&
    typeof value === 'object' &&
    typeof value.table === 'string' &&
    Number.isInteger(value.number) &&
    Array.isArray(value.columns) &&
    Array.isArray(value.values)
  );
}

export function tableRowText(row) {
  return row.columns.map((column, i) => `${column}: ${row.values[i]}`).join(', ');
}

function checkRow(api, row) {
  if (isTableRow(row)) return true;
  if (row !== '' && row != null) report(api, 'table_not_a_row');
  return false;
}
