import React, { useEffect, useMemo, useRef, useState } from 'react';
import { GANGNAM_GU_CENTER, MAP_CADASTRAL_MAX_ZOOM_LEVEL, MAP_PROPERTY_DETAIL_LEVEL_100M } from '../features/map/mapDefaults.js';
import { useNaverMaps } from '../hooks/useNaverMaps.js';
import {
  propGeocodeQueries,
  propJibunAddr,
  propJibunGeocodeQueries,
} from '../utils/propAddress.js';
import { coordsFromProperty } from '../services/naver/propertyGeocode.js';
import {
  createNaverMap,
  geocodeAddressVariants,
  latLng,
} from '../services/naver/naverMaps.js';
import { setMapOverlayLayer } from '../features/map/mapLayers.js';

const DETAIL_MAP_LEVEL = MAP_PROPERTY_DETAIL_LEVEL_100M;
const C = { bdr: '#E8EAED', txM: '#6B7280', txP: '#94A3B8', surf2: '#F8F9FB' };

/** @param {{ lat: number, lng: number }|null|undefined} point */
function isValidPoint(point) {
  return point
    && Number.isFinite(point.lat)
    && Number.isFinite(point.lng);
}

/** @param {Record<string, unknown>|null|undefined} property */
function buildDetailGeocodePlan(property) {
  const jibunQueries = propJibunGeocodeQueries(property);
  const allQueries = propGeocodeQueries(property);
  const primary = jibunQueries[0] || allQueries[0] || '';
  const seen = new Set();
  const fallbacks = [];
  for (const q of [...jibunQueries.slice(1), ...allQueries]) {
    const t = String(q || '').trim();
    if (!t || t === primary || seen.has(t)) continue;
    seen.add(t);
    fallbacks.push(t);
  }
  return { primary, fallbacks };
}

/**
 * 매물 상세 — 사진 옆 지번 지도 (매물별 독립 인스턴스, 지번 지오코딩 + 핀)
 * @param {{
 *   property: { id?: number, jibunAddr?: string, addr?: string, roadAddr?: string, bldg?: string, mapLat?: number, mapLng?: number }|null|undefined,
 *   useDistrict?: boolean,
 *   level?: number,
 * }} props
 */
export function PropertyDetailMap({ property, useDistrict = false, level }) {
  const mapLevel = Number.isFinite(level)
    ? level
    : (useDistrict ? MAP_CADASTRAL_MAX_ZOOM_LEVEL : DETAIL_MAP_LEVEL);
  const containerRef = useRef(null);
  const mapRef = useRef(null);
  const markerRef = useRef(null);
  const { naver, status: sdkStatus } = useNaverMaps();

  const [status, setStatus] = useState('loading');
  const [hint, setHint] = useState('');

  const propertyId = property?.id;
  const jibunAddr = useMemo(
    () => propJibunAddr(property)?.trim() || '',
    [propertyId, property?.jibunAddr, property?.addr],
  );
  const mapLat = property?.mapLat;
  const mapLng = property?.mapLng;

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return undefined;

    if (sdkStatus === 'no-key') {
      setStatus('no-key');
      setHint('네이버 지도 API 키가 설정되지 않았습니다.');
      return undefined;
    }
    if (sdkStatus === 'error') {
      setStatus('error');
      setHint('지도를 불러오지 못했습니다.');
      return undefined;
    }
    if (sdkStatus !== 'ready' || !naver) {
      setStatus('loading');
      setHint('');
      return undefined;
    }

    let cancelled = false;
    /** @type {import('../services/naver/naverMaps.js').GeoPoint|null} */
    let resolvedPoint = null;

    const destroyMap = () => {
      if (markerRef.current) {
        try { markerRef.current.setMap(null); } catch { /* ignore */ }
        markerRef.current = null;
      }
      try { mapRef.current?.destroy?.(); } catch { /* ignore */ }
      mapRef.current = null;
      try { container.replaceChildren(); } catch { /* ignore */ }
    };

    const placePin = (map, point, title) => {
      if (!isValidPoint(point)) return;
      const coords = latLng(point.lat, point.lng);
      map.setCenter(coords);
      map.setLevel(mapLevel);
      if (markerRef.current) {
        markerRef.current.setPosition(coords);
        markerRef.current.setTitle?.(title || '');
      } else {
        markerRef.current = new naver.maps.Marker({
          map,
          position: coords,
          title: title || '',
          zIndex: 20,
        });
      }
    };

    destroyMap();
    setStatus('loading');
    setHint('');

    (async () => {
      try {
        const map = createNaverMap(container, {
          lat: GANGNAM_GU_CENTER.lat,
          lng: GANGNAM_GU_CENTER.lng,
          level: mapLevel,
          interactive: true,
        });
        mapRef.current = map;
        if (useDistrict) setMapOverlayLayer(map, 'useDistrict', true);

        if (!jibunAddr || jibunAddr === '—') {
          if (!cancelled) {
            setStatus('ready');
            setHint('지번주소가 없어 기본 위치를 표시합니다.');
          }
          return;
        }

        const { primary, fallbacks } = buildDetailGeocodePlan(property);

        if (primary) {
          resolvedPoint = await geocodeAddressVariants(primary, fallbacks);
        }

        if (!isValidPoint(resolvedPoint)) {
          const stored = coordsFromProperty(property);
          if (isValidPoint(stored)) resolvedPoint = stored;
        }

        if (cancelled) return;

        if (isValidPoint(resolvedPoint)) {
          placePin(map, resolvedPoint, jibunAddr);
          setStatus('ready');
          setHint('');
          return;
        }

        setStatus('ready');
        setHint('지번주소를 지도에서 찾지 못했습니다.');
      } catch {
        if (!cancelled) {
          setStatus('error');
          setHint('지도를 불러오지 못했습니다.');
        }
      }
    })();

    return () => {
      cancelled = true;
      destroyMap();
    };
  }, [propertyId, jibunAddr, mapLat, mapLng, property, naver, sdkStatus, useDistrict, mapLevel]);

  return (
    <div style={{ position: 'relative', width: '100%', height: '100%', background: C.surf2 }}>
      <div ref={containerRef} style={{ width: '100%', height: '100%' }} />
      {status === 'loading' && (
        <div style={{
          position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center',
          background: 'rgba(248,249,251,.72)', fontSize: 12, color: C.txM, pointerEvents: 'none',
        }}>
          지번 위치 조회 중…
        </div>
      )}
      {hint && status !== 'loading' && (
        <div style={{
          position: 'absolute', left: 8, right: 8, bottom: 8, padding: '6px 8px', borderRadius: 6,
          background: 'rgba(255,255,255,.92)', border: `1px solid ${C.bdr}`, fontSize: 11, color: C.txM,
          pointerEvents: 'none', lineHeight: 1.4,
        }}>
          {hint}
        </div>
      )}
    </div>
  );
}
