import { useEffect, useRef, useState } from 'react';
import { PROP_MAIN } from '../data/propertyTypes.js';
import {
  PROP_MAIN_SEARCH_TABS, emptyCategorySearch, subOptionsForMain,
  selectedMains, mergeSearchSpec, pruneCategorySearch, ALL_SEARCH_MAINS, BAND_TO_RANGE_KEY,
} from '../utils/propCategorySearch.js';
import { RANGE_FILTER_STEPS } from '../utils/rangeFilterConfig.js';
import { RangeFilterPopover } from './RangeFilterPopover.jsx';
import { BRAND_CSS } from '../theme/dealModeTheme.js';

const C = {
  brand: BRAND_CSS.brand,
  brandL: BRAND_CSS.brandL,
  bdr: '#E8EAED',
  tx: '#0F172A',
  txM: '#6B7280',
  txP: '#94A3B8',
  surf: '#fff',
  subOn: '#475569',
  subOnBdr: '#334155',
};

const lblStyle = (compact) => ({
  fontSize: compact ? 11 : 12,
  color: C.txM,
  fontWeight: 600,
  marginBottom: compact ? 4 : 5,
});

const controlStyle = (compact, active = false) => ({
  height: compact ? 30 : 34,
  width: '100%',
  fontSize: compact ? 12 : 13,
  fontFamily: 'inherit',
  border: `1px solid ${active ? C.brand : C.bdr}`,
  background: active ? C.brandL : C.surf,
  color: active ? C.brand : C.tx,
  borderRadius: 6,
  padding: '0 8px',
  fontWeight: active ? 600 : 400,
  cursor: 'pointer',
  boxSizing: 'border-box',
});

/** 데스크톱 상세검색에서 select류 필드 하나의 폭 — 부모가 flex-wrap일 때만 적용 (compact=그리드 레이아웃) */
const fieldWrapStyle = (compact) => (compact ? undefined : { flex: '0 1 150px', minWidth: 110 });

const LEAD_KEYS = new Set(['priceBand']);
/** 상세검색 1행(진행상태 우측)에 고정 배치 — lead/rest/global에서 제외 */
const HEADER_ROW_KEYS = new Set(['floorBand']);
const GLOBAL_DROP_KEYS = new Set(['approvalBand', 'floorBand', 'loanBand', 'maintBand', 'extras']);

/**
 * @param {{
 *   value: ReturnType<typeof emptyCategorySearch>,
 *   onChange: (next: ReturnType<typeof emptyCategorySearch>) => void,
 *   compact?: boolean,
 *   scroll?: boolean,
 * }} props
 */
export function PropCategorySearchBar({ value, onChange, compact = false, scroll = true }) {
  const cat = value || emptyCategorySearch();
  const mains = selectedMains(cat);
  // 대분류 탭 행: scroll=false면 가로 스크롤 대신 그리드로 줄바꿈 (compact와 무관)
  const tabsScroll = scroll;
  // 소분류 아코디언(자동 펼침 + 바깥 클릭 시 닫힘)은 좁은 폭(지도보기 사이드바: compact && !scroll)에서만.
  // 그 외(scroll=false지만 compact=false인 팝업 등)는 소분류를 항상 펼쳐서 줄바꿈 표시.
  const subsAccordion = compact && !scroll;
  const [subsOpen, setSubsOpen] = useState(false);
  const subsRef = useRef(null);

  useEffect(() => {
    if (!subsAccordion || !subsOpen) return undefined;
    const onDoc = (e) => {
      if (subsRef.current && !subsRef.current.contains(e.target)) setSubsOpen(false);
    };
    document.addEventListener('mousedown', onDoc);
    return () => document.removeEventListener('mousedown', onDoc);
  }, [subsAccordion, subsOpen]);

  const toggleMain = (id) => {
    if (!id) {
      onChange({
        ...cat,
        main: '',
        mains: [],
        subs: [],
        trade: '',
        priceBand: '',
        areaBand: '',
      });
      if (subsAccordion) setSubsOpen(false);
      return;
    }
    const next = mains.includes(id) ? mains.filter((m) => m !== id) : [...mains, id];
    onChange(pruneCategorySearch(cat, next));
    if (subsAccordion) setSubsOpen(next.length > 0);
  };

  return (
    <div>
      <div style={tabsScroll
        ? { display: 'flex', gap: 0, overflowX: 'auto', borderBottom: `1px solid ${C.bdr}` }
        : { display: 'grid', gridTemplateColumns: 'repeat(2,1fr)', gap: 6, paddingBottom: 6, borderBottom: `1px solid ${C.bdr}` }
      }>
        {PROP_MAIN_SEARCH_TABS.map((t) => {
          const on = t.id ? mains.includes(t.id) : mains.length === 0;
          return (
            <button
              key={t.id || 'all'}
              type="button"
              onClick={() => toggleMain(t.id)}
              style={tabsScroll ? {
                flexShrink: 0,
                padding: compact ? '6px 10px' : '7px 14px',
                border: 'none',
                background: 'transparent',
                cursor: 'pointer',
                fontSize: compact ? 12 : 13,
                fontWeight: on ? 700 : 500,
                color: on ? C.brand : C.txM,
                borderBottom: on ? `2px solid ${C.brand}` : '2px solid transparent',
                marginBottom: -1,
                fontFamily: 'inherit',
                whiteSpace: 'nowrap',
              } : {
                height: 30,
                padding: '0 10px',
                borderRadius: 6,
                border: `1px solid ${on ? C.brand : C.bdr}`,
                background: on ? C.brandL : '#fff',
                cursor: 'pointer',
                fontSize: 12,
                fontWeight: on ? 700 : 500,
                color: on ? C.brand : C.txM,
                fontFamily: 'inherit',
              }}
            >
              {t.label}
            </button>
          );
        })}
      </div>
      {mains.length > 0 && (!subsAccordion ? (
        <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: compact ? 6 : 8, padding: compact ? '8px 0 0' : '10px 0 0' }}>
          {mains.map((m) => (
            <div key={m} style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 6 }}>
              {mains.length > 1 && (
                <span style={{ fontSize: 11, color: C.txP, fontWeight: 600, marginRight: 2, whiteSpace: 'nowrap' }}>{PROP_MAIN[m]}</span>
              )}
              {subOptionsForMain(m).map((s) => {
                const on = cat.subs.includes(s.id);
                return (
                  <button
                    key={s.id}
                    type="button"
                    onClick={() => {
                      const subs = on ? cat.subs.filter((id) => id !== s.id) : [...cat.subs, s.id];
                      onChange({ ...cat, subs });
                    }}
                    style={{
                      height: compact ? 28 : 30,
                      padding: '0 11px',
                      borderRadius: 6,
                      border: `1px solid ${on ? C.subOnBdr : C.bdr}`,
                      background: on ? C.subOn : C.surf,
                      color: on ? '#F8FAFC' : C.tx,
                      fontSize: compact ? 12 : 13,
                      fontWeight: on ? 600 : 500,
                      cursor: 'pointer',
                      fontFamily: 'inherit',
                      whiteSpace: 'nowrap',
                      boxShadow: on ? 'none' : '0 1px 0 rgba(15,23,42,.04)',
                    }}
                  >
                    {s.label}
                  </button>
                );
              })}
            </div>
          ))}
        </div>
      ) : (
        <div ref={subsRef} style={{ marginTop: 8 }}>
          {subsOpen ? (
            <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 6 }}>
              {mains.map((m) => (
                <div key={m} style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 6 }}>
                  {mains.length > 1 && (
                    <span style={{ fontSize: 11, color: C.txP, fontWeight: 600, marginRight: 2, whiteSpace: 'nowrap' }}>{PROP_MAIN[m]}</span>
                  )}
                  {subOptionsForMain(m).map((s) => {
                    const on = cat.subs.includes(s.id);
                    return (
                      <button
                        key={s.id}
                        type="button"
                        onClick={() => {
                          const subs = on ? cat.subs.filter((id) => id !== s.id) : [...cat.subs, s.id];
                          onChange({ ...cat, subs });
                        }}
                        style={{
                          height: 28,
                          padding: '0 11px',
                          borderRadius: 6,
                          border: `1px solid ${on ? C.subOnBdr : C.bdr}`,
                          background: on ? C.subOn : C.surf,
                          color: on ? '#F8FAFC' : C.tx,
                          fontSize: 12,
                          fontWeight: on ? 600 : 500,
                          cursor: 'pointer',
                          fontFamily: 'inherit',
                          whiteSpace: 'nowrap',
                          boxShadow: on ? 'none' : '0 1px 0 rgba(15,23,42,.04)',
                        }}
                      >
                        {s.label}
                      </button>
                    );
                  })}
                </div>
              ))}
            </div>
          ) : (
            <button
              type="button"
              onClick={() => setSubsOpen(true)}
              style={{
                display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                width: '100%', height: 30, padding: '0 10px', borderRadius: 6,
                border: `1px solid ${C.bdr}`, background: '#fff', cursor: 'pointer',
                fontFamily: 'inherit', fontSize: 12, color: cat.subs.length ? C.tx : C.txM,
              }}
            >
              <span>{cat.subs.length ? `소분류 ${cat.subs.length}개 선택됨` : '소분류 선택'}</span>
              <span style={{ fontSize: 10, color: C.txP }}>▾</span>
            </button>
          )}
        </div>
      ))}
    </div>
  );
}

function DropField({ drop, cat, patch, compact, extrasOpen, setExtrasOpen, extrasRef, extras }) {
  if (drop.kind === 'bands') {
    const rangeKey = BAND_TO_RANGE_KEY[drop.key];
    if (rangeKey && RANGE_FILTER_STEPS[rangeKey]) {
      return (
        <RangeFilterPopover
          filterKey={rangeKey}
          label={drop.label}
          steps={RANGE_FILTER_STEPS[rangeKey]}
          value={cat.ranges?.[rangeKey] ?? null}
          onChange={(v) => patch({ ranges: { ...(cat.ranges || {}), [rangeKey]: v } })}
          compact={compact}
        />
      );
    }
    const cur = cat[drop.key] || '';
    return (
      <div style={fieldWrapStyle(compact)}>
        <div style={lblStyle(compact)}>{drop.label}</div>
        <select
          className="sel"
          value={cur}
          onChange={(e) => patch({ [drop.key]: e.target.value })}
          style={controlStyle(compact, !!cur)}
        >
          {drop.bands.map((b) => (
            <option key={b.id || 'empty'} value={b.id}>{b.id ? b.label : '전체'}</option>
          ))}
        </select>
      </div>
    );
  }
  if (drop.kind === 'extras' && extras.length) {
    const n = cat.extras.length;
    return (
      <div ref={extrasRef} style={{ position: 'relative', ...fieldWrapStyle(compact) }}>
        <div style={lblStyle(compact)}>기타옵션</div>
        <button
          type="button"
          onClick={() => setExtrasOpen((v) => !v)}
          style={{
            ...controlStyle(compact, n > 0 || extrasOpen),
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            textAlign: 'left',
          }}
        >
          <span>{n ? `${n}개 선택` : '전체'}</span>
          <span style={{ fontSize: 10, color: C.txP }}>{extrasOpen ? '▲' : '▼'}</span>
        </button>
        {extrasOpen && (
          <div style={{
            position: 'absolute',
            top: '100%',
            left: 0,
            minWidth: '100%',
            width: 'max-content',
            maxWidth: 220,
            zIndex: 40,
            marginTop: 4,
            background: C.surf,
            border: `1px solid ${C.bdr}`,
            borderRadius: 8,
            boxShadow: '0 8px 24px rgba(0,0,0,.12)',
            padding: '8px 10px',
            maxHeight: 240,
            overflowY: 'auto',
          }}>
            {extras.map((ex) => {
              const on = cat.extras.includes(ex.id);
              return (
                <label key={ex.id} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '4px 0', fontSize: compact ? 12 : 13, color: C.tx, cursor: 'pointer' }}>
                  <input
                    type="checkbox"
                    checked={on}
                    onChange={() => {
                      const next = on
                        ? cat.extras.filter((id) => id !== ex.id)
                        : [...cat.extras, ex.id];
                      patch({ extras: next });
                    }}
                  />
                  {ex.label}
                </label>
              );
            })}
            <div style={{ fontSize: 11, color: C.txP, marginTop: 4 }}>중복선택 가능</div>
          </div>
        )}
      </div>
    );
  }
  return null;
}

/**
 * 대분류별 검색 항목 — 선택된 대분류를 합쳐 겹치는 필드는 1개만
 * @param {{
 *   value: ReturnType<typeof emptyCategorySearch>,
 *   onChange: (next: ReturnType<typeof emptyCategorySearch>) => void,
 *   compact?: boolean,
 *   part?: 'all' | 'lead' | 'rest' | 'global',
 * }} props
 */
export function PropCategorySearchFields({ value, onChange, compact = false, part = 'all' }) {
  const cat = value || emptyCategorySearch();
  const [extrasOpen, setExtrasOpen] = useState(false);
  const extrasRef = useRef(null);
  const mains = selectedMains(cat);
  const specMains = part === 'global' || !mains.length ? ALL_SEARCH_MAINS : mains;
  const spec = mergeSearchSpec(specMains);

  useEffect(() => {
    if (!extrasOpen) return undefined;
    const onDoc = (e) => {
      if (extrasRef.current && !extrasRef.current.contains(e.target)) setExtrasOpen(false);
    };
    document.addEventListener('mousedown', onDoc);
    return () => document.removeEventListener('mousedown', onDoc);
  }, [extrasOpen]);

  if (part !== 'global' && !mains.length) return null;

  const patch = (partial) => onChange({ ...cat, ...partial });
  const leadDrops = spec.drops.filter((d) => LEAD_KEYS.has(d.key));
  const restDrops = spec.drops.filter((d) => !LEAD_KEYS.has(d.key));
  const globalDrops = spec.drops.filter((d) => !LEAD_KEYS.has(d.key));
  const skipRangeBand = (d) => !(d.kind === 'bands' && BAND_TO_RANGE_KEY[d.key]);
  const skipHeaderRow = (d) => !HEADER_ROW_KEYS.has(d.key);
  const drops = (part === 'lead' ? leadDrops : part === 'rest' ? restDrops : part === 'global' ? globalDrops : spec.drops)
    .filter(skipRangeBand)
    .filter(skipHeaderRow);

  return (
    <>
      {drops.map((drop) => (
        <DropField
          key={drop.key}
          drop={drop}
          cat={cat}
          patch={patch}
          compact={compact}
          extrasOpen={extrasOpen}
          setExtrasOpen={setExtrasOpen}
          extrasRef={extrasRef}
          extras={spec.extras}
        />
      ))}
    </>
  );
}

export { emptyCategorySearch, selectedMains };
