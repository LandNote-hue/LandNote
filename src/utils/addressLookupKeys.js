import { normalizeAddressKeys } from '../services/address/parseJibunAddress.js';
import { buildPnu, isUsablePnu } from '../services/address/buildPnu.js';

export function keysFromAddressData(addressData) {
  const normalized = normalizeAddressKeys(addressData || {});
  const platGbCd = normalized.platGbCd || addressData?.platGbCd || '0';
  const built = buildPnu({
    admCd: addressData?.admCd || `${normalized.sigunguCd || ''}${normalized.bjdongCd || ''}`,
    sigunguCd: normalized.sigunguCd,
    bjdongCd: normalized.bjdongCd,
    bun: normalized.bun,
    ji: normalized.ji,
    platGbCd,
  });
  const fromSearch = String(addressData?.pnu || '').replace(/\D/g, '');
  const pnu = isUsablePnu(fromSearch) ? fromSearch : built;
  return {
    keys: {
      roadAddr: normalized.roadAddr,
      jibunAddr: normalized.jibunAddr,
      sigunguCd: normalized.sigunguCd,
      bjdongCd: normalized.bjdongCd,
      bun: normalized.bun,
      ji: normalized.ji,
      platGbCd,
      pnu,
    },
    normalized,
  };
}
