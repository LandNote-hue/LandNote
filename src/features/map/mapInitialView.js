import { propSearchHaystack } from '../../utils/propAddress.js';
import { KR_GU, KR_SIDO, sidoMatch } from './regions.js';
import { MAP_DEFAULT_LEVEL_250M } from './mapDefaults.js';

/** 지도 보기 탭 기본 확대 (baseline 250m = 100%) */
export const ZOOM_MAP_TAB_DEFAULT_PERCENT = 100;

export const MAP_TAB_DEFAULT_LEVEL = MAP_DEFAULT_LEVEL_250M;

const GU_SORTED_BY_SIDO = Object.fromEntries(
  KR_SIDO.map((sido) => [
    sido,
    [...(KR_GU[sido] || [])].sort((a, b) => b.length - a.length),
  ]),
);

/** @param {string} haystack */
export function extractRegionKey(haystack) {
  const hay = String(haystack || '');
  if (!hay) return '__unknown__';

  for (const sido of KR_SIDO) {
    if (!sidoMatch(hay, sido)) continue;
    for (const gu of GU_SORTED_BY_SIDO[sido] || []) {
      if (hay.includes(gu)) return `${sido}|${gu}`;
    }
    return sido;
  }
  return '__unknown__';
}

/**
 * 등록 매물이 가장 많은 지역 중심 (지오코딩된 마커 좌표 평균)
 * @param {Array<{ id?: number } & Record<string, unknown>>} properties
 * @param {Array<{ lat: number, lng: number, data?: { id?: number } & Record<string, unknown> }>} resolved
 */
export function pickDensestRegionView(properties, resolved) {
  const geocoded = resolved.filter(
    (m) => Number.isFinite(m.lat) && Number.isFinite(m.lng),
  );
  if (!geocoded.length) return null;

  /** @type {Map<string, number>} */
  const counts = new Map();
  for (const p of properties) {
    const key = extractRegionKey(propSearchHaystack(p));
    counts.set(key, (counts.get(key) || 0) + 1);
  }

  let bestKey = null;
  let bestCount = 0;
  for (const [key, count] of counts) {
    if (key === '__unknown__') continue;
    if (count > bestCount) {
      bestCount = count;
      bestKey = key;
    }
  }

  const pool = bestKey
    ? geocoded.filter((m) => {
      const p = m.data;
      if (!p) return false;
      return extractRegionKey(propSearchHaystack(p)) === bestKey;
    })
    : [];

  const target = pool.length ? pool : geocoded;
  const lat = target.reduce((sum, m) => sum + m.lat, 0) / target.length;
  const lng = target.reduce((sum, m) => sum + m.lng, 0) / target.length;
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;

  return { lat, lng, level: MAP_TAB_DEFAULT_LEVEL };
}
