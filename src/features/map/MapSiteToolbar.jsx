import React, { useCallback, useEffect, useRef, useState } from 'react';
import { useIsMobile } from '../../hooks/useIsMobile.js';
import {
  MAP_CONTROL_RIGHT,
  MAP_TOOLBAR_ROW_GAP,
  MAP_MOBILE_INSET,
  MAP_MOBILE_TOOLBAR_TOP,
  MAP_MOBILE_TOOLBAR_MAX_WIDTH,
} from './mapSiteLayout.js';

const KAKAO_BLUE = '#3396FF';

/** @typedef {'roadmap' | 'skyview'} MapSurfaceType */
/** @typedef {'traffic' | 'terrain' | 'bicycle' | 'useDistrict'} MapLayerId */

const LAYER_OPTIONS = [
  { id: 'traffic', label: '교통정보' },
  { id: 'terrain', label: '지형도' },
  { id: 'bicycle', label: '자전거' },
  { id: 'useDistrict', label: '지적편집도' },
];

const LAYER_TYPE = {
  traffic: 'TRAFFIC',
  terrain: 'TERRAIN',
  bicycle: 'BICYCLE',
  useDistrict: 'USE_DISTRICT',
};

const btnBase = {
  border: 'none',
  background: '#fff',
  cursor: 'pointer',
  fontFamily: 'inherit',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
};

/** @param {{
 *   map: object | null,
 *   kakao: typeof window.kakao | null,
 *   mapReady: boolean,
 *   roadviewActive?: boolean,
 *   onRoadviewToggle?: () => void,
 * }} props */
export function MapSiteToolbar({
  map,
  kakao,
  mapReady,
  roadviewActive = false,
  onRoadviewToggle,
}) {
  const isMobile = useIsMobile();
  const [surface, setSurface] = useState(/** @type {MapSurfaceType} */ ('roadmap'));
  const [layerOpen, setLayerOpen] = useState(false);
  const [activeLayers, setActiveLayers] = useState(/** @type {Set<MapLayerId>} */ (new Set()));
  const [exportMsg, setExportMsg] = useState('');
  const layerRef = useRef(null);

  const applySurface = useCallback((next) => {
    if (!map || !kakao?.maps?.MapTypeId) return;
    setSurface(next);
    map.setMapTypeId(next === 'skyview' ? kakao.maps.MapTypeId.HYBRID : kakao.maps.MapTypeId.ROADMAP);
  }, [map, kakao]);

  const toggleLayer = useCallback((layerId) => {
    if (!map || !kakao?.maps?.MapTypeId) return;
    const typeKey = LAYER_TYPE[layerId];
    const typeId = kakao.maps.MapTypeId[typeKey];
    if (!typeId) return;

    setActiveLayers((prev) => {
      const next = new Set(prev);
      if (next.has(layerId)) {
        next.delete(layerId);
        map.removeOverlayMapTypeId(typeId);
      } else {
        next.add(layerId);
        map.addOverlayMapTypeId(typeId);
      }
      return next;
    });
  }, [map, kakao]);

  const exportMapLink = useCallback(async () => {
    if (!map) return;
    const center = map.getCenter();
    const lat = center.getLat();
    const lng = center.getLng();
    const lvl = map.getLevel();
    const url = `https://map.kakao.com/link/map/${lat},${lng},${lvl}`;

    try {
      await navigator.clipboard.writeText(url);
      setExportMsg('복사됨');
    } catch {
      window.prompt('아래 링크를 복사하세요.', url);
      setExportMsg('표시됨');
    }
    setTimeout(() => setExportMsg(''), 1800);
  }, [map]);

  useEffect(() => {
    if (!layerOpen) return;
    const onDoc = (e) => {
      if (layerRef.current && !layerRef.current.contains(e.target)) setLayerOpen(false);
    };
    document.addEventListener('mousedown', onDoc);
    return () => document.removeEventListener('mousedown', onDoc);
  }, [layerOpen]);

  useEffect(() => {
    if (!mapReady) {
      setSurface('roadmap');
      setActiveLayers(new Set());
      setLayerOpen(false);
    }
  }, [mapReady]);

  useEffect(() => {
    if (!mapReady) return undefined;
    return () => {
      const mapInstance = map;
      const kakaoInstance = kakao;
      if (!mapInstance || !kakaoInstance?.maps?.MapTypeId) return;
      const { MapTypeId } = kakaoInstance.maps;
      [MapTypeId.TRAFFIC, MapTypeId.TERRAIN, MapTypeId.BICYCLE, MapTypeId.USE_DISTRICT]
        .filter(Boolean)
        .forEach((typeId) => {
          try { mapInstance.removeOverlayMapTypeId(typeId); } catch { /* ignore */ }
        });
    };
  }, [mapReady, map, kakao]);

  if (!mapReady || !map || !kakao) return null;

  const btnH = 32;

  return (
    <div
      style={isMobile ? {
        position: 'absolute',
        top: MAP_MOBILE_TOOLBAR_TOP,
        left: MAP_MOBILE_INSET,
        zIndex: 110,
        display: 'flex',
        alignItems: 'center',
        flexWrap: 'nowrap',
        gap: 4,
        maxWidth: MAP_MOBILE_TOOLBAR_MAX_WIDTH,
        overflowX: 'auto',
        WebkitOverflowScrolling: 'touch',
        pointerEvents: 'auto',
        scrollbarWidth: 'none',
      } : {
        position: 'absolute',
        top: '50%',
        right: MAP_CONTROL_RIGHT,
        transform: 'translateY(-50%)',
        zIndex: 110,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        gap: MAP_TOOLBAR_ROW_GAP,
        pointerEvents: 'auto',
      }}
    >
      <div
        style={{
          display: 'flex',
          flexDirection: isMobile ? 'row' : 'column',
          borderRadius: 4,
          overflow: 'hidden',
          boxShadow: '0 1px 4px rgba(0,0,0,.18)',
          flexShrink: 0,
        }}
      >
        {[
          ['roadmap', '지도'],
          ['skyview', '스카이뷰'],
        ].map(([id, label]) => {
          const active = surface === id;
          return (
            <button
              key={id}
              type="button"
              title={label}
              aria-label={label}
              aria-pressed={active}
              onClick={() => applySurface(/** @type {MapSurfaceType} */ (id))}
              style={{
                ...btnBase,
                width: isMobile ? 32 : 36,
                height: btnH,
                color: active ? '#fff' : '#222',
                background: active ? KAKAO_BLUE : '#fff',
              }}
            >
              {id === 'roadmap' ? (
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                  <polygon points="1 6 1 21 8 18 16 21 23 18 23 3 16 6 8 3 1 6" />
                  <line x1="8" y1="3" x2="8" y2="18" />
                  <line x1="16" y1="6" x2="16" y2="21" />
                </svg>
              ) : (
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                  <rect x="3" y="3" width="18" height="18" rx="2" />
                  <path d="M3 9h18M3 15h18M9 3v18M15 3v18" />
                </svg>
              )}
            </button>
          );
        })}
      </div>

      <button
        type="button"
        title={roadviewActive ? '로드뷰 닫기 (지도 클릭으로 위치 변경)' : '로드뷰 열기'}
        aria-label="로드뷰"
        aria-pressed={roadviewActive}
        onClick={onRoadviewToggle}
        style={{
          ...btnBase,
          width: isMobile ? 32 : 36,
          height: btnH,
          borderRadius: 4,
          boxShadow: '0 1px 4px rgba(0,0,0,.18)',
          background: roadviewActive ? '#E8F3FF' : '#fff',
          flexShrink: 0,
        }}
      >
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke={roadviewActive ? KAKAO_BLUE : '#222'} strokeWidth="1.8">
          <circle cx="12" cy="7" r="3" />
          <path d="M6 20c0-3.3 2.7-6 6-6s6 2.7 6 6" strokeLinecap="round" />
          <path d="M12 10v2" />
        </svg>
      </button>

      <div ref={layerRef} style={{ position: 'relative', flexShrink: 0 }}>
        <button
          type="button"
          title="레이어"
          aria-label="레이어"
          onClick={() => setLayerOpen((v) => !v)}
          style={{
            ...btnBase,
            width: isMobile ? 32 : 36,
            height: btnH,
            borderRadius: 4,
            boxShadow: '0 1px 4px rgba(0,0,0,.18)',
            background: activeLayers.size > 0 ? '#E8F3FF' : '#fff',
          }}
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="#222">
            <path d="M12 4 4 8.5 12 13l8-4.5L12 4Z" />
            <path d="m4 13 8 4.5 8-4.5" fill="none" stroke="#222" strokeWidth="1.6" />
            <path d="m4 17.5 8 4.5 8-4.5" fill="none" stroke="#222" strokeWidth="1.6" />
          </svg>
        </button>
        {layerOpen && (
          <div
            style={{
              position: 'absolute',
              top: 'calc(100% + 4px)',
              left: isMobile ? 0 : 'auto',
              right: isMobile ? 'auto' : 0,
              minWidth: 132,
              background: '#fff',
              borderRadius: 6,
              boxShadow: '0 4px 16px rgba(0,0,0,.16)',
              padding: '6px 0',
              zIndex: 120,
            }}
          >
            {LAYER_OPTIONS.map(({ id, label }) => (
              <button
                key={id}
                type="button"
                onClick={() => toggleLayer(/** @type {MapLayerId} */ (id))}
                style={{
                  ...btnBase,
                  width: '100%',
                  justifyContent: 'flex-start',
                  padding: '8px 14px',
                  fontSize: 13,
                  color: activeLayers.has(/** @type {MapLayerId} */ (id)) ? KAKAO_BLUE : '#222',
                  fontWeight: activeLayers.has(/** @type {MapLayerId} */ (id)) ? 600 : 400,
                }}
              >
                {label}
              </button>
            ))}
          </div>
        )}
      </div>

      <div style={{ position: 'relative', flexShrink: 0 }}>
        <button
          type="button"
          title={exportMsg || '지도 링크 내보내기'}
          aria-label="내보내기"
          onClick={exportMapLink}
          style={{
            ...btnBase,
            width: isMobile ? 32 : 36,
            height: btnH,
            borderRadius: 4,
            boxShadow: '0 1px 4px rgba(0,0,0,.18)',
            background: exportMsg ? '#E8F3FF' : '#fff',
          }}
        >
          {exportMsg ? (
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke={KAKAO_BLUE} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="20 6 9 17 4 12" />
            </svg>
          ) : (
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#222" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
              <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" />
              <polyline points="15 3 21 3 21 9" />
              <line x1="10" y1="14" x2="21" y2="3" />
            </svg>
          )}
        </button>
        {exportMsg && (
          <span
            style={{
              position: 'absolute',
              top: '50%',
              right: 'calc(100% + 8px)',
              transform: 'translateY(-50%)',
              background: '#222',
              color: '#fff',
              fontSize: 11,
              fontWeight: 500,
              padding: '4px 8px',
              borderRadius: 4,
              whiteSpace: 'nowrap',
              pointerEvents: 'none',
            }}
          >
            {exportMsg}
          </span>
        )}
      </div>
    </div>
  );
}
