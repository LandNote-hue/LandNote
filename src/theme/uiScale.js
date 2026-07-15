/** 앱 전역 UI 배율 — 폰트·간격·컴ponent 크기 기준 */
export const UI_SCALE = 1.1;

/** @param {number} n 디자인 기준 px */
export function scalePx(n) {
  return Math.round(n * UI_SCALE * 10) / 10;
}

/** @param {number} n 디자인 기준 font-size px */
export const fs = scalePx;
