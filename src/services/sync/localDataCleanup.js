import { db } from '../../db.js';
import { DEV_LOCAL_OWNER } from './ownerScope.js';
import { getSyncCompanyId } from './syncContext.js';
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
const RESTORE_LOCAL_WINS_KEY = 'landnote.restoreLocalWins';

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
  clearFolderState(userId);
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
        if (!userId || key.endsWith(`.${userId}`)) keysToRemove.push(key);
        continue;
      }
      if (key.startsWith('landnote.folders.')) {
        if (!userId || key === `landnote.folders.${userId}`) keysToRemove.push(key);
        continue;
      }
      if (key.startsWith('landnote.deletedIcsUids.')) {
        if (!userId || key === `landnote.deletedIcsUids.${userId}`) keysToRemove.push(key);
        continue;
      }
      if (
        key === 'landnote.folders'
        || key === 'upground.folders'
        || key === 'landnote.storagePath'
        || key === RESTORE_LOCAL_WINS_KEY
        || (userId && key === `${RESTORE_LOCAL_WINS_KEY}.${userId}`)
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

/**
 * 현재 계정·회사와 무관한 로컬 행이 있는지 (교차 계정 잔존)
 * — 같은 회사 동료 ownerId는 허용
 * @param {string} userId
 * @param {string|null} [companyId]
 */
async function hasCrossAccountLocalData(userId, companyId = null) {
  const sessionCompany = companyId != null ? String(companyId) : '';
  for (const name of LOCAL_TABLES) {
    const rows = await db.table(name).toArray();
    for (const row of rows) {
      const oid = row.ownerId == null ? '' : String(row.ownerId);
      const cid = row.companyId == null ? '' : String(row.companyId);
      if (!oid || oid === DEV_LOCAL_OWNER || oid === 'null' || oid === 'undefined') {
        return true;
      }
      if (oid === String(userId)) continue;
      // 팀 공유: 동일 companyId만 허용
      if (sessionCompany && cid === sessionCompany) continue;
      return true;
    }
  }
  return false;
}

/**
 * ownerId가 비어 있거나 dev-local인 행 삭제 (타 계정으로 귀속하지 않음)
 * @returns {Promise<{ deleted: number }>}
 */
export async function purgeOrphanOwnerRows() {
  let deleted = 0;
  const orphanOwners = new Set(['', 'null', 'undefined', DEV_LOCAL_OWNER]);
  await db.transaction('rw', LOCAL_TABLES, async () => {
    for (const name of LOCAL_TABLES) {
      const rows = await db.table(name).toArray();
      for (const row of rows) {
        const owner = row.ownerId == null ? '' : String(row.ownerId);
        if (!orphanOwners.has(owner)) continue;
        await db.table(name).delete(row.id);
        deleted += 1;
      }
    }
  });
  if (deleted) console.info('[localData] purged orphan owner rows', { deleted });
  return { deleted };
}

/**
 * 로그인·동기화 직전: 계정 전환/교차 잔존 시 로컬을 비우고 현재 계정 마커 설정
 * @param {string} userId
 * @param {{ companyId?: string|null }} [options]
 */
export async function prepareLocalStoreForUser(userId, options = {}) {
  if (!userId || userId === DEV_LOCAL_OWNER) return { cleared: false, purged: 0 };

  const companyId = options.companyId !== undefined ? options.companyId : getSyncCompanyId();
  const prev = localStorage.getItem(ACTIVE_OWNER_KEY);
  const switched = !!(prev && prev !== userId);

  let needsClear = switched;
  if (!needsClear) {
    try {
      needsClear = await hasCrossAccountLocalData(userId, companyId);
    } catch (err) {
      console.warn('[localData] cross-account check failed — clearing', err);
      needsClear = true;
    }
  }

  if (needsClear) {
    console.info('[localData] clearing local store for account boundary', {
      prev: prev || null,
      next: userId,
      switched,
    });
    await clearLocalUserData();
    await clearAllUserLocalPreferences(prev || undefined);
  }

  localStorage.setItem(ACTIVE_OWNER_KEY, userId);
  // 잔여 orphan은 귀속하지 않고 삭제 (교차 계정 오염 방지)
  const { deleted: purged } = await purgeOrphanOwnerRows();
  return { cleared: needsClear, purged };
}

/** @deprecated use purgeOrphanOwnerRows — 타 계정 orphan을 현재 계정으로 가져오지 않음 */
export async function claimOrphanLocalOwners(userId) {
  void userId;
  return purgeOrphanOwnerRows().then((r) => ({ updated: r.deleted }));
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
