import { isPlaceholderPropertyAddress } from './propAddress.js';
import { isSaleTrade } from './propListKind.js';
import { parseFormNum } from './propertyForm.js';

export function hasRealPropertyAddress(record) {
  const parts = [record?.jibunAddr, record?.roadAddr, record?.addr];
  return parts.some((raw) => {
    const s = String(raw || '').trim();
    return s && !isPlaceholderPropertyAddress(s);
  });
}

/**
 * 준비중(NEW)은 미완성 초안 허용.
 * 매각중(ACTIVE) 저장·전환 시 실제 주소·종류·(매매면) 유효 매도호가 필수.
 * @param {Record<string, unknown>} record 저장될 최종 형태
 * @returns {{ ok: true }|{ ok: false, message: string }}
 */
export function validatePropertyForSave(record) {
  const status = record?.status;
  if (status !== 'ACTIVE') return { ok: true };

  if (!hasRealPropertyAddress(record)) {
    return { ok: false, message: '매각중으로 저장하려면 주소를 입력해 주세요.' };
  }

  const hasType = !!(record.main || record.sub || record.tag);
  if (!hasType) {
    return { ok: false, message: '매각중으로 저장하려면 매물 종류를 선택해 주세요.' };
  }

  if (isSaleTrade(record.trade)) {
    const price = parseFormNum(record.price);
    if (!(price > 0)) {
      return { ok: false, message: '매각중으로 저장하려면 유효한 매도호가를 입력해 주세요.' };
    }
  }

  return { ok: true };
}

export function lookupBlocksPropertySave(lookup, extraParcelLoading) {
  if (extraParcelLoading) return true;
  return lookup?.status === 'loading';
}

export function propertySaveBlockedTitle(lookup, extraParcelLoading) {
  if (lookupBlocksPropertySave(lookup, extraParcelLoading)) {
    return '필지 정보를 조회하는 동안에는 저장할 수 없습니다.';
  }
  return undefined;
}
