import { m2ToPyung, priceInManForFilter } from './formatMoney.js';
import { RANGE_FILTER_STEPS, rangeBounds, inNumericRange, isRangeActive } from './rangeFilterConfig.js';

function textHay(p) {
  return [p.promo, p.memo, p.tag, p.roadInfo, p.bldg].filter(Boolean).join(' ');
}

function approvalAgeYears(p) {
  const raw = String(p.approvalDate || '').replace(/\D/g, '');
  if (raw.length < 4) return null;
  const y = Number(raw.slice(0, 4));
  if (!Number.isFinite(y) || y <= 1900) return null;
  return new Date().getFullYear() - y;
}

function areaPy(p) {
  if (p.main === 'COMMERCIAL' && p.sub === 'LAND') {
    return p.land > 0 ? Number(m2ToPyung(p.land)) : 0;
  }
  if (p.floor > 0) return Number(m2ToPyung(p.floor));
  if (p.land > 0) return Number(m2ToPyung(p.land));
  return 0;
}

function landPy(p) {
  return p.land > 0 ? Number(m2ToPyung(p.land)) : 0;
}

function floorPy(p) {
  return p.floor > 0 ? Number(m2ToPyung(p.floor)) : 0;
}

function priceMan(p) {
  const v = priceInManForFilter(p);
  if (v != null) return v;
  if (p.trade === 'MONTHLY' || p.trade === 'SHORT_TERM') return Number(p.mDep) || 0;
  return null;
}

function parseHouseholds(p) {
  const hay = textHay(p);
  const m = hay.match(/(\d{2,5})\s*세대/);
  if (m) return Number(m[1]);
  return null;
}

function parseWalkMinutes(p) {
  const hay = textHay(p);
  const m = hay.match(/도보\s*(\d+)\s*분/);
  if (m) return Number(m[1]);
  if (/역세권/.test(hay)) return 5;
  return null;
}

/**
 * @param {Record<string, unknown>} p
 * @param {Record<string, { minIdx: number, maxIdx: number }|null>|undefined} ranges
 */
export function propertyMatchesRangeFilters(p, ranges) {
  if (!ranges) return true;

  if (isRangeActive('price', ranges.price)) {
    const { min, max } = rangeBounds(RANGE_FILTER_STEPS.price, ranges.price);
    const v = priceMan(p);
    if (v == null) return false;
    if (!inNumericRange(v, min, max)) return false;
  }

  if (isRangeActive('area', ranges.area)) {
    const { min, max } = rangeBounds(RANGE_FILTER_STEPS.area, ranges.area);
    const py = areaPy(p);
    if (!py) return false;
    if (!inNumericRange(py, min, max)) return false;
  }

  if (isRangeActive('land', ranges.land)) {
    const { min, max } = rangeBounds(RANGE_FILTER_STEPS.land, ranges.land);
    const py = landPy(p);
    if (!py) return false;
    if (!inNumericRange(py, min, max)) return false;
  }

  if (isRangeActive('floorArea', ranges.floorArea)) {
    const { min, max } = rangeBounds(RANGE_FILTER_STEPS.floorArea, ranges.floorArea);
    const py = floorPy(p);
    if (!py) return false;
    if (!inNumericRange(py, min, max)) return false;
  }

  if (isRangeActive('maint', ranges.maint)) {
    const { min, max } = rangeBounds(RANGE_FILTER_STEPS.maint, ranges.maint);
    const v = Number(p.maintenance) || 0;
    if (!inNumericRange(v, min, max)) return false;
  }

  if (isRangeActive('approval', ranges.approval)) {
    const { min, max } = rangeBounds(RANGE_FILTER_STEPS.approval, ranges.approval);
    const age = approvalAgeYears(p);
    if (age == null) return false;
    if (min != null && age < min) return false;
    if (max != null && age > max) return false;
  }

  if (isRangeActive('households', ranges.households)) {
    const { min, max } = rangeBounds(RANGE_FILTER_STEPS.households, ranges.households);
    const n = parseHouseholds(p);
    if (n == null) return false;
    if (!inNumericRange(n, min, max)) return false;
  }

  if (isRangeActive('walk', ranges.walk)) {
    const { min, max } = rangeBounds(RANGE_FILTER_STEPS.walk, ranges.walk);
    const mins = parseWalkMinutes(p);
    if (mins == null) return false;
    if (min != null && mins < min) return false;
    if (max != null && mins > max) return false;
  }

  if (isRangeActive('roi', ranges.roi)) {
    const { min, max } = rangeBounds(RANGE_FILTER_STEPS.roi, ranges.roi);
    const v = parseFloat(p.roi);
    if (!Number.isFinite(v)) return false;
    if (!inNumericRange(v, min, max)) return false;
  }

  if (isRangeActive('loan', ranges.loan)) {
    const { min, max } = rangeBounds(RANGE_FILTER_STEPS.loan, ranges.loan);
    const v = Number(p.loan) || 0;
    if (!inNumericRange(v, min, max)) return false;
  }

  return true;
}

export function rangeFiltersActive(ranges) {
  if (!ranges) return false;
  return Object.keys(RANGE_FILTER_STEPS).some((k) => isRangeActive(k, ranges[k]));
}
