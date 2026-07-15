import {
  propDisplayAddr,
  propJibunAddr,
  propJibunGeocodeQueries,
} from '../../utils/propAddress.js';
import {
  geocodeAddressVariants,
  getKakaoMapJsKey,
  loadKakaoMaps,
} from './kakaoMaps.js';

const ADDRESS_KEYS = ['jibunAddr', 'addr', 'roadAddr', 'bldg'];

/** @param {{ mapLat?: number, mapLng?: number }|null|undefined} p */
export function propertyHasStoredCoords(p) {
  return typeof p?.mapLat === 'number'
    && typeof p?.mapLng === 'number'
    && Number.isFinite(p.mapLat)
    && Number.isFinite(p.mapLng);
}

/** @param {{ mapLat?: number, mapLng?: number }|null|undefined} p */
export function coordsFromProperty(p) {
  if (!propertyHasStoredCoords(p)) return null;
  return { lat: p.mapLat, lng: p.mapLng };
}

/**
 * 매물 상세 — 사진 옆 미니 지도 마커 (지번주소 우선)
 * @param {{ id?: number, jibunAddr?: string, addr?: string, bldg?: string, mapLat?: number, mapLng?: number }|null|undefined} p
 */
export function buildPropertyDetailMapMarker(p) {
  if (!p) return undefined;
  const queries = propJibunGeocodeQueries(p);
  const stored = coordsFromProperty(p);
  const jibun = propJibunAddr(p);
  if (!queries.length && !stored) return undefined;

  const hasJibun = Boolean((p.jibunAddr || '').trim());
  return {
    id: p.id ?? 'detail',
    address: queries[0] || jibun,
    fallbackAddresses: queries.slice(1),
    // 지번이 있으면 저장 좌표(도로명 지오코딩 잔재)보다 지번 재조회 우선
    lat: hasJibun ? undefined : stored?.lat,
    lng: hasJibun ? undefined : stored?.lng,
    title: jibun || propDisplayAddr(p),
  };
}

/** @param {Record<string, unknown>} propertyLike */
export async function geocodePropertyCoords(propertyLike) {
  if (!getKakaoMapJsKey()) return null;

  const queries = propJibunGeocodeQueries(propertyLike);
  if (!queries.length) return null;

  try {
    const kakao = await loadKakaoMaps(['services']);
    const point = await geocodeAddressVariants(kakao, queries[0], queries.slice(1));
    if (!point) return null;
    return {
      mapLat: point.lat,
      mapLng: point.lng,
      mapGeocodedAt: new Date().toISOString(),
    };
  } catch {
    return null;
  }
}

/** @param {Record<string, unknown>|null|undefined} prev @param {Record<string, unknown>|null|undefined} next */
export function shouldRefreshMapCoords(prev, next) {
  if (!prev || !next) return true;
  return ADDRESS_KEYS.some((k) => String(prev[k] || '').trim() !== String(next[k] || '').trim());
}

/**
 * 저장용 — 주소 변경 시 재지오코딩, 동일 주소면 기존 좌표 유지
 * @param {Record<string, unknown>|null|undefined} existing
 * @param {Record<string, unknown>} nextFields
 */
export async function resolveMapCoordFieldsForSave(existing, nextFields) {
  const merged = { ...existing, ...nextFields };
  if (!shouldRefreshMapCoords(existing, merged)) {
    if (propertyHasStoredCoords(existing)) {
      return {
        mapLat: existing.mapLat,
        mapLng: existing.mapLng,
        mapGeocodedAt: existing.mapGeocodedAt || null,
      };
    }
  }
  const coords = await geocodePropertyCoords(merged);
  if (coords) return coords;
  if (shouldRefreshMapCoords(existing, merged)) {
    return { mapLat: null, mapLng: null, mapGeocodedAt: null };
  }
  return {};
}

const backfillInFlight = new Set();

/**
 * 좌표 없는 매물 백필 (지도 보기 진입 시)
 * @param {Array<{ id: number } & Record<string, unknown>>} properties
 * @param {(id: number, fields: Record<string, unknown>) => Promise<void>} updateFn
 */
export async function backfillPropertyMapCoords(properties, updateFn) {
  if (!getKakaoMapJsKey()) return;

  for (const p of properties) {
    if (!p?.id || propertyHasStoredCoords(p) || backfillInFlight.has(p.id)) continue;
    if (!propJibunGeocodeQueries(p).length) continue;

    backfillInFlight.add(p.id);
    try {
      const coords = await geocodePropertyCoords(p);
      if (coords) await updateFn(p.id, coords);
    } finally {
      backfillInFlight.delete(p.id);
    }
  }
}
