import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  MAP_CONTROL_RIGHT,
  MAP_TOOLBAR_TOP,
  MAP_TOOLBAR_MAX_WIDTH,
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
      setExportMsg('링크 복사됨');
    } catch {
      window.prompt('아래 링크를 복사하세요.', url);
      setExportMsg('링크 표시됨');
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

  return (
    <div
      style={{
        position: 'absolute',
        top: MAP_TOOLBAR_TOP,
        right: MAP_CONTROL_RIGHT,
        zIndex: 110,
        display: 'flex',
        alignItems: 'center',
        flexWrap: 'wrap',
        justifyContent: 'flex-end',
        gap: 4,
        maxWidth: MAP_TOOLBAR_MAX_WIDTH,
        pointerEvents: 'auto',
      }}
    >
      <div
        style={{
          display: 'flex',
          borderRadius: 4,
          overflow: 'hidden',
          boxShadow: '0 1px 4px rgba(0,0,0,.18)',
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
              onClick={() => applySurface(/** @type {MapSurfaceType} */ (id))}
              style={{
                ...btnBase,
                height: 32,
                padding: '0 12px',
                fontSize: 13,
                fontWeight: 500,
                color: active ? '#fff' : '#222',
                background: active ? KAKAO_BLUE : '#fff',
              }}
            >
              {label}
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
          width: 36,
          height: 32,
          borderRadius: 4,
          boxShadow: '0 1px 4px rgba(0,0,0,.18)',
          background: roadviewActive ? '#E8F3FF' : '#fff',
        }}
      >
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke={roadviewActive ? KAKAO_BLUE : '#222'} strokeWidth="1.8">
          <circle cx="12" cy="7" r="3" />
          <path d="M6 20c0-3.3 2.7-6 6-6s6 2.7 6 6" strokeLinecap="round" />
          <path d="M12 10v2" />
        </svg>
      </button>

      <div ref={layerRef} style={{ position: 'relative' }}>
        <button
          type="button"
          title="레이어"
          aria-label="레이어"
          onClick={() => setLayerOpen((v) => !v)}
          style={{
            ...btnBase,
            width: 36,
            height: 32,
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
              right: 0,
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

      <button
        type="button"
        onClick={exportMapLink}
        style={{
          ...btnBase,
          height: 32,
          padding: '0 12px',
          borderRadius: 4,
          boxShadow: '0 1px 4px rgba(0,0,0,.18)',
          fontSize: 13,
          fontWeight: 500,
          color: '#222',
        }}
      >
        {exportMsg || '내보내기'}
      </button>
    </div>
  );
}
