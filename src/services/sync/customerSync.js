import { db } from '../../db.js';
import { normalizeCustomerRecord } from '../../utils/customerTypes.js';
import { isSupabaseConfigured, supabase } from '../../lib/supabase.js';
import { getSyncUserId, getSyncCompanyId } from './syncContext.js';
import {
  DEV_LOCAL_OWNER,
  canMutateRecord,
  ownerFieldsFromCloudRow,
  cloudUserIdForRow,
  cloudCompanyIdForRow,
} from './ownerScope.js';
import { insertOrUpdateByLocalId, omitHeavyCloudFields, pushOwnedSoftDeletes, pruneStaleCloudRows } from './syncHelpers.js';
import { upsertSharedCloudRecord } from './cloudIdMap.js';

const INDEX_KEYS = new Set([
  'id', 'cloudId', 'cloudLocalId', 'ownerId', 'companyId', 'type', 'status', 'name', 'phone', 'fav', 'deletedAt', 'created',
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

/** @param {Record<string, unknown>} cust @param {string} sessionUserId */
function custToCloudRow(cust, sessionUserId) {
  const data = {};
  for (const [k, v] of Object.entries(cust)) {
    if (!INDEX_KEYS.has(k)) data[k] = v;
  }
  const row = {
    user_id: cloudUserIdForRow(cust, sessionUserId),
    company_id: cloudCompanyIdForRow(cust),
    local_id: cust.cloudLocalId ?? cust.id,
    type: cust.type ?? null,
    status: cust.status ?? null,
    name: cust.name ?? null,
    phone: cust.phone ?? null,
    fav: !!cust.fav,
    deleted_at: deletedAtToIso(cust.deletedAt),
    data: omitHeavyCloudFields(data),
    updated_at: new Date().toISOString(),
  };
  if (cust.cloudId) row.id = cust.cloudId;
  return row;
}

/** @param {Record<string, unknown>} row */
function cloudRowToCust(row) {
  const data = row.data && typeof row.data === 'object' ? row.data : {};
  return normalizeCustomerRecord({
    ...data,
    ...ownerFieldsFromCloudRow(row),
    cloudId: row.id,
    cloudLocalId: row.local_id ?? null,
    type: row.type,
    status: row.status,
    name: row.name,
    phone: row.phone,
    fav: row.fav,
    deletedAt: deletedAtFromIso(row.deleted_at),
  });
}

function canSync(userId) {
  return isSupabaseConfigured && userId && userId !== DEV_LOCAL_OWNER;
}

/** @param {string} userId */
export async function syncCustomersFromCloud(userId) {
  if (!canSync(userId)) return { ok: false, reason: 'skip' };

  await pushOwnedSoftDeletes('customers', syncCustomerToCloud, userId, 'properties');

  const companyId = getSyncCompanyId();

  const { data: rows, error } = await supabase
    .from('customers')
    .select('*')
    .order('updated_at', { ascending: true });

  if (error) throw error;

  const remoteCloudIds = new Set();
  const { isPurgedCloudId } = await import('./purgedCloudIds.js');

  for (const row of rows ?? []) {
    if (isPurgedCloudId('customers', row.id, userId)) continue;
    if (row.id) remoteCloudIds.add(String(row.id));
    const cust = cloudRowToCust(row);
    await upsertSharedCloudRecord(db.customers, {
      sessionUserId: userId,
      cloudRow: row,
      record: cust,
      resource: 'customers',
    });
  }

  await pruneStaleCloudRows(db.customers, remoteCloudIds, userId, companyId, 'customers');

  localStorage.setItem(`landnote.sync.customers.${userId}`, new Date().toISOString());
  return { ok: true, count: rows?.length ?? 0 };
}

/** @param {number} customerId @param {string} [sessionUserId] */
export async function syncCustomerToCloud(customerId, sessionUserId = getSyncUserId()) {
  if (!canSync(sessionUserId)) return { ok: false, reason: 'skip' };

  const cust = await db.customers.get(customerId);
  if (!cust || !canMutateRecord(cust)) return { ok: false, reason: 'forbidden' };

  const row = custToCloudRow(cust, sessionUserId);

  if (cust.cloudId) {
    const { error } = await supabase.from('customers').update(row).eq('id', cust.cloudId);
    if (error) throw error;
  } else {
    const { data, error } = await supabase.from('customers').insert(row).select('id').single();
    if (error) {
      const cloudId = await insertOrUpdateByLocalId(supabase, 'customers', row, error);
      await db.customers.update(customerId, { cloudId });
    } else {
      await db.customers.update(customerId, { cloudId: data.id });
    }
  }
  return { ok: true };
}

/** @param {number} customerId @param {string} [sessionUserId] */
export async function deleteCustomerFromCloud(customerId, sessionUserId = getSyncUserId()) {
  if (!canSync(sessionUserId)) return { ok: false, reason: 'skip' };
  const cust = await db.customers.get(customerId);
  if (!cust?.cloudId) return { ok: false, reason: 'no_cloud_id' };
  if (!canMutateRecord(cust)) return { ok: false, reason: 'forbidden' };
  const { rememberPurgedCloudId } = await import('./purgedCloudIds.js');
  const { error } = await supabase.from('customers').delete().eq('id', cust.cloudId);
  if (error) throw error;
  rememberPurgedCloudId('customers', cust.cloudId, sessionUserId);
  return { ok: true };
}

/** @param {number} customerId */
export async function syncCustomerAfterChange(customerId) {
  const userId = getSyncUserId();
  if (!userId) return;
  try {
    await syncCustomerToCloud(customerId, userId);
  } catch (err) {
    console.error('[customerSync]', err);
  }
}

/** @param {string} userId */
export async function pushUnsyncedCustomersToCloud(userId) {
  if (!canSync(userId)) return { ok: false, reason: 'skip' };
  const locals = await db.customers.where('ownerId').equals(userId).toArray();
  let pushed = 0;
  let failed = 0;
  for (const c of locals) {
    if (!c.cloudId && canMutateRecord(c)) {
      try {
        await syncCustomerToCloud(c.id, userId);
        pushed += 1;
      } catch (err) {
        failed += 1;
        console.error('[customerSync] push failed', c.id, err);
      }
    }
  }
  return { ok: failed === 0, pushed, failed };
}

/** @param {string} userId */
export async function initialCustomerSync(userId) {
  if (!canSync(userId)) return { ok: false, reason: 'skip' };
  const pull = await syncCustomersFromCloud(userId);
  const push = await pushUnsyncedCustomersToCloud(userId);
  return { ok: true, pulled: pull.count ?? 0, pushed: push.pushed ?? 0 };
}

export function getCustomerSyncTime(userId) {
  if (!userId) return null;
  return localStorage.getItem(`landnote.sync.customers.${userId}`);
}
