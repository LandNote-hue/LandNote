/** 탭 페이지 공통 상단 타이틀 영역 — 디자인 기준 대비 90% */
export const PAGE_HEADER_SCALE = 0.9;

/** @param {number} n 디자인 기준 px */
export function pageHeaderPx(n) {
  return Math.round(n * PAGE_HEADER_SCALE * 10) / 10;
}

export const PAGE_HEADER_LAYOUT = {
  height: pageHeaderPx(70),
  padX: pageHeaderPx(28),
  gap: pageHeaderPx(16),
  titleSize: pageHeaderPx(20),
  subSize: pageHeaderPx(12),
  subMarginTop: pageHeaderPx(1),
};
