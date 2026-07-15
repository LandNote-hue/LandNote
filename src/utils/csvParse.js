/**
 * 간단 CSV 파서 (따옴표·쉼표 이스케이프 지원)
 * @param {string} text
 * @returns {string[][]}
 */
export function parseCsv(text) {
  const src = String(text || '').replace(/^\uFEFF/, '');
  /** @type {string[][]} */
  const rows = [];
  /** @type {string[]} */
  let row = [];
  let cell = '';
  let inQuotes = false;

  for (let i = 0; i < src.length; i += 1) {
    const ch = src[i];
    const next = src[i + 1];
    if (inQuotes) {
      if (ch === '"' && next === '"') {
        cell += '"';
        i += 1;
      } else if (ch === '"') {
        inQuotes = false;
      } else {
        cell += ch;
      }
      continue;
    }
    if (ch === '"') {
      inQuotes = true;
    } else if (ch === ',') {
      row.push(cell.trim());
      cell = '';
    } else if (ch === '\n' || (ch === '\r' && next === '\n')) {
      row.push(cell.trim());
      if (row.some((c) => c !== '')) rows.push(row);
      row = [];
      cell = '';
      if (ch === '\r') i += 1;
    } else if (ch !== '\r') {
      cell += ch;
    }
  }
  row.push(cell.trim());
  if (row.some((c) => c !== '')) rows.push(row);
  return rows;
}

/**
 * @param {string[][]} matrix
 * @param {string[]} expectedHeaders
 */
export function csvRowsToObjects(matrix, expectedHeaders) {
  if (!matrix.length) return [];
  const [headerRow, ...dataRows] = matrix;
  const norm = (s) => String(s || '').replace(/\s/g, '').trim();
  const headerNorm = headerRow.map(norm);
  const expectedNorm = expectedHeaders.map(norm);
  const useHeader = expectedNorm.every((h, i) => headerNorm[i] === h || headerNorm.includes(h));
  const keys = useHeader ? expectedHeaders : expectedHeaders;

  return dataRows.map((cells, idx) => {
    /** @type {Record<string, string>} */
    const obj = { _rowIndex: String(idx + 2) };
    keys.forEach((key, i) => {
      obj[key] = cells[i]?.trim() ?? '';
    });
    return obj;
  }).filter((row) => expectedHeaders.some((h) => row[h]));
}
