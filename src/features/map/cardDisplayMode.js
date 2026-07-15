/** @typedef {'none' | 'mini' | 'full'} CardDisplayMode */

import {
  ZOOM_FULL_PERCENT,
  ZOOM_MINI_PERCENT,
  FALLBACK_BASELINE_LEVEL,
  kakaoLevelToZoomPercent,
} from './mapZoom.js';

export {
  kakaoLevelToZoomPercent,
  getZoomPercentLabel,
  ZOOM_FULL_PERCENT,
  ZOOM_MINI_PERCENT,
  FALLBACK_BASELINE_LEVEL,
} from './mapZoom.js';

/** @param {number} mapLevel @param {number | null | undefined} [baselineLevel] */
export function getCardDisplayMode(mapLevel, baselineLevel) {
  const pct = kakaoLevelToZoomPercent(mapLevel, baselineLevel);
  if (pct >= ZOOM_FULL_PERCENT) return 'full';
  if (pct >= ZOOM_MINI_PERCENT) return 'mini';
  return 'none';
}
/** @param {CardDisplayMode} mode */
export function getCardDisplayModeLabel(mode) {
  if (mode === 'none') return '핀·클러스터';
  if (mode === 'mini') return '미니 카드';
  return '전체 카드';
}

export const KAKAO_MAP_MIN_LEVEL = 1;
export const KAKAO_MAP_MAX_LEVEL = 14;
