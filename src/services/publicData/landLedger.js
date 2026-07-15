import { publicDataClient, publicDataGet, unwrapItems } from './apiClient.js';
import { LAND_LEDGER } from './endpoints.js';

/**
 * @typedef {import('../address/parseJibunAddress.js').PublicAddressKeys} PublicAddressKeys
 */

/**
 * @param {PublicAddressKeys} keys
 */
function landParams(keys) {
  return {
    sigunguCd: keys.sigunguCd,
    bjdongCd: keys.bjdongCd,
    platGbCd: keys.platGbCd || '0',
    bun: keys.bun,
    ji: keys.ji,
  };
}

/** 토지이용계획 */
export async function fetchLandUsePlan(keys) {
  const raw = await publicDataGet(publicDataClient, LAND_LEDGER.LAND_USE, landParams(keys));
  return { raw, items: unwrapItems(raw) };
}

/** 토지대장(토지특성·공시지가 등) */
export async function fetchLandCharacteristics(keys) {
  const raw = await publicDataGet(publicDataClient, LAND_LEDGER.LAND_CHAR, landParams(keys));
  return { raw, items: unwrapItems(raw) };
}

/** 토지 API 병렬 조회 */
export async function fetchAllLandLedger(keys) {
  const [landUse, landChar] = await Promise.all([
    fetchLandUsePlan(keys),
    fetchLandCharacteristics(keys),
  ]);
  return { landUse, landChar };
}
