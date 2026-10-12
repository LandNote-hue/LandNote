import { customerMoneyToMan, fmtCustomerBudgetRange, fmtCustomerMoney, normalizeCustomerBudgetRange } from './customerMoney.js';

/**
 * @typedef {{
 *   exclusiveAreaPyMin?: string|number,
 *   exclusiveAreaPyMax?: string|number,
 *   budgetManMin?: string|number,
 *   budgetManMax?: string|number,
 *   region?: string,
 *   moveTiming?: string,
 * }} LeaseCondition
 */

export function emptyLeaseCondition() {
  return {
    exclusiveAreaPyMin: '',
    exclusiveAreaPyMax: '',
    budgetManMin: '',
    budgetManMax: '',
    region: '',
    moveTiming: '',
  };
}

function parsePy(value) {
  const n = Number(String(value ?? '').replace(/,/g, '').trim());
  return Number.isFinite(n) && n > 0 ? n : 0;
}

function pickPyMin(row) {
  const min = parsePy(row.exclusiveAreaPyMin);
  if (min) return min;
  return parsePy(row.exclusiveAreaPy);
}

function pickPyMax(row) {
  const max = parsePy(row.exclusiveAreaPyMax);
  if (max) return max;
  if (row.exclusiveAreaPyMin != null && String(row.exclusiveAreaPyMin).trim() !== '') return 0;
  return parsePy(row.exclusiveAreaPy);
}

function pickBudgetMin(row) {
  const min = customerMoneyToMan(row.budgetManMin);
  if (min) return min;
  if (row.budgetManMax != null && String(row.budgetManMax).trim() !== '') return 0;
  return customerMoneyToMan(row.budgetMan);
}

function pickBudgetMax(row) {
  const max = customerMoneyToMan(row.budgetManMax);
  if (max) return max;
  if (row.budgetManMin != null && String(row.budgetManMin).trim() !== '') return 0;
  return customerMoneyToMan(row.budgetMan);
}

function orderRange(min, max) {
  if (min > 0 && max > 0 && min > max) return { min: max, max: min };
  return { min, max };
}

/** @param {unknown} rec */
export function normalizeLeaseCondition(rec) {
  const row = rec && typeof rec === 'object' ? rec : {};
  const area = orderRange(pickPyMin(row), pickPyMax(row));
  const budget = orderRange(pickBudgetMin(row), pickBudgetMax(row));
  return {
    exclusiveAreaPyMin: area.min > 0 ? area.min : '',
    exclusiveAreaPyMax: area.max > 0 ? area.max : '',
    budgetManMin: budget.min > 0 ? budget.min : '',
    budgetManMax: budget.max > 0 ? budget.max : '',
    region: String(row.region || '').trim(),
    moveTiming: String(row.moveTiming || '').trim(),
  };
}

/** @param {LeaseCondition} row */
export function leaseConditionHasValue(row) {
  const n = normalizeLeaseCondition(row);
  return !!(n.exclusiveAreaPyMin || n.exclusiveAreaPyMax || n.budgetManMin || n.budgetManMax || n.region || n.moveTiming);
}

/**
 * @param {Record<string, unknown>|null|undefined} customer
 * @returns {ReturnType<typeof normalizeLeaseCondition>[]}
 */
export function leaseConditionsFromCustomer(customer) {
  const raw = Array.isArray(customer?.leaseConditions) ? customer.leaseConditions : [];
  const rows = raw.map(normalizeLeaseCondition);
  const filled = rows.filter(leaseConditionHasValue);
  if (filled.length) return filled;
  const region = String(customer?.region || '').trim();
  const budgetMin = customerMoneyToMan(customer?.buyMin);
  const budgetMax = customerMoneyToMan(customer?.buyMax);
  if (region || budgetMin || budgetMax) {
    return [normalizeLeaseCondition({ region, budgetManMin: budgetMin, budgetManMax: budgetMax })];
  }
  return [emptyLeaseCondition()];
}

/** @param {unknown[]} rows */
export function serializeLeaseConditions(rows) {
  return (Array.isArray(rows) ? rows : [])
    .map(normalizeLeaseCondition)
    .filter(leaseConditionHasValue);
}

/** @param {unknown} v */
export function fmtLeaseAreaPy(v) {
  const n = parsePy(v);
  if (!n) return '';
  const label = Number.isInteger(n) ? String(n) : String(n);
  return `${label}평`;
}

/** @param {unknown} min @param {unknown} max */
export function fmtLeaseAreaRange(min, max) {
  const lo = parsePy(min);
  const hi = parsePy(max);
  if (!lo && !hi) return '—';
  if (lo && hi) {
    if (lo === hi) return fmtLeaseAreaPy(lo) || '—';
    return `${fmtLeaseAreaPy(lo)} ~ ${fmtLeaseAreaPy(hi)}`;
  }
  if (hi) return `~ ${fmtLeaseAreaPy(hi)}`;
  return `${fmtLeaseAreaPy(lo)} ~`;
}

/** @param {unknown} min @param {unknown} max */
export function fmtLeaseBudgetRange(min, max) {
  const { buyMin: lo, buyMax: hi } = normalizeCustomerBudgetRange(min, max);
  if (lo && hi && lo === hi) return fmtCustomerMoney(lo);
  return fmtCustomerBudgetRange(min, max);
}

/** @param {Record<string, unknown>|null|undefined} customer */
export function leaseConditionListSummary(customer) {
  const rows = serializeLeaseConditions(leaseConditionsFromCustomer(customer));
  const extra = Math.max(0, rows.length - 1);
  const first = rows[0] || emptyLeaseCondition();
  const budgetLabel = fmtLeaseBudgetRange(first.budgetManMin, first.budgetManMax);
  return {
    area: fmtLeaseListCell(fmtLeaseAreaRange(first.exclusiveAreaPyMin, first.exclusiveAreaPyMax), extra),
    budget: fmtLeaseListCell(budgetLabel === '—' ? '' : budgetLabel, extra),
    region: fmtLeaseListCell(first.region, extra),
    moveTiming: fmtLeaseListCell(first.moveTiming, extra),
    extra,
  };
}

/** 목록 칸 — 첫 조건 + 추가 건수 */
export function fmtLeaseListCell(value, extra, empty = '—') {
  const base = value && value !== '—' ? value : '';
  if (!base) return extra > 0 ? `외 ${extra}건` : empty;
  return extra > 0 ? `${base} 외 ${extra}` : base;
}
