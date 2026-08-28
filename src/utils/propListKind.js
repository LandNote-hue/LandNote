/** 매물관리 목록 구분 — 임대 탭은 월세·전세·단기만 모아 별도 표시 */

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
  { id: 'NEW', label: '신규' },
  { id: 'ACTIVE', label: '진행중' },
  { id: 'HOLD', label: '보류' },
  { id: 'COMPLETED', label: '계약완료' },
  { id: PROP_LIST_TAB_RENT, label: '임대', separate: true },
];

export const PROP_LIST_TAB_IDS = new Set(PROP_LIST_TABS.map((t) => t.id));

export function normalizePropListTab(tab) {
  return PROP_LIST_TAB_IDS.has(tab) ? tab : 'ALL';
}

export function isRentListTab(tab) {
  return tab === PROP_LIST_TAB_RENT;
}

export function tradesForListTab(tab) {
  return isRentListTab(tab) ? PROP_RENTAL_TRADES : PROP_ALL_TRADES;
}

export function tradeAllowedOnTab(trade, tab) {
  if (!trade) return true;
  return tradesForListTab(tab).includes(trade);
}

/**
 * 탭별 목록 소속 (검색·필터 이전).
 * 기존 탭은 전체 매물, 임대 탭은 전세·월세·단기만.
 * @param {{ trade?: string, status?: string, fav?: boolean }} p
 * @param {string} statusTab
 * @param {{ inFolder?: boolean }} [opts]
 */
export function propertyBelongsToListTab(p, statusTab, opts = {}) {
  if (isRentListTab(statusTab)) return isRentalListProperty(p);
  if (statusTab === 'ALL') return true;
  if (statusTab === 'FAV') return !!p.fav;
  if (statusTab === 'FOLDER') return Boolean(opts.inFolder);
  return p.status === statusTab;
}

/** @param {Array<{ id?: number, trade?: string, status?: string, fav?: boolean }>} props */
export function countForListTab(props, tabId, propFolders) {
  if (tabId === PROP_LIST_TAB_RENT) return props.filter(isRentalListProperty).length;
  if (tabId === 'FAV') return props.filter((p) => p.fav).length;
  if (tabId === 'FOLDER') {
    return props.filter((p) => (propFolders?.[p.id] || []).length > 0).length;
  }
  if (tabId === 'ALL') return props.length;
  return props.filter((p) => p.status === tabId).length;
}
