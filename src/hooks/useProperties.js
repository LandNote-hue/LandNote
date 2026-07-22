import { useLiveQuery } from 'dexie-react-hooks';
import { db, isActive } from '../db.js';
import { filterByDataScope } from '../services/sync/ownerScope.js';
import { useDataScope, useDataScopeDeps } from './useOwnerScopedData.js';

/** @param {unknown[]} items @param {ReturnType<typeof useDataScope>} scope */
function filterPropertiesScope(items, scope) {
  return filterByDataScope(items, scope).filter(isActive);
}

export const useProperties = () => {
  const scope = useDataScope();
  const deps = useDataScopeDeps(scope);
  return useLiveQuery(
    () => db.properties.toArray().then((rows) => filterPropertiesScope(rows, scope)),
    deps,
  ) ?? [];
};

/** @returns {unknown[] | undefined} undefined = 아직 로드 중 */
export const usePropertiesQuery = () => {
  const scope = useDataScope();
  const deps = useDataScopeDeps(scope);
  return useLiveQuery(
    () => db.properties.toArray().then((rows) => filterPropertiesScope(rows, scope)),
    deps,
  );
};
