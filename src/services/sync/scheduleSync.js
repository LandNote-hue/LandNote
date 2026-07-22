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
import { remapFk, bulkUpsertSharedCloudRecords } from './cloudIdMap.js';

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
      icsSourceId: sched.icsSourceId ?? data.icsSourceId ?? null,
      icsUid: sched.icsUid ?? data.icsUid ?? null,
      icsKey: sched.icsKey ?? data.icsKey ?? null,
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

/** @param {Record<string, unknown>} existing @param {Record<string, unknown>} incoming */
function mergeScheduleFromCloud(existing, incoming) {
  const merged = { ...existing, ...incoming };
  // 클라우드에 ICS 출처가 비어 있거나 달라도, 로컬 연동 출처를 우선 유지(색 깜빡임 방지)
  if (existing.icsSourceId) {
    if (!incoming.icsSourceId || incoming.icsSourceId !== existing.icsSourceId) {
      merged.icsSourceId = existing.icsSourceId;
    }
  }
  if (existing.icsUid && !incoming.icsUid) merged.icsUid = existing.icsUid;
  if (existing.icsKey && !incoming.icsKey) merged.icsKey = existing.icsKey;
  // 활성 로컬 일정을 삭제된 클라우드 쌍둥이(collapse soft-delete)로 덮지 않음
  if (!existing.deletedAt && incoming.deletedAt) {
    merged.deletedAt = null;
  }
  return merged;
}

/** @param {string} userId @param {{ skipPrune?: boolean }} [options] */
export async function syncSchedulesFromCloud(userId, options = {}) {
  if (!canSync(userId)) return { ok: false, reason: 'skip' };

  await pushOwnedSoftDeletes('schedules', syncScheduleToCloud, userId, 'schedules');

  const companyId = getSyncCompanyId();

  const rows = await fetchAllCloudRows(supabase, 'schedules');

  const remoteCloudIds = new Set();
  const { isPurgedCloudId } = await import('./purgedCloudIds.js');
  const { occurrenceKeyFromSchedule } = await import('../../utils/icsImport.js');
  const { isActive } = await import('../../db.js');
  const { flushPendingIcsSourceIdRemaps } = await import('../googleCalendarLinks.js');

  // 클라우드 pull 전에 로컬 ICS occurrence 맵 — 동일 일정 이중 삽입 방지
  const localIcs = (await db.schedules.toArray()).filter(
    (s) => isActive(s) && (s.icsUid || s.icsKey || s.icsSourceId),
  );
  /** @type {Map<string, object>} */
  const byOcc = new Map();
  for (const s of localIcs) {
    const k = occurrenceKeyFromSchedule(s);
    if (k && !byOcc.has(k)) byOcc.set(k, s);
  }

  /** @type {Array<{ sessionUserId: string, cloudRow: Record<string, unknown>, record: Record<string, unknown>, mergeExisting?: Function }>} */
  const batch = [];

  for (const row of rows) {
    if (isPurgedCloudId('schedules', row.id, userId)) continue;
    if (row.id) remoteCloudIds.add(String(row.id));
    const sched = cloudRowToSched(row);
    const occ = occurrenceKeyFromSchedule(sched);
    const local = occ ? byOcc.get(occ) : null;

    // 삭제된 클라우드 행이 활성 로컬(동일 occurrence)을 덮거나 cloudId를 훔치지 않음
    if (sched.deletedAt && local && !local.deletedAt) {
      continue;
    }

    if (local && row.id && !sched.deletedAt) {
      if (!local.cloudId || String(local.cloudId) !== String(row.id)) {
        await db.schedules.update(local.id, {
          cloudId: row.id,
          icsKey: local.icsKey || occ || sched.icsKey,
          icsUid: local.icsUid || sched.icsUid,
          icsSourceId: local.icsSourceId || sched.icsSourceId,
          ownerId: local.ownerId || userId,
        });
        local.cloudId = row.id;
      }
    }
    const record = local
      ? {
        ...sched,
        icsSourceId: local.icsSourceId || sched.icsSourceId,
        icsUid: local.icsUid || sched.icsUid,
        icsKey: local.icsKey || sched.icsKey || occ,
        deletedAt: local.deletedAt && !sched.deletedAt ? null : (sched.deletedAt || null),
      }
      : sched;
    // 활성 로컬이면 삭제 상태 강제 해제
    if (local && !local.deletedAt) {
      record.deletedAt = null;
    }
    batch.push({
      sessionUserId: userId,
      cloudRow: row,
      record,
      mergeExisting: mergeScheduleFromCloud,
    });
  }
  await bulkUpsertSharedCloudRecords(db.schedules, batch, 'schedules');

  await pruneStaleCloudRows(db.schedules, remoteCloudIds, userId, companyId, 'schedules', {
    skipPrune: options.skipPrune === true,
  });
  try {
    await flushPendingIcsSourceIdRemaps(userId);
  } catch (err) {
    console.warn('[scheduleSync] flush ics source remaps', err);
  }
  // sync 끝마다 collapse 금지 — soft-delete↔pull 오염 루프 방지. import/수동 동기화 경로에서만 collapse.

  localStorage.setItem(`landnote.sync.schedules.${userId}`, new Date().toISOString());
  return {
    ok: true,
    count: rows.length,
    pulled: rows.length,
    remoteEmpty: rows.length === 0,
  };
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

/** @param {string} userId @param {{ skipPrune?: boolean }} [options] */
export async function initialScheduleSync(userId, options = {}) {
  if (!canSync(userId)) return { ok: false, reason: 'skip' };
  const pull = await syncSchedulesFromCloud(userId, options);
  const push = await pushUnsyncedSchedulesToCloud(userId);
  return { ok: true, pulled: pull.count ?? 0, pushed: push.pushed ?? 0, remoteEmpty: !!pull.remoteEmpty };
}
