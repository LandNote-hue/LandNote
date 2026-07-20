/**
 * 금액 표시 — 천 단위 콤마 (억·만·원)
 * 매물 매매가(price)·고객 cash/buyMin/buyMax 는 DB에 **만원** 단위로 저장
 */

/** 1억 = 10,000만원 */
export const EOK_TO_MAN = 10000;

/** @param {unknown} n 억 단위로 저장된 값으로 보이는지 (0 < n < 10,000) */
export function looksLikeEokStored(n) {
  const v = Number(n);
  return Number.isFinite(v) && v > 0 && v < EOK_TO_MAN;
}

/**
 * 전세보증금 jDep — DB·표시를 **만원**으로 통일
 * 구버전 억 단위(대개 1~999, 소수 포함)는 ×10000 변환
 * @param {unknown} v
 * @returns {number}
 */
export function normalizeJDepToMan(v) {
  const n = Number(String(v ?? '').replace(/,/g, ''));
  if (!Number.isFinite(n) || n <= 0) return 0;
  // 이미 만원(예: 35000)이면 그대로. 구 억(예: 3.5, 25)만 변환
  if (n < 1000) return Math.round(n * EOK_TO_MAN);
  return Math.round(n);
}

/** @param {string|number|null|undefined} v @param {{ decimal?: boolean }} [opts] */
export function fmtNum(v, { decimal = false } = {}) {
  if (v == null || v === '') return '';
  const n = Number(String(v).replace(/,/g, ''));
  if (!Number.isFinite(n)) return String(v);
  if (decimal) {
    return n.toLocaleString('ko-KR', { maximumFractionDigits: 2 });
  }
  return Math.round(n).toLocaleString('ko-KR');
}

/**
 * 입력 필드용 — 입력 중에도 천 단위 콤마 표시
 * @param {string|number|null|undefined} v
 * @param {{ decimal?: boolean, maxDecimals?: number }} [opts]
 */
export function fmtInputNum(v, { decimal = false, maxDecimals = 2 } = {}) {
  const raw = String(v ?? '').replace(/,/g, '');
  if (raw === '') return '';

  if (!decimal) {
    const digits = raw.replace(/\D/g, '');
    if (digits === '') return '';
    return Number(digits).toLocaleString('ko-KR');
  }

  const endsWithDot = raw.endsWith('.');
  const cleaned = raw.replace(/[^\d.]/g, '');
  const dotIdx = cleaned.indexOf('.');
  if (dotIdx < 0) {
    const digits = cleaned.replace(/\D/g, '');
    if (digits === '') return '';
    return Number(digits).toLocaleString('ko-KR');
  }
  const intRaw = cleaned.slice(0, dotIdx).replace(/\D/g, '');
  const decRaw = cleaned.slice(dotIdx + 1).replace(/\D/g, '').slice(0, maxDecimals);
  const intPart = intRaw === '' ? '0' : intRaw;
  const formattedInt = Number(intPart).toLocaleString('ko-KR');
  if (endsWithDot && decRaw === '') return `${formattedInt}.`;
  if (decRaw !== '') return `${formattedInt}.${decRaw}`;
  return formattedInt;
}

/**
 * 원 단위 금액을 "X억 Y만 Z원" 한글 단위 문자열로 변환.
 * 하위 단위가 전부 0이면 잘라내고, 마지막으로 표시되는 단위에 '원'을 붙여 마무리한다.
 * (예: 120억 3456만 1235원 · 1200억원 · 35만원 · 4500원)
 * @param {string|number|null|undefined} amountWon 원 단위 금액
 * @returns {string}
 */
export function formatKoreanAmount(amountWon) {
  if (amountWon == null || amountWon === '') return '';
  const n = Number(String(amountWon).replace(/,/g, ''));
  if (!Number.isFinite(n)) return '';

  const sign = n < 0 ? '-' : '';
  const abs = Math.round(Math.abs(n));

  const eok = Math.floor(abs / 100000000);
  const man = Math.floor((abs % 100000000) / 10000);
  const won = abs % 10000;

  const parts = [];
  if (eok > 0) parts.push(`${eok}억`);
  if (man > 0) parts.push(`${man}만`);
  if (won > 0) parts.push(`${won}원`);

  if (parts.length === 0) return '0원';
  if (!parts[parts.length - 1].endsWith('원')) {
    parts[parts.length - 1] += '원';
  }
  return sign + parts.join(' ');
}

/**
 * **만원** 단위로 저장된 금액(매매가·보증금 등 이 앱의 저장 단위)을
 * formatKoreanAmount로 변환하는 편의 함수.
 * @param {string|number|null|undefined} amountMan 만원 단위 금액
 * @returns {string}
 */
export function formatKoreanAmountFromMan(amountMan) {
  if (amountMan == null || amountMan === '') return '';
  const n = Number(String(amountMan).replace(/,/g, ''));
  if (!Number.isFinite(n)) return '';
  return formatKoreanAmount(n * 10000);
}

/** @param {string|number|null|undefined} v */
export function fmtEok(v) {
  if (v == null || v === '' || Number(v) === 0) return null;
  return `${fmtNum(v, { decimal: true })}억`;
}

/** @param {string|number|null|undefined} v */
export function fmtMan(v) {
  if (v == null || v === '' || Number(v) === 0) return null;
  return `${fmtNum(v)}만`;
}

/** @param {string|number|null|undefined} v @param {string} [suffix] */
export function fmtWon(v, suffix = '원') {
  if (v == null || v === '') return null;
  return `${fmtNum(v)}${suffix}`;
}

const M2_PER_PY = 3.3058;

/** @param {number|string|null|undefined} m2 */
export function m2ToPyung(m2) {
  const n = Number(m2);
  if (!Number.isFinite(n) || n <= 0) return null;
  return n / M2_PER_PY;
}

/**
 * 평단가(만/평) = 매각금액(만) ÷ 면적(평)
 * @param {number|string|null|undefined} priceMan 매각·매매가 (만)
 * @param {number|string|null|undefined} areaM2 면적 (㎡)
 */
export function calcPyUnitPriceMan(priceMan, areaM2) {
  const price = Number(priceMan);
  const pyung = m2ToPyung(areaM2);
  if (!Number.isFinite(price) || price <= 0 || !pyung) return null;
  return price / pyung;
}

/** @param {number|string|null|undefined} priceMan @param {number|string|null|undefined} areaM2 */
export function fmtLandPyUnit(priceMan, areaM2) {
  const pyVal = calcPyUnitPriceMan(priceMan, areaM2);
  if (pyVal == null) return '—';
  return `${fmtNum(Math.round(pyVal))}만/평`;
}

/** @param {{ trade?: string, price?: number, jDep?: number, mDep?: number, mRent?: number }} p */
export function fmtPropPrice(p) {
  if (!p) return '—';
  if (p.trade === 'SALE' || p.trade === 'PRESALE') {
    return p.price != null && p.price !== '' ? formatKoreanAmountFromMan(p.price) : '—';
  }
  if (p.trade === 'JEONSE') {
    const man = normalizeJDepToMan(p.jDep);
    return man > 0 ? formatKoreanAmountFromMan(man) : '—';
  }
  if (p.trade === 'MONTHLY' || p.trade === 'SHORT_TERM') {
    const dep = p.mDep != null && p.mDep !== '' ? formatKoreanAmountFromMan(p.mDep) : '';
    const rent = p.mRent != null && p.mRent !== '' ? formatKoreanAmountFromMan(p.mRent) : '';
    if (dep && rent) return `${dep}/${rent}`;
    return dep || rent || '—';
  }
  return '—';
}

/** @param {string|number|null|undefined} v @param {string} [unit] */
export function fmtWithUnit(v, unit) {
  if (v == null || v === '') return '—';
  const dec = unit === '억';
  return `${fmtNum(v, { decimal: dec })}${unit}`;
}

/** 필터·정렬용 가격 — 만원 단위 (매매·분양: price, 전세: jDep 만) */
/** @param {{ trade?: string, price?: number, jDep?: number }} p */
export function priceInManForFilter(p) {
  if (p.trade === 'SALE' || p.trade === 'PRESALE') return p.price || 0;
  if (p.trade === 'JEONSE') return normalizeJDepToMan(p.jDep);
  return null;
}
