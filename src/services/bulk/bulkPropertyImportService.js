import { addProperty } from '../../db.js';
import {
  BULK_MAX_ROWS,
  BULK_CHUNK_SIZE,
} from '../../data/propertyBulkCsv.js';
import { parseCsv } from '../../utils/csvParse.js';
import { parseBulkUploadFile } from '../../utils/parseBulkUploadFile.js';
import { enrichBulkPropertyRow } from './enrichBulkPropertyRow.js';
import { normalizeBulkRow, bulkRowsFromMatrix } from './mapUnifiedBulkRow.js';
import { detectBulkCsvHeaders, stripBulkPropertyNoColumn } from '../../data/propertyBulkCsv.js';

const BULK_API = '/api/properties/bulk-import';

let propertyBulkImportInFlight = false;

/**
 * @typedef {{ rowIndex: number, success: boolean, error?: string, propertyId?: number, reportKey?: string, row?: Record<string, string> }} BulkImportResultItem
 * @typedef {{ rowIndex: number, error: string, row: Record<string, string> }} BulkFailedItem
 */

/** @param {number} count */
export function bulkMaxRowsExceededMessage(count) {
  return `대량 등록은 시스템 안정성을 위해 1회 최대 ${BULK_MAX_ROWS}건까지만 가능합니다. 현재 파일은 ${count}건이므로 파일을 나누어 업로드해 주세요.`;
}

/**
 * @param {BulkImportResultItem[]} failures
 * @returns {BulkFailedItem[]}
 */
export function failuresToFailedItems(failures) {
  return failures
    .filter((f) => !f.success && f.row)
    .map((f) => ({
      rowIndex: f.rowIndex,
      error: f.error || '처리 실패',
      row: { ...f.row },
    }));
}

/**
 * @param {Record<string, string>} row
 */
function rowToServerPayload(row, fallbackIndex) {
  const normalized = normalizeBulkRow(row);
  const u = normalized._unified || {};
  return {
    rowIndex: Number(normalized._rowIndex || row._rowIndex) || fallbackIndex,
    address: normalized['주소(필수)'] || '',
    detailAddress: normalized['상세주소(동호수)'] || '',
    propertyType: normalized['매물유형'] || '',
    tradeType: normalized['거래유형'] || '',
    priceManwon: normalized['가격(만원)'] || '',
    depositManwon: normalized['보증금(월세)'] || '',
    monthlyRentManwon: u.monthlyRentManwon || '',
    premiumManwon: u.premiumManwon || '',
    maintenanceManwon: u.maintenanceManwon || '',
    areaPyeong: u.areaPyeong || '',
    notes: normalized['특이사항'] || '',
    reportKey: u.reportKey || '',
  };
}

/**
 * @param {Record<string, string>} row
 * @param {number} rowIndex
 */
async function processRowClient(row, rowIndex) {
  const normalized = normalizeBulkRow(row);
  const property = await enrichBulkPropertyRow(normalized);
  const id = await addProperty(property);
  return {
    rowIndex,
    success: true,
    propertyId: id,
    reportKey: normalized._unified?.reportKey,
  };
}

/**
 * @param {Record<string, string>[]} chunk
 * @param {number} startIndex
 */
async function processChunkViaServer(chunk, startIndex) {
  const payload = chunk.map((row, i) => rowToServerPayload(
    row,
    startIndex + i + 2,
  ));

  const res = await fetch(BULK_API, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ rows: payload }),
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err?.message || `서버 오류 (${res.status})`);
  }

  const data = await res.json();
  /** @type {BulkImportResultItem[]} */
  const results = [];

  for (const item of data.results || []) {
    if (item.success && item.property) {
      try {
        const id = await addProperty(item.property);
        results.push({
          rowIndex: item.rowIndex,
          success: true,
          propertyId: id,
          reportKey: item.reportKey,
        });
      } catch (err) {
        results.push({
          rowIndex: item.rowIndex,
          success: false,
          error: err?.message || '로컬 저장 실패',
        });
      }
    } else {
      results.push({
        rowIndex: item.rowIndex,
        success: false,
        error: item.error || '처리 실패',
      });
    }
  }
  return results;
}

/**
 * @param {Record<string, string>[]} chunk
 * @param {number} startIndex
 */
async function processChunk(chunk, startIndex) {
  try {
    return await processChunkViaServer(chunk, startIndex);
  } catch (serverErr) {
    console.warn('[bulk] server fallback to client', serverErr?.message || serverErr);
    const results = [];
    for (const row of chunk) {
      const rowIndex = Number(row._rowIndex) || startIndex + results.length + 2;
      try {
        const item = await processRowClient(row, rowIndex);
        results.push(item);
      } catch (err) {
        results.push({
          rowIndex,
          success: false,
          error: err?.message || '처리 실패',
        });
      }
    }
    return results;
  }
}

/**
 * @param {BulkImportResultItem[]} results
 */
function collectTypeCounts(results) {
  /** @type {Record<string, number>} */
  const counts = {};
  for (const r of results) {
    if (!r.success || !r.reportKey) continue;
    counts[r.reportKey] = (counts[r.reportKey] || 0) + 1;
  }
  return counts;
}

/**
 * @param {Record<string, string>[]} rows
 * @param {{
 *   onProgress?: (pct: number) => void,
 *   onProgressDetail?: (detail: {
 *     progressPercent: number,
 *     processedCount: number,
 *     totalRows: number,
 *     estimatedRemainingTime: number | null,
 *     startTime: number,
 *   }) => void,
 *   startTime?: number,
 * }} [opts]
 */
export async function runBulkPropertyImportFromRows(rows, opts = {}) {
  if (propertyBulkImportInFlight) {
    throw new Error('이미 일괄 등록이 진행 중입니다. 잠시 후 다시 시도해 주세요.');
  }
  propertyBulkImportInFlight = true;
  try {
  if (rows.length > BULK_MAX_ROWS) {
    throw new Error(bulkMaxRowsExceededMessage(rows.length));
  }
  if (!rows.length) {
    throw new Error('등록할 데이터 행이 없습니다.');
  }

  /** @type {BulkImportResultItem[]} */
  const failures = [];
  /** @type {BulkImportResultItem[]} */
  const successes = [];
  const total = rows.length;
  let done = 0;
  const startTime = opts.startTime ?? Date.now();

  const emitProgressDetail = (processedCount) => {
    const progressPercent = Math.min(100, Math.round((processedCount / total) * 100));
    const elapsedTime = (Date.now() - startTime) / 1000;
    const averageTimePerItem = processedCount > 0 ? elapsedTime / processedCount : 0;
    const remainingItems = total - processedCount;
    const estimatedRemainingTime = processedCount > 0
      ? Math.round(remainingItems * averageTimePerItem)
      : null;
    opts.onProgress?.(progressPercent);
    opts.onProgressDetail?.({
      progressPercent,
      processedCount,
      totalRows: total,
      estimatedRemainingTime,
      startTime,
    });
  };

  emitProgressDetail(0);

  /** @type {{ start: number, rows: Record<string, string>[] }[]} */
  const chunks = [];
  for (let i = 0; i < rows.length; i += BULK_CHUNK_SIZE) {
    chunks.push({ start: i, rows: rows.slice(i, i + BULK_CHUNK_SIZE) });
  }

  for (const { start, rows: chunk } of chunks) {
    const chunkResults = await processChunk(chunk, start);
    for (let j = 0; j < chunkResults.length; j += 1) {
      const r = chunkResults[j];
      if (r.success) {
        successes.push(r);
      } else {
        failures.push({ ...r, row: chunk[j] ? { ...chunk[j] } : undefined });
      }
    }
    done += chunk.length;
    emitProgressDetail(done);
  }

  emitProgressDetail(total);
  return {
    successCount: successes.length,
    failures,
    failedItems: failuresToFailedItems(failures),
    typeCounts: collectTypeCounts(successes),
  };
  } finally {
    propertyBulkImportInFlight = false;
  }
}

/**
 * 단건 재등록 (실패 행 수정 후)
 * @param {Record<string, string>} row
 */
export async function retryBulkPropertyRow(row) {
  const normalized = normalizeBulkRow(row);
  const rowIndex = Number(normalized._rowIndex) || 0;
  const startIndex = Math.max(0, rowIndex - 2);
  const results = await processChunk([normalized], startIndex);
  const item = results[0];
  if (!item?.success) {
    throw new Error(item?.error || '재등록 실패');
  }
  return item;
}

export async function runBulkPropertyImport(csvText, opts = {}) {
  const matrix = stripBulkPropertyNoColumn(parseCsv(csvText));
  const headers = detectBulkCsvHeaders(matrix);
  const rows = bulkRowsFromMatrix(matrix, headers);
  return runBulkPropertyImportFromRows(rows, opts);
}

export async function runBulkPropertyImportFromFile(file, opts = {}) {
  const rows = await parseBulkUploadFile(file);
  return runBulkPropertyImportFromRows(rows, opts);
}

export function readCsvFile(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result || ''));
    reader.onerror = () => reject(new Error('파일을 읽지 못했습니다.'));
    reader.readAsText(file, 'UTF-8');
  });
}

export function formatTypeCountSummary(typeCounts) {
  const parts = Object.entries(typeCounts)
    .filter(([, n]) => n > 0)
    .map(([label, n]) => `${label} ${n}건`);
  return parts.join(', ');
}

export function formatBulkImportReport(successCount, failures, typeCounts = {}) {
  const failCount = failures.length;
  const typeSummary = formatTypeCountSummary(typeCounts);

  if (failCount === 0 && successCount > 0) {
    const detail = typeSummary
      ? ` (${typeSummary}이 자동으로 구분되어 안전하게 저장되었습니다.)`
      : '';
    return `등록 완료!${detail}`;
  }

  let summary = `${successCount}건 등록 성공 / ${failCount}건 실패`;
  if (typeSummary && successCount > 0) {
    summary += ` · ${typeSummary}`;
  }
  if (failCount) {
    const reasons = [...new Set(failures.map((f) => f.error).filter(Boolean))].slice(0, 3);
    summary += ` (실패 사유: ${reasons.join(', ')})`;
  }
  return summary;
}
