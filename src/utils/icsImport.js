import { db, isActive } from '../db.js';
import {
  GCAL_SYNC_MIN_INTERVAL_MS,
  fingerprintCalendarUrl,
  listGoogleCalendarLinks,
  patchGoogleCalendarLink,
  upsertGoogleCalendarLink,
} from '../services/googleCalendarLinks.js';
import { getActiveOwnerId, matchesOwner, withOwnerId } from '../services/sync/ownerScope.js';
import { getSyncUserId } from '../services/sync/syncContext.js';

const DAY_CODE = { SU: 0, MO: 1, TU: 2, WE: 3, TH: 4, FR: 5, SA: 6 };
const MAX_RRULE_INSTANCES = 520;
const DEFAULT_HORIZON_YEARS = 3;

function unfoldIcsLines(text) {
  const normalized = String(text || '').replace(/\r\n/g, '\n').replace(/\r/g, '\n');
  const raw = normalized.split('\n');
  const out = [];
  for (const line of raw) {
    if ((line.startsWith(' ') || line.startsWith('\t')) && out.length) {
      out[out.length - 1] += line.slice(1);
    } else {
      out.push(line);
    }
  }
  return out;
}

function unescapeIcsText(value) {
  return String(value || '')
    .replace(/\\n/gi, '\n')
    .replace(/\\N/g, '\n')
    .replace(/\\,/g, ',')
    .replace(/\\;/g, ';')
    .replace(/\\\\/g, '\\');
}

function pad2(n) {
  return String(n).padStart(2, '0');
}

function ymd(y, mo, d) {
  return `${y}-${pad2(mo)}-${pad2(d)}`;
}

function hm(h, mi) {
  return `${pad2(h)}:${pad2(mi)}`;
}

/** UTC instant → Asia/Seoul wall clock */
function utcPartsToSeoul(y, mo, d, h, mi) {
  const ms = Date.UTC(y, mo - 1, d, h, mi, 0);
  const fmt = new Intl.DateTimeFormat('en-US', {
    timeZone: 'Asia/Seoul',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  });
  const bag = {};
  for (const p of fmt.formatToParts(new Date(ms))) {
    if (p.type !== 'literal') bag[p.type] = p.value;
  }
  let hour = Number(bag.hour);
  if (hour === 24) hour = 0;
  return {
    y: Number(bag.year),
    mo: Number(bag.month),
    d: Number(bag.day),
    h: hour,
    mi: Number(bag.minute),
  };
}

/**
 * @returns {{ date: string, time: string, y: number, mo: number, d: number, h: number, mi: number, dateOnly: boolean } | null}
 */
function parseIcsDateTime(propName, propValue) {
  const val = String(propValue || '').trim();
  if (!val) return null;

  const isDateOnly = /VALUE=DATE/i.test(propName) || (/^\d{8}$/.test(val) && !val.includes('T'));
  if (isDateOnly) {
    const digits = val.replace(/\D/g, '').slice(0, 8);
    if (digits.length < 8) return null;
    const y = Number(digits.slice(0, 4));
    const mo = Number(digits.slice(4, 6));
    const d = Number(digits.slice(6, 8));
    if (!y || !mo || !d) return null;
    return { date: ymd(y, mo, d), time: '09:00', y, mo, d, h: 9, mi: 0, dateOnly: true };
  }

  const isUtc = /Z$/i.test(val);
  const digits = val.replace(/[^0-9T]/g, '');
  const m = digits.match(/^(\d{4})(\d{2})(\d{2})T?(\d{2})?(\d{2})?/);
  if (!m) return null;
  let y = Number(m[1]);
  let mo = Number(m[2]);
  let d = Number(m[3]);
  let h = Number(m[4] ?? '9');
  let mi = Number(m[5] ?? '0');
  if (isUtc) {
    const seoul = utcPartsToSeoul(y, mo, d, h, mi);
    y = seoul.y;
    mo = seoul.mo;
    d = seoul.d;
    h = seoul.h;
    mi = seoul.mi;
  }
  return { date: ymd(y, mo, d), time: hm(h, mi), y, mo, d, h, mi, dateOnly: false };
}

function parseRrule(rruleStr) {
  const out = {};
  for (const part of String(rruleStr || '').split(';')) {
    const eq = part.indexOf('=');
    if (eq < 0) continue;
    out[part.slice(0, eq).toUpperCase()] = part.slice(eq + 1);
  }
  return out;
}

/** @returns {{ nth: number | null, day: number }[]} */
function parseBydayList(byday) {
  if (!byday) return [];
  return String(byday)
    .split(',')
    .map((tok) => {
      const t = tok.trim().toUpperCase();
      const m = t.match(/^([+-]?\d{1,2})?(SU|MO|TU|WE|TH|FR|SA)$/);
      if (!m) return null;
      const nth = m[1] != null && m[1] !== '' ? Number(m[1]) : null;
      return { nth: Number.isFinite(nth) ? nth : null, day: DAY_CODE[m[2]] };
    })
    .filter(Boolean);
}

function occurrenceKey(date, time, dateOnly) {
  return dateOnly ? date : `${date}T${time}`;
}

function addDays(y, mo, d, delta) {
  const dt = new Date(y, mo - 1, d + delta);
  return { y: dt.getFullYear(), mo: dt.getMonth() + 1, d: dt.getDate() };
}

function daysInMonth(y, mo) {
  return new Date(y, mo, 0).getDate();
}

/** nth weekday of month: nth>0 from start, nth<0 from end */
function nthWeekdayOfMonth(y, mo, weekday, nth) {
  if (nth > 0) {
    const firstDow = new Date(y, mo - 1, 1).getDay();
    let day = 1 + ((weekday - firstDow + 7) % 7) + (nth - 1) * 7;
    if (day > daysInMonth(y, mo)) return null;
    return { y, mo, d: day };
  }
  if (nth < 0) {
    const last = daysInMonth(y, mo);
    const lastDow = new Date(y, mo - 1, last).getDay();
    let day = last - ((lastDow - weekday + 7) % 7) + (nth + 1) * 7;
    if (day < 1) return null;
    return { y, mo, d: day };
  }
  return null;
}

function compareYmd(a, b) {
  if (a.y !== b.y) return a.y - b.y;
  if (a.mo !== b.mo) return a.mo - b.mo;
  return a.d - b.d;
}

function compareDateTime(a, b) {
  const c = compareYmd(a, b);
  if (c !== 0) return c;
  if (a.h !== b.h) return a.h - b.h;
  return a.mi - b.mi;
}

function parseUntilLimit(untilRaw, dateOnlySeries) {
  if (!untilRaw) return null;
  const raw = String(untilRaw).trim();
  const isUtc = /Z$/i.test(raw);
  const isDateOnly = !raw.includes('T') || dateOnlySeries;
  if (isDateOnly && !raw.includes('T')) {
    const digits = raw.replace(/\D/g, '').slice(0, 8);
    if (digits.length < 8) return null;
    return {
      y: Number(digits.slice(0, 4)),
      mo: Number(digits.slice(4, 6)),
      d: Number(digits.slice(6, 8)),
      h: 23,
      mi: 59,
      inclusiveDate: true,
    };
  }
  const dt = parseIcsDateTime(isUtc ? 'DTSTART' : 'DTSTART', raw);
  if (!dt) return null;
  return { y: dt.y, mo: dt.mo, d: dt.d, h: dt.h, mi: dt.mi, inclusiveDate: false };
}

function withinUntil(occ, until) {
  if (!until) return true;
  if (until.inclusiveDate) {
    return compareYmd(occ, until) <= 0;
  }
  return compareDateTime(occ, until) <= 0;
}

function weekStartOffset(dow, wkstCode) {
  const wkst = DAY_CODE[wkstCode] ?? 1;
  return (dow - wkst + 7) % 7;
}

function expandRruleOccurrences(start, rruleStr, options = {}) {
  const rrule = parseRrule(rruleStr);
  const freq = String(rrule.FREQ || '').toUpperCase();
  if (!freq) return [{ ...start }];

  const interval = Math.max(1, Number.parseInt(rrule.INTERVAL || '1', 10) || 1);
  const count = rrule.COUNT ? Number.parseInt(rrule.COUNT, 10) : null;
  const until = parseUntilLimit(rrule.UNTIL, start.dateOnly);
  const bydays = parseBydayList(rrule.BYDAY);
  const bymonthday = rrule.BYMONTHDAY
    ? String(rrule.BYMONTHDAY)
        .split(',')
        .map((x) => Number(x.trim()))
        .filter((n) => Number.isFinite(n) && n !== 0)
    : [];
  const wkst = (rrule.WKST || 'MO').toUpperCase();

  let horizonEnd = until;
  if (!horizonEnd && !count) {
    const now = new Date();
    const fromNow = {
      y: now.getFullYear() + 2,
      mo: now.getMonth() + 1,
      d: now.getDate(),
      h: 23,
      mi: 59,
      inclusiveDate: true,
    };
    const fromStart = {
      y: start.y + DEFAULT_HORIZON_YEARS,
      mo: start.mo,
      d: Math.min(start.d, daysInMonth(start.y + DEFAULT_HORIZON_YEARS, start.mo)),
      h: 23,
      mi: 59,
      inclusiveDate: true,
    };
    // 종료일 없는 반복: 시작+3년과 오늘+2년 중 더 이른 쪽
    horizonEnd = compareYmd(fromNow, fromStart) < 0 ? fromNow : fromStart;
    if (compareYmd(horizonEnd, start) < 0) horizonEnd = fromStart;
  }

  const out = [];
  const pushOcc = (y, mo, d) => {
    if (out.length >= MAX_RRULE_INSTANCES) return false;
    if (count != null && out.length >= count) return false;
    const occ = {
      y,
      mo,
      d,
      h: start.h,
      mi: start.mi,
      date: ymd(y, mo, d),
      time: start.time,
      dateOnly: start.dateOnly,
    };
    if (compareYmd(occ, start) < 0) return true;
    if (!withinUntil(occ, until || horizonEnd)) return false;
    if (options.skipKeys?.has(occurrenceKey(occ.date, occ.time, occ.dateOnly))) return true;
    if (options.skipKeys?.has(occ.date)) return true;
    out.push(occ);
    return count == null || out.length < count;
  };

  if (freq === 'DAILY') {
    let cur = { y: start.y, mo: start.mo, d: start.d };
    let guard = 0;
    while (guard++ < MAX_RRULE_INSTANCES * interval + 10) {
      if (!pushOcc(cur.y, cur.mo, cur.d)) break;
      if (count != null && out.length >= count) break;
      cur = addDays(cur.y, cur.mo, cur.d, interval);
      if (horizonEnd && compareYmd(cur, horizonEnd) > 0) break;
    }
    return out;
  }

  if (freq === 'WEEKLY') {
    const weekDays = bydays.length
      ? [...new Set(bydays.filter((b) => b.nth == null).map((b) => b.day))]
      : [new Date(start.y, start.mo - 1, start.d).getDay()];
    const active = (weekDays.length ? weekDays : [new Date(start.y, start.mo - 1, start.d).getDay()]).sort(
      (a, b) => a - b,
    );

    const startDow = new Date(start.y, start.mo - 1, start.d).getDay();
    const startWeekAnchor = addDays(start.y, start.mo, start.d, -weekStartOffset(startDow, wkst));

    let cursor = { ...startWeekAnchor };
    let guard = 0;
    while (guard++ < MAX_RRULE_INSTANCES * 7 * interval + 30) {
      const cursorDow = new Date(cursor.y, cursor.mo - 1, cursor.d).getDay();
      const weeksFromStart = Math.floor(
        (Date.UTC(cursor.y, cursor.mo - 1, cursor.d) -
          Date.UTC(startWeekAnchor.y, startWeekAnchor.mo - 1, startWeekAnchor.d)) /
          86400000 /
          7,
      );
      if (weeksFromStart >= 0 && weeksFromStart % interval === 0) {
        for (const wd of active) {
          const delta = (wd - cursorDow + 7) % 7;
          const occDay = addDays(cursor.y, cursor.mo, cursor.d, delta);
          if (!pushOcc(occDay.y, occDay.mo, occDay.d)) {
            if (count != null && out.length >= count) return out;
            if (out.length >= MAX_RRULE_INSTANCES) return out;
          }
        }
      }
      cursor = addDays(cursor.y, cursor.mo, cursor.d, 7);
      if (horizonEnd && compareYmd(cursor, horizonEnd) > 0) break;
      if (until && compareYmd(cursor, until) > 0) break;
    }
    const seen = new Set();
    return out
      .sort((a, b) => compareDateTime(a, b))
      .filter((o) => {
        const k = occurrenceKey(o.date, o.time, o.dateOnly);
        if (seen.has(k)) return false;
        seen.add(k);
        return true;
      });
  }

  if (freq === 'MONTHLY') {
    const ordinalBydays = bydays.filter((b) => b.nth != null);
    const plainBydays = bydays.filter((b) => b.nth == null);
    let year = start.y;
    let month = start.mo;
    let monthIndex = 0;
    let guard = 0;
    while (guard++ < MAX_RRULE_INSTANCES * interval + 24) {
      if (monthIndex % interval === 0) {
        if (bymonthday.length) {
          for (const md of bymonthday) {
            const dim = daysInMonth(year, month);
            let day = md;
            if (md < 0) day = dim + md + 1;
            if (day >= 1 && day <= dim) {
              if (!pushOcc(year, month, day)) {
                if (count != null && out.length >= count) return out;
                if (out.length >= MAX_RRULE_INSTANCES) return out;
              }
            }
          }
        } else if (ordinalBydays.length) {
          for (const b of ordinalBydays) {
            const hit = nthWeekdayOfMonth(year, month, b.day, b.nth);
            if (hit) {
              if (!pushOcc(hit.y, hit.mo, hit.d)) {
                if (count != null && out.length >= count) return out;
                if (out.length >= MAX_RRULE_INSTANCES) return out;
              }
            }
          }
        } else if (plainBydays.length) {
          for (const b of plainBydays) {
            // all matching weekdays in month (rare); emit first-from-start matching pattern via start day-of-week
            const hit = nthWeekdayOfMonth(year, month, b.day, 1);
            let cur = hit;
            while (cur) {
              if (!pushOcc(cur.y, cur.mo, cur.d)) break;
              const next = addDays(cur.y, cur.mo, cur.d, 7);
              if (next.mo !== month || next.y !== year) break;
              cur = next;
            }
          }
        } else {
          const dim = daysInMonth(year, month);
          const day = Math.min(start.d, dim);
          if (!pushOcc(year, month, day)) {
            if (count != null && out.length >= count) return out;
            if (out.length >= MAX_RRULE_INSTANCES) return out;
          }
        }
      }
      monthIndex += 1;
      month += 1;
      if (month > 12) {
        month = 1;
        year += 1;
      }
      const cursor = { y: year, mo: month, d: 1 };
      if (horizonEnd && compareYmd(cursor, horizonEnd) > 0) break;
      if (until && compareYmd({ y: year, mo: month, d: 1 }, until) > 0) break;
    }
    const seen = new Set();
    return out
      .sort((a, b) => compareDateTime(a, b))
      .filter((o) => {
        const k = occurrenceKey(o.date, o.time, o.dateOnly);
        if (seen.has(k)) return false;
        seen.add(k);
        return true;
      });
  }

  // YEARLY / unsupported → first instance only
  return [{ ...start }];
}

function mapIcsPriority(value) {
  const n = Number.parseInt(String(value || '').trim(), 10);
  if (!Number.isFinite(n)) return 'NORMAL';
  if (n <= 3) return 'URGENT';
  if (n <= 5) return 'IMPORTANT';
  return 'NORMAL';
}

/** @param {string} sourceId @param {string} uid @param {string} date @param {string} time */
export function makeIcsKey(sourceId, uid, date, time) {
  // 출처(캘린더)와 무관한 occurrence 키 — 동일 UID·일시는 한 행만 유지
  void sourceId;
  return makeIcsOccurrenceKey(uid, date, time);
}

/** 구글/ICS 일정의 발생 단위 식별자 (캘린더 source 제외) */
export function makeIcsOccurrenceKey(uid, date, time) {
  return `${String(uid || '').trim()}|${date || ''}|${time || ''}`;
}

/**
 * 기존/신규 일정에서 occurrence 키 추출 (레거시 sourceId|uid|date|time 포함)
 * @param {Record<string, unknown>|null|undefined} s
 */
export function occurrenceKeyFromSchedule(s) {
  if (!s) return null;
  const uid = String(s.icsUid || '').trim();
  if (uid && s.date) return makeIcsOccurrenceKey(uid, s.date, s.time || '');
  const key = String(s.icsKey || '').trim();
  if (!key) return null;
  const parts = key.split('|');
  if (parts.length >= 3 && !uid) {
    // 신규: uid|date|time
    if (parts.length === 3) return makeIcsOccurrenceKey(parts[0], parts[1], parts[2]);
    // 레거시: sourceId|uid|date|time (uid에 | 없을 때)
    if (parts.length >= 4) {
      const time = parts[parts.length - 1];
      const date = parts[parts.length - 2];
      const legacyUid = parts.slice(1, -2).join('|');
      return makeIcsOccurrenceKey(legacyUid, date, time);
    }
  }
  if (parts.length === 3) return key;
  return key;
}

function contentFingerprint(sched) {
  return `${String(sched.title || '').trim()}|${sched.date || ''}|${sched.time || ''}|${sched.dateEnd || ''}`;
}

/** ICS DATE DTEND is exclusive → inclusive YYYY-MM-DD */
function inclusiveEndFromIcs(dtStart, dtEnd) {
  if (!dtStart || !dtEnd || !dtEnd.date) return null;
  if (dtEnd.dateOnly) {
    const shifted = addDays(dtEnd.y, dtEnd.mo, dtEnd.d, -1);
    const iso = `${shifted.y}-${String(shifted.mo).padStart(2, '0')}-${String(shifted.d).padStart(2, '0')}`;
    return iso > dtStart.date ? iso : null;
  }
  return dtEnd.date > dtStart.date ? dtEnd.date : null;
}

function buildScheduleFromParts(ev, dt, { sourceId = 'ics-file' } = {}) {
  if (!dt || dt.y < 1990) return null;
  const title = unescapeIcsText(ev.SUMMARY)?.trim() || '일정';
  const memoParts = [];
  if (ev.DESCRIPTION) memoParts.push(unescapeIcsText(ev.DESCRIPTION));
  if (ev.LOCATION) memoParts.push(`장소: ${unescapeIcsText(ev.LOCATION)}`);
  const uid = String(ev.UID || '').trim() || `summary:${title}`;
  let dateEnd = null;
  if (ev.DTEND && !ev.RRULE) {
    const end = parseIcsDateTime(ev.DTEND_PARAM || 'DTEND', ev.DTEND);
    dateEnd = inclusiveEndFromIcs(dt, end);
  }
  return {
    title,
    date: dt.date,
    dateEnd,
    time: dt.time,
    pri: mapIcsPriority(ev.PRIORITY),
    pid: null,
    memo: memoParts.filter(Boolean).join('\n\n').trim(),
    chk: [],
    icsUid: uid,
    icsSourceId: sourceId,
    icsKey: makeIcsKey(sourceId, uid, dt.date, dt.time),
  };
}

function collectExdateKeys(ev) {
  const keys = new Set();
  const entries = Array.isArray(ev._EXDATES) ? ev._EXDATES : [];
  for (const entry of entries) {
    const chunks = String(entry.value || '')
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean);
    for (const chunk of chunks) {
      const dt = parseIcsDateTime(entry.param || 'EXDATE', chunk);
      if (!dt) continue;
      keys.add(occurrenceKey(dt.date, dt.time, dt.dateOnly));
      keys.add(dt.date);
    }
  }
  return keys;
}

function parseRawEvents(icsText) {
  const lines = unfoldIcsLines(icsText);
  const events = [];
  let cur = null;

  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed) continue;
    if (trimmed === 'BEGIN:VEVENT') {
      cur = { _EXDATES: [] };
      continue;
    }
    if (trimmed === 'END:VEVENT') {
      if (cur) events.push(cur);
      cur = null;
      continue;
    }
    if (!cur) continue;

    const colon = trimmed.indexOf(':');
    if (colon < 0) continue;
    const namePart = trimmed.slice(0, colon);
    const key = namePart.split(';')[0].toUpperCase();
    const value = trimmed.slice(colon + 1);

    if (key === 'EXDATE') {
      cur._EXDATES.push({ param: namePart, value });
      continue;
    }
    cur[key] = value;
    if (key === 'DTSTART') cur.DTSTART_PARAM = namePart;
    if (key === 'DTEND') cur.DTEND_PARAM = namePart;
    if (key === 'RECURRENCE-ID') cur.RECURRENCE_ID_PARAM = namePart;
  }
  return events;
}

export function parseIcsToSchedules(icsText, options = {}) {
  const sourceId = options.sourceId || 'ics-file';
  const events = parseRawEvents(icsText);

  /** @type {Map<string, Set<string>>} */
  const exceptionKeysByUid = new Map();
  for (const ev of events) {
    if (!ev['RECURRENCE-ID']) continue;
    const uid = String(ev.UID || '').trim();
    if (!uid) continue;
    const rid = parseIcsDateTime(ev.RECURRENCE_ID_PARAM || 'RECURRENCE-ID', ev['RECURRENCE-ID']);
    if (!rid) continue;
    if (!exceptionKeysByUid.has(uid)) exceptionKeysByUid.set(uid, new Set());
    const set = exceptionKeysByUid.get(uid);
    set.add(occurrenceKey(rid.date, rid.time, rid.dateOnly));
    set.add(rid.date);
  }

  const schedules = [];
  const ctx = { sourceId };
  for (const ev of events) {
    if (/^CANCELLED$/i.test(String(ev.STATUS || '').trim())) continue;

    const start = parseIcsDateTime(ev.DTSTART_PARAM || 'DTSTART', ev.DTSTART);
    if (!start) continue;

    // Exception instances: import as standalone overrides
    if (ev['RECURRENCE-ID']) {
      const sched = buildScheduleFromParts(ev, start, ctx);
      if (sched) schedules.push(sched);
      continue;
    }

    if (ev.RRULE) {
      const skipKeys = collectExdateKeys(ev);
      const uid = String(ev.UID || '').trim();
      const exKeys = uid ? exceptionKeysByUid.get(uid) : null;
      if (exKeys) {
        for (const k of exKeys) skipKeys.add(k);
      }
      const occs = expandRruleOccurrences(start, ev.RRULE, { skipKeys });
      for (const occ of occs) {
        const sched = buildScheduleFromParts(ev, occ, ctx);
        if (sched) schedules.push(sched);
      }
      continue;
    }

    const sched = buildScheduleFromParts(ev, start, ctx);
    if (sched) schedules.push(sched);
  }

  return schedules;
}

/**
 * 동일 occurrence(icsUid+일시) 중복 행을 1개로 합침
 * @param {string} [preferredOwnerId]
 * @returns {Promise<{ collapsed: number }>}
 */
export async function collapseDuplicateIcsSchedules(preferredOwnerId = getActiveOwnerId()) {
  const { formatDeletedAt } = await import('../db.js');
  const all = (await db.schedules.toArray()).filter(
    (s) => isActive(s) && (s.icsUid || s.icsKey || s.icsSourceId),
  );
  /** @type {Map<string, object[]>} */
  const groups = new Map();
  for (const s of all) {
    const k = occurrenceKeyFromSchedule(s) || `content:${contentFingerprint(s)}`;
    if (!groups.has(k)) groups.set(k, []);
    groups.get(k).push(s);
  }

  let collapsed = 0;
  for (const rows of groups.values()) {
    if (rows.length < 2) continue;
    rows.sort((a, b) => {
      const score = (s) => {
        let n = 0;
        if (s.ownerId === preferredOwnerId) n += 8;
        if (s.cloudId) n += 4;
        if (s.icsSourceId) n += 1;
        return n;
      };
      const d = score(b) - score(a);
      if (d !== 0) return d;
      return (a.id ?? 0) - (b.id ?? 0);
    });
    const winner = rows[0];
    /** @type {Record<string, unknown>} */
    const patch = {};
    if (preferredOwnerId && winner.ownerId !== preferredOwnerId) patch.ownerId = preferredOwnerId;
    const occ = occurrenceKeyFromSchedule(winner);
    if (occ && winner.icsKey !== occ) patch.icsKey = occ;
    if (!winner.icsUid && occ) {
      const uid = String(occ).split('|')[0];
      if (uid) patch.icsUid = uid;
    }
    // 다른 연동 캘린더에서 온 sourceId가 있으면 승자에 유지(색 표시용 첫 출처)
    if (!winner.icsSourceId) {
      const withSrc = rows.find((r) => r.icsSourceId);
      if (withSrc?.icsSourceId) patch.icsSourceId = withSrc.icsSourceId;
    }
    if (Object.keys(patch).length) await db.schedules.update(winner.id, patch);

    const deletedAt = formatDeletedAt();
    for (const loser of rows.slice(1)) {
      await db.schedules.update(loser.id, { deletedAt });
      collapsed += 1;
    }
  }
  return { collapsed };
}

/**
 * @param {string} icsText
 * @param {{ sourceId?: string }} [options]
 * @returns {Promise<{ addedSchedules: object[], added: number, updated: number, skipped: number, schedules: object[] }>}
 */
export async function importIcsSchedules(icsText, options = {}) {
  const sourceId = options.sourceId || 'ics-file';
  const schedules = parseIcsToSchedules(icsText, { sourceId });
  if (!schedules.length) {
    throw new Error('ICS 파일에서 가져올 일정(VEVENT)을 찾지 못했습니다.');
  }

  const ownerId = getActiveOwnerId();
  // 현재 계정 + orphan(dev-local) ICS 행까지 조회해 중복 add 방지
  const existing = (await db.schedules.toArray()).filter((s) => (
    isActive(s)
    && (s.icsUid || s.icsKey || s.icsSourceId)
    && (matchesOwner(s, ownerId) || s.ownerId === 'dev-local' || s.ownerId == null || s.ownerId === '')
  ));
  /** @type {Map<string, object>} */
  const byOcc = new Map();
  /** @type {Map<string, object>} */
  const byIcsKey = new Map();
  /** @type {Map<string, object>} */
  const byContent = new Map();
  for (const s of existing) {
    const occ = occurrenceKeyFromSchedule(s);
    if (occ && !byOcc.has(occ)) byOcc.set(occ, s);
    if (s.icsKey) byIcsKey.set(String(s.icsKey), s);
    byContent.set(contentFingerprint(s), s);
  }

  const addedSchedules = [];
  const updatedIds = [];
  let added = 0;
  let updated = 0;
  let skipped = 0;

  for (const sched of schedules) {
    const row = withOwnerId({ ...sched, deletedAt: null });
    const occ = occurrenceKeyFromSchedule(row);
    let ex = (occ && byOcc.get(occ))
      || (row.icsKey ? byIcsKey.get(String(row.icsKey)) : null)
      || byContent.get(contentFingerprint(row));

    if (ex) {
      /** @type {Record<string, unknown>} */
      const patch = {};
      if (ex.ownerId !== ownerId) patch.ownerId = ownerId;
      if (ex.title !== row.title) patch.title = row.title;
      if ((ex.memo || '') !== (row.memo || '')) patch.memo = row.memo;
      if (ex.time !== row.time) patch.time = row.time;
      if ((ex.dateEnd || '') !== (row.dateEnd || '')) patch.dateEnd = row.dateEnd;
      if (ex.pri !== row.pri) patch.pri = row.pri;
      if (occ && ex.icsKey !== occ) patch.icsKey = occ;
      if (!ex.icsUid && row.icsUid) patch.icsUid = row.icsUid;
      // 이미 출처가 있으면 유지(첫 연동 캘린더 색). 없을 때만 채움
      if (!ex.icsSourceId && row.icsSourceId) patch.icsSourceId = row.icsSourceId;
      if (Object.keys(patch).length) {
        await db.schedules.update(ex.id, patch);
        updatedIds.push(ex.id);
        const next = { ...ex, ...patch };
        const nextOcc = occurrenceKeyFromSchedule(next);
        if (nextOcc) byOcc.set(nextOcc, next);
        if (next.icsKey) byIcsKey.set(String(next.icsKey), next);
        byContent.set(contentFingerprint(next), next);
        updated += 1;
      } else {
        skipped += 1;
      }
      continue;
    }

    const id = await db.schedules.add(row);
    const saved = { ...row, id };
    addedSchedules.push(saved);
    if (occ) byOcc.set(occ, saved);
    if (saved.icsKey) byIcsKey.set(String(saved.icsKey), saved);
    byContent.set(contentFingerprint(saved), saved);
    added += 1;
  }

  try {
    await collapseDuplicateIcsSchedules(ownerId);
  } catch (err) {
    console.warn('[icsImport] collapse duplicates', err);
  }

  try {
    if (added > 0) {
      const { pushUnsyncedSchedulesToCloud } = await import('../services/sync/scheduleSync.js');
      const userId = getSyncUserId();
      if (userId) await pushUnsyncedSchedulesToCloud(userId);
    }
    if (updatedIds.length) {
      const { syncScheduleAfterChange } = await import('../services/sync/scheduleSync.js');
      for (const id of updatedIds) await syncScheduleAfterChange(id);
    }
  } catch (err) {
    console.error('[icsImport] cloud sync after import', err);
  }

  return {
    addedSchedules,
    added,
    updated,
    skipped,
    duplicated: skipped,
    total: schedules.length,
    schedules: addedSchedules,
  };
}

function encodeCalendarId(id) {
  const decoded = decodeURIComponent(String(id || '').trim());
  return encodeURIComponent(decoded);
}

function decodeGoogleCid(cid) {
  try {
    const padded = String(cid).replace(/-/g, '+').replace(/_/g, '/');
    const pad = padded.length % 4;
    const b64 = pad ? `${padded}${'='.repeat(4 - pad)}` : padded;
    return atob(b64);
  } catch {
    throw new Error('캘린더 ID(cid)를 해석하지 못했습니다.');
  }
}

export function resolveGoogleCalendarIcsUrl(input) {
  const trimmed = String(input || '').trim();
  if (!trimmed) throw new Error('링크를 입력해 주세요.');

  if (/^webcal:\/\//i.test(trimmed)) {
    return resolveGoogleCalendarIcsUrl(`https://${trimmed.slice('webcal://'.length)}`);
  }

  if (/calendar\.google\.com\/calendar\/ical\//i.test(trimmed)) {
    const urlStr = trimmed.startsWith('http') ? trimmed : `https://${trimmed}`;
    if (/\.ics(\?|$)/i.test(urlStr)) return urlStr;
    const url = new URL(urlStr);
    const path = url.pathname.endsWith('.ics')
      ? url.pathname
      : `${url.pathname.replace(/\/?$/, '')}/basic.ics`;
    return `${url.protocol}//${url.host}${path}${url.search}`;
  }

  const urlStr = trimmed.startsWith('http') ? trimmed : `https://${trimmed}`;
  let url;
  try {
    url = new URL(urlStr);
  } catch {
    throw new Error('올바른 Google Calendar 링크가 아닙니다.');
  }

  if (!url.hostname.includes('calendar.google.com')) {
    throw new Error('Google Calendar 링크만 지원합니다.');
  }

  const src = url.searchParams.get('src');
  if (src) {
    return `https://calendar.google.com/calendar/ical/${encodeCalendarId(src)}/public/basic.ics`;
  }

  const cid = url.searchParams.get('cid');
  if (cid) {
    const calId = decodeGoogleCid(cid);
    return `https://calendar.google.com/calendar/ical/${encodeCalendarId(calId)}/public/basic.ics`;
  }

  throw new Error(
    '공유 링크를 인식하지 못했습니다. Google Calendar 설정의「iCal 형식의 주소」를 붙여 넣거나, 공개 캘린더 embed 링크를 입력해 주세요.',
  );
}

async function fetchIcsTextFromProxy(icsUrl) {
  const base = (import.meta.env.VITE_BFF_BASE_URL || '').replace(/\/$/, '');
  const q = new URLSearchParams({ url: icsUrl });
  const res = await fetch(`${base}/api/google-calendar/ical?${q}`);
  if (!res.ok) {
    let message = '캘린더를 불러오지 못했습니다.';
    try {
      const data = await res.json();
      if (data?.message) message = data.message;
    } catch {
      /* ignore */
    }
    throw new Error(message);
  }
  return res.text();
}

/**
 * @param {string} link
 * @param {{ saveLink?: boolean, label?: string }} [options]
 */
export async function importGoogleCalendarFromLink(link, options = {}) {
  const icsUrl = resolveGoogleCalendarIcsUrl(link);
  const sourceId = `gcal:${fingerprintCalendarUrl(icsUrl)}`;
  const text = await fetchIcsTextFromProxy(icsUrl);
  const result = await importIcsSchedules(text, { sourceId });
  if (options.saveLink !== false) {
    upsertGoogleCalendarLink({
      icsUrl,
      sourceLink: String(link || '').trim(),
      sourceId,
      label: options.label ? String(options.label).trim() : '',
      enabled: true,
      lastSyncAt: new Date().toISOString(),
      lastError: null,
    }, options.ownerId);
  }
  return result;
}

let linkedSyncInFlight = null;

/**
 * 연동된 구글 캘린더를「동기화」할 때만 호출. 기존 일정은 icsKey로 유지·중복 방지.
 * @param {{ force?: boolean }} [options] force=true(기본)면 즉시 다시 가져옴
 */
export async function syncLinkedGoogleCalendars(options = {}) {
  if (linkedSyncInFlight) return linkedSyncInFlight;

  linkedSyncInFlight = (async () => {
    const force = options.force !== false;
    const ownerId = options.ownerId;
    const links = listGoogleCalendarLinks(ownerId).filter((l) => l.enabled !== false);
    if (!links.length) {
      return { added: 0, updated: 0, skipped: 0, duplicated: 0, total: 0, synced: 0, errors: 0 };
    }

    let added = 0;
    let updated = 0;
    let skipped = 0;
    let total = 0;
    let synced = 0;
    let errors = 0;

    for (const link of links) {
      if (
        !force
        && link.lastSyncAt
        && Date.now() - Date.parse(link.lastSyncAt) < GCAL_SYNC_MIN_INTERVAL_MS
      ) {
        continue;
      }
      try {
        const text = await fetchIcsTextFromProxy(link.icsUrl);
        const result = await importIcsSchedules(text, { sourceId: link.sourceId });
        added += result.added;
        updated += result.updated;
        skipped += result.skipped;
        total += result.total;
        synced += 1;
        patchGoogleCalendarLink(link.sourceId, {
          lastSyncAt: new Date().toISOString(),
          lastError: null,
        }, ownerId);
      } catch (err) {
        errors += 1;
        patchGoogleCalendarLink(link.sourceId, {
          lastError: err instanceof Error ? err.message : String(err),
        }, ownerId);
        console.error('[googleCalendarSync]', link.sourceId, err);
      }
    }

    try {
      const { collapsed } = await collapseDuplicateIcsSchedules(getActiveOwnerId());
      if (collapsed) skipped += collapsed;
    } catch (err) {
      console.warn('[googleCalendarSync] collapse', err);
    }

    return { added, updated, skipped, duplicated: skipped, total, synced, errors };
  })();

  try {
    return await linkedSyncInFlight;
  } finally {
    linkedSyncInFlight = null;
  }
}
