import { useState } from 'react';
import { BULK_UNIFIED_HEADERS } from '../data/propertyBulkCsv.js';
import { rowToUnifiedInput } from '../services/bulk/mapUnifiedBulkRow.js';
import { retryBulkPropertyRow } from '../services/bulk/bulkPropertyImportService.js';
import { MoneyInput } from './MoneyInput.jsx';
import { BTN_SIZE } from '../theme/buttonLayout.js';

const C = {
  surf2: '#F8F9FB',
  bdr: '#E8EAED',
  tx: '#0F172A',
  txM: '#64748B',
  brand: '#C8102E',
  err: '#DC2626',
};

const EDITABLE_KEYS = BULK_UNIFIED_HEADERS;

const MONEY_BULK_KEYS = new Set([
  '금액(매매가 또는 보증금)',
  '월세',
  '권리금',
  '관리비',
  '면적(평)',
]);

const inp = {
  width: '100%',
  minWidth: 72,
  height: 32,
  padding: '0 8px',
  fontSize: 12,
  border: `1px solid ${C.bdr}`,
  borderRadius: 6,
  boxSizing: 'border-box',
};

/**
 * @param {{
 *   failedItems: { rowIndex: number, error: string, row: Record<string, string> }[],
 *   onRetrySuccess: (rowIndex: number, reportKey?: string) => void,
 *   onUpdateItem: (rowIndex: number, row: Record<string, string>) => void,
 * }} props
 */
export function BulkFailedRetryTable({ failedItems, onRetrySuccess, onUpdateItem }) {
  const [retryBusy, setRetryBusy] = useState(null);
  const [retryError, setRetryError] = useState('');

  const updateField = (rowIndex, key, value) => {
    const item = failedItems.find((f) => f.rowIndex === rowIndex);
    if (!item) return;
    const base = rowToUnifiedInput(item.row);
    const next = { ...base, [key]: value, _rowIndex: String(rowIndex) };
    onUpdateItem(rowIndex, next);
  };

  const handleRetry = async (item) => {
    setRetryBusy(item.rowIndex);
    setRetryError('');
    try {
      const input = rowToUnifiedInput(item.row);
      input._rowIndex = String(item.rowIndex);
      const result = await retryBulkPropertyRow(input);
      onRetrySuccess(item.rowIndex, result.reportKey);
    } catch (err) {
      setRetryError(err?.message || '재등록 실패');
    } finally {
      setRetryBusy(null);
    }
  };

  if (!failedItems.length) return null;

  return (
    <div style={{ marginTop: 16 }}>
      <div style={{ fontSize: 14, fontWeight: 700, color: C.tx, marginBottom: 8 }}>
        실패 항목 수정 · 재등록
      </div>
      <p style={{ fontSize: 12, color: C.txM, margin: '0 0 12px', lineHeight: 1.55 }}>
        아래에서 데이터를 수정한 뒤 [재등록]을 누르면 해당 행만 다시 처리됩니다.
      </p>
      {retryError && (
        <div style={{ fontSize: 12, color: C.err, marginBottom: 10 }}>{retryError}</div>
      )}
      <div style={{ overflowX: 'auto', border: `1px solid ${C.bdr}`, borderRadius: 8 }}>
        <table className="tbl" style={{ fontSize: 12, minWidth: 960 }}>
          <thead style={{ background: C.surf2 }}>
            <tr>
              <th style={{ width: 48, background: C.surf2 }}>행</th>
              {EDITABLE_KEYS.map((k) => (
                <th key={k} style={{ background: C.surf2, whiteSpace: 'nowrap' }}>{k}</th>
              ))}
              <th style={{ width: 140, background: C.surf2 }}>실패 사유</th>
              <th style={{ width: 80, background: C.surf2 }}>재등록</th>
            </tr>
          </thead>
          <tbody>
            {failedItems.map((item) => {
              const input = rowToUnifiedInput(item.row);
              return (
                <tr key={item.rowIndex}>
                  <td style={{ fontWeight: 600, textAlign: 'center' }}>{item.rowIndex}</td>
                  {EDITABLE_KEYS.map((key) => (
                    <td key={key}>
                      {MONEY_BULK_KEYS.has(key) ? (
                        <MoneyInput
                          style={inp}
                          value={input[key] ?? item.row[key] ?? ''}
                          onChange={(e) => updateField(item.rowIndex, key, e.target.value)}
                        />
                      ) : (
                        <input
                          className="inp"
                          style={inp}
                          value={input[key] ?? item.row[key] ?? ''}
                          onChange={(e) => updateField(item.rowIndex, key, e.target.value)}
                        />
                      )}
                    </td>
                  ))}
                  <td style={{ color: C.err, fontSize: 11, lineHeight: 1.4 }}>{item.error}</td>
                  <td style={{ textAlign: 'center' }}>
                    <button
                      type="button"
                      disabled={retryBusy === item.rowIndex}
                      onClick={() => handleRetry(item)}
                      style={{
                        height: BTN_SIZE.sm.height, padding: `0 ${BTN_SIZE.sm.padX}px`, borderRadius: BTN_SIZE.sm.borderRadius, border: 'none',
                        background: C.brand, color: '#fff', fontWeight: 600, fontSize: 11,
                        cursor: retryBusy === item.rowIndex ? 'not-allowed' : 'pointer',
                        opacity: retryBusy === item.rowIndex ? 0.7 : 1,
                      }}
                    >
                      {retryBusy === item.rowIndex ? '…' : '재등록'}
                    </button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export default BulkFailedRetryTable;
