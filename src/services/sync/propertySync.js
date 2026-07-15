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
import { insertOrUpdateByLocalId, omitHeavyCloudFields, mergePropertyPhotos, pushOwnedSoftDeletes, pruneStaleCloudRows } from './syncHelpers.js';
import { upsertSharedCloudRecord } from './cloudIdMap.js';
import { ensurePropertyPhotosInCloud, removePropertyPhotosFromStorage } from './propertyPhotoStorage.js';
import { normalizeJDepToMan } from '../../utils/formatMoney.js';

const INDEX_KEYS = new Set([
  'id', 'cloudId', 'cloudLocalId', 'ownerId', 'companyId', 'status', 'main', 'sub', 'trade', 'fav', 'favAt', 'deletedAt',
]);

function deletedAtToIso(deletedAt) {
  if (!deletedAt) return null;
  const parts = String(deletedAt).split('.');
  if (parts.length === 3) {
    return new Date(`${parts[0]}-${parts[1]}-${parts[2]}T12:00:00.000Z`).toISOString();
  }
  return null;
}

function deletedAtFromIso(iso) {
  if (!iso) return null;
  const d = new Date(iso);
  return `${d.getFullYear()}.${String(d.getMonth() + 1).padStart(2, '0')}.${String(d.getDate()).padStart(2, '0')}`;
}

/** @param {Record<string, unknown>} prop @param {string} sessionUserId */
function propToCloudRow(prop, sessionUserId) {
  const data = {};
  for (const [k, v] of Object.entries(prop)) {
    if (!INDEX_KEYS.has(k)) data[k] = v;
  }
  const row = {
    user_id: cloudUserIdForRow(prop, sessionUserId),
    company_id: cloudCompanyIdForRow(prop),
    // 공유로 로컬 id가 바뀌어도 클라우드 local_id는 원본 유지
    local_id: prop.cloudLocalId ?? prop.id,
    status: prop.status ?? null,
    main: prop.main ?? null,
    sub: prop.sub ?? null,
    trade: prop.trade ?? null,
    fav: !!prop.fav,
    fav_at: prop.favAt || null,
    deleted_at: deletedAtToIso(prop.deletedAt),
    data: omitHeavyCloudFields(data),
    updated_at: new Date().toISOString(),
  };
  if (prop.cloudId) row.id = prop.cloudId;
  return row;
}

/** @param {Record<string, unknown>} row */
function cloudRowToProp(row) {
  const data = row.data && typeof row.data === 'object' ? { ...row.data } : {};
  if (data.jDep != null && data.jDep !== '') {
    data.jDep = normalizeJDepToMan(data.jDep);
  }
  return {
    ...data,
    ...ownerFieldsFromCloudRow(row),
    cloudId: row.id,
    cloudLocalId: row.local_id ?? null,
    status: row.status,
    main: row.main,
    sub: row.sub,
    trade: row.trade,
    fav: row.fav,
    favAt: row.fav_at,
    deletedAt: deletedAtFromIso(row.deleted_at),
  };
}

function canSync(userId) {
  return isSupabaseConfigured && userId && userId !== DEV_LOCAL_OWNER;
}

/** @param {string} userId */
export async function syncPropertiesFromCloud(userId) {
  if (!canSync(userId)) return { ok: false, reason: 'skip' };

  await pushOwnedSoftDeletes('properties', syncPropertyToCloud, userId, 'properties');

  const companyId = getSyncCompanyId();

  const { data: rows, error } = await supabase
    .from('properties')
    .select('*')
    .order('updated_at', { ascending: true });

  if (error) throw error;

  const remoteCloudIds = new Set();
  const { isPurgedCloudId } = await import('./purgedCloudIds.js');

  for (const row of rows ?? []) {
    if (isPurgedCloudId('properties', row.id, userId)) continue;
    if (row.id) remoteCloudIds.add(String(row.id));
    const prop = cloudRowToProp(row);
    await upsertSharedCloudRecord(db.properties, {
      sessionUserId: userId,
      cloudRow: row,
      record: prop,
      resource: 'properties',
      mergeExisting: (existing, incoming) => ({
        ...existing,
        ...incoming,
        photos: mergePropertyPhotos(existing?.photos, incoming.photos),
      }),
    });
  }

  await pruneStaleCloudRows(db.properties, remoteCloudIds, userId, companyId, 'properties');

  localStorage.setItem(`landnote.sync.properties.${userId}`, new Date().toISOString());
  return { ok: true, count: rows?.length ?? 0 };
}

/** @param {number} propertyId @param {string} [sessionUserId] */
export async function syncPropertyToCloud(propertyId, sessionUserId = getSyncUserId()) {
  if (!canSync(sessionUserId)) return { ok: false, reason: 'skip' };

  let prop = await db.properties.get(propertyId);
  if (!prop || !canMutateRecord(prop, 'properties')) return { ok: false, reason: 'forbidden' };

  // 1) cloudId 확보 (사진 경로에 UUID 사용)
  if (!prop.cloudId) {
    const bootstrap = propToCloudRow(prop, sessionUserId);
    const { data, error } = await supabase
      .from('properties')
      .insert(bootstrap)
      .select('id')
      .single();
    if (error) {
      const cloudId = await insertOrUpdateByLocalId(supabase, 'properties', bootstrap, error);
      await db.properties.update(propertyId, { cloudId });
      prop = { ...prop, cloudId };
    } else {
      await db.properties.update(propertyId, { cloudId: data.id });
      prop = { ...prop, cloudId: data.id };
    }
  }

  // 2) data URL → Storage URL
  const withPhotos = await ensurePropertyPhotosInCloud(prop);
  if (withPhotos.photos !== prop.photos) {
    await db.properties.update(propertyId, { photos: withPhotos.photos });
    prop = withPhotos;
  }

  // 3) 최종 upsert (원격 URL photos 포함)
  const row = propToCloudRow(prop, sessionUserId);
  const { error: updErr } = await supabase
    .from('properties')
    .update(row)
    .eq('id', prop.cloudId);
  if (updErr) throw updErr;
  return { ok: true };
}

/** @param {number} propertyId @param {string} [sessionUserId] */
export async function deletePropertyFromCloud(propertyId, sessionUserId = getSyncUserId()) {
  if (!canSync(sessionUserId)) return { ok: false, reason: 'skip' };
  const prop = await db.properties.get(propertyId);
  if (!prop?.cloudId) return { ok: false, reason: 'no_cloud_id' };
  if (!canMutateRecord(prop, 'properties')) return { ok: false, reason: 'forbidden' };
  await removePropertyPhotosFromStorage(prop);
  const { rememberPurgedCloudId } = await import('./purgedCloudIds.js');
  const { error } = await supabase.from('properties').delete().eq('id', prop.cloudId);
  if (error) throw error;
  rememberPurgedCloudId('properties', prop.cloudId, sessionUserId);
  return { ok: true };
}

/** @param {number} propertyId */
export async function syncPropertyAfterChange(propertyId) {
  const userId = getSyncUserId();
  if (!userId) return;
  try {
    await syncPropertyToCloud(propertyId, userId);
  } catch (err) {
    console.error('[propertySync]', err);
  }
}

/** @param {string} userId */
export async function pushUnsyncedPropertiesToCloud(userId) {
  if (!canSync(userId)) return { ok: false, reason: 'skip' };
  // ownerId 기준 — 미동기화 또는 로컬 data URL 사진이 남은 매물 재업로드
  const locals = await db.properties.where('ownerId').equals(userId).toArray();
  let pushed = 0;
  let failed = 0;
  for (const p of locals) {
    if (!canMutateRecord(p, 'properties')) continue;
    const hasLocalPhotos = Array.isArray(p.photos)
      && p.photos.some((ph) => typeof ph === 'string' && ph.startsWith('data:'));
    if (p.cloudId && !hasLocalPhotos) continue;
    try {
      await syncPropertyToCloud(p.id, userId);
      pushed += 1;
    } catch (err) {
      failed += 1;
      console.error('[propertySync] push failed', p.id, err);
    }
  }
  return { ok: failed === 0, pushed, failed };
}

/** @param {string} userId */
export async function initialPropertySync(userId) {
  if (!canSync(userId)) return { ok: false, reason: 'skip' };
  // push(사진 Storage 포함) → pull 순서로 회사 공유 열람 가능
  const push = await pushUnsyncedPropertiesToCloud(userId);
  const pull = await syncPropertiesFromCloud(userId);
  return { ok: true, pulled: pull.count ?? 0, pushed: push.pushed ?? 0 };
}

export function getPropertySyncTime(userId) {
  if (!userId) return null;
  return localStorage.getItem(`landnote.sync.properties.${userId}`);
}
