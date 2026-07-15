import React, { useCallback, useEffect, useRef, useState } from 'react';
import { loadKakaoMaps, searchMapLocations } from '../../services/kakao/kakaoMaps.js';
import { ZOOM_PLACE_SEARCH_PERCENT } from './mapZoom.js';

const KAKAO_BLUE = '#3396FF';
const C = {
  bdr: '#E8EAED',
  tx: '#0F172A',
  txM: '#6B7280',
  txP: '#94A3B8',
};

/** @param {{ onSelect: (item: import('../../services/kakao/kakaoMaps.js').MapSearchResult) => void, isMobile?: boolean }} props */
export function MapPlaceSearch({ onSelect, isMobile = false }) {
  const [query, setQuery] = useState('');
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [results, setResults] = useState(/** @type {import('../../services/kakao/kakaoMaps.js').MapSearchResult[]} */ ([]));
  const [activeIdx, setActiveIdx] = useState(-1);
  const wrapRef = useRef(null);
  const debounceRef = useRef(null);

  const runSearch = useCallback(async (text) => {
    const q = text.trim();
    if (!q) {
      setResults([]);
      setOpen(false);
      return;
    }
    setLoading(true);
    try {
      const kakao = await loadKakaoMaps(['services']);
      const found = await searchMapLocations(kakao, q);
      setResults(found);
      setOpen(true);
      setActiveIdx(found.length ? 0 : -1);
    } catch {
      setResults([]);
      setOpen(true);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    if (!query.trim()) {
      setResults([]);
      setOpen(false);
      return;
    }
    debounceRef.current = setTimeout(() => runSearch(query), 320);
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [query, runSearch]);

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
      else runSearch(query);
    } else if (e.key === 'Escape') {
      setOpen(false);
    }
  };

  return (
    <div
      ref={wrapRef}
      style={{
        position: 'absolute',
        top: 10,
        left: '50%',
        transform: 'translateX(-50%)',
        width: isMobile ? 'calc(100% - 24px)' : 'min(440px, calc(100% - 120px))',
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
          border: `1px solid ${open ? KAKAO_BLUE : C.bdr}`,
          overflow: 'hidden',
        }}
      >
        <span style={{ padding: '0 12px', color: KAKAO_BLUE, display: 'flex' }} aria-hidden>
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
          placeholder="장소, 주소, 지하철역 검색"
          autoComplete="off"
          style={{
            flex: 1,
            border: 'none',
            outline: 'none',
            height: 42,
            fontSize: 14,
            color: C.tx,
            background: 'transparent',
            minWidth: 0,
          }}
        />
        <button
          type="button"
          onClick={() => runSearch(query)}
          style={{
            border: 'none',
            background: KAKAO_BLUE,
            color: '#fff',
            height: 42,
            padding: '0 16px',
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
            maxHeight: 320,
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
                  color: item.kind === 'place' ? KAKAO_BLUE : C.txM,
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
      <div style={{ fontSize: 10, color: C.txP, textAlign: 'center', marginTop: 4 }}>
        카카오맵 지도검색 · 선택 시 해당 위치로 이동 (줌 {ZOOM_PLACE_SEARCH_PERCENT}%)
      </div>
    </div>
  );
}
