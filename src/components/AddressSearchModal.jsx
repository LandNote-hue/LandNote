import React, { useCallback, useEffect, useRef, useState } from 'react';
import { searchJusoAddress } from '../services/address/jusoApi.js';
import { openJusoAddressPopup, openJusoJibunAddressPopup, hasJusoPopupKey } from '../services/address/jusoPopup.js';

const C = {
  brand: '#C8102E',
  brandL: '#FBE9EC',
  bg: '#F5F6FA',
  surf: '#FFFFFF',
  surf2: '#F8F9FB',
  bdr: '#E8EAED',
  tx: '#0F172A',
  txS: '#374151',
  txM: '#6B7280',
  txP: '#94A3B8',
  err: '#DC2626',
  errBg: '#FEF2F2',
  info: '#2563EB',
  infoBg: '#EFF6FF',
};

const MODES = [
  { id: 'all', label: '통합', hint: '도로명·지번·건물명' },
  { id: 'road', label: '도로명', hint: '예: 동일로215길 48' },
  { id: 'jibun', label: '지번', hint: '예: 노원구 상계동 737' },
  { id: 'building', label: '건물·상가', hint: '예: 상계주공아파트' },
  { id: 'land', label: '토지', hint: '건물명 없는 필지' },
];

const PLACEHOLDER = {
  all: '도로명, 지번, 건물명 검색 (예: 상계동 737, 동일로215길 48, OO아파트)',
  road: '도로명주소 (예: 서울 노원구 동일로215길 48)',
  jibun: '지번주소 (예: 서울 노원구 상계동 737)',
  building: '건물·상가명 (예: 상계주공3단지, OO빌딩)',
  land: '토지 지번 (예: 경기도 ○○면 ○○리 123)',
};

/**
 * @param {{
 *   open: boolean,
 *   onClose: () => void,
 *   onSelect: (result: import('../services/address/parseJibunAddress.js').AddressSearchResult) => void|Promise<void>,
 *   initialKeyword?: string,
 * }} props
 */
export function AddressSearchModal({ open, onClose, onSelect, initialKeyword = '' }) {
  const [mode, setMode] = useState('all');
  const [keyword, setKeyword] = useState(initialKeyword);
  const [page, setPage] = useState(1);
  const [items, setItems] = useState([]);
  const [totalCount, setTotalCount] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [activeIdx, setActiveIdx] = useState(-1);
  const inputRef = useRef(null);

  const runSearch = useCallback(async (pageNo = 1, keywordOverride, modeOverride) => {
    const q = String(keywordOverride ?? keyword).trim();
    if (q.length < 2) {
      setError('검색어를 2자 이상 입력하세요.');
      setItems([]);
      return;
    }
    setLoading(true);
    setError('');
    try {
      const res = await searchJusoAddress({
        keyword: q,
        currentPage: pageNo,
        countPerPage: 20,
        mode: modeOverride ?? mode,
      });
      setItems(res.items);
      setTotalCount(res.totalCount);
      setPage(pageNo);
      setActiveIdx(res.items.length ? 0 : -1);
      if (!res.items.length) {
        setError(res.error || '검색 결과가 없습니다. 검색 유형을 바꿔 보세요.');
      }
    } catch (err) {
      setItems([]);
      setError(err instanceof Error ? err.message : '주소 검색 실패');
    } finally {
      setLoading(false);
    }
  }, [keyword, mode]);

  useEffect(() => {
    if (!open) return;
    const q = (initialKeyword || '').trim();
    setKeyword(initialKeyword || '');
    setPage(1);
    setItems([]);
    setTotalCount(0);
    setError('');
    setActiveIdx(-1);
    setTimeout(() => inputRef.current?.focus(), 80);
    if (q.length < 2) return;

    let cancelled = false;
    (async () => {
      setLoading(true);
      setError('');
      try {
        const res = await searchJusoAddress({
          keyword: q,
          currentPage: 1,
          countPerPage: 20,
          mode,
        });
        if (cancelled) return;
        setItems(res.items);
        setTotalCount(res.totalCount);
        setPage(1);
        setActiveIdx(res.items.length ? 0 : -1);
        if (!res.items.length) setError(res.error || '검색 결과가 없습니다. 검색 유형을 바꿔 보세요.');
      } catch (err) {
        if (cancelled) return;
        setItems([]);
        setError(err instanceof Error ? err.message : '주소 검색 실패');
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => { cancelled = true; };
  }, [open, initialKeyword]);

  const pickItem = useCallback(async (item) => {
    if (!item?.jibunAddr && !item?.roadAddr) return;
    try {
      await onSelect({
        roadAddr: item.roadAddr || '',
        jibunAddr: item.jibunAddr || item.roadAddr || '',
        admCd: item.admCd,
        platGbCd: item.platGbCd,
        bun: item.bun,
        ji: item.ji,
        pnu: item.pnu,
      });
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : '주소 반영 실패');
    }
  }, [onSelect, onClose]);

  const onKeyDown = (e) => {
    if (e.key === 'Enter') {
      if (activeIdx >= 0 && items[activeIdx]) {
        e.preventDefault();
        pickItem(items[activeIdx]);
      } else {
        runSearch(1);
      }
      return;
    }
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setActiveIdx(i => Math.min(i + 1, items.length - 1));
    }
    if (e.key === 'ArrowUp') {
      e.preventDefault();
      setActiveIdx(i => Math.max(i - 1, 0));
    }
    if (e.key === 'Escape') onClose();
  };

  const openOfficialPopup = (type) => {
    const handler = async (addr) => {
      await onSelect(addr);
      onClose();
    };
    try {
      if (type === 'jibun') openJusoJibunAddressPopup(handler);
      else openJusoAddressPopup(handler);
    } catch (err) {
      setError(err instanceof Error ? err.message : '팝업을 열 수 없습니다.');
    }
  };

  if (!open) return null;

  const totalPages = Math.max(1, Math.ceil(totalCount / 20));

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="address-search-title"
      style={{
        position: 'fixed', inset: 0, zIndex: 400,
        background: 'rgba(0,0,0,.45)', backdropFilter: 'blur(3px)',
        display: 'flex', flexDirection: 'column', padding: 12,
        boxSizing: 'border-box', overflow: 'hidden',
      }}
      onClick={onClose}
    >
      <div
        style={{
          width: '100%', maxWidth: 720, flex: 1, minHeight: 0, margin: '0 auto',
          background: C.surf, borderRadius: 12, overflow: 'hidden',
          boxShadow: '0 24px 64px rgba(0,0,0,.22)',
          display: 'flex', flexDirection: 'column',
        }}
        onClick={e => e.stopPropagation()}
      >
        <div style={{
          padding: '16px 20px', borderBottom: `1px solid ${C.bdr}`,
          display: 'flex', alignItems: 'center', gap: 12,
        }}>
          <div style={{ flex: 1 }}>
            <div id="address-search-title" style={{ fontSize: 17, fontWeight: 700, color: C.tx }}>
              주소 검색
            </div>
            <div style={{ fontSize: 12, color: C.txM, marginTop: 2 }}>
              도로명 · 지번 · 토지 · 건물·상가 통합 검색
            </div>
          </div>
          <button type="button" onClick={onClose} aria-label="닫기" style={{
            width: 32, height: 32, borderRadius: 8, border: `1px solid ${C.bdr}`,
            background: C.surf2, cursor: 'pointer', fontSize: 16,
          }}>✕</button>
        </div>

        <div style={{ padding: '12px 20px 0', display: 'flex', gap: 6, flexWrap: 'wrap' }}>
          {MODES.map(m => (
            <button
              key={m.id}
              type="button"
              onClick={() => {
                setMode(m.id);
                setPage(1);
                const q = keyword.trim();
                if (q.length >= 2) runSearch(1, q, m.id);
              }}
              style={{
                padding: '6px 12px', borderRadius: 20, fontSize: 12, cursor: 'pointer',
                border: `1.5px solid ${mode === m.id ? C.brand : C.bdr}`,
                background: mode === m.id ? C.brandL : C.surf,
                color: mode === m.id ? C.brand : C.txS,
                fontWeight: mode === m.id ? 600 : 400,
              }}
            >
              {m.label}
            </button>
          ))}
        </div>

        <div style={{ padding: '12px 20px', display: 'flex', gap: 8 }}>
          <input
            ref={inputRef}
            className="inp"
            value={keyword}
            onChange={e => setKeyword(e.target.value)}
            onKeyDown={onKeyDown}
            placeholder={PLACEHOLDER[mode] || PLACEHOLDER.all}
            style={{ flex: 1 }}
            disabled={loading}
          />
          <button
            type="button"
            onClick={() => runSearch(1)}
            disabled={loading}
            style={{
              padding: '0 18px', borderRadius: 7, border: 'none', cursor: 'pointer',
              background: C.brand, color: '#fff', fontWeight: 600, fontSize: 13,
              opacity: loading ? 0.7 : 1,
            }}
          >
            {loading ? '검색중…' : '검색'}
          </button>
        </div>

        {error && (
          <div style={{
            margin: '0 20px 8px', padding: '8px 12px', borderRadius: 7,
            background: C.errBg, color: C.err, fontSize: 12, whiteSpace: 'pre-line', lineHeight: 1.5,
          }}>
            {error}
          </div>
        )}

        <div style={{ flex: 1, overflow: 'auto', padding: '0 12px 8px', minHeight: 200 }}>
          {items.map((item, idx) => {
            const bldg = [item.bdNm, item.detBdNmList].filter(Boolean).join(', ');
            const active = idx === activeIdx;
            return (
              <button
                key={`${item.admCd}-${item.jibunAddr}-${item.roadAddr}-${idx}`}
                type="button"
                onClick={() => pickItem(item)}
                onMouseEnter={() => setActiveIdx(idx)}
                style={{
                  display: 'block', width: '100%', textAlign: 'left',
                  padding: '12px 14px', marginBottom: 6, borderRadius: 8,
                  border: `1px solid ${active ? C.brand : C.bdr}`,
                  background: active ? C.brandL : C.surf,
                  cursor: 'pointer',
                }}
              >
                {item.roadAddr && (
                  <div style={{ fontSize: 13, fontWeight: 600, color: C.tx, marginBottom: 4 }}>
                    {item.roadAddr}
                  </div>
                )}
                <div style={{ fontSize: 12, color: C.txS, marginBottom: bldg ? 4 : 0 }}>
                  지번 {item.jibunAddr || '—'}
                </div>
                {bldg && (
                  <div style={{ fontSize: 11, color: C.info }}>
                    건물 {bldg}
                  </div>
                )}
                {item.zipNo && (
                  <div style={{ fontSize: 11, color: C.txP, marginTop: 4 }}>
                    우편번호 {item.zipNo}
                  </div>
                )}
                {item.source === 'vworld' && (
                  <div style={{ fontSize: 10, color: C.txP, marginTop: 4 }}>
                    vworld 지번 검색
                  </div>
                )}
              </button>
            );
          })}
          {!loading && !items.length && !error && (
            <div style={{ textAlign: 'center', padding: 40, color: C.txP, fontSize: 13 }}>
              검색어를 입력하고 Enter 또는 검색 버튼을 누르세요.
            </div>
          )}
        </div>

        {totalCount > 20 && (
          <div style={{
            padding: '8px 20px', borderTop: `1px solid ${C.bdr}`,
            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 12,
          }}>
            <button type="button" disabled={page <= 1 || loading} onClick={() => runSearch(page - 1)}
              style={{ padding: '4px 10px', fontSize: 12, cursor: 'pointer' }}>이전</button>
            <span style={{ fontSize: 12, color: C.txM }}>{page} / {totalPages}</span>
            <button type="button" disabled={page >= totalPages || loading} onClick={() => runSearch(page + 1)}
              style={{ padding: '4px 10px', fontSize: 12, cursor: 'pointer' }}>다음</button>
          </div>
        )}

        {hasJusoPopupKey() && (
          <div style={{
            padding: '10px 20px', borderTop: `1px solid ${C.bdr}`, background: C.surf2,
            display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center',
          }}>
            <span style={{ fontSize: 11, color: C.txP }}>공식 팝업:</span>
            <button type="button" onClick={() => openOfficialPopup('road')} style={linkBtnStyle}>
              도로명주소 팝업
            </button>
            <button type="button" onClick={() => openOfficialPopup('jibun')} style={linkBtnStyle}>
              지번주소 팝업
            </button>
            <span style={{ fontSize: 10, color: C.txP, flex: '1 1 100%' }}>
              juso 신청 시 URL 등록: {typeof window !== 'undefined' ? window.location.origin : ''}/juso-return.html
            </span>
          </div>
        )}
      </div>
    </div>
  );
}

const linkBtnStyle = {
  padding: '4px 10px', fontSize: 11, borderRadius: 6,
  border: `1px solid ${C.bdr}`, background: C.surf, cursor: 'pointer', color: C.info,
};
