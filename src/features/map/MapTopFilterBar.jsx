import { useEffect, useRef, useState } from 'react';
import { PROP_MAIN } from '../../data/propertyTypes.js';
import { PropCategorySearchBar, PropCategorySearchFields } from '../../components/PropCategorySearchBar.jsx';
import { RangeFilterPopover } from '../../components/RangeFilterPopover.jsx';
import { selectedMains, FLOOR_BANDS, mergeSearchSpec, ALL_SEARCH_MAINS } from '../../utils/propCategorySearch.js';
import { PROP_STATUS_FILTER_LABELS } from '../../utils/propStatus.js';
import { RANGE_FILTER_STEPS, RANGE_FILTER_LABELS, emptyRangeFilters } from '../../utils/rangeFilterConfig.js';
import { TL } from './MapInfoCard.jsx';

const ACCENT = '#2563EB';
const ACCENT_DARK = '#1D4ED8';
const ACCENT_BG = '#EFF6FF';
const C = {
  bdr: '#E8EAED',
  tx: '#0F172A',
  txM: '#6B7280',
  surf: '#fff',
};

const pillBtnStyle = (active, open) => ({
  height: 36,
  padding: '0 12px',
  borderRadius: 999,
  border: `1px solid ${active || open ? ACCENT : C.bdr}`,
  background: active ? ACCENT_BG : C.surf,
  color: active ? ACCENT_DARK : C.tx,
  fontSize: 13,
  fontWeight: active ? 600 : 500,
  cursor: 'pointer',
  fontFamily: 'inherit',
  display: 'inline-flex',
  alignItems: 'center',
  gap: 6,
  whiteSpace: 'nowrap',
  boxShadow: '0 2px 8px rgba(15,23,42,.16)',
  flexShrink: 0,
});

/** 지역·구군·진행상태·거래방식·건물층수처럼 단일 값을 고르는 pill + 목록 팝오버 */
function SelectFilterPopover({ label, value, onChange, options }) {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);
  const active = Boolean(value);
  const current = options.find((o) => o.value === value);

  useEffect(() => {
    if (!open) return undefined;
    const onDoc = (e) => {
      if (ref.current && !ref.current.contains(e.target)) setOpen(false);
    };
    document.addEventListener('mousedown', onDoc);
    return () => document.removeEventListener('mousedown', onDoc);
  }, [open]);

  return (
    <div ref={ref} style={{ position: 'relative', flexShrink: 0, pointerEvents: 'auto' }}>
      <button type="button" onClick={() => setOpen((v) => !v)} style={pillBtnStyle(active, open)}>
        <span style={active ? { color: ACCENT, fontWeight: 600 } : undefined}>{active ? (current?.label ?? value) : label}</span>
        <span style={{ fontSize: 10, color: C.txM }}>{open ? '▲' : '▼'}</span>
      </button>
      {open && (
        <div style={{
          position: 'absolute', top: 'calc(100% + 6px)', left: 0, zIndex: 50,
          minWidth: 160, maxHeight: 320, overflowY: 'auto',
          background: C.surf, border: `1px solid ${C.bdr}`, borderRadius: 12,
          boxShadow: '0 12px 32px rgba(15,23,42,.14)', padding: 6,
        }}
        >
          <button
            type="button"
            onClick={() => { onChange(''); setOpen(false); }}
            style={{
              display: 'block', width: '100%', textAlign: 'left', border: 'none', background: !value ? ACCENT_BG : 'transparent',
              color: !value ? ACCENT_DARK : C.tx, fontWeight: !value ? 600 : 400, fontSize: 13, borderRadius: 8,
              padding: '8px 10px', cursor: 'pointer', fontFamily: 'inherit',
            }}
          >
            전체
          </button>
          {options.map((o) => (
            <button
              key={o.value}
              type="button"
              onClick={() => { onChange(o.value); setOpen(false); }}
              style={{
                display: 'block', width: '100%', textAlign: 'left', border: 'none',
                background: value === o.value ? ACCENT_BG : 'transparent',
                color: value === o.value ? ACCENT_DARK : C.tx, fontWeight: value === o.value ? 600 : 400, fontSize: 13,
                borderRadius: 8, padding: '8px 10px', cursor: 'pointer', fontFamily: 'inherit',
              }}
            >
              {o.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

/** 매물종류 pill — 대분류 탭 + 소분류(+대분류별 추가 항목)를 팝오버 안에 그대로 재사용 */
function CategoryFilterPopover({ catSearch, onChange }) {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);
  const mains = selectedMains(catSearch);
  const active = mains.length > 0 || catSearch.subs.length > 0;
  const summary = mains.length === 1 ? PROP_MAIN[mains[0]] : mains.length > 1 ? `${mains.length}개 유형` : null;

  useEffect(() => {
    if (!open) return undefined;
    const onDoc = (e) => {
      if (ref.current && !ref.current.contains(e.target)) setOpen(false);
    };
    document.addEventListener('mousedown', onDoc);
    return () => document.removeEventListener('mousedown', onDoc);
  }, [open]);

  return (
    <div ref={ref} style={{ position: 'relative', flexShrink: 0, pointerEvents: 'auto' }}>
      <button type="button" onClick={() => setOpen((v) => !v)} style={pillBtnStyle(active, open)}>
        <span style={summary ? { color: ACCENT, fontWeight: 600 } : undefined}>{summary || '매물종류'}</span>
        <span style={{ fontSize: 10, color: C.txM }}>{open ? '▲' : '▼'}</span>
      </button>
      {open && (
        <div style={{
          position: 'absolute', top: 'calc(100% + 6px)', left: 0, zIndex: 50, width: 420,
          background: C.surf, border: `1px solid ${C.bdr}`, borderRadius: 12,
          boxShadow: '0 12px 32px rgba(15,23,42,.14)', padding: '14px 16px 16px',
        }}
        >
          <PropCategorySearchBar value={catSearch} onChange={onChange} scroll={false} />
          {mains.length > 0 && (
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginTop: 12 }}>
              <PropCategorySearchFields value={catSearch} onChange={onChange} part="rest" />
            </div>
          )}
        </div>
      )}
    </div>
  );
}

/** 기타옵션 pill — 대분류별 추가 옵션(주차·급매 등)을 체크박스 팝오버로 다중선택 */
function ExtrasFilterPopover({ catSearch, onChange }) {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);
  const mains = selectedMains(catSearch);
  const specMains = mains.length ? mains : ALL_SEARCH_MAINS;
  const extras = mergeSearchSpec(specMains).extras;
  const n = catSearch.extras.length;
  const active = n > 0;
  const summary = active ? extras.filter((ex) => catSearch.extras.includes(ex.id)).map((ex) => ex.label).join(', ') : null;

  useEffect(() => {
    if (!open) return undefined;
    const onDoc = (e) => {
      if (ref.current && !ref.current.contains(e.target)) setOpen(false);
    };
    document.addEventListener('mousedown', onDoc);
    return () => document.removeEventListener('mousedown', onDoc);
  }, [open]);

  if (!extras.length) return null;

  return (
    <div ref={ref} style={{ position: 'relative', flexShrink: 0, pointerEvents: 'auto' }}>
      <button type="button" onClick={() => setOpen((v) => !v)} style={pillBtnStyle(active, open)}>
        <span style={active ? { color: ACCENT, fontWeight: 600 } : undefined}>{summary || '기타옵션'}</span>
        <span style={{ fontSize: 10, color: C.txM }}>{open ? '▲' : '▼'}</span>
      </button>
      {open && (
        <div style={{
          position: 'absolute', top: 'calc(100% + 6px)', left: 0, zIndex: 50,
          minWidth: 200, maxHeight: 280, overflowY: 'auto',
          background: C.surf, border: `1px solid ${C.bdr}`, borderRadius: 12,
          boxShadow: '0 12px 32px rgba(15,23,42,.14)', padding: '10px 12px',
        }}
        >
          {extras.map((ex) => {
            const on = catSearch.extras.includes(ex.id);
            return (
              <label key={ex.id} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '6px 2px', fontSize: 13, color: C.tx, cursor: 'pointer' }}>
                <input
                  type="checkbox"
                  checked={on}
                  onChange={() => {
                    const nextExtras = on ? catSearch.extras.filter((id) => id !== ex.id) : [...catSearch.extras, ex.id];
                    onChange({ ...catSearch, extras: nextExtras });
                  }}
                />
                {ex.label}
              </label>
            );
          })}
        </div>
      )}
    </div>
  );
}

const EXCLUDED_RANGE_KEYS = new Set(['roi', 'walk']);

/**
 * 지도보기 상단 필터바 — 매물관리 상세검색과 동일한 항목을 가로 pill 행으로 배치
 * (지역(도·시)·구·군·수익률·도보거리는 제외). 값을 고르는 즉시 반영되므로 별도 "적용" 버튼은 없음.
 * @param {{
 *   advStatus: string, setAdvStatus: (v: string) => void,
 *   advTrade: string, setAdvTrade: (v: string) => void,
 *   catSearch: object, setCatSearch: (v: object | ((c: object) => object)) => void,
 *   onResetAdv: () => void,
 *   Btn: React.ComponentType<{ch?: string, on?: () => void, role?: string, ic?: string, sx?: object}>,
 * }} props
 */
export function MapTopFilterBar({
  advStatus, setAdvStatus, advTrade, setAdvTrade,
  catSearch, setCatSearch,
  onResetAdv, Btn,
}) {
  const hasMains = selectedMains(catSearch).length > 0;

  return (
    <div style={{
      position: 'absolute', top: 10, left: 10, right: 10, zIndex: 115,
      display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 8,
      pointerEvents: 'none',
    }}>
      <SelectFilterPopover label="진행상태" value={advStatus} onChange={setAdvStatus} options={PROP_STATUS_FILTER_LABELS.map((s) => ({ value: s, label: s }))} />
      {hasMains ? (
        <SelectFilterPopover
          label="거래방식"
          value={catSearch.trade}
          onChange={(v) => setCatSearch((c) => ({ ...c, trade: v }))}
          options={Object.entries(TL).map(([k, v]) => ({ value: k, label: v }))}
        />
      ) : (
        <SelectFilterPopover
          label="거래방식"
          value={advTrade}
          onChange={setAdvTrade}
          options={Object.entries(TL).map(([k, v]) => ({ value: k, label: v }))}
        />
      )}
      <SelectFilterPopover
        label="건물층수"
        value={catSearch.floorBand}
        onChange={(v) => setCatSearch((c) => ({ ...c, floorBand: v }))}
        options={FLOOR_BANDS.filter((b) => b.id).map((b) => ({ value: b.id, label: b.label }))}
      />
      <CategoryFilterPopover catSearch={catSearch} onChange={setCatSearch} />
      <ExtrasFilterPopover catSearch={catSearch} onChange={setCatSearch} />

      {Object.keys(RANGE_FILTER_STEPS).filter((key) => !EXCLUDED_RANGE_KEYS.has(key)).map((key) => (
        <div key={key} style={{ flexShrink: 0, pointerEvents: 'auto' }}>
          <RangeFilterPopover
            filterKey={key}
            label={RANGE_FILTER_LABELS[key] || key}
            steps={RANGE_FILTER_STEPS[key]}
            value={(catSearch.ranges || emptyRangeFilters())[key] ?? null}
            onChange={(v) => setCatSearch((c) => ({ ...c, ranges: { ...(c.ranges || emptyRangeFilters()), [key]: v } }))}
          />
        </div>
      ))}

      <Btn role="toolbar-secondary" ic="ti-refresh" on={onResetAdv} title="초기화" sx={{ flexShrink: 0, pointerEvents: 'auto' }} />
    </div>
  );
}
