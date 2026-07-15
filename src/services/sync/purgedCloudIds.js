/**
 * 영구삭제한 클라우드 행이 pull로 되살아나지 않도록 tombstone 보관
 */

const PREFIX = 'landnote.purgedCloudIds.';

/** @param {string} resource @param {string} [userId] */
function storageKey(resource, userId) {
  return `${PREFIX}${resource}.${userId || 'anon'}`;
}

/** @param {string} resource @param {string} [userId] @returns {Set<string>} */
export function loadPurgedCloudIds(resource, userId) {
  try {
    const raw = localStorage.getItem(storageKey(resource, userId));
    if (!raw) return new Set();
    const arr = JSON.parse(raw);
    return new Set(Array.isArray(arr) ? arr.map(String) : []);
  } catch {
    return new Set();
  }
}

/** @param {string} resource @param {string|null|undefined} cloudId @param {string} [userId] */
export function rememberPurgedCloudId(resource, cloudId, userId) {
  if (!cloudId) return;
  const set = loadPurgedCloudIds(resource, userId);
  set.add(String(cloudId));
  try {
    localStorage.setItem(storageKey(resource, userId), JSON.stringify([...set]));
  } catch {
    /* ignore quota */
  }
}

/** @param {string} resource @param {string|null|undefined} cloudId @param {string} [userId] */
export function isPurgedCloudId(resource, cloudId, userId) {
  if (!cloudId) return false;
  return loadPurgedCloudIds(resource, userId).has(String(cloudId));
}
