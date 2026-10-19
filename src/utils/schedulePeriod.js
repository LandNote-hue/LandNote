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

/** @param {number} year @param {number} month 1–12 @param {number} day */
export function isoFromParts(year, month, day) {
  return `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
}

/** @param {Date} d */
export function calendarDateOnly(d) {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate());
}

/** 주 시작: 일요일 (월별 달력과 동일) */
export function startOfWeekSunday(d) {
  const x = calendarDateOnly(d);
  x.setDate(x.getDate() - x.getDay());
  return x;
}

/** @param {Date} d @param {number} n */
export function addCalendarDays(d, n) {
  const x = calendarDateOnly(d);
  x.setDate(x.getDate() + n);
  return x;
}

/** @param {Date} d */
export function weekDaysFrom(d) {
  const start = startOfWeekSunday(d);
  return Array.from({ length: 7 }, (_, i) => addCalendarDays(start, i));
}

/**
 * @param {unknown} time
 * @returns {{ hour: number, minute: number, label: string } | null}
 */
export function parseScheduleTimeParts(time) {
  const t = String(time || '').trim();
  const m = t.match(/^(\d{1,2})(?::(\d{2}))?/);
  if (!m) return null;
  const hour = Number(m[1]);
  const minute = m[2] != null ? Number(m[2]) : 0;
  if (!Number.isFinite(hour) || hour < 0 || hour > 23) return null;
  const min = Number.isFinite(minute) && minute >= 0 && minute <= 59 ? minute : 0;
  return {
    hour,
    minute: min,
    label: `${String(hour).padStart(2, '0')}:${String(min).padStart(2, '0')}`,
  };
}

/** @param {number} hour 0–23 */
export function formatHourLabel(hour) {
  return `${String(hour).padStart(2, '0')}:00`;
}

export const CAL_WEEKDAY_LABELS = ['일', '월', '화', '수', '목', '금', '토'];

/** @param {Date} d */
export function fmtDayTitleKo(d) {
  const wd = CAL_WEEKDAY_LABELS[d.getDay()];
  return `${d.getFullYear()}년 ${d.getMonth() + 1}월 ${d.getDate()}일 (${wd})`;
}

/** @param {Date} start @param {Date} end */
export function fmtWeekTitleKo(start, end) {
  const sameYear = start.getFullYear() === end.getFullYear();
  const sameMonth = sameYear && start.getMonth() === end.getMonth();
  if (sameMonth) {
    return `${start.getFullYear()}년 ${start.getMonth() + 1}월 ${start.getDate()}일 ~ ${end.getDate()}일`;
  }
  if (sameYear) {
    return `${start.getFullYear()}년 ${start.getMonth() + 1}월 ${start.getDate()}일 ~ ${end.getMonth() + 1}월 ${end.getDate()}일`;
  }
  return `${start.getFullYear()}년 ${start.getMonth() + 1}월 ${start.getDate()}일 ~ ${end.getFullYear()}년 ${end.getMonth() + 1}월 ${end.getDate()}일`;
}

/**
 * 저장용 dateEnd 정규화
 * @param {string} date
 * @param {string} dateEnd
 */
export function dateEndForSave(date, dateEnd) {
  return normalizeScheduleDateEnd(date, dateEnd) || null;
}

/** PC·모바일 대시보드 공통 — 오늘부터 N일 내 일정 창 */
export const SCHEDULE_ALERT_MAX_DAYS = 7;

/** @param {unknown} s */
export function parseScheduleDate(s) {
  if (!s) return null;
  const iso = String(s).match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (iso) return new Date(+iso[1], +iso[2] - 1, +iso[3]);
  const dot = String(s).match(/^(\d{4})\.(\d{2})\.(\d{2})/);
  if (dot) return new Date(+dot[1], +dot[2] - 1, +dot[3]);
  return null;
}

/** @param {Date} from @param {Date} to */
export function scheduleDayDiff(from, to) {
  const a = new Date(from.getFullYear(), from.getMonth(), from.getDate());
  const b = new Date(to.getFullYear(), to.getMonth(), to.getDate());
  return Math.round((b - a) / 86400000);
}

/**
 * 오늘 진행 중 + maxDays일 내 시작 예정 일정 (PC 대시보드와 동일 규칙)
 * @param {Array<Record<string, unknown>>} schedules
 * @param {Date} [today]
 * @param {number} [maxDays]
 */
export function collectUpcomingSchedules(schedules, today = new Date(), maxDays = SCHEDULE_ALERT_MAX_DAYS) {
  const today0 = new Date(today.getFullYear(), today.getMonth(), today.getDate());
  /** @type {Array<{ schedule: Record<string, unknown>, sortKey: number, dayLabel: string }>} */
  const items = [];
  for (const s of schedules ?? []) {
    const start = parseScheduleDate(s.date);
    if (!start) continue;
    const endIso = scheduleEndIso(s) || String(s.date);
    const end = parseScheduleDate(endIso) || start;
    const startDiff = scheduleDayDiff(today0, start);
    const endDiff = scheduleDayDiff(today0, end);
    if (endDiff < 0) continue;
    const ongoing = startDiff <= 0 && endDiff >= 0;
    const upcoming = startDiff > 0 && startDiff <= maxDays;
    if (!ongoing && !upcoming) continue;
    let dayLabel = `D-${startDiff}`;
    if (ongoing) dayLabel = '오늘';
    else if (startDiff === 1) dayLabel = '내일';
    items.push({ schedule: s, sortKey: ongoing ? 0 : startDiff, dayLabel });
  }
  return items.sort(
    (a, b) => a.sortKey - b.sortKey
      || String(a.schedule.time || '').localeCompare(String(b.schedule.time || ''))
      || String(a.schedule.title || '').localeCompare(String(b.schedule.title || ''), 'ko'),
  );
}

/**
 * @param {ReturnType<typeof collectUpcomingSchedules>} items
 * @param {number} [maxDays]
 */
export function groupUpcomingScheduleSections(items, maxDays = SCHEDULE_ALERT_MAX_DAYS) {
  return [
    { title: '오늘', items: items.filter((a) => a.sortKey === 0) },
    { title: '내일', items: items.filter((a) => a.sortKey === 1) },
    { title: '일주일 내', items: items.filter((a) => a.sortKey >= 2 && a.sortKey <= maxDays) },
  ].filter((s) => s.items.length > 0);
}

