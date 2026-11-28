import { columnSpec, isTableRow, parseNumberText, tableRowText, typedCell } from './tables.js';

let _flock;

const RADIX = { BINARY: 2, HEX: 16 };
const COLUMN_TYPE = {
  MONEY: 'money',
  DATE: 'date',
  TIME: 'time',
  DATETIME: 'datetime',
  COLOUR: 'color',
};

function valueText(value) {
  if (value == null) return '';
  if (isVector(value)) return `(${value.x}, ${value.y}, ${value.z})`;
  if (isTableRow(value)) return tableRowText(value);
  if (Array.isArray(value)) return value.map(valueText).join(',');
  try {
    return String(value);
  } catch {
    return '';
  }
}

function sameValue(a, b) {
  const x = typeof a === 'boolean' ? null : parseNumberText(a);
  const y = typeof b === 'boolean' ? null : parseNumberText(b);
  if (x !== null && y !== null) return x === y;
  return valueText(a).trim().toLowerCase() === valueText(b).trim().toLowerCase();
}

function compareValues(a, b, op) {
  if (op === 'EQ') return sameValue(a, b);
  if (op === 'NEQ') return !sameValue(a, b);
  const x = typeof a === 'boolean' ? null : parseNumberText(a);
  const y = typeof b === 'boolean' ? null : parseNumberText(b);
  let order;
  if (x !== null && y !== null) {
    order = x - y;
  } else {
    const left = valueText(a).trim();
    const right = valueText(b).trim();
    if (x !== null || y !== null || left === '' || right === '') return false;
    order = left.localeCompare(right, undefined, { sensitivity: 'base', numeric: true });
  }
  const tests = {
    LT: order < 0,
    LTE: order <= 0,
    GT: order > 0,
    GTE: order >= 0,
  };
  return tests[op] ?? false;
}

function toBoolean(value) {
  if (typeof value === 'boolean') return value;
  const text = typeof value === 'string' ? value.trim().toLowerCase() : null;
  if (text === 'true' || text === 'false') return text === 'true';
  const number = parseNumberText(value);
  return number === null ? '' : number !== 0;
}

export function setFlockReference(ref) {
  _flock = ref;
}

export function isVector(value) {
  return value != null && typeof value === 'object' && 'x' in value && 'y' in value && 'z' in value;
}

export const flockMath = {
  /* 
		  Category: Math
  */

  // No prototype: a host-realm prototype chain reaches the untamed host
  // Function via .constructor (sandbox escape).
  createVector3(x, y, z) {
    return Object.freeze(Object.assign(Object.create(null), { x, y, z }));
  },
  randomInteger(a, b) {
    if (a > b) {
      // Swap a and b to ensure a is smaller.
      var c = a;
      a = b;
      b = c;
    }
    return Math.floor(Math.random() * (b - a + 1) + a);
  },
  seededRandom(from, to, seed) {
    const x = Math.sin(seed) * 10000;
    const random = x - Math.floor(x);
    const result = Math.floor(random * (to - from + 1)) + from;
    return result;
  },
  toNumber(value, type) {
    if (type === 'TEXT') return valueText(value);
    if (type === 'BOOLEAN') return toBoolean(value);
    if (COLUMN_TYPE[type]) {
      const cell = typedCell(columnSpec({ name: '', type: COLUMN_TYPE[type] }), value);
      return cell.ok ? cell.value : '';
    }
    const number = typeof value === 'boolean' ? Number(value) : parseNumberText(value);
    if (number === null) return '';
    if (RADIX[type]) {
      return Number.isSafeInteger(number) ? number.toString(RADIX[type]).toUpperCase() : '';
    }
    return type === 'INT' ? Math.trunc(number) : number;
  },
  convertUsing(value, pairs, otherwise, op = 'EQ') {
    const match = (Array.isArray(pairs) ? pairs : []).find(
      (pair) => Array.isArray(pair) && compareValues(value, pair[0], op)
    );
    return match ? match[1] : otherwise;
  },
  convertRange(value, fromLow, fromHigh, toLow, toHigh) {
    const [x, a, b, c, d] = [value, fromLow, fromHigh, toLow, toHigh].map(Number);
    if (a === b) return c;
    return c + ((x - a) * (d - c)) / (b - a);
  },
};
