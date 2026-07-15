import { parseCsv } from './csvParse.js';
import {
  CUSTOMER_BULK_HEADERS,
  customerRowsFromMatrix,
  detectCustomerBulkHeaders,
} from '../data/customerBulkCsv.js';

export const CUSTOMER_BULK_UPLOAD_ACCEPT = '.csv,text/csv';

/** @param {File | null | undefined} file */
export function isCustomerBulkUploadFile(file) {
  if (!file?.name) return false;
  const name = file.name.toLowerCase();
  return name.endsWith('.csv') || (file.type || '').includes('csv');
}

/**
 * @param {File} file
 * @returns {Promise<Record<string, string>[]>}
 */
export async function parseCustomerBulkFile(file) {
  if (!file) throw new Error('파일이 없습니다.');
  if (!isCustomerBulkUploadFile(file)) {
    throw new Error('CSV 파일만 업로드할 수 있습니다.');
  }

  const text = await new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result || ''));
    reader.onerror = () => reject(new Error('파일을 읽지 못했습니다.'));
    reader.readAsText(file, 'UTF-8');
  });

  const matrix = parseCsv(text);
  if (!matrix.length) throw new Error('데이터 행이 없습니다.');
  const headers = detectCustomerBulkHeaders(matrix);
  return customerRowsFromMatrix(matrix, headers);
}

/** @type {typeof CUSTOMER_BULK_HEADERS} */
export { CUSTOMER_BULK_HEADERS };
