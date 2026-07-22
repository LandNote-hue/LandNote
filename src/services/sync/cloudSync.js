/**
 * 클라우드 동기화 — 매물·고객·일정·통화 (계정별 격리, diff pull)
 */
export { initialPropertySync, getPropertySyncTime } from './propertySync.js';
export { initialCustomerSync, getCustomerSyncTime } from './customerSync.js';
export { initialScheduleSync } from './scheduleSync.js';
export { initialCallLogSync } from './callLogSync.js';

import { withSyncMutex } from './syncGate.js';

/** 백업 복원 직후: 로컬을 클라우드에 올림 (item 단위 실패는 전체 실패로 보지 않음) */
export async function pushRestoredLocalData(userId) {
  const { pushUnsyncedPropertiesToCloud } = await import('./propertySync.js');
  const { pushUnsyncedCustomersToCloud } = await import('./customerSync.js');
  const { pushUnsyncedSchedulesToCloud } = await import('./scheduleSync.js');
  const { pushUnsyncedCallLogsToCloud } = await import('./callLogSync.js');
  const properties = await pushUnsyncedPropertiesToCloud(userId);
  const customers = await pushUnsyncedCustomersToCloud(userId);
  const schedules = await pushUnsyncedSchedulesToCloud(userId);
  const callLogs = await pushUnsyncedCallLogsToCloud(userId);
  const failed =
    (properties.failed || 0)
    + (customers.failed || 0)
    + (schedules.failed || 0)
    + (callLogs.failed || 0);
  return { properties, customers, schedules, callLogs, failed };
}

/** @returns {Promise<boolean>} */
async function isLocalDataEmpty() {
  const { getLocalTableCounts } = await import('../../db.js');
  const counts = await getLocalTableCounts();
  const n = (counts.properties || 0)
    + (counts.customers || 0)
    + (counts.schedules || 0)
    + (counts.call_logs || 0);
  return n === 0;
}

/** @returns {Promise<boolean>} 매물·고객이 비어 있으면 로그인 필수 pull 대상 */
export async function isEssentialLocalEmpty() {
  const { getLocalTableCounts } = await import('../../db.js');
  const counts = await getLocalTableCounts();
  return (counts.properties || 0) === 0 && (counts.customers || 0) === 0;
}

/**
 * @param {string} userId
 * @param {{
 *   forcePull?: boolean,
 *   onEssentialReady?: (partial: Record<string, unknown>) => void,
 * }} [options]
 *   forcePull: 복원 플래그 무시하고 pull 강제
 *   onEssentialReady: 매물·고객 pull 직후 콜백(앱 조기 진입용)
 */
async function initialCloudSyncInner(userId, options = {}) {
  const { consumeRestoreLocalWinsFlag } = await import('../../db.js');
  const { resetCloudLocalIdMaps, remapSharedForeignKeys } = await import('./cloudIdMap.js');
  const { db } = await import('../../db.js');
  const { initialPropertySync } = await import('./propertySync.js');
  const { initialCustomerSync } = await import('./customerSync.js');
  const { initialScheduleSync } = await import('./scheduleSync.js');
  const { initialCallLogSync } = await import('./callLogSync.js');

  const forcePull = options.forcePull === true;
  const onEssentialReady = typeof options.onEssentialReady === 'function'
    ? options.onEssentialReady
    : null;

  const restoreFlag = forcePull
    ? (consumeRestoreLocalWinsFlag(), false) // 플래그만 소비하고 pull 진행
    : consumeRestoreLocalWinsFlag();

  if (restoreFlag) {
    const localEmpty = await isLocalDataEmpty();
    try {
      const restoredPush = await pushRestoredLocalData(userId);
      if (restoredPush.failed > 0) {
        console.warn('[initialCloudSync] restore push partial failures', restoredPush);
      }
      // 로컬이 비어 있으면(다른 기기·모바일) push만으로는 데이터가 안 생김 → pull 필수
      if (!localEmpty) {
        onEssentialReady?.({
          properties: restoredPush.properties,
          customers: restoredPush.customers,
          restoredLocalWins: true,
        });
        return {
          properties: restoredPush.properties,
          customers: restoredPush.customers,
          schedules: restoredPush.schedules,
          callLogs: restoredPush.callLogs,
          restoredLocalWins: true,
          failed: restoredPush.failed,
          ok: true,
        };
      }
      console.info('[initialCloudSync] restore flag set but local empty — continuing with pull');
    } catch (err) {
      console.error('[initialCloudSync] restore push', err);
      // 로컬이 비어 있으면 pull 시도로 이어감
      if (!(await isLocalDataEmpty())) {
        return { restoredLocalWins: true, ok: false, error: err };
      }
    }
  }

  resetCloudLocalIdMaps();
  /** @type {Record<string, unknown>} */
  const results = {};

  const runOne = async (key, run) => {
    try {
      results[key] = await run();
    } catch (err) {
      console.error(`[initialCloudSync] ${key}`, err);
      results[key] = { ok: false, error: err };
    }
  };

  // 1) 매물·고객 병렬 — 홈/매물 탭에 필요
  await Promise.all([
    runOne('properties', () => initialPropertySync(userId)),
    runOne('customers', () => initialCustomerSync(userId)),
  ]);
  try {
    onEssentialReady?.({
      properties: results.properties,
      customers: results.customers,
    });
  } catch (err) {
    console.warn('[initialCloudSync] onEssentialReady', err);
  }

  // 2) 일정·통화 병렬 — 건수가 많아 백그라운드 체감
  await Promise.all([
    runOne('schedules', () => initialScheduleSync(userId)),
    runOne('callLogs', () => initialCallLogSync(userId)),
  ]);

  try {
    await remapSharedForeignKeys({ schedules: db.schedules, call_logs: db.call_logs });
  } catch (err) {
    console.warn('[initialCloudSync] fk remap', err);
  }
  const failed = ['properties', 'customers', 'schedules', 'callLogs']
    .some((key) => results[key]?.ok === false || results[key]?.error);
  return { ...results, ok: !failed };
}

/**
 * @param {string} userId
 * @param {{ forcePull?: boolean, onEssentialReady?: Function }} [options]
 */
export function initialCloudSync(userId, options = {}) {
  return withSyncMutex(() => initialCloudSyncInner(userId, options));
}

/** 권한 변경 후 공유 데이터 재수신 (diff pull, mutex) */
export async function refreshSharedCloudData(userId) {
  if (!userId || userId === 'dev-local') return { ok: false, reason: 'skip' };
  return withSyncMutex(async () => {
    const { resetCloudLocalIdMaps, remapSharedForeignKeys } = await import('./cloudIdMap.js');
    const { db } = await import('../../db.js');
    const { syncPropertiesFromCloud, pushUnsyncedPropertiesToCloud } = await import('./propertySync.js');
    const { syncCustomersFromCloud } = await import('./customerSync.js');
    const { syncSchedulesFromCloud } = await import('./scheduleSync.js');
    const { syncCallLogsFromCloud } = await import('./callLogSync.js');
    // 직원이 올린 로컬 사진(data URL)을 Storage로 먼저 반영
    try {
      await pushUnsyncedPropertiesToCloud(userId);
    } catch (err) {
      console.warn('[refreshSharedCloudData] property photo push', err);
    }
    resetCloudLocalIdMaps();
    const [properties, customers, schedules, callLogs] = await Promise.all([
      syncPropertiesFromCloud(userId),
      syncCustomersFromCloud(userId),
      syncSchedulesFromCloud(userId),
      syncCallLogsFromCloud(userId),
    ]);
    try {
      await remapSharedForeignKeys({ schedules: db.schedules, call_logs: db.call_logs });
    } catch (err) {
      console.warn('[refreshSharedCloudData] fk remap', err);
    }
    return { ok: true, properties, customers, schedules, callLogs };
  });
}

/** @param {import('../../data/memberPermissions.js').MemberPermissions|null|undefined} permissions */
export function hasAnySharedReadPermission(permissions) {
  if (!permissions) return false;
  return !!(permissions.read_properties || permissions.read_schedules || permissions.read_calls);
}
