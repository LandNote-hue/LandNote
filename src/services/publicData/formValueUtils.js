/** @param {...unknown} values */
export function pickFirst(...values) {
  for (const v of values) {
    if (isMeaningful(v)) return normalizeScalar(v);
  }
  return '';
}

export function isMeaningful(v) {
  if (v == null) return false;
  if (typeof v === 'string') return v.trim() !== '';
  if (typeof v === 'number') return !Number.isNaN(v);
  return true;
}

/** @param {unknown} v */
export function normalizeScalar(v) {
  if (v == null) return '';
  return String(v).trim();
}

/** @param {unknown} v */
export function formatArea(v) {
  if (!isMeaningful(v)) return '';
  const n = parseFloat(String(v).replace(/,/g, ''));
  if (Number.isNaN(n)) return normalizeScalar(v);
  if (n === 0) return '';
  return String(n);
}

/** @param {unknown} v */
export function formatPercent(v) {
  if (!isMeaningful(v)) return '';
  const n = parseFloat(String(v).replace(/,/g, ''));
  if (Number.isNaN(n)) return normalizeScalar(v);
  return String(n);
}

/** 건축물대장 0%·미기재와 구분 — 0은 빈값 */
export function formatPercentNonZero(v) {
  if (!isMeaningful(v)) return '';
  const n = parseFloat(String(v).replace(/,/g, ''));
  if (Number.isNaN(n) || n === 0) return '';
  return String(n);
}

/** @param {unknown} v */
export function formatCount(v) {
  if (!isMeaningful(v)) return '';
  const n = parseInt(String(v).replace(/,/g, ''), 10);
  if (Number.isNaN(n)) return normalizeScalar(v);
  return String(n);
}

/** @param {string|number|null|undefined} v YYYYMMDD */
export function formatUseAprDay(v) {
  const s = String(v ?? '').replace(/\D/g, '');
  if (s.length !== 8) return s || '';
  return `${s.slice(0, 4)}-${s.slice(4, 6)}-${s.slice(6, 8)}`;
}

/** @param {Record<string, string>} target */
export function mergeFormFields(target, ...sources) {
  /** @type {Record<string, string>} */
  const out = { ...target };
  for (const key of Object.keys(out)) {
    out[key] = pickFirst(...sources.map(s => s?.[key]), out[key]);
  }
  return out;
}

/** @param {Record<string, string>} prev @param {Record<string, string>} patch */
export function applyMeaningfulPatch(prev, patch) {
  const out = { ...prev };
  for (const [k, v] of Object.entries(patch)) {
    if (isMeaningful(v)) out[k] = normalizeScalar(v);
  }
  return out;
}

/** @param {Record<string, unknown>|null|undefined} item vworld 토지특성 — prposArea1Nm만 */
export function pickPrimaryLandUseZone(item) {
  if (!item) return '';
  return pickFirst(item.prposArea1Nm);
}

/** @param {...string} zones */
export function mergeLandUseZones(...zones) {
  const set = new Set();
  for (const z of zones) {
    String(z || '')
      .split(/[,;·/|]/)
      .map(s => s.trim())
      .filter(Boolean)
      .forEach(s => set.add(s));
  }
  return [...set].join(', ');
}

/** @param {Record<string, unknown>|null|undefined} item */
export function sumParkingCounts(item) {
  if (!item) return '';
  const direct = pickFirst(item.totPkngCnt, item.totParkCnt, item.pkngCnt);
  if (direct) return formatCount(direct);

  const keys = [
    'indrMechUtcnt', 'oudrMechUtcnt', 'indrAutoUtcnt', 'oudrAutoUtcnt',
    'indrMechAutoUtcnt', 'oudrMechAutoUtcnt', 'neigAutoUtcnt', 'neigMechUtcnt',
  ];
  let sum = 0;
  let any = false;
  for (const k of keys) {
    const n = parseInt(String(item[k] ?? ''), 10);
    if (!Number.isNaN(n)) {
      sum += n;
      any = true;
    }
  }
  return any ? String(sum) : '';
}

/** @param {Record<string, unknown>|null|undefined} item */
export function sumElevatorCounts(item) {
  if (!item) return '';
  const direct = pickFirst(item.elvtCnt, item.totElvtCnt);
  if (direct) return formatCount(direct);

  const ride = parseInt(String(item.rideUseElvtCnt ?? ''), 10);
  const emgen = parseInt(String(item.emgenUseElvtCnt ?? ''), 10);
  const hasRide = !Number.isNaN(ride);
  const hasEmgen = !Number.isNaN(emgen);
  if (hasRide || hasEmgen) {
    return String((hasRide ? ride : 0) + (hasEmgen ? emgen : 0));
  }
  return '';
}

/** 표제부 다건 중 연면적이 가장 큰 건축물 우선 */
export function pickBestBuildingItem(items) {
  if (!items?.length) return null;
  if (items.length === 1) return items[0];
  return items.reduce((best, cur) => {
    const a = parseFloat(String(best?.totArea ?? best?.totarea ?? '')) || 0;
    const b = parseFloat(String(cur?.totArea ?? cur?.totarea ?? '')) || 0;
    return b > a ? cur : best;
  });
}
