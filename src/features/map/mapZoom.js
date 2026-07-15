/** 카카오맵 level: 숫자가 작을수록 확대. baseline level = 100% */
export const ZOOM_MINI_PERCENT = 100;
export const ZOOM_FULL_PERCENT = 200;
export const ZOOM_CLUSTER_PERCENT = 50;
/** 지도검색(장소·주소) 선택 시 이동 줌 */
export const ZOOM_PLACE_SEARCH_PERCENT = 1800;
export const FALLBACK_BASELINE_LEVEL = 8;
export const KAKAO_MAP_MIN_LEVEL = 1;
export const KAKAO_MAP_MAX_LEVEL = 14;

/** @param {number} mapLevel @param {number | null | undefined} baselineLevel */
export function kakaoLevelToZoomPercent(mapLevel, baselineLevel) {
  const base = baselineLevel ?? FALLBACK_BASELINE_LEVEL;
  return Math.round(100 * (2 ** (base - mapLevel)));
}

/**
 * 줌 % → 카카오맵 level (baseline 대비)
 * @param {number} zoomPercent
 * @param {number | null | undefined} baselineLevel
 */
export function kakaoLevelFromZoomPercent(zoomPercent, baselineLevel) {
  const base = baselineLevel ?? FALLBACK_BASELINE_LEVEL;
  if (!Number.isFinite(zoomPercent) || zoomPercent <= 0) return base;
  const level = base - Math.log2(zoomPercent / 100);
  return Math.min(
    KAKAO_MAP_MAX_LEVEL,
    Math.max(KAKAO_MAP_MIN_LEVEL, Math.round(level)),
  );
}

/** @param {number} mapLevel @param {number | null | undefined} baselineLevel */
export function getZoomPercentLabel(mapLevel, baselineLevel) {
  return `${kakaoLevelToZoomPercent(mapLevel, baselineLevel)}%`;
}
