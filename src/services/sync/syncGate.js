/**
 * 클라우드 동기화 직렬화 + 로그인 세션당 initial sync 1회
 */

/** @type {Promise<unknown>} */
let syncChain = Promise.resolve();

/** @type {string|null} */
let initialSyncSessionKey = null;

/** @param {string} userId @param {string|null|undefined} companyId @param {string|null|undefined} role */
export function buildSyncSessionKey(userId, companyId, role) {
  return `${userId}|${companyId ?? ''}|${role ?? ''}`;
}

/** @param {string} key */
export function shouldRunInitialSync(key) {
  if (initialSyncSessionKey === key) return false;
  initialSyncSessionKey = key;
  return true;
}

export function resetSyncSession() {
  initialSyncSessionKey = null;
  syncChain = Promise.resolve();
}

/**
 * @template T
 * @param {() => Promise<T>} fn
 * @returns {Promise<T>}
 */
export function withSyncMutex(fn) {
  const run = syncChain.then(fn, fn);
  syncChain = run.then(() => {}, () => {});
  return run;
}
