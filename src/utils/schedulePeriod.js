/**
 * 일정 기간(시작일~종료일) 유틸
 * - date: 시작일 (YYYY-MM-DD, 필수)
 * - dateEnd: 종료일 (선택, 없으면 당일 일정)
 */

/** @param {unknown} iso */
export function isValidIsoDate(iso) {
  return typeof iso === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(iso);
}

/**
 * 유효한 종료일만 반환 (시작일보다 이전이거나 같으면 '')
 * @param {unknown} date
 * @param {unknown} dateEnd
 */
export function normalizeScheduleDateEnd(date, dateEnd) {
  const start = isValidIsoDate(date) ? date : '';
  const end = isValidIsoDate(dateEnd) ? dateEnd : '';
  if (!start || !end) return '';
  if (end <= start) return '';
  return end;
}

/** @param {Record<string, unknown>|null|undefined} sched */
export function scheduleEndIso(sched) {
  if (!sched) return '';
  return normalizeScheduleDateEnd(sched.date, sched.dateEnd);
}

/** @param {string} iso YYYY-MM-DD */
export function fmtScheduleDateKo(iso) {
  if (!isValidIsoDate(iso)) return '—';
  const [y, m, d] = iso.split('-').map(Number);
  return `${y}년 ${m}월 ${d}일`;
}

/** @param {string} iso YYYY-MM-DD */
export function fmtScheduleDateDot(iso) {
  if (!isValidIsoDate(iso)) return '—';
  return iso.replace(/-/g, '.');
}

/**
 * 표시용 기간 — 예: "2026년 7월 15일 ~ 2027년 1월 12일"
 * @param {Record<string, unknown>|null|undefined} sched
 */
export function fmtSchedulePeriodKo(sched) {
  const start = isValidIsoDate(sched?.date) ? String(sched.date) : '';
  if (!start) return '—';
  const end = scheduleEndIso(sched);
  if (!end) return fmtScheduleDateKo(start);
  return `${fmtScheduleDateKo(start)} ~ ${fmtScheduleDateKo(end)}`;
}

/**
 * 짧은 기간 — 예: "2026.07.15 ~ 2027.01.12"
 * @param {Record<string, unknown>|null|undefined} sched
 */
export function fmtSchedulePeriodDot(sched) {
  const start = isValidIsoDate(sched?.date) ? String(sched.date) : '';
  if (!start) return '—';
  const end = scheduleEndIso(sched);
  if (!end) return fmtScheduleDateDot(start);
  return `${fmtScheduleDateDot(start)} ~ ${fmtScheduleDateDot(end)}`;
}

/**
 * 해당 일자에 일정이 걸치는지 (달력 셀)
 * @param {Record<string, unknown>} sched
 * @param {number} year
 * @param {number} month 1–12
 * @param {number} day
 */
export function scheduleCoversDay(sched, year, month, day) {
  const startIso = isValidIsoDate(sched?.date) ? String(sched.date) : '';
  if (!startIso) return false;
  const endIso = scheduleEndIso(sched) || startIso;
  const cell = `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
  return cell >= startIso && cell <= endIso;
}

/**
 * 저장용 dateEnd 정규화
 * @param {string} date
 * @param {string} dateEnd
 */
export function dateEndForSave(date, dateEnd) {
  return normalizeScheduleDateEnd(date, dateEnd) || null;
}
