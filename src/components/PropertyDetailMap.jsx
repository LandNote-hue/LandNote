import React, { useEffect, useMemo, useRef, useState } from 'react';
import { GANGNAM_GU_CENTER, MAP_PROPERTY_DETAIL_LEVEL_100M } from '../features/map/mapDefaults.js';
import {
  propGeocodeQueries,
  propJibunAddr,
  propJibunGeocodeQueries,
} from '../utils/propAddress.js';
import { coordsFromProperty } from '../services/kakao/propertyGeocode.js';
import {
  geocodeAddressVariants,
  getKakaoMapJsKey,
  loadKakaoMaps,
} from '../services/kakao/kakaoMaps.js';

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
 * KakaoMap.jsx 인프라는 사용하지 않고 kakaoMaps.js 서비스만 활용.
 * @param {{ property: { id?: number, jibunAddr?: string, addr?: string, roadAddr?: string, bldg?: string, mapLat?: number, mapLng?: number }|null|undefined }} props
 */
export function PropertyDetailMap({ property }) {
  const containerRef = useRef(null);
  const mapRef = useRef(null);
  const markerRef = useRef(null);

  const [status, setStatus] = useState('loading');
  const [hint, setHint] = useState('');

  const propertyId = property?.id;
  const jibunAddr = useMemo(
    () => propJibunAddr(property)?.trim() || '',
    [propertyId, property?.jibunAddr, property?.addr],
  );

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return undefined;

    let cancelled = false;
    /** @type {import('../services/kakao/kakaoMaps.js').GeoPoint|null} */
    let resolvedPoint = null;

    const destroyMap = () => {
      if (markerRef.current) {
        try { markerRef.current.setMap(null); } catch { /* ignore */ }
        markerRef.current = null;
      }
      mapRef.current = null;
      try { container.replaceChildren(); } catch { /* ignore */ }
    };

    const placePin = (kakao, map, point, title) => {
      if (!isValidPoint(point)) return;
      const coords = new kakao.maps.LatLng(point.lat, point.lng);
      map.setCenter(coords);
      map.setLevel(DETAIL_MAP_LEVEL);
      if (markerRef.current) {
        markerRef.current.setPosition(coords);
        markerRef.current.setTitle(title || '');
      } else {
        markerRef.current = new kakao.maps.Marker({
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
        if (!getKakaoMapJsKey()) {
          if (!cancelled) {
            setStatus('no-key');
            setHint('카카오맵 API 키가 설정되지 않았습니다.');
          }
          return;
        }

        const kakao = await loadKakaoMaps(['services']);
        if (cancelled) return;

        const map = new kakao.maps.Map(container, {
          center: new kakao.maps.LatLng(GANGNAM_GU_CENTER.lat, GANGNAM_GU_CENTER.lng),
          level: DETAIL_MAP_LEVEL,
          draggable: true,
          scrollwheel: true,
        });
        mapRef.current = map;

        if (!jibunAddr || jibunAddr === '—') {
          if (!cancelled) {
            setStatus('ready');
            setHint('지번주소가 없어 기본 위치를 표시합니다.');
          }
          return;
        }

        const { primary, fallbacks } = buildDetailGeocodePlan(property);

        if (primary && kakao?.maps?.services?.Geocoder) {
          resolvedPoint = await geocodeAddressVariants(kakao, primary, fallbacks);
        }

        if (!isValidPoint(resolvedPoint)) {
          const stored = coordsFromProperty(property);
          if (isValidPoint(stored)) resolvedPoint = stored;
        }

        if (cancelled) return;

        if (isValidPoint(resolvedPoint)) {
          placePin(kakao, map, resolvedPoint, jibunAddr);
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
  }, [propertyId, jibunAddr, property]);

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
