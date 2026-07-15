/**
 * 고객 금액 — DB·계산 통일 단위: **만원**
 * (구 억 단위 저장값은 normalize 시 × EOK_TO_MAN 변환)
 */

import { EOK_TO_MAN, fmtMan, looksLikeEokStored, priceInManForFilter } from './formatMoney.js';

export { EOK_TO_MAN };

/** @param {unknown} value */
export function parseCustomerMoneyMan(value) {
  const n = Number(String(value ?? '').replace(/,/g, '').trim());
  return Number.isFinite(n) && n >= 0 ? n : 0;
}

/** @param {unknown} eok */
export function eokToMan(eok) {
  const n = parseCustomerMoneyMan(eok);
  return n > 0 ? n * EOK_TO_MAN : 0;
}

/** 저장값 → 만원 (억 단위 잔존값 자동 변환) */
export function customerMoneyToMan(value) {
  const n = parseCustomerMoneyMan(value);
  if (!n) return 0;
  if (looksLikeEokStored(n)) return n * EOK_TO_MAN;
  return n;
}

/**
 * CSV·폼 입력 → 만원
 * @param {string|number} manValue (만) 열 값
 * @param {string|number} [eokValue] (억) 구 양식 열 값
 */
export function parseCustomerMoneyInput(manValue, eokValue = '') {
  const man = parseCustomerMoneyMan(manValue);
  if (man > 0) return man;
  return eokToMan(eokValue);
}

/** @param {unknown} buyMin @param {unknown} buyMax */
export function normalizeCustomerBudgetRange(buyMin, buyMax) {
  let min = customerMoneyToMan(buyMin);
  let max = customerMoneyToMan(buyMax);
  if (min > 0 && max > 0 && min > max) {
    [min, max] = [max, min];
  }
  return { buyMin: min, buyMax: max };
}

/** @param {Record<string, unknown>} data */
export function normalizeCustomerMoneyFields(data) {
  const out = { ...data };
  if (data.cash != null && data.cash !== '') {
    out.cash = customerMoneyToMan(data.cash);
  }
  const hasBuyMin = data.buyMin != null && data.buyMin !== '';
  const hasBuyMax = data.buyMax != null && data.buyMax !== '';
  if (hasBuyMin || hasBuyMax) {
    const { buyMin, buyMax } = normalizeCustomerBudgetRange(
      hasBuyMin ? data.buyMin : out.buyMin,
      hasBuyMax ? data.buyMax : out.buyMax,
    );
    if (hasBuyMin) out.buyMin = buyMin;
    if (hasBuyMax) out.buyMax = buyMax;
  }
  return out;
}

/** @param {Record<string, unknown>|null|undefined} customer */
export function customerBudgetInMan(customer) {
  const { buyMin, buyMax } = normalizeCustomerBudgetRange(customer?.buyMin, customer?.buyMax);
  return {
    cash: customerMoneyToMan(customer?.cash),
    buyMin,
    buyMax,
  };
}

/**
 * 매물 가격(만)이 고객 매입가능액(만) 범위에 들어가는지
 * @returns {boolean|null} null = 가격 비교 불가
 */
export function customerBudgetMatchesPropertyPrice(customer, property) {
  const priceMan = priceInManForFilter(property);
  if (priceMan == null || priceMan <= 0) return null;
  const { buyMin, buyMax } = customerBudgetInMan(customer);
  if (buyMax > 0 && priceMan > buyMax) return false;
  if (buyMin > 0 && priceMan < buyMin) return false;
  return true;
}

/** @param {unknown} v */
export function fmtCustomerMoney(v) {
  if (v == null || v === '') return '—';
  const n = Number(v);
  if (!Number.isFinite(n) || n <= 0) return '—';
  return fmtMan(n) ?? '—';
}

/** @param {unknown} buyMin @param {unknown} buyMax */
export function fmtCustomerBudgetRange(buyMin, buyMax) {
  const { buyMin: min, buyMax: max } = normalizeCustomerBudgetRange(buyMin, buyMax);
  if (!min && !max) return '—';
  if (min && max) return `${fmtCustomerMoney(min)} ~ ${fmtCustomerMoney(max)}`;
  if (max) return `~ ${fmtCustomerMoney(max)}`;
  return `${fmtCustomerMoney(min)} ~`;
}
