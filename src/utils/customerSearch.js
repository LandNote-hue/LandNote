import { customerBudgetInMan } from './customerMoney.js';
import { custStatusOf } from './customerStatus.js';
import { formatPreferredTradesLabel, preferredTradesOf } from './customerTradePreference.js';
import { phoneMatches } from './formatPhone.js';

/** @type {readonly string[]} */
export const CUSTOMER_ADV_PROP_KIND_OPTS = [
  '상가건물',
  '아파트',
  '오피스텔',
  '사무실',
  '빌라',
  '토지',
  '원룸/투룸',
];

/** @type {Record<string, string>} */
export const CUST_ADV_STATUS_LABEL_TO_CODE = {
  진행중: 'ACTIVE',
  보류: 'HOLD',
  완료: 'COMPLETED',
  계약완료: 'COMPLETED',
};

/** @param {Record<string, unknown>|null|undefined} c */
export function customerSearchHaystack(c) {
  return [
    c?.region,
    formatPreferredTradesLabel(preferredTradesOf(c)),
    c?.addr,
    c?.memo,
  ].filter(Boolean).join(' ');
}

/** @param {Record<string, unknown>|null|undefined} c @param {string} query */
export function customerMatchesBasicSearch(c, query) {
  const q = String(query || '').trim();
  if (!q) return true;
  if (String(c?.name || '').includes(q)) return true;
  if (String(c?.co || '').includes(q)) return true;
  if (String(c?.region || '').includes(q)) return true;
  if (phoneMatches(String(c?.phone || ''), q)) return true;
  return false;
}

/** @param {Record<string, unknown>|null|undefined} c @param {string} tag */
export function customerPropKindMatches(c, tag) {
  if (!tag) return true;
  const hay = customerSearchHaystack(c);
  if (hay.includes(tag)) return true;
  if (tag === '상가건물' && (hay.includes('상가') || hay.includes('건물'))) return true;
  if (tag === '원룸/투룸' && (hay.includes('원룸') || hay.includes('투룸'))) return true;
  return false;
}

/**
 * 고객 매입가능액(만)과 검색 범위(만) 겹침 여부
 * @param {Record<string, unknown>|null|undefined} c
 * @param {string|number} filterMin
 * @param {string|number} filterMax
 */
export function customerBudgetMatchesFilter(c, filterMin, filterMax) {
  const fMin = Number(filterMin) || 0;
  const fMax = Number(filterMax) || 0;
  if (!fMin && !fMax) return true;

  const { buyMin, buyMax } = customerBudgetInMan(c);
  if (!buyMin && !buyMax) return false;

  const cMin = buyMin || 0;
  const cMax = buyMax || 0;
  const effectiveCMax = cMax > 0 ? cMax : Number.MAX_SAFE_INTEGER;
  const effectiveFMax = fMax > 0 ? fMax : Number.MAX_SAFE_INTEGER;

  if (effectiveCMax < fMin) return false;
  if (cMin > 0 && cMin > effectiveFMax) return false;
  if (!cMax && cMin > 0 && fMax > 0 && cMin > fMax) return false;
  return true;
}

/** @param {Record<string, unknown>|null|undefined} c @param {string} tradeCode */
export function customerPreferredTradeMatches(c, tradeCode) {
  if (!tradeCode) return true;
  return preferredTradesOf(c).includes(tradeCode);
}

/**
 * @param {Record<string, unknown>|null|undefined} c
 * @param {{
 *   tag?: string,
 *   trade?: string,
 *   status?: string,
 *   buyMin?: string|number,
 *   buyMax?: string|number,
 * }} adv
 */
export function customerMatchesAdvSearch(c, adv) {
  if (!adv) return true;

  if (!customerPropKindMatches(c, adv.tag || '')) return false;
  if (!customerPreferredTradeMatches(c, adv.trade || '')) return false;

  if (adv.status) {
    const code = CUST_ADV_STATUS_LABEL_TO_CODE[adv.status];
    if (code && custStatusOf(c) !== code) return false;
  }

  if (!customerBudgetMatchesFilter(c, adv.buyMin, adv.buyMax)) return false;
  return true;
}
