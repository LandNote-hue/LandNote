import { vworldGet, vworldExtractFields } from './vworldClient.js';

export const VWORLD_LAND = {
  CHARACTERISTICS: '/ned/data/getLandCharacteristics',
  INDVD_PRICE: '/ned/data/getIndvdLandPriceAttr',
  LAND_USE: '/ned/data/getLandUseAttr',
};

const YEAR_FALLBACK_DEPTH = 6;

async function fetchWithYearFallback(path, rootKey, pnu, startYear, extraParams = {}) {
  const baseYear = parseInt(startYear, 10) || new Date().getFullYear();

  for (let offset = 0; offset < YEAR_FALLBACK_DEPTH; offset++) {
    const year = String(baseYear - offset);
    const raw = await vworldGet(path, { pnu, stdrYear: year, ...extraParams });
    const fields = vworldExtractFields(raw, rootKey);
    if (fields.length) {
      return { raw, item: fields[0], fields, stdrYear: year };
    }
  }

  const year = String(baseYear);
  const raw = await vworldGet(path, { pnu, stdrYear: year, ...extraParams });
  const fields = vworldExtractFields(raw, rootKey);
  return { raw, item: fields[0] ?? null, fields, stdrYear: year };
}

/**
 * @param {string} pnu 19자리
 * @param {string} stdrYear 기준연도
 */
export async function fetchLandCharacteristics(pnu, stdrYear) {
  return fetchWithYearFallback(VWORLD_LAND.CHARACTERISTICS, 'landCharacteristics', pnu, stdrYear);
}

/** 개별공시지가속성조회 */
export async function fetchIndvdLandPrice(pnu, stdrYear) {
  return fetchWithYearFallback(VWORLD_LAND.INDVD_PRICE, 'indvdLandPrices', pnu, stdrYear);
}

/** 토지이용계획속성조회 — 다건 */
export async function fetchLandUsePlan(pnu, stdrYear) {
  return fetchWithYearFallback(
    VWORLD_LAND.LAND_USE,
    'landUses',
    pnu,
    stdrYear,
    { numOfRows: 100 },
  );
}

/**
 * 토지 특성·공시지가·이용계획 병렬 조회
 * @param {string} pnu
 * @param {string} [stdrYear] 미지정 시 올해
 */
export async function fetchVworldLandBundle(pnu, stdrYear) {
  const year = stdrYear || String(new Date().getFullYear());

  // 개별공시지가 기준연도를 먼저 확정 — 토지특성·이용계획과 연도 불일치 방지
  const price = await fetchIndvdLandPrice(pnu, year);
  const settledYear = price.stdrYear || year;

  const [characteristics, landUse] = await Promise.all([
    fetchLandCharacteristics(pnu, settledYear),
    fetchLandUsePlan(pnu, settledYear),
  ]);

  return { pnu, stdrYear: settledYear, characteristics, price, landUse };
}
