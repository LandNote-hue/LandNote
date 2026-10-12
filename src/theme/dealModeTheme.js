export const DEAL_MODE_SALE = 'sale';
export const DEAL_MODE_RENT = 'rent';

export const DEAL_MODE_STORAGE_KEY = 'landnote.dealMode';

export const DEAL_THEMES = {
  [DEAL_MODE_SALE]: {
    brand: '#C8102E',
    brandD: '#A00E25',
    brandL: '#FBE9EC',
    rgb: '200, 16, 46',
    pinIdle: '#64748B',
  },
  [DEAL_MODE_RENT]: {
    brand: '#2563EB',
    brandD: '#1D4ED8',
    brandL: '#EFF6FF',
    rgb: '37, 99, 235',
    pinIdle: '#64748B',
  },
};

/** inline style에서 CSS 변수로 테마 색을 따름 */
export const BRAND_CSS = {
  brand: 'var(--ln-brand)',
  brandD: 'var(--ln-brand-d)',
  brandL: 'var(--ln-brand-l)',
};

export function normalizeDealMode(value) {
  return value === DEAL_MODE_RENT ? DEAL_MODE_RENT : DEAL_MODE_SALE;
}

export function loadDealMode() {
  try {
    return normalizeDealMode(localStorage.getItem(DEAL_MODE_STORAGE_KEY));
  } catch {
    return DEAL_MODE_SALE;
  }
}

export function saveDealMode(mode) {
  try {
    localStorage.setItem(DEAL_MODE_STORAGE_KEY, normalizeDealMode(mode));
  } catch {
    /* ignore */
  }
}

export function themeForDealMode(mode) {
  return DEAL_THEMES[normalizeDealMode(mode)];
}
