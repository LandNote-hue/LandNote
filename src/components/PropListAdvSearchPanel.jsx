import { fmtInputNum } from '../utils/formatMoney.js';
import {
  KR_SIDO,
  KR_GU,
  SALE_PROP_KIND_OPTS,
  PROP_AGENT_NONE,
  PROP_STATUS_FILTER_LABELS,
  propStatusFilterLabels,
} from '../utils/propAdvSearch.js';
import { BRAND_CSS } from '../theme/dealModeTheme.js';

const C = {
  surf: '#fff',
  bdr: '#E8EAED',
  txM: '#64748B',
  brand: BRAND_CSS.brand,
};

const allGu = [...new Set(KR_SIDO.flatMap((s) => KR_GU[s] || []))].sort((a, b) => a.localeCompare(b, 'ko'));

/**
 * 매물관리·지도보기 공통 상세검색 패널
 */
export function PropListAdvSearchPanel({
  rentList = false,
  isMobile = false,
  draft,
  setDraft,
  agentNameOpts = [],
  onApply,
  onReset,
  Btn,
  resetKey,
}) {
  const patch = (partial) => setDraft((prev) => ({ ...prev, ...partial }));
  const selSido = draft.selSido || '';
  const guOpts = selSido ? (KR_GU[selSido] || []) : allGu;

  return (
    <div key={resetKey} style={{ background: C.surf, borderBottom: `1px solid ${C.bdr}`, padding: isMobile ? '12px 16px' : '14px 24px' }}>
      {rentList ? (
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12, marginBottom: 10 }}>
          <div style={{ flex: '0 1 150px', minWidth: 110 }}>
            <div style={{ fontSize: 12, color: C.txM, fontWeight: 600, marginBottom: 5 }}>지역(도·시)</div>
            <select className="sel" style={{ height: 34, fontSize: 13 }} value={selSido} onChange={(e) => patch({ selSido: e.target.value, selGu: '' })}>
              <option value="">전체</option>
              {KR_SIDO.map((s) => <option key={s} value={s}>{s}</option>)}
            </select>
          </div>
          <div style={{ flex: '0 1 150px', minWidth: 110 }}>
            <div style={{ fontSize: 12, color: C.txM, fontWeight: 600, marginBottom: 5 }}>구·군</div>
            <select className="sel" style={{ height: 34, fontSize: 13 }} value={draft.selGu || ''} onChange={(e) => patch({ selGu: e.target.value })}>
              <option value="">전체</option>
              {guOpts.slice().sort((a, b) => a.localeCompare(b, 'ko')).map((g) => <option key={g} value={g}>{g}</option>)}
            </select>
          </div>
          <div style={{ flex: '0 1 150px', minWidth: 110 }}>
            <div style={{ fontSize: 12, color: C.txM, fontWeight: 600, marginBottom: 5 }}>진행 상태</div>
            <select className="sel" style={{ height: 34, fontSize: 13 }} value={draft.advStatus || ''} onChange={(e) => patch({ advStatus: e.target.value })}>
              <option value="">전체</option>
              {propStatusFilterLabels(true).map((s) => <option key={s}>{s}</option>)}
            </select>
          </div>
        </div>
      ) : (
        <>
          <div style={{ display: 'grid', gridTemplateColumns: isMobile ? 'repeat(2,minmax(0,1fr))' : 'repeat(7,minmax(0,1fr))', gap: '12px 14px' }}>
            <div>
              <div style={{ fontSize: 12, color: C.txM, fontWeight: 600, marginBottom: 5 }}>지역(도·시)</div>
              <select className="sel" style={{ height: 34, fontSize: 13 }} value={selSido} onChange={(e) => patch({ selSido: e.target.value, selGu: '' })}>
                <option value="">전체</option>
                {KR_SIDO.map((s) => <option key={s} value={s}>{s}</option>)}
              </select>
            </div>
            <div>
              <div style={{ fontSize: 12, color: C.txM, fontWeight: 600, marginBottom: 5 }}>구·군</div>
              <select className="sel" style={{ height: 34, fontSize: 13 }} value={draft.selGu || ''} onChange={(e) => patch({ selGu: e.target.value })}>
                <option value="">전체</option>
                {guOpts.slice().sort((a, b) => a.localeCompare(b, 'ko')).map((g) => <option key={g} value={g}>{g}</option>)}
              </select>
            </div>
            <div>
              <div style={{ fontSize: 12, color: C.txM, fontWeight: 600, marginBottom: 5 }}>매물 종류</div>
              <select className="sel" style={{ height: 34, fontSize: 13 }} value={draft.advMain || ''} onChange={(e) => patch({ advMain: e.target.value })}>
                <option value="">전체</option>
                {SALE_PROP_KIND_OPTS.map(({ id, label }) => <option key={id} value={id}>{label}</option>)}
              </select>
            </div>
            <div>
              <div style={{ fontSize: 12, color: C.txM, fontWeight: 600, marginBottom: 5 }}>진행 상태</div>
              <select className="sel" style={{ height: 34, fontSize: 13 }} value={draft.advStatus || ''} onChange={(e) => patch({ advStatus: e.target.value })}>
                <option value="">전체</option>
                {PROP_STATUS_FILTER_LABELS.map((s) => <option key={s}>{s}</option>)}
              </select>
            </div>
            <div>
              <div style={{ fontSize: 12, color: C.txM, fontWeight: 600, marginBottom: 5 }}>담당자</div>
              <select className="sel" style={{ height: 34, fontSize: 13 }} value={draft.advAgent || ''} onChange={(e) => patch({ advAgent: e.target.value })}>
                <option value="">전체</option>
                {agentNameOpts.map((n) => <option key={n} value={n}>{n}</option>)}
                <option value={PROP_AGENT_NONE}>미지정</option>
              </select>
            </div>
            <div>
              <div style={{ fontSize: 12, color: C.txM, fontWeight: 600, marginBottom: 5 }}>가격 최소(만)</div>
              <input className="inp" inputMode="numeric" style={{ height: 34, fontSize: 13 }} value={draft.advPriceMin || ''} onChange={(e) => patch({ advPriceMin: fmtInputNum(e.target.value) })} placeholder="0" />
            </div>
            <div>
              <div style={{ fontSize: 12, color: C.txM, fontWeight: 600, marginBottom: 5 }}>가격 최대(만)</div>
              <input className="inp" inputMode="numeric" style={{ height: 34, fontSize: 13 }} value={draft.advPriceMax || ''} onChange={(e) => patch({ advPriceMax: fmtInputNum(e.target.value) })} placeholder="0" />
            </div>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: isMobile ? 'repeat(2,minmax(0,1fr))' : 'repeat(5,minmax(0,1fr))', gap: '12px 14px', marginTop: 12, maxWidth: isMobile ? undefined : 920 }}>
            <div>
              <div style={{ fontSize: 12, color: C.txM, fontWeight: 600, marginBottom: 5 }}>대지면적 최소(평)</div>
              <input className="inp" inputMode="decimal" style={{ height: 34, fontSize: 13 }} value={draft.advLandMin || ''} onChange={(e) => patch({ advLandMin: fmtInputNum(e.target.value, { decimal: true }) })} placeholder="0" />
            </div>
            <div>
              <div style={{ fontSize: 12, color: C.txM, fontWeight: 600, marginBottom: 5 }}>대지면적 최대(평)</div>
              <input className="inp" inputMode="decimal" style={{ height: 34, fontSize: 13 }} value={draft.advLandMax || ''} onChange={(e) => patch({ advLandMax: fmtInputNum(e.target.value, { decimal: true }) })} placeholder="0" />
            </div>
            <div>
              <div style={{ fontSize: 12, color: C.txM, fontWeight: 600, marginBottom: 5 }}>연면적 최소(평)</div>
              <input className="inp" inputMode="decimal" style={{ height: 34, fontSize: 13 }} value={draft.advFloorMin || ''} onChange={(e) => patch({ advFloorMin: fmtInputNum(e.target.value, { decimal: true }) })} placeholder="-" />
            </div>
            <div>
              <div style={{ fontSize: 12, color: C.txM, fontWeight: 600, marginBottom: 5 }}>연면적 최대(평)</div>
              <input className="inp" inputMode="decimal" style={{ height: 34, fontSize: 13 }} value={draft.advFloorMax || ''} onChange={(e) => patch({ advFloorMax: fmtInputNum(e.target.value, { decimal: true }) })} placeholder="-" />
            </div>
            <div>
              <div style={{ fontSize: 12, color: C.txM, fontWeight: 600, marginBottom: 5 }}>수익률 이상(%)</div>
              <input className="inp" inputMode="decimal" style={{ height: 34, fontSize: 13 }} value={draft.advRoiMin || ''} onChange={(e) => patch({ advRoiMin: fmtInputNum(e.target.value, { decimal: true }) })} placeholder="-" />
            </div>
          </div>
        </>
      )}
      <div style={{ display: 'flex', gap: 8, marginTop: 12 }}>
        <Btn role="toolbar-primary" ch="검색 적용" ic="ti-search" on={onApply} />
        <Btn role="toolbar-secondary" ch="초기화" ic="ti-refresh" on={onReset} />
      </div>
    </div>
  );
}
