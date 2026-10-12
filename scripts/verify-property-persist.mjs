import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  nextDirtyPatch,
  isLocalSyncPending,
  recordNeedsCloudPush,
  mergeIncomingKeepingLocalPending,
  resolveSyncSuccessPatch,
  propertySaveToastMessage,
  propertySyncUiLabel,
  SYNC_STATUS,
} from '../src/utils/recordSyncState.js';
import { validatePropertyForSave, lookupBlocksPropertySave } from '../src/utils/propertySaveValidate.js';
import { extrasWithoutPrimary, parcelIdentityKey } from '../src/utils/propertyParcels.js';
import { isPersistedRentalLocalId } from '../src/services/sync/rentalSyncLogic.js';

test('수정 실패 후 재시도 대상: cloudId 있고 사진 없어도 pending이면 push', () => {
  const rec = { id: 1, cloudId: 99, photos: ['https://cdn.example/a.jpg'], ...nextDirtyPatch({ syncRev: 0 }) };
  assert.equal(recordNeedsCloudPush(rec), true);
  const synced = { id: 1, cloudId: 99, photos: [], syncStatus: 'synced', syncRev: 1, syncPushedRev: 1 };
  assert.equal(recordNeedsCloudPush(synced), false);
});

test('미전송 로컬을 클라우드 조회가 덮지 않음', () => {
  const local = {
    id: 1,
    cloudId: 10,
    memo: '로컬 수정',
    price: 100,
    syncStatus: 'pending',
    syncRev: 2,
    syncPushedRev: 1,
    cloudUpdatedAt: '2026-01-01T00:00:00.000Z',
  };
  const incoming = { id: 1, cloudId: 10, memo: '원격', price: 50, cloudUpdatedAt: '2026-01-01T00:00:00.000Z' };
  const kept = mergeIncomingKeepingLocalPending(local, incoming, '2026-01-01T00:00:00.000Z');
  assert.equal(kept.action, 'keep_local');
  assert.equal(kept.record.memo, '로컬 수정');
  assert.equal(kept.record.price, 100);
});

test('양쪽 수정이면 conflict (조용히 덮지 않음)', () => {
  const local = {
    memo: '로컬',
    syncStatus: 'pending',
    syncRev: 2,
    syncPushedRev: 1,
    cloudUpdatedAt: '2026-01-01T00:00:00.000Z',
  };
  const incoming = { memo: '원격', cloudUpdatedAt: '2026-02-01T00:00:00.000Z' };
  const r = mergeIncomingKeepingLocalPending(local, incoming, '2026-02-01T00:00:00.000Z');
  assert.equal(r.action, 'conflict');
  assert.equal(r.record.memo, '로컬');
  assert.equal(r.record.syncStatus, SYNC_STATUS.CONFLICT);
});

test('전송 중 추가 수정: 이전 rev 성공으로 완료 처리하지 않음', () => {
  const startedRev = 1;
  const after = { syncRev: 2, memo: '더 최신' };
  const patch = resolveSyncSuccessPatch(after, startedRev, { cloudId: 5 });
  assert.equal(patch.syncStatus, SYNC_STATUS.PENDING);
  assert.equal(patch.syncPushedRev, undefined);
  const done = resolveSyncSuccessPatch({ syncRev: 1 }, 1, { cloudId: 5, cloudUpdatedAt: 't' });
  assert.equal(done.syncStatus, SYNC_STATUS.SYNCED);
  assert.equal(done.syncPushedRev, 1);
});

test('토스트 문구 구분', () => {
  assert.equal(propertySaveToastMessage({ reason: 'skip' }), '기기 저장 완료');
  assert.equal(propertySaveToastMessage({ ok: true }), '기기 저장 완료 · 클라우드 반영 완료');
  assert.equal(propertySaveToastMessage({ ok: true, stale: true }), '기기 저장 완료 · 동기화 대기');
  assert.equal(propertySaveToastMessage({ ok: false }), '기기 저장 완료 · 동기화 실패');
  assert.equal(propertySyncUiLabel({ syncStatus: 'failed' }).text, '동기화 실패');
});

test('매각중 검증: 주소·종류·매도호가 / 준비중은 허용', () => {
  assert.equal(validatePropertyForSave({ status: 'NEW' }).ok, true);
  assert.equal(validatePropertyForSave({ status: 'ACTIVE', trade: 'SALE' }).ok, false);
  assert.equal(validatePropertyForSave({
    status: 'ACTIVE', trade: 'SALE', addr: '서울 중구 1', main: 'COMMERCIAL', price: 10000,
  }).ok, true);
  assert.equal(validatePropertyForSave({
    status: 'ACTIVE', trade: 'SALE', addr: '서울 중구 1', main: 'COMMERCIAL', price: 0,
  }).ok, false);
});

test('조회 중 저장 차단', () => {
  assert.equal(lookupBlocksPropertySave({ status: 'loading' }, false), true);
  assert.equal(lookupBlocksPropertySave({ status: 'error' }, true), true);
  assert.equal(lookupBlocksPropertySave({ status: 'error' }, false), false);
  assert.equal(lookupBlocksPropertySave({ status: 'success' }, false), false);
});

test('대표 필지를 기존 추가 필지로 바꾸면 중복 합산 제외', () => {
  const extras = [
    { addressKeys: { pnu: '111' }, landForm: { landAreaM2: '10' } },
    { addressKeys: { pnu: '222' }, landForm: { landAreaM2: '20' } },
  ];
  const left = extrasWithoutPrimary(extras, { pnu: '111' });
  assert.equal(left.length, 1);
  assert.equal(parcelIdentityKey(left[0].addressKeys), 'pnu:222');
});

test('임대차 임시 Date.now id는 신규, Dexie id는 유지', () => {
  assert.equal(isPersistedRentalLocalId(3), true);
  assert.equal(isPersistedRentalLocalId(Date.now()), false);
});

test('삭제 의도+충돌은 자동 push 대상이 아님', () => {
  assert.equal(recordNeedsCloudPush({
    cloudId: 1, deleteIntent: true, syncStatus: 'conflict',
  }), false);
  assert.equal(recordNeedsCloudPush({
    cloudId: 1, deleteIntent: true, syncStatus: 'failed',
  }), true);
});

test('레거시 미전송(cloudId 없음)은 pending으로 본다', () => {
  assert.equal(isLocalSyncPending({ syncStatus: 'pending' }), true);
  assert.equal(recordNeedsCloudPush({ id: 1 }), true);
});

test('033 진단 SQL은 자료 변경 없이 분리되어 있다 (정적)', () => {
  const root = join(dirname(fileURLToPath(import.meta.url)), '..');
  const mig = readFileSync(join(root, 'supabase/migrations/033_rentals_property_cloud_id.sql'), 'utf8');
  const diag = readFileSync(join(root, 'supabase/diagnostics/033_rentals_property_cloud_id.sql'), 'utf8');
  const stripSqlComments = (s) => s.replace(/--[^\n]*/g, '');
  const diagCode = stripSqlComments(diag);
  const doBlock = stripSqlComments(mig.match(/do \$\$[\s\S]*?end \$\$;/i)?.[0] || '');
  assert.match(doBlock, /raise exception/i);
  assert.doesNotMatch(doBlock, /\binsert\b/i);
  assert.doesNotMatch(diagCode, /\b(insert|update|delete)\b/i);
  assert.match(diagCode, /select /i);
});
