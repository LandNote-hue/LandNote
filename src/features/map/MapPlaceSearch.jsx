import React, { useEffect, useRef, useState } from 'react';
import {
  MAP_MOBILE_INSET,
  MAP_MOBILE_PLACE_SEARCH_HEIGHT,
  MAP_MOBILE_PLACE_SEARCH_TOP,
} from './mapSiteLayout.js';
import { useMapPlaceSearchResults } from './useMapPlaceSearchResults.js';

const MAP_BLUE = '#3396FF';
const C = {
  bdr: '#E8EAED',
  tx: '#0F172A',
  txM: '#6B7280',
  txP: '#94A3B8',
};

/** @param {{ onSelect: (item: import('../../services/naver/naverMaps.js').MapSearchResult) => void, isMobile?: boolean }} props */
export function MapPlaceSearch({ onSelect, isMobile = false }) {
  const [query, setQuery] = useState('');
  const [open, setOpen] = useState(false);
  const [activeIdx, setActiveIdx] = useState(-1);
  const wrapRef = useRef(null);
  const { results, loading } = useMapPlaceSearchResults(query);

  useEffect(() => {
    if (!query.trim()) {
      setOpen(false);
      return;
    }
    setOpen(true);
    setActiveIdx(results.length ? 0 : -1);
  }, [query, results]);

  useEffect(() => {
    const onDoc = (e) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target)) setOpen(false);
    };
    document.addEventListener('mousedown', onDoc);
    return () => document.removeEventListener('mousedown', onDoc);
  }, []);

  const pick = (item) => {
    setQuery(item.title);
    setOpen(false);
    onSelect(item);
  };

  const onKeyDown = (e) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setActiveIdx((i) => Math.min(results.length - 1, i + 1));
      setOpen(true);
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setActiveIdx((i) => Math.max(0, i - 1));
    } else if (e.key === 'Enter') {
      e.preventDefault();
      if (activeIdx >= 0 && results[activeIdx]) pick(results[activeIdx]);
      else if (results.length) pick(results[0]);
    } else if (e.key === 'Escape') {
      setOpen(false);
    }
  };

  const inputH = isMobile ? MAP_MOBILE_PLACE_SEARCH_HEIGHT : 42;

  return (
    <div
      ref={wrapRef}
      style={isMobile ? {
        position: 'absolute',
        top: MAP_MOBILE_PLACE_SEARCH_TOP,
        left: MAP_MOBILE_INSET,
        right: MAP_MOBILE_INSET,
        width: 'auto',
        zIndex: 105,
        pointerEvents: 'auto',
      } : {
        position: 'absolute',
        top: 10,
        left: '50%',
        transform: 'translateX(-50%)',
        width: 'min(440px, calc(100% - 120px))',
        zIndex: 105,
        pointerEvents: 'auto',
      }}
    >
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          background: '#fff',
          borderRadius: 8,
          boxShadow: '0 2px 12px rgba(0,0,0,.14)',
          border: `1px solid ${open ? MAP_BLUE : C.bdr}`,
          overflow: 'hidden',
        }}
      >
        <span style={{ padding: isMobile ? '0 10px' : '0 12px', color: MAP_BLUE, display: 'flex' }} aria-hidden>
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2">
            <circle cx="11" cy="11" r="7" />
            <line x1="21" y1="21" x2="16.65" y2="16.65" />
          </svg>
        </span>
        <input
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onFocus={() => { if (results.length) setOpen(true); }}
          onKeyDown={onKeyDown}
          placeholder={isMobile ? '장소·주소 검색' : '장소, 주소, 지하철역 검색'}
          autoComplete="off"
          style={{
            flex: 1,
            border: 'none',
            outline: 'none',
            height: inputH,
            fontSize: 14,
            color: C.tx,
            background: 'transparent',
            minWidth: 0,
          }}
        />
        <button
          type="button"
          onClick={() => { if (results.length) setOpen(true); }}
          style={{
            border: 'none',
            background: MAP_BLUE,
            color: '#fff',
            height: inputH,
            padding: isMobile ? '0 12px' : '0 16px',
            fontSize: 13,
            fontWeight: 600,
            cursor: 'pointer',
            fontFamily: 'inherit',
            flexShrink: 0,
          }}
        >
          {loading ? '…' : '검색'}
        </button>
      </div>

      {open && (
        <div
          style={{
            marginTop: 4,
            background: '#fff',
            borderRadius: 8,
            border: `1px solid ${C.bdr}`,
            boxShadow: '0 8px 24px rgba(0,0,0,.12)',
            maxHeight: isMobile ? 220 : 320,
            overflowY: 'auto',
          }}
        >
          {loading && results.length === 0 && (
            <div style={{ padding: '14px 16px', fontSize: 13, color: C.txM }}>검색 중…</div>
          )}
          {!loading && results.length === 0 && query.trim() && (
            <div style={{ padding: '14px 16px', fontSize: 13, color: C.txM }}>검색 결과가 없습니다.</div>
          )}
          {results.map((item, idx) => (
            <button
              key={item.id}
              type="button"
              onClick={() => pick(item)}
              onMouseEnter={() => setActiveIdx(idx)}
              style={{
                width: '100%',
                border: 'none',
                borderBottom: idx < results.length - 1 ? `1px solid ${C.bdr}` : 'none',
                background: activeIdx === idx ? '#F0F7FF' : '#fff',
                textAlign: 'left',
                padding: '10px 14px',
                cursor: 'pointer',
                fontFamily: 'inherit',
                display: 'flex',
                gap: 10,
                alignItems: 'flex-start',
              }}
            >
              <span
                style={{
                  fontSize: 10,
                  fontWeight: 700,
                  color: item.kind === 'place' ? MAP_BLUE : C.txM,
                  background: item.kind === 'place' ? '#E8F3FF' : '#F3F4F6',
                  borderRadius: 4,
                  padding: '2px 6px',
                  flexShrink: 0,
                  marginTop: 2,
                }}
              >
                {item.kind === 'place' ? '장소' : '주소'}
              </span>
              <span style={{ minWidth: 0 }}>
                <div style={{ fontSize: 13, fontWeight: 600, color: C.tx, lineHeight: 1.35 }}>{item.title}</div>
                <div style={{ fontSize: 12, color: C.txP, marginTop: 2, lineHeight: 1.35 }}>{item.subtitle}</div>
              </span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
