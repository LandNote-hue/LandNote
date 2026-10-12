import {
  DEAL_MODE_RENT,
  DEAL_MODE_SALE,
  normalizeDealMode,
} from '../theme/dealModeTheme.js';
import {
  isRentalListProperty,
  isSaleListProperty,
  PROP_RENTAL_TRADES,
  PROP_SALE_TRADES,
  normalizePropTrade,
} from './propListKind.js';
import { preferredTradesOf } from './customerTradePreference.js';

export { DEAL_MODE_RENT, DEAL_MODE_SALE, normalizeDealMode };

export function tradesForDealMode(mode) {
  return normalizeDealMode(mode) === DEAL_MODE_RENT ? PROP_RENTAL_TRADES : PROP_SALE_TRADES;
}

export function defaultTradeForDealMode(mode) {
  return normalizeDealMode(mode) === DEAL_MODE_RENT ? 'MONTHLY' : 'SALE';
}

export function tradeMatchesDealMode(trade, mode) {
  if (!trade) return true;
  return tradesForDealMode(mode).includes(normalizePropTrade(trade));
}

export function propertyMatchesDealMode(p, mode) {
  if (normalizeDealMode(mode) === DEAL_MODE_RENT) return isRentalListProperty(p);
  return isSaleListProperty(p);
}

export function dealModeFromProperty(p) {
  if (!p) return null;
  return isRentalListProperty(p) ? DEAL_MODE_RENT : DEAL_MODE_SALE;
}

const SALE_CUSTOMER_TYPES = new Set(['BUYER', 'SELLER']);
const RENT_CUSTOMER_TYPES = new Set(['TENANT', 'LANDLORD']);

function customerTypeCodesOf(c) {
  if (Array.isArray(c?.customer_types) && c.customer_types.length) return c.customer_types;
  return c?.type ? [c.type] : [];
}

/** 고객 레코드가 매매/임대 어느 쪽에 속하는지. 명시 필드가 없으면 유형·희망거래로 추정 */
export function inferCustomerDealMode(c) {
  const raw = String(c?.dealMode || '').toLowerCase();
  if (raw === DEAL_MODE_RENT) return DEAL_MODE_RENT;
  if (raw === DEAL_MODE_SALE) return DEAL_MODE_SALE;
  const trades = preferredTradesOf(c);
  const hasRentTrade = trades.some((t) => tradeMatchesDealMode(t, DEAL_MODE_RENT));
  const hasSaleTrade = trades.some((t) => tradeMatchesDealMode(t, DEAL_MODE_SALE));
  if (hasRentTrade && !hasSaleTrade) return DEAL_MODE_RENT;
  if (hasSaleTrade && !hasRentTrade) return DEAL_MODE_SALE;
  const types = customerTypeCodesOf(c);
  const hasRentType = types.some((t) => RENT_CUSTOMER_TYPES.has(t));
  const hasSaleType = types.some((t) => SALE_CUSTOMER_TYPES.has(t));
  if (hasRentType && !hasSaleType) return DEAL_MODE_RENT;
  return DEAL_MODE_SALE;
}

export function customerMatchesDealMode(c, mode) {
  return inferCustomerDealMode(c) === normalizeDealMode(mode);
}

/** 연결된 매물이 없거나 찾을 수 없으면 양쪽 모드에 표시 */
export function linkedPidMatchesDealMode(pid, properties, mode) {
  if (pid == null || pid === '') return true;
  const list = properties || [];
  const prop = list.find((p) => p.id === pid || String(p.id) === String(pid));
  if (!prop) return true;
  return propertyMatchesDealMode(prop, mode);
}

export function scheduleMatchesDealMode(s, properties, mode) {
  return linkedPidMatchesDealMode(s?.pid, properties, mode);
}

export function callMatchesDealMode(c, properties, mode) {
  return linkedPidMatchesDealMode(c?.pid, properties, mode);
}
