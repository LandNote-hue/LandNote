import { vworldGet, vworldExtractFields } from './vworldClient.js';

export const VWORLD_LAND = {
  CHARACTERISTICS: '/ned/data/getLandCharacteristics',
  INDVD_PRICE: '/ned/data/getIndvdLandPriceAttr',
  LAND_USE: '/ned/data/getLandUseAttr',
};

const YEAR_FALLBACK_DEPTH = 6;
/** 기준연도 API가 응답 없이 멈출 때(2026 개별공시지가) 다음 연도로 넘기기 위한 상한 */
const YEAR_REQUEST_TIMEOUT_MS = 4_000;

async function fetchWithYearFallback(path, rootKey, pnu, startYear, extraParams = {}) {
  const baseYear = parseInt(startYear, 10) || new Date().getFullYear();
  /** @type {{ raw: unknown, item: null, fields: unknown[], stdrYear: string } | null} */
  let newestEmpty = null;
  let lastErr;

  for (let offset = 0; offset < YEAR_FALLBACK_DEPTH; offset++) {
    const year = String(baseYear - offset);
    try {
      const raw = await vworldGet(
        path,
        { pnu, stdrYear: year, ...extraParams },
        { timeout: YEAR_REQUEST_TIMEOUT_MS },
      );
      const fields = vworldExtractFields(raw, rootKey);
      if (fields.length) {
        return { raw, item: fields[0], fields, stdrYear: year };
      }
      if (!newestEmpty) newestEmpty = { raw, item: null, fields, stdrYear: year };
    } catch (err) {
      lastErr = err;
      console.warn(`[vworld] ${rootKey} ${year} 조회 실패:`, err?.message || err);
    }
  }

  if (newestEmpty) return newestEmpty;
  throw lastErr ?? new Error('vworld 조회 실패');
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
