import { useMemo } from 'react';
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
  const userId = user?.id || DEV_LOCAL_OWNER;
  const companyId = solo ? null : (company?.id ?? profile?.company_id ?? null);
  const resolvedRole = role ?? 'SOLO';
  const permissions = useMemo(
    () => getEffectivePermissions(role, memberPermissions),
    [role, memberPermissions],
  );
  return useMemo(() => ({
    userId,
    companyId,
    role: resolvedRole,
    permissions,
  }), [userId, companyId, resolvedRole, permissions]);
}

/** liveQuery 의존성용 — permissions 객체 참조 변경으로 구독이 리셋되지 않게 */
export function useDataScopeDeps(scope = useDataScope()) {
  const permsKey = useMemo(
    () => JSON.stringify(scope.permissions ?? null),
    [scope.permissions],
  );
  return [scope.userId, scope.companyId, scope.role, permsKey];
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
  const deps = useDataScopeDeps(scope);
  return useLiveQuery(
    () => db.customers.toArray().then((rows) => filterScoped(rows, scope, { customersOnly: true })),
    deps,
  ) ?? [];
}

export function useOwnerCallLogs() {
  const scope = useDataScope();
  const deps = useDataScopeDeps(scope);
  return useLiveQuery(
    () => db.call_logs.toArray().then((rows) => filterScoped(rows, scope, { resource: 'call_logs' })),
    deps,
  ) ?? [];
}

export function useOwnerSchedules() {
  const scope = useDataScope();
  const deps = useDataScopeDeps(scope);
  return useLiveQuery(
    () => db.schedules.toArray().then((rows) => filterScoped(rows, scope, { resource: 'schedules' })),
    deps,
  ) ?? [];
}

export function useOwnerDeletedProperties() {
  const scope = useDataScope();
  const deps = useDataScopeDeps(scope);
  return useLiveQuery(
    () => db.properties.toArray().then((rows) => filterScoped(rows, scope, { deleted: true })),
    deps,
  ) ?? [];
}

export function useOwnerDeletedCustomers() {
  const scope = useDataScope();
  const deps = useDataScopeDeps(scope);
  return useLiveQuery(
    () => db.customers.toArray().then((rows) => filterScoped(rows, scope, { customersOnly: true, deleted: true })),
    deps,
  ) ?? [];
}

export function useOwnerDeletedCallLogs() {
  const scope = useDataScope();
  const deps = useDataScopeDeps(scope);
  return useLiveQuery(
    () => db.call_logs.toArray().then((rows) => filterScoped(rows, scope, { resource: 'call_logs', deleted: true })),
    deps,
  ) ?? [];
}

export function useOwnerDeletedSchedules() {
  const scope = useDataScope();
  const deps = useDataScopeDeps(scope);
  return useLiveQuery(
    () => db.schedules.toArray().then((rows) => filterScoped(rows, scope, { resource: 'schedules', deleted: true })),
    deps,
  ) ?? [];
}

export function useOwnerTrashCount() {
  const deletedProps = useOwnerDeletedProperties();
  const deletedCusts = useOwnerDeletedCustomers();
  const deletedScheds = useOwnerDeletedSchedules();
  const deletedCalls = useOwnerDeletedCallLogs();
  return deletedProps.length + deletedCusts.length + deletedScheds.length + deletedCalls.length;
}
