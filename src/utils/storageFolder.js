const LABEL_KEY = 'landnote.storagePath';
const IDB_NAME = 'LandNoteStorage';
const IDB_VERSION = 1;
const HANDLE_KEY = 'storageFolder';

export function loadStoragePathLabel() {
  try {
    return localStorage.getItem(LABEL_KEY) || '';
  } catch {
    return '';
  }
}

export function saveStoragePathLabel(label) {
  try {
    if (label) localStorage.setItem(LABEL_KEY, label);
    else localStorage.removeItem(LABEL_KEY);
  } catch {
    /* ignore quota errors */
  }
}

export function isDirectoryPickerSupported() {
  return typeof window !== 'undefined' && 'showDirectoryPicker' in window;
}

function openStorageIDB() {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(IDB_NAME, IDB_VERSION);
    req.onupgradeneeded = () => {
      if (!req.result.objectStoreNames.contains('handles')) {
        req.result.createObjectStore('handles');
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

/** @param {FileSystemDirectoryHandle} handle */
export async function saveDirectoryHandle(handle) {
  const db = await openStorageIDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction('handles', 'readwrite');
    tx.objectStore('handles').put(handle, HANDLE_KEY);
    tx.oncomplete = () => { db.close(); resolve(); };
    tx.onerror = () => { db.close(); reject(tx.error); };
  });
}

export async function getDirectoryHandle() {
  const db = await openStorageIDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction('handles', 'readonly');
    const req = tx.objectStore('handles').get(HANDLE_KEY);
    req.onsuccess = () => { db.close(); resolve(req.result ?? null); };
    req.onerror = () => { db.close(); reject(req.error); };
  });
}

/** 탈퇴·계정 전환 시 저장 폴더 라벨·File System Access 핸들 삭제 */
export async function clearStorageFolderSettings() {
  try {
    localStorage.removeItem(LABEL_KEY);
  } catch {
    /* ignore */
  }
  try {
    const db = await openStorageIDB();
    await new Promise((resolve, reject) => {
      const tx = db.transaction('handles', 'readwrite');
      tx.objectStore('handles').delete(HANDLE_KEY);
      tx.oncomplete = () => { db.close(); resolve(); };
      tx.onerror = () => { db.close(); reject(tx.error); };
    });
  } catch {
    /* ignore */
  }
}

function pickFolderViaInput() {
  return new Promise((resolve) => {
    const input = document.createElement('input');
    input.type = 'file';
    input.webkitdirectory = true;
    input.style.display = 'none';
    let settled = false;

    const finish = (result) => {
      if (settled) return;
      settled = true;
      window.removeEventListener('focus', onWindowFocus);
      input.remove();
      resolve(result);
    };

    const onWindowFocus = () => {
      setTimeout(() => {
        if (!input.files?.length) {
          finish({ label: null, cancelled: true, error: null });
        }
      }, 400);
    };

    input.addEventListener('change', () => {
      const files = input.files;
      if (!files?.length) {
        finish({ label: null, cancelled: true, error: null });
        return;
      }
      const rel = files[0].webkitRelativePath || '';
      const folderName = rel.split('/')[0] || files[0].name;
      saveStoragePathLabel(folderName);
      finish({ label: folderName, cancelled: false, error: null });
    });

    window.addEventListener('focus', onWindowFocus);
    document.body.appendChild(input);
    input.click();
  });
}

/**
 * 저장 폴더 선택 (Chrome/Edge: showDirectoryPicker, 그 외: 폴더 input fallback)
 * @returns {Promise<{ label: string|null, cancelled?: boolean, error: Error|null }>}
 */
export async function pickStorageFolder() {
  if (isDirectoryPickerSupported()) {
    const handle = await window.showDirectoryPicker({ mode: 'readwrite' });
    await saveDirectoryHandle(handle);
    const label = handle.name;
    saveStoragePathLabel(label);
    return { label, cancelled: false, error: null };
  }

  if (typeof document !== 'undefined') {
    return pickFolderViaInput();
  }

  return {
    label: null,
    cancelled: false,
    error: new Error('이 브라우저에서는 폴더 선택을 지원하지 않습니다. Chrome 또는 Edge를 사용해 주세요.'),
  };
}

/** 저장된 핸들 권한 확인·요청 (백업 등 후속 기능용) */
export async function ensureStorageFolderPermission() {
  const handle = await getDirectoryHandle();
  if (!handle) return null;
  const opts = { mode: 'readwrite' };
  let perm = await handle.queryPermission(opts);
  if (perm === 'granted') return handle;
  perm = await handle.requestPermission(opts);
  return perm === 'granted' ? handle : null;
}
