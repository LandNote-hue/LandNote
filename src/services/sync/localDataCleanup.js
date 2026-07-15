import { db } from '../../db.js';
import { DEV_LOCAL_OWNER } from './ownerScope.js';
import { clearFolderState } from '../../navigation/folderPersist.js';
import { clearPropListState } from '../../navigation/propListPersist.js';
import { clearStorageFolderSettings } from '../../utils/storageFolder.js';

const LOCAL_TABLES = ['properties', 'customers', 'call_logs', 'schedules', 'rentals'];

const ACTIVE_OWNER_KEY = 'landnote.activeOwner';
const PENDING_INVITE_KEY = 'landnote.pendingInvite';
const AUTH_FLASH_KEY = 'authFlash';

/** 로그아웃·계정 전환 시 Dexie 캐시 전체 삭제 */
export async function clearLocalUserData() {
  await db.transaction('rw', LOCAL_TABLES, async () => {
    for (const name of LOCAL_TABLES) {
      await db.table(name).clear();
    }
  });
}

/** 탈퇴·계정 전환 시 브라우저에 남은 UI·동기화·폴더 설정 삭제 */
export async function clearAllUserLocalPreferences(userId = null) {
  clearFolderState();
  clearPropListState();

  try {
    sessionStorage.removeItem(PENDING_INVITE_KEY);
    sessionStorage.removeItem(AUTH_FLASH_KEY);
  } catch {
    /* ignore */
  }

  try {
    const keysToRemove = [];
    for (let i = 0; i < localStorage.length; i += 1) {
      const key = localStorage.key(i);
      if (!key) continue;
      if (key === ACTIVE_OWNER_KEY) continue;
      if (key.startsWith('landnote.sync.')) {
        if (!userId || key.endsWith(`.${userId}`)) keysToRemove.push(key);
        continue;
      }
      if (key.startsWith('landnote.purgedCloudIds.')) {
        if (!userId || key.includes(`.${userId}`) || key.endsWith(`.${userId}`)) {
          // landnote.purgedCloudIds.properties.<userId>
          if (!userId || key.endsWith(`.${userId}`)) keysToRemove.push(key);
        }
        continue;
      }
      if (
        key === 'landnote.folders'
        || key === 'upground.folders'
        || key === 'landnote.storagePath'
      ) {
        keysToRemove.push(key);
      }
    }
    for (const key of keysToRemove) localStorage.removeItem(key);
  } catch {
    /* ignore */
  }

  await clearStorageFolderSettings();
}

/** @param {string} userId */
export async function prepareLocalStoreForUser(userId) {
  if (!userId || userId === DEV_LOCAL_OWNER) return { cleared: false };

  const prev = localStorage.getItem(ACTIVE_OWNER_KEY);
  // 같은 계정 재로그인: 로컬 유지 (클라우드 pull이 최신으로 맞춤)
  // 다른 계정으로 전환될 때만 Dexie 비움
  if (prev && prev !== userId) {
    await clearLocalUserData();
    await clearAllUserLocalPreferences(prev);
  }
  localStorage.setItem(ACTIVE_OWNER_KEY, userId);
  return { cleared: !!(prev && prev !== userId) };
}

export function clearActiveOwnerMarker() {
  localStorage.removeItem(ACTIVE_OWNER_KEY);
}

/** 회원탈퇴: Dexie + localStorage·IndexedDB 사용자 설정 전부 초기화 */
export async function wipeLocalDataOnAccountDeletion(userId = null) {
  await clearLocalUserData();
  clearActiveOwnerMarker();
  await clearAllUserLocalPreferences(userId || undefined);
}
