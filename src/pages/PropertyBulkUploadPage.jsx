import { useRef, useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  downloadUnifiedBulkCsvTemplate,
  downloadUnifiedBulkXlsxTemplate,
  BULK_MAX_ROWS,
  BULK_CHUNK_SIZE,
} from '../data/propertyBulkCsv.js';
import {
  runBulkPropertyImportFromFile,
  formatBulkImportReport,
  formatTypeCountSummary,
  bulkMaxRowsExceededMessage,
} from '../services/bulk/bulkPropertyImportService.js';
import { parseBulkUploadFile, BULK_UPLOAD_ACCEPT, isBulkUploadFile } from '../utils/parseBulkUploadFile.js';
import { consumePendingBulkFile } from '../services/bulk/bulkUploadPendingFile.js';
import { BulkFailedRetryTable } from '../components/BulkFailedRetryTable.jsx';
import { PageHeader } from '../components/PageHeader.jsx';
import { BTN_SIZE } from '../theme/buttonLayout.js';

const C = {
  surf: '#fff',
  surf2: '#F8F9FB',
  bg: '#F5F6FA',
  bdr: '#E8EAED',
  tx: '#0F172A',
  txM: '#64748B',
  brand: '#C8102E',
  brandL: '#FEF2F2',
  ok: '#16A34A',
  err: '#DC2626',
};

const MD = BTN_SIZE.md;
const LG = BTN_SIZE.lg;

/** @param {number|null|undefined} seconds @param {number} processedCount */
function formatEstimatedRemainingTime(seconds, processedCount) {
  if (!processedCount || seconds == null) return '남은 시간 계산 중...';
  const s = Math.max(0, Math.round(seconds));
  if (s === 0) return '곧 완료';
  if (s < 60) return `약 ${s}초`;
  const m = Math.floor(s / 60);
  const rem = s % 60;
  return rem > 0 ? `약 ${m}분 ${rem}초` : `약 ${m}분`;
}

/** @param {{
 *   totalRows: number,
 *   processedCount: number,
 *   progressPercent: number,
 *   estimatedRemainingTime: number | null,
 *   recentLog: { address: string, success: boolean, error?: string }[],
 * }} props */
function BulkImportProgressModal({
  totalRows,
  processedCount,
  progressPercent,
  estimatedRemainingTime,
  recentLog,
}) {
  const etaLabel = formatEstimatedRemainingTime(estimatedRemainingTime, processedCount);

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="bulk-progress-title"
      aria-busy="true"
      style={{
        position: 'fixed', inset: 0, zIndex: 1000,
        background: 'rgba(15,23,42,.45)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        padding: 20,
      }}
    >
      <div
        style={{
          background: C.surf, borderRadius: 12, padding: '28px 32px',
          maxWidth: 480, width: '100%',
          boxShadow: '0 20px 40px rgba(0,0,0,.15)',
        }}
      >
        <div id="bulk-progress-title" style={{ fontSize: 17, fontWeight: 700, color: C.tx, marginBottom: 8 }}>
          일괄 등록 진행 중
        </div>
        <div style={{ fontSize: 13, color: C.txM, marginBottom: 20, lineHeight: 1.5 }}>
          매물을 1건씩 주소·건축물대장 조회 후 순차로 등록하고 있습니다.
        </div>

        <div style={{ fontSize: 14, fontWeight: 600, color: C.tx, marginBottom: 10 }}>
          전체 {totalRows}건 중 {processedCount}건 처리됨 ({progressPercent}%)
        </div>

        <div style={{ height: 10, borderRadius: 999, background: C.surf2, overflow: 'hidden', marginBottom: 14 }}>
          <div style={{
            width: `${progressPercent}%`,
            height: '100%',
            background: C.brand,
            transition: 'width 0.3s ease',
          }}
          />
        </div>

        <div style={{ fontSize: 13, color: C.txM, marginBottom: recentLog?.length ? 16 : 0 }}>
          예상 남은 시간: <span style={{ fontWeight: 600, color: C.tx }}>{etaLabel}</span>
        </div>

        {recentLog?.length > 0 && (
          <div>
            <div style={{ fontSize: 12, fontWeight: 600, color: C.txM, marginBottom: 6 }}>최근 처리 내역</div>
            <div style={{
              background: C.surf2, borderRadius: 8, padding: '4px 12px',
              maxHeight: 140, overflowY: 'auto',
            }}>
              {recentLog.map((item, i) => (
                <div
                  key={i}
                  style={{
                    display: 'flex', alignItems: 'center', gap: 8, padding: '6px 0',
                    borderBottom: i < recentLog.length - 1 ? `1px solid ${C.bdr}` : 'none',
                    fontSize: 12,
                  }}
                >
                  <span style={{ color: item.success ? C.ok : C.err, fontWeight: 700, flexShrink: 0 }}>
                    {item.success ? '✓' : '✕'}
                  </span>
                  <span style={{
                    color: C.tx, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', flex: 1,
                  }}>
                    {item.address || '(주소 없음)'}
                  </span>
                  {!item.success && item.error && (
                    <span style={{ color: C.err, fontSize: 11, flexShrink: 0, maxWidth: 160, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {item.error}
                    </span>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

/** @param {{ report: string, successCount: number, typeCounts: Record<string, number>, failedItems: { rowIndex: number, error: string, row: Record<string, string> }[], onUpdateFailedItem: (rowIndex: number, row: Record<string, string>) => void, onRetrySuccess: (rowIndex: number, reportKey?: string) => void, onClose: () => void, onGoList: () => void }} props */
function BulkImportResultModal({
  report,
  successCount,
  typeCounts,
  failedItems,
  onUpdateFailedItem,
  onRetrySuccess,
  onClose,
  onGoList,
}) {
  const failCount = failedItems.length;
  const typeSummary = formatTypeCountSummary(typeCounts);

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="bulk-result-title"
      style={{
        position: 'fixed', inset: 0, zIndex: 1000,
        background: 'rgba(15,23,42,.45)',
        display: 'flex', alignItems: 'flex-start', justifyContent: 'center',
        padding: 20, overflow: 'auto',
      }}
      onClick={onClose}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          background: C.surf, borderRadius: 12, padding: '24px 28px',
          maxWidth: 1100, width: '100%', margin: 'auto',
          boxShadow: '0 20px 40px rgba(0,0,0,.15)',
        }}
      >
        <div id="bulk-result-title" style={{ fontSize: 17, fontWeight: 700, color: C.tx, marginBottom: 12 }}>
          일괄 등록 결과
        </div>

        <div style={{
          fontSize: 15, fontWeight: 600, lineHeight: 1.65,
          color: failCount === 0 ? C.ok : C.tx,
          marginBottom: typeSummary ? 10 : failCount ? 12 : 0,
        }}>
          {report}
        </div>

        {successCount > 0 && typeSummary && (
          <div style={{
            fontSize: 13, color: C.txM, lineHeight: 1.7,
            background: C.surf2, borderRadius: 8, padding: '12px 14px', marginBottom: failCount ? 12 : 0,
          }}>
            <div style={{ fontWeight: 600, color: C.tx, marginBottom: 6 }}>유형별 등록 내역</div>
            {typeSummary}
          </div>
        )}

        {failCount > 0 && (
          <BulkFailedRetryTable
            failedItems={failedItems}
            onUpdateItem={onUpdateFailedItem}
            onRetrySuccess={onRetrySuccess}
          />
        )}

        <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', marginTop: 16 }}>
          <button
            type="button"
            onClick={onClose}
            style={{
              height: MD.height, padding: `0 ${MD.padX}px`, borderRadius: MD.borderRadius,
              border: `1px solid ${C.bdr}`, background: C.surf, color: C.tx,
              fontWeight: 600, fontSize: MD.fontSize, cursor: 'pointer',
            }}
          >
            닫기
          </button>
          <button
            type="button"
            onClick={onGoList}
            style={{
              height: MD.height, padding: `0 ${MD.padX}px`, borderRadius: MD.borderRadius,
              border: 'none', background: C.brand, color: '#fff',
              fontWeight: 600, fontSize: MD.fontSize, cursor: 'pointer',
            }}
          >
            매물 목록으로
          </button>
        </div>
      </div>
    </div>
  );
}

/** @param {File} file */
function assignFileToInput(input, file) {
  if (!input) return;
  const dt = new DataTransfer();
  dt.items.add(file);
  input.files = dt.files;
}

/** @param {{ onNav?: (id: string) => void }} props */
export function PropertyBulkUploadPage({ onNav }) {
  const navigate = useNavigate();
  const fileRef = useRef(null);
  const importLockRef = useRef(false);
  const [fileName, setFileName] = useState('');
  const [selectedFile, setSelectedFile] = useState(null);
  const [rowCount, setRowCount] = useState(0);
  const [busy, setBusy] = useState(false);
  const [progressPercent, setProgressPercent] = useState(0);
  const [processedCount, setProcessedCount] = useState(0);
  const [totalRows, setTotalRows] = useState(0);
  const [estimatedRemainingTime, setEstimatedRemainingTime] = useState(null);
  const [startTime, setStartTime] = useState(null);
  const [recentLog, setRecentLog] = useState([]);
  const [report, setReport] = useState('');
  const [successCount, setSuccessCount] = useState(0);
  const [typeCounts, setTypeCounts] = useState({});
  const [failedItems, setFailedItems] = useState([]);
  const [showResultModal, setShowResultModal] = useState(false);
  const [error, setError] = useState('');
  const [dragActive, setDragActive] = useState(false);

  const goProperties = () => {
    if (onNav) onNav('properties');
    else navigate('/properties');
  };

  const previewFile = useCallback(async (file) => {
    setError('');
    setReport('');
    setFailedItems([]);
    setTypeCounts({});
    setShowResultModal(false);
    setProgressPercent(0);
    setProcessedCount(0);
    setTotalRows(0);
    setEstimatedRemainingTime(null);
    setStartTime(null);
    setRecentLog([]);
    if (!file) {
      setFileName('');
      setSelectedFile(null);
      setRowCount(0);
      return;
    }
    if (!isBulkUploadFile(file)) {
      setError('CSV 또는 Excel(.xlsx) 파일만 업로드할 수 있습니다.');
      setFileName('');
      setSelectedFile(null);
      setRowCount(0);
      return;
    }
    setFileName(file.name);
    setSelectedFile(file);
    try {
      const rows = await parseBulkUploadFile(file);
      setRowCount(rows.length);
      if (rows.length > BULK_MAX_ROWS) {
        const msg = bulkMaxRowsExceededMessage(rows.length);
        window.alert(msg);
        setError(msg);
      }
    } catch (err) {
      setError(err?.message || '파일 파싱 실패');
      setRowCount(0);
    }
  }, []);

  useEffect(() => {
    const pending = consumePendingBulkFile();
    if (pending) {
      assignFileToInput(fileRef.current, pending);
      previewFile(pending);
    }
  }, [previewFile]);

  const onFileChange = async (e) => {
    const file = e.target.files?.[0];
    await previewFile(file || null);
  };

  const onDragOver = (e) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(true);
  };

  const onDragLeave = (e) => {
    e.preventDefault();
    e.stopPropagation();
    if (!e.currentTarget.contains(e.relatedTarget)) setDragActive(false);
  };

  const onDrop = async (e) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    if (busy) return;
    const file = e.dataTransfer.files?.[0];
    if (!file) return;
    assignFileToInput(fileRef.current, file);
    await previewFile(file);
  };

  const startImport = async () => {
    if (importLockRef.current || busy) return;
    setError('');
    setReport('');
    setFailedItems([]);
    setTypeCounts({});
    setShowResultModal(false);
    const file = selectedFile || fileRef.current?.files?.[0];
    if (!file) {
      setError('CSV 또는 Excel 파일을 선택해 주세요.');
      return;
    }
    if (rowCount > BULK_MAX_ROWS) {
      window.alert(bulkMaxRowsExceededMessage(rowCount));
      return;
    }
    if (!rowCount) {
      setError('등록할 데이터 행이 없습니다.');
      return;
    }

    importLockRef.current = true;
    setBusy(true);
    const importStartTime = Date.now();
    setStartTime(importStartTime);
    setTotalRows(rowCount);
    setProcessedCount(0);
    setProgressPercent(0);
    setEstimatedRemainingTime(null);
    setRecentLog([]);
    try {
      const result = await runBulkPropertyImportFromFile(file, {
        startTime: importStartTime,
        onProgress: setProgressPercent,
        onProgressDetail: ({
          progressPercent: pct,
          processedCount: count,
          totalRows: total,
          estimatedRemainingTime: eta,
          lastItem,
        }) => {
          setProgressPercent(pct);
          setProcessedCount(count);
          setTotalRows(total);
          setEstimatedRemainingTime(eta);
          if (lastItem) {
            setRecentLog((prev) => [lastItem, ...prev].slice(0, 5));
          }
        },
      });
      setSuccessCount(result.successCount);
      setFailedItems(result.failedItems || []);
      setTypeCounts(result.typeCounts || {});
      const summary = formatBulkImportReport(
        result.successCount,
        result.failures,
        result.typeCounts,
      );
      setReport(summary);
      setShowResultModal(true);
    } catch (err) {
      const msg = err?.message || '일괄 등록 실패';
      if (msg.includes('500')) window.alert(msg);
      setError(msg);
    } finally {
      importLockRef.current = false;
      setBusy(false);
    }
  };

  const handleUpdateFailedItem = (rowIndex, row) => {
    setFailedItems((prev) => prev.map((f) => (
      f.rowIndex === rowIndex ? { ...f, row: { ...row } } : f
    )));
  };

  const handleRetrySuccess = (rowIndex, reportKey) => {
    setFailedItems((prev) => prev.filter((f) => f.rowIndex !== rowIndex));
    setSuccessCount((n) => n + 1);
    if (reportKey) {
      setTypeCounts((prev) => ({
        ...prev,
        [reportKey]: (prev[reportKey] || 0) + 1,
      }));
    }
  };

  useEffect(() => {
    if (!showResultModal) return;
    setReport(formatBulkImportReport(successCount, failedItems, typeCounts));
  }, [successCount, failedItems, typeCounts, showResultModal]);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', background: C.bg }}>
      <PageHeader
        title="매물 대량 일괄 등록"
        sub={`통합 양식 · 최대 ${BULK_MAX_ROWS}건/회 · 내부 ${BULK_CHUNK_SIZE}건씩 순차 처리`}
        acts={(
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            <button
              type="button"
              onClick={downloadUnifiedBulkCsvTemplate}
              style={{
                height: MD.height, padding: `0 ${MD.padX}px`, borderRadius: MD.borderRadius,
                border: `1px solid ${C.brand}`, background: C.brandL, color: C.brand,
                fontWeight: 600, fontSize: MD.fontSize, cursor: 'pointer', whiteSpace: 'nowrap',
              }}
            >
              CSV 양식 다운로드
            </button>
            <button
              type="button"
              onClick={downloadUnifiedBulkXlsxTemplate}
              style={{
                height: MD.height, padding: `0 ${MD.padX}px`, borderRadius: MD.borderRadius,
                border: `1px solid ${C.bdr}`, background: C.surf, color: C.tx,
                fontWeight: 600, fontSize: MD.fontSize, cursor: 'pointer', whiteSpace: 'nowrap',
              }}
            >
              Excel 양식 다운로드
            </button>
          </div>
        )}
      />

      <div style={{ flex: 1, overflow: 'auto', padding: '16px 28px' }}>
        <section style={{ background: C.surf, border: `1px solid ${C.bdr}`, borderRadius: 10, padding: '20px 22px', maxWidth: 640 }}>
          <div style={{ fontSize: 14, fontWeight: 600, marginBottom: 12 }}>파일 업로드</div>

          <div
            onDragOver={onDragOver}
            onDragLeave={onDragLeave}
            onDrop={onDrop}
            onClick={() => !busy && fileRef.current?.click()}
            style={{
              border: `2px dashed ${dragActive ? C.brand : C.bdr}`,
              borderRadius: 10,
              background: dragActive ? C.brandL : C.surf2,
              padding: '28px 20px',
              textAlign: 'center',
              cursor: busy ? 'not-allowed' : 'pointer',
              marginBottom: 12,
            }}
          >
            <div style={{ fontSize: 14, fontWeight: 600, color: C.tx, marginBottom: 4 }}>
              {dragActive ? '여기에 놓으세요' : '파일을 드래그하거나 클릭하여 선택'}
            </div>
            <div style={{ fontSize: 12, color: C.txM }}>
              CSV · Excel(.xlsx) · 최대 {BULK_MAX_ROWS}건
            </div>
          </div>

          <input
            ref={fileRef}
            type="file"
            accept={BULK_UPLOAD_ACCEPT}
            disabled={busy}
            onChange={onFileChange}
            style={{ display: 'none' }}
          />

          {fileName && (
            <div style={{ fontSize: 12, color: C.txM, marginBottom: 12 }}>
              선택: {fileName} · 데이터 {rowCount}행
            </div>
          )}

          {(busy || progressPercent > 0) && !busy && (
            <div style={{ marginBottom: 16 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, color: C.txM, marginBottom: 6 }}>
                <span>완료</span>
                <span>{progressPercent}%</span>
              </div>
              <div style={{ height: 8, borderRadius: 999, background: C.surf2, overflow: 'hidden' }}>
                <div style={{
                  width: `${progressPercent}%`, height: '100%', background: C.brand,
                  transition: 'width 0.3s ease',
                }}
                />
              </div>
            </div>
          )}

          {error && (
            <div style={{ fontSize: 13, color: C.err, marginBottom: 12, lineHeight: 1.5 }}>{error}</div>
          )}

          <button
            type="button"
            disabled={busy || rowCount === 0 || rowCount > BULK_MAX_ROWS}
            onClick={startImport}
            style={{
              height: LG.height, padding: `0 ${LG.padX}px`, borderRadius: LG.borderRadius, border: 'none',
              background: busy || rowCount === 0 || rowCount > BULK_MAX_ROWS ? C.bdr : C.brand,
              color: '#fff', fontWeight: 600, fontSize: 14,
              cursor: busy || rowCount === 0 || rowCount > BULK_MAX_ROWS ? 'not-allowed' : 'pointer',
            }}
          >
            {busy ? '등록 중…' : '일괄 등록 시작'}
          </button>
        </section>

        <div style={{ marginTop: 20, fontSize: 12, color: C.txM, lineHeight: 1.6, maxWidth: 640 }}>
          <strong>안내</strong>
          <ul style={{ margin: '8px 0 0', paddingLeft: 18 }}>
            <li>1회 최대 {BULK_MAX_ROWS}건까지 업로드 가능하며, {BULK_CHUNK_SIZE}건씩 순차 처리됩니다.</li>
            <li>실패한 행은 결과 화면에서 수정 후 [재등록]할 수 있습니다.</li>
            <li>주소·건축물대장 API 및 Dexie 저장 로직은 기존과 동일합니다.</li>
          </ul>
        </div>
      </div>

      {busy && totalRows > 0 && (
        <BulkImportProgressModal
          totalRows={totalRows}
          processedCount={processedCount}
          progressPercent={progressPercent}
          estimatedRemainingTime={estimatedRemainingTime}
          recentLog={recentLog}
        />
      )}

      {showResultModal && report && (
        <BulkImportResultModal
          report={report}
          successCount={successCount}
          typeCounts={typeCounts}
          failedItems={failedItems}
          onUpdateFailedItem={handleUpdateFailedItem}
          onRetrySuccess={handleRetrySuccess}
          onClose={() => setShowResultModal(false)}
          onGoList={goProperties}
        />
      )}
    </div>
  );
}

export default PropertyBulkUploadPage;
