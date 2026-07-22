/**
 * ICS/Google 일정 정본 저장소
 *
 * 불변식 (이 모듈 밖에서는 ICS 행을 add/soft-delete 하지 말 것):
 * 1. occurrenceKey = icsUid|date|HH:mm 당 활성 로컬 행은 정확히 0 또는 1개
 * 2. ICS는 soft-delete 금지 — 중복·사용자 삭제는 hard-delete만
 * 3. import / cloud pull / repair 는 이 모듈의 upsert·enforce만 사용
 * 4. 클라우드 soft-delete ICS는 로컬 휴지통에 넣지 않고 클라우드에서 제거
 * 5. 앱에서 삭제한 icsUid는 deletedIcsUids 블랙리스트에 넣어 pull/import 시 skip
 * 6. 모든 ICS 쓰기는 전역 큐로 직렬화 — 모바일 로그인·pull·import 레이스로 중복 add 방지
 * 7. add 직전 DB 재조회로 stale index 레이스 차단
 */
import { db, isActive } from '../../db.js';
import { DEV_LOCAL_OWNER, getActiveOwnerId, matchesOwner, withOwnerId } from './ownerScope.js';
import {
  extractIcsUid,
  isDeletedIcsUid,
  rememberDeletedIcsUidFromSchedule,
  clearDeletedIcsUids,
} from './deletedIcsUids.js';

export { clearDeletedIcsUids, rememberDeletedIcsUidFromSchedule, isDeletedIcsUid, extractIcsUid };

const ORPHAN_OWNER_IDS = new Set(['', 'null', 'undefined', DEV_LOCAL_OWNER]);

/** @type {Promise<unknown>} */
let icsWriteChain = Promise.resolve();

/**
 * ICS 쓰기 전역 직렬화 (동시 import/pull/repair 중복 add 방지)
 * @template T
 * @param {() => Promise<T>} task
 * @returns {Promise<T>}
 */
export function runIcsWriteExclusive(task) {
  const run = icsWriteChain.then(task, task);
  icsWriteChain = run.then(() => undefined, () => undefined);
  return run;
}

/** @param {unknown} time */
export function normalizeScheduleTime(time) {
  const t = String(time || '').trim();
  if (!t) return '';
  const m = t.match(/^(\d{1,2}):(\d{2})/);
  if (!m) return t;
  return `${String(m[1]).padStart(2, '0')}:${m[2]}`;
}

/** @param {string} uid @param {string} date @param {string} time */
export function makeIcsOccurrenceKey(uid, date, time) {
  return `${String(uid || '').trim()}|${date || ''}|${normalizeScheduleTime(time)}`;
}

/** @param {string} sourceId @param {string} uid @param {string} date @param {string} time */
export function makeIcsKey(sourceId, uid, date, time) {
  void sourceId;
  return makeIcsOccurrenceKey(uid, date, time);
}

/**
 * @param {Record<string, unknown>|null|undefined} s
 * @returns {string|null}
 */
export function occurrenceKeyFromSchedule(s) {
  if (!s) return null;
  const uid = String(s.icsUid || '').trim();
  if (uid && s.date) return makeIcsOccurrenceKey(uid, /** @type {string} */ (s.date), /** @type {string} */ (s.time || ''));
  const key = String(s.icsKey || '').trim();
  if (!key) return null;
  const parts = key.split('|');
  if (parts.length >= 3 && !uid) {
    if (parts.length === 3) {
      return makeIcsOccurrenceKey(parts[0], parts[1], parts[2]);
    }
    if (parts.length >= 4) {
      const time = parts[parts.length - 1];
      const date = parts[parts.length - 2];
      const legacyUid = parts.slice(1, -2).join('|');
      return makeIcsOccurrenceKey(legacyUid, date, time);
    }
  }
  if (parts.length === 3) {
    return makeIcsOccurrenceKey(parts[0], parts[1], parts[2]);
  }
  return key;
}

/** @param {Record<string, unknown>|null|undefined} s */
export function isIcsLinkedSchedule(s) {
  return !!(s?.icsUid || s?.icsKey || s?.icsSourceId);
}

/** @param {unknown} ownerId */
function isOrphanOwnerId(ownerId) {
  if (ownerId == null) return true;
  return ORPHAN_OWNER_IDS.has(String(ownerId));
}

/**
 * @param {object|null|undefined} prev
 * @param {object} next
 */
function preferActiveRow(prev, next) {
  if (!prev) return next;
  if (isActive(prev) && !isActive(next)) return prev;
  if (!isActive(prev) && isActive(next)) return next;
  return prev;
}

/**
 * add 직전 stale index 방어 — DB에서 동일 occurrence 활성 행 재조회
 * @param {string} occ
 * @param {string} [ownerId]
 */
async function findActiveIcsByOccurrence(occ, ownerId = getActiveOwnerId()) {
  if (!occ) return null;
  const rows = await db.schedules.toArray();
  /** @type {object|null} */
  let best = null;
  for (const s of rows) {
    if (!isActive(s) || !isIcsLinkedSchedule(s)) continue;
    if (occurrenceKeyFromSchedule(s) !== occ) continue;
    if (
      ownerId
      && !matchesOwner(s, ownerId)
      && !isOrphanOwnerId(s.ownerId)
    ) continue;
    best = preferActiveRow(best, s);
  }
  return best;
}

/**
 * @param {string} [ownerId]
 * @returns {Promise<{ byOcc: Map<string, object>, byCloudId: Map<string, object> }>}
 */
export async function loadIcsIndex(ownerId = getActiveOwnerId()) {
  const rows = (await db.schedules.toArray()).filter((s) => (
    isIcsLinkedSchedule(s)
    && (
      !ownerId
      || matchesOwner(s, ownerId)
      || isOrphanOwnerId(s.ownerId)
    )
  ));
  /** @type {Map<string, object>} */
  const byOcc = new Map();
  /** @type {Map<string, object>} */
  const byCloudId = new Map();
  for (const s of rows) {
    const occ = occurrenceKeyFromSchedule(s);
    if (occ) byOcc.set(occ, preferActiveRow(byOcc.get(occ), s));
    if (s.cloudId) byCloudId.set(String(s.cloudId), preferActiveRow(byCloudId.get(String(s.cloudId)), s));
  }
  return { byOcc, byCloudId };
}

/**
 * 중복 ICS 행을 로컬·클라우드에서 영구 제거 (휴지통 금지)
 * @param {object} sched
 * @param {string|null|undefined} winnerCloudId
 */
export async function hardRemoveIcsDuplicate(sched, winnerCloudId) {
  if (!sched?.id) return;
  const loserCloud = sched.cloudId ? String(sched.cloudId) : '';
  const winnerCloud = winnerCloudId ? String(winnerCloudId) : '';
  if (loserCloud && winnerCloud && loserCloud !== winnerCloud) {
    try {
      const { deleteScheduleFromCloud } = await import('./scheduleSync.js');
      await deleteScheduleFromCloud(sched.id);
    } catch (err) {
      console.warn('[icsScheduleStore] hard remove cloud duplicate', sched.id, err);
      try {
        const { isSupabaseConfigured, supabase } = await import('../../lib/supabase.js');
        if (isSupabaseConfigured && loserCloud) {
          await supabase.from('schedules').delete().eq('id', loserCloud);
        }
      } catch { /* ignore */ }
    }
  }
  await db.schedules.delete(sched.id);
}

/**
 * 클라우드 ICS soft-delete/중복 행 영구 제거
 * @param {string} cloudId
 * @param {string} userId
 */
export async function purgeIcsCloudRow(cloudId, userId) {
  if (!cloudId) return;
  const { isSupabaseConfigured, supabase } = await import('../../lib/supabase.js');
  if (!isSupabaseConfigured) return;
  const { rememberPurgedCloudId } = await import('./purgedCloudIds.js');
  const { error } = await supabase.from('schedules').delete().eq('id', cloudId);
  if (error) {
    console.warn('[icsScheduleStore] purge cloud row', cloudId, error);
    return;
  }
  rememberPurgedCloudId('schedules', cloudId, userId);
}

/**
 * @param {Record<string, unknown>} fields
 * @param {{
 *   ownerId?: string,
 *   validSourceIds?: Set<string>,
 *   index?: { byOcc: Map<string, object>, byCloudId: Map<string, object> },
 * }} [options]
 */
async function upsertIcsOccurrenceUnlocked(fields, options = {}) {
  const ownerId = options.ownerId || getActiveOwnerId();
  const validSourceIds = options.validSourceIds;
  const index = options.index || await loadIcsIndex(ownerId);

  const base = withOwnerId({ ...fields, deletedAt: null, ownerId });
  const occ = occurrenceKeyFromSchedule(base);
  if (occ) {
    base.icsKey = occ;
    if (!base.icsUid) {
      const uid = String(occ).split('|')[0];
      if (uid) base.icsUid = uid;
    }
  }
  if (base.time != null) base.time = normalizeScheduleTime(base.time) || base.time;

  const uid = extractIcsUid(base);
  if (uid && isDeletedIcsUid(uid, ownerId)) {
    /** @type {object|null} */
    let blocked = null;
    if (occ && index.byOcc.has(occ)) blocked = index.byOcc.get(occ);
    if (!blocked && base.cloudId && index.byCloudId.has(String(base.cloudId))) {
      blocked = index.byCloudId.get(String(base.cloudId));
    }
    if (blocked?.id) {
      await hardRemoveIcsDuplicate(blocked, null);
      if (occ) index.byOcc.delete(occ);
      if (blocked.cloudId) index.byCloudId.delete(String(blocked.cloudId));
    }
    return { action: 'skipped', id: blocked?.id ?? 0, row: blocked || base };
  }

  /** @type {object|null} */
  let ex = null;
  if (occ && index.byOcc.has(occ)) ex = index.byOcc.get(occ);
  if (!ex && base.cloudId && index.byCloudId.has(String(base.cloudId))) {
    ex = index.byCloudId.get(String(base.cloudId));
  }

  // stale in-memory index 레이스 방어: add 직전 DB 재조회
  if (!ex && occ) {
    const fresh = await findActiveIcsByOccurrence(occ, ownerId);
    if (fresh) {
      ex = fresh;
      index.byOcc.set(occ, fresh);
      if (fresh.cloudId) index.byCloudId.set(String(fresh.cloudId), fresh);
    }
  }

  if (ex) {
    /** @type {Record<string, unknown>} */
    const patch = { deletedAt: null };
    if (ex.ownerId !== ownerId) patch.ownerId = ownerId;
    if (base.title != null && ex.title !== base.title) patch.title = base.title;
    if (base.memo != null && (ex.memo || '') !== (base.memo || '')) patch.memo = base.memo;
    if (base.time != null && normalizeScheduleTime(ex.time) !== normalizeScheduleTime(base.time)) {
      patch.time = base.time;
    }
    if (base.date != null && ex.date !== base.date) patch.date = base.date;
    if ((ex.dateEnd || '') !== (base.dateEnd || '')) patch.dateEnd = base.dateEnd || null;
    if (base.pri != null && ex.pri !== base.pri) patch.pri = base.pri;
    if (occ && ex.icsKey !== occ) patch.icsKey = occ;
    if (!ex.icsUid && base.icsUid) patch.icsUid = base.icsUid;
    if (base.cloudId && (!ex.cloudId || String(ex.cloudId) !== String(base.cloudId))) {
      if (!ex.cloudId) {
        patch.cloudId = base.cloudId;
        if (base.cloudLocalId != null) patch.cloudLocalId = base.cloudLocalId;
      }
    }
    if (base.cloudLocalId != null && ex.cloudLocalId == null && patch.cloudId) {
      patch.cloudLocalId = base.cloudLocalId;
    }

    const exSrc = ex.icsSourceId ? String(ex.icsSourceId) : '';
    const rowSrc = base.icsSourceId ? String(base.icsSourceId) : '';
    if (exSrc && validSourceIds?.has(exSrc)) {
      /* keep stable color key */
    } else if (rowSrc && exSrc !== rowSrc) {
      patch.icsSourceId = rowSrc;
    } else if (!exSrc && rowSrc) {
      patch.icsSourceId = rowSrc;
    }

    const keys = Object.keys(patch);
    if (keys.length === 1 && keys[0] === 'deletedAt' && isActive(ex)) {
      return { action: 'skipped', id: ex.id, row: ex };
    }
    await db.schedules.update(ex.id, patch);
    const next = { ...ex, ...patch };
    if (occ) index.byOcc.set(occ, next);
    if (next.cloudId) index.byCloudId.set(String(next.cloudId), next);
    return { action: 'updated', id: ex.id, row: next };
  }

  const id = await db.schedules.add(base);
  const saved = { ...base, id };
  if (occ) index.byOcc.set(occ, saved);
  if (saved.cloudId) index.byCloudId.set(String(saved.cloudId), saved);
  return { action: 'added', id, row: saved };
}

/**
 * ICS 일정 upsert — 동일 occurrence면 갱신만, 새 행은 키가 없을 때만.
 * @param {Record<string, unknown>} fields
 * @param {{
 *   ownerId?: string,
 *   validSourceIds?: Set<string>,
 *   index?: { byOcc: Map<string, object>, byCloudId: Map<string, object> },
 *   _locked?: boolean,
 * }} [options]
 */
export async function upsertIcsOccurrence(fields, options = {}) {
  if (options._locked) return upsertIcsOccurrenceUnlocked(fields, options);
  return runIcsWriteExclusive(() => upsertIcsOccurrenceUnlocked(fields, options));
}

/**
 * @param {string} [preferredOwnerId]
 * @returns {Promise<{ collapsed: number }>}
 */
async function enforceIcsUniquenessUnlocked(preferredOwnerId = getActiveOwnerId()) {
  const all = (await db.schedules.toArray()).filter(
    (s) => isActive(s) && isIcsLinkedSchedule(s),
  );
  /** @type {Map<string, object[]>} */
  const groups = new Map();
  for (const s of all) {
    const k = occurrenceKeyFromSchedule(s);
    if (!k) continue;
    if (!groups.has(k)) groups.set(k, []);
    groups.get(k).push(s);
  }

  let collapsed = 0;
  for (const rows of groups.values()) {
    if (rows.length < 2) continue;
    rows.sort((a, b) => {
      const score = (s) => {
        let n = 0;
        if (s.ownerId === preferredOwnerId) n += 8;
        if (s.cloudId) n += 4;
        if (s.icsSourceId) n += 2;
        return n;
      };
      const d = score(b) - score(a);
      if (d !== 0) return d;
      return (a.id ?? 0) - (b.id ?? 0);
    });
    const winner = { ...rows[0] };
    /** @type {Record<string, unknown>} */
    const patch = { deletedAt: null };
    if (preferredOwnerId && winner.ownerId !== preferredOwnerId) patch.ownerId = preferredOwnerId;
    const occ = occurrenceKeyFromSchedule(winner);
    if (occ && winner.icsKey !== occ) patch.icsKey = occ;
    if (!winner.icsUid && occ) {
      const uid = String(occ).split('|')[0];
      if (uid) patch.icsUid = uid;
    }
    if (winner.time != null) {
      const nt = normalizeScheduleTime(winner.time);
      if (nt && nt !== winner.time) patch.time = nt;
    }
    for (const loser of rows.slice(1)) {
      if (!winner.cloudId && loser.cloudId) {
        patch.cloudId = loser.cloudId;
        if (loser.cloudLocalId != null) patch.cloudLocalId = loser.cloudLocalId;
        winner.cloudId = loser.cloudId;
      }
      if (!winner.icsSourceId && loser.icsSourceId) {
        patch.icsSourceId = loser.icsSourceId;
        winner.icsSourceId = loser.icsSourceId;
      }
    }
    await db.schedules.update(winner.id, patch);
    for (const loser of rows.slice(1)) {
      await hardRemoveIcsDuplicate(loser, winner.cloudId);
      collapsed += 1;
    }
  }
  return { collapsed };
}

/**
 * 동일 occurrence 활성 중복을 1행으로 합침 (loser hard-delete only)
 * @param {string} [preferredOwnerId]
 * @param {{ _locked?: boolean }} [options]
 */
export async function enforceIcsUniqueness(preferredOwnerId = getActiveOwnerId(), options = {}) {
  if (options._locked) return enforceIcsUniquenessUnlocked(preferredOwnerId);
  return runIcsWriteExclusive(() => enforceIcsUniquenessUnlocked(preferredOwnerId));
}

/**
 * syncUserId 지연으로 생긴 orphan(dev-local/빈 owner) ICS를
 * 현재 계정으로 귀속하거나, 이미 있으면 합쳐 제거. 맹삭제 금지.
 * @param {string} [preferredOwnerId]
 * @returns {Promise<{ adopted: number, merged: number, dropped: number }>}
 */
async function reconcileOrphanIcsSchedulesUnlocked(preferredOwnerId = getActiveOwnerId()) {
  if (!preferredOwnerId || preferredOwnerId === DEV_LOCAL_OWNER) {
    return { adopted: 0, merged: 0, dropped: 0 };
  }

  const all = await db.schedules.toArray();
  const orphans = all.filter((s) => isIcsLinkedSchedule(s) && isOrphanOwnerId(s.ownerId));
  /** @type {Map<string, object>} */
  const ownedByOcc = new Map();
  for (const s of all) {
    if (!isActive(s) || !isIcsLinkedSchedule(s) || !matchesOwner(s, preferredOwnerId)) continue;
    const k = occurrenceKeyFromSchedule(s);
    if (k) ownedByOcc.set(k, preferActiveRow(ownedByOcc.get(k), s));
  }

  let adopted = 0;
  let merged = 0;
  let dropped = 0;

  for (const orphan of orphans) {
    const k = occurrenceKeyFromSchedule(orphan);
    const winner = k ? ownedByOcc.get(k) : null;

    if (winner && winner.id !== orphan.id) {
      /** @type {Record<string, unknown>} */
      const patch = {};
      if (!winner.cloudId && orphan.cloudId) {
        patch.cloudId = orphan.cloudId;
        if (orphan.cloudLocalId != null) patch.cloudLocalId = orphan.cloudLocalId;
      }
      if (!winner.icsSourceId && orphan.icsSourceId) patch.icsSourceId = orphan.icsSourceId;
      if (!winner.icsUid && orphan.icsUid) patch.icsUid = orphan.icsUid;
      if (k && winner.icsKey !== k) patch.icsKey = k;
      if (Object.keys(patch).length) {
        await db.schedules.update(winner.id, patch);
        Object.assign(winner, patch);
        if (k) ownedByOcc.set(k, winner);
      }
      await hardRemoveIcsDuplicate(orphan, winner.cloudId);
      merged += 1;
      continue;
    }

    if (!isActive(orphan)) {
      // soft-delete orphan: 복구 금지 — 제거만 (이후 Google sync가 필요 시 1건으로 재유입)
      await db.schedules.delete(orphan.id);
      dropped += 1;
      continue;
    }

    const nt = normalizeScheduleTime(orphan.time) || orphan.time;
    await db.schedules.update(orphan.id, {
      ownerId: preferredOwnerId,
      deletedAt: null,
      icsKey: k || orphan.icsKey,
      time: nt,
      ...(orphan.icsUid ? {} : (k ? { icsUid: String(k).split('|')[0] } : {})),
    });
    const next = {
      ...orphan,
      ownerId: preferredOwnerId,
      deletedAt: null,
      icsKey: k || orphan.icsKey,
      time: nt,
    };
    if (k) ownedByOcc.set(k, next);
    adopted += 1;
  }

  return { adopted, merged, dropped };
}

/**
 * 레거시 soft-delete ICS 정리 + orphan 귀속 + 유일성 강제.
 * soft-delete ICS는 절대 복구하지 않음 (복구가 중복의 주원인).
 * @param {string} [preferredOwnerId]
 * @returns {Promise<{ revived: number, purged: number, collapsed: number, adopted: number, merged: number, dropped: number }>}
 */
export async function repairIcsScheduleIntegrity(preferredOwnerId = getActiveOwnerId()) {
  return runIcsWriteExclusive(async () => {
    const orphanStats = await reconcileOrphanIcsSchedulesUnlocked(preferredOwnerId);

    const all = await db.schedules.toArray();
    /** @type {Map<string, object>} */
    const activeByOcc = new Map();
    for (const s of all) {
      if (!isActive(s) || !isIcsLinkedSchedule(s)) continue;
      const k = occurrenceKeyFromSchedule(s);
      if (k && !activeByOcc.has(k)) activeByOcc.set(k, s);
      if (k && s.icsKey !== k) {
        await db.schedules.update(s.id, { icsKey: k, time: normalizeScheduleTime(s.time) || s.time });
      }
    }

    let purged = 0;
    for (const s of all) {
      if (isActive(s) || !isIcsLinkedSchedule(s)) continue;
      const k = occurrenceKeyFromSchedule(s);
      const active = k ? activeByOcc.get(k) : null;
      // soft-delete ICS: 복구 금지. 활성 쌍 없으면 UID 블랙리스트로 재유입도 차단
      if (!active) {
        try {
          rememberDeletedIcsUidFromSchedule(s, preferredOwnerId);
        } catch { /* ignore */ }
      }
      await hardRemoveIcsDuplicate(s, active?.cloudId ?? null);
      purged += 1;
    }

    const { collapsed } = await enforceIcsUniquenessUnlocked(preferredOwnerId);
    return {
      revived: 0,
      purged,
      collapsed,
      adopted: orphanStats.adopted,
      merged: orphanStats.merged,
      dropped: orphanStats.dropped,
    };
  });
}

/**
 * orphan ICS만 귀속/합치기 (로그인·달력 진입용)
 * @param {string} [preferredOwnerId]
 */
export async function reconcileOrphanIcsSchedules(preferredOwnerId = getActiveOwnerId()) {
  return runIcsWriteExclusive(async () => {
    const stats = await reconcileOrphanIcsSchedulesUnlocked(preferredOwnerId);
    const { collapsed } = await enforceIcsUniquenessUnlocked(preferredOwnerId);
    return { ...stats, collapsed };
  });
}

/**
 * 클라우드에서 받은 ICS 행 1건을 로컬 정본에 반영.
 * @param {Record<string, unknown>} sched
 * @param {{ id: string, local_id?: number|string|null }} cloudRow
 * @param {string} userId
 * @param {{ byOcc: Map<string, object>, byCloudId: Map<string, object> }} index
 * @returns {Promise<'applied'|'skipped'|'purged'>}
 */
export async function applyCloudIcsSchedule(sched, cloudRow, userId, index) {
  if (!isIcsLinkedSchedule(sched)) return 'skipped';

  const blockedUid = extractIcsUid(sched);
  if (blockedUid && isDeletedIcsUid(blockedUid, userId)) {
    const occ = occurrenceKeyFromSchedule(sched);
    const local = (occ && index.byOcc.get(occ))
      || (cloudRow.id && index.byCloudId.get(String(cloudRow.id)))
      || null;
    if (local?.id) {
      await hardRemoveIcsDuplicate(local, null);
      if (occ) index.byOcc.delete(occ);
      if (local.cloudId) index.byCloudId.delete(String(local.cloudId));
    }
    if (cloudRow.id) await purgeIcsCloudRow(cloudRow.id, userId);
    return 'skipped';
  }

  if (sched.deletedAt) {
    const occ = occurrenceKeyFromSchedule(sched);
    const local = (occ && index.byOcc.get(occ))
      || (cloudRow.id && index.byCloudId.get(String(cloudRow.id)))
      || null;
    if (local && isActive(local) && cloudRow.id && String(local.cloudId || '') !== String(cloudRow.id)) {
      await purgeIcsCloudRow(cloudRow.id, userId);
    } else if (cloudRow.id) {
      await purgeIcsCloudRow(cloudRow.id, userId);
      if (local && !isActive(local) && String(local.cloudId || '') === String(cloudRow.id)) {
        await db.schedules.delete(local.id);
      }
    }
    return 'purged';
  }

  const occ = occurrenceKeyFromSchedule(sched);
  const local = (occ && index.byOcc.get(occ))
    || (cloudRow.id && index.byCloudId.get(String(cloudRow.id)))
    || null;

  if (local?.cloudId && cloudRow.id && String(local.cloudId) !== String(cloudRow.id)) {
    await purgeIcsCloudRow(cloudRow.id, userId);
    await upsertIcsOccurrenceUnlocked({
      ...sched,
      cloudId: local.cloudId,
      cloudLocalId: local.cloudLocalId,
      deletedAt: null,
    }, { ownerId: userId, index });
    return 'purged';
  }

  await upsertIcsOccurrenceUnlocked({
    ...sched,
    cloudId: cloudRow.id || local?.cloudId || null,
    cloudLocalId: cloudRow.local_id ?? sched.cloudLocalId ?? local?.cloudLocalId ?? null,
    deletedAt: null,
  }, { ownerId: userId, index });
  return 'applied';
}
