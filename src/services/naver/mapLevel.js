/** 앱 내부 줌 level: 1=최대확대 ~ 14=축소 (네이버 zoom과 반대). */
export const MAP_MIN_LEVEL = 1;
export const MAP_MAX_LEVEL = 14;
/** 네이버 줌은 클수록 확대. level 1 → 20, level 14 → 7 */
export const NAVER_MIN_ZOOM = 7;
export const NAVER_MAX_ZOOM = 20;

/** @param {number} level */
export function mapLevelToNaverZoom(level) {
  const lv = Number(level);
  if (!Number.isFinite(lv)) return 15;
  return Math.min(NAVER_MAX_ZOOM, Math.max(NAVER_MIN_ZOOM, 21 - lv));
}

/** @param {number} zoom */
export function naverZoomToMapLevel(zoom) {
  const z = Number(zoom);
  if (!Number.isFinite(z)) return 6;
  return Math.min(MAP_MAX_LEVEL, Math.max(MAP_MIN_LEVEL, 21 - z));
}

/**
 * MapZoomRail·카드 모드가 쓰던 getLevel/setLevel을 네이버 맵에 붙인다.
 * @param {object} map
 */
export function attachMapLevelCompat(map) {
  if (!map || map.__lnLevelCompat) return map;
  map.getLevel = () => naverZoomToMapLevel(map.getZoom());
  map.setLevel = (level) => {
    map.setZoom(mapLevelToNaverZoom(level), true);
  };
  map.__lnLevelCompat = true;
  return map;
}
