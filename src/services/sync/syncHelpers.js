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
 * @param {import('dexie').Table} table
 * @param {Set<string>} remoteCloudIds
 * @param {string} userId
 * @param {string|null} companyId
 * @param {keyof import('./cloudIdMap.js').ID_MAPS extends never ? string : 'properties'|'customers'|'schedules'|'call_logs'} resource
 */
export async function pruneStaleCloudRows(table, remoteCloudIds, userId, companyId, resource) {
  const { isPurgedCloudId } = await import('./purgedCloudIds.js');
  const locals = await table.toArray();
  for (const rec of locals) {
    const cloudId = rec.cloudId;
    if (!cloudId) continue;
    if (remoteCloudIds.has(String(cloudId))) continue;

    const inScope = companyId
      ? (!rec.companyId || rec.companyId === companyId)
      : rec.ownerId === userId;
    if (!inScope) continue;

    // 영구삭제 tombstone — 클라우드에 없으므로 로컬 잔여분 정리
    if (isPurgedCloudId(resource, cloudId, userId)) {
      await table.delete(rec.id);
      continue;
    }

    await table.delete(rec.id);
  }
}
