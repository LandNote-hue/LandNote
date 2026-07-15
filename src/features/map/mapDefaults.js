/** 강남구청 인근 — 지도 보기 기본 중심 */
export const GANGNAM_GU_CENTER = { lat: 37.517305, lng: 127.047502 };

/** 카카오맵 level ≈ 250m 축척 (위도 37.5° 기준) — 줌 100% 기준 */
export const MAP_DEFAULT_LEVEL_250M = 6;

/** 전체 카드 표시 줌 (baseline 250m 대비 800%) */
export const MAP_DETAIL_CARD_LEVEL = 3;

/** 매물 상세 지도 기본 축척 ≈ 100m (250m baseline @ level 6 → level 5 ≈ 125m) */
export const MAP_PROPERTY_DETAIL_LEVEL_100M = 5;

/** @param {{ lat: number, lng: number }} point @param {{ south: number, west: number, north: number, east: number }} bounds */
export function isPointInMapBounds(point, bounds) {
  return (
    point.lat >= bounds.south
    && point.lat <= bounds.north
    && point.lng >= bounds.west
    && point.lng <= bounds.east
  );
}
