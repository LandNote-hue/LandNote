import { getSyncUserId } from './sync/syncContext.js';
import { DEV_LOCAL_OWNER } from './sync/ownerScope.js';

const STORAGE_PREFIX = 'landnote.gcal.links.';
const ACTIVE_OWNER_KEY = 'landnote.activeOwner';
/** 수동 동기화가 아닌 경로에서 과도한 재요청을 막을 때 사용 */
export const GCAL_SYNC_MIN_INTERVAL_MS = 15 * 60 * 1000;

/**
 * 연동 캘린더 구분색 — 일정 우선순위색보다 눈에 덜 띄는 톤 다운 팔레트
 * @see PRI_C in App.jsx
 */
export const GCAL_LINK_COLORS = ['#499C89', '#4B99B1', '#8A69D1', '#6D7889', '#7EA356', '#6B68BE'];

/** syncUserId가 아직 안 잡힌 순간의 잘못된 키(anon/dev-local) */
const ORPHAN_OWNER_KEYS = ['anon', DEV_LOCAL_OWNER, 'null', 'undefined'];

/**
 * @typedef {{
 *   icsUrl: string,
 *   sourceLink?: string,
 *   sourceId: string,
 *   calendarKey?: string,
 *   label?: string,
 *   color?: string,
 *   enabled?: boolean,
 *   linkedAt?: string,
 *   lastSyncAt?: string | null,
 *   lastError?: string | null,
 * }} GoogleCalendarLink
 */

/**
 * @param {string|null|undefined} ownerId
 */
export function resolveGcalOwnerId(ownerId) {
  if (ownerId && ownerId !== 'null' && ownerId !== 'undefined') return String(ownerId);
  const syncId = getSyncUserId();
  if (syncId) return syncId;
  try {
    const active = localStorage.getItem(ACTIVE_OWNER_KEY);
    if (active && active !== DEV_LOCAL_OWNER) return active;
  } catch {
    /* ignore */
  }
  return DEV_LOCAL_OWNER;
}

/** @param {GoogleCalendarLink[]} existingLinks */
function nextGcalColor(existingLinks) {
  const used = new Set(existingLinks.map((l) => l.color).filter(Boolean));
  const free = GCAL_LINK_COLORS.find((c) => !used.has(c));
  if (free) return free;
  const counts = new Map(GCAL_LINK_COLORS.map((c) => [c, 0]));
  for (const l of existingLinks) {
    if (l.color && counts.has(l.color)) counts.set(l.color, counts.get(l.color) + 1);
  }
  return [...counts.entries()].sort((a, b) => a[1] - b[1])[0][0];
}

/** @param {string} ownerId */
function storageKey(ownerId) {
  return `${STORAGE_PREFIX}${ownerId || 'anon'}`;
}

/** @param {string} ownerId @returns {GoogleCalendarLink[]} */
function readLinksRaw(ownerId) {
  try {
    const raw = localStorage.getItem(storageKey(ownerId));
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.filter((x) => x && x.icsUrl && x.sourceId) : [];
  } catch {
    return [];
  }
}

/** @param {string} [ownerId] @param {GoogleCalendarLink[]} links */
function saveLinks(ownerId, links) {
  localStorage.setItem(storageKey(ownerId), JSON.stringify(links));
}

/** ICS URL에서 Google 캘린더 ID 추출 (소문자·디코드) */
export function extractGoogleCalendarIdFromIcsUrl(icsUrl) {
  try {
    const u = new URL(String(icsUrl || '').trim());
    const m = u.pathname.match(/\/calendar\/ical\/([^/]+)\//i);
    if (!m) return null;
    return decodeURIComponent(m[1]).trim().toLowerCase();
  } catch {
    return null;
  }
}

/**
 * 동일 캘린더 판별 키 — URL 표기가 달라도 같은 ID면 동일
 * @param {string} icsUrl
 */
export function googleCalendarIdentityKey(icsUrl) {
  const calId = extractGoogleCalendarIdFromIcsUrl(icsUrl);
  if (calId) return `id:${calId}`;
  try {
    const u = new URL(String(icsUrl || '').trim());
    u.hash = '';
    u.search = '';
    return `url:${u.toString().toLowerCase()}`;
  } catch {
    return `url:${String(icsUrl || '').trim().toLowerCase()}`;
  }
}

/** FNV-1a 32-bit */
export function fingerprintCalendarUrl(urlOrKey) {
  let h = 2166136261;
  const s = String(urlOrKey || '');
  for (let i = 0; i < s.length; i += 1) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return (h >>> 0).toString(36);
}

/** @param {string} identityKey */
export function sourceIdFromCalendarKey(identityKey) {
  return `gcal:${fingerprintCalendarUrl(identityKey)}`;
}

/**
 * 잘못된 키(anon/dev-local)에 저장된 연동을 실제 계정 키로 합침
 * @param {string} ownerId
 */
function migrateOrphanLinks(ownerId) {
  if (!ownerId || ORPHAN_OWNER_KEYS.includes(ownerId)) return;
  const primary = readLinksRaw(ownerId);
  /** @type {Map<string, GoogleCalendarLink>} */
  const byId = new Map(primary.map((l) => [l.sourceId, l]));
  let changed = false;
  for (const orphan of ORPHAN_OWNER_KEYS) {
    const orphans = readLinksRaw(orphan);
    if (!orphans.length) continue;
    for (const link of orphans) {
      if (!byId.has(link.sourceId)) {
        byId.set(link.sourceId, link);
        changed = true;
      }
    }
    try {
      localStorage.removeItem(storageKey(orphan));
    } catch {
      /* ignore */
    }
  }
  if (changed) {
    saveLinks(ownerId, [...byId.values()]);
  }
}

/**
 * 기존 중복 연동 링크를 calendarKey 기준으로 1개만 남김
 * @param {string} [ownerId]
 * @returns {{ kept: number, removed: number, removedSourceIds: string[] }}
 */
export function dedupeGoogleCalendarLinks(ownerId) {
  const id = resolveGcalOwnerId(ownerId);
  migrateOrphanLinks(id);
  const before = readLinksRaw(id);
  /** @type {Map<string, GoogleCalendarLink>} */
  const byKey = new Map();
  /** @type {string[]} */
  const removedSourceIds = [];

  for (const link of before) {
    let key = link.calendarKey;
    if (!key) {
      try {
        key = googleCalendarIdentityKey(link.icsUrl);
      } catch {
        key = `source:${link.sourceId}`;
      }
    }
    const prev = byKey.get(key);
    if (!prev) {
      byKey.set(key, {
        ...link,
        calendarKey: key,
        sourceId: link.sourceId || sourceIdFromCalendarKey(key),
      });
      continue;
    }
    const prevSync = prev.lastSyncAt ? Date.parse(prev.lastSyncAt) : 0;
    const curSync = link.lastSyncAt ? Date.parse(link.lastSyncAt) : 0;
    const preferCurrent = curSync > prevSync
      || (!prevSync && !curSync && (link.linkedAt || '') > (prev.linkedAt || ''));
    const winner = preferCurrent
      ? {
        ...link,
        calendarKey: key,
        sourceId: prev.sourceId,
        label: link.label || prev.label,
        color: prev.color || link.color,
        linkedAt: prev.linkedAt || link.linkedAt,
        lastSyncAt: link.lastSyncAt || prev.lastSyncAt,
        lastError: link.lastError ?? prev.lastError,
        icsUrl: link.icsUrl || prev.icsUrl,
        sourceLink: link.sourceLink || prev.sourceLink,
      }
      : {
        ...prev,
        calendarKey: key,
        label: prev.label || link.label,
        lastSyncAt: prev.lastSyncAt || link.lastSyncAt,
      };
    byKey.set(key, winner);
    const loserId = preferCurrent ? prev.sourceId : link.sourceId;
    if (loserId && loserId !== winner.sourceId) removedSourceIds.push(loserId);
  }

  const kept = [...byKey.values()];
  if (kept.length !== before.length) {
    saveLinks(id, kept);
  } else {
    // calendarKey 백필만 필요한 경우
    const needsSave = kept.some((l, i) => l.calendarKey !== before[i]?.calendarKey);
    if (needsSave) saveLinks(id, kept);
  }
  return {
    kept: kept.length,
    removed: Math.max(0, before.length - kept.length),
    removedSourceIds,
  };
}

/** @param {string} [ownerId] @returns {GoogleCalendarLink[]} */
export function listGoogleCalendarLinks(ownerId) {
  const id = resolveGcalOwnerId(ownerId);
  migrateOrphanLinks(id);
  dedupeGoogleCalendarLinks(id);
  return readLinksRaw(id);
}

/**
 * @param {string} icsUrl resolved ICS URL
 * @param {string} [ownerId]
 * @returns {GoogleCalendarLink|null}
 */
export function findExistingGoogleCalendarLink(icsUrl, ownerId) {
  const id = resolveGcalOwnerId(ownerId);
  migrateOrphanLinks(id);
  dedupeGoogleCalendarLinks(id);
  let key;
  try {
    key = googleCalendarIdentityKey(icsUrl);
  } catch {
    return null;
  }
  const sourceId = sourceIdFromCalendarKey(key);
  return readLinksRaw(id).find(
    (l) => l.calendarKey === key
      || l.sourceId === sourceId
      || (() => {
        try { return googleCalendarIdentityKey(l.icsUrl) === key; } catch { return false; }
      })(),
  ) || null;
}

/**
 * @param {GoogleCalendarLink} link
 * @param {string} [ownerId]
 * @returns {{ upserted: GoogleCalendarLink, alreadyLinked: boolean }}
 */
export function upsertGoogleCalendarLink(link, ownerId) {
  if (!link?.icsUrl || !link?.sourceId) {
    return { upserted: /** @type {GoogleCalendarLink} */ (link), alreadyLinked: false };
  }
  const id = resolveGcalOwnerId(ownerId);
  migrateOrphanLinks(id);
  dedupeGoogleCalendarLinks(id);
  const before = readLinksRaw(id);
  let calendarKey = link.calendarKey;
  if (!calendarKey) {
    try {
      calendarKey = googleCalendarIdentityKey(link.icsUrl);
    } catch {
      calendarKey = `source:${link.sourceId}`;
    }
  }
  const existing = before.find(
    (l) => l.calendarKey === calendarKey
      || l.sourceId === link.sourceId
      || l.icsUrl === link.icsUrl
      || (() => {
        try { return googleCalendarIdentityKey(l.icsUrl) === calendarKey; } catch { return false; }
      })(),
  );
  const alreadyLinked = !!existing;
  const links = before.filter((l) => l !== existing);
  const upserted = {
    icsUrl: link.icsUrl || existing?.icsUrl,
    sourceLink: link.sourceLink || existing?.sourceLink || link.icsUrl,
    sourceId: existing?.sourceId || link.sourceId,
    calendarKey,
    label: (link.label ?? existing?.label) || '',
    color: link.color || existing?.color || nextGcalColor(links),
    enabled: link.enabled !== false,
    linkedAt: existing?.linkedAt || link.linkedAt || new Date().toISOString(),
    lastSyncAt: link.lastSyncAt !== undefined ? link.lastSyncAt : (existing?.lastSyncAt ?? null),
    lastError: link.lastError !== undefined ? link.lastError : (existing?.lastError ?? null),
  };
  links.push(upserted);
  saveLinks(id, links);
  return { upserted, alreadyLinked };
}

/**
 * @param {string} sourceIdOrUrl
 * @param {string} [ownerId]
 */
export function removeGoogleCalendarLink(sourceIdOrUrl, ownerId) {
  const key = String(sourceIdOrUrl || '').trim();
  if (!key) return;
  const id = resolveGcalOwnerId(ownerId);
  migrateOrphanLinks(id);
  saveLinks(
    id,
    readLinksRaw(id).filter((l) => l.sourceId !== key && l.icsUrl !== key && l.calendarKey !== key),
  );
}

/**
 * @param {string} sourceId
 * @param {Partial<GoogleCalendarLink>} patch
 * @param {string} [ownerId]
 */
export function patchGoogleCalendarLink(sourceId, patch, ownerId) {
  const id = resolveGcalOwnerId(ownerId);
  migrateOrphanLinks(id);
  const links = readLinksRaw(id).map((l) =>
    l.sourceId === sourceId ? { ...l, ...patch } : l,
  );
  saveLinks(id, links);
}
