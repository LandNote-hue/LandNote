import React, { useEffect, useState } from 'react';
import {
  MAP_CONTROL_RIGHT,
  MAP_ZOOM_RAIL_TOP,
  MAP_ZOOM_RAIL_WIDTH,
} from './mapSiteLayout.js';

const C = {
  bdr: '#E8EAED',
  txM: '#6B7280',
  txP: '#94A3B8',
  surf2: '#F8F9FB',
};

const KAKAO_MIN_LEVEL = 1;
const KAKAO_MAX_LEVEL = 14;

/** @param {{ map: object | null, mapReady: boolean, onZoom?: (level: number) => void }} props */
export function MapZoomRail({ map, mapReady, onZoom }) {
  const [level, setLevel] = useState(KAKAO_MAX_LEVEL);

  useEffect(() => {
    if (!mapReady || !map || !map.getLevel) return;
    const sync = () => setLevel(map.getLevel());
    sync();
    const kakao = window.kakao;
    if (!kakao?.maps?.event) return;
    kakao.maps.event.addListener(map, 'zoom_changed', sync);
    return () => kakao.maps.event.removeListener(map, 'zoom_changed', sync);
  }, [map, mapReady]);

  if (!mapReady || !map) return null;

  const canZoomIn = level > KAKAO_MIN_LEVEL;
  const canZoomOut = level < KAKAO_MAX_LEVEL;

  const step = (delta) => {
    const next = Math.min(KAKAO_MAX_LEVEL, Math.max(KAKAO_MIN_LEVEL, map.getLevel() + delta));
    if (next === map.getLevel()) return;
    map.setLevel(next);
    setLevel(next);
    onZoom?.(next);
  };

  const btn = (label, delta, disabled) => (
    <button
      type="button"
      aria-label={label}
      disabled={disabled}
      onClick={() => step(delta)}
      style={{
        width: MAP_ZOOM_RAIL_WIDTH,
        height: 36,
        border: 'none',
        background: disabled ? C.surf2 : '#fff',
        color: disabled ? C.txP : C.txM,
        cursor: disabled ? 'default' : 'pointer',
        fontSize: label === '+' ? 20 : 18,
        fontWeight: 600,
        lineHeight: 1,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        fontFamily: 'inherit',
      }}
    >
      {label}
    </button>
  );

  return (
    <div
      style={{
        position: 'absolute',
        top: MAP_ZOOM_RAIL_TOP,
        right: MAP_CONTROL_RIGHT,
        zIndex: 110,
        display: 'flex',
        flexDirection: 'column',
        borderRadius: 4,
        overflow: 'hidden',
        border: `1px solid ${C.bdr}`,
        boxShadow: '0 1px 4px rgba(0,0,0,.18)',
        background: '#fff',
        pointerEvents: 'auto',
      }}
    >
      {btn('+', -1, !canZoomIn)}
      <div style={{ height: 1, background: C.bdr }} />
      {btn('−', 1, !canZoomOut)}
    </div>
  );
}
