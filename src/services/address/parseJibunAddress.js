/**
 * 지번주소 → 공공데이터 API 호출 키 파싱
 * 시군구코드·법정동코드는 도로명/지번 주소 API(행정안전부 juso 등) 응답에서 우선 취득하고,
 * 본번·부번은 지번 문자열에서 추출·패딩한다.
 */

/** @typedef {Object} AddressSearchResult 주소 검색(도로명/지번) 확정 결과 */
/** @property {string} [roadAddr] 도로명주소 */
/** @property {string} jibunAddr 지번주소 (필수) */
/** @property {string} [sigunguCd] 시군구코드 5자리 (juso admCd 앞 5자리) */
/** @property {string} [bjdongCd] 법정동코드 5자리 (juso admCd 뒤 5자리 또는 bjdongCd) */
/** @property {string} [admCd] 행정구역코드 10자리 (있으면 sigungu/bjdong 분리) */
/** @property {string} [bun] 본번 4자리 */
/** @property {string} [ji] 부번 4자리 */
/** @property {string} [platGbCd] 대지(0) / 산(1) */

/** @typedef {Object} PublicAddressKeys 공공데이터 API 공통 파라미터 */
/** @property {string} sigunguCd 시군구코드 5자리 */
/** @property {string} bjdongCd 법정동코드 5자리 */
/** @property {string} bun 본번 4자리 (zero-pad) */
/** @property {string} ji 부번 4자리 (zero-pad, 없으면 0000) */
/** @property {string} platGbCd 0=대지, 1=산 */
/** @property {string} jibunAddr 원본 지번주소 */
/** @property {string} [roadAddr] 도로명주소 */
/** @property {string[]} [warnings] 파싱 경고 */

/** @param {string|number|null|undefined} n */
export function padLotNumber(n) {
  const s = String(n ?? '').replace(/\D/g, '');
  if (!s) return '0000';
  return s.padStart(4, '0').slice(-4);
}

/**
 * 지번주소 문자열에서 본번·부번·산 구분 추출
 * @param {string} jibunAddr e.g. "서울특별시 영등포구 영등포동 3-1", "경기 성남시 분당구 정자동 산 45-2"
 */
export function parseJibunLot(jibunAddr) {
  const warnings = [];
  const text = (jibunAddr || '').trim();
  if (!text) {
    return { platGbCd: '0', bun: '0000', ji: '0000', warnings: ['지번주소가 비어 있습니다.'] };
  }

  const platGbCd = /\s산\s/.test(text) ? '1' : '0';
  const lotMatch = text.match(/(\d+)\s*-\s*(\d+)\s*$/) || text.match(/(\d+)\s*$/);
  if (!lotMatch) {
    warnings.push('본번·부번을 지번주소에서 추출하지 못했습니다.');
    return { platGbCd, bun: '0000', ji: '0000', warnings };
  }

  const bun = padLotNumber(lotMatch[1]);
  const ji = lotMatch[2] != null ? padLotNumber(lotMatch[2]) : '0000';
  return { platGbCd, bun, ji, warnings };
}

/**
 * admCd(10자리) → sigunguCd(5) + bjdongCd(5)
 * @param {string} admCd
 */
export function splitAdmCd(admCd) {
  const cd = String(admCd || '').replace(/\D/g, '');
  if (cd.length !== 10) return { sigunguCd: '', bjdongCd: '' };
  return { sigunguCd: cd.slice(0, 5), bjdongCd: cd.slice(5, 10) };
}

/**
 * 주소 검색 확정 결과 → API 호출 키 정규화
 * 본번·부번: juso lnbrMnnm/lnbrSlno 우선, 없을 때만 지번 문자열 파싱
 * @param {AddressSearchResult} addressData
 * @returns {PublicAddressKeys & { warnings: string[] }}
 */
export function normalizeAddressKeys(addressData) {
  const warnings = [];
  const jibunAddr = (addressData.jibunAddr || '').trim();
  const roadAddr = (addressData.roadAddr || '').trim();
  const lot = parseJibunLot(jibunAddr);

  const hasJusoBun = hasLotComponent(addressData.bun);
  const hasJusoJi = addressData.ji !== undefined && addressData.ji !== null && addressData.ji !== '';

  const bun = hasJusoBun ? padLotNumber(addressData.bun) : lot.bun;
  const ji = hasJusoJi ? padLotNumber(addressData.ji) : lot.ji;

  if (lot.warnings.length && !hasJusoBun && bun === '0000') {
    warnings.push(...lot.warnings);
  }

  let sigunguCd = addressData.sigunguCd || '';
  let bjdongCd = addressData.bjdongCd || '';

  if (addressData.admCd) {
    const split = splitAdmCd(addressData.admCd);
    sigunguCd = sigunguCd || split.sigunguCd;
    bjdongCd = bjdongCd || split.bjdongCd;
  }

  if (!sigunguCd || !bjdongCd) {
    warnings.push('시군구코드·법정동코드는 주소 검색 API(juso) 응답 admCd가 필요합니다.');
  }

  return {
    jibunAddr: enrichJibunAddr(jibunAddr, bun, ji),
    roadAddr,
    sigunguCd: padCode5(sigunguCd),
    bjdongCd: padCode5(bjdongCd),
    bun,
    ji,
    platGbCd: addressData.platGbCd ?? lot.platGbCd,
    warnings,
  };
}

/** @param {string|number|null|undefined} v */
function hasLotComponent(v) {
  if (v == null) return false;
  const s = String(v).replace(/\D/g, '');
  return s.length > 0 && parseInt(s, 10) > 0;
}

/** @param {string} bun @param {string} ji */
function formatLotLabel(bun, ji) {
  const bunNum = parseInt(bun, 10);
  const jiNum = parseInt(ji, 10);
  if (Number.isNaN(bunNum) || bunNum <= 0) return '';
  if (ji && ji !== '0000' && !Number.isNaN(jiNum) && jiNum > 0) {
    return `${bunNum}-${jiNum}`;
  }
  return `${bunNum}`;
}

/**
 * 끝에 중복 붙은 본번·부번 제거
 * e.g. "상계동 1264 은빛3단지아파트 1264" → "상계동 1264 은빛3단지아파트"
 * @param {string} jibunAddr
 */
export function stripTrailingDuplicateLot(jibunAddr) {
  const text = String(jibunAddr || '').trim();
  if (!text) return text;

  const trailing = text.match(/(\d+(?:-\d+)?)\s*$/);
  if (!trailing) return text;

  const lot = trailing[1];
  const beforeTrailing = text.slice(0, trailing.index).trim();
  if (!beforeTrailing || !jibunAddrMatchesLot(beforeTrailing, lot)) return text;
  return beforeTrailing;
}

/** 지번 문자열에 본번·부번이 없을 때 juso 값으로 표시 보완 */
function enrichJibunAddr(jibunAddr, bun, ji) {
  if (!jibunAddr || bun === '0000') return jibunAddr;

  const lotLabel = formatLotLabel(bun, ji);
  if (!lotLabel) return jibunAddr;

  const parsed = parseJibunLot(jibunAddr);
  if (!parsed.warnings.length) return stripTrailingDuplicateLot(jibunAddr);
  if (jibunAddrMatchesLot(jibunAddr, lotLabel)) return stripTrailingDuplicateLot(jibunAddr);

  return stripTrailingDuplicateLot(`${jibunAddr} ${lotLabel}`.trim());
}

/** @param {string} code */
function padCode5(code) {
  const s = String(code || '').replace(/\D/g, '');
  return s.length >= 5 ? s.slice(0, 5) : s.padStart(5, '0');
}

/** @param {string} keyword @returns {{ dong: string, lot: string }|null} */
export function parseDongLotKeyword(keyword) {
  const t = String(keyword || '').trim();
  const lotMatch = t.match(/(\d+(?:-\d+)?)\s*$/);
  if (!lotMatch) return null;
  const lot = lotMatch[1];
  const prefix = t.slice(0, lotMatch.index).trim();
  const dongMatch = prefix.match(/([가-힣0-9]+(?:동|리|읍|면))$/);
  if (!dongMatch) return null;
  return { dong: dongMatch[1], lot };
}

/** @param {string} jibunAddr @param {string} lot e.g. 5180, 51-80 */
export function jibunAddrMatchesLot(jibunAddr, lot) {
  const addr = String(jibunAddr || '').trim();
  if (!addr || !lot) return false;
  const [bun, ji] = lot.split('-');
  if (!/^\d+$/.test(bun)) return false;
  if (ji !== undefined && /^\d+$/.test(ji)) {
    return new RegExp(`(?:동|리|가|면|읍)\\s*${bun}\\s*[-\\s]?${ji}(?:번지)?(?:\\s|$)`).test(addr);
  }
  return new RegExp(`(?:동|리|가|면|읍)\\s*${bun}(?:-(?:\\d+))?(?:번지)?(?:\\s|$)`).test(addr);
}

/** @param {string} keyword */
export function compactDongLotKeyword(keyword) {
  return String(keyword || '').trim().replace(/(\D)\s+(\d)/, '$1$2');
}

/** API 요청용 query 객체 */
export function toPublicDataQuery(keys) {
  return {
    sigunguCd: keys.sigunguCd,
    bjdongCd: keys.bjdongCd,
    bun: keys.bun,
    ji: keys.ji,
    platGbCd: keys.platGbCd || '0',
  };
}
