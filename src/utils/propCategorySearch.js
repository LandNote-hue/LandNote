/**
 * 매물 대분류별 세부검색 — 필드 구성·매칭
 * 등록 폼에 없는 항목(세대수·방/욕실·방향·분양단계 등)은 UI에서 제외
 */
import { visiblePropMainEntries, visiblePropSubEntries } from '../data/propertyTypes.js';
import { m2ToPyung, priceInManForFilter } from './formatMoney.js';
import { emptyRangeFilters, isRangeActive } from './rangeFilterConfig.js';
import { propertyMatchesRangeFilters, rangeFiltersActive } from './rangeFilterMatch.js';

export { emptyRangeFilters } from './rangeFilterConfig.js';

export const PROP_TRADE_LABELS = {
  SALE: '매매',
  JEONSE: '전세',
  MONTHLY: '월세',
  SHORT_TERM: '단기',
};

export const PROP_MAIN_SEARCH_TABS = [
  { id: '', label: '전체' },
  ...visiblePropMainEntries().map(([id, label]) => ({ id, label })),
];

const MAIN_ORDER = visiblePropMainEntries().map(([id]) => id);
export const ALL_SEARCH_MAINS = MAIN_ORDER;

/** @param {ReturnType<typeof emptyCategorySearch>} cat */
export function selectedMains(cat) {
  if (Array.isArray(cat?.mains) && cat.mains.length) {
    return MAIN_ORDER.filter((id) => cat.mains.includes(id));
  }
  if (typeof cat?.main === 'string' && cat.main) return [cat.main];
  return [];
}

/** @param {string} main */
export function subOptionsForMain(main) {
  return visiblePropSubEntries(main).map(([id, label]) => ({ id, label }));
}

/** @param {string[]} mains */
export function subOptionsForMains(mains) {
  return selectedMains({ mains }).flatMap((m) => subOptionsForMain(m).map((s) => ({ ...s, main: m })));
}

/**
 * 선택된 대분류의 하위 검색항목 병합 — 겹치는 필드는 1개, 고유 필드는 모두
 * @param {string[]} mains
 */
export function mergeSearchSpec(mains) {
  const ordered = selectedMains({ mains });
  /** @type {Map<string, typeof DROP[keyof typeof DROP]>} */
  const dropsByKey = new Map();
  /** @type {Record<string, string[]>} */
  const dropOwners = {};
  /** @type {Map<string, {id:string,label:string}>} */
  const extrasById = new Map();
  /** @type {Record<string, string[]>} */
  const extraOwners = {};
  for (const main of ordered) {
    const spec = SEARCH_BY_MAIN[main];
    if (!spec) continue;
    for (const drop of spec.drops) {
      if (!dropsByKey.has(drop.key)) dropsByKey.set(drop.key, drop);
      (dropOwners[drop.key] ||= []).push(main);
    }
    for (const ex of spec.extras) {
      if (!extrasById.has(ex.id)) extrasById.set(ex.id, ex);
      (extraOwners[ex.id] ||= []).push(main);
    }
  }
  return {
    drops: [...dropsByKey.values()],
    extras: [...extrasById.values()],
    dropOwners,
    extraOwners,
  };
}

export const PRICE_BANDS = [
  { id: '', label: '가격대' },
  { id: '0-10000', label: '~1억' },
  { id: '10000-30000', label: '1~3억' },
  { id: '30000-50000', label: '3~5억' },
  { id: '50000-100000', label: '5~10억' },
  { id: '100000-', label: '10억~' },
];

export const AREA_BANDS = [
  { id: '', label: '면적' },
  { id: '0-20', label: '~20평' },
  { id: '20-40', label: '20~40평' },
  { id: '40-60', label: '40~60평' },
  { id: '60-100', label: '60~100평' },
  { id: '100-', label: '100평~' },
];

export const FLOOR_BANDS = [
  { id: '', label: '건물층수' },
  { id: '1-5', label: '5층 이하' },
  { id: '6-10', label: '6~10층' },
  { id: '11-', label: '11층 이상' },
];

export const APPROVAL_BANDS = [
  { id: '', label: '사용승인일' },
  { id: '5', label: '5년 이내' },
  { id: '10', label: '10년 이내' },
  { id: '15', label: '15년 이내' },
  { id: '20p', label: '20년 이상' },
];

export const LOAN_BANDS = [
  { id: '', label: '융자금' },
  { id: '0-0', label: '없음' },
  { id: '0-10000', label: '1억 이하' },
  { id: '0-30000', label: '3억 이하' },
  { id: '0-50000', label: '5억 이하' },
];

export const MAINT_BANDS = [
  { id: '', label: '관리비' },
  { id: '0-10', label: '10만 이하' },
  { id: '0-20', label: '20만 이하' },
  { id: '0-30', label: '30만 이하' },
];

/** 기타옵션 — 기존 주차대수·도로상황·홍보/메모 텍스트로 매칭 */
export const EXTRA_OPTS = {
  parking: { id: 'parking', label: '주차가능' },
  urgent: { id: 'urgent', label: '급매' },
  roadside: { id: 'roadside', label: '큰길가' },
  station: { id: 'station', label: '역세권' },
  renovated: { id: 'renovated', label: '올수리' },
  yard: { id: 'yard', label: '마당' },
  withTenant: { id: 'withTenant', label: '세안고' },
  fullOpt: { id: 'fullOpt', label: '풀옵션' },
  rooftop: { id: 'rooftop', label: '옥탑' },
  duplex: { id: 'duplex', label: '복층' },
  separated: { id: 'separated', label: '분리형' },
  newlyBuilt: { id: 'newlyBuilt', label: '신축' },
};

const DROP = {
  price: { key: 'priceBand', label: '가격대', kind: 'bands', bands: PRICE_BANDS },
  area: { key: 'areaBand', label: '면적', kind: 'bands', bands: AREA_BANDS },
  approval: { key: 'approvalBand', label: '사용승인일', kind: 'bands', bands: APPROVAL_BANDS },
  floor: { key: 'floorBand', label: '건물층수', kind: 'bands', bands: FLOOR_BANDS },
  loan: { key: 'loanBand', label: '융자금', kind: 'bands', bands: LOAN_BANDS },
  maint: { key: 'maintBand', label: '관리비', kind: 'bands', bands: MAINT_BANDS },
  extras: { key: 'extras', label: '기타옵션', kind: 'extras' },
};

/** @type {Record<string, { drops: typeof DROP[keyof typeof DROP][], extras: {id:string,label:string}[] }>} */
export const SEARCH_BY_MAIN = {
  APT_OFFICETEL: {
    drops: [DROP.price, DROP.area, DROP.approval, DROP.floor, DROP.loan, DROP.extras],
    extras: [EXTRA_OPTS.parking, EXTRA_OPTS.urgent, EXTRA_OPTS.roadside, EXTRA_OPTS.station],
  },
  VILLA_HOUSE: {
    drops: [DROP.price, DROP.area, DROP.approval, DROP.loan, DROP.extras],
    extras: [EXTRA_OPTS.renovated, EXTRA_OPTS.parking, EXTRA_OPTS.yard, EXTRA_OPTS.urgent, EXTRA_OPTS.withTenant],
  },
  ONEROOM_TWOROOM: {
    drops: [DROP.price, DROP.maint, DROP.extras],
    extras: [
      EXTRA_OPTS.fullOpt, EXTRA_OPTS.rooftop, EXTRA_OPTS.duplex, EXTRA_OPTS.separated,
      EXTRA_OPTS.roadside, EXTRA_OPTS.parking, EXTRA_OPTS.newlyBuilt,
    ],
  },
  COMMERCIAL: {
    drops: [DROP.price, DROP.area, DROP.floor, DROP.loan, DROP.maint, DROP.extras],
    extras: [EXTRA_OPTS.parking, EXTRA_OPTS.urgent, EXTRA_OPTS.roadside, EXTRA_OPTS.station],
  },
  NEW_DEVELOPMENT: {
    drops: [DROP.price, DROP.area],
    extras: [],
  },
};

export function emptyCategorySearch() {
  return {
    main: '',
    mains: /** @type {string[]} */ ([]),
    subs: /** @type {string[]} */ ([]),
    trade: '',
    priceBand: '',
    areaBand: '',
    floorBand: '',
    approvalBand: '',
    loanBand: '',
    maintBand: '',
    extras: /** @type {string[]} */ ([]),
    ranges: emptyRangeFilters(),
  };
}

export const BAND_TO_RANGE_KEY = {
  priceBand: 'price',
  areaBand: 'area',
  approvalBand: 'approval',
  maintBand: 'maint',
  loanBand: 'loan',
};

/** @param {ReturnType<typeof emptyCategorySearch>} cat @param {string[]} nextMains */
export function pruneCategorySearch(cat, nextMains) {
  const mains = selectedMains({ mains: nextMains });
  if (!mains.length) return emptyCategorySearch();
  const spec = mergeSearchSpec(mains);
  const validSubs = new Set(subOptionsForMains(mains).map((s) => s.id));
  const validDrops = new Set(spec.drops.map((d) => d.key));
  const validExtras = new Set(spec.extras.map((e) => e.id));
  const keep = (key, val) => (validDrops.has(key) ? val : '');
  const nextRanges = { ...(cat.ranges || emptyRangeFilters()) };
  Object.entries(BAND_TO_RANGE_KEY).forEach(([bandKey, rangeKey]) => {
    if (!validDrops.has(bandKey)) nextRanges[rangeKey] = null;
  });
  return {
    ...cat,
    main: mains[0] || '',
    mains,
    subs: (cat.subs || []).filter((s) => validSubs.has(s)),
    trade: keep('trade', cat.trade),
    priceBand: keep('priceBand', cat.priceBand),
    areaBand: keep('areaBand', cat.areaBand),
    floorBand: keep('floorBand', cat.floorBand),
    approvalBand: keep('approvalBand', cat.approvalBand),
    loanBand: keep('loanBand', cat.loanBand),
    maintBand: keep('maintBand', cat.maintBand),
    extras: (cat.extras || []).filter((id) => validExtras.has(id)),
    ranges: nextRanges,
  };
}

/** @param {string} band */
function parseBand(band) {
  if (!band) return null;
  const [minS, maxS] = String(band).split('-');
  const min = minS === '' || minS == null ? null : Number(minS);
  const max = maxS === '' || maxS == null ? null : Number(maxS);
  return {
    min: Number.isFinite(min) ? min : null,
    max: Number.isFinite(max) ? max : null,
  };
}

function inBand(value, band) {
  const b = parseBand(band);
  if (!b) return true;
  const n = Number(value) || 0;
  if (b.min != null && n < b.min) return false;
  if (b.max != null && n > b.max) return false;
  return true;
}

function textHay(p) {
  return [p.promo, p.memo, p.tag, p.roadInfo, p.bldg].filter(Boolean).join(' ');
}

function approvalYear(p) {
  const raw = String(p.approvalDate || '').replace(/\D/g, '');
  if (raw.length < 4) return null;
  const y = Number(raw.slice(0, 4));
  return Number.isFinite(y) && y > 1900 ? y : null;
}

function priceMan(p) {
  const v = priceInManForFilter(p);
  if (v != null) return v;
  if (p.trade === 'MONTHLY' || p.trade === 'SHORT_TERM') return Number(p.mDep) || 0;
  return 0;
}

function areaPy(p) {
  if (p.main === 'COMMERCIAL' && p.sub === 'LAND') {
    return p.land > 0 ? Number(m2ToPyung(p.land)) : 0;
  }
  if (p.floor > 0) return Number(m2ToPyung(p.floor));
  if (p.land > 0) return Number(m2ToPyung(p.land));
  return 0;
}

function extraMatches(p, extraId) {
  const hay = textHay(p);
  switch (extraId) {
    case 'parking':
      return Number(p.parking) > 0;
    case 'urgent':
      return hay.includes('급매');
    case 'roadside':
      return /대로|큰길|왕복|접함|도로/.test(String(p.roadInfo || hay));
    case 'station':
      return /역세권|역\s*도보|역\s*\d/.test(hay) || hay.includes('역');
    case 'renovated':
      return /올수리|수리|리모델링|인테리어/.test(hay);
    case 'yard':
      return hay.includes('마당');
    case 'withTenant':
      return /세안|임차인|임대중/.test(hay);
    case 'fullOpt':
      return /풀옵션|풀 옵션/.test(hay);
    case 'rooftop':
      return hay.includes('옥탑');
    case 'duplex':
      return hay.includes('복층');
    case 'separated':
      return hay.includes('분리');
    case 'newlyBuilt': {
      if (hay.includes('신축')) return true;
      const y = approvalYear(p);
      return y != null && (new Date().getFullYear() - y) <= 3;
    }
    default:
      return true;
  }
}

function dropApplies(owners, key, propMain) {
  const list = owners?.[key];
  if (!list?.length) return true;
  return list.includes(propMain);
}

/**
 * @param {Record<string, unknown>} p
 * @param {ReturnType<typeof emptyCategorySearch>} cat
 */
function matchesDetailFilters(p, cat, spec, skipTradePriceArea) {
  const applies = spec
    ? (key) => dropApplies(spec.dropOwners, key, p.main)
    : () => true;
  if (!skipTradePriceArea) {
    if (cat.trade && applies('trade') && p.trade !== cat.trade) return false;
  }
  if (!propertyMatchesRangeFilters(p, cat.ranges)) return false;
  if (!skipTradePriceArea) {
    if (cat.priceBand && applies('priceBand') && !isRangeActive('price', cat.ranges?.price) && !inBand(priceMan(p), cat.priceBand)) return false;
    if (cat.areaBand && applies('areaBand') && !isRangeActive('area', cat.ranges?.area)) {
      const py = areaPy(p);
      if (!py || !inBand(py, cat.areaBand)) return false;
    }
  }
  if (cat.floorBand && applies('floorBand')) {
    const fl = Number(p.floorsAbove) || 0;
    if (!fl || !inBand(fl, cat.floorBand)) return false;
  }
  if (cat.approvalBand && applies('approvalBand') && !isRangeActive('approval', cat.ranges?.approval)) {
    const y = approvalYear(p);
    if (!y) return false;
    const age = new Date().getFullYear() - y;
    if (cat.approvalBand === '20p') {
      if (age < 20) return false;
    } else {
      const maxAge = Number(cat.approvalBand);
      if (!Number.isFinite(maxAge) || age > maxAge) return false;
    }
  }
  if (cat.loanBand && applies('loanBand') && !isRangeActive('loan', cat.ranges?.loan)) {
    const loan = Number(p.loan) || 0;
    if (cat.loanBand === '0-0') {
      if (loan > 0) return false;
    } else if (!inBand(loan, cat.loanBand)) return false;
  }
  if (cat.maintBand && applies('maintBand') && !isRangeActive('maint', cat.ranges?.maint) && !inBand(Number(p.maintenance) || 0, cat.maintBand)) return false;
  if (Array.isArray(cat.extras)) {
    for (const ex of cat.extras) {
      if (spec && !dropApplies(spec.extraOwners, ex, p.main)) continue;
      if (!extraMatches(p, ex)) return false;
    }
  }
  return true;
}

/**
 * @param {Record<string, unknown>} p
 * @param {ReturnType<typeof emptyCategorySearch>} cat
 */
export function propertyMatchesCategorySearch(p, cat) {
  if (!cat) return true;
  const mains = selectedMains(cat);
  if (Array.isArray(cat.subs) && cat.subs.length > 0 && !cat.subs.includes(p.sub)) return false;
  if (!mains.length) {
    return matchesDetailFilters(p, cat, null, true);
  }
  if (!mains.includes(p.main)) return false;
  return matchesDetailFilters(p, cat, mergeSearchSpec(mains), false);
}

/** @param {ReturnType<typeof emptyCategorySearch>} cat */
export function categorySearchIsActive(cat) {
  if (!cat) return false;
  if (selectedMains(cat).length) return true;
  if (cat.subs?.length) return true;
  if (rangeFiltersActive(cat.ranges)) return true;
  if (cat.trade || cat.priceBand || cat.areaBand || cat.floorBand) return true;
  if (cat.approvalBand || cat.loanBand || cat.maintBand) return true;
  if (cat.extras?.length) return true;
  return false;
}
