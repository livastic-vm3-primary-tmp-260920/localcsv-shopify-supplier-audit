/* LocalCSV Lab: pure browser/Node data tools. No upload, tracking, or ads. */
export const MAX_INPUT_CHARS = 2_000_000;

function guardInput(text) {
  if (typeof text !== 'string') throw new TypeError('Input must be text.');
  if (text.length > MAX_INPUT_CHARS) throw new Error('File exceeds the 2-million-character safety limit.');
}
export function parseCSV(text, delimiter = ',') {
  guardInput(text);
  if (!['\t', ',', ';'].includes(delimiter)) throw new Error('Unsupported delimiter.');
  text = text.replace(/^\uFEFF/, '');
  if (text.length === 0) return [];
  const rows = [];
  let row = [], cell = '', quoted = false, quoteClosed = false;
  const endCell = () => { row.push(cell); cell = ''; quoteClosed = false; };
  const endRow = () => { endCell(); rows.push(row); row = []; };
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (quoted) {
      if (ch === '"') {
        if (text[i + 1] === '"') { cell += '"'; i++; }
        else { quoted = false; quoteClosed = true; }
      } else cell += ch;
      continue;
    }
    if (quoteClosed) {
      if (ch === delimiter) { endCell(); continue; }
      if (ch === '\r' || ch === '\n') {
        endRow();
        if (ch === '\r' && text[i + 1] === '\n') i++;
        continue;
      }
      if (ch === ' ' || ch === '\t') continue;
      throw new Error('Unexpected character after a closing quote near position ' + (i + 1));
    }
    if (ch === '"' && cell === '') { quoted = true; continue; }
    if (ch === '"') throw new Error('Unexpected quote near position ' + (i + 1));
    if (ch === delimiter) { endCell(); continue; }
    if (ch === '\r' || ch === '\n') {
      endRow();
      if (ch === '\r' && text[i + 1] === '\n') i++;
      continue;
    }
    cell += ch;
  }
  if (quoted) throw new Error('Unclosed quoted CSV field.');
  if (row.length > 0 || cell !== '' || quoteClosed) endRow();
  return rows;
}
export function detectDelimiter(text) {
  guardInput(text);
  // Count separators in the first unquoted record only.
  let quoted = false;
  const counts = { ',': 0, ';': 0, '\t': 0 };
  for (let i = 0; i < Math.min(text.length, 5000); i++) {
    const ch = text[i];
    if (ch === '"') {
      if (quoted && text[i + 1] === '"') { i++; continue; }
      quoted = !quoted;
    } else if (!quoted && (ch === '\r' || ch === '\n')) break;
    else if (!quoted && Object.hasOwn(counts, ch)) counts[ch]++;
  }
  return Object.entries(counts).sort((a, b) => b[1] - a[1])[0][0];
}
export function stringifyCSV(rows, delimiter = ',', protectSpreadsheet = true) {
  if (!['\t', ',', ';'].includes(delimiter)) throw new Error('Unsupported delimiter.');
  return rows.map((row, rowIndex) => row.map(value => {
    let s = String(value ?? '');
    // Spreadsheet programs can interpret formulas as executable content.
    if (protectSpreadsheet && /^[\s]*[=+\-@\uFF1D\uFF0B\uFF0D\uFF20]/.test(s)) s = "'" + s;
    if (s.includes('"') || s.includes('\n') || s.includes('\r') || s.includes(delimiter)) {
      s = '"' + s.replaceAll('"', '""') + '"';
    }
    return s;
  }).join(delimiter)).join('\r\n');
}
export function deduplicateCSV(rows, { column = -1, header = true, caseSensitive = false } = {}) {
  if (!rows.length) return { rows: [], removed: 0, kept: 0 };
  if (!Number.isInteger(column) || column < -1 ||
      (column >= 0 && column >= (rows[0]?.length ?? 0))) {
    throw new Error('Selected CSV duplicate-match column is not present in the first record.');
  }
  const start = header ? 1 : 0;
  const result = header ? [rows[0]] : [];
  const seen = new Set();
  let removed = 0;
  let blankKeyRows = 0;
  for (let i = start; i < rows.length; i++) {
    const row = rows[i];
    if (column >= 0 && String(row[column] ?? '').trim() === '') {
      // Blank email/SKU/customer-ID values are not unique identifiers.
      // Never discard unrelated records just because these keys are blank.
      blankKeyRows++;
      result.push(row);
      continue;
    }
    const parts = column >= 0 ? [row[column] ?? ''] : row;
    const key = JSON.stringify(parts.map(v => caseSensitive ? String(v).trim() : String(v).trim().toLocaleLowerCase('en')));
    if (seen.has(key)) { removed++; continue; }
    seen.add(key);
    result.push(row);
  }
  return { rows: result, removed, kept: result.length - start, blankKeyRows };
}
export function cleanCSV(rows, { trim = true, removeBlank = true, collapseSpaces = false } = {}) {
  let removed = 0, changed = 0;
  const result = [];
  for (const row of rows) {
    const mapped = row.map(value => {
      let out = String(value);
      if (trim) out = out.trim();
      if (collapseSpaces) out = out.replace(/[ \t]+/g, ' ');
      if (out !== value) changed++;
      return out;
    });
    if (removeBlank && mapped.every(v => v === '')) { removed++; continue; }
    result.push(mapped);
  }
  return { rows: result, removed, changed };
}
export function csvToJSON(rows, { header = true } = {}) {
  if (!rows.length) return [];
  const colCount = Math.max(...rows.map(r => r.length));
  let keys = [];
  if (header) {
    const counts = new Map();
    for (let i = 0; i < colCount; i++) {
      const raw = String(rows[0][i] ?? '').trim() || 'column_' + (i + 1);
      const number = (counts.get(raw) ?? 0) + 1;
      counts.set(raw, number);
      keys.push(number === 1 ? raw : raw + '_' + number);
    }
    // Resolve edge cases where a renamed duplicate conflicts with a real column.
    const used = new Set();
    keys = keys.map((k) => {
      let candidate = k, suffix = 2;
      while (used.has(candidate)) candidate = k + '_' + suffix++;
      used.add(candidate);
      return candidate;
    });
  } else keys = Array.from({ length: colCount }, (_, i) => 'column_' + (i + 1));
  return rows.slice(header ? 1 : 0).map(row => {
    const obj = Object.create(null);
    keys.forEach((key, i) => { obj[key] = row[i] ?? ''; });
    return obj;
  });
}
export function formatJSON(input, compact = false) {
  guardInput(input);
  const parsed = JSON.parse(input);
  return JSON.stringify(parsed, null, compact ? 0 : 2);
}

/* Convert a flat array of objects into CSV. Preserves column ordering by the
   first appearance of each field and converts nested data to JSON strings.
   Protects both headers and data values against spreadsheet formula execution. */
export function jsonToCSV(text, { delimiter = ',', protectSpreadsheet = true } = {}) {
  guardInput(text);
  const records = JSON.parse(text);
  if (!Array.isArray(records)) throw new Error('JSON must be an array of objects.');
  if (!records.length) throw new Error('The JSON array contains no records to convert.');
  if (records.length > 10000) throw new Error('Maximum 10,000 records per conversion.');
  const keys = [];
  const known = new Set();
  for (const [rowIndex, record] of records.entries()) {
    if (!record || Array.isArray(record) || typeof record !== 'object') {
      throw new Error('Every array item must be a JSON object. Invalid record at position ' + (rowIndex + 1) + '.');
    }
    for (const key of Object.keys(record)) {
      if (!known.has(key)) {
        known.add(key);
        keys.push(key);
        if (keys.length > 200) throw new Error('Maximum 200 unique fields per conversion.');
      }
    }
  }
  if (!keys.length) throw new Error('All records are empty objects with no field names.');
  const safeHeaders = keys.map(key => protectSpreadsheet && /^[\s]*[=+\-@]/.test(key) ? "'" + key : key);
  const rows = [safeHeaders];
  for (const record of records) {
    rows.push(keys.map(key => {
      const val = Object.hasOwn(record, key) ? record[key] : '';
      if (val === null || val === undefined) return '';
      if (typeof val === 'object') return JSON.stringify(val);
      return String(val);
    }));
  }
  return {
    text: stringifyCSV(rows, delimiter, protectSpreadsheet),
    rows,
    recordCount: records.length,
    columnCount: keys.length
  };
}
