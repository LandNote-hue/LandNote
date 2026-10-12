/** @typedef {{ value: number|null, label: string }} RangeStep */

/** @returns {Record<string, RangeStep[]>} */
export const RANGE_FILTER_STEPS = {
  price: [
    { value: null, label: '최소' },
    { value: 5000, label: '5천' },
    { value: 10000, label: '1억' },
    { value: 30000, label: '3억' },
    { value: 50000, label: '5억' },
    { value: 100000, label: '10억' },
    { value: 200000, label: '20억' },
    { value: null, label: '최대' },
  ],
  area: [
    { value: null, label: '최소' },
    { value: 10, label: '10평' },
    { value: 20, label: '20평' },
    { value: 33, label: '33평' },
    { value: 66, label: '66평' },
    { value: 99, label: '99평' },
    { value: 132, label: '132평' },
    { value: null, label: '최대' },
  ],
  land: [
    { value: null, label: '최소' },
    { value: 50, label: '50평' },
    { value: 100, label: '100평' },
    { value: 200, label: '200평' },
    { value: 500, label: '500평' },
    { value: 1000, label: '1000평' },
    { value: null, label: '최대' },
  ],
  floorArea: [
    { value: null, label: '최소' },
    { value: 10, label: '10평' },
    { value: 20, label: '20평' },
    { value: 33, label: '33평' },
    { value: 66, label: '66평' },
    { value: 99, label: '99평' },
    { value: 132, label: '132평' },
    { value: null, label: '최대' },
  ],
  households: [
    { value: null, label: '최소' },
    { value: 100, label: '100세대' },
    { value: 300, label: '300세대' },
    { value: 500, label: '500세대' },
    { value: 1000, label: '1000세대' },
    { value: 2000, label: '2000세대' },
    { value: 3000, label: '3000세대' },
    { value: null, label: '최대' },
  ],
  walk: [
    { value: null, label: '최소' },
    { value: 1, label: '1분' },
    { value: 5, label: '5분' },
    { value: 10, label: '10분' },
    { value: null, label: '전체' },
  ],
  approval: [
    { value: null, label: '최소' },
    { value: 5, label: '5년' },
    { value: 10, label: '10년' },
    { value: 15, label: '15년' },
    { value: 20, label: '20년' },
    { value: null, label: '최대' },
  ],
  maint: [
    { value: null, label: '최소' },
    { value: 5, label: '5만' },
    { value: 15, label: '15만' },
    { value: 30, label: '30만' },
    { value: 45, label: '45만' },
    { value: null, label: '최대' },
  ],
  roi: [
    { value: null, label: '최소' },
    { value: 3, label: '3%' },
    { value: 5, label: '5%' },
    { value: 7, label: '7%' },
    { value: 10, label: '10%' },
    { value: 15, label: '15%' },
    { value: null, label: '최대' },
  ],
  loan: [
    { value: null, label: '최소' },
    { value: 0, label: '없음' },
    { value: 10000, label: '1억' },
    { value: 30000, label: '3억' },
    { value: 50000, label: '5억' },
    { value: 100000, label: '10억' },
    { value: null, label: '최대' },
  ],
};

export const RANGE_FILTER_LABELS = {
  price: '가격',
  area: '면적',
  land: '대지면적',
  floorArea: '연면적',
  households: '세대수',
  walk: '도보거리',
  approval: '사용승인일',
  maint: '관리비',
  roi: '수익률',
  loan: '융자금',
};

/** @returns {Record<string, { minIdx: number, maxIdx: number }|null>} */
export function emptyRangeFilters() {
  return {
    price: null,
    area: null,
    land: null,
    floorArea: null,
    households: null,
    walk: null,
    approval: null,
    maint: null,
    roi: null,
    loan: null,
  };
}

/** @param {string} key @param {{ minIdx: number, maxIdx: number }|null} range */
export function isRangeActive(key, range) {
  if (!range) return false;
  const steps = RANGE_FILTER_STEPS[key];
  if (!steps) return false;
  return range.minIdx > 0 || range.maxIdx < steps.length - 1;
}

/** @param {string} key @param {{ minIdx: number, maxIdx: number }|null} range */
export function formatRangeSummary(key, range) {
  const steps = RANGE_FILTER_STEPS[key];
  if (!steps || !isRangeActive(key, range)) return '전체';
  const minLabel = steps[range.minIdx]?.label || '';
  const maxLabel = steps[range.maxIdx]?.label || '';
  if (range.minIdx <= 0 && range.maxIdx >= steps.length - 1) return '전체';
  if (range.minIdx <= 0) return `~${maxLabel}`;
  if (range.maxIdx >= steps.length - 1) return `${minLabel}~`;
  if (minLabel === maxLabel) return minLabel;
  return `${minLabel}~${maxLabel}`;
}

/** @param {RangeStep[]} steps @param {{ minIdx: number, maxIdx: number }|null} range */
export function rangeBounds(steps, range) {
  if (!range || !steps?.length) return { min: null, max: null };
  const lo = Math.min(range.minIdx, range.maxIdx);
  const hi = Math.max(range.minIdx, range.maxIdx);
  const minStep = steps[lo];
  const maxStep = steps[hi];
  return {
    min: minStep?.value ?? null,
    max: maxStep?.value ?? null,
  };
}

/** @param {number|null} v @param {number|null} min @param {number|null} max */
export function inNumericRange(v, min, max) {
  const n = Number(v);
  if (!Number.isFinite(n)) return min == null && max == null;
  if (min != null && n < min) return false;
  if (max != null && n > max) return false;
  return true;
}
