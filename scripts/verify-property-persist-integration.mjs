import 'fake-indexeddb/auto';
import test from 'node:test';
import assert from 'node:assert/strict';

if (typeof globalThis.localStorage === 'undefined') {
  const store = new Map();
  globalThis.localStorage = {
    getItem: (k) => (store.has(k) ? store.get(k) : null),
    setItem: (k, v) => { store.set(String(k), String(v)); },
    removeItem: (k) => { store.delete(String(k)); },
    clear: () => store.clear(),
  };
}
import { createMemorySupabase } from './testSupport/memorySupabase.mjs';
import { db } from '../src/db.js';
import { nextDirtyPatch, SYNC_STATUS, propertySaveToastMessage } from '../src/utils/recordSyncState.js';
import { validatePropertyForSave } from '../src/utils/propertySaveValidate.js';
import { buildPropertyAddressFields } from '../src/utils/propAddress.js';
import { classifyParcelChange, shouldCommitLookupResult } from '../src/utils/addressLookupSession.js';
import { emptyBuildingForm, emptyLandForm } from '../src/services/publicData/mapToPropertyForm.js';
import {
  applyCommittedLookupToEdit,
  hydrateEditLandFromProperty,
  simulatePropEditHandleSave,
} from '../src/utils/propEditAddressState.js';
import { lookupBlocksPropertySave } from '../src/utils/propertySaveValidate.js';
import { setSyncClientForTests } from '../src/services/sync/syncClient.js';
import { setSyncUserId, setSyncCompanyContext, clearSyncCompanyContext } from '../src/services/sync/syncContext.js';
import {
  syncPropertyToCloud,
  pushUnsyncedPropertiesToCloud,
  initialPropertySync,
} from '../src/services/sync/propertySync.js';
import {
  syncRentalToCloud,
  pushUnsyncedRentalsToCloud,
  initialRentalSync,
} from '../src/services/sync/rentalSync.js';
import { hardDeleteProperty, saveRentalsForProperty } from '../src/db.js';
import { setRemovePropertyPhotosForTests } from '../src/services/sync/propertyPhotoStorage.js';
import { listPhotoCleanupJobs, retryPendingPhotoCleanups } from '../src/services/sync/pendingPhotoCleanup.js';
import { COMPANY_ROLES } from '../src/data/companyRoles.js';

const CEO = 'ceo-user';
const EMP = 'emp-user';
const CO = 'company-1';

async function resetLocal() {
  await db.properties.clear();
  await db.rentals.clear();
}

function baseProp(over = {}) {
  return {
    status: 'ACTIVE',
    trade: 'SALE',
    main: 'COMMERCIAL',
    sub: 'WHOLE_BUILDING',
    addr: '서울 중구 명동 1',
    jibunAddr: '서울 중구 명동 1',
    price: 10000,
    ownerId: EMP,
    companyId: CO,
    ...over,
  };
}

test('충돌 건은 자동 재시도해도 원격을 덮지 않음', async () => {
  const cloud = createMemorySupabase();
  setSyncClientForTests(cloud);
  setSyncUserId(EMP);
  setSyncCompanyContext({ companyId: CO, role: COMPANY_ROLES.MEMBER });
  await resetLocal();
  cloud.seed('properties', {
    id: 10, user_id: EMP, company_id: CO, local_id: 1, updated_at: '2026-02-01T00:00:00.000Z', memo: 'remote-newer',
  });
  await db.properties.add({
    ...baseProp({
      memo: 'local-edit',
      cloudId: 10,
      cloudUpdatedAt: '2026-01-01T00:00:00.000Z',
      syncStatus: SYNC_STATUS.CONFLICT,
      syncRev: 2,
      syncPushedRev: 1,
    }),
  });
  const push = await pushUnsyncedPropertiesToCloud(EMP);
  assert.equal(push.conflicts > 0, true);
  assert.equal(cloud.get('properties', 10).memo, 'remote-newer');
  const local = (await db.properties.toArray())[0];
  assert.equal(local.memo, 'local-edit');
  assert.equal(local.syncStatus, SYNC_STATUS.CONFLICT);
});

test('같은 서버 버전을 두 기기가 수정하면 한쪽은 충돌', async () => {
  const cloud = createMemorySupabase();
  setSyncClientForTests(cloud);
  setSyncUserId(EMP);
  setSyncCompanyContext({ companyId: CO, role: COMPANY_ROLES.MEMBER });
  await resetLocal();
  const remote = cloud.seed('properties', {
    id: 11, user_id: EMP, company_id: CO, local_id: 2, updated_at: '2026-01-01T00:00:00.000Z', memo: 'v1',
  });
  const id = await db.properties.add({
    ...baseProp({
      memo: 'device-A',
      cloudId: 11,
      cloudUpdatedAt: remote.updated_at,
      ...nextDirtyPatch({ syncRev: 0 }),
    }),
  });
  cloud.tables.properties.set('11', { ...cloud.get('properties', 11), memo: 'device-B', updated_at: '2026-01-02T00:00:00.000Z' });
  const result = await syncPropertyToCloud(id, EMP);
  assert.equal(result.conflict, true);
  assert.equal(cloud.get('properties', 11).memo, 'device-B');
  const local = await db.properties.get(id);
  assert.equal(local.memo, 'device-A');
  assert.equal(local.syncStatus, SYNC_STATUS.CONFLICT);
});

test('다른 기기에서 처음 받은 매물 수정도 충돌 검사', async () => {
  const cloud = createMemorySupabase();
  setSyncClientForTests(cloud);
  setSyncUserId(EMP);
  setSyncCompanyContext({ companyId: CO, role: COMPANY_ROLES.MEMBER });
  await resetLocal();
  cloud.seed('properties', {
    id: 12, user_id: EMP, company_id: CO, local_id: 3, updated_at: '2026-03-01T00:00:00.000Z', memo: 'pulled',
  });
  const id = await db.properties.add({
    ...baseProp({
      memo: 'first-local-edit',
      cloudId: 12,
      cloudUpdatedAt: '2026-01-01T00:00:00.000Z',
      syncStatus: SYNC_STATUS.PENDING,
      syncRev: 1,
      syncPushedRev: 0,
    }),
  });
  const result = await syncPropertyToCloud(id, EMP);
  assert.equal(result.conflict, true);
  assert.equal(cloud.get('properties', 12).memo, 'pulled');
});

test('갱신 결과 0건이면 synced가 되지 않음', async () => {
  const cloud = createMemorySupabase();
  setSyncClientForTests(cloud);
  setSyncUserId(EMP);
  setSyncCompanyContext({ companyId: CO, role: COMPANY_ROLES.MEMBER });
  await resetLocal();
  const id = await db.properties.add({
    ...baseProp({
      cloudId: 999,
      cloudUpdatedAt: '2026-01-01T00:00:00.000Z',
      ...nextDirtyPatch(null),
    }),
  });
  const result = await syncPropertyToCloud(id, EMP);
  assert.equal(result.ok, false);
  const local = await db.properties.get(id);
  assert.notEqual(local.syncStatus, SYNC_STATUS.SYNCED);
});

test('대표가 직원 매물 수정 → 전송 실패 → 재시도 성공', async () => {
  const cloud = createMemorySupabase();
  setSyncClientForTests(cloud);
  setSyncUserId(CEO);
  setSyncCompanyContext({ companyId: CO, role: COMPANY_ROLES.CEO });
  await resetLocal();
  cloud.seed('properties', {
    id: 20, user_id: EMP, company_id: CO, local_id: 8, updated_at: '2026-01-01T00:00:00.000Z', memo: 'old',
  });
  const id = await db.properties.add({
    ...baseProp({
      memo: 'ceo-edit',
      cloudId: 20,
      cloudUpdatedAt: '2026-01-01T00:00:00.000Z',
      ownerId: EMP,
      companyId: CO,
      ...nextDirtyPatch(null),
    }),
  });
  cloud.setUpdateGate(async () => { throw new Error('network'); });
  await assert.rejects(() => syncPropertyToCloud(id, CEO));
  let local = await db.properties.get(id);
  assert.equal(local.syncStatus, SYNC_STATUS.FAILED);
  assert.equal(local.ownerId, EMP);
  cloud.setUpdateGate(null);
  const push = await pushUnsyncedPropertiesToCloud(CEO);
  assert.equal(push.ok, true);
  assert.equal(push.pushed >= 1, true);
  const remote = cloud.get('properties', 20);
  assert.equal(remote.data?.memo || remote.memo, 'ceo-edit');
  assert.equal(remote.user_id, EMP);
  local = await db.properties.get(id);
  assert.equal(local.syncStatus, SYNC_STATUS.SYNCED);
});

test('전송 중 추가 수정은 이전 성공으로 최신을 완료 처리하지 않음', async () => {
  const cloud = createMemorySupabase({ updateDelayMs: 30 });
  setSyncClientForTests(cloud);
  setSyncUserId(EMP);
  setSyncCompanyContext({ companyId: CO, role: COMPANY_ROLES.MEMBER });
  await resetLocal();
  cloud.seed('properties', {
    id: 21, user_id: EMP, company_id: CO, local_id: 9, updated_at: '2026-01-01T00:00:00.000Z', memo: 'v1',
  });
  const id = await db.properties.add({
    ...baseProp({
      memo: 'edit-1',
      cloudId: 21,
      cloudUpdatedAt: '2026-01-01T00:00:00.000Z',
      syncStatus: SYNC_STATUS.PENDING,
      syncRev: 1,
      syncPushedRev: 0,
    }),
  });
  const pending = syncPropertyToCloud(id, EMP);
  await new Promise((r) => setTimeout(r, 5));
  const cur = await db.properties.get(id);
  await db.properties.update(id, { memo: 'edit-2', ...nextDirtyPatch(cur) });
  const result = await pending;
  assert.equal(result.stale, true);
  const local = await db.properties.get(id);
  assert.equal(local.memo, 'edit-2');
  assert.notEqual(local.syncStatus, SYNC_STATUS.SYNCED);
});

test('주소 없이 매각중 저장·일괄 전환 차단', () => {
  const empty = { ...buildPropertyAddressFields({}), status: 'ACTIVE', trade: 'SALE', main: 'COMMERCIAL', price: 10000 };
  assert.equal(empty.addr, '주소 미입력');
  assert.equal(validatePropertyForSave(empty).ok, false);
  assert.equal(validatePropertyForSave({
    status: 'ACTIVE', trade: 'SALE', main: 'COMMERCIAL', price: 10000,
    jibunAddr: '서울 중구 명동 1-1', addr: '서울 중구 명동 1-1',
  }).ok, true);
  assert.equal(validatePropertyForSave({ status: 'NEW', addr: '주소 미입력' }).ok, true);
});

test('수정 화면: A 로드 후 B 조회 실패·늦은 A·부분 응답이 저장에 섞이지 않음', () => {
  const propA = {
    id: 1,
    jibunAddr: '서울 중구 명동 1',
    roadAddr: '서울 중구 명동길 1',
    pnu: '1111111111',
    land: 100.5,
    officialLandPrice: '10,000',
    zoning: '일반상업',
    floorsAbove: 5,
    extraParcels: [],
  };
  const hydrated = hydrateEditLandFromProperty(propA);
  let screen = {
    ...hydrated,
    landForm: hydrated.landEdit,
    buildingForm: hydrated.buildingEdit,
    locationForm: { jibunAddr: propA.jibunAddr, roadAddr: propA.roadAddr },
    extraParcels: [],
  };
  assert.equal(Number(screen.landEdit.landAreaM2), 100.5);
  assert.equal(lookupBlocksPropertySave({ status: 'unverified' }, false), false);

  const bKeys = { pnu: '2222222222', jibunAddr: '서울 중구 을지로 2' };
  const emptyLand = emptyLandForm();
  const emptyBld = emptyBuildingForm();
  screen = applyCommittedLookupToEdit(screen, {
    gen: 2,
    ident: 'pnu:2222222222',
    activeGen: 2,
    activeIdent: 'pnu:2222222222',
    lookup: { status: 'loading', parcelChanged: true },
    landForm: emptyLand,
    buildingForm: emptyBld,
    addressKeys: bKeys,
    locationForm: { jibunAddr: bKeys.jibunAddr, roadAddr: '' },
  });
  assert.equal(screen.landEdit.landAreaM2, '');

  const lateA = applyCommittedLookupToEdit(screen, {
    gen: 1,
    ident: 'pnu:1111111111',
    activeGen: 2,
    activeIdent: 'pnu:2222222222',
    lookup: { status: 'success', parcelChanged: false },
    landForm: hydrated.landEdit,
    buildingForm: hydrated.buildingEdit,
  });
  assert.equal(lateA.landEdit.landAreaM2, '');
  assert.equal(shouldCommitLookupResult(2, 1, 'pnu:2222222222', 'pnu:1111111111'), false);

  screen = applyCommittedLookupToEdit(screen, {
    gen: 2,
    ident: 'pnu:2222222222',
    activeGen: 2,
    activeIdent: 'pnu:2222222222',
    lookup: { status: 'unverified', parcelChanged: true, error: 'fail' },
    landForm: emptyLand,
    buildingForm: emptyBld,
    addressKeys: bKeys,
    locationForm: { jibunAddr: bKeys.jibunAddr, roadAddr: '' },
  });
  const savedFail = simulatePropEditHandleSave({ ...screen, extraParcels: [] });
  assert.equal(savedFail.jibunAddr, '서울 중구 을지로 2');
  assert.equal(savedFail.land, 0);
  assert.notEqual(String(savedFail.officialLandPrice || ''), '10,000');
  assert.equal(savedFail.addressUnverified, true);
  assert.notEqual(savedFail.floorsAbove, 5);

  const partialB = applyCommittedLookupToEdit(screen, {
    gen: 3,
    ident: 'pnu:2222222222',
    activeGen: 3,
    activeIdent: 'pnu:2222222222',
    lookup: { status: 'success', parcelChanged: false },
    landForm: { ...emptyLandForm(), landUseZone: '근린상업' },
    buildingForm: emptyBld,
    addressKeys: bKeys,
    locationForm: { jibunAddr: bKeys.jibunAddr, roadAddr: '' },
  });
  const savedPartial = simulatePropEditHandleSave({ ...partialB, extraParcels: [] });
  assert.equal(savedPartial.land, 0);
  assert.equal(savedPartial.zoning, '근린상업');
  assert.notEqual(Number(savedPartial.land), 100.5);

  const sameA = {
    ...hydrated,
    landForm: hydrated.landEdit,
    buildingForm: hydrated.buildingEdit,
    locationForm: { jibunAddr: propA.jibunAddr, roadAddr: propA.roadAddr },
    extraParcels: [],
  };
  const refetchFail = applyCommittedLookupToEdit(sameA, {
    gen: 1,
    ident: 'pnu:1111111111',
    activeGen: 1,
    activeIdent: 'pnu:1111111111',
    lookup: { status: 'error', parcelChanged: false, error: 'fail' },
    landForm: emptyLand,
    buildingForm: emptyBld,
  });
  const savedKeep = simulatePropEditHandleSave({ ...refetchFail, extraParcels: [] });
  assert.equal(Number(savedKeep.land), 100.5);
  assert.equal(classifyParcelChange({ pnu: '1111111111' }, { pnu: '2222222222' }).parcelChanged, true);
});

test('임대차 추가·수정·삭제 부모 연결 재시도', async () => {
  const cloud = createMemorySupabase();
  setSyncClientForTests(cloud);
  setSyncUserId(EMP);
  setSyncCompanyContext({ companyId: CO, role: COMPANY_ROLES.MEMBER });
  await resetLocal();
  cloud.seed('properties', {
    id: 30, user_id: EMP, company_id: CO, local_id: 30, updated_at: '2026-01-01T00:00:00.000Z',
  });
  const pid = await db.properties.add({
    ...baseProp({ cloudId: 30, cloudLocalId: 30, cloudUpdatedAt: '2026-01-01T00:00:00.000Z', syncStatus: SYNC_STATUS.SYNCED, syncRev: 1, syncPushedRev: 1 }),
  });
  const syncAdd = await saveRentalsForProperty(pid, [
    { floor: '1', tenant: 'A', dep: 1000, rent: 50, maint: 10, leaseEnd: '2027-01-01' },
  ]);
  assert.equal(syncAdd.ok, true);
  const rows = await db.rentals.where('pid').equals(pid).toArray();
  assert.equal(rows.length, 1);
  assert.equal(rows[0].cloudPid, 30);
  const rid = rows[0].id;
  assert.ok(cloud.get('rentals', rows[0].cloudId));
  await db.rentals.update(rid, { tenant: 'A2', ...nextDirtyPatch(rows[0]) });
  cloud.setUpdateGate(async () => { throw new Error('net'); });
  await assert.rejects(() => syncRentalToCloud(rid, EMP));
  cloud.setUpdateGate(null);
  const retry = await pushUnsyncedRentalsToCloud(EMP);
  assert.equal(retry.ok, true);
  const syncDel = await saveRentalsForProperty(pid, []);
  assert.equal(syncDel.ok, true);
  const afterDel = await db.rentals.get(rid);
  assert.ok(afterDel.deletedAt);
});

test('영구 삭제: 충돌·통신·권한·버전 없음은 로컬·사진 보존, 성공 후에만 제거', async () => {
  const cloud = createMemorySupabase();
  setSyncClientForTests(cloud);
  setSyncUserId(EMP);
  setSyncCompanyContext({ companyId: CO, role: COMPANY_ROLES.MEMBER });
  await resetLocal();
  localStorage.removeItem('landnote.pendingPhotoCleanup');
  let photoCalls = 0;
  setRemovePropertyPhotosForTests(async () => { photoCalls += 1; });

  cloud.seed('properties', {
    id: 40, user_id: EMP, company_id: CO, local_id: 40,
    updated_at: '2026-02-01T00:00:00.000Z', created_at: '2026-01-01T00:00:00.000Z',
  });
  const conflictId = await db.properties.add({
    ...baseProp({
      photos: ['https://cdn.example/a.jpg'],
      cloudId: 40,
      cloudUpdatedAt: '2026-01-01T00:00:00.000Z',
      syncStatus: SYNC_STATUS.SYNCED,
      syncRev: 1,
      syncPushedRev: 1,
    }),
  });
  const conflict = await hardDeleteProperty(conflictId);
  assert.equal(conflict.ok, false);
  assert.equal(conflict.conflict, true);
  assert.ok(await db.properties.get(conflictId));
  assert.ok(cloud.get('properties', 40));
  assert.equal(photoCalls, 0);
  assert.equal((await db.properties.get(conflictId)).deleteIntent, true);
  const auto = await pushUnsyncedPropertiesToCloud(EMP);
  assert.equal(auto.conflicts > 0, true);
  assert.ok(await db.properties.get(conflictId));

  cloud.seed('properties', {
    id: 41, user_id: EMP, company_id: CO, local_id: 41,
    updated_at: '2026-01-01T00:00:00.000Z', created_at: '2026-01-01T00:00:00.000Z',
  });
  const netId = await db.properties.add({
    ...baseProp({
      photos: ['https://cdn.example/b.jpg'],
      cloudId: 41,
      cloudUpdatedAt: '2026-01-01T00:00:00.000Z',
      syncStatus: SYNC_STATUS.SYNCED,
      syncRev: 1,
      syncPushedRev: 1,
    }),
  });
  cloud.setDeleteGate(async () => { throw new Error('offline'); });
  const net = await hardDeleteProperty(netId);
  cloud.setDeleteGate(null);
  assert.equal(net.ok, false);
  assert.equal(net.reason, 'network');
  assert.ok(await db.properties.get(netId));
  assert.ok(cloud.get('properties', 41));
  assert.equal(photoCalls, 0);

  const forbiddenId = await db.properties.add({
    ...baseProp({
      ownerId: 'other-user',
      photos: ['https://cdn.example/c.jpg'],
      cloudId: 99,
      cloudUpdatedAt: '2026-01-01T00:00:00.000Z',
    }),
  });
  const forbidden = await hardDeleteProperty(forbiddenId);
  assert.equal(forbidden.reason, 'forbidden');
  assert.ok(await db.properties.get(forbiddenId));
  assert.equal(photoCalls, 0);

  const hiddenId = await db.properties.add({
    ...baseProp({
      photos: ['https://cdn.example/hidden.jpg'],
      cloudId: 88,
      cloudUpdatedAt: '2026-01-01T00:00:00.000Z',
      syncStatus: SYNC_STATUS.SYNCED,
      syncRev: 1,
      syncPushedRev: 1,
    }),
  });
  const hidden = await hardDeleteProperty(hiddenId);
  assert.equal(hidden.ok, false);
  assert.equal(hidden.reason, 'missing_or_forbidden');
  assert.ok(await db.properties.get(hiddenId));
  assert.equal(photoCalls, 0);

  cloud.seed('properties', {
    id: 42, user_id: EMP, company_id: CO, local_id: 42,
    updated_at: '2026-01-01T00:00:00.000Z',
  });
  const noVerId = await db.properties.add({
    ...baseProp({
      photos: ['https://cdn.example/d.jpg'],
      cloudId: 42,
      cloudUpdatedAt: null,
      syncStatus: SYNC_STATUS.SYNCED,
      syncRev: 1,
      syncPushedRev: 1,
    }),
  });
  const noVer = await hardDeleteProperty(noVerId);
  assert.equal(noVer.ok, false);
  assert.equal(noVer.reason, 'no_version');
  assert.ok(await db.properties.get(noVerId));
  assert.ok(cloud.get('properties', 42));
  assert.equal(photoCalls, 0);

  cloud.seed('properties', {
    id: 43, user_id: EMP, company_id: CO, local_id: 43,
    updated_at: '2026-01-01T00:00:00.000Z',
  });
  const okId = await db.properties.add({
    ...baseProp({
      photos: ['https://cdn.example/e.jpg'],
      cloudId: 43,
      cloudUpdatedAt: '2026-01-01T00:00:00.000Z',
      syncStatus: SYNC_STATUS.SYNCED,
      syncRev: 1,
      syncPushedRev: 1,
    }),
  });
  const ok = await hardDeleteProperty(okId);
  assert.equal(ok.ok, true);
  assert.equal(await db.properties.get(okId), undefined);
  assert.equal(cloud.get('properties', 43), undefined);
  assert.equal(photoCalls, 1);

  const localOnlyId = await db.properties.add(baseProp({ photos: ['data:image/png;base64,xx'] }));
  const localOnly = await hardDeleteProperty(localOnlyId);
  assert.equal(localOnly.localOnly, true);
  assert.equal(await db.properties.get(localOnlyId), undefined);

  setRemovePropertyPhotosForTests(null);
});

test('영구 삭제: 사진 정리 실패는 재시도하고 로컬은 서버 성공 후 제거', async () => {
  const cloud = createMemorySupabase();
  setSyncClientForTests(cloud);
  setSyncUserId(EMP);
  setSyncCompanyContext({ companyId: CO, role: COMPANY_ROLES.MEMBER });
  await resetLocal();
  localStorage.removeItem('landnote.pendingPhotoCleanup');
  let photoCalls = 0;
  setRemovePropertyPhotosForTests(async () => {
    photoCalls += 1;
    if (photoCalls === 1) throw new Error('storage-fail');
  });
  cloud.seed('properties', {
    id: 44, user_id: EMP, company_id: CO, local_id: 44,
    updated_at: '2026-01-01T00:00:00.000Z',
  });
  const id = await db.properties.add({
    ...baseProp({
      photos: ['https://cdn.example/f.jpg'],
      cloudId: 44,
      cloudUpdatedAt: '2026-01-01T00:00:00.000Z',
      syncStatus: SYNC_STATUS.SYNCED,
      syncRev: 1,
      syncPushedRev: 1,
    }),
  });
  const result = await hardDeleteProperty(id);
  assert.equal(result.ok, true);
  assert.equal(result.photosFailed, true);
  assert.equal(await db.properties.get(id), undefined);
  assert.equal(cloud.get('properties', 44), undefined);
  assert.equal(listPhotoCleanupJobs().length, 1);
  const retry = await retryPendingPhotoCleanups(async (job) => {
    photoCalls += 1;
    if (!job.cloudId) throw new Error('missing');
  });
  assert.equal(retry.ok, true);
  assert.equal(listPhotoCleanupJobs().length, 0);
  setRemovePropertyPhotosForTests(null);
});

test('등록 재시도: 응답 유실은 중복 없이 완료, 타기기 수정·같은 로컬번호는 덮지 않음', async () => {
  const cloud = createMemorySupabase();
  setSyncClientForTests(cloud);
  setSyncUserId(EMP);
  setSyncCompanyContext({ companyId: CO, role: COMPANY_ROLES.MEMBER });
  await resetLocal();

  const lostId = await db.properties.add({
    ...baseProp({ memo: 'first-insert', ...nextDirtyPatch(null) }),
  });
  const lostLocal = await db.properties.get(lostId);
  const t0 = '2026-01-01T00:00:00.000Z';
  cloud.seed('properties', {
    id: 70,
    user_id: EMP,
    company_id: CO,
    local_id: lostId,
    created_at: t0,
    updated_at: t0,
    data: { memo: 'first-insert', syncRequestId: lostLocal.syncRequestId },
  });
  const retryLost = await syncPropertyToCloud(lostId, EMP);
  assert.equal(retryLost.ok, true);
  assert.equal(cloud.count('properties'), 1);
  assert.equal((await db.properties.get(lostId)).cloudId, 70);

  await resetLocal();
  cloud.tables.properties.clear();
  const mutId = await db.properties.add({
    ...baseProp({ memo: 'local-original', ...nextDirtyPatch(null) }),
  });
  const mutLocal = await db.properties.get(mutId);
  cloud.seed('properties', {
    id: 71, user_id: EMP, company_id: CO, local_id: mutId,
    created_at: t0, updated_at: '2026-06-01T00:00:00.000Z',
    data: { memo: 'other-device-newer', syncRequestId: mutLocal.syncRequestId },
  });
  const mutRetry = await syncPropertyToCloud(mutId, EMP);
  assert.equal(mutRetry.conflict, true);
  assert.equal(cloud.get('properties', 71).data.memo, 'other-device-newer');
  assert.equal((await db.properties.get(mutId)).memo, 'local-original');
  assert.equal(cloud.count('properties'), 1);

  await resetLocal();
  cloud.tables.properties.clear();
  cloud.seed('properties', {
    id: 80, user_id: EMP, company_id: CO, local_id: 1,
    created_at: '2026-01-01T00:00:00.000Z',
    updated_at: '2026-01-01T00:00:00.000Z',
    data: { syncRequestId: 'device-other', memo: 'theirs' },
  });
  const collideId = await db.properties.add({
    ...baseProp({
      memo: 'mine',
      cloudLocalId: 1,
      ...nextDirtyPatch(null),
    }),
  });
  const collide = await syncPropertyToCloud(collideId, EMP);
  assert.equal(collide.conflict, true);
  assert.equal(cloud.get('properties', 80).data.memo, 'theirs');
  assert.equal((await db.properties.get(collideId)).memo, 'mine');
  assert.equal((await db.properties.get(collideId)).cloudId, undefined);
});

test('임대차 등록 재시도도 동일 요청만 재사용하고 타기기 내용은 덮지 않음', async () => {
  const cloud = createMemorySupabase();
  setSyncClientForTests(cloud);
  setSyncUserId(EMP);
  setSyncCompanyContext({ companyId: CO, role: COMPANY_ROLES.MEMBER });
  await resetLocal();
  cloud.seed('properties', {
    id: 30, user_id: EMP, company_id: CO, local_id: 30, updated_at: '2026-01-01T00:00:00.000Z',
  });
  const pid = await db.properties.add({
    ...baseProp({
      cloudId: 30, cloudLocalId: 30, cloudUpdatedAt: '2026-01-01T00:00:00.000Z',
      syncStatus: SYNC_STATUS.SYNCED, syncRev: 1, syncPushedRev: 1,
    }),
  });
  await saveRentalsForProperty(pid, [
    { floor: '1', tenant: 'lost-resp', dep: 100, rent: 10, maint: 0, leaseEnd: '2027-01-01' },
  ]);
  const row = (await db.rentals.where('pid').equals(pid).toArray())[0];
  assert.equal(cloud.count('rentals'), 1);
  const rid = row.id;
  const rCloudId = row.cloudId;
  const rReq = row.syncRequestId;
  await db.rentals.update(rid, {
    cloudId: null,
    cloudUpdatedAt: null,
    syncStatus: SYNC_STATUS.PENDING,
    syncPushedRev: 0,
    syncRequestId: rReq,
  });
  const remoteFresh = cloud.get('rentals', rCloudId);
  cloud.tables.rentals.set(String(rCloudId), {
    ...remoteFresh,
    created_at: remoteFresh.created_at || remoteFresh.updated_at,
    updated_at: remoteFresh.created_at || remoteFresh.updated_at,
  });
  const retry = await syncRentalToCloud(rid, EMP);
  assert.equal(retry.ok, true);
  assert.equal(cloud.count('rentals'), 1);

  const remote = cloud.get('rentals', rCloudId);
  await db.rentals.update(rid, {
    cloudId: null,
    cloudUpdatedAt: null,
    syncStatus: SYNC_STATUS.PENDING,
    syncPushedRev: 0,
    syncRequestId: rReq,
    tenant: 'lost-resp',
  });
  cloud.tables.rentals.set(String(rCloudId), {
    ...remote,
    updated_at: '2026-06-01T00:00:00.000Z',
    data: { ...remote.data, tenant: 'other-device' },
  });
  const mutated = await syncRentalToCloud(rid, EMP);
  assert.equal(mutated.conflict, true);
  assert.equal(cloud.get('rentals', rCloudId).data.tenant, 'other-device');
  assert.equal((await db.rentals.get(rid)).tenant, 'lost-resp');

  await db.rentals.clear();
  cloud.tables.rentals.clear();
  cloud.seed('rentals', {
    id: 90, user_id: EMP, company_id: CO, local_id: 7,
    created_at: '2026-01-01T00:00:00.000Z',
    updated_at: '2026-01-01T00:00:00.000Z',
    data: { syncRequestId: 'other-rental', tenant: 'theirs' },
  });
  const collideRid = await db.rentals.add({
    pid,
    tenant: 'mine',
    cloudLocalId: 7,
    ownerId: EMP,
    companyId: CO,
    ...nextDirtyPatch(null),
  });
  const collide = await syncRentalToCloud(collideRid, EMP);
  assert.equal(collide.conflict, true);
  assert.equal(cloud.get('rentals', 90).data.tenant, 'theirs');
  assert.equal((await db.rentals.get(collideRid)).tenant, 'mine');
});

test('하위 전송 실패가 전체 결과와 저장 안내에 반영됨', async () => {
  const cloud = createMemorySupabase();
  setSyncClientForTests(cloud);
  setSyncUserId(EMP);
  setSyncCompanyContext({ companyId: CO, role: COMPANY_ROLES.MEMBER });
  await resetLocal();
  await db.properties.add({
    ...baseProp({
      cloudId: 404,
      cloudUpdatedAt: '2026-01-01T00:00:00.000Z',
      ...nextDirtyPatch(null),
    }),
  });
  const initial = await initialPropertySync(EMP, { skipPrune: true });
  assert.equal(initial.ok, false);
  assert.equal(initial.failed > 0, true);
  const msg = propertySaveToastMessage(initial);
  assert.match(msg, /동기화 실패/);
  const rentals = await initialRentalSync(EMP, { skipPrune: true });
  assert.equal(rentals.ok, true);
  clearSyncCompanyContext();
  setSyncClientForTests(null);
});
