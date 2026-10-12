import { db } from '../../db.js';
import { getSyncUserId, getSyncCompanyId } from './syncContext.js';
import {
  DEV_LOCAL_OWNER,
  canMutateRecord,
  ownerFieldsFromCloudRow,
  cloudUserIdForRow,
  cloudCompanyIdForRow,
} from './ownerScope.js';
import { pushOwnedSoftDeletes, pruneStaleCloudRows, deletedAtToIso, deletedAtFromIso, fetchAllCloudRows } from './syncHelpers.js';
import { upsertSharedCloudRecord } from './cloudIdMap.js';
import {
  SYNC_LOCAL_FIELD_KEYS,
  SYNC_STATUS,
  recordNeedsCloudPush,
  mergeIncomingKeepingLocalPending,
  resolveSyncSuccessPatch,
  isLocalSyncPending,
  mergeSyncBatchResult,
} from '../../utils/recordSyncState.js';
import { getSyncClient, isSyncConfigured } from './syncClient.js';
import { updateCloudRowIfVersionMatch, resolveInsertDuplicate, localPatchFromDuplicateClassification } from './optimisticCloudWrite.js';

const INDEX_KEYS = new Set([
  'id', 'cloudId', 'cloudLocalId', 'ownerId', 'companyId', 'pid', 'deletedAt',
  'cloudPid', 'cloudPidLocal',
  ...SYNC_LOCAL_FIELD_KEYS,
]);

function canSync(userId) {
  return isSyncConfigured() && userId && userId !== DEV_LOCAL_OWNER;
}

/** @param {Record<string, unknown>} rental @param {string} sessionUserId */
function rentalToCloudRow(rental, sessionUserId) {
  const data = {};
  for (const [k, v] of Object.entries(rental)) {
    if (!INDEX_KEYS.has(k)) data[k] = v;
  }
  const row = {
    user_id: cloudUserIdForRow(rental, sessionUserId),
    company_id: cloudCompanyIdForRow(rental),
    local_id: rental.cloudLocalId ?? rental.id,
    pid: rental.cloudPidLocal ?? rental.pid ?? null,
    property_id: rental.cloudPid ?? null,
    deleted_at: deletedAtToIso(rental.deletedAt),
    data,
    updated_at: new Date().toISOString(),
  };
  if (rental.cloudId) row.id = rental.cloudId;
  return row;
}

/** @param {Record<string, unknown>} row */
function cloudRowToRental(row) {
  const data = row.data && typeof row.data === 'object' ? { ...row.data } : {};
  for (const k of SYNC_LOCAL_FIELD_KEYS) delete data[k];
  const ownerId = row.user_id;
  const cloudPid = row.property_id ?? data.cloudPid ?? null;
  const cloudPidLocal = row.pid ?? data.pid ?? null;
  return {
    ...data,
    ...ownerFieldsFromCloudRow(row),
    cloudId: row.id,
    cloudLocalId: row.local_id ?? null,
    cloudPid,
    cloudPidLocal,
    pid: cloudPidLocal,
    ownerId,
    deletedAt: deletedAtFromIso(row.deleted_at),
    cloudUpdatedAt: row.updated_at || null,
  };
}

function mergePulledRental(existing, incoming, remoteUpdatedAt) {
  const decision = mergeIncomingKeepingLocalPending(existing, incoming, remoteUpdatedAt);
  if (decision.action === 'apply') {
    if (incoming.deletedAt && !isLocalSyncPending(existing)) {
      return { ...decision.record, deletedAt: incoming.deletedAt, syncStatus: SYNC_STATUS.SYNCED };
    }
    return {
      ...decision.record,
      syncStatus: SYNC_STATUS.SYNCED,
      syncRev: existing?.syncRev ?? 0,
      syncPushedRev: existing?.syncPushedRev ?? existing?.syncRev ?? 0,
      cloudUpdatedAt: incoming.cloudUpdatedAt || existing?.cloudUpdatedAt || null,
    };
  }
  return decision.record;
}

export async function syncRentalsFromCloud(userId, options = {}) {
  if (!canSync(userId)) return { ok: false, reason: 'skip' };

  await pushOwnedSoftDeletes('rentals', syncRentalToCloud, userId, 'properties');

  const companyId = getSyncCompanyId();
  const client = getSyncClient();
  const rows = await fetchAllCloudRows(client, 'rentals');
  const remoteCloudIds = new Set();
  const { isPurgedCloudId } = await import('./purgedCloudIds.js');

  for (const row of rows) {
    if (isPurgedCloudId('rentals', row.id, userId)) continue;
    if (row.id) remoteCloudIds.add(String(row.id));
    const rental = cloudRowToRental(row);
    await upsertSharedCloudRecord(db.rentals, {
      sessionUserId: userId,
      cloudRow: row,
      record: rental,
      resource: 'rentals',
      mergeExisting: (existing, incoming) => mergePulledRental(existing, incoming, row.updated_at),
    });
  }

  await pruneStaleCloudRows(db.rentals, remoteCloudIds, userId, companyId, 'rentals', {
    skipPrune: options.skipPrune === true,
  });

  return { ok: true, count: rows.length, pulled: rows.length, remoteEmpty: rows.length === 0 };
}

export async function syncRentalToCloud(rentalId, sessionUserId = getSyncUserId()) {
  if (!canSync(sessionUserId)) return { ok: false, reason: 'skip' };
  let rental = await db.rentals.get(rentalId);
  if (!rental) return { ok: false, reason: 'missing' };

  const prop = rental.pid != null ? await db.properties.get(rental.pid) : null;
  if (prop && !canMutateRecord(prop, 'properties')) return { ok: false, reason: 'forbidden' };
  if (!prop && !canMutateRecord(rental, 'properties')) return { ok: false, reason: 'forbidden' };
  if (rental.syncStatus === SYNC_STATUS.CONFLICT) {
    return { ok: false, conflict: true, reason: 'conflict' };
  }

  const startedRev = Number(rental.syncRev) || 0;
  const cloudPid = rental.cloudPid || prop?.cloudId || null;
  if (cloudPid && rental.cloudPid !== cloudPid) {
    await db.rentals.update(rentalId, { cloudPid, cloudPidLocal: prop?.cloudLocalId ?? prop?.id ?? rental.pid });
    rental = { ...rental, cloudPid, cloudPidLocal: prop?.cloudLocalId ?? prop?.id ?? rental.pid };
  }

  await db.rentals.update(rentalId, { syncStatus: SYNC_STATUS.SYNCING });
  const client = getSyncClient();

  try {
    if (!rental.cloudId) {
      const bootstrap = rentalToCloudRow(rental, sessionUserId);
      const { data, error } = await client
        .from('rentals')
        .insert(bootstrap)
        .select('id, updated_at, created_at')
        .single();
      if (error) {
        const classified = await resolveInsertDuplicate(client, 'rentals', bootstrap, error);
        const dup = localPatchFromDuplicateClassification(classified);
        await db.rentals.update(rentalId, dup.patch);
        if (!dup.reuse) {
          return { ok: false, conflict: true, reason: dup.reason };
        }
        rental = { ...rental, ...dup.patch };
      } else {
        await db.rentals.update(rentalId, { cloudId: data.id, cloudUpdatedAt: data.updated_at });
        rental = { ...rental, cloudId: data.id, cloudUpdatedAt: data.updated_at };
      }
    }

    const latestBefore = await db.rentals.get(rentalId);
    const row = rentalToCloudRow({ ...rental, ...latestBefore }, sessionUserId);
    const write = await updateCloudRowIfVersionMatch(client, 'rentals', {
      id: rental.cloudId,
      expectedUpdatedAt: latestBefore?.cloudUpdatedAt || rental.cloudUpdatedAt || null,
      row,
    });
    if (!write.ok) {
      if (write.reason === 'conflict' || write.reason === 'no_version') {
        await db.rentals.update(rentalId, {
          syncStatus: SYNC_STATUS.CONFLICT,
          syncConflictRemoteAt: write.remoteUpdatedAt || null,
          syncError: write.reason,
        });
        return { ok: false, conflict: true, reason: write.reason };
      }
      await db.rentals.update(rentalId, { syncStatus: SYNC_STATUS.FAILED, syncError: write.reason });
      return { ok: false, reason: write.reason };
    }

    const latest = await db.rentals.get(rentalId);
    const patch = resolveSyncSuccessPatch(latest, startedRev, {
      cloudId: rental.cloudId,
      cloudPid: latestBefore?.cloudPid || rental.cloudPid,
      cloudUpdatedAt: write.row.updated_at,
    });
    await db.rentals.update(rentalId, patch);
    return {
      ok: patch.syncStatus === SYNC_STATUS.SYNCED,
      stale: patch.syncStatus === SYNC_STATUS.PENDING,
    };
  } catch (err) {
    await db.rentals.update(rentalId, {
      syncStatus: SYNC_STATUS.FAILED,
      syncError: err instanceof Error ? err.message : String(err),
    });
    throw err;
  }
}

export async function syncRentalsForProperty(propertyId, sessionUserId = getSyncUserId()) {
  if (!canSync(sessionUserId)) return { ok: true, skipped: true, reason: 'skip' };
  const rows = await db.rentals.where('pid').equals(propertyId).toArray();
  let failed = 0;
  let conflicts = 0;
  let pushed = 0;
  for (const row of rows) {
    const fresh = await db.rentals.get(row.id);
    if (!fresh) continue;
    if (fresh.syncStatus === SYNC_STATUS.CONFLICT) {
      conflicts += 1;
      continue;
    }
    if (!recordNeedsCloudPush(fresh) && fresh.cloudId) continue;
    try {
      const result = await syncRentalToCloud(fresh.id, sessionUserId);
      if (result?.conflict) conflicts += 1;
      else if (result?.ok === false && result?.reason !== 'skip' && result?.reason !== 'forbidden') failed += 1;
      else if (result?.ok) pushed += 1;
    } catch (err) {
      failed += 1;
      console.error('[rentalSync]', row.id, err);
    }
  }
  return mergeSyncBatchResult({ failed, conflicts, pushed });
}

export async function syncRentalsAfterChange(propertyId) {
  const userId = getSyncUserId();
  if (!userId) return { ok: true, skipped: true, reason: 'skip' };
  try {
    const prop = await db.properties.get(propertyId);
    if (prop && !prop.cloudId) {
      const { syncPropertyToCloud } = await import('./propertySync.js');
      try {
        await syncPropertyToCloud(propertyId, userId);
      } catch (err) {
        console.error('[rentalSync] parent property', err);
      }
    }
    return await syncRentalsForProperty(propertyId, userId);
  } catch (err) {
    console.error('[rentalSync] afterChange', err);
    return { ok: false, error: err };
  }
}

export async function pushUnsyncedRentalsToCloud(userId) {
  if (!canSync(userId)) return { ok: false, reason: 'skip' };
  const locals = await db.rentals.toArray();
  let pushed = 0;
  let failed = 0;
  let conflicts = 0;
  for (const r of locals) {
    const fresh = await db.rentals.get(r.id);
    if (!fresh) continue;
    const prop = fresh.pid != null ? await db.properties.get(fresh.pid) : null;
    if (prop && !canMutateRecord(prop, 'properties')) continue;
    if (!prop && !canMutateRecord(fresh, 'properties')) continue;
    if (fresh.syncStatus === SYNC_STATUS.CONFLICT) {
      conflicts += 1;
      continue;
    }
    if (!recordNeedsCloudPush(fresh)) continue;
    try {
      const result = await syncRentalToCloud(fresh.id, userId);
      if (result?.conflict) conflicts += 1;
      else if (result?.ok === false && result?.reason !== 'skip' && result?.reason !== 'forbidden') failed += 1;
      else if (result?.ok) pushed += 1;
    } catch (err) {
      failed += 1;
      console.error('[rentalSync] push failed', r.id, err);
    }
  }
  return mergeSyncBatchResult({ pushed, failed, conflicts });
}

export async function initialRentalSync(userId, options = {}) {
  if (!canSync(userId)) return { ok: false, reason: 'skip' };
  const push = await pushUnsyncedRentalsToCloud(userId);
  const pull = await syncRentalsFromCloud(userId, options);
  const pushAfter = await pushUnsyncedRentalsToCloud(userId);
  const failed = (push.failed || 0) + (pushAfter.failed || 0);
  const conflicts = (push.conflicts || 0) + (pushAfter.conflicts || 0);
  return mergeSyncBatchResult({
    pulled: pull.count ?? 0,
    pushed: (push.pushed ?? 0) + (pushAfter.pushed ?? 0),
    remoteEmpty: !!pull.remoteEmpty,
    failed,
    conflicts,
    ok: pull?.ok !== false && failed === 0 && conflicts === 0,
  });
}
