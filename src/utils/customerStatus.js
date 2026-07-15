/** 고객 진행 상태 — 등록 폼·일괄 CSV·목록 공통 */

export const CUST_STATUS_OPTS = [
  { id: 'ACTIVE', label: '진행중' },
  { id: 'HOLD', label: '보류' },
  { id: 'COMPLETED', label: '완료' },
];

const STATUS_TEXT_TO_CODE = {
  진행중: 'ACTIVE',
  보류: 'HOLD',
  완료: 'COMPLETED',
  계약완료: 'COMPLETED',
};

/** @param {string|undefined|null} s */
export function normalizeCustStatus(s) {
  return CUST_STATUS_OPTS.some((o) => o.id === s) ? s : 'ACTIVE';
}

/** @param {{ status?: string }|null|undefined} c */
export function custStatusOf(c) {
  return normalizeCustStatus(c?.status);
}

/**
 * CSV·텍스트 → 상태 코드
 * @param {string} text
 * @returns {{ ok: true, status: string } | { ok: false, error: string }}
 */
export function parseCustomerStatusFromText(text) {
  const t = String(text || '').trim();
  if (!t) return { ok: true, status: 'ACTIVE' };
  const compact = t.replace(/\s/g, '');
  const upper = t.toUpperCase();
  if (CUST_STATUS_OPTS.some((o) => o.id === upper)) {
    return { ok: true, status: upper };
  }
  const mapped = STATUS_TEXT_TO_CODE[t] || STATUS_TEXT_TO_CODE[compact];
  if (mapped) return { ok: true, status: mapped };
  return { ok: false, error: '진행상태 확인 필요 (진행중·보류·완료, 비우면 진행중)' };
}
