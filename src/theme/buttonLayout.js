/** 사이드바 탭 제외 앱 공통 버튼 — 디자인 기준 대비 90% */
export const BUTTON_SCALE = 0.9;

/** @param {number} n 디자인 기준 px */
export function btnPx(n) {
  return Math.round(n * BUTTON_SCALE * 10) / 10;
}

/** @type {Record<'sm'|'md'|'lg', { fontSize: number, height: number, borderRadius: number, padX: number, icon: number }>} */
export const BTN_SIZE = {
  sm: {
    fontSize: btnPx(12),
    height: btnPx(28),
    borderRadius: btnPx(6),
    padX: btnPx(10),
    icon: btnPx(12),
  },
  md: {
    fontSize: btnPx(14),
    height: btnPx(36),
    borderRadius: btnPx(7),
    padX: btnPx(14),
    icon: btnPx(14),
  },
  lg: {
    fontSize: btnPx(15),
    height: btnPx(40),
    borderRadius: btnPx(8),
    padX: btnPx(18),
    icon: btnPx(15),
  },
};

/** @param {'sm'|'md'|'lg'} [size='md'] */
export function btnSizeStyle(size = 'md') {
  const s = BTN_SIZE[size] || BTN_SIZE.md;
  return {
    height: s.height,
    fontSize: s.fontSize,
    borderRadius: s.borderRadius,
    padding: `0 ${s.padX}px`,
  };
}
