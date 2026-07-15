const STORAGE_KEY = 'landnote.folders';
const LEGACY_STORAGE_KEY = 'upground.folders';

export const DEFAULT_FOLDERS = [
  { id: 1, name: '강남 핵심상권', color: '#C8102E' },
  { id: 2, name: 'VIP 고객용', color: '#2563EB' },
];

export const DEFAULT_PROP_FOLDERS = { 1: [1], 2: [1, 2], 6: [1] };

export function getDefaultFolderState() {
  return { folders: DEFAULT_FOLDERS, propFolders: { ...DEFAULT_PROP_FOLDERS } };
}

export function clearFolderState() {
  try {
    localStorage.removeItem(STORAGE_KEY);
    localStorage.removeItem(LEGACY_STORAGE_KEY);
  } catch {
    /* ignore */
  }
}

/** @returns {{ folders: Array<{id:number,name:string,color:string}>, propFolders: Record<string, number[]> } | null} */
export function loadFolderState() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY) ?? localStorage.getItem(LEGACY_STORAGE_KEY);
    if (raw && !localStorage.getItem(STORAGE_KEY) && localStorage.getItem(LEGACY_STORAGE_KEY)) {
      localStorage.setItem(STORAGE_KEY, raw);
      localStorage.removeItem(LEGACY_STORAGE_KEY);
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

/** @param {Array<{id:number,name:string,color:string}>} folders @param {Record<string, number[]>} propFolders */
export function saveFolderState(folders, propFolders) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ folders, propFolders }));
  } catch {
    /* ignore quota errors */
  }
}
