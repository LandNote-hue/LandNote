/** 매물 대분류·소분류 (임대 등록·일괄등록 공용) */

import { isRentalListProperty } from '../utils/propListKind.js';

export const PROP_MAIN = {
  APT_OFFICETEL: '아파트·오피스텔',
  VILLA_HOUSE: '빌라·주택',
  ONEROOM_TWOROOM: '원룸·투룸',
  COMMERCIAL: '상가·업무·공장·토지',
  NEW_DEVELOPMENT: '분양',
};

/** UI에서 숨김 (기존 데이터 조회용으로 코드는 유지) */
export const PROP_MAIN_HIDDEN = new Set(['NEW_DEVELOPMENT']);
export const PROP_SUB_HIDDEN = new Set(['APT_PRESALE', 'OFFICETEL_PRESALE']);

/** @param {string} [currentMain] */
export function visiblePropMainEntries(currentMain) {
  return Object.entries(PROP_MAIN).filter(([id]) => !PROP_MAIN_HIDDEN.has(id) || id === currentMain);
}

/** @param {string} main @param {string} [currentSub] */
export function visiblePropSubEntries(main, currentSub) {
  return Object.entries(PROP_SUB[main] || {}).filter(([id]) => {
    if (PROP_MAIN_HIDDEN.has(main)) return id === currentSub;
    return !PROP_SUB_HIDDEN.has(id) || id === currentSub;
  });
}

/** 대분류 없이 소분류만 고를 때 사용 */
export function findPropMainForSub(subId) {
  for (const [main, subs] of Object.entries(PROP_SUB)) {
    if (subs && Object.prototype.hasOwnProperty.call(subs, subId)) return main;
  }
  return null;
}

/** @param {string} [currentMain] @param {string} [currentSub] */
export function visibleAllPropSubEntries(currentMain, currentSub) {
  const rows = [];
  for (const [main] of visiblePropMainEntries(currentMain)) {
    for (const [id, label] of visiblePropSubEntries(main, currentSub)) {
      rows.push({ main, id, label });
    }
  }
  return rows;
}

export const PROP_SUB = {
  APT_OFFICETEL: {
    APARTMENT: '아파트', APT_PRESALE: '아파트 분양권', RECONSTRUCTION: '재건축',
    OFFICETEL_RESI: '오피스텔(주거)', OFFICETEL_COMM: '오피스텔(업무)',
    OFFICETEL_PRESALE: '오피스텔 분양권', REDEVELOPMENT: '재개발',
  },
  VILLA_HOUSE: {
    VILLA: '빌라/연립', DETACHED: '단독·다가구',
    COUNTRY_HOUSE: '전원주택', COMMERCIAL_HOUSE: '상가주택',
  },
  ONEROOM_TWOROOM: { ONEROOM: '원룸', TWOROOM: '투룸', OFFICETEL_STUDIO: '오피스텔(원룸형)' },
  COMMERCIAL: {
    STORE: '상가', OFFICE: '사무실', WHOLE_BUILDING: '빌딩(통건물)',
    FACTORY_WAREHOUSE: '공장·창고', KNOWLEDGE_INDUSTRY: '지식산업센터', LAND: '토지',
    HOTEL_ACCOMMODATION: '숙박업, 호텔',
  },
  NEW_DEVELOPMENT: {
    APT_NEW: '아파트(분양)', OFFICETEL_NEW: '오피스텔(분양)',
    VILLA_NEW: '빌라(분양)', URBAN_LIVING: '도시형생활주택',
    LIVING_ACCOMMODATION: '생활숙박시설', COMMERCIAL_OFFICE_NEW: '상가/업무(분양)',
  },
};

/** 예전 소분류 한글 → 코드 */
const SUB_LABEL_ALIASES = {
  '건물(통건물)': 'WHOLE_BUILDING',
  '공장/창고': 'FACTORY_WAREHOUSE',
  '단독/다가구': 'DETACHED',
};

/** 대분류 한글 라벨 → 코드 */
const MAIN_LABEL_TO_CODE = Object.fromEntries(
  Object.entries(PROP_MAIN).map(([code, label]) => [label, code]),
);

/**
 * 대분류/소분류 한글 라벨 → { main, sub, tag } 코드 해석
 * 못 찾으면 null (호출부에서 기존 매물유형 방식으로 폴백)
 * @param {string} mainLabel
 * @param {string} subLabel
 */
export function resolvePropTypeFromLabels(mainLabel, subLabel) {
  const mainKey = String(mainLabel || '').trim();
  const subKey = String(subLabel || '').trim();
  if (!mainKey || !subKey) return null;
  const main = MAIN_LABEL_TO_CODE[mainKey];
  if (!main) return null;
  const subMap = PROP_SUB[main] || {};
  const subEntry = Object.entries(subMap).find(([, label]) => label === subKey);
  if (subEntry) return { main, sub: subEntry[0], tag: subEntry[1] };
  const aliasSub = SUB_LABEL_ALIASES[subKey];
  if (aliasSub && subMap[aliasSub]) return { main, sub: aliasSub, tag: subMap[aliasSub] };
  return null;
}

/** 매매 매물 종류 (등록·수정·상세검색 공용) */
export const SALE_PROP_KIND_OPTS = [
  { id: 'BUILDING', label: '빌딩(통건물)' },
  { id: 'DETACHED', label: '단독·다가구' },
  { id: 'FACTORY', label: '공장·창고' },
  { id: 'LAND', label: '토지' },
  { id: 'KNOWLEDGE', label: '지식산업센터' },
  { id: 'HOTEL', label: '숙박업, 호텔' },
];

const SALE_PROP_KIND_IDS = new Set(SALE_PROP_KIND_OPTS.map((o) => o.id));

/** @type {Record<string, { main: string, sub: string, tag: string }>} */
export const SALE_KIND_TO_TYPE = {
  BUILDING: { main: 'COMMERCIAL', sub: 'WHOLE_BUILDING', tag: '빌딩(통건물)' },
  DETACHED: { main: 'VILLA_HOUSE', sub: 'DETACHED', tag: '단독·다가구' },
  FACTORY: { main: 'COMMERCIAL', sub: 'FACTORY_WAREHOUSE', tag: '공장·창고' },
  LAND: { main: 'COMMERCIAL', sub: 'LAND', tag: '토지' },
  KNOWLEDGE: { main: 'COMMERCIAL', sub: 'KNOWLEDGE_INDUSTRY', tag: '지식산업센터' },
  HOTEL: { main: 'COMMERCIAL', sub: 'HOTEL_ACCOMMODATION', tag: '숙박업, 호텔' },
};

export function normalizeSalePropKind(kindId) {
  return SALE_PROP_KIND_IDS.has(kindId) ? kindId : '';
}

export function saleKindLabel(kindId) {
  const id = normalizeSalePropKind(kindId);
  return SALE_PROP_KIND_OPTS.find((o) => o.id === id)?.label || '';
}

function compactKindLabel(s) {
  return String(s || '').trim().replace(/[\s,·/()]/g, '');
}

const SALE_KIND_LABEL_ALIASES = {
  빌딩통건물: 'BUILDING',
  빌딩: 'BUILDING',
  건물통건물: 'BUILDING',
  통건물: 'BUILDING',
  단독다가구: 'DETACHED',
  공장창고: 'FACTORY',
  토지: 'LAND',
  지식산업센터: 'KNOWLEDGE',
  숙박업호텔: 'HOTEL',
  생활숙박시설: 'HOTEL',
};

/** @param {string} label */
export function resolveSaleKindFromLabel(label) {
  const compact = compactKindLabel(label);
  return normalizeSalePropKind(SALE_KIND_LABEL_ALIASES[compact] || '');
}

function saleKindHaystack(p) {
  const subLabel = (PROP_SUB[p?.main] || {})[p?.sub] || '';
  return [p?.tag, p?.sub, subLabel, p?.mainUse, p?.bldg].filter(Boolean).join(' ');
}

/**
 * @param {{ main?: string, sub?: string, tag?: string, mainUse?: string, bldg?: string }} p
 */
export function saleKindFromProp(p) {
  const fromTag = resolveSaleKindFromLabel(p?.tag);
  if (fromTag) return fromTag;
  const sub = p?.sub || '';
  if (sub === 'LAND') return 'LAND';
  if (sub === 'KNOWLEDGE_INDUSTRY') return 'KNOWLEDGE';
  if (sub === 'FACTORY_WAREHOUSE') return 'FACTORY';
  if (sub === 'HOTEL_ACCOMMODATION' || sub === 'LIVING_ACCOMMODATION') return 'HOTEL';
  if (sub === 'DETACHED' || sub === 'COUNTRY_HOUSE') return 'DETACHED';
  if (sub === 'WHOLE_BUILDING') return 'BUILDING';
  const hay = saleKindHaystack(p);
  if (/지식산업/.test(hay)) return 'KNOWLEDGE';
  if (/숙박|호텔|모텔|여관/.test(hay)) return 'HOTEL';
  if (/공장|창고/.test(hay)) return 'FACTORY';
  if (/단독|다가구|전원주택/.test(hay)) return 'DETACHED';
  if (/빌딩|통건물/.test(hay)) return 'BUILDING';
  if (/(^|[^가-힣])토지([^가-힣]|$)/.test(hay) || String(p?.tag || '') === '토지') return 'LAND';
  return '';
}

/**
 * @param {{ main?: string, sub?: string, tag?: string, mainUse?: string, bldg?: string }} p
 * @param {string} kindId
 */
export function propertyMatchesSaleKind(p, kindId) {
  const kind = normalizeSalePropKind(kindId);
  if (!kind) return true;
  return saleKindFromProp(p) === kind;
}

/** @param {{ trade?: string, main?: string, sub?: string, tag?: string }} p */
export function propKindDisplayLabel(p) {
  if (!p) return '';
  if (!isRentalListProperty(p)) {
    const kind = saleKindFromProp(p);
    if (kind) return saleKindLabel(kind);
  }
  return p.tag || PROP_SUB[p.main]?.[p.sub] || '';
}

/** @param {string} kindId */
export function typeCodesForSaleKind(kindId) {
  const k = normalizeSalePropKind(kindId) || 'BUILDING';
  return { ...SALE_KIND_TO_TYPE[k] };
}

/**
 * @param {{ isSale: boolean, saleKind?: string, main?: string, sub?: string }} args
 */
export function typeCodesForSave({ isSale, saleKind, main, sub, tag }) {
  if (isSale) {
    const k = normalizeSalePropKind(saleKind);
    if (k) return typeCodesForSaleKind(k);
  }
  return { main, sub, tag: tag || PROP_SUB[main]?.[sub] || '' };
}
