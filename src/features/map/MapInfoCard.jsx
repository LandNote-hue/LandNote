import React from 'react';
import { propDisplayAddr, propRoadAddr } from '../../utils/propAddress.js';
import { fmtPropPrice as propPrice } from '../../utils/formatMoney.js';

const C = {
  brand: '#C8102E',
  bdr: '#E8EAED',
  tx: '#0F172A',
  txM: '#6B7280',
  info: '#2563EB',
  ok: '#047857',
  warn: '#D97706',
  txM2: '#6B7280',
};

const MAP_STATUS = {
  NEW: { l: '신규', c: C.ok },
  ACTIVE: { l: '진행중', c: C.info },
  HOLD: { l: '보류', c: C.warn },
  COMPLETED: { l: '계약완료', c: C.txM2 },
};

const TL = { SALE: '매매', JEONSE: '전세', MONTHLY: '월세', SHORT_TERM: '단기', PRESALE: '분양' };

const FULL_W = 232;
const MINI_W = 136;

const clamp2 = {
  overflow: 'hidden',
  display: '-webkit-box',
  WebkitLineClamp: 2,
  WebkitBoxOrient: 'vertical',
  lineHeight: 1.35,
  wordBreak: 'keep-all',
  overflowWrap: 'anywhere',
};

function CardTail({ selected, size = 7 }) {
  return (
    <div
      aria-hidden
      style={{
        width: 0,
        height: 0,
        borderLeft: `${size}px solid transparent`,
        borderRight: `${size}px solid transparent`,
        borderTop: `${size}px solid ${selected ? C.brand : '#fff'}`,
      }}
    />
  );
}

function InfoRows({ rows }) {
  return (
    <div
      style={{
        display: 'grid',
        gridTemplateColumns: '56px minmax(0, 1fr)',
        columnGap: 8,
        rowGap: 4,
        fontSize: 11,
        marginTop: 8,
      }}
    >
      {rows.map(([label, value, valueStyle]) => (
        <React.Fragment key={label}>
          <span style={{ color: C.txM, lineHeight: 1.35 }}>{label}</span>
          <span style={{ color: C.tx, lineHeight: 1.35, wordBreak: 'keep-all', overflowWrap: 'anywhere', minWidth: 0, ...valueStyle }}>
            {value}
          </span>
        </React.Fragment>
      ))}
    </div>
  );
}

function cardTitleSubtitle(p) {
  const addr = propDisplayAddr(p);
  const road = propRoadAddr(p);
  const bldg = (p.bldg || '').trim();
  if (bldg) {
    const sub = addr !== bldg ? addr : (road && road !== bldg ? road : null);
    return { title: bldg, subtitle: sub };
  }
  return { title: addr, subtitle: road && road !== addr ? road : null };
}

export function MapMiniCard({ p, selected, onSelect, inline }) {
  const { title } = cardTitleSubtitle(p);
  const border = `1.5px solid ${selected ? C.brand : C.bdr}`;

  const body = (
    <>
      <div style={{ fontSize: 10, fontWeight: 600, color: C.brand }}>{p.tag || '매물'}</div>
      <div style={{ fontSize: 11, fontWeight: 600, color: C.tx, marginTop: 2, ...clamp2 }}>{title}</div>
      <div style={{ fontSize: 11, color: C.info, fontWeight: 600, marginTop: 3 }}>{propPrice(p)}</div>
    </>
  );

  if (inline) {
    return (
      <div style={{ width: MINI_W, display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
        <div style={{ width: '100%', background: '#fff', border, borderBottom: 'none', borderRadius: '6px 6px 0 0', padding: '6px 8px', boxShadow: '0 4px 12px rgba(0,0,0,.12)' }}>
          {body}
        </div>
        <div style={{ width: '100%', height: 1.5, background: selected ? C.brand : C.bdr }} />
        <CardTail selected={selected} size={6} />
      </div>
    );
  }

  return (
    <div
      onClick={onSelect}
      style={{
        cursor: onSelect ? 'pointer' : 'default',
        background: '#fff',
        border,
        borderRadius: 6,
        padding: '6px 8px',
        boxShadow: '0 4px 12px rgba(0,0,0,.12)',
        width: MINI_W,
        boxSizing: 'border-box',
      }}
    >
      {body}
    </div>
  );
}

export function MapInfoCard({
  p, onOpenDetail, landPy, style, inline, selected, onSelect, mode = 'full',
}) {
  if (mode === 'mini') {
    return <MapMiniCard p={p} selected={selected} onSelect={onSelect} inline={inline} />;
  }

  const { title, subtitle } = cardTitleSubtitle(p);
  const border = `1.5px solid ${selected ? C.brand : C.bdr}`;
  const rows = [
    ['거래방식', TL[p.trade] || '—', { color: C.info, fontWeight: 600 }],
    ['가격', propPrice(p), { color: C.brand, fontWeight: 600 }],
    ['상태', MAP_STATUS[p.status]?.l || '—', { color: MAP_STATUS[p.status]?.c || C.tx, fontWeight: 600 }],
  ];
  const landPyVal = landPy?.(p);
  if (landPyVal) rows.push(['대지 평단가', landPyVal, { fontWeight: 600 }]);

  const header = (
    <>
      <div style={{ position: 'relative', paddingRight: 18 }}>
        <span style={{ fontSize: 11, fontWeight: 600, color: C.brand }}>{p.tag || '매물'}</span>
        <div style={{ fontSize: 12, fontWeight: 600, color: C.tx, marginTop: 2, ...clamp2 }}>{title}</div>
        {subtitle && (
          <div style={{ fontSize: 10, color: C.txM, marginTop: 4, ...clamp2 }}>{subtitle}</div>
        )}
      </div>
      <InfoRows rows={rows} />
    </>
  );

  if (inline) {
    return (
      <div style={{ width: FULL_W, ...style }}>
        <div style={{ width: FULL_W, display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
          <div
            style={{
              position: 'relative',
              width: '100%',
              boxSizing: 'border-box',
              background: '#fff',
              border,
              borderBottom: 'none',
              borderRadius: '8px 8px 0 0',
              padding: '10px 12px',
              boxShadow: selected ? '0 8px 20px rgba(200,16,46,.15)' : '0 8px 20px rgba(0,0,0,.14)',
            }}
          >
            {header}
            <button
              type="button"
              aria-label="매물 상세 열기"
              onClick={(e) => { e.stopPropagation(); onOpenDetail(p); }}
              style={{ position: 'absolute', top: 10, right: 12, padding: 0, border: 'none', background: 'transparent', cursor: 'pointer', lineHeight: 0 }}
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke={C.brand} strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
                <line x1="7" y1="17" x2="17" y2="7" />
                <polyline points="7 7 17 7 17 17" />
              </svg>
            </button>
          </div>
          <div style={{ width: '100%', height: 1.5, background: selected ? C.brand : C.bdr }} />
          <CardTail selected={selected} />
        </div>
      </div>
    );
  }

  return (
    <div
      onClick={onSelect}
      style={{
        position: 'relative',
        cursor: onSelect ? 'pointer' : 'default',
        background: '#fff',
        border,
        borderRadius: 8,
        padding: '10px 12px',
        boxShadow: '0 8px 20px rgba(0,0,0,.14)',
        width: FULL_W,
        boxSizing: 'border-box',
        ...style,
      }}
    >
      {header}
      <button
        type="button"
        aria-label="매물 상세 열기"
        onClick={(e) => { e.stopPropagation(); onOpenDetail(p); }}
        style={{ position: 'absolute', top: 10, right: 12, padding: 0, border: 'none', background: 'transparent', cursor: 'pointer', lineHeight: 0 }}
      >
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke={C.brand} strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
          <line x1="7" y1="17" x2="17" y2="7" />
          <polyline points="7 7 17 7 17 17" />
        </svg>
      </button>
    </div>
  );
}

export { MAP_STATUS, TL };
