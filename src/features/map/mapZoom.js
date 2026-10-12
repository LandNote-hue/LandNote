import { MAP_MAX_LEVEL, MAP_MIN_LEVEL } from '../../services/naver/mapLevel.js';

/** 지도 level: 숫자가 작을수록 확대. baseline level = 100% */
export const ZOOM_MINI_PERCENT = 100;
export const ZOOM_FULL_PERCENT = 200;
export const ZOOM_CLUSTER_PERCENT = 50;
/** 지도검색(장소·주소) 선택 시 이동 줌 */
export const ZOOM_PLACE_SEARCH_PERCENT = 1800;
export const FALLBACK_BASELINE_LEVEL = 8;
export { MAP_MIN_LEVEL, MAP_MAX_LEVEL };

/** @param {number} mapLevel @param {number | null | undefined} baselineLevel */
export function mapLevelToZoomPercent(mapLevel, baselineLevel) {
  const base = baselineLevel ?? FALLBACK_BASELINE_LEVEL;
  return Math.round(100 * (2 ** (base - mapLevel)));
}

/**
 * 줌 % → 지도 level (baseline 대비)
 * @param {number} zoomPercent
 * @param {number | null | undefined} baselineLevel
 */
export function mapLevelFromZoomPercent(zoomPercent, baselineLevel) {
  const base = baselineLevel ?? FALLBACK_BASELINE_LEVEL;
  if (!Number.isFinite(zoomPercent) || zoomPercent <= 0) return base;
  const level = base - Math.log2(zoomPercent / 100);
  return Math.min(
    MAP_MAX_LEVEL,
    Math.max(MAP_MIN_LEVEL, Math.round(level)),
  );
}

/** @param {number} mapLevel @param {number | null | undefined} baselineLevel */
export function getZoomPercentLabel(mapLevel, baselineLevel) {
  return `${mapLevelToZoomPercent(mapLevel, baselineLevel)}%`;
}
