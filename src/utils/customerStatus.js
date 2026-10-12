/** 고객 등급 — 매수·임차 공통 */

export const CUST_STATUS_OPTS = [
  { id: 'URGENT', label: '긴급' },
  { id: 'NORMAL', label: '보통' },
  { id: 'HOLD', label: '보류' },
  { id: 'MANAGE', label: '관리' },
];

/** 긴급이 가장 큼 — 기본 목록은 이 값 내림차순 */
const GRADE_RANK = {
  URGENT: 4,
  NORMAL: 3,
  HOLD: 2,
  MANAGE: 1,
};

const STATUS_TEXT_TO_CODE = {
  긴급: 'URGENT',
  보통: 'NORMAL',
  보류: 'HOLD',
  관리: 'MANAGE',
  진행중: 'NORMAL',
  완료: 'MANAGE',
  계약완료: 'MANAGE',
};

const LEGACY_CODE = {
  ACTIVE: 'NORMAL',
  COMPLETED: 'MANAGE',
};

/** @param {string|undefined|null} s */
export function normalizeCustStatus(s) {
  const raw = String(s || '').trim();
  if (CUST_STATUS_OPTS.some((o) => o.id === raw)) return raw;
  if (LEGACY_CODE[raw]) return LEGACY_CODE[raw];
  const compact = raw.replace(/\s/g, '');
  const mapped = STATUS_TEXT_TO_CODE[raw] || STATUS_TEXT_TO_CODE[compact];
  if (mapped) return mapped;
  return 'NORMAL';
}

/** @param {{ status?: string }|null|undefined} c */
export function custStatusOf(c) {
  return normalizeCustStatus(c?.status);
}

/** @param {string|{ status?: string }|null|undefined} s */
export function custGradeRank(s) {
  const code = typeof s === 'string' || s == null ? normalizeCustStatus(s) : custStatusOf(s);
  return GRADE_RANK[code] || GRADE_RANK.NORMAL;
}

/**
 * CSV·텍스트 → 등급 코드
 * @param {string} text
 * @returns {{ ok: true, status: string } | { ok: false, error: string }}
 */
export function parseCustomerStatusFromText(text) {
  const t = String(text || '').trim();
  if (!t) return { ok: true, status: 'NORMAL' };
  const compact = t.replace(/\s/g, '');
  const upper = t.toUpperCase();
  if (CUST_STATUS_OPTS.some((o) => o.id === upper)) {
    return { ok: true, status: upper };
  }
  if (LEGACY_CODE[upper]) return { ok: true, status: LEGACY_CODE[upper] };
  const mapped = STATUS_TEXT_TO_CODE[t] || STATUS_TEXT_TO_CODE[compact];
  if (mapped) return { ok: true, status: mapped };
  return { ok: false, error: '등급 확인 필요 (긴급·보통·보류·관리, 비우면 보통)' };
}
