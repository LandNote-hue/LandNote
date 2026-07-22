import { db } from '../../db.js';
import { DEV_LOCAL_OWNER } from './ownerScope.js';
import { clearFolderState } from '../../navigation/folderPersist.js';
import { clearPropListState } from '../../navigation/propListPersist.js';

const LOCAL_TABLES = ['properties', 'customers', 'call_logs', 'schedules', 'rentals'];
const LEGACY_STORAGE_PATH_KEY = 'landnote.storagePath';
const LEGACY_STORAGE_IDB = 'LandNoteStorage';

/** 제거된「파일 저장 위치」설정 잔여 데이터 정리 */
async function clearLegacyStorageFolderSettings() {
  try {
    localStorage.removeItem(LEGACY_STORAGE_PATH_KEY);
  } catch {
    /* ignore */
  }
  try {
    await new Promise((resolve) => {
      const req = indexedDB.deleteDatabase(LEGACY_STORAGE_IDB);
      req.onsuccess = () => resolve();
      req.onerror = () => resolve();
      req.onblocked = () => resolve();
    });
  } catch {
    /* ignore */
  }
}

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

  await clearLegacyStorageFolderSettings();
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
  // 로그인 전/전환 과정에서 ownerId가 비거나 dev-local로 남은 행을 현재 계정으로 귀속
  const claimed = await claimOrphanLocalOwners(userId);
  return { cleared: !!(prev && prev !== userId), claimed };
}

/**
 * ownerId가 비어 있거나 dev-local인 활성 행을 현재 userId로 맞춤
 * (UI 스코프 필터로 "데이터는 있는데 안 보이는" 상태 방지)
 * @param {string} userId
 */
export async function claimOrphanLocalOwners(userId) {
  if (!userId || userId === DEV_LOCAL_OWNER) return { updated: 0 };
  const orphanOwners = new Set(['', 'null', 'undefined', DEV_LOCAL_OWNER]);
  let updated = 0;
  await db.transaction('rw', LOCAL_TABLES, async () => {
    for (const name of LOCAL_TABLES) {
      const rows = await db.table(name).toArray();
      for (const row of rows) {
        const owner = row.ownerId == null ? '' : String(row.ownerId);
        if (!orphanOwners.has(owner)) continue;
        if (row.deletedAt) continue;
        await db.table(name).update(row.id, { ownerId: userId });
        updated += 1;
      }
    }
  });
  if (updated) console.info('[localData] claimed orphan owner rows', { userId, updated });
  return { updated };
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
