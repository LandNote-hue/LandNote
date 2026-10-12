import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import {
  RANGE_FILTER_STEPS,
  RANGE_FILTER_LABELS,
  formatRangeSummary,
} from '../utils/rangeFilterConfig.js';

const ACCENT = '#2563EB';
const ACCENT_DARK = '#1D4ED8';
const ACCENT_BG = '#EFF6FF';
const TRACK = ACCENT;
const C = {
  bdr: '#E8EAED',
  tx: '#0F172A',
  txM: '#6B7280',
  surf: '#fff',
};

/**
 * @param {{
 *   filterKey: string,
 *   label: string,
 *   steps: { value: number|null, label: string }[],
 *   value: { minIdx: number, maxIdx: number }|null,
 *   onChange: (next: { minIdx: number, maxIdx: number }|null) => void,
 *   compact?: boolean,
 * }} props
 */
export function RangeFilterPopover({ filterKey, label, steps, value, onChange, compact = false }) {
  const [open, setOpen] = useState(false);
  const [leftOffset, setLeftOffset] = useState(0);
  const ref = useRef(null);
  const panelWidth = compact ? 280 : 320;
  const maxIdx = steps.length - 1;
  const cur = value && value.minIdx <= value.maxIdx
    ? value
    : { minIdx: 0, maxIdx };
  const active = cur.minIdx > 0 || cur.maxIdx < maxIdx;
  const summary = formatRangeSummary(filterKey, active ? cur : null);

  useEffect(() => {
    if (!open) return undefined;
    const onDoc = (e) => {
      if (ref.current && !ref.current.contains(e.target)) setOpen(false);
    };
    document.addEventListener('mousedown', onDoc);
    return () => document.removeEventListener('mousedown', onDoc);
  }, [open]);

  useLayoutEffect(() => {
    if (!open) { setLeftOffset(0); return undefined; }
    const margin = 8;
    // NOTE: the app renders under a global CSS `zoom` scale (see index.css).
    // Under `zoom`, window.innerWidth and element getBoundingClientRect()
    // can disagree, so any boundary must come from another element's rect
    // (same zoomed subtree, same coordinate space) rather than window.*.
    const reposition = () => {
      const btn = ref.current;
      if (!btn) return;
      const btnRect = btn.getBoundingClientRect();
      const boundary = document.body.getBoundingClientRect();
      let offset = 0;
      const overflowRight = (btnRect.left + panelWidth + margin) - boundary.right;
      if (overflowRight > 0) offset = -overflowRight;
      const minOffset = -(btnRect.left - margin - boundary.left);
      if (offset < minOffset) offset = minOffset;
      setLeftOffset(offset);
    };
    reposition();
    window.addEventListener('resize', reposition);
    window.addEventListener('scroll', reposition, true);
    return () => {
      window.removeEventListener('resize', reposition);
      window.removeEventListener('scroll', reposition, true);
    };
  }, [open, panelWidth]);

  const setRange = (minIdx, maxIdx) => {
    const lo = Math.max(0, Math.min(minIdx, maxIdx));
    const hi = Math.min(steps.length - 1, Math.max(minIdx, maxIdx));
    if (lo === 0 && hi === steps.length - 1) onChange(null);
    else onChange({ minIdx: lo, maxIdx: hi });
  };

  const loPct = (cur.minIdx / maxIdx) * 100;
  const hiPct = (cur.maxIdx / maxIdx) * 100;

  return (
    <div ref={ref} style={{ position: 'relative', flexShrink: 0 }}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        style={{
          height: compact ? 32 : 36,
          padding: '0 12px',
          borderRadius: 999,
          border: `1px solid ${active || open ? TRACK : C.bdr}`,
          background: active ? ACCENT_BG : C.surf,
          color: active ? ACCENT_DARK : C.tx,
          fontSize: compact ? 12 : 13,
          fontWeight: active ? 600 : 500,
          cursor: 'pointer',
          fontFamily: 'inherit',
          display: 'inline-flex',
          alignItems: 'center',
          gap: 6,
          whiteSpace: 'nowrap',
          boxShadow: '0 1px 0 rgba(15,23,42,.04)',
        }}
      >
        <span>{label}</span>
        {active && <span style={{ color: ACCENT, fontWeight: 600 }}>{summary}</span>}
        <span style={{ fontSize: 10, color: C.txM }}>{open ? '▲' : '▼'}</span>
      </button>
      {open && (
        <div style={{
          position: 'absolute',
          top: 'calc(100% + 6px)',
          left: leftOffset,
          zIndex: 50,
          width: panelWidth,
          background: C.surf,
          border: `1px solid ${C.bdr}`,
          borderRadius: 12,
          boxShadow: '0 12px 32px rgba(15,23,42,.14)',
          padding: compact ? '14px 16px 16px' : '16px 18px 18px',
        }}>
          <div style={{ fontSize: compact ? 14 : 15, fontWeight: 700, color: C.tx, marginBottom: 10 }}>{label}</div>
          <div style={{ fontSize: 13, fontWeight: 600, color: ACCENT, marginBottom: 22 }}>{summary}</div>
          <div style={{ position: 'relative', height: 50, marginBottom: 8 }}>
            <div style={{
              position: 'absolute', top: 0, left: `${loPct}%`, transform: 'translateX(-50%)',
              fontSize: 11, fontWeight: 700, color: '#fff', background: TRACK,
              padding: '2px 7px', borderRadius: 999, whiteSpace: 'nowrap', pointerEvents: 'none',
            }}>
              {steps[cur.minIdx]?.label}
            </div>
            <div style={{
              position: 'absolute', top: 0, left: `${hiPct}%`, transform: 'translateX(-50%)',
              fontSize: 11, fontWeight: 700, color: '#fff', background: TRACK,
              padding: '2px 7px', borderRadius: 999, whiteSpace: 'nowrap', pointerEvents: 'none',
            }}>
              {steps[cur.maxIdx]?.label}
            </div>
            <div style={{
              position: 'absolute', top: 34, left: 0, right: 0, height: 4, borderRadius: 2, background: '#E5E7EB',
            }} />
            <div style={{
              position: 'absolute', top: 34, left: `${loPct}%`, width: `${hiPct - loPct}%`, height: 4, borderRadius: 2, background: TRACK,
            }} />
            <input
              type="range"
              min={0}
              max={maxIdx}
              value={cur.minIdx}
              onChange={(e) => setRange(Number(e.target.value), cur.maxIdx)}
              className="range-filter-thumb"
              style={{ position: 'absolute', top: 22, left: 0, width: '100%', height: 28, margin: 0, background: 'transparent', zIndex: 3, WebkitAppearance: 'none', appearance: 'none' }}
            />
            <input
              type="range"
              min={0}
              max={maxIdx}
              value={cur.maxIdx}
              onChange={(e) => setRange(cur.minIdx, Number(e.target.value))}
              className="range-filter-thumb"
              style={{ position: 'absolute', top: 22, left: 0, width: '100%', height: 28, margin: 0, background: 'transparent', zIndex: 4, WebkitAppearance: 'none', appearance: 'none' }}
            />
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', gap: 4, fontSize: 11, color: C.txM }}>
            {steps.map((s, i) => (
              <span
                key={`${s.label}-${i}`}
                style={{
                  flex: i === 0 || i === steps.length - 1 ? '0 0 auto' : 1,
                  textAlign: i === 0 ? 'left' : i === steps.length - 1 ? 'right' : 'center',
                  whiteSpace: 'nowrap',
                  fontWeight: i === cur.minIdx || i === cur.maxIdx ? 600 : 400,
                  color: i === cur.minIdx || i === cur.maxIdx ? ACCENT : C.txM,
                }}
              >
                {s.label}
              </span>
            ))}
          </div>
          {active && (
            <button
              type="button"
              onClick={() => { onChange(null); setOpen(false); }}
              style={{ marginTop: 12, border: 'none', background: 'transparent', color: C.txM, fontSize: 12, cursor: 'pointer', fontFamily: 'inherit', padding: 0 }}
            >
              초기화
            </button>
          )}
        </div>
      )}
    </div>
  );
}

/**
 * @param {{
 *   ranges: Record<string, { minIdx: number, maxIdx: number }|null>,
 *   onChange: (next: Record<string, { minIdx: number, maxIdx: number }|null>) => void,
 *   keys?: string[],
 *   compact?: boolean,
 *   scroll?: boolean,
 * }} props
 */
export function PropRangeSearchBar({ ranges, onChange, keys, compact = false, scroll = true }) {
  const list = keys || Object.keys(RANGE_FILTER_STEPS);
  const patch = (key, val) => onChange({ ...ranges, [key]: val });
  const nowrap = compact && scroll;

  return (
    <div style={{ display: 'flex', flexWrap: nowrap ? 'nowrap' : 'wrap', gap: compact ? 6 : 8, alignItems: 'center', overflowX: nowrap ? 'auto' : 'visible', paddingBottom: nowrap ? 2 : 0, WebkitOverflowScrolling: 'touch' }}>
      {list.map((key) => (
        <RangeFilterPopover
          key={key}
          filterKey={key}
          label={RANGE_FILTER_LABELS[key] || key}
          steps={RANGE_FILTER_STEPS[key]}
          value={ranges?.[key] ?? null}
          onChange={(v) => patch(key, v)}
          compact={compact}
        />
      ))}
    </div>
  );
}
