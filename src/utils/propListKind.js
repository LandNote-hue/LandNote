/** 매물관리 목록 구분 — 임대(전세·월세·단기)는 임대 탭, 매매·분양은 전체 등 나머지 탭 */

export const PROP_LIST_TAB_RENT = 'RENT';

export const PROP_SALE_TRADES = ['SALE', 'PRESALE'];
export const PROP_RENTAL_TRADES = ['JEONSE', 'MONTHLY', 'SHORT_TERM'];
export const PROP_ALL_TRADES = ['SALE', 'JEONSE', 'MONTHLY', 'SHORT_TERM', 'PRESALE'];

export const RENT_TRADE_LABELS = {
  JEONSE: '전세',
  MONTHLY: '월세',
  SHORT_TERM: '단기임대',
};

const RENTAL_TRADE_SET = new Set(PROP_RENTAL_TRADES);

/** 전세·월세·단기 → 임대 탭 */
export function isRentalListProperty(p) {
  return RENTAL_TRADE_SET.has(p?.trade);
}

/** 매매·분양 */
export function isSaleListProperty(p) {
  return !isRentalListProperty(p);
}

export const PROP_LIST_TABS = [
  { id: 'ALL', label: '전체' },
  { id: 'FAV', label: '즐겨찾기' },
  { id: 'FOLDER', label: '폴더' },
  { id: PROP_LIST_TAB_RENT, label: '임대', separate: true },
];

/** 목록 탭에서는 숨기지만 대시보드·URL·상태 필터는 유지 */
export const PROP_LIST_STATUS_TAB_LABELS = {
  NEW: '신규',
  ACTIVE: '진행중',
  HOLD: '보류',
  COMPLETED: '계약완료',
};

export const PROP_LIST_TAB_IDS = new Set([
  ...PROP_LIST_TABS.map((t) => t.id),
  ...Object.keys(PROP_LIST_STATUS_TAB_LABELS),
]);

export function propListTabLabel(tabId) {
  const visible = PROP_LIST_TABS.find((t) => t.id === tabId);
  if (visible) return visible.label;
  return PROP_LIST_STATUS_TAB_LABELS[tabId] || '전체';
}

export function normalizePropListTab(tab) {
  return PROP_LIST_TAB_IDS.has(tab) ? tab : 'ALL';
}

export function isRentListTab(tab) {
  return tab === PROP_LIST_TAB_RENT;
}

export function tradesForListTab(tab) {
  return isRentListTab(tab) ? PROP_RENTAL_TRADES : PROP_SALE_TRADES;
}

export function tradeAllowedOnTab(trade, tab) {
  if (!trade) return true;
  return tradesForListTab(tab).includes(trade);
}

/**
 * 탭별 목록 소속 (검색·필터 이전).
 * 전체·즐겨찾기·폴더는 매매·분양만, 임대 탭은 전세·월세·단기만.
 * NEW/ACTIVE/HOLD/COMPLETED는 탭 UI에서 숨기지만 상태 필터·대시보드 링크는 유지.
 * @param {{ trade?: string, status?: string, fav?: boolean }} p
 * @param {string} statusTab
 * @param {{ inFolder?: boolean }} [opts]
 */
export function propertyBelongsToListTab(p, statusTab, opts = {}) {
  if (isRentListTab(statusTab)) return isRentalListProperty(p);
  if (!isSaleListProperty(p)) return false;
  if (statusTab === 'ALL') return true;
  if (statusTab === 'FAV') return !!p.fav;
  if (statusTab === 'FOLDER') return Boolean(opts.inFolder);
  return p.status === statusTab;
}

/** @param {Array<{ id?: number, trade?: string, status?: string, fav?: boolean }>} props */
export function countForListTab(props, tabId, propFolders) {
  if (tabId === PROP_LIST_TAB_RENT) return props.filter(isRentalListProperty).length;
  const sale = props.filter(isSaleListProperty);
  if (tabId === 'FAV') return sale.filter((p) => p.fav).length;
  if (tabId === 'FOLDER') {
    return sale.filter((p) => (propFolders?.[p.id] || []).length > 0).length;
  }
  if (tabId === 'ALL') return sale.length;
  return sale.filter((p) => p.status === tabId).length;
}
