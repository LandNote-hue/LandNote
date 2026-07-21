import { getSyncUserId, getSyncCompanyId, getSyncCompanyRole, getSyncMemberPermissions } from './syncContext.js';
import { isCeoRole, isSoloRole } from '../../data/companyRoles.js';
import { RESOURCE_READ_KEYS, RESOURCE_WRITE_KEYS } from '../../data/memberPermissions.js';

export const DEV_LOCAL_OWNER = 'dev-local';

export function getActiveOwnerId() {
  const syncId = getSyncUserId();
  if (syncId) return syncId;
  try {
    const active = localStorage.getItem('landnote.activeOwner');
    if (active) return active;
  } catch {
    /* ignore */
  }
  return DEV_LOCAL_OWNER;
}

/** @param {Record<string, unknown>|null|undefined} item */
export function matchesOwner(item, ownerId = getActiveOwnerId()) {
  if (!item) return false;
  const oid = item.ownerId;
  if (oid == null || oid === '') return ownerId === DEV_LOCAL_OWNER;
  return oid === ownerId;
}

/** 같은 회사 스코프인지 (로컬 companyId 누락도 세션 회사로 허용) */
function sameCompanyScope(item, companyId) {
  if (!companyId) return false;
  if (item.companyId == null || item.companyId === '') return true;
  return item.companyId === companyId;
}

/** @param {Record<string, unknown>|null|undefined} item @param {import('../../data/memberPermissions.js').ShareResource} [resource='properties'] */
export function canMutateRecord(item, resource = 'properties') {
  if (!item) return false;
  const userId = getActiveOwnerId();
  if (matchesOwner(item, userId)) return true;
  const companyId = getSyncCompanyId();
  const role = getSyncCompanyRole();
  if (companyId && isCeoRole(role) && !isSoloRole(role) && sameCompanyScope(item, companyId)) return true;
  const perms = getSyncMemberPermissions();
  if (!perms || !sameCompanyScope(item, companyId)) return false;
  const writeKey = RESOURCE_WRITE_KEYS[resource];
  return !!perms[writeKey];
}

/** @typedef {{ userId: string, companyId?: string|null, role?: string|null, permissions?: import('../../data/memberPermissions.js').MemberPermissions|null }} DataScope */

/** @template T @param {T[]} items @param {DataScope} scope @param {{ customersOnly?: boolean, resource?: import('../../data/memberPermissions.js').ShareResource }} [opts] */
export function filterByDataScope(items, scope, opts = {}) {
  const active = items ?? [];
  const { userId, companyId, role, permissions } = scope;
  const resource = opts.resource ?? 'properties';
  const readKey = RESOURCE_READ_KEYS[resource];

  // 개인(SOLO)·회사 미설정·로컬 개발: 본인 소유만
  if (isSoloRole(role) || !companyId || userId === DEV_LOCAL_OWNER) {
    return active.filter((item) => matchesOwner(item, userId));
  }

  if (opts.customersOnly && (!isCeoRole(role) || isSoloRole(role))) {
    return active.filter((item) => matchesOwner(item, userId));
  }

  if (isCeoRole(role) && !isSoloRole(role)) {
    return active.filter((item) => !item.companyId || item.companyId === companyId);
  }

  return active.filter((item) => {
    if (matchesOwner(item, userId)) return true;
    if (!permissions || !permissions[readKey]) return false;
    // companyId NULL(구데이터·미백필)도 권한 있으면 표시 — RLS가 이미 회사 범위로 내려줌
    if (item.companyId != null && item.companyId !== '' && item.companyId !== companyId) return false;
    return true;
  });
}

/** @template T @param {T[]} items @param {string} [ownerId] */
export function filterByOwner(items, ownerId = getActiveOwnerId()) {
  return (items ?? []).filter((item) => matchesOwner(item, ownerId));
}

/** @param {Record<string, unknown>} payload */
export function withOwnerId(payload, ownerId = getActiveOwnerId()) {
  const companyId = getSyncCompanyId();
  return {
    ...payload,
    ownerId,
    ...(companyId ? { companyId } : {}),
  };
}

/** @deprecated diff pull(pruneStaleCloudRows) 사용 — clear+pull 제거됨 */
export async function clearLocalScopeBeforePull(table, companyId, userId) {
  void table;
  void companyId;
  void userId;
}

/** @param {Record<string, unknown>} row */
export function ownerFieldsFromCloudRow(row) {
  return {
    ownerId: row.user_id,
    // RLS로 내려온 행인데 company_id NULL이면 세션 회사로 채워 UI 필터·쓰기에 반영
    companyId: row.company_id ?? getSyncCompanyId() ?? null,
  };
}

/** @param {Record<string, unknown>} local @param {string} userId */
export function cloudUserIdForRow(local, userId = getSyncUserId()) {
  return local.ownerId || userId;
}

/** @param {Record<string, unknown>} local */
export function cloudCompanyIdForRow(local) {
  // 공유 레코드는 원본 companyId 유지, 신규는 세션 회사
  return local.companyId || getSyncCompanyId() || null;
}
