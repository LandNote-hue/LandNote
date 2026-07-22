/** PostgREST/Supabase 기본 max_rows(1000) 회피 — 페이지 단위로 전부 조회 */
export const CLOUD_PULL_PAGE_SIZE = 1000;
const CLOUD_PULL_CONCURRENCY = 3;

/**
 * @param {import('@supabase/supabase-js').SupabaseClient} client
 * @param {string} table
 * @param {{ orderColumn?: string, ascending?: boolean, select?: string }} [opts]
 * @returns {Promise<Record<string, unknown>[]>}
 */
export async function fetchAllCloudRows(client, table, opts = {}) {
  const select = opts.select || '*';
  const orderColumn = opts.orderColumn || 'updated_at';
  const ascending = opts.ascending !== false;
  const pageSize = CLOUD_PULL_PAGE_SIZE;

  const { count, error: countErr } = await client
    .from(table)
    .select('id', { count: 'exact', head: true });
  if (countErr) throw countErr;
  const total = count ?? 0;
  if (total === 0) return [];

  const pageCount = Math.ceil(total / pageSize);
  /** @type {Record<string, unknown>[]} */
  const all = [];
  for (let page = 0; page < pageCount; page += CLOUD_PULL_CONCURRENCY) {
    const batch = [];
    for (let i = 0; i < CLOUD_PULL_CONCURRENCY && page + i < pageCount; i += 1) {
      const from = (page + i) * pageSize;
      const to = from + pageSize - 1;
      batch.push(
        client
          .from(table)
          .select(select)
          .order(orderColumn, { ascending })
          .range(from, to)
          .then(({ data, error }) => {
            if (error) throw error;
            return data ?? [];
          }),
      );
    }
    const parts = await Promise.all(batch);
    for (const part of parts) all.push(...part);
  }
  return all;
}

/**
 * 로컬 deletedAt("YYYY.MM.DD" 또는 "YYYY.MM.DD HH:mm") → 클라우드 저장용 ISO
 * 시간 정보가 없는(구버전) 값은 당일 정오로 앵커링해 타임존 롤오버를 방지
 * @param {string|null|undefined} deletedAt
 */
export function deletedAtToIso(deletedAt) {
  if (!deletedAt) return null;
  const [datePart, timePart] = String(deletedAt).trim().split(' ');
  const dateNums = (datePart || '').split('.').map(Number);
  if (dateNums.length !== 3 || dateNums.some((n) => !Number.isFinite(n))) return null;
  const [y, mo, d] = dateNums;
  let h = 12;
  let mi = 0;
  if (timePart && /^\d{2}:\d{2}$/.test(timePart)) {
    [h, mi] = timePart.split(':').map(Number);
  }
  return new Date(y, mo - 1, d, h, mi, 0, 0).toISOString();
}

/** @param {string|null|undefined} iso */
export function deletedAtFromIso(iso) {
  if (!iso) return null;
  const d = new Date(iso);
  const date = `${d.getFullYear()}.${String(d.getMonth() + 1).padStart(2, '0')}.${String(d.getDate()).padStart(2, '0')}`;
  const time = `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
  return `${date} ${time}`;
}

/** @param {unknown} error */
export function isUniqueViolation(error) {
  const code = error && typeof error === 'object' && 'code' in error ? String(error.code) : '';
  const msg = error && typeof error === 'object' && 'message' in error ? String(error.message) : String(error ?? '');
  return code === '23505' || /duplicate key|unique constraint/i.test(msg);
}

/**
 * 클라우드 JSONB에 넣기 무거운 필드 제외 (로컬 IndexedDB에는 유지)
 * photos: http(s) URL만 동기화 — data URL(base64)은 제외
 * @param {Record<string, unknown>} data
 */
export function omitHeavyCloudFields(data) {
  if (!data || typeof data !== 'object') return {};
  const next = { ...data };
  if (Array.isArray(next.photos)) {
    const remote = next.photos.filter(
      (p) => typeof p === 'string' && (p.startsWith('http://') || p.startsWith('https://')),
    );
    if (remote.length) next.photos = remote;
    else delete next.photos;
  } else {
    delete next.photos;
  }
  return next;
}

/**
 * 공유 pull 시 사진 병합 — 원격 URL 우선, 없으면 로컬(data URL 포함) 유지
 * @param {unknown} existing
 * @param {unknown} incoming
 */
export function mergePropertyPhotos(existing, incoming) {
  const toList = (v) => (Array.isArray(v) ? v.filter((p) => typeof p === 'string' && p) : []);
  const inc = toList(incoming);
  const exc = toList(existing);
  const incHasRemote = inc.some((p) => p.startsWith('http://') || p.startsWith('https://'));
  const excHasRemote = exc.some((p) => p.startsWith('http://') || p.startsWith('https://'));
  if (incHasRemote) return inc;
  if (inc.length) return inc;
  if (excHasRemote || exc.length) return exc;
  return [];
}

/**
 * insert 실패 시 (user_id, local_id)로 기존 행을 찾아 update
 * @param {import('@supabase/supabase-js').SupabaseClient} client
 * @param {string} table
 * @param {Record<string, unknown>} row
 * @param {unknown} insertError
 * @returns {Promise<string|number>} cloud id
 */
export async function insertOrUpdateByLocalId(client, table, row, insertError) {
  if (!isUniqueViolation(insertError)) throw insertError;
  const userId = row.user_id;
  const localId = row.local_id;
  if (userId == null || localId == null) throw insertError;

  const { data: existing, error: findErr } = await client
    .from(table)
    .select('id')
    .eq('user_id', userId)
    .eq('local_id', localId)
    .maybeSingle();
  if (findErr) throw findErr;
  if (!existing?.id) throw insertError;

  const { id: _omitId, ...updateRow } = row;
  const { error: updErr } = await client.from(table).update(updateRow).eq('id', existing.id);
  if (updErr) throw updErr;
  return existing.id;
}

/**
 * pull 전에 로컬 소프트삭제 상태를 클라우드에 반영
 * @param {string} tableName
 * @param {(id: number, userId: string) => Promise<unknown>} syncOne
 * @param {string} userId
 * @param {import('../../data/memberPermissions.js').ShareResource | 'properties'} [resource]
 */
export async function pushOwnedSoftDeletes(tableName, syncOne, userId, resource = 'properties') {
  const { db } = await import('../../db.js');
  const { canMutateRecord, matchesOwner } = await import('./ownerScope.js');
  const rows = await db.table(tableName).toArray();
  for (const row of rows) {
    if (!row.deletedAt || !row.cloudId) continue;
    if (!matchesOwner(row, userId)) continue;
    if (!canMutateRecord(row, resource)) continue;
    try {
      await syncOne(row.id, userId);
    } catch (err) {
      console.error(`[${tableName}] soft-delete push`, row.id, err);
    }
  }
}

/**
 * diff pull: 클라우드 응답에 없는 cloudId 로컬 행만 제거 (clear+재삽입 대신)
 * cloudId 없는 로컬(미동기화·가져오기)은 유지
 *
 * 안전장치:
 * - skipPrune / 원격 0건 → 삭제 안 함
 * - 원격 건수가 로컬 cloudId 건수보다 현저히 적으면(부분 RLS) 삭제 안 함
 * - SOLO 워크스페이스(companyId === userId)는 ownerId 스코프로만 정리
 *
 * @param {import('dexie').Table} table
 * @param {Set<string>} remoteCloudIds
 * @param {string} userId
 * @param {string|null} companyId
 * @param {'properties'|'customers'|'schedules'|'call_logs'} resource
 * @param {{ ownerScopeOnly?: boolean, allowEmptyRemote?: boolean, skipPrune?: boolean }} [options]
 * @returns {Promise<{ pruned: number, skipped: boolean, reason?: string }>}
 */
export async function pruneStaleCloudRows(table, remoteCloudIds, userId, companyId, resource, options = {}) {
  if (options.skipPrune === true) {
    return { pruned: 0, skipped: true, reason: 'skip_prune' };
  }

  const remoteCount = remoteCloudIds instanceof Set ? remoteCloudIds.size : 0;
  if (remoteCount === 0 && options.allowEmptyRemote !== true) {
    console.warn(`[prune] skip ${resource}: remote empty — keep local rows`);
    return { pruned: 0, skipped: true, reason: 'remote_empty' };
  }

  const { isPurgedCloudId } = await import('./purgedCloudIds.js');
  const soloWorkspace = !!(companyId && userId && String(companyId) === String(userId));
  const useOwnerScope = options.ownerScopeOnly === true || soloWorkspace || !companyId;

  const locals = await table.toArray();
  let localCloudCount = 0;
  for (const rec of locals) {
    if (!rec.cloudId) continue;
    const inScope = useOwnerScope
      ? (String(rec.ownerId || '') === String(userId)
        || (!rec.ownerId && String(rec.userId || '') === String(userId)))
      : (!rec.companyId || String(rec.companyId) === String(companyId));
    if (!inScope) continue;
    if (resource === 'schedules' && (rec.icsSourceId || rec.icsUid || rec.icsKey)) continue;
    localCloudCount += 1;
  }

  // 부분 pull(RLS·권한 구멍)으로 로컬이 대량 삭제되는 것 방지
  if (localCloudCount > 0 && remoteCount < Math.max(1, Math.ceil(localCloudCount * 0.5))) {
    console.warn(`[prune] skip ${resource}: remote ${remoteCount} << local ${localCloudCount}`);
    return { pruned: 0, skipped: true, reason: 'remote_partial' };
  }

  let pruned = 0;
  for (const rec of locals) {
    const cloudId = rec.cloudId;
    if (!cloudId) continue;
    if (remoteCloudIds.has(String(cloudId))) continue;

    const inScope = useOwnerScope
      ? (String(rec.ownerId || '') === String(userId)
        || (!rec.ownerId && String(rec.userId || '') === String(userId)))
      : (!rec.companyId || String(rec.companyId) === String(companyId));
    if (!inScope) continue;

    // 구글/ICS 가져온 일정은 클라우드 pull에 없어도 로컬 유지 (동기화로 다시 맞춤)
    if (resource === 'schedules' && (rec.icsSourceId || rec.icsUid || rec.icsKey)) continue;

    // 영구삭제 tombstone — 클라우드에 없으므로 로컬 잔여분 정리
    if (isPurgedCloudId(resource, cloudId, userId)) {
      await table.delete(rec.id);
      pruned += 1;
      continue;
    }

    await table.delete(rec.id);
    pruned += 1;
  }
  return { pruned, skipped: false };
}
