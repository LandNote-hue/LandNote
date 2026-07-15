/**
 * PNU(필지고유번호 19자리) 생성
 * @see https://www.vworld.kr — pnu = 법정동코드(10) + 대지구분(1) + 본번(4) + 부번(4)
 * @param {{ sigunguCd?: string, bjdongCd?: string, admCd?: string, bun?: string, ji?: string, platGbCd?: string }} keys
 */
export function buildPnu(keys) {
  const adm = String(keys.admCd || '').replace(/\D/g, '');
  const ldCode = adm.length >= 10
    ? adm.slice(0, 10)
    : `${keys.sigunguCd || ''}${keys.bjdongCd || ''}`.replace(/\D/g, '').padStart(10, '0').slice(0, 10);

  const mountFlag = keys.platGbCd === '1' ? '2' : '1';
  const bun = String(keys.bun || '0000').replace(/\D/g, '').padStart(4, '0').slice(-4);
  const ji = String(keys.ji || '0000').replace(/\D/g, '').padStart(4, '0').slice(-4);

  return `${ldCode}${mountFlag}${bun}${ji}`;
}

/**
 * PNU 19자리 → 행정코드·본번·부번
 * @param {string} pnu e.g. 4113310500150830000
 */
export function parsePnuFromId(pnu) {
  const s = String(pnu || '').replace(/\D/g, '');
  if (s.length !== 19) return null;
  const admCd = s.slice(0, 10);
  const mountFlag = s[10];
  const bunNum = parseInt(s.slice(11, 15), 10);
  const jiNum = parseInt(s.slice(15, 19), 10);
  return {
    admCd,
    sigunguCd: admCd.slice(0, 5),
    bjdongCd: admCd.slice(5, 10),
    platGbCd: mountFlag === '2' ? '1' : '0',
    bun: bunNum > 0 ? String(bunNum) : s.slice(11, 15),
    ji: jiNum > 0 ? String(jiNum) : undefined,
  };
}
