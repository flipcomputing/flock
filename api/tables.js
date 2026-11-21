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

export function uniqueColumnNames(columns, onRenamed = () => {}) {
  const result = [];
  for (const column of Array.isArray(columns) ? columns : []) {
    const base = String(cellValue(column));
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
  for (let i = 0; i < count; i++) row.push(i < given.length ? cellValue(given[i]) : '');
  return row;
}

function uniqueColumns(name, columns) {
  return uniqueColumnNames(columns, (column, renamed) =>
    report('createTable', 'table_duplicate_column', { table: name, column, renamed })
  );
}

export const flockTables = {
  createTable(name, columns) {
    if (typeof name !== 'string' || name === '') return '';
    allTables().set(name, { columns: uniqueColumns(name, columns), rows: [] });
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
    if (r !== -1 && c !== -1) table.rows[r][c] = cellValue(value);
  },
  getTableColumn(name, column) {
    const table = findTable('getTableColumn', name);
    if (!table) return [];
    const c = findColumn('getTableColumn', table, name, column);
    return c === -1 ? [] : table.rows.map((row) => row[c]);
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
    table.rows.sort((a, b) => direction * compareCells(a[c], b[c]));
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
