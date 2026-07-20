import { getActiveOwnerId } from './sync/ownerScope.js';

const STORAGE_PREFIX = 'landnote.gcal.links.';
/** 수동 동기화가 아닌 경로에서 과도한 재요청을 막을 때 사용 */
export const GCAL_SYNC_MIN_INTERVAL_MS = 15 * 60 * 1000;

/**
 * 연동 캘린더 구분색 — 일정 우선순위색(긴급 빨강·중요 주황·보통 파랑)보다 눈에 덜 띄어야 하므로
 * 붉은 계열(빨강·주황·핑크 등)은 전부 제외한 팔레트
 * @see PRI_C in App.jsx (URGENT #DC2626, IMPORTANT #D97706, NORMAL #2563EB)
 */
export const GCAL_LINK_COLORS = ['#059669', '#0891B2', '#7C3AED', '#475569', '#65A30D', '#4338CA'];

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

/** @param {string} [ownerId] */
function storageKey(ownerId = getActiveOwnerId()) {
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

/** @param {string} [ownerId] @returns {GoogleCalendarLink[]} */
export function listGoogleCalendarLinks(ownerId = getActiveOwnerId()) {
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

/**
 * @param {GoogleCalendarLink} link
 * @param {string} [ownerId]
 */
export function upsertGoogleCalendarLink(link, ownerId = getActiveOwnerId()) {
  if (!link?.icsUrl || !link?.sourceId) return;
  const before = listGoogleCalendarLinks(ownerId);
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
  saveLinks(ownerId, links);
}

/**
 * @param {string} sourceIdOrUrl
 * @param {string} [ownerId]
 */
export function removeGoogleCalendarLink(sourceIdOrUrl, ownerId = getActiveOwnerId()) {
  const key = String(sourceIdOrUrl || '').trim();
  if (!key) return;
  saveLinks(
    ownerId,
    listGoogleCalendarLinks(ownerId).filter((l) => l.sourceId !== key && l.icsUrl !== key),
  );
}

/**
 * @param {string} sourceId
 * @param {Partial<GoogleCalendarLink>} patch
 * @param {string} [ownerId]
 */
export function patchGoogleCalendarLink(sourceId, patch, ownerId = getActiveOwnerId()) {
  const links = listGoogleCalendarLinks(ownerId).map((l) =>
    l.sourceId === sourceId ? { ...l, ...patch } : l,
  );
  saveLinks(ownerId, links);
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
