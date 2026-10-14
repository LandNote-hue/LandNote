/** 클라우드 JSON에 넣지 않는 로컬 동기화 메타 */

export const SYNC_LOCAL_FIELD_KEYS = [
  'syncStatus',
  'syncRev',
  'syncPushedRev',
  'syncDirtyAt',
  'syncError',
  'syncConflictRemoteAt',
  'cloudUpdatedAt',
  'deleteIntent',
];

export const SYNC_STATUS = {
  PENDING: 'pending',
  SYNCING: 'syncing',
  SYNCED: 'synced',
  FAILED: 'failed',
  CONFLICT: 'conflict',
};

export function newSyncRequestId() {
  if (typeof globalThis.crypto?.randomUUID === 'function') return globalThis.crypto.randomUUID();
  return `req-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

/** @param {Record<string, unknown>|null|undefined} existing */
export function nextDirtyPatch(existing) {
  const prevRev = Number(existing?.syncRev) || 0;
  const keepConflict = existing?.syncStatus === SYNC_STATUS.CONFLICT;
  return {
    syncStatus: keepConflict ? SYNC_STATUS.CONFLICT : SYNC_STATUS.PENDING,
    syncRev: prevRev + 1,
    syncDirtyAt: new Date().toISOString(),
    syncError: keepConflict ? (existing.syncError || null) : null,
    syncRequestId: existing?.syncRequestId || newSyncRequestId(),
  };
}

/** @param {Record<string, unknown>|null|undefined} rec */
export function isLocalSyncPending(rec) {
  if (!rec) return false;
  const status = rec.syncStatus;
  if (
    status === SYNC_STATUS.PENDING
    || status === SYNC_STATUS.FAILED
    || status === SYNC_STATUS.SYNCING
    || status === SYNC_STATUS.CONFLICT
  ) {
    return true;
  }
  const rev = Number(rec.syncRev) || 0;
  const pushed = Number(rec.syncPushedRev) || 0;
  if (rev > pushed) return true;
  return false;
}

/** 레거시: 클라우드 id가 없고 삭제되지 않은 행은 미전송으로 본다 */
export function isUnsyncedLegacy(rec) {
  return !!(rec && !rec.cloudId && !rec.deletedAt);
}

export function hasLocalDataPhotos(rec) {
  return Array.isArray(rec?.photos)
    && rec.photos.some((ph) => typeof ph === 'string' && ph.startsWith('data:'));
}

/** @param {Record<string, unknown>|null|undefined} rec */
export function recordNeedsCloudPush(rec) {
  if (!rec) return false;
  if (rec.syncStatus === SYNC_STATUS.CONFLICT) return false;
  if (rec.deleteIntent) return true;
  if (hasLocalDataPhotos(rec)) return true;
  if (!rec.cloudId) return true;
  if (rec.deletedAt && rec.syncStatus !== SYNC_STATUS.SYNCED) return true;
  return isLocalSyncPending(rec);
}

/**
 * pull 시 로컬 미전송을 원격으로 덮지 않음.
 * 양쪽이 모두 바뀐 경우(원격 updated_at이 마지막 성공 반영보다 최신) conflict.
 * @param {Record<string, unknown>|null} existing
 * @param {Record<string, unknown>} incoming
 * @param {string|null|undefined} remoteUpdatedAt
 */
export function mergeIncomingKeepingLocalPending(existing, incoming, remoteUpdatedAt) {
  if (!existing) {
    return { action: 'apply', record: incoming };
  }
  if (!isLocalSyncPending(existing) && !isUnsyncedLegacy(existing)) {
    return { action: 'apply', record: { ...existing, ...incoming } };
  }

  const lastKnown = String(existing.cloudUpdatedAt || '');
  const remote = String(remoteUpdatedAt || incoming.cloudUpdatedAt || '');
  const remoteChangedSinceKnown = !!(remote && lastKnown && remote !== lastKnown);

  const keptIds = {
    ...existing,
    cloudId: existing.cloudId || incoming.cloudId,
    cloudLocalId: existing.cloudLocalId ?? incoming.cloudLocalId,
    ownerId: existing.ownerId || incoming.ownerId,
    companyId: existing.companyId || incoming.companyId,
  };

  if (remoteChangedSinceKnown) {
    return {
      action: 'conflict',
      record: {
        ...keptIds,
        syncStatus: SYNC_STATUS.CONFLICT,
        syncConflictRemoteAt: remote,
      },
    };
  }

  return { action: 'keep_local', record: keptIds };
}

/**
 * 전송 시작 시점의 rev와 완료 시점 로컬 rev가 다르면 완료 처리하지 않음.
 * @param {Record<string, unknown>|null|undefined} localAfter
 * @param {number} startedRev
 * @param {Record<string, unknown>} extra
 */
export function resolveSyncSuccessPatch(localAfter, startedRev, extra = {}) {
  const latestRev = Number(localAfter?.syncRev) || 0;
  if (latestRev !== Number(startedRev)) {
    return {
      ...extra,
      syncStatus: SYNC_STATUS.PENDING,
      syncError: null,
    };
  }
  return {
    ...extra,
    syncStatus: SYNC_STATUS.SYNCED,
    syncPushedRev: Number(startedRev),
    syncError: null,
    syncConflictRemoteAt: null,
  };
}

/**
 * @param {Record<string, unknown>|null|undefined} rec
 * @param {{ cloudEnabled?: boolean }} [opts]
 */
export function propertySyncUiLabel(rec, opts = {}) {
  const cloudEnabled = opts.cloudEnabled !== false;
  if (!cloudEnabled) {
    return { key: 'device', text: '기기 저장 완료' };
  }
  if (rec?.syncStatus === SYNC_STATUS.CONFLICT) {
    return { key: 'conflict', text: '동기화 충돌' };
  }
  if (rec?.syncStatus === SYNC_STATUS.FAILED) {
    return { key: 'failed', text: '동기화 실패' };
  }
  if (isLocalSyncPending(rec) || isUnsyncedLegacy(rec)) {
    return { key: 'pending', text: '동기화 대기' };
  }
  if (rec?.cloudId) {
    return { key: 'cloud', text: '클라우드 반영 완료' };
  }
  return { key: 'device', text: '기기 저장 완료' };
}

/** @param {{ ok?: boolean, reason?: string, stale?: boolean, skipped?: boolean, conflict?: boolean, failed?: number, conflicts?: number }|null|undefined} syncResult */
export function propertySaveToastMessage(syncResult) {
  const saved = '저장 완료';
  if (!syncResult || syncResult.reason === 'skip' || syncResult.skipped) {
    return saved;
  }
  if (syncResult.conflict || (syncResult.conflicts || 0) > 0) {
    return `${saved} · 동기화 충돌`;
  }
  if ((syncResult.failed || 0) > 0 || syncResult.ok === false) {
    return `${saved} · 동기화 실패`;
  }
  if (syncResult.ok && syncResult.stale) {
    return `${saved} · 동기화 대기`;
  }
  if (syncResult.ok) {
    return saved;
  }
  return `${saved} · 동기화 실패`;
}

/** @param {{ failed?: number, conflicts?: number, pushed?: number, ok?: boolean }} parts */
export function mergeSyncBatchResult(parts) {
  const failed = Number(parts.failed || 0);
  const conflicts = Number(parts.conflicts || 0);
  const pushed = Number(parts.pushed || 0);
  return {
    ...parts,
    failed,
    conflicts,
    pushed,
    ok: failed === 0 && conflicts === 0 && parts.ok !== false,
  };
}
