import { fmtNum, normalizeJDepToMan, formatKoreanAmountFromMan, m2ToPyung } from './formatMoney.js';
import { RENT_TRADE_LABELS } from './propListKind.js';

export { RENT_TRADE_LABELS };

/** 전세는 jDep, 월세·단기는 mDep (만원) */
export function rentalDepositMan(p) {
  if (p?.trade === 'JEONSE') return normalizeJDepToMan(p.jDep);
  const n = Number(p?.mDep);
  return Number.isFinite(n) && n > 0 ? n : 0;
}

export function rentalRentMan(p) {
  const n = Number(p?.mRent);
  return Number.isFinite(n) && n > 0 ? n : 0;
}

export function rentalMaintMan(p) {
  const n = Number(p?.maintenance);
  return Number.isFinite(n) && n > 0 ? n : 0;
}

export function fmtRentalMan(v) {
  const n = Number(v);
  if (!Number.isFinite(n) || n <= 0) return '—';
  return formatKoreanAmountFromMan(n);
}

export function fmtRentalAreaCell(m2) {
  const n = Number(m2);
  if (!Number.isFinite(n) || n <= 0) return '—';
  const py = m2ToPyung(n);
  const m2Label = `${fmtNum(n, { decimal: true })}㎡`;
  return py != null ? `${m2Label} (${fmtNum(py, { decimal: true })}평)` : m2Label;
}

export function fmtListDotDate(iso) {
  if (!iso) return '—';
  const [y, m, d] = String(iso).split('-');
  return y && m && d ? `${y}.${m}.${d}` : String(iso).replace(/-/g, '.');
}

export function rentalTradeLabel(trade) {
  return RENT_TRADE_LABELS[trade] || trade || '—';
}

export const RENT_LIST_SORT_KEYS = new Set([
  'contractArea', 'exclusiveArea', 'deposit', 'rent', 'maintenance', 'lastCall', 'moveInDate', 'created',
]);

export const SALE_LIST_SORT_KEYS = new Set([
  'price', 'roi', 'landArea', 'floorArea', 'zoning', 'landPy', 'lastCall', 'created',
]);
