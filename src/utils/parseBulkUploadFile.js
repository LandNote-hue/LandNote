import * as XLSX from 'xlsx';
import { parseCsv } from './csvParse.js';
import { detectBulkCsvHeaders, stripBulkPropertyNoColumn } from '../data/propertyBulkCsv.js';
import { bulkRowsFromMatrix } from '../services/bulk/mapUnifiedBulkRow.js';

export const BULK_UPLOAD_ACCEPT =
  '.csv,.xlsx,.xls,text/csv,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,application/vnd.ms-excel';

/**
 * @param {File | null | undefined} file
 */
export function isBulkUploadFile(file) {
  if (!file?.name) return false;
  const name = file.name.toLowerCase();
  if (name.endsWith('.csv') || name.endsWith('.xlsx') || name.endsWith('.xls')) return true;
  const type = file.type || '';
  return type.includes('csv')
    || type.includes('spreadsheet')
    || type === 'application/vnd.ms-excel';
}

/**
 * @param {File} file
 */
function readFileAsText(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result || ''));
    reader.onerror = () => reject(new Error('파일을 읽지 못했습니다.'));
    reader.readAsText(file, 'UTF-8');
  });
}

/**
 * @param {File} file
 */
function readFileAsArrayBuffer(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = () => reject(new Error('파일을 읽지 못했습니다.'));
    reader.readAsArrayBuffer(file);
  });
}

/**
 * @param {ArrayBuffer} buffer
 * @returns {string[][]}
 */
function matrixFromXlsx(buffer) {
  const wb = XLSX.read(buffer, { type: 'array' });
  const sheetName = wb.SheetNames[0];
  if (!sheetName) throw new Error('엑셀 파일에 시트가 없습니다.');
  const sheet = wb.Sheets[sheetName];
  const raw = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: '', raw: false });
  return raw.map((row) => (Array.isArray(row) ? row : []).map((cell) => String(cell ?? '').trim()));
}

/**
 * @param {File} file
 * @returns {Promise<Record<string, string>[]>}
 */
export async function parseBulkUploadFile(file) {
  if (!file) throw new Error('파일이 없습니다.');

  const name = file.name.toLowerCase();
  const type = file.type || '';

  if (name.endsWith('.csv') || type.includes('csv')) {
    const text = await readFileAsText(file);
    const matrix = stripBulkPropertyNoColumn(parseCsv(text));
    const headers = detectBulkCsvHeaders(matrix);
    return bulkRowsFromMatrix(matrix, headers);
  }

  if (
    name.endsWith('.xlsx')
    || name.endsWith('.xls')
    || type.includes('spreadsheet')
    || type === 'application/vnd.ms-excel'
  ) {
    const buffer = await readFileAsArrayBuffer(file);
    const matrix = stripBulkPropertyNoColumn(matrixFromXlsx(buffer));
    const headers = detectBulkCsvHeaders(matrix);
    return bulkRowsFromMatrix(matrix, headers);
  }

  throw new Error('CSV 또는 Excel(.xlsx) 파일만 업로드할 수 있습니다.');
}
