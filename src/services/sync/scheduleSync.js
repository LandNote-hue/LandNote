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
  'id', 'cloudId', 'cloudLocalId', 'ownerId', 'companyId', 'title', 'date', 'time', 'pri', 'pid', 'memo', 'chk', 'callId', 'deletedAt',
]);

/** @param {Record<string, unknown>} sched @param {string} sessionUserId */
function schedToCloudRow(sched, sessionUserId) {
  const data = {};
  for (const [k, v] of Object.entries(sched)) {
    if (!INDEX_KEYS.has(k)) data[k] = v;
  }
  // 클라우드 FK는 원본(소유자 기준) local_id로 저장. 로컬 리맵 id를 그대로 올리면 대표 데이터가 깨짐.
  const ownerId = cloudUserIdForRow(sched, sessionUserId);
  const pidRemote = sched.pid == null
    ? null
    : (sched.cloudPid ?? sched.pid);
  const callIdRemote = sched.callId == null
    ? null
    : (sched.cloudCallId ?? sched.callId);

  const row = {
    user_id: ownerId,
    company_id: cloudCompanyIdForRow(sched),
    local_id: sched.cloudLocalId ?? sched.id,
    date: sched.date ?? null,
    pri: sched.pri ?? null,
    pid: pidRemote,
    deleted_at: deletedAtToIso(sched.deletedAt),
    data: {
      ...data,
      title: sched.title ?? null,
      time: sched.time ?? null,
      memo: sched.memo ?? null,
      chk: sched.chk ?? [],
      callId: callIdRemote,
      dateEnd: sched.dateEnd || null,
    },
    updated_at: new Date().toISOString(),
  };
  if (sched.cloudId) row.id = sched.cloudId;
  return row;
}

/** @param {Record<string, unknown>} row */
function cloudRowToSched(row) {
  const data = row.data && typeof row.data === 'object' ? row.data : {};
  const ownerId = row.user_id;
  const remotePid = row.pid ?? data.pid ?? null;
  const remoteCallId = data.callId ?? null;
  return {
    ...data,
    ...ownerFieldsFromCloudRow(row),
    cloudId: row.id,
    cloudLocalId: row.local_id ?? null,
    cloudPid: remotePid,
    cloudCallId: remoteCallId,
    date: row.date ?? data.date ?? null,
    pri: row.pri ?? data.pri ?? null,
    pid: remapFk('properties', ownerId, remotePid),
    title: data.title ?? null,
    time: data.time ?? null,
    memo: data.memo ?? null,
    chk: data.chk ?? [],
    dateEnd: data.dateEnd || null,
    callId: remapFk('call_logs', ownerId, remoteCallId),
    deletedAt: deletedAtFromIso(row.deleted_at),
  };
}

function canSync(userId) {
  return isSupabaseConfigured && userId && userId !== DEV_LOCAL_OWNER;
}

/** @param {string} userId */
export async function syncSchedulesFromCloud(userId) {
  if (!canSync(userId)) return { ok: false, reason: 'skip' };

  await pushOwnedSoftDeletes('schedules', syncScheduleToCloud, userId, 'schedules');

  const companyId = getSyncCompanyId();

  const rows = await fetchAllCloudRows(supabase, 'schedules');

  const remoteCloudIds = new Set();
  const { isPurgedCloudId } = await import('./purgedCloudIds.js');

  for (const row of rows) {
    if (isPurgedCloudId('schedules', row.id, userId)) continue;
    if (row.id) remoteCloudIds.add(String(row.id));
    const sched = cloudRowToSched(row);
    await upsertSharedCloudRecord(db.schedules, {
      sessionUserId: userId,
      cloudRow: row,
      record: sched,
      resource: 'schedules',
    });
  }

  await pruneStaleCloudRows(db.schedules, remoteCloudIds, userId, companyId, 'schedules');

  localStorage.setItem(`landnote.sync.schedules.${userId}`, new Date().toISOString());
  return { ok: true, count: rows.length };
}

/** @param {number} schedId @param {string} [sessionUserId] */
export async function syncScheduleToCloud(schedId, sessionUserId = getSyncUserId()) {
  if (!canSync(sessionUserId)) return { ok: false, reason: 'skip' };

  const sched = await db.schedules.get(schedId);
  if (!sched || !canMutateRecord(sched, 'schedules')) return { ok: false, reason: 'forbidden' };

  const row = schedToCloudRow(sched, sessionUserId);

  if (sched.cloudId) {
    const { error } = await supabase.from('schedules').update(row).eq('id', sched.cloudId);
    if (error) throw error;
  } else {
    const { data, error } = await supabase.from('schedules').insert(row).select('id').single();
    if (error) {
      const cloudId = await insertOrUpdateByLocalId(supabase, 'schedules', row, error);
      await db.schedules.update(schedId, { cloudId });
    } else {
      await db.schedules.update(schedId, { cloudId: data.id });
    }
  }
  return { ok: true };
}

/** @param {number} schedId @param {string} [sessionUserId] */
export async function deleteScheduleFromCloud(schedId, sessionUserId = getSyncUserId()) {
  if (!canSync(sessionUserId)) return { ok: false, reason: 'skip' };
  const sched = await db.schedules.get(schedId);
  if (!sched?.cloudId) return { ok: false, reason: 'no_cloud_id' };
  if (!canMutateRecord(sched, 'schedules')) return { ok: false, reason: 'forbidden' };
  const { rememberPurgedCloudId } = await import('./purgedCloudIds.js');
  const { error } = await supabase.from('schedules').delete().eq('id', sched.cloudId);
  if (error) throw error;
  rememberPurgedCloudId('schedules', sched.cloudId, sessionUserId);
  return { ok: true };
}

/** @param {number} schedId */
export async function syncScheduleAfterChange(schedId) {
  const userId = getSyncUserId();
  if (!userId) return;
  try {
    await syncScheduleToCloud(schedId, userId);
  } catch (err) {
    console.error('[scheduleSync]', err);
  }
}

/** @param {string} userId */
export async function pushUnsyncedSchedulesToCloud(userId) {
  if (!canSync(userId)) return { ok: false, reason: 'skip' };
  const locals = await db.schedules.where('ownerId').equals(userId).toArray();
  let pushed = 0;
  let failed = 0;
  for (const s of locals) {
    if (!s.cloudId && canMutateRecord(s, 'schedules')) {
      try {
        await syncScheduleToCloud(s.id, userId);
        pushed += 1;
      } catch (err) {
        failed += 1;
        console.error('[scheduleSync] push failed', s.id, err);
      }
    }
  }
  return { ok: failed === 0, pushed, failed };
}

/** @param {string} userId */
export async function initialScheduleSync(userId) {
  if (!canSync(userId)) return { ok: false, reason: 'skip' };
  const pull = await syncSchedulesFromCloud(userId);
  const push = await pushUnsyncedSchedulesToCloud(userId);
  return { ok: true, pulled: pull.count ?? 0, pushed: push.pushed ?? 0 };
}
