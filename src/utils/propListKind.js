/** 매물관리 목록 구분 — 전역 매매/임대 모드와 함께 사용 */

export const PROP_LIST_TAB_RENT = 'RENT';

export const PROP_SALE_TRADES = ['SALE'];
export const PROP_RENTAL_TRADES = ['JEONSE', 'MONTHLY', 'SHORT_TERM'];
export const PROP_ALL_TRADES = ['SALE', 'JEONSE', 'MONTHLY', 'SHORT_TERM'];

export const RENT_TRADE_LABELS = {
  JEONSE: '전세',
  MONTHLY: '월세',
  SHORT_TERM: '단기임대',
};

const RENTAL_TRADE_SET = new Set(PROP_RENTAL_TRADES);

/** 구 분양(PRESALE) 코드 → 매매 */
export function normalizePropTrade(trade) {
  return trade === 'PRESALE' ? 'SALE' : trade;
}

/** 매매가·투자분석 등 — 구 분양 매물 포함 */
export function isSaleTrade(trade) {
  return trade === 'SALE' || trade === 'PRESALE';
}

/** 전세·월세·단기 → 임대 모드 */
export function isRentalListProperty(p) {
  return RENTAL_TRADE_SET.has(p?.trade);
}

/** 매매(구 분양 포함) */
export function isSaleListProperty(p) {
  return !isRentalListProperty(p);
}

export const PROP_LIST_TABS = [
  { id: 'ALL', label: '전체' },
  { id: 'FAV', label: '즐겨찾기' },
  { id: 'FOLDER', label: '그룹' },
];

/** 목록 탭에서는 숨기지만 대시보드·URL·상태 필터는 유지 */
export const PROP_LIST_STATUS_TAB_LABELS = {
  NEW: '준비중',
  ACTIVE: '매각중',
  HOLD: '보류',
  COMPLETED: '계약완료',
};

export const PROP_LIST_VISIBLE_TAB_IDS = new Set(PROP_LIST_TABS.map((t) => t.id));

export const PROP_LIST_TAB_IDS = new Set([
  ...PROP_LIST_TABS.map((t) => t.id),
  ...Object.keys(PROP_LIST_STATUS_TAB_LABELS),
]);

export function propListTabLabel(tabId) {
  const visible = PROP_LIST_TABS.find((t) => t.id === tabId);
  if (visible) return visible.label;
  return PROP_LIST_STATUS_TAB_LABELS[tabId] || '전체';
}

/** 구 URL ?tab=RENT 는 임대 모드 + 전체 탭으로 치환 */
export function isLegacyRentListTab(tab) {
  return tab === PROP_LIST_TAB_RENT;
}

export function isPropStatusListTab(tab) {
  return Object.prototype.hasOwnProperty.call(PROP_LIST_STATUS_TAB_LABELS, tab);
}

export function normalizePropListTab(tab) {
  if (isLegacyRentListTab(tab)) return 'ALL';
  // 목록 UI에 없는 구 상태 탭(매각중 등)은 전체에 두고, 상태 필터는 컬럼에서 적용
  return PROP_LIST_VISIBLE_TAB_IDS.has(tab) ? tab : 'ALL';
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

function scopedForDealMode(p, dealMode) {
  if (!dealMode) return true;
  return dealMode === 'rent' ? isRentalListProperty(p) : isSaleListProperty(p);
}

/**
 * 탭별 목록 소속 (검색·필터 이전).
 * @param {{ trade?: string, status?: string, fav?: boolean }} p
 * @param {string} statusTab
 * @param {{ inFolder?: boolean, dealMode?: string }} [opts]
 */
export function propertyBelongsToListTab(p, statusTab, opts = {}) {
  if (!scopedForDealMode(p, opts.dealMode)) return false;
  if (!opts.dealMode) {
    if (isRentListTab(statusTab)) return isRentalListProperty(p);
    if (!isSaleListProperty(p)) return false;
  }
  if (statusTab === 'ALL') return true;
  if (statusTab === 'FAV') return !!p.fav;
  if (statusTab === 'FOLDER') return Boolean(opts.inFolder);
  return p.status === statusTab;
}

/**
 * @param {Array<{ id?: number, trade?: string, status?: string, fav?: boolean }>} props
 * @param {string} tabId
 * @param {Record<string, unknown>} [propFolders]
 * @param {string} [dealMode]
 */
export function countForListTab(props, tabId, propFolders, dealMode) {
  if (tabId === PROP_LIST_TAB_RENT) return props.filter(isRentalListProperty).length;
  const base = dealMode
    ? props.filter((p) => scopedForDealMode(p, dealMode))
    : props.filter(isSaleListProperty);
  if (tabId === 'FAV') return base.filter((p) => p.fav).length;
  if (tabId === 'FOLDER') {
    return base.filter((p) => (propFolders?.[p.id] || []).length > 0).length;
  }
  if (tabId === 'ALL') return base.length;
  return base.filter((p) => p.status === tabId).length;
}
