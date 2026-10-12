import { isUniqueViolation } from './syncHelpers.js';
import { SYNC_STATUS } from '../../utils/recordSyncState.js';

/**
 * UPDATE … WHERE id AND updated_at = 로컬이 아는 버전 (DB가 원자적으로 검사).
 * 0건이면 조회해 missing / conflict / 권한 미반영을 구분하고, INSERT로 되살리지 않음.
 *
 * @param {import('@supabase/supabase-js').SupabaseClient} client
 * @param {string} table
 * @param {{
 *   id: string|number,
 *   expectedUpdatedAt?: string|null,
 *   row: Record<string, unknown>,
 *   select?: string,
 * }} opts
 * @returns {Promise<
 *   | { ok: true, row: Record<string, unknown> }
 *   | { ok: false, reason: 'missing'|'conflict'|'not_updated'|'no_version', remoteUpdatedAt?: string|null }
 * >}
 */
export async function updateCloudRowIfVersionMatch(client, table, opts) {
  const { id, expectedUpdatedAt, row, select = 'id, updated_at' } = opts;
  const payload = { ...row };
  delete payload.id;

  if (!expectedUpdatedAt) {
    const { data: current, error: fetchErr } = await client
      .from(table)
      .select('id, updated_at')
      .eq('id', id)
      .maybeSingle();
    if (fetchErr) throw fetchErr;
    if (!current) return { ok: false, reason: 'missing' };
    return { ok: false, reason: 'no_version', remoteUpdatedAt: current.updated_at || null };
  }

  const { data, error } = await client
    .from(table)
    .update(payload)
    .eq('id', id)
    .eq('updated_at', expectedUpdatedAt)
    .select(select)
    .maybeSingle();
  if (error) throw error;
  if (data) return { ok: true, row: data };

  const { data: current, error: fetchErr } = await client
    .from(table)
    .select('id, updated_at')
    .eq('id', id)
    .maybeSingle();
  if (fetchErr) throw fetchErr;
  if (!current) return { ok: false, reason: 'missing' };
  if (String(current.updated_at || '') !== String(expectedUpdatedAt)) {
    return { ok: false, reason: 'conflict', remoteUpdatedAt: current.updated_at || null };
  }
  return { ok: false, reason: 'not_updated', remoteUpdatedAt: current.updated_at || null };
}

/**
 * 신규 insert 중복: 같은 요청 재시도와 다른 자료 충돌을 구분.
 * 서버 최신 updated_at을 로컬 기준 버전으로 채택하지 않는다.
 *
 * @param {Record<string, unknown>} local
 * @param {{ id?: string|number, updated_at?: string, created_at?: string, data?: Record<string, unknown> }|null} existing
 */
export function classifyDuplicateCloudRow(local, existing) {
  if (!existing?.id) return { action: 'missing' };
  const localReq = local.syncRequestId || local.data?.syncRequestId;
  const remoteReq = existing.data?.syncRequestId || existing.syncRequestId;
  const sameRequest = !!(localReq && remoteReq && String(localReq) === String(remoteReq));
  const unchangedSinceInsert = !!(existing.created_at
    && existing.updated_at
    && String(existing.updated_at) === String(existing.created_at));

  if (sameRequest && unchangedSinceInsert) {
    return {
      action: 'reuse_same_request',
      id: existing.id,
      updatedAt: existing.updated_at,
    };
  }
  if (sameRequest) {
    return {
      action: 'conflict_mutated',
      id: existing.id,
      updatedAt: existing.updated_at || null,
    };
  }
  return {
    action: 'conflict_other',
    id: existing.id,
    updatedAt: existing.updated_at || null,
  };
}

/**
 * unique 위반 시 기존 행을 읽어 재사용/충돌을 분류. 서버 최신 버전을 로컬 기준으로 쓰지 않음.
 */
export async function resolveInsertDuplicate(client, table, row, insertError) {
  if (insertError && !isUniqueViolation(insertError)) throw insertError;
  if (!insertError) throw new Error('resolveInsertDuplicate: missing insert error');
  const userId = row.user_id;
  const localId = row.local_id;
  if (userId == null || localId == null) throw insertError;
  const { data: existing, error: findErr } = await client
    .from(table)
    .select('id, updated_at, created_at, data')
    .eq('user_id', userId)
    .eq('local_id', localId)
    .maybeSingle();
  if (findErr) throw findErr;
  if (!existing?.id) throw insertError;
  const localHint = { syncRequestId: row.data?.syncRequestId, data: row.data };
  return classifyDuplicateCloudRow(localHint, existing);
}

/**
 * 중복 분류 → 로컬 패치. 서버 updated_at을 로컬 CAS 기준으로 쓰지 않음.
 * conflict_other(다른 기기의 같은 local_id)에는 cloudId를 붙이지 않는다.
 */
export function localPatchFromDuplicateClassification(classified) {
  if (classified.action === 'reuse_same_request') {
    return {
      reuse: true,
      patch: { cloudId: classified.id, cloudUpdatedAt: classified.updatedAt },
    };
  }
  const patch = {
    syncStatus: SYNC_STATUS.CONFLICT,
    syncConflictRemoteAt: classified.updatedAt || null,
    syncError: classified.action,
  };
  if (classified.action === 'conflict_mutated' && classified.id) {
    patch.cloudId = classified.id;
  }
  return { reuse: false, conflict: true, reason: classified.action, patch };
}

/**
 * @param {{ ok?: boolean, reason?: string }} result
 * @param {number} startedRev
 * @param {Record<string, unknown>|null|undefined} localAfter
 * @param {typeof import('../../utils/recordSyncState.js').resolveSyncSuccessPatch} resolveSyncSuccessPatch
 */
export function patchAfterVerifiedCloudWrite(result, startedRev, localAfter, resolveSyncSuccessPatch, extra = {}) {
  if (!result?.ok || !result.row) {
    return null;
  }
  return resolveSyncSuccessPatch(localAfter, startedRev, {
    ...extra,
    cloudUpdatedAt: result.row.updated_at || extra.cloudUpdatedAt || null,
  });
}
