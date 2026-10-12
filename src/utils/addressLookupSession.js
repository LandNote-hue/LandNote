import { parcelIdentityKey } from './propertyParcels.js';

/**
 * @param {Record<string, unknown>|null|undefined} prevKeys
 * @param {Record<string, unknown>|null|undefined} nextKeys
 */
export function classifyParcelChange(prevKeys, nextKeys) {
  const prev = parcelIdentityKey(prevKeys);
  const next = parcelIdentityKey(nextKeys);
  const sameParcel = !!(prev && next && prev === next);
  const parcelChanged = !!(prev && next && prev !== next);
  return { prev, next, sameParcel, parcelChanged };
}

/**
 * 늦게 도착한 이전 요청은 현재 세대·필지가 다를 때 버린다.
 * @param {number} activeGen
 * @param {number} resultGen
 * @param {string} activeIdent
 * @param {string} resultIdent
 */
export function shouldCommitLookupResult(activeGen, resultGen, activeIdent, resultIdent) {
  return Number(activeGen) === Number(resultGen)
    && String(activeIdent || '') === String(resultIdent || '');
}

/** 조회 실패 시 훅 land/building 처리. 다른 필지면 비우고 미확인. */
export function lookupFailureFormPolicy(parcelChanged) {
  if (parcelChanged) {
    return { status: 'unverified', parcelChanged: true, clearLandBuilding: true };
  }
  return { status: 'error', parcelChanged: false, clearLandBuilding: false };
}

export { keysFromAddressData } from './addressLookupKeys.js';
