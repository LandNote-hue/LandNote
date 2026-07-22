/**
 * ICS/Google 일정 정본 저장소
 *
 * 불변식 (이 모듈 밖에서는 ICS 행을 add/soft-delete 하지 말 것):
 * 1. occurrenceKey = icsUid|date|HH:mm 당 활성 로컬 행은 정확히 0 또는 1개
 * 2. ICS는 soft-delete 금지 — 중복·사용자 삭제는 hard-delete만
 * 3. import / cloud pull / repair 는 이 모듈의 upsert·enforce만 사용
 * 4. 클라우드 soft-delete ICS는 로컬 휴지통에 넣지 않고 클라우드에서 제거
 * 5. 앱에서 삭제한 icsUid는 deletedIcsUids 블랙리스트에 넣어 pull/import 시 skip
 */
import { db, isActive } from '../../db.js';
import { getActiveOwnerId, matchesOwner, withOwnerId } from './ownerScope.js';
import {
  extractIcsUid,
  isDeletedIcsUid,
  rememberDeletedIcsUidFromSchedule,
  clearDeletedIcsUids,
} from './deletedIcsUids.js';

export { clearDeletedIcsUids, rememberDeletedIcsUidFromSchedule, isDeletedIcsUid, extractIcsUid };

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
 * @param {string} [ownerId]
 * @returns {Promise<{ byOcc: Map<string, object>, byCloudId: Map<string, object> }>}
 */
export async function loadIcsIndex(ownerId = getActiveOwnerId()) {
  const rows = (await db.schedules.toArray()).filter((s) => (
    isIcsLinkedSchedule(s)
    && (
      !ownerId
      || matchesOwner(s, ownerId)
      || s.ownerId === 'dev-local'
      || s.ownerId == null
      || s.ownerId === ''
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
 * ICS 일정 upsert — 동일 occurrence면 갱신만, 새 행은 키가 없을 때만.
 * @param {Record<string, unknown>} fields  (deletedAt는 무시하고 항상 활성으로 저장)
 * @param {{
 *   ownerId?: string,
 *   validSourceIds?: Set<string>,
 *   index?: { byOcc: Map<string, object>, byCloudId: Map<string, object> },
 * }} [options]
 * @returns {Promise<{ action: 'added'|'updated'|'skipped', id: number, row: object }>}
 */
export async function upsertIcsOccurrence(fields, options = {}) {
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

  // 앱에서 삭제한 UID → 구글/ICS pull·import 시 되살리지 않음
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
      // 로컬에 다른 cloudId가 있으면 새 cloudId로 덮지 않음(중복 클라우드 정리는 pull에서)
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
 * 동일 occurrence 활성 중복을 1행으로 합침 (loser hard-delete only)
 * @param {string} [preferredOwnerId]
 * @returns {Promise<{ collapsed: number }>}
 */
export async function enforceIcsUniqueness(preferredOwnerId = getActiveOwnerId()) {
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
 * 레거시 soft-delete ICS 정리 + 유일성 강제.
 * @param {string} [preferredOwnerId]
 * @returns {Promise<{ revived: number, purged: number, collapsed: number }>}
 */
export async function repairIcsScheduleIntegrity(preferredOwnerId = getActiveOwnerId()) {
  const all = await db.schedules.toArray();
  /** @type {Map<string, object>} */
  const activeByOcc = new Map();
  for (const s of all) {
    if (!isActive(s) || !isIcsLinkedSchedule(s)) continue;
    const k = occurrenceKeyFromSchedule(s);
    if (k && !activeByOcc.has(k)) activeByOcc.set(k, s);
    // 키 정규화
    if (k && s.icsKey !== k) {
      await db.schedules.update(s.id, { icsKey: k, time: normalizeScheduleTime(s.time) || s.time });
    }
  }

  let revived = 0;
  let purged = 0;
  for (const s of all) {
    if (isActive(s) || !isIcsLinkedSchedule(s)) continue;
    const k = occurrenceKeyFromSchedule(s);
    const active = k ? activeByOcc.get(k) : null;
    if (active) {
      await hardRemoveIcsDuplicate(s, active.cloudId);
      purged += 1;
      continue;
    }
    // 활성 쌍둥이 없음 = 과거 잘못 숨긴 일정 → 복구 (한 번만, 이후 soft-delete ICS 경로 없음)
    await db.schedules.update(s.id, {
      deletedAt: null,
      icsKey: k || s.icsKey,
      time: normalizeScheduleTime(s.time) || s.time,
    });
    if (k) activeByOcc.set(k, { ...s, deletedAt: null });
    revived += 1;
  }

  const { collapsed } = await enforceIcsUniqueness(preferredOwnerId);
  return { revived, purged, collapsed };
}

/**
 * 클라우드에서 받은 ICS 행 1건을 로컬 정본에 반영.
 * bulkUpsert를 쓰지 않음 — occurrence 매칭 실패 시 중복 insert 방지.
 * @param {Record<string, unknown>} sched cloudRowToSched 결과
 * @param {{ id: string, local_id?: number|string|null }} cloudRow
 * @param {string} userId
 * @param {{ byOcc: Map<string, object>, byCloudId: Map<string, object> }} index
 * @returns {Promise<'applied'|'skipped'|'purged'>}
 */
export async function applyCloudIcsSchedule(sched, cloudRow, userId, index) {
  if (!isIcsLinkedSchedule(sched)) return 'skipped';

  const blockedUid = extractIcsUid(sched);
  if (blockedUid && isDeletedIcsUid(blockedUid, userId)) {
    // 블랙리스트: 로컬 잔여분 제거 + 클라우드 ICS 행도 정리(재유입 방지)
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

  // soft-delete 클라우드 ICS → 휴지통 금지, 클라우드에서 제거
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

  // 동일 occurrence에 다른 cloudId가 이미 붙어 있으면 들어온 클라우드 행만 제거
  if (local?.cloudId && cloudRow.id && String(local.cloudId) !== String(cloudRow.id)) {
    await purgeIcsCloudRow(cloudRow.id, userId);
    // 내용만 로컬에 병합(cloudId 유지)
    await upsertIcsOccurrence({
      ...sched,
      cloudId: local.cloudId,
      cloudLocalId: local.cloudLocalId,
      deletedAt: null,
    }, { ownerId: userId, index });
    return 'purged';
  }

  await upsertIcsOccurrence({
    ...sched,
    cloudId: cloudRow.id || local?.cloudId || null,
    cloudLocalId: cloudRow.local_id ?? sched.cloudLocalId ?? local?.cloudLocalId ?? null,
    deletedAt: null,
  }, { ownerId: userId, index });
  return 'applied';
}
