import React from 'react';
import { PROP_STATUS_LABEL, propStatusStyle } from '../../utils/propStatus.js';
import { BRAND_CSS } from '../../theme/dealModeTheme.js';
import {
  typeTheme, kindLabel, priceLine, compactPrice, landPyLabel, floorPyLabel, landAreaLabel, MAP_TRADE_LABEL,
} from './mapCardMeta.js';

const C = {
  brand: BRAND_CSS.brand,
  txD: '#374151',
  txM: '#6B7280',
};

export const MAP_STATUS = {
  NEW: { l: PROP_STATUS_LABEL.NEW, c: propStatusStyle('NEW').color },
  ACTIVE: { l: PROP_STATUS_LABEL.ACTIVE, c: propStatusStyle('ACTIVE').color },
  HOLD: { l: PROP_STATUS_LABEL.HOLD, c: propStatusStyle('HOLD').color },
  COMPLETED: { l: PROP_STATUS_LABEL.COMPLETED, c: propStatusStyle('COMPLETED').color },
};

const TL = MAP_TRADE_LABEL;

function ZoomOutBadge({ p, selected, areaUnit = 'py' }) {
  const theme = typeTheme(p);
  const price = compactPrice(p);
  const land = landAreaLabel(p, areaUnit);
  const shadow = selected
    ? `0 4px 12px rgba(15,23,42,.16), 0 0 0 1.5px ${theme.pin}`
    : '0 2px 8px rgba(15,23,42,.12), 0 0 0 1px rgba(15,23,42,.06)';

  return (
    <div style={{
      display: 'flex',
      alignItems: 'stretch',
      background: '#fff',
      borderRadius: 8,
      overflow: 'hidden',
      boxShadow: shadow,
      width: 'max-content',
    }}>
      <div style={{ width: 3, flexShrink: 0, background: theme.pin }} />
      <div style={{ padding: '4px 8px 4px 7px', lineHeight: 1.2 }}>
        {price && (
          <div style={{
            fontSize: 12,
            fontWeight: 800,
            color: theme.text,
            letterSpacing: '-0.03em',
            whiteSpace: 'nowrap',
          }}>{price}</div>
        )}
        {land && (
          <div style={{
            fontSize: 10,
            fontWeight: 400,
            color: C.txM,
            marginTop: price ? 1 : 0,
            whiteSpace: 'nowrap',
          }}>{land}</div>
        )}
      </div>
    </div>
  );
}

function CompactCardBody({ p, compact, areaUnit = 'py' }) {
  const theme = typeTheme(p);
  const kind = kindLabel(p);
  const price = priceLine(p);
  const landPy = landPyLabel(p, areaUnit);
  const floorPy = floorPyLabel(p, areaUnit);
  const pySize = compact ? 10 : 11;

  return (
    <div style={{ display: 'flex', alignItems: 'stretch', minWidth: 0 }}>
      <div style={{ width: 4, flexShrink: 0, background: theme.pin }} />
      <div style={{
        padding: compact ? '8px 10px 8px 10px' : '10px 12px',
        minWidth: 0,
        ...(!compact ? { paddingRight: 28 } : {}),
      }}>
        {(price || kind) && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap', lineHeight: 1.25 }}>
            {price && (
              <span style={{
                fontSize: compact ? 13 : 15,
                fontWeight: 800,
                color: theme.text,
                letterSpacing: '-0.03em',
                whiteSpace: 'nowrap',
              }}>{price}</span>
            )}
            {kind && (
              <span style={{
                fontSize: compact ? 11 : 12,
                fontWeight: 700,
                color: C.txD,
                lineHeight: 1.3,
                flexShrink: 0,
              }}>{kind}</span>
            )}
          </div>
        )}
        {landPy && (
          <div style={{ fontSize: pySize, fontWeight: 400, color: C.txM, marginTop: 5, lineHeight: 1.35 }}>{landPy}</div>
        )}
        {floorPy && (
          <div style={{ fontSize: pySize, fontWeight: 400, color: C.txM, marginTop: 2, lineHeight: 1.35 }}>{floorPy}</div>
        )}
      </div>
    </div>
  );
}

export function MapMiniCard({ p, selected, onSelect, inline }) {
  return (
    <MapInfoCard
      p={p}
      selected={selected}
      onSelect={onSelect}
      inline={inline}
      mode="mini"
    />
  );
}

export function MapInfoCard({
  p, onOpenDetail, style, inline, selected, onSelect, mode = 'full', areaUnit = 'py',
}) {
  if (mode === 'none') {
    return (
      <div onClick={inline ? undefined : onSelect} style={{ cursor: onSelect || inline ? 'pointer' : 'default', ...style }}>
        <ZoomOutBadge p={p} selected={selected} areaUnit={areaUnit} />
      </div>
    );
  }

  const compact = mode === 'mini';
  const theme = typeTheme(p);
  const radius = compact ? 12 : 14;
  const shadow = selected
    ? `0 8px 22px rgba(15,23,42,.16), 0 0 0 1.5px ${theme.pin}`
    : '0 4px 14px rgba(15,23,42,.12), 0 0 0 1px rgba(15,23,42,.06)';

  const shell = (
    <div
      onClick={inline ? undefined : onSelect}
      style={{
        position: 'relative',
        cursor: onSelect || inline ? 'pointer' : 'default',
        background: '#fff',
        borderRadius: radius,
        overflow: 'hidden',
        boxShadow: shadow,
        width: 'max-content',
        maxWidth: compact ? 176 : 208,
        boxSizing: 'border-box',
        ...style,
      }}
    >
      <CompactCardBody p={p} compact={compact} areaUnit={areaUnit} />
      {!compact && onOpenDetail && (
        <button
          type="button"
          aria-label="매물 상세 열기"
          onClick={(e) => { e.stopPropagation(); onOpenDetail(p); }}
          style={{ position: 'absolute', top: 8, right: 8, padding: 0, border: 'none', background: 'transparent', cursor: 'pointer', lineHeight: 0, opacity: 0.45 }}
        >
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke={C.brand} strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
            <line x1="7" y1="17" x2="17" y2="7" />
            <polyline points="7 7 17 7 17 17" />
          </svg>
        </button>
      )}
    </div>
  );

  if (inline) return shell;
  return shell;
}

export { TL };
