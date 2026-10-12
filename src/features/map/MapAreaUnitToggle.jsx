import React from 'react';
import { useIsMobile } from '../../hooks/useIsMobile.js';
import { MAP_MOBILE_INSET, MAP_MOBILE_TOOLBAR_TOP } from './mapSiteLayout.js';

const MAP_BLUE = '#3396FF';

/** @typedef {'py' | 'm2'} MapAreaUnit */

const OPTIONS = [
  { id: 'py', label: '평' },
  { id: 'm2', label: 'm²' },
];

/**
 * 지도 좌측 — 평 / ㎡ 카드 표시 전환
 * @param {{ unit: MapAreaUnit, onChange: (unit: MapAreaUnit) => void }} props
 */
export function MapAreaUnitToggle({ unit, onChange }) {
  const isMobile = useIsMobile();

  return (
    <div
      role="group"
      aria-label="면적 단위"
      style={{
        position: 'absolute',
        top: isMobile ? MAP_MOBILE_TOOLBAR_TOP + 40 : 10,
        left: isMobile ? MAP_MOBILE_INSET : 10,
        zIndex: 110,
        display: 'flex',
        flexDirection: 'column',
        overflow: 'hidden',
        borderRadius: 6,
        boxShadow: '0 1px 4px rgba(0,0,0,.18)',
        pointerEvents: 'auto',
      }}
    >
      {OPTIONS.map(({ id, label }) => {
        const active = unit === id;
        return (
          <button
            key={id}
            type="button"
            aria-pressed={active}
            onClick={() => onChange(/** @type {MapAreaUnit} */ (id))}
            style={{
              width: isMobile ? 36 : 40,
              height: isMobile ? 32 : 36,
              border: 'none',
              background: active ? MAP_BLUE : '#fff',
              color: active ? '#fff' : '#222',
              fontSize: 13,
              fontWeight: 700,
              cursor: 'pointer',
              fontFamily: 'inherit',
              lineHeight: 1,
            }}
          >
            {label}
          </button>
        );
      })}
    </div>
  );
}
