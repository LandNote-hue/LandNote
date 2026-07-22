import { db } from '../../db.js';
import { isSupabaseConfigured, supabase } from '../../lib/supabase.js';
import { getSyncUserId, getSyncCompanyId } from './syncContext.js';
import {
  DEV_LOCAL_OWNER,
  canMutateRecord,
  ownerFieldsFromCloudRow,
  cloudUserIdForRow,
  cloudCompanyIdForRow,
} from './ownerScope.js';
import { insertOrUpdateByLocalId, pushOwnedSoftDeletes, pruneStaleCloudRows, deletedAtToIso, deletedAtFromIso, fetchAllCloudRows } from './syncHelpers.js';
import { remapFk, upsertSharedCloudRecord } from './cloudIdMap.js';

const INDEX_KEYS = new Set([
  'id', 'cloudId', 'cloudLocalId', 'ownerId', 'companyId', 'pid', 'cid', 'date', 'time', 'content', 'next', 'nDate', 'schedId', 'deletedAt',
  'cloudPid', 'cloudCid', 'cloudSchedId',
]);

/** @param {Record<string, unknown>} call @param {string} sessionUserId */
function callToCloudRow(call, sessionUserId) {
  const data = {};
  for (const [k, v] of Object.entries(call)) {
    if (!INDEX_KEYS.has(k)) data[k] = v;
  }
  const row = {
    user_id: cloudUserIdForRow(call, sessionUserId),
    company_id: cloudCompanyIdForRow(call),
    local_id: call.cloudLocalId ?? call.id,
    pid: call.cloudPid ?? call.pid ?? null,
    cid: call.cloudCid ?? call.cid ?? null,
    date: call.date ?? null,
    deleted_at: deletedAtToIso(call.deletedAt),
    data: {
      ...data,
      time: call.time ?? null,
      content: call.content ?? null,
      next: call.next ?? null,
      nDate: call.nDate ?? null,
      schedId: call.cloudSchedId ?? call.schedId ?? null,
    },
    updated_at: new Date().toISOString(),
  };
  if (call.cloudId) row.id = call.cloudId;
  return row;
}

/** @param {Record<string, unknown>} row */
function cloudRowToCall(row) {
  const data = row.data && typeof row.data === 'object' ? row.data : {};
  const ownerId = row.user_id;
  const remotePid = row.pid ?? data.pid ?? null;
  const remoteCid = row.cid ?? data.cid ?? null;
  const remoteSchedId = data.schedId ?? null;
  return {
    ...data,
    ...ownerFieldsFromCloudRow(row),
    cloudId: row.id,
    cloudLocalId: row.local_id ?? null,
    cloudPid: remotePid,
    cloudCid: remoteCid,
    cloudSchedId: remoteSchedId,
    pid: remapFk('properties', ownerId, remotePid),
    cid: remapFk('customers', ownerId, remoteCid),
    date: row.date ?? data.date ?? null,
    time: data.time ?? null,
    content: data.content ?? null,
    next: data.next ?? null,
    nDate: data.nDate ?? null,
    schedId: remapFk('schedules', ownerId, remoteSchedId),
    deletedAt: deletedAtFromIso(row.deleted_at),
  };
}

function canSync(userId) {
  return isSupabaseConfigured && userId && userId !== DEV_LOCAL_OWNER;
}

/** @param {string} userId */
export async function syncCallLogsFromCloud(userId) {
  if (!canSync(userId)) return { ok: false, reason: 'skip' };

  await pushOwnedSoftDeletes('call_logs', syncCallLogToCloud, userId, 'call_logs');

  const companyId = getSyncCompanyId();

  const rows = await fetchAllCloudRows(supabase, 'call_logs');

  const remoteCloudIds = new Set();
  const { isPurgedCloudId } = await import('./purgedCloudIds.js');

  for (const row of rows) {
    if (isPurgedCloudId('call_logs', row.id, userId)) continue;
    if (row.id) remoteCloudIds.add(String(row.id));
    const call = cloudRowToCall(row);
    await upsertSharedCloudRecord(db.call_logs, {
      sessionUserId: userId,
      cloudRow: row,
      record: call,
      resource: 'call_logs',
    });
  }

  await pruneStaleCloudRows(db.call_logs, remoteCloudIds, userId, companyId, 'call_logs');

  localStorage.setItem(`landnote.sync.call_logs.${userId}`, new Date().toISOString());
  return { ok: true, count: rows.length };
}

/** @param {number} callId @param {string} [sessionUserId] */
export async function syncCallLogToCloud(callId, sessionUserId = getSyncUserId()) {
  if (!canSync(sessionUserId)) return { ok: false, reason: 'skip' };

  const call = await db.call_logs.get(callId);
  if (!call || !canMutateRecord(call, 'call_logs')) return { ok: false, reason: 'forbidden' };

  const row = callToCloudRow(call, sessionUserId);

  if (call.cloudId) {
    const { error } = await supabase.from('call_logs').update(row).eq('id', call.cloudId);
    if (error) throw error;
  } else {
    const { data, error } = await supabase.from('call_logs').insert(row).select('id').single();
    if (error) {
      const cloudId = await insertOrUpdateByLocalId(supabase, 'call_logs', row, error);
      await db.call_logs.update(callId, { cloudId });
    } else {
      await db.call_logs.update(callId, { cloudId: data.id });
    }
  }
  return { ok: true };
}

/** @param {number} callId @param {string} [sessionUserId] */
export async function deleteCallLogFromCloud(callId, sessionUserId = getSyncUserId()) {
  if (!canSync(sessionUserId)) return { ok: false, reason: 'skip' };
  const call = await db.call_logs.get(callId);
  if (!call?.cloudId) return { ok: false, reason: 'no_cloud_id' };
  if (!canMutateRecord(call, 'call_logs')) return { ok: false, reason: 'forbidden' };
  const { rememberPurgedCloudId } = await import('./purgedCloudIds.js');
  const { error } = await supabase.from('call_logs').delete().eq('id', call.cloudId);
  if (error) throw error;
  rememberPurgedCloudId('call_logs', call.cloudId, sessionUserId);
  return { ok: true };
}

/** @param {number} callId */
export async function syncCallLogAfterChange(callId) {
  const userId = getSyncUserId();
  if (!userId) return;
  try {
    await syncCallLogToCloud(callId, userId);
  } catch (err) {
    console.error('[callLogSync]', err);
  }
}

/** @param {string} userId */
export async function pushUnsyncedCallLogsToCloud(userId) {
  if (!canSync(userId)) return { ok: false, reason: 'skip' };
  const locals = await db.call_logs.where('ownerId').equals(userId).toArray();
  let pushed = 0;
  let failed = 0;
  for (const c of locals) {
    if (!c.cloudId && canMutateRecord(c, 'call_logs')) {
      try {
        await syncCallLogToCloud(c.id, userId);
        pushed += 1;
      } catch (err) {
        failed += 1;
        console.error('[callLogSync] push failed', c.id, err);
      }
    }
  }
  return { ok: failed === 0, pushed, failed };
}

/** @param {string} userId */
export async function initialCallLogSync(userId) {
  if (!canSync(userId)) return { ok: false, reason: 'skip' };
  const pull = await syncCallLogsFromCloud(userId);
  const push = await pushUnsyncedCallLogsToCloud(userId);
  return { ok: true, pulled: pull.count ?? 0, pushed: push.pushed ?? 0 };
}
