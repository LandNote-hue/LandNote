import { db } from '../../db.js';
import { getSyncUserId, getSyncCompanyId } from './syncContext.js';
import {
  DEV_LOCAL_OWNER,
  canMutateRecord,
  ownerFieldsFromCloudRow,
  cloudUserIdForRow,
  cloudCompanyIdForRow,
} from './ownerScope.js';
import { omitHeavyCloudFields, mergePropertyPhotos, pushOwnedSoftDeletes, pruneStaleCloudRows, deletedAtToIso, deletedAtFromIso, fetchAllCloudRows } from './syncHelpers.js';
import { upsertSharedCloudRecord } from './cloudIdMap.js';
import { ensurePropertyPhotosInCloud, removePropertyPhotosFromStorage } from './propertyPhotoStorage.js';
import { rememberPhotoCleanupJob, retryPendingPhotoCleanups } from './pendingPhotoCleanup.js';
import { normalizeJDepToMan } from '../../utils/formatMoney.js';
import { getSyncClient, isSyncConfigured } from './syncClient.js';
import { updateCloudRowIfVersionMatch, resolveInsertDuplicate, localPatchFromDuplicateClassification } from './optimisticCloudWrite.js';
import {
  SYNC_LOCAL_FIELD_KEYS,
  SYNC_STATUS,
  recordNeedsCloudPush,
  mergeIncomingKeepingLocalPending,
  resolveSyncSuccessPatch,
  isLocalSyncPending,
  mergeSyncBatchResult,
} from '../../utils/recordSyncState.js';

const INDEX_KEYS = new Set([
  'id', 'cloudId', 'cloudLocalId', 'ownerId', 'companyId', 'status', 'main', 'sub', 'trade', 'fav', 'favAt', 'deletedAt',
  'discoUrl', // cloud column disco_url로 매핑 — data JSON 중복 저장 방지
  ...SYNC_LOCAL_FIELD_KEYS,
]);

/** @param {Record<string, unknown>} prop @param {string} sessionUserId */
function propToCloudRow(prop, sessionUserId) {
  const data = {};
  for (const [k, v] of Object.entries(prop)) {
    if (!INDEX_KEYS.has(k)) data[k] = v;
  }
  const discoUrl = typeof prop.discoUrl === 'string' ? prop.discoUrl.trim() : '';
  const row = {
    user_id: cloudUserIdForRow(prop, sessionUserId),
    company_id: cloudCompanyIdForRow(prop),
    local_id: prop.cloudLocalId ?? prop.id,
    status: prop.status ?? null,
    main: prop.main ?? null,
    sub: prop.sub ?? null,
    trade: prop.trade ?? null,
    fav: !!prop.fav,
    fav_at: prop.favAt || null,
    deleted_at: deletedAtToIso(prop.deletedAt),
    disco_url: discoUrl || null,
    data: omitHeavyCloudFields(data),
    updated_at: new Date().toISOString(),
  };
  if (prop.cloudId) row.id = prop.cloudId;
  return row;
}

/** @param {Record<string, unknown>} row */
function cloudRowToProp(row) {
  const data = row.data && typeof row.data === 'object' ? { ...row.data } : {};
  if (data.jDep != null && data.jDep !== '') {
    data.jDep = normalizeJDepToMan(data.jDep);
  }
  const discoUrl = (row.disco_url || data.discoUrl || data.disco_url || '').toString().trim();
  delete data.discoUrl;
  delete data.disco_url;
  for (const k of SYNC_LOCAL_FIELD_KEYS) delete data[k];
  return {
    ...data,
    ...ownerFieldsFromCloudRow(row),
    cloudId: row.id,
    cloudLocalId: row.local_id ?? null,
    status: row.status,
    main: row.main,
    sub: row.sub,
    trade: row.trade,
    fav: row.fav,
    favAt: row.fav_at,
    deletedAt: deletedAtFromIso(row.deleted_at),
    discoUrl: discoUrl || '',
    cloudUpdatedAt: row.updated_at || null,
  };
}

function canSync(userId) {
  return isSyncConfigured() && userId && userId !== DEV_LOCAL_OWNER;
}

function mergePulledProperty(existing, incoming, remoteUpdatedAt) {
  const decision = mergeIncomingKeepingLocalPending(existing, incoming, remoteUpdatedAt);
  if (decision.action === 'apply') {
    return {
      ...decision.record,
      photos: mergePropertyPhotos(existing?.photos, incoming.photos),
      syncStatus: existing?.syncStatus === SYNC_STATUS.SYNCING ? SYNC_STATUS.SYNCING : SYNC_STATUS.SYNCED,
      syncRev: existing?.syncRev ?? 0,
      syncPushedRev: existing?.syncPushedRev ?? existing?.syncRev ?? 0,
      cloudUpdatedAt: incoming.cloudUpdatedAt || existing?.cloudUpdatedAt || null,
    };
  }
  return {
    ...decision.record,
    photos: existing?.photos,
  };
}

/** @param {string} userId @param {{ skipPrune?: boolean }} [options] */
export async function syncPropertiesFromCloud(userId, options = {}) {
  if (!canSync(userId)) return { ok: false, reason: 'skip' };

  await pushOwnedSoftDeletes('properties', syncPropertyToCloud, userId, 'properties');

  const companyId = getSyncCompanyId();

  const client = getSyncClient();
  const rows = await fetchAllCloudRows(client, 'properties');

  const remoteCloudIds = new Set();
  const { isPurgedCloudId } = await import('./purgedCloudIds.js');

  for (const row of rows) {
    if (isPurgedCloudId('properties', row.id, userId)) continue;
    if (row.id) remoteCloudIds.add(String(row.id));
    const prop = cloudRowToProp(row);
    await upsertSharedCloudRecord(db.properties, {
      sessionUserId: userId,
      cloudRow: row,
      record: prop,
      resource: 'properties',
      mergeExisting: (existing, incoming) => mergePulledProperty(existing, incoming, row.updated_at),
    });
  }

  await pruneStaleCloudRows(db.properties, remoteCloudIds, userId, companyId, 'properties', {
    skipPrune: options.skipPrune === true,
  });

  localStorage.setItem(`landnote.sync.properties.${userId}`, new Date().toISOString());
  return {
    ok: true,
    count: rows.length,
    pulled: rows.length,
    remoteEmpty: rows.length === 0,
  };
}

/** @param {number} propertyId @param {string} [sessionUserId] */
export async function syncPropertyToCloud(propertyId, sessionUserId = getSyncUserId()) {
  if (!canSync(sessionUserId)) return { ok: false, reason: 'skip' };

  let prop = await db.properties.get(propertyId);
  if (!prop || !canMutateRecord(prop, 'properties')) return { ok: false, reason: 'forbidden' };

  const startedRev = Number(prop.syncRev) || 0;
  if (prop.syncStatus === SYNC_STATUS.CONFLICT) {
    return { ok: false, conflict: true, reason: 'conflict' };
  }
  await db.properties.update(propertyId, { syncStatus: SYNC_STATUS.SYNCING });

  const client = getSyncClient();

  try {
    if (!prop.cloudId) {
      const bootstrap = propToCloudRow(prop, sessionUserId);
      const { data, error } = await client
        .from('properties')
        .insert(bootstrap)
        .select('id, updated_at, created_at')
        .single();
      if (error) {
        const classified = await resolveInsertDuplicate(client, 'properties', bootstrap, error);
        const dup = localPatchFromDuplicateClassification(classified);
        await db.properties.update(propertyId, dup.patch);
        if (!dup.reuse) {
          return { ok: false, conflict: true, reason: dup.reason };
        }
        prop = { ...prop, ...dup.patch };
      } else {
        await db.properties.update(propertyId, { cloudId: data.id, cloudUpdatedAt: data.updated_at });
        prop = { ...prop, cloudId: data.id, cloudUpdatedAt: data.updated_at };
      }
    }

    const withPhotos = await ensurePropertyPhotosInCloud(prop);
    if (withPhotos.photos !== prop.photos) {
      await db.properties.update(propertyId, { photos: withPhotos.photos });
      prop = withPhotos;
    }

    const latestBeforeUpdate = await db.properties.get(propertyId);
    const row = propToCloudRow({ ...prop, ...latestBeforeUpdate }, sessionUserId);
    const expectedUpdatedAt = latestBeforeUpdate?.cloudUpdatedAt || prop.cloudUpdatedAt || null;
    const write = await updateCloudRowIfVersionMatch(client, 'properties', {
      id: prop.cloudId,
      expectedUpdatedAt,
      row,
    });
    if (!write.ok) {
      const latest = await db.properties.get(propertyId);
      if (write.reason === 'conflict' || write.reason === 'no_version') {
        await db.properties.update(propertyId, {
          syncStatus: SYNC_STATUS.CONFLICT,
          syncConflictRemoteAt: write.remoteUpdatedAt || null,
          syncError: write.reason === 'conflict' ? 'remote_version_mismatch' : 'missing_local_version',
        });
        return { ok: false, conflict: true, reason: write.reason };
      }
      await db.properties.update(propertyId, {
        syncStatus: SYNC_STATUS.FAILED,
        syncError: write.reason || 'not_updated',
      });
      return { ok: false, reason: write.reason, stale: isLocalSyncPending(latest) };
    }

    const latest = await db.properties.get(propertyId);
    const patch = resolveSyncSuccessPatch(latest, startedRev, {
      cloudId: prop.cloudId,
      cloudUpdatedAt: write.row.updated_at,
    });
    await db.properties.update(propertyId, patch);
    return {
      ok: patch.syncStatus === SYNC_STATUS.SYNCED,
      stale: patch.syncStatus === SYNC_STATUS.PENDING,
    };
  } catch (err) {
    const latest = await db.properties.get(propertyId);
    const stillPending = isLocalSyncPending(latest) || (Number(latest?.syncRev) || 0) !== startedRev;
    await db.properties.update(propertyId, {
      syncStatus: stillPending ? SYNC_STATUS.FAILED : SYNC_STATUS.FAILED,
      syncError: err instanceof Error ? err.message : String(err),
    });
    throw err;
  }
}

/** @param {number} propertyId @param {string} [sessionUserId] */
export async function deletePropertyFromCloud(propertyId, sessionUserId = getSyncUserId()) {
  if (!canSync(sessionUserId)) return { ok: false, reason: 'skip' };
  const prop = await db.properties.get(propertyId);
  if (!prop?.cloudId) return { ok: false, reason: 'no_cloud_id' };
  if (!canMutateRecord(prop, 'properties')) return { ok: false, reason: 'forbidden' };
  if (prop.syncStatus === SYNC_STATUS.CONFLICT) {
    return { ok: false, conflict: true, reason: 'conflict' };
  }

  const client = getSyncClient();
  const expectedUpdatedAt = prop.cloudUpdatedAt || null;
  if (!expectedUpdatedAt) {
    await db.properties.update(propertyId, {
      deleteIntent: true,
      syncStatus: SYNC_STATUS.CONFLICT,
      syncError: 'missing_local_version',
    });
    return { ok: false, conflict: true, reason: 'no_version' };
  }

  let del = client.from('properties').delete().eq('id', prop.cloudId).eq('updated_at', expectedUpdatedAt);
  const { data, error } = await del.select('id').maybeSingle();
  if (error) throw error;
  if (data?.id) {
    return { ok: true, deletedId: data.id };
  }

  const { data: current, error: fetchErr } = await client
    .from('properties')
    .select('id, updated_at')
    .eq('id', prop.cloudId)
    .maybeSingle();
  if (fetchErr) throw fetchErr;
  if (current) {
    await db.properties.update(propertyId, {
      deleteIntent: true,
      syncStatus: SYNC_STATUS.CONFLICT,
      syncConflictRemoteAt: current.updated_at,
      syncError: 'remote_version_mismatch',
    });
    return { ok: false, conflict: true, reason: 'conflict' };
  }
  await db.properties.update(propertyId, {
    deleteIntent: true,
    syncStatus: SYNC_STATUS.FAILED,
    syncError: 'missing_or_forbidden',
  });
  return { ok: false, reason: 'missing_or_forbidden' };
}

/** 서버 삭제 확인 후 사진 정리. 실패는 재시도 대기열에만 남긴다. */
export async function finalizePropertyCloudDelete(prop, sessionUserId = getSyncUserId()) {
  if (prop?.cloudId) {
    const { rememberPurgedCloudId } = await import('./purgedCloudIds.js');
    rememberPurgedCloudId('properties', prop.cloudId, sessionUserId);
  }
  try {
    await removePropertyPhotosFromStorage(prop);
    return { ok: true, photosFailed: false };
  } catch (err) {
    rememberPhotoCleanupJob(prop);
    return {
      ok: true,
      photosFailed: true,
      error: err instanceof Error ? err.message : String(err),
    };
  }
}

/** @param {number} propertyId */
export async function syncPropertyAfterChange(propertyId) {
  const userId = getSyncUserId();
  if (!userId) return { ok: true, skipped: true, reason: 'skip' };
  try {
    return await syncPropertyToCloud(propertyId, userId);
  } catch (err) {
    console.error('[propertySync]', err);
    return { ok: false, error: err };
  }
}

/** @param {string} userId */
export async function pushUnsyncedPropertiesToCloud(userId) {
  if (!canSync(userId)) return { ok: false, reason: 'skip' };
  const locals = await db.properties.toArray();
  let pushed = 0;
  let failed = 0;
  let conflicts = 0;
  for (const p of locals) {
    const fresh = await db.properties.get(p.id);
    if (!fresh || !canMutateRecord(fresh, 'properties')) continue;
    if (fresh.syncStatus === SYNC_STATUS.CONFLICT) {
      conflicts += 1;
      continue;
    }
    if (fresh.deleteIntent) {
      try {
        const del = await deletePropertyFromCloud(fresh.id, userId);
        if (del?.ok) {
          await finalizePropertyCloudDelete(fresh, userId);
          await db.properties.delete(fresh.id);
          pushed += 1;
        } else if (del?.conflict) conflicts += 1;
        else if (del?.reason !== 'skip' && del?.reason !== 'forbidden') failed += 1;
      } catch (err) {
        failed += 1;
        console.error('[propertySync] delete retry failed', fresh.id, err);
      }
      continue;
    }
    if (!recordNeedsCloudPush(fresh)) continue;
    try {
      const result = await syncPropertyToCloud(fresh.id, userId);
      if (result?.conflict) conflicts += 1;
      else if (result?.ok === false && result?.reason !== 'skip' && result?.reason !== 'forbidden') failed += 1;
      else if (result?.ok) pushed += 1;
    } catch (err) {
      failed += 1;
      console.error('[propertySync] push failed', fresh.id, err);
    }
  }
  return mergeSyncBatchResult({ pushed, failed, conflicts });
}

/** @param {string} userId @param {{ skipPrune?: boolean }} [options] */
export async function initialPropertySync(userId, options = {}) {
  if (!canSync(userId)) return { ok: false, reason: 'skip' };
  await retryPendingPhotoCleanups(removePropertyPhotosFromStorage);
  const push = await pushUnsyncedPropertiesToCloud(userId);
  const pull = await syncPropertiesFromCloud(userId, options);
  const pushAfterPull = await pushUnsyncedPropertiesToCloud(userId);
  const failed = (push.failed || 0) + (pushAfterPull.failed || 0);
  const conflicts = (push.conflicts || 0) + (pushAfterPull.conflicts || 0);
  const pulledOk = pull?.ok !== false;
  return mergeSyncBatchResult({
    pulled: pull.count ?? 0,
    pushed: (push.pushed ?? 0) + (pushAfterPull.pushed ?? 0),
    remoteEmpty: !!pull.remoteEmpty,
    failed,
    conflicts,
    ok: pulledOk && failed === 0 && conflicts === 0,
  });
}

export function getPropertySyncTime(userId) {
  if (!userId) return null;
  return localStorage.getItem(`landnote.sync.properties.${userId}`);
}
