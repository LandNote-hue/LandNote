import { publicDataClient, publicDataGet, unwrapItems } from './apiClient.js';
import { BUILDING_LEDGER } from './endpoints.js';

/**
 * @typedef {import('../address/parseJibunAddress.js').PublicAddressKeys} PublicAddressKeys
 */

/**
 * @param {PublicAddressKeys} keys
 * @param {Record<string, string|number>} [extra] dongNm, hoNm 등
 */
function baseParams(keys, extra = {}) {
  return {
    sigunguCd: keys.sigunguCd,
    bjdongCd: keys.bjdongCd,
    platGbCd: keys.platGbCd || '0',
    bun: keys.bun,
    ji: keys.ji,
    ...extra,
  };
}

/** 표제부 */
export async function fetchBuildingTitle(keys, extra) {
  const raw = await publicDataGet(publicDataClient, BUILDING_LEDGER.TITLE, baseParams(keys, extra));
  return { raw, items: unwrapItems(raw) };
}

/** 총괄표제부 */
export async function fetchBuildingRecap(keys, extra) {
  const raw = await publicDataGet(publicDataClient, BUILDING_LEDGER.RECAP, baseParams(keys, extra));
  return { raw, items: unwrapItems(raw) };
}

/** 지역지구구역 (용도지역·지구·구역) */
export async function fetchBuildingJijigu(keys, extra) {
  const raw = await publicDataGet(publicDataClient, BUILDING_LEDGER.JIJIGU, baseParams(keys, extra));
  return { raw, items: unwrapItems(raw) };
}

/** 전유부 (집합건물 — 층·호 지정 시) */
export async function fetchBuildingExpos(keys, extra = {}) {
  const raw = await publicDataGet(publicDataClient, BUILDING_LEDGER.EXPOS, baseParams(keys, extra));
  return { raw, items: unwrapItems(raw) };
}

/**
 * 건축물대장 병렬 조회
 * - 표제부·총괄표제부·지역지구구역: 거의 모든 조회에 필요
 * - 전유부: 집합건물(아파트·오피스텔 등)일 때만 extra.dongNm/hoNm 전달
 * @param {PublicAddressKeys} keys
 * @param {{ includeExpos?: boolean, dongNm?: string, hoNm?: string }} [opts]
 */
export async function fetchAllBuildingLedger(keys, opts = {}) {
  const extra = { dongNm: opts.dongNm, hoNm: opts.hoNm };

  const [title, recap, jijigu, expos] = await Promise.all([
    fetchBuildingTitle(keys, extra),
    fetchBuildingRecap(keys, extra),
    fetchBuildingJijigu(keys, extra).catch(err => {
      console.warn('[buildingLedger] 지역지구구역 조회 실패:', err?.message || err);
      return { raw: null, items: [] };
    }),
    opts.includeExpos
      ? fetchBuildingExpos(keys, extra)
      : Promise.resolve({ raw: null, items: [] }),
  ]);

  return { title, recap, jijigu, expos };
}
