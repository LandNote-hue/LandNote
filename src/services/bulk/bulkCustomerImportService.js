import { addCustomer, bulkAddCustomers, loadCustomerPhoneKeySet } from '../../db.js';
import { customerPhoneKey } from '../../utils/formatPhone.js';
import { CUSTOMER_BULK_MAX_ROWS } from '../../data/customerBulkCsv.js';
import { parseCustomerBulkFile } from '../../utils/parseCustomerBulkFile.js';
import {
  parseCustomerBulkRow,
  rowToCustomerBulkInput,
  CUSTOMER_TYPE_REPORT,
} from './mapCustomerBulkRow.js';

/**
 * @typedef {{ rowIndex: number, error: string, row: Record<string, string> }} CustomerBulkFailedItem
 */

/** @param {number} count */
export function customerBulkMaxRowsExceededMessage(count) {
  return `고객 일괄 등록은 안정적인 데이터 정제를 위해 1회 최대 ${CUSTOMER_BULK_MAX_ROWS}건까지 가능합니다. 현재 파일은 ${count}건입니다.`;
}

/**
 * @param {number} successCount
 * @param {CustomerBulkFailedItem[]} failures
 * @param {Record<string, number>} [typeCounts]
 */
export function formatCustomerBulkImportReport(successCount, failures, typeCounts = {}) {
  const failCount = failures.length;
  if (successCount === 0 && failCount === 0) return '등록할 데이터가 없습니다.';
  const parts = [`총 ${successCount}명 등록 완료`];
  if (failCount > 0) parts.push(`${failCount}건 실패`);
  const typeSummary = Object.entries(typeCounts)
    .filter(([, n]) => n > 0)
    .map(([k, n]) => `${k} ${n}명`)
    .join(', ');
  if (typeSummary) parts.push(`(${typeSummary})`);
  return parts.join(' · ');
}

/** @param {CustomerBulkFailedItem[]} failures */
export function failuresToCustomerFailedItems(failures) {
  return failures.map((f) => ({
    rowIndex: f.rowIndex,
    error: f.error,
    row: { ...f.row },
  }));
}

/** @param {Record<string, unknown>[]} customers */
function countCustomerTypes(customers) {
  /** @type {Record<string, number>} */
  const counts = {};
  customers.forEach((c) => {
    const types = Array.isArray(c.customer_types) && c.customer_types.length
      ? c.customer_types
      : c.type ? [c.type] : [];
    types.forEach((t) => {
      const key = CUSTOMER_TYPE_REPORT[t] || String(t || '기타');
      counts[key] = (counts[key] || 0) + 1;
    });
  });
  return counts;
}

/** @param {Record<string, string>[]} rows
 * @param {{ onProgress?: (pct: number) => void }} [opts]
 */
let customerBulkImportInFlight = false;

export async function runBulkCustomerImportFromRows(rows, opts = {}) {
  if (customerBulkImportInFlight) {
    throw new Error('이미 일괄 등록이 진행 중입니다. 잠시 후 다시 시도해 주세요.');
  }
  customerBulkImportInFlight = true;
  const { onProgress } = opts;
  try {
  onProgress?.(5);

  if (rows.length > CUSTOMER_BULK_MAX_ROWS) {
    throw new Error(customerBulkMaxRowsExceededMessage(rows.length));
  }

  const existingPhoneKeys = await loadCustomerPhoneKeySet();
  /** @type {Set<string>} */
  const batchPhoneKeys = new Set();

  /** @type {Record<string, unknown>[]} */
  const validCustomers = [];
  /** @type {CustomerBulkFailedItem[]} */
  const failures = [];

  rows.forEach((row, i) => {
    const rowIndex = i + 2;
    const parsed = parseCustomerBulkRow(row, rowIndex);
    if (!parsed.ok || !parsed.customer) {
      failures.push({
        rowIndex,
        error: parsed.error || '처리 실패',
        row: parsed.row || rowToCustomerBulkInput(row),
      });
      return;
    }

    const phoneKey = customerPhoneKey(String(parsed.customer.phone || ''));
    if (existingPhoneKeys.has(phoneKey)) {
      failures.push({
        rowIndex,
        error: '이미 등록된 연락처',
        row: parsed.row || rowToCustomerBulkInput(row),
      });
      return;
    }
    if (batchPhoneKeys.has(phoneKey)) {
      failures.push({
        rowIndex,
        error: '파일 내 연락처 중복',
        row: parsed.row || rowToCustomerBulkInput(row),
      });
      return;
    }

    batchPhoneKeys.add(phoneKey);
    validCustomers.push(parsed.customer);
  });

  onProgress?.(40);

  let successCount = 0;
  /** @type {Record<string, number>} */
  let typeCounts = {};

  if (validCustomers.length > 0) {
    await bulkAddCustomers(validCustomers);
    successCount = validCustomers.length;
    typeCounts = countCustomerTypes(validCustomers);
  }

  onProgress?.(100);

  return {
    successCount,
    failures,
    failedItems: failuresToCustomerFailedItems(failures),
    typeCounts,
  };
  } finally {
    customerBulkImportInFlight = false;
  }
}

/**
 * @param {File} file
 * @param {{ onProgress?: (pct: number) => void }} [opts]
 */
export async function runBulkCustomerImportFromFile(file, opts = {}) {
  const rows = await parseCustomerBulkFile(file);
  return runBulkCustomerImportFromRows(rows, opts);
}

/** @param {Record<string, string>} row */
export async function retryBulkCustomerRow(row) {
  const rowIndex = Number(row._rowIndex) || 0;
  const parsed = parseCustomerBulkRow(row, rowIndex);
  if (!parsed.ok || !parsed.customer) {
    throw new Error(parsed.error || '유효하지 않은 데이터입니다.');
  }
  const id = await addCustomer(parsed.customer);
  return { id, reportKey: parsed.reportKey };
}

export function formatCustomerTypeCountSummary(typeCounts) {
  const entries = Object.entries(typeCounts || {}).filter(([, n]) => n > 0);
  if (!entries.length) return '';
  return entries.map(([k, n]) => `${k} ${n}명`).join(' · ');
}
