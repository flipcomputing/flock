const FORMULA_START = /^[=+\-@\t\r\n]/;

function csvField(value) {
  if (value === null || value === undefined) return '';
  let text = String(value);
  if (typeof value === 'string' && FORMULA_START.test(text)) text = `'${text}`;
  return /[",\r\n]/.test(text) ? `"${text.replaceAll('"', '""')}"` : text;
}

export function tableToCsv(columns, rows) {
  const lines = [columns, ...rows].map((row) => columns.map((_, i) => csvField(row[i])).join(','));
  return `${lines.join('\r\n')}\r\n`;
}

export function csvFileName(tableName) {
  const base = String(tableName ?? '')
    .replace(/[\p{Cc}\\/:*?"<>|]/gu, '')
    .trim()
    .slice(0, 50);
  return `${base || 'table'}.csv`;
}
