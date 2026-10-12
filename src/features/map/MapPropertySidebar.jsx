import React, { useEffect, useRef, useState } from 'react';
import { fmtLandPyUnit, fmtPropPrice as propPrice } from '../../utils/formatMoney.js';
import { propDisplayAddr } from '../../utils/propAddress.js';
import { PROP_STATUS_OPTS } from '../../utils/propStatus.js';
import { MAP_STATUS, TL } from './MapInfoCard.jsx';
import { useMapPlaceSearchResults } from './useMapPlaceSearchResults.js';

const KAKAO_BLUE = '#3396FF';

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
  ...PROP_STATUS_OPTS.map(({ id, label }) => [id, id === 'COMPLETED' ? '완료' : label]),
];

/**
 * @param {{
 *   propSearch: string,
 *   setPropSearch: (v: string) => void,
 *   statusFilter: string,
 *   setStatusFilter: (v: string) => void,
 *   listP: object[],
 *   listMode: 'search' | 'viewport',
 *   visibleCount: number,
 *   selectedId: string|number|null,
 *   setSelectedId: (id: string|number) => void,
 *   onOpenDetail: (p: object) => void,
 *   loadingCoords: boolean,
 *   onPlaceSelect?: (item: import('../../services/kakao/kakaoMaps.js').MapSearchResult) => void,
 * }} props
 */
export function MapPropertySidebar({
  propSearch, setPropSearch,
  statusFilter, setStatusFilter,
  listP, listMode, visibleCount,
  selectedId, setSelectedId, onOpenDetail,
  loadingCoords,
  onPlaceSelect,
}) {
  const [placeOpen, setPlaceOpen] = useState(false);
  const [placeActiveIdx, setPlaceActiveIdx] = useState(-1);
  const placeBoxRef = useRef(null);
  const { results: placeResults, loading: placeLoading } = useMapPlaceSearchResults(propSearch);

  useEffect(() => {
    if (!propSearch.trim()) {
      setPlaceOpen(false);
      return;
    }
    setPlaceOpen(true);
    setPlaceActiveIdx(placeResults.length ? 0 : -1);
  }, [propSearch, placeResults]);

  useEffect(() => {
    if (!placeOpen) return undefined;
    const onDoc = (e) => {
      if (placeBoxRef.current && !placeBoxRef.current.contains(e.target)) setPlaceOpen(false);
    };
    document.addEventListener('mousedown', onDoc);
    return () => document.removeEventListener('mousedown', onDoc);
  }, [placeOpen]);

  const pickPlace = (item) => {
    setPlaceOpen(false);
    setPropSearch('');
    onPlaceSelect?.(item);
  };

  const onPropSearchKeyDown = (e) => {
    if (!onPlaceSelect) return;
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setPlaceActiveIdx((i) => Math.min(placeResults.length - 1, i + 1));
      setPlaceOpen(true);
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setPlaceActiveIdx((i) => Math.max(0, i - 1));
    } else if (e.key === 'Enter') {
      if (placeActiveIdx >= 0 && placeResults[placeActiveIdx]) {
        e.preventDefault();
        pickPlace(placeResults[placeActiveIdx]);
      }
    } else if (e.key === 'Escape') {
      setPlaceOpen(false);
    }
  };

  return (
    <div style={{ width: 280, borderRight: `1px solid ${C.bdr}`, background: C.surf, flexShrink: 0, display: 'flex', flexDirection: 'column', minHeight: 0 }}>
      <div style={{ padding: '12px 12px 10px', borderBottom: `1px solid ${C.bdr}`, background: C.surf2, flexShrink: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 8 }}>
          <span style={{ fontSize: 12, fontWeight: 700, color: C.brand, letterSpacing: '-.02em' }}>매물 검색</span>
        </div>
        <div ref={placeBoxRef} style={{ position: 'relative' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, height: 36, background: '#fff', border: `1.5px solid ${C.bdr}`, borderRadius: 7, padding: '0 12px' }}>
            <span style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: 15, height: 15, flexShrink: 0, color: C.txP }} aria-hidden>
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="11" cy="11" r="8" /><line x1="21" y1="21" x2="16.65" y2="16.65" />
              </svg>
            </span>
            <input type="search" value={propSearch} onChange={(e) => setPropSearch(e.target.value)}
              onFocus={() => { if (propSearch.trim() && placeResults.length) setPlaceOpen(true); }}
              onKeyDown={onPropSearchKeyDown}
              placeholder="건물명·주소·메모·장소·지하철역 검색..." autoComplete="off"
              style={{ border: 'none', background: 'transparent', fontSize: 14, color: C.tx, flex: 1, height: '100%', minWidth: 0 }} />
          </div>
          {onPlaceSelect && placeOpen && (
            <div style={{
              position: 'absolute', top: '100%', left: 0, right: 0, marginTop: 4, zIndex: 60,
              background: '#fff', borderRadius: 8, border: `1px solid ${C.bdr}`,
              boxShadow: '0 8px 24px rgba(0,0,0,.12)', maxHeight: 280, overflowY: 'auto',
            }}>
              {placeLoading && placeResults.length === 0 && (
                <div style={{ padding: '12px 14px', fontSize: 12, color: C.txM }}>장소 검색 중…</div>
              )}
              {!placeLoading && placeResults.length === 0 && (
                <div style={{ padding: '12px 14px', fontSize: 12, color: C.txM }}>일치하는 장소·주소가 없습니다.</div>
              )}
              {placeResults.map((item, idx) => (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => pickPlace(item)}
                  onMouseEnter={() => setPlaceActiveIdx(idx)}
                  style={{
                    width: '100%', border: 'none',
                    borderBottom: idx < placeResults.length - 1 ? `1px solid ${C.bdr}` : 'none',
                    background: placeActiveIdx === idx ? '#F0F7FF' : '#fff',
                    textAlign: 'left', padding: '9px 12px', cursor: 'pointer', fontFamily: 'inherit',
                    display: 'flex', gap: 8, alignItems: 'flex-start',
                  }}
                >
                  <span style={{
                    fontSize: 10, fontWeight: 700, marginTop: 2, flexShrink: 0, borderRadius: 4, padding: '2px 6px',
                    color: item.kind === 'place' ? KAKAO_BLUE : C.txM,
                    background: item.kind === 'place' ? '#E8F3FF' : '#F3F4F6',
                  }}>
                    {item.kind === 'place' ? '장소' : '주소'}
                  </span>
                  <span style={{ minWidth: 0 }}>
                    <div style={{ fontSize: 12, fontWeight: 600, color: C.tx, lineHeight: 1.35 }}>{item.title}</div>
                    <div style={{ fontSize: 11, color: C.txP, marginTop: 1, lineHeight: 1.3 }}>{item.subtitle}</div>
                  </span>
                </button>
              ))}
            </div>
          )}
        </div>
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
