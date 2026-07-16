/** 매물 대분류·소분류 (등록 폼·일괄등록 공용) */

export const PROP_MAIN = {
  APT_OFFICETEL: '아파트·오피스텔',
  VILLA_HOUSE: '빌라·주택',
  ONEROOM_TWOROOM: '원룸·투룸',
  COMMERCIAL: '상가·업무·공장·토지',
  NEW_DEVELOPMENT: '분양',
};

export const PROP_SUB = {
  APT_OFFICETEL: {
    APARTMENT: '아파트', APT_PRESALE: '아파트 분양권', RECONSTRUCTION: '재건축',
    OFFICETEL_RESI: '오피스텔(주거)', OFFICETEL_COMM: '오피스텔(업무)',
    OFFICETEL_PRESALE: '오피스텔 분양권', REDEVELOPMENT: '재개발',
  },
  VILLA_HOUSE: {
    VILLA: '빌라/연립', DETACHED: '단독/다가구',
    COUNTRY_HOUSE: '전원주택', COMMERCIAL_HOUSE: '상가주택',
  },
  ONEROOM_TWOROOM: { ONEROOM: '원룸', TWOROOM: '투룸', OFFICETEL_STUDIO: '오피스텔(원룸형)' },
  COMMERCIAL: {
    STORE: '상가', OFFICE: '사무실', WHOLE_BUILDING: '건물(통건물)',
    FACTORY_WAREHOUSE: '공장/창고', KNOWLEDGE_INDUSTRY: '지식산업센터', LAND: '토지',
  },
  NEW_DEVELOPMENT: {
    APT_NEW: '아파트(분양)', OFFICETEL_NEW: '오피스텔(분양)',
    VILLA_NEW: '빌라(분양)', URBAN_LIVING: '도시형생활주택',
    LIVING_ACCOMMODATION: '생활숙박시설', COMMERCIAL_OFFICE_NEW: '상가/업무(분양)',
  },
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
  if (!subEntry) return null;
  return { main, sub: subEntry[0], tag: subEntry[1] };
}
