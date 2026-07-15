import { useRef, useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  downloadCustomerBulkCsvTemplate,
  CUSTOMER_BULK_MAX_ROWS,
} from '../data/customerBulkCsv.js';
import {
  runBulkCustomerImportFromFile,
  formatCustomerBulkImportReport,
  formatCustomerTypeCountSummary,
  customerBulkMaxRowsExceededMessage,
} from '../services/bulk/bulkCustomerImportService.js';
import {
  parseCustomerBulkFile,
  CUSTOMER_BULK_UPLOAD_ACCEPT,
  isCustomerBulkUploadFile,
} from '../utils/parseCustomerBulkFile.js';
import { CustomerBulkFailedRetryTable } from '../components/CustomerBulkFailedRetryTable.jsx';
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

/** @param {{ progressPercent: number }} props */
function CustomerBulkProgressModal({ progressPercent }) {
  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="cust-bulk-progress-title"
      aria-busy="true"
      style={{
        position: 'fixed', inset: 0, zIndex: 1000,
        background: 'rgba(15,23,42,.45)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        padding: 20,
      }}
    >
      <div style={{
        background: C.surf, borderRadius: 12, padding: '28px 32px',
        maxWidth: 480, width: '100%',
        boxShadow: '0 20px 40px rgba(0,0,0,.15)',
      }}
      >
        <div id="cust-bulk-progress-title" style={{ fontSize: 17, fontWeight: 700, color: C.tx, marginBottom: 8 }}>
          고객 일괄 등록 중
        </div>
        <div style={{ fontSize: 13, color: C.txM, marginBottom: 20, lineHeight: 1.5 }}>
          외부 API 없이 로컬 DB에 고속 저장합니다. 잠시만 기다려 주세요.
        </div>
        <div style={{ fontSize: 14, fontWeight: 600, color: C.tx, marginBottom: 10 }}>
          처리 중… ({progressPercent}%)
        </div>
        <div style={{ height: 10, borderRadius: 999, background: C.surf2, overflow: 'hidden' }}>
          <div style={{
            width: `${progressPercent}%`,
            height: '100%',
            background: C.brand,
            transition: 'width 0.2s ease',
          }}
          />
        </div>
      </div>
    </div>
  );
}

/** @param {{
 *   report: string,
 *   successCount: number,
 *   typeCounts: Record<string, number>,
 *   failedItems: { rowIndex: number, error: string, row: Record<string, string> }[],
 *   onUpdateFailedItem: (rowIndex: number, row: Record<string, string>) => void,
 *   onRetrySuccess: (rowIndex: number, reportKey?: string) => void,
 *   onClose: () => void,
 *   onGoList: () => void,
 * }} props */
function CustomerBulkResultModal({
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
  const typeSummary = formatCustomerTypeCountSummary(typeCounts);

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="cust-bulk-result-title"
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
          maxWidth: 900, width: '100%', margin: 'auto',
          boxShadow: '0 20px 40px rgba(0,0,0,.15)',
        }}
      >
        <div id="cust-bulk-result-title" style={{ fontSize: 17, fontWeight: 700, color: C.tx, marginBottom: 12 }}>
          고객 일괄 등록 결과
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
          <CustomerBulkFailedRetryTable
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
            고객 목록으로
          </button>
        </div>
      </div>
    </div>
  );
}

/** @param {{ onNav?: (id: string) => void }} props */
export function CustomerBulkUploadPage({ onNav }) {
  const navigate = useNavigate();
  const fileRef = useRef(null);
  const importLockRef = useRef(false);
  const [fileName, setFileName] = useState('');
  const [selectedFile, setSelectedFile] = useState(null);
  const [rowCount, setRowCount] = useState(0);
  const [busy, setBusy] = useState(false);
  const [progressPercent, setProgressPercent] = useState(0);
  const [report, setReport] = useState('');
  const [successCount, setSuccessCount] = useState(0);
  const [typeCounts, setTypeCounts] = useState({});
  const [failedItems, setFailedItems] = useState([]);
  const [showResultModal, setShowResultModal] = useState(false);
  const [error, setError] = useState('');
  const [dragActive, setDragActive] = useState(false);

  const goCustomers = () => {
    if (onNav) onNav('customers');
    else navigate('/customers');
  };

  const previewFile = useCallback(async (file) => {
    setError('');
    setReport('');
    setFailedItems([]);
    setTypeCounts({});
    setShowResultModal(false);
    setProgressPercent(0);
    if (!file) {
      setFileName('');
      setSelectedFile(null);
      setRowCount(0);
      return;
    }
    if (!isCustomerBulkUploadFile(file)) {
      setError('CSV 파일만 업로드할 수 있습니다.');
      setFileName('');
      setSelectedFile(null);
      setRowCount(0);
      return;
    }
    setFileName(file.name);
    setSelectedFile(file);
    try {
      const rows = await parseCustomerBulkFile(file);
      setRowCount(rows.length);
      if (rows.length > CUSTOMER_BULK_MAX_ROWS) {
        const msg = customerBulkMaxRowsExceededMessage(rows.length);
        window.alert(msg);
        setError(msg);
      }
    } catch (err) {
      setError(err?.message || '파일 파싱 실패');
      setRowCount(0);
    }
  }, []);

  const onFileChange = async (e) => {
    await previewFile(e.target.files?.[0] || null);
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
    if (fileRef.current) {
      const dt = new DataTransfer();
      dt.items.add(file);
      fileRef.current.files = dt.files;
    }
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
      setError('CSV 파일을 선택해 주세요.');
      return;
    }
    if (rowCount > CUSTOMER_BULK_MAX_ROWS) {
      window.alert(customerBulkMaxRowsExceededMessage(rowCount));
      return;
    }
    if (!rowCount) {
      setError('등록할 데이터 행이 없습니다.');
      return;
    }

    importLockRef.current = true;
    setBusy(true);
    setProgressPercent(0);
    try {
      const result = await runBulkCustomerImportFromFile(file, {
        onProgress: setProgressPercent,
      });
      setSuccessCount(result.successCount);
      setFailedItems(result.failedItems || []);
      setTypeCounts(result.typeCounts || {});
      setReport(formatCustomerBulkImportReport(
        result.successCount,
        result.failures,
        result.typeCounts,
      ));
      setShowResultModal(true);
    } catch (err) {
      setError(err?.message || '일괄 등록 실패');
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
    setReport(formatCustomerBulkImportReport(successCount, failedItems, typeCounts));
  }, [successCount, failedItems, typeCounts, showResultModal]);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', background: C.bg }}>
      <PageHeader
        title="고객 일괄 등록"
        sub={`통합 고객 양식 · 최대 ${CUSTOMER_BULK_MAX_ROWS}건/회 · 초고속 로컬 저장`}
        acts={(
          <button
            type="button"
            onClick={downloadCustomerBulkCsvTemplate}
            style={{
              height: MD.height, padding: `0 ${MD.padX}px`, borderRadius: MD.borderRadius,
              border: `1px solid ${C.brand}`, background: C.brandL, color: C.brand,
              fontWeight: 600, fontSize: MD.fontSize, cursor: 'pointer', whiteSpace: 'nowrap',
            }}
          >
            통합 고객 양식 다운로드
          </button>
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
              {dragActive ? '여기에 놓으세요' : 'CSV 파일을 드래그하거나 클릭하여 선택'}
            </div>
            <div style={{ fontSize: 12, color: C.txM }}>
              CSV · 최대 {CUSTOMER_BULK_MAX_ROWS}건
            </div>
          </div>

          <input
            ref={fileRef}
            type="file"
            accept={CUSTOMER_BULK_UPLOAD_ACCEPT}
            disabled={busy}
            onChange={onFileChange}
            style={{ display: 'none' }}
          />

          {fileName && (
            <div style={{ fontSize: 12, color: C.txM, marginBottom: 12 }}>
              선택: {fileName} · 데이터 {rowCount}행
            </div>
          )}

          {error && (
            <div style={{ fontSize: 13, color: C.err, marginBottom: 12, lineHeight: 1.5 }}>{error}</div>
          )}

          <button
            type="button"
            disabled={busy || rowCount === 0 || rowCount > CUSTOMER_BULK_MAX_ROWS}
            onClick={startImport}
            style={{
              height: LG.height, padding: `0 ${LG.padX}px`, borderRadius: LG.borderRadius, border: 'none',
              background: busy || rowCount === 0 || rowCount > CUSTOMER_BULK_MAX_ROWS ? C.bdr : C.brand,
              color: '#fff', fontWeight: 600, fontSize: 14,
              cursor: busy || rowCount === 0 || rowCount > CUSTOMER_BULK_MAX_ROWS ? 'not-allowed' : 'pointer',
            }}
          >
            {busy ? '등록 중…' : '일괄 등록 시작'}
          </button>
        </section>

        <div style={{ marginTop: 20, fontSize: 12, color: C.txM, lineHeight: 1.6, maxWidth: 720 }}>
          <strong>안내</strong>
          <ul style={{ margin: '8px 0 0', paddingLeft: 18 }}>
            <li>양식 열은 고객 등록 화면과 동일합니다: 고객명·연락처·주소·이메일·회사·직함·진행상태·고객구분·현금가용금액(만)·선호지역·희망거래방식·매입가능액 최소/최대(만)·메모</li>
            <li>필수: 휴대폰(연락처) · 고객명 또는 회사 중 하나 (주소·고객구분·진행상태·나머지는 선택, 진행상태 비우면 진행중)</li>
            <li>고객구분은 콤마·슬래시로 복수 입력 가능 (예: 매수/임차, 매도,매수). 비워 두면 미분류로 등록됩니다.</li>
            <li>연락처는 고유값입니다. 이미 등록된 번호·파일 내 중복 번호는 등록되지 않습니다.</li>
            <li>실패한 행은 결과 화면에서 고객명·회사·연락처·고객구분·진행상태 등을 수정 후 [재등록]할 수 있습니다.</li>
          </ul>
        </div>
      </div>

      {busy && (
        <CustomerBulkProgressModal progressPercent={progressPercent} />
      )}

      {showResultModal && report && (
        <CustomerBulkResultModal
          report={report}
          successCount={successCount}
          typeCounts={typeCounts}
          failedItems={failedItems}
          onUpdateFailedItem={handleUpdateFailedItem}
          onRetrySuccess={handleRetrySuccess}
          onClose={() => setShowResultModal(false)}
          onGoList={goCustomers}
        />
      )}
    </div>
  );
}

export default CustomerBulkUploadPage;
