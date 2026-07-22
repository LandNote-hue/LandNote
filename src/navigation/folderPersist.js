import { getActiveOwnerId, DEV_LOCAL_OWNER } from '../services/sync/ownerScope.js';

const STORAGE_KEY_PREFIX = 'landnote.folders';
const LEGACY_STORAGE_KEY = 'landnote.folders';
const LEGACY_UPGROUND_KEY = 'upground.folders';

export const DEFAULT_FOLDERS = [
  { id: 1, name: '강남 핵심상권', color: '#C8102E' },
  { id: 2, name: 'VIP 고객용', color: '#2563EB' },
];

export const DEFAULT_PROP_FOLDERS = { 1: [1], 2: [1, 2], 6: [1] };

/** @param {string|null|undefined} userId */
function folderStorageKey(userId) {
  const id = userId && userId !== DEV_LOCAL_OWNER ? String(userId) : null;
  return id ? `${STORAGE_KEY_PREFIX}.${id}` : LEGACY_STORAGE_KEY;
}

export function getDefaultFolderState() {
  return { folders: DEFAULT_FOLDERS, propFolders: { ...DEFAULT_PROP_FOLDERS } };
}

/** @param {string|null|undefined} [userId] */
export function clearFolderState(userId = null) {
  try {
    if (userId) localStorage.removeItem(folderStorageKey(userId));
    localStorage.removeItem(LEGACY_STORAGE_KEY);
    localStorage.removeItem(LEGACY_UPGROUND_KEY);
  } catch {
    /* ignore */
  }
}

/**
 * @param {string|null|undefined} [userId]
 * @returns {{ folders: Array<{id:number,name:string,color:string}>, propFolders: Record<string, number[]> } | null}
 */
export function loadFolderState(userId = getActiveOwnerId()) {
  try {
    const key = folderStorageKey(userId);
    let raw = localStorage.getItem(key);
    // 구버전 공용 키 → 계정별 키로 1회 이전 (현재 계정만)
    if (!raw && userId && userId !== DEV_LOCAL_OWNER) {
      raw = localStorage.getItem(LEGACY_STORAGE_KEY) ?? localStorage.getItem(LEGACY_UPGROUND_KEY);
      if (raw) {
        localStorage.setItem(key, raw);
        localStorage.removeItem(LEGACY_STORAGE_KEY);
        localStorage.removeItem(LEGACY_UPGROUND_KEY);
      }
    }
    if (!raw) return null;
    const data = JSON.parse(raw);
    if (!Array.isArray(data.folders)) return null;
    return {
      folders: data.folders,
      propFolders: data.propFolders && typeof data.propFolders === 'object' ? data.propFolders : {},
    };
  } catch {
    return null;
  }
}

/**
 * @param {Array<{id:number,name:string,color:string}>} folders
 * @param {Record<string, number[]>} propFolders
 * @param {string|null|undefined} [userId]
 */
export function saveFolderState(folders, propFolders, userId = getActiveOwnerId()) {
  try {
    localStorage.setItem(folderStorageKey(userId), JSON.stringify({ folders, propFolders }));
  } catch {
    /* ignore quota errors */
  }
}
