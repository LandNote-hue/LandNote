/**
 * 앱에서 삭제한 ICS/구글 일정 UID 블랙리스트
 * — 구글 서버 원본이 남아도 다음 pull/import 시 되살아나지 않도록 차단
 */

import { getActiveOwnerId, DEV_LOCAL_OWNER } from './ownerScope.js';

const PREFIX = 'landnote.deletedIcsUids.';

/** @param {string|null|undefined} ownerId */
function storageKey(ownerId) {
  const id = ownerId && ownerId !== DEV_LOCAL_OWNER ? String(ownerId) : 'anon';
  return `${PREFIX}${id}`;
}

/** @param {string|null|undefined} [ownerId] @returns {Set<string>} */
export function loadDeletedIcsUids(ownerId = getActiveOwnerId()) {
  try {
    const raw = localStorage.getItem(storageKey(ownerId));
    if (!raw) return new Set();
    const arr = JSON.parse(raw);
    return new Set(Array.isArray(arr) ? arr.map(String).filter(Boolean) : []);
  } catch {
    return new Set();
  }
}

/** @param {Set<string>} set @param {string|null|undefined} ownerId */
function saveDeletedIcsUids(set, ownerId = getActiveOwnerId()) {
  try {
    localStorage.setItem(storageKey(ownerId), JSON.stringify([...set]));
  } catch {
    /* ignore quota */
  }
}

/**
 * 일정 레코드/필드에서 icsUid 추출
 * @param {Record<string, unknown>|null|undefined} row
 * @returns {string}
 */
export function extractIcsUid(row) {
  if (!row) return '';
  const direct = String(row.icsUid || '').trim();
  if (direct) return direct;
  const key = String(row.icsKey || '').trim();
  if (!key) return '';
  const parts = key.split('|');
  if (parts.length >= 3) {
    // occurrence: uid|date|time 또는 legacy source|uid|date|time
    if (parts.length === 3) return parts[0].trim();
    return parts.slice(1, -2).join('|').trim() || parts[0].trim();
  }
  return parts[0]?.trim() || '';
}

/**
 * @param {string|null|undefined} uid
 * @param {string|null|undefined} [ownerId]
 */
export function rememberDeletedIcsUid(uid, ownerId = getActiveOwnerId()) {
  const id = String(uid || '').trim();
  if (!id) return;
  const set = loadDeletedIcsUids(ownerId);
  if (set.has(id)) return;
  set.add(id);
  saveDeletedIcsUids(set, ownerId);
}

/**
 * @param {Record<string, unknown>|null|undefined} row
 * @param {string|null|undefined} [ownerId]
 */
export function rememberDeletedIcsUidFromSchedule(row, ownerId = getActiveOwnerId()) {
  const uid = extractIcsUid(row);
  if (uid) rememberDeletedIcsUid(uid, ownerId);
}

/**
 * @param {string|null|undefined} uid
 * @param {string|null|undefined} [ownerId]
 */
export function isDeletedIcsUid(uid, ownerId = getActiveOwnerId()) {
  const id = String(uid || '').trim();
  if (!id) return false;
  return loadDeletedIcsUids(ownerId).has(id);
}

/**
 * 연동 해제·전체 재동기화 시 블랙리스트 초기화
 * @param {string|null|undefined} [ownerId]
 */
export function clearDeletedIcsUids(ownerId = getActiveOwnerId()) {
  try {
    localStorage.removeItem(storageKey(ownerId));
  } catch {
    /* ignore */
  }
}
