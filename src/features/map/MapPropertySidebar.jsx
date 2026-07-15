import React from 'react';
import { fmtLandPyUnit, fmtPropPrice as propPrice } from '../../utils/formatMoney.js';
import { propDisplayAddr } from '../../utils/propAddress.js';
import { MAP_STATUS, TL } from './MapInfoCard.jsx';
import { KR_GU, KR_SIDO } from './regions.js';
import { MoneyInput } from '../../components/MoneyInput.jsx';

const C = {
  brand: '#C8102E',
  brandL: '#FBE9EC',
  surf: '#FFFFFF',
  surf2: '#F8F9FB',
  bdr: '#E8EAED',
  tx: '#0F172A',
  txS: '#374151',
  txM: '#6B7280',
  txP: '#94A3B8',
  info: '#2563EB',
};

const STATUS_OPTIONS = [
  ['', '전체'],
  ['NEW', '신규'],
  ['ACTIVE', '진행중'],
  ['HOLD', '보류'],
  ['COMPLETED', '완료'],
];

const lbl = { fontSize: 11, color: C.txM, fontWeight: 600, marginBottom: 4 };

/**
 * @param {{
 *   propSearch: string,
 *   setPropSearch: (v: string) => void,
 *   advOpen: boolean,
 *   setAdvOpen: (v: boolean | ((v: boolean) => boolean)) => void,
 *   statusFilter: string,
 *   setStatusFilter: (v: string) => void,
 *   selSido: string, setSelSido: (v: string) => void,
 *   selGu: string, setSelGu: (v: string) => void,
 *   advTag: string, setAdvTag: (v: string) => void,
 *   advTrade: string, setAdvTrade: (v: string) => void,
 *   advStatus: string, setAdvStatus: (v: string) => void,
 *   advPriceMin: string, setAdvPriceMin: (v: string) => void,
 *   advPriceMax: string, setAdvPriceMax: (v: string) => void,
 *   advLandMin: string, setAdvLandMin: (v: string) => void,
 *   advLandMax: string, setAdvLandMax: (v: string) => void,
 *   advFloorMin: string, setAdvFloorMin: (v: string) => void,
 *   advFloorMax: string, setAdvFloorMax: (v: string) => void,
 *   advRoiMin: string, setAdvRoiMin: (v: string) => void,
 *   filterResetKey: number,
 *   onApplyAdv: () => void,
 *   onResetAdv: () => void,
 *   listP: object[],
 *   listMode: 'search' | 'viewport',
 *   visibleCount: number,
 *   selectedId: string|number|null,
 *   setSelectedId: (id: string|number) => void,
 *   onOpenDetail: (p: object) => void,
 *   loadingCoords: boolean,
 *   Btn: React.ComponentType<{ch?: string, on?: () => void, role?: string, ic?: string, sx?: object}>,
 * }} props
 */
export function MapPropertySidebar({
  propSearch, setPropSearch,
  advOpen, setAdvOpen,
  statusFilter, setStatusFilter,
  selSido, setSelSido, selGu, setSelGu,
  advTag, setAdvTag, advTrade, setAdvTrade, advStatus, setAdvStatus,
  advPriceMin, setAdvPriceMin, advPriceMax, setAdvPriceMax,
  advLandMin, setAdvLandMin, advLandMax, setAdvLandMax,
  advFloorMin, setAdvFloorMin, advFloorMax, setAdvFloorMax,
  advRoiMin, setAdvRoiMin,
  filterResetKey, onApplyAdv, onResetAdv,
  listP, listMode, visibleCount,
  selectedId, setSelectedId, onOpenDetail,
  loadingCoords, Btn,
}) {
  return (
    <div style={{ width: 280, borderRight: `1px solid ${C.bdr}`, background: C.surf, flexShrink: 0, display: 'flex', flexDirection: 'column', minHeight: 0 }}>
      <div style={{ padding: '12px 12px 10px', borderBottom: `1px solid ${C.bdr}`, background: C.surf2, flexShrink: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 8 }}>
          <span style={{ fontSize: 12, fontWeight: 700, color: C.brand, letterSpacing: '-.02em' }}>매물 검색</span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, height: 36, background: '#fff', border: `1.5px solid ${C.bdr}`, borderRadius: 8, padding: '0 10px' }}>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke={C.txP} strokeWidth="2">
            <circle cx="11" cy="11" r="7" /><line x1="21" y1="21" x2="16.65" y2="16.65" />
          </svg>
          <input type="search" value={propSearch} onChange={(e) => setPropSearch(e.target.value)} placeholder="건물명·주소·메모" autoComplete="off"
            style={{ border: 'none', background: 'transparent', flex: 1, minWidth: 0, fontSize: 13, color: C.tx }} />
        </div>
        <button type="button" onClick={() => setAdvOpen((v) => !v)}
          style={{ marginTop: 8, width: '100%', height: 32, border: `1px solid ${advOpen ? C.brand : C.bdr}`, borderRadius: 6, background: advOpen ? C.brandL : '#fff', color: advOpen ? C.brand : C.txS, fontSize: 12, fontWeight: 600, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, fontFamily: 'inherit' }}>
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polygon points="22 3 2 3 10 12.46 10 19 14 21 14 12.46 22 3" /></svg>
          상세검색 {advOpen ? '닫기' : '열기'}
        </button>
        {advOpen && (
          <div key={filterResetKey} style={{ marginTop: 10, padding: 10, background: '#fff', borderRadius: 8, border: `1px solid ${C.bdr}` }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 8 }}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                <div><div style={lbl}>시·도</div>
                  <select className="sel" style={{ height: 30, fontSize: 12, width: '100%' }} value={selSido} onChange={(e) => { setSelSido(e.target.value); setSelGu(''); }}>
                    <option value="">전체</option>{KR_SIDO.map((s) => <option key={s} value={s}>{s}</option>)}
                  </select></div>
                <div><div style={lbl}>구·군</div>
                  <select className="sel" style={{ height: 30, fontSize: 12, width: '100%' }} value={selGu} onChange={(e) => setSelGu(e.target.value)}>
                    <option value="">전체</option>
                    {(selSido ? KR_GU[selSido] || [] : [...new Set(KR_SIDO.flatMap((s) => KR_GU[s] || []))]).slice().sort((a, b) => a.localeCompare(b, 'ko')).map((g) => <option key={g} value={g}>{g}</option>)}
                  </select></div>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                <div><div style={lbl}>매물종류</div>
                  <select className="sel" style={{ height: 30, fontSize: 12, width: '100%' }} value={advTag} onChange={(e) => setAdvTag(e.target.value)}>
                    <option value="">전체</option>{['상가건물', '아파트', '오피스텔', '사무실', '빌라', '토지', '원룸/투룸'].map((t) => <option key={t}>{t}</option>)}
                  </select></div>
                <div><div style={lbl}>거래방식</div>
                  <select className="sel" style={{ height: 30, fontSize: 12, width: '100%' }} value={advTrade} onChange={(e) => setAdvTrade(e.target.value)}>
                    <option value="">전체</option>
                    {Object.entries(TL).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                  </select></div>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                <div><div style={lbl}>가격 최소(만)</div><MoneyInput style={{ height: 30, fontSize: 12 }} value={advPriceMin} onChange={(e) => setAdvPriceMin(e.target.value)} /></div>
                <div><div style={lbl}>가격 최대(만)</div><MoneyInput style={{ height: 30, fontSize: 12 }} value={advPriceMax} onChange={(e) => setAdvPriceMax(e.target.value)} /></div>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                <div><div style={lbl}>대지 최소(평)</div><MoneyInput style={{ height: 30, fontSize: 12 }} value={advLandMin} onChange={(e) => setAdvLandMin(e.target.value)} /></div>
                <div><div style={lbl}>대지 최대(평)</div><MoneyInput style={{ height: 30, fontSize: 12 }} value={advLandMax} onChange={(e) => setAdvLandMax(e.target.value)} /></div>
              </div>
              <div>
                <div style={lbl}>진행상태</div>
                <select className="sel" style={{ height: 30, fontSize: 12, width: '100%' }} value={advStatus} onChange={(e) => setAdvStatus(e.target.value)}>
                  <option value="">전체</option>{['신규', '진행중', '보류', '계약완료'].map((s) => <option key={s}>{s}</option>)}
                </select>
              </div>
            </div>
            <div style={{ display: 'flex', gap: 6 }}>
              <Btn role="toolbar-primary" ch="적용" ic="ti-search" on={onApplyAdv} sx={{ flex: 1, justifyContent: 'center' }} />
              <Btn role="toolbar-secondary" ch="초기화" ic="ti-refresh" on={onResetAdv} sx={{ flex: 1, justifyContent: 'center' }} />
            </div>
          </div>
        )}
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, marginTop: 10 }}>
          {STATUS_OPTIONS.map(([code, label]) => (
            <button key={code || 'all'} type="button" onClick={() => setStatusFilter(code)}
              style={{ border: `1px solid ${statusFilter === code ? C.brand : C.bdr}`, background: statusFilter === code ? C.brandL : '#fff', color: statusFilter === code ? C.brand : C.txM, borderRadius: 999, padding: '3px 9px', fontSize: 11, fontWeight: statusFilter === code ? 700 : 500, cursor: 'pointer', fontFamily: 'inherit' }}>
              {label}
            </button>
          ))}
        </div>
      </div>
      <div style={{ padding: '10px 12px', borderBottom: `1px solid ${C.bdr}`, background: '#fff', flexShrink: 0 }}>
        <div style={{ fontSize: 12, fontWeight: 700, color: C.tx }}>
          {listMode === 'search'
            ? <>검색 결과 {listP.length}건<span style={{ fontWeight: 400, color: C.txM }}> · 전체 {visibleCount}건</span></>
            : <>화면 내 {listP.length}건<span style={{ fontWeight: 400, color: C.txM }}> · 전체 {visibleCount}건</span></>}
        </div>
        <div style={{ fontSize: 10, color: C.txP, marginTop: 2 }}>
          {listMode === 'search'
            ? '전체 매물에서 검색 · 클릭 시 해당 위치로 이동'
            : '클릭 → 상세카드 줌 · 더블클릭 → 상세'}
        </div>
      </div>
      <div style={{ flex: 1, overflowY: 'auto', minHeight: 0 }}>
        {listP.length === 0 && (
          <div style={{ padding: '20px 14px', fontSize: 13, color: C.txM, lineHeight: 1.55, whiteSpace: 'pre-wrap' }}>
            {loadingCoords
              ? '매물 좌표를 불러오는 중입니다…'
              : listMode === 'search'
                ? '검색 조건에 맞는 매물이 없습니다.'
                : '현재 지도 화면에 매물이 없습니다.\n지도를 이동하거나 매물 검색을 이용하세요.'}
          </div>
        )}
        {listP.map((p) => {
          const landPy2 = p.land > 0 && p.price > 0 ? fmtLandPyUnit(p.price, p.land) : null;
          const selected = selectedId === p.id;
          return (
            <div key={p.id} onClick={() => setSelectedId(p.id)} onDoubleClick={() => onOpenDetail(p)}
              style={{ padding: '10px 12px', borderBottom: `1px solid ${C.bdr}`, cursor: 'pointer', background: selected ? C.brandL : 'transparent', borderLeft: selected ? `3px solid ${C.brand}` : '3px solid transparent' }}>
              <div style={{ fontSize: 11, fontWeight: 700, color: C.brand }}>{p.tag}</div>
              <div style={{ fontSize: 12, color: C.tx, fontWeight: 600, marginTop: 3, lineHeight: 1.35 }}>{propDisplayAddr(p)}</div>
              {p.bldg && <div style={{ fontSize: 11, color: C.txS, marginTop: 2 }}>{p.bldg}</div>}
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 4 }}>
                <span style={{ fontSize: 11, color: C.txM }}>{TL[p.trade]}</span>
                <span style={{ fontSize: 12, color: C.info, fontWeight: 700 }}>{propPrice(p)}</span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 3 }}>
                <span style={{ fontSize: 10, color: MAP_STATUS[p.status]?.c || C.txS, fontWeight: 600 }}>{MAP_STATUS[p.status]?.l || '—'}</span>
                {landPy2 && <span style={{ fontSize: 10, color: C.txM }}>대지 {landPy2}</span>}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
