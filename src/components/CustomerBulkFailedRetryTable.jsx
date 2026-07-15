import { useState } from 'react';
import { CUSTOMER_TYPE_HEADER } from '../utils/customerTypes.js';
import { CUSTOMER_BULK_HEADERS } from '../data/customerBulkCsv.js';
import { rowToCustomerBulkInput } from '../services/bulk/mapCustomerBulkRow.js';
import { retryBulkCustomerRow } from '../services/bulk/bulkCustomerImportService.js';
import { PhoneInput } from './PhoneInput.jsx';
import { BTN_SIZE } from '../theme/buttonLayout.js';

const C = {
  surf2: '#F8F9FB',
  bdr: '#E8EAED',
  tx: '#0F172A',
  txM: '#64748B',
  brand: '#C8102E',
  err: '#DC2626',
};

const EDITABLE_KEYS = ['고객명', '회사', '연락처', '주소', CUSTOMER_TYPE_HEADER, '진행상태'];

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
export function CustomerBulkFailedRetryTable({ failedItems, onRetrySuccess, onUpdateItem }) {
  const [retryBusy, setRetryBusy] = useState(null);
  const [retryError, setRetryError] = useState('');

  const updateField = (rowIndex, key, value) => {
    const item = failedItems.find((f) => f.rowIndex === rowIndex);
    if (!item) return;
    const base = rowToCustomerBulkInput(item.row);
    const next = { ...base, [key]: value, _rowIndex: String(rowIndex) };
    onUpdateItem(rowIndex, next);
  };

  const handleRetry = async (item) => {
    setRetryBusy(item.rowIndex);
    setRetryError('');
    try {
      const input = rowToCustomerBulkInput(item.row);
      input._rowIndex = String(item.rowIndex);
      const result = await retryBulkCustomerRow(input);
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
        고객 등록 실패 내역
      </div>
      <p style={{ fontSize: 12, color: C.txM, margin: '0 0 12px', lineHeight: 1.55 }}>
        고객명·회사·연락처·고객구분 등을 수정한 뒤 [재등록]을 누르면 해당 행만 다시 등록됩니다.
      </p>
      {retryError && (
        <div style={{ fontSize: 12, color: C.err, marginBottom: 10 }}>{retryError}</div>
      )}
      <div style={{ overflowX: 'auto', border: `1px solid ${C.bdr}`, borderRadius: 8 }}>
        <table className="tbl" style={{ fontSize: 12, minWidth: 640 }}>
          <thead style={{ background: C.surf2 }}>
            <tr>
              <th style={{ width: 48, background: C.surf2 }}>행</th>
              {EDITABLE_KEYS.map((k) => (
                <th key={k} style={{ background: C.surf2, whiteSpace: 'nowrap' }}>{k}</th>
              ))}
              <th style={{ width: 180, background: C.surf2 }}>실패 사유</th>
              <th style={{ width: 80, background: C.surf2 }}>작업</th>
            </tr>
          </thead>
          <tbody>
            {failedItems.map((item) => {
              const input = rowToCustomerBulkInput(item.row);
              return (
                <tr key={item.rowIndex}>
                  <td style={{ fontWeight: 600, textAlign: 'center' }}>{item.rowIndex}</td>
                  {EDITABLE_KEYS.map((key) => (
                    <td key={key}>
                      {key === '연락처' ? (
                        <PhoneInput
                          style={{ ...inp, minWidth: 72 }}
                          value={input[key] ?? ''}
                          onChange={(e) => updateField(item.rowIndex, key, e.target.value)}
                        />
                      ) : (
                        <input
                          className="inp"
                          style={{ ...inp, minWidth: key === CUSTOMER_TYPE_HEADER ? 120 : 72 }}
                          value={input[key] ?? ''}
                          onChange={(e) => updateField(item.rowIndex, key, e.target.value)}
                          placeholder={key === CUSTOMER_TYPE_HEADER ? '매수/매도' : key === '진행상태' ? '진행중·보류·완료' : undefined}
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
      <div style={{ fontSize: 11, color: C.txM, marginTop: 8 }}>
        고객구분은 콤마·슬래시로 복수 입력 가능합니다 (예: 매도,매수 · 매수/임차). 진행상태는 진행중·보류·완료(비우면 진행중). 희망매물 등 다른 열은 CSV 수정 후 다시 업로드하세요.
      </div>
    </div>
  );
}

export default CustomerBulkFailedRetryTable;
