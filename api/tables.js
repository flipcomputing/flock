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

function uniqueColumns(name, columns) {
  const result = [];
  for (const column of Array.isArray(columns) ? columns : []) {
    const base = String(cellValue(column));
    let unique = base;
    for (let n = 2; result.includes(unique); n++) unique = `${base} ${n}`;
    if (unique !== base) {
      report('createTable', 'table_duplicate_column', {
        table: name,
        column: base,
        renamed: unique,
      });
    }
    result.push(unique);
  }
  return result;
}

export const flockTables = {
  createTable(name, columns) {
    if (typeof name !== 'string' || name === '') return '';
    allTables().set(name, { columns: uniqueColumns(name, columns), rows: [] });
    return name;
  },
  addTableRow(name, values) {
    const table = findTable('addTableRow', name);
    if (!table) return;
    const given = Array.isArray(values) ? values : [values];
    const count = table.columns.length;
    if (given.length !== count) {
      report('addTableRow', 'table_row_length', { table: name, given: given.length, count });
    }
    const row = [];
    for (let i = 0; i < count; i++) row.push(i < given.length ? cellValue(given[i]) : '');
    table.rows.push(row);
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
    if (r === -1) return '';
    return Object.freeze(
      Object.assign(Object.create(null), {
        table: name,
        number: r,
        columns: Object.freeze([...table.columns]),
        values: Object.freeze([...table.rows[r]]),
      })
    );
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
