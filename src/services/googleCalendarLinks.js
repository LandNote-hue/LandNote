import { getSyncUserId } from './sync/syncContext.js';
import { DEV_LOCAL_OWNER } from './sync/ownerScope.js';

const STORAGE_PREFIX = 'landnote.gcal.links.';
const ACTIVE_OWNER_KEY = 'landnote.activeOwner';
/** 수동 동기화가 아닌 경로에서 과도한 재요청을 막을 때 사용 */
export const GCAL_SYNC_MIN_INTERVAL_MS = 15 * 60 * 1000;

/**
 * 연동 캘린더 구분색 — 일정 우선순위색(긴급 빨강·중요 주황·보통 파랑)보다 눈에 덜 띄어야 하므로
 * 붉은 계열(빨강·주황·핑크 등)은 전부 제외하고, 채도도 크게 낮춘(회색 45% 혼합) 톤 다운 팔레트
 * @see PRI_C in App.jsx (URGENT #DC2626, IMPORTANT #D97706, NORMAL #2563EB)
 */
export const GCAL_LINK_COLORS = ['#499C89', '#4B99B1', '#8A69D1', '#6D7889', '#7EA356', '#6B68BE'];

/** syncUserId가 아직 안 잡힌 순간의 잘못된 키(anon/dev-local) */
const ORPHAN_OWNER_KEYS = ['anon', DEV_LOCAL_OWNER, 'null', 'undefined'];

/**
 * 연동 저장 키용 owner — React user.id 를 넘기는 것을 권장.
 * fallback: syncUserId → landnote.activeOwner → dev-local
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
  // 팔레트를 다 썼으면 가장 적게 쓰인 색을 재사용
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

/**
 * @typedef {{
 *   icsUrl: string,
 *   sourceLink?: string,
 *   sourceId: string,
 *   label?: string,
 *   color?: string,
 *   enabled?: boolean,
 *   linkedAt?: string,
 *   lastSyncAt?: string | null,
 *   lastError?: string | null,
 * }} GoogleCalendarLink
 */

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

/** @param {string} [ownerId] @param {GoogleCalendarLink[]} links */
function saveLinks(ownerId, links) {
  localStorage.setItem(storageKey(ownerId), JSON.stringify(links));
}

/** @param {string} [ownerId] @returns {GoogleCalendarLink[]} */
export function listGoogleCalendarLinks(ownerId) {
  const id = resolveGcalOwnerId(ownerId);
  migrateOrphanLinks(id);
  return readLinksRaw(id);
}

/**
 * @param {GoogleCalendarLink} link
 * @param {string} [ownerId]
 */
export function upsertGoogleCalendarLink(link, ownerId) {
  if (!link?.icsUrl || !link?.sourceId) return;
  const id = resolveGcalOwnerId(ownerId);
  migrateOrphanLinks(id);
  const before = readLinksRaw(id);
  const existing = before.find(
    (l) => l.icsUrl === link.icsUrl || l.sourceId === link.sourceId,
  );
  const links = before.filter(
    (l) => l.icsUrl !== link.icsUrl && l.sourceId !== link.sourceId,
  );
  links.push({
    icsUrl: link.icsUrl,
    sourceLink: link.sourceLink || link.icsUrl,
    sourceId: link.sourceId,
    label: (link.label ?? existing?.label) || '',
    color: link.color || existing?.color || nextGcalColor(links),
    enabled: link.enabled !== false,
    linkedAt: link.linkedAt || existing?.linkedAt || new Date().toISOString(),
    lastSyncAt: link.lastSyncAt ?? null,
    lastError: link.lastError ?? null,
  });
  saveLinks(id, links);
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
    readLinksRaw(id).filter((l) => l.sourceId !== key && l.icsUrl !== key),
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

/** FNV-1a 32-bit — 캘린더 URL → 짧은 sourceId */
export function fingerprintCalendarUrl(url) {
  let h = 2166136261;
  const s = String(url || '');
  for (let i = 0; i < s.length; i += 1) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return (h >>> 0).toString(36);
}
