/**
 * 멀티 계정(대표↔직원) 공유 pull 시 local_id 충돌을 피하고
 * (ownerId, remoteLocalId) → Dexie id 매핑을 유지합니다.
 */

/** @type {{ properties: Map<string, number>, customers: Map<string, number>, schedules: Map<string, number>, call_logs: Map<string, number> }} */
const ID_MAPS = {
  properties: new Map(),
  customers: new Map(),
  schedules: new Map(),
  call_logs: new Map(),
};

export function resetCloudLocalIdMaps() {
  for (const map of Object.values(ID_MAPS)) map.clear();
}

/** @param {keyof typeof ID_MAPS} resource @param {string} ownerId @param {number|string|null|undefined} remoteLocalId @param {number} dexieId */
export function rememberCloudLocalId(resource, ownerId, remoteLocalId, dexieId) {
  if (remoteLocalId == null || remoteLocalId === '' || !ownerId || dexieId == null) return;
  ID_MAPS[resource].set(`${ownerId}:${remoteLocalId}`, dexieId);
}

/**
 * @param {keyof typeof ID_MAPS} resource
 * @param {string} ownerId
 * @param {number|string|null|undefined} remoteLocalId
 * @returns {number|null}
 */
export function resolveCloudLocalId(resource, ownerId, remoteLocalId) {
  if (remoteLocalId == null || remoteLocalId === '') return null;
  const hit = ID_MAPS[resource].get(`${ownerId}:${remoteLocalId}`);
  return hit != null ? hit : null;
}

/**
 * @param {import('dexie').Table} table
 * @param {{
 *   sessionUserId: string,
 *   cloudRow: { id?: string, user_id?: string, local_id?: number|null },
 *   record: Record<string, unknown>,
 *   mergeExisting?: (existing: Record<string, unknown>, incoming: Record<string, unknown>) => Record<string, unknown>,
 *   resource: keyof typeof ID_MAPS,
 * }} opts
 * @returns {Promise<number>}
 */
export async function upsertSharedCloudRecord(table, opts) {
  const {
    sessionUserId,
    cloudRow,
    record,
    mergeExisting,
    resource,
  } = opts;

  const cloudId = cloudRow.id || null;
  const ownerId = cloudRow.user_id || record.ownerId || sessionUserId;
  const remoteLocalId = cloudRow.local_id ?? null;

  /** @type {Record<string, unknown>} */
  const incoming = {
    ...record,
    cloudId,
    cloudLocalId: remoteLocalId,
    ownerId,
  };

  let existing = null;
  if (cloudId) {
    existing = await table.where('cloudId').equals(cloudId).first();
  }

  if (existing) {
    const merged = mergeExisting
      ? mergeExisting(existing, incoming)
      : { ...existing, ...incoming };
    const localId = existing.id;
    await table.put({ ...merged, id: localId, cloudId, cloudLocalId: remoteLocalId, ownerId });
    rememberCloudLocalId(resource, ownerId, remoteLocalId, localId);
    return localId;
  }

  // 본인 데이터: 가능하면 기존 cloud local_id 유지 (단일 계정 UX)
  if (ownerId === sessionUserId && remoteLocalId != null) {
    const at = await table.get(remoteLocalId);
    if (!at) {
      await table.put({ ...incoming, id: remoteLocalId });
      rememberCloudLocalId(resource, ownerId, remoteLocalId, remoteLocalId);
      return remoteLocalId;
    }
    if (at.cloudId === cloudId || (!at.cloudId && at.ownerId === sessionUserId)) {
      const merged = mergeExisting ? mergeExisting(at, incoming) : { ...at, ...incoming };
      await table.put({ ...merged, id: at.id, cloudId, cloudLocalId: remoteLocalId, ownerId });
      rememberCloudLocalId(resource, ownerId, remoteLocalId, at.id);
      return at.id;
    }
  }

  const { id: _omit, ...rest } = incoming;
  const newId = await table.add(rest);
  rememberCloudLocalId(resource, ownerId, remoteLocalId, newId);
  return newId;
}

/**
 * 대량 pull용 — cloudId/local_id 조회를 묶고 bulkPut
 * @param {import('dexie').Table} table
 * @param {Array<{
 *   sessionUserId: string,
 *   cloudRow: { id?: string|number, user_id?: string, local_id?: number|null },
 *   record: Record<string, unknown>,
 *   mergeExisting?: (existing: Record<string, unknown>, incoming: Record<string, unknown>) => Record<string, unknown>,
 * }>} items
 * @param {keyof typeof ID_MAPS} resource
 */
export async function bulkUpsertSharedCloudRecords(table, items, resource) {
  if (!items?.length) return;

  const cloudIds = [...new Set(
    items.map((it) => it.cloudRow?.id).filter((id) => id != null && id !== '').map(String),
  )];
  const existingByCloud = new Map();
  if (cloudIds.length) {
    const found = await table.where('cloudId').anyOf(cloudIds).toArray();
    for (const row of found) {
      if (row.cloudId != null) existingByCloud.set(String(row.cloudId), row);
    }
  }

  const preferredLocalIds = [...new Set(
    items
      .map((it) => {
        const ownerId = it.cloudRow.user_id || it.record.ownerId || it.sessionUserId;
        if (ownerId !== it.sessionUserId) return null;
        return it.cloudRow.local_id ?? null;
      })
      .filter((id) => id != null),
  )];
  const existingByLocal = new Map();
  if (preferredLocalIds.length) {
    const locals = await table.bulkGet(preferredLocalIds);
    preferredLocalIds.forEach((id, idx) => {
      if (locals[idx]) existingByLocal.set(id, locals[idx]);
    });
  }

  /** @type {Record<string, unknown>[]} */
  const toPut = [];
  /** @type {Array<{ sessionUserId: string, cloudRow: any, record: Record<string, unknown>, mergeExisting?: Function }>} */
  const fallback = [];

  for (const it of items) {
    const cloudId = it.cloudRow.id || null;
    const ownerId = it.cloudRow.user_id || it.record.ownerId || it.sessionUserId;
    const remoteLocalId = it.cloudRow.local_id ?? null;
    /** @type {Record<string, unknown>} */
    const incoming = {
      ...it.record,
      cloudId,
      cloudLocalId: remoteLocalId,
      ownerId,
    };

    const existing = cloudId != null ? existingByCloud.get(String(cloudId)) : null;
    if (existing) {
      const merged = it.mergeExisting
        ? it.mergeExisting(existing, incoming)
        : { ...existing, ...incoming };
      const localId = existing.id;
      toPut.push({ ...merged, id: localId, cloudId, cloudLocalId: remoteLocalId, ownerId });
      rememberCloudLocalId(resource, ownerId, remoteLocalId, localId);
      continue;
    }

    if (ownerId === it.sessionUserId && remoteLocalId != null) {
      const at = existingByLocal.get(remoteLocalId);
      if (!at) {
        toPut.push({ ...incoming, id: remoteLocalId });
        rememberCloudLocalId(resource, ownerId, remoteLocalId, remoteLocalId);
        existingByLocal.set(remoteLocalId, { id: remoteLocalId, cloudId });
        continue;
      }
      if (at.cloudId === cloudId || (!at.cloudId && at.ownerId === it.sessionUserId)) {
        const merged = it.mergeExisting ? it.mergeExisting(at, incoming) : { ...at, ...incoming };
        toPut.push({ ...merged, id: at.id, cloudId, cloudLocalId: remoteLocalId, ownerId });
        rememberCloudLocalId(resource, ownerId, remoteLocalId, at.id);
        continue;
      }
    }

    fallback.push(it);
  }

  const CHUNK = 250;
  for (let i = 0; i < toPut.length; i += CHUNK) {
    await table.bulkPut(toPut.slice(i, i + CHUNK));
  }
  for (const it of fallback) {
    await upsertSharedCloudRecord(table, { ...it, resource });
  }
}

/**
 * @param {keyof typeof ID_MAPS} resource
 * @param {string} ownerId
 * @param {number|string|null|undefined} remoteLocalId
 */
export function remapFk(resource, ownerId, remoteLocalId) {
  if (remoteLocalId == null || remoteLocalId === '') return null;
  const mapped = resolveCloudLocalId(resource, ownerId, remoteLocalId);
  return mapped != null ? mapped : remoteLocalId;
}

/**
 * 전체 pull 이후 FK를 한 번 더 리맵 (일정↔통화 교차 참조 순서 문제 해소)
 * @param {{ schedules: import('dexie').Table, call_logs: import('dexie').Table }} tables
 */
export async function remapSharedForeignKeys(tables) {
  const schedules = await tables.schedules.toArray();
  for (const s of schedules) {
    const ownerId = s.ownerId;
    if (!ownerId) continue;
    const remotePid = s.cloudPid ?? null;
    const remoteCallId = s.cloudCallId ?? null;
    /** @type {Record<string, unknown>} */
    const patch = {};
    if (remotePid != null) {
      const pid = remapFk('properties', ownerId, remotePid);
      if (pid !== s.pid) patch.pid = pid;
    }
    if (remoteCallId != null) {
      const callId = remapFk('call_logs', ownerId, remoteCallId);
      if (callId !== s.callId) patch.callId = callId;
    }
    if (Object.keys(patch).length) await tables.schedules.update(s.id, patch);
  }

  const calls = await tables.call_logs.toArray();
  for (const c of calls) {
    const ownerId = c.ownerId;
    if (!ownerId) continue;
    const remotePid = c.cloudPid ?? null;
    const remoteCid = c.cloudCid ?? null;
    const remoteSchedId = c.cloudSchedId ?? null;
    /** @type {Record<string, unknown>} */
    const patch = {};
    if (remotePid != null) {
      const pid = remapFk('properties', ownerId, remotePid);
      if (pid !== c.pid) patch.pid = pid;
    }
    if (remoteCid != null) {
      const cid = remapFk('customers', ownerId, remoteCid);
      if (cid !== c.cid) patch.cid = cid;
    }
    if (remoteSchedId != null) {
      const schedId = remapFk('schedules', ownerId, remoteSchedId);
      if (schedId !== c.schedId) patch.schedId = schedId;
    }
    if (Object.keys(patch).length) await tables.call_logs.update(c.id, patch);
  }
}
