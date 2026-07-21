import { useLiveQuery } from 'dexie-react-hooks';
import { useAuth } from '../contexts/AuthContext.jsx';
import { db, isActive } from '../db.js';
import { DEV_LOCAL_OWNER, filterByDataScope } from '../services/sync/ownerScope.js';
import { normalizeCompanyRole } from '../data/companyRoles.js';
import { getEffectivePermissions } from '../utils/permissions.js';

export function useOwnerId() {
  const { user } = useAuth();
  return user?.id || DEV_LOCAL_OWNER;
}

export function useDataScope() {
  const { user, company, profile, companyRole, memberPermissions } = useAuth();
  const rawRole = companyRole ?? profile?.role;
  const soloByType = profile?.user_type === 'SOLO';
  // normalizeCompanyRole(null)→MEMBER 이므로 SOLO user_type을 먼저 반영
  const role = rawRole != null && rawRole !== ''
    ? normalizeCompanyRole(rawRole)
    : (soloByType ? 'SOLO' : null);
  const solo = role === 'SOLO' || soloByType;
  return {
    userId: user?.id || DEV_LOCAL_OWNER,
    // 개인 계정은 company 스코프로 걸러지지 않도록 null 고정
    companyId: solo ? null : (company?.id ?? profile?.company_id ?? null),
    role: role ?? 'SOLO',
    permissions: getEffectivePermissions(role, memberPermissions),
  };
}

/** @param {unknown[]} items @param {ReturnType<typeof useDataScope>} scope @param {{ customersOnly?: boolean, deleted?: boolean, resource?: import('../data/memberPermissions.js').ShareResource }} [opts] */
function filterScoped(items, scope, opts = {}) {
  const scoped = filterByDataScope(items, scope, {
    customersOnly: opts.customersOnly,
    resource: opts.resource ?? 'properties',
  });
  return opts.deleted ? scoped.filter((x) => x.deletedAt) : scoped.filter(isActive);
}

export function useOwnerCustomers() {
  const scope = useDataScope();
  return useLiveQuery(
    () => db.customers.toArray().then((rows) => filterScoped(rows, scope, { customersOnly: true })),
    [scope.userId, scope.companyId, scope.role, scope.permissions],
  ) ?? [];
}

export function useOwnerCallLogs() {
  const scope = useDataScope();
  return useLiveQuery(
    () => db.call_logs.toArray().then((rows) => filterScoped(rows, scope, { resource: 'call_logs' })),
    [scope.userId, scope.companyId, scope.role, scope.permissions],
  ) ?? [];
}

export function useOwnerSchedules() {
  const scope = useDataScope();
  return useLiveQuery(
    () => db.schedules.toArray().then((rows) => filterScoped(rows, scope, { resource: 'schedules' })),
    [scope.userId, scope.companyId, scope.role, scope.permissions],
  ) ?? [];
}

export function useOwnerDeletedProperties() {
  const scope = useDataScope();
  return useLiveQuery(
    () => db.properties.toArray().then((rows) => filterScoped(rows, scope, { deleted: true })),
    [scope.userId, scope.companyId, scope.role, scope.permissions],
  ) ?? [];
}

export function useOwnerDeletedCustomers() {
  const scope = useDataScope();
  return useLiveQuery(
    () => db.customers.toArray().then((rows) => filterScoped(rows, scope, { customersOnly: true, deleted: true })),
    [scope.userId, scope.companyId, scope.role, scope.permissions],
  ) ?? [];
}

export function useOwnerDeletedCallLogs() {
  const scope = useDataScope();
  return useLiveQuery(
    () => db.call_logs.toArray().then((rows) => filterScoped(rows, scope, { resource: 'call_logs', deleted: true })),
    [scope.userId, scope.companyId, scope.role, scope.permissions],
  ) ?? [];
}

export function useOwnerDeletedSchedules() {
  const scope = useDataScope();
  return useLiveQuery(
    () => db.schedules.toArray().then((rows) => filterScoped(rows, scope, { resource: 'schedules', deleted: true })),
    [scope.userId, scope.companyId, scope.role, scope.permissions],
  ) ?? [];
}

export function useOwnerTrashCount() {
  const deletedProps = useOwnerDeletedProperties();
  const deletedCusts = useOwnerDeletedCustomers();
  const deletedScheds = useOwnerDeletedSchedules();
  const deletedCalls = useOwnerDeletedCallLogs();
  return deletedProps.length + deletedCusts.length + deletedScheds.length + deletedCalls.length;
}
