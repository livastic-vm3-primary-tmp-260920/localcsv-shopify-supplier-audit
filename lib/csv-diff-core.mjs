/* Compare two local CSV exports by a selected unique business key.
 * Pure function: no network, no storage, no ad interactions. */
import { parseCSV, detectDelimiter, stringifyCSV, MAX_INPUT_CHARS } from './csv-core.mjs';

const MAX_RECORDS = 20000;
const MAX_COLUMNS = 200;
const MAX_CHANGES = 40000;
const HEADERS = ['action','key','field','before','after','previous_csv_row','current_csv_row','note'];

export function readCSVForComparison(text, label = 'CSV') {
  if (typeof text !== 'string') throw new Error(label + ': CSV input must be text.');
  if (text.length > MAX_INPUT_CHARS) throw new Error(label + ': maximum size is 2 million characters.');
  if (!text.trim()) throw new Error(label + ': paste a CSV or choose a file.');
  const delimiter = detectDelimiter(text);
  const rows = parseCSV(text, delimiter);
  if (!rows.length) throw new Error(label + ': no CSV header row.');
  const headers = rows[0].map(cell => cell.trim());
  if (!headers.length || headers.some(name => !name)) throw new Error(label + ': every header must have a name.');
  if (headers.length > MAX_COLUMNS) throw new Error(label + ': more than 200 columns.');
  if (new Set(headers).size !== headers.length) throw new Error(label + ': repeated column headings; rename duplicates first.');
  const records = [];
  let skippedBlank = 0;
  rows.slice(1).forEach((cells, index) => {
    if (cells.length === 1 && !cells[0].trim()) { skippedBlank++; return; }
    if (cells.length !== headers.length) {
      throw new Error(label + ': CSV row ' + (index + 2) + ' contains ' + cells.length + ' fields; expected ' + headers.length + '.');
    }
    records.push({ rowNumber: index + 2, fields: Object.fromEntries(headers.map((name, i) => [name, cells[i]])) });
  });
  if (records.length > MAX_RECORDS) throw new Error(label + ': more than 20,000 data rows.');
  return { headers, records, delimiter, skippedBlank };
}

export function commonCSVKeys(previousText, currentText) {
  const previous = readCSVForComparison(previousText, 'Previous');
  const current = readCSVForComparison(currentText, 'Current');
  const shared = previous.headers.filter(key => current.headers.includes(key));
  if (!shared.length) throw new Error('The two CSV files have no exactly matching header name.');
  const priority = ['id','sku','email','order id','order_id','handle','customer id'];
  const suggested = priority.map(candidate => shared.find(x => x.toLowerCase() === candidate)).find(Boolean) || shared[0];
  return { shared, suggested };
}

function indexRows(dataset, field, caseSensitive, label) {
  const index = new Map();
  const normalize = value => caseSensitive ? String(value).trim() : String(value).trim().toLocaleLowerCase('en');
  for (const record of dataset.records) {
    const key = normalize(record.fields[field]);
    if (!key) throw new Error(label + ': empty key in CSV row ' + record.rowNumber + '. Fill missing keys first.');
    if (index.has(key)) {
      throw new Error(label + ': duplicate key at CSV rows ' + index.get(key).rowNumber + ' and ' + record.rowNumber + '. Select a genuinely unique key.');
    }
    index.set(key, record);
  }
  return index;
}

export function compareCSVExports(previousText, currentText, { key, caseSensitive = true } = {}) {
  const previous = readCSVForComparison(previousText, 'Previous');
  const current = readCSVForComparison(currentText, 'Current');
  const shared = previous.headers.filter(name => current.headers.includes(name));
  if (!shared.length) throw new Error('No matching column headings between the files.');
  const chosen = key ?? commonCSVKeys(previousText, currentText).suggested;
  if (!shared.includes(chosen)) throw new Error('Choose a key column found in both CSV files.');
  const before = indexRows(previous, chosen, caseSensitive, 'Previous');
  const after = indexRows(current, chosen, caseSensitive, 'Current');
  const beforeNames = new Set(previous.headers);
  const afterNames = new Set(current.headers);
  const allNames = [...previous.headers, ...current.headers.filter(name => !beforeNames.has(name))];
  const onlyPrevious = previous.headers.filter(name => !afterNames.has(name));
  const onlyCurrent = current.headers.filter(name => !beforeNames.has(name));
  const audit = [HEADERS];
  const metrics = {
    previous: previous.records.length, current: current.records.length,
    added: 0, removed: 0, changed: 0, unchanged: 0, changedCells: 0,
    beforeOnlyColumns: onlyPrevious, afterOnlyColumns: onlyCurrent,
    ignoredBlankRows: previous.skippedBlank + current.skippedBlank
  };
  const append = (action, originalKey, field, oldVal, newVal, oldRow, newRow, note = '') => {
    if (audit.length > MAX_CHANGES) throw new Error('More than 40,000 field changes. Split the exports into smaller files.');
    audit.push([action, originalKey, field, oldVal, newVal, oldRow || '', newRow || '', note]);
  };
  for (const [normalizedKey, record] of after) {
    const old = before.get(normalizedKey);
    const valueKey = record.fields[chosen];
    if (!old) {
      metrics.added++;
      for (const field of current.headers) {
        append('ADDED', valueKey, field, '', record.fields[field], '', record.rowNumber, 'new row');
      }
      continue;
    }
    let updates = 0;
    for (const field of allNames) {
      const oldValue = beforeNames.has(field) ? old.fields[field] : '';
      const newValue = afterNames.has(field) ? record.fields[field] : '';
      const schemaChanged = !beforeNames.has(field) || !afterNames.has(field);
      if (schemaChanged || oldValue !== newValue) {
        const note = schemaChanged ? (beforeNames.has(field) ? 'column only in previous CSV' : 'column only in current CSV') : '';
        append('CHANGED', valueKey, field, oldValue, newValue, old.rowNumber, record.rowNumber, note);
        updates++;
      }
    }
    if (updates) { metrics.changed++; metrics.changedCells += updates; }
    else metrics.unchanged++;
  }
  for (const [normalizedKey, record] of before) {
    if (after.has(normalizedKey)) continue;
    metrics.removed++;
    for (const field of previous.headers) {
      append('REMOVED', record.fields[chosen], field, record.fields[field], '', record.rowNumber, '', 'missing in current CSV');
    }
  }
  const warnings = [];
  if (onlyPrevious.length) warnings.push('Previous-only columns: ' + onlyPrevious.join(', ') + '. Column differences count as changes.');
  if (onlyCurrent.length) warnings.push('Current-only columns: ' + onlyCurrent.join(', ') + '. Column differences count as changes.');
  if (metrics.ignoredBlankRows) warnings.push('Ignored ' + metrics.ignoredBlankRows + ' fully blank CSV lines.');
  warnings.push('Keys are trimmed for matching; other cell values are compared exactly, including spaces and letter case.');
  warnings.push('A matching key identifies one record only. Duplicate or blank keys are rejected instead of guessed.');
  const csv = '\uFEFF' + stringifyCSV(audit, ',', true);
  return { csv, metrics, warnings, previewRows: audit.slice(0, 13), key: chosen, reportLines: audit.length - 1 };
}
