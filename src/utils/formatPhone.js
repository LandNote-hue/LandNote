/** 숫자만 추출 */
export function digitsOnly(value) {
  return String(value ?? '').replace(/\D/g, '');
}

/**
 * 한국 전화번호 표시 형식 (01050465242 → 010-5046-5242)
 * @param {unknown} value
 */
export function formatPhone(value) {
  const n = digitsOnly(value);
  if (!n) return '';

  // 휴대폰 010, 011, 016, 017, 018, 019
  if (n.startsWith('01')) {
    const s = n.slice(0, 11);
    if (s.length <= 3) return s;
    if (s.length <= 7) return `${s.slice(0, 3)}-${s.slice(3)}`;
    return `${s.slice(0, 3)}-${s.slice(3, 7)}-${s.slice(7)}`;
  }

  // 대표번호 1588, 1566 등
  if (/^1[568]\d{2}/.test(n)) {
    const s = n.slice(0, 8);
    if (s.length <= 4) return s;
    return `${s.slice(0, 4)}-${s.slice(4)}`;
  }

  // 서울 02
  if (n.startsWith('02')) {
    const s = n.slice(0, 10);
    if (s.length <= 2) return s;
    if (s.length <= 5) return `02-${s.slice(2)}`;
    if (s.length <= 9) return `02-${s.slice(2, s.length - 4)}-${s.slice(-4)}`;
    return `02-${s.slice(2, 6)}-${s.slice(6, 10)}`;
  }

  // 지역번호 031, 032, 050 등
  if (n.startsWith('0')) {
    const s = n.slice(0, 11);
    if (s.length <= 3) return s;
    if (s.length <= 6) return `${s.slice(0, 3)}-${s.slice(3)}`;
    if (s.length <= 10) return `${s.slice(0, 3)}-${s.slice(3, s.length - 4)}-${s.slice(-4)}`;
    return `${s.slice(0, 3)}-${s.slice(3, 7)}-${s.slice(7, 11)}`;
  }

  return n;
}

/** 검색: 숫자만 입력해도 하이픈 포함 번호와 매칭 */
export function phoneMatches(phone, query) {
  const q = String(query ?? '').trim();
  if (!q) return true;
  const p = String(phone ?? '');
  if (p.includes(q)) return true;
  const qd = digitsOnly(q);
  if (!qd) return false;
  return digitsOnly(p).includes(qd);
}

/** 저장 시 일관된 형식으로 정규화 (빈 값은 빈 문자열) */
export function normalizePhone(value) {
  return formatPhone(value);
}

/** 고객 연락처 고유값 비교용 (숫자만) */
export function customerPhoneKey(value) {
  return digitsOnly(normalizePhone(value));
}

/**
 * 검색어가 전화번호로 등록 가능한지 (고객 목록에 없어도 직접 입력용)
 * @param {unknown} query
 * @returns {boolean}
 */
export function looksLikePhoneQuery(query) {
  const d = digitsOnly(query);
  return d.length >= 8 && d.length <= 12;
}

/**
 * 미등록 전화번호로 추가할 표시값 — 이미 동일 번호 고객이 있으면 null
 * @param {unknown} query
 * @param {Array<{ phone?: string }>} customers
 * @returns {string|null}
 */
export function freePhoneOptionFromSearch(query, customers = []) {
  if (!looksLikePhoneQuery(query)) return null;
  const key = customerPhoneKey(query);
  if (!key) return null;
  if ((customers ?? []).some((c) => customerPhoneKey(c.phone) === key)) return null;
  return formatPhone(query) || key;
}

