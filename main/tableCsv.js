import { normaliseDate, normaliseDateTime, normaliseTime } from '../api/tables.js';

export const BOM = String.fromCharCode(0xfeff);

export const CSV_LIMITS = { bytes: 1024 * 1024, rows: 1000, columns: 20, cell: 1000 };

const FORMULA_START = /^[=+\-@\t\r\n]/;
const needsGuard = (text) => FORMULA_START.test(text.replace(/^'*/, ''));

function csvField(value) {
  if (value === null || value === undefined) return '';
  let text = String(value);
  if (typeof value === 'string' && needsGuard(text)) text = `'${text}`;
  return /[",\r\n]/.test(text) ? `"${text.replaceAll('"', '""')}"` : text;
}

export function tableToCsv(columns, rows) {
  const field = (value) => {
    const text = csvField(value);
    return columns.length === 1 && text === '' ? '""' : text;
  };
  const lines = [columns, ...rows].map((row) => columns.map((_, i) => field(row[i])).join(','));
  return `${lines.join('\r\n')}\r\n`;
}

export function csvFileName(tableName) {
  const base = String(tableName ?? '')
    .replace(/[\p{Cc}\\/:*?"<>|]/gu, '')
    .trim()
    .slice(0, 50);
  return `${base || 'table'}.csv`;
}

export class CsvImportError extends Error {
  constructor(key) {
    super(key);
    this.key = key;
  }
}

export function decodeCsv(buffer) {
  const bytes = new Uint8Array(buffer);
  let text;
  try {
    text = new TextDecoder('utf-8', { fatal: true }).decode(bytes);
  } catch {
    text = new TextDecoder('windows-1252').decode(bytes);
  }
  if (text.includes('\u0000')) throw new CsvImportError('table_csv_not_text');
  return text.startsWith(BOM) ? text.slice(1) : text;
}

export function parseCsv(text, limits = CSV_LIMITS) {
  const maxLines = limits.rows + 1;
  const lines = [];
  const found = { moreRows: false, moreColumns: false, longCells: false, unclosedQuote: false };
  let row = [];
  let field = '';
  let quoted = false;
  let lineQuoted = false;
  let inQuotes = false;
  let done = false;

  const endField = () => {
    if (row.length < limits.columns) {
      if (field.length > limits.cell) {
        field = field.slice(0, limits.cell);
        found.longCells = true;
      }
      row.push(field);
    } else {
      found.moreColumns = true;
    }
    field = '';
    quoted = false;
  };
  const endRow = () => {
    endField();
    const blank = row.length === 1 && row[0] === '' && !lineQuoted;
    if (!blank) {
      if (lines.length === maxLines) {
        found.moreRows = true;
        done = true;
      } else {
        lines.push(row);
      }
    }
    row = [];
    lineQuoted = false;
  };

  for (let i = 0; i < text.length && !done; i++) {
    const ch = text[i];
    if (inQuotes) {
      if (ch !== '"') field += ch;
      else if (text[i + 1] === '"') {
        field += '"';
        i++;
      } else inQuotes = false;
    } else if (ch === '"' && field === '' && !quoted) {
      inQuotes = true;
      quoted = true;
      lineQuoted = true;
    } else if (ch === ',') {
      endField();
    } else if (ch === '\r' || ch === '\n') {
      if (ch === '\r' && text[i + 1] === '\n') i++;
      endRow();
    } else {
      field += ch;
    }
  }
  if (inQuotes) found.unclosedQuote = true;
  if (!done && (field !== '' || row.length || quoted)) endRow();
  return { lines, ...found };
}

const unguard = (text) => (text.startsWith("'") && needsGuard(text) ? text.slice(1) : text);

const looksLikeValue = (text) => {
  const trimmed = text.trim();
  if (trimmed === '') return false;
  return (
    Number.isFinite(Number(trimmed)) ||
    normaliseDate(trimmed) !== null ||
    normaliseTime(trimmed) !== null ||
    normaliseDateTime(trimmed) !== null ||
    /^#[0-9a-f]{6}$/i.test(trimmed)
  );
};

export function guessHeader(lines, existingColumns = []) {
  const first = lines[0];
  if (!first) return false;
  const names = first.map((cell) => unguard(cell).trim().toLowerCase());
  const existing = existingColumns.map((name) => String(name).trim().toLowerCase());
  if (existing.length && names.length === existing.length) {
    if (names.every((name, i) => name === existing[i])) return true;
  }
  if (first.some(looksLikeValue)) return false;
  const filled = names.filter((name) => name !== '');
  return filled.length > 0 && new Set(filled).size === filled.length;
}

const columnName = (text) =>
  unguard(text ?? '')
    .replace(/[\r\n\t]+/g, ' ')
    .trim();

export function csvTable(lines, header, defaultName, maxRows = CSV_LIMITS.rows) {
  const width = Math.max(0, ...lines.map((line) => line.length));
  const head = header ? (lines[0] ?? []) : [];
  const body = header ? lines.slice(1) : lines;
  const columns = Array.from({ length: width }, (_, i) => columnName(head[i]) || defaultName(i));
  const rows = body
    .slice(0, maxRows)
    .map((line) => Array.from({ length: width }, (_, i) => unguard(line[i] ?? '')));
  return { columns, rows, moreRows: body.length > maxRows };
}
