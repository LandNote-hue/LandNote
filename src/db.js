import Dexie from 'dexie';
import { normalizeCustomerRecord } from './utils/customerTypes.js';
import { looksLikeEokStored, EOK_TO_MAN, parseMoneyManOrNull } from './utils/formatMoney.js';
import { DEV_LOCAL_OWNER, getActiveOwnerId, withOwnerId, canMutateRecord } from './services/sync/ownerScope.js';
import { getSyncCompanyId } from './services/sync/syncContext.js';
import { customerPhoneKey } from './utils/formatPhone.js';

async function afterPropertyChange(id) {
  const { syncPropertyAfterChange } = await import('./services/sync/propertySync.js');
  await syncPropertyAfterChange(id);
}

async function afterCustomerChange(id) {
  const { syncCustomerAfterChange } = await import('./services/sync/customerSync.js');
  await syncCustomerAfterChange(id);
}

async function removeCustomerFromCloud(id) {
  const { deleteCustomerFromCloud } = await import('./services/sync/customerSync.js');
  await deleteCustomerFromCloud(id);
}

async function removePropertyFromCloud(id) {
  const { deletePropertyFromCloud } = await import('./services/sync/propertySync.js');
  await deletePropertyFromCloud(id);
}

async function removeScheduleFromCloud(id) {
  const { deleteScheduleFromCloud } = await import('./services/sync/scheduleSync.js');
  await deleteScheduleFromCloud(id);
}

async function removeCallLogFromCloud(id) {
  const { deleteCallLogFromCloud } = await import('./services/sync/callLogSync.js');
  await deleteCallLogFromCloud(id);
}

async function afterScheduleChange(id) {
  const { syncScheduleAfterChange } = await import('./services/sync/scheduleSync.js');
  await syncScheduleAfterChange(id);
}

async function afterCallLogChange(id) {
  const { syncCallLogAfterChange } = await import('./services/sync/callLogSync.js');
  await syncCallLogAfterChange(id);
}

/** @param {import('dexie').Table} table @param {number} id @param {import('./data/memberPermissions.js').ShareResource} [resource] */
async function assertOwned(table, id, resource = 'properties') {
  const rec = await table.get(id);
  if (!rec) throw new Error('NOT_FOUND');
  if (!canMutateRecord(rec, resource)) throw new Error('FORBIDDEN');
  return rec;
}

const withDeletedAt = (items) => items.map((item) => ({ ...item, deletedAt: null }));
const withDevOwner = (items) => items.map((item) => ({ ...item, ownerId: DEV_LOCAL_OWNER }));

const SEED_PROPERTIES = withDevOwner(withDeletedAt([
  { id: 1, main: 'COMMERCIAL', sub: 'WHOLE_BUILDING', status: 'ACTIVE', pub: true, fav: true, favAt: '2026-06-01T00:00:00.000Z',
    addr: '서울 영등포구 영등포동 3-1', bldg: '영등포 오피스빌딩', trade: 'SALE',
    price: 4300000, land: 934.9, floor: 6060, roi: '0.56%', tag: '상가건물',
    lastCall: '2026.06.26', created: '2026.06.01',
    promo: '영등포 핵심 상권. B2~11F 총 6,060㎡.', memo: '소유주 급매 의사. 2~4층 공실.',
    jibunAddr: '서울 영등포구 영등포동 3-1', ownerTel: '02-000-1234', roadInfo: '8m × 4m',
    zoning: '일반상업지역', landCategory: '대', officialLandPrice: '33,000,000', baseYear: '2025',
    farArea: 5820.1, buildingArea: 462.28, buildingCoverage: 49.44, floorAreaRatio: 526.75,
    floorsAbove: 11, floorsBelow: 2, parking: 39, elevators: 2,
    structure: '철근콘크리트', mainUse: '제2종근린생활', approvalDate: '1985-10-18',
    loan: 500000, leaseEnd: '', premium: 0, realInvest: '' },
  { id: 2, main: 'APT_OFFICETEL', sub: 'APARTMENT', status: 'NEW', pub: true, fav: false, addr: '서울 강남구 역삼동 123', bldg: '역삼 SK뷰', trade: 'SALE', price: 250000, land: 0, floor: 84.2, roi: '—', tag: '아파트', lastCall: '2026.06.18', created: '2026.06.15', promo: '역삼역 도보 5분. 남향 고층.', memo: '', jibunAddr: '', ownerTel: '', roadInfo: '', zoning: '', landCategory: '', officialLandPrice: '', baseYear: '', farArea: 0, buildingArea: 0, buildingCoverage: 0, floorAreaRatio: 0, floorsAbove: 0, floorsBelow: 0, parking: 0, elevators: 0, structure: '', mainUse: '', approvalDate: '', loan: 0, leaseEnd: '', premium: 0, realInvest: '' },
  { id: 3, main: 'COMMERCIAL', sub: 'OFFICE', status: 'HOLD', pub: false, fav: false, addr: '서울 마포구 서교동 400', bldg: '홍대 오피스', trade: 'MONTHLY', price: 0, mDep: 5000, mRent: 350, land: 110, floor: 220, roi: '—', tag: '사무실', lastCall: '—', created: '2026.05.20', promo: '', memo: '인테리어 조건 협의 중' },
  { id: 4, main: 'VILLA_HOUSE', sub: 'VILLA', status: 'COMPLETED', pub: true, fav: false, addr: '경기 성남시 분당구 정자동 88', bldg: '정자 그린빌', trade: 'JEONSE', jDep: 35000, land: 0, floor: 72, roi: '—', tag: '빌라', lastCall: '2026.05.30', created: '2026.04.10', promo: '', memo: '' },
  { id: 5, main: 'COMMERCIAL', sub: 'LAND', status: 'ACTIVE', pub: true, fav: false, addr: '경기 하남시 망월동 290', bldg: '', trade: 'SALE', price: 480000, land: 495, floor: 0, roi: '—', tag: '토지', lastCall: '2026.06.22', created: '2026.06.22', promo: '개발 가능 토지.', memo: '' },
  { id: 6, main: 'APT_OFFICETEL', sub: 'OFFICETEL_RESI', status: 'ACTIVE', pub: true, fav: false, addr: '서울 성동구 성수동1가 33', bldg: '성수 오피스텔', trade: 'MONTHLY', mDep: 3000, mRent: 120, land: 0, floor: 45, roi: '—', tag: '오피스텔', lastCall: '2026.06.10', created: '2026.06.08', promo: '성수역 도보 3분.', memo: '' },
]));

const SEED_CUSTOMERS = withDevOwner(withDeletedAt([
  { id: 1, name: '김태영', phone: '010-1234-5678', type: 'BUYER', status: 'ACTIVE', fav: true, co: '태영인베스트', cash: 500000, buyMin: 200000, buyMax: 500000, memo: '강남 상권 관심, 현금 50억 보유', created: '2026.06.01' },
  { id: 2, name: '이지현', phone: '010-9876-5432', type: 'SELLER', status: 'ACTIVE', fav: false, co: '개인', cash: 0, buyMin: 0, buyMax: 0, memo: '영등포 건물 매도 희망 430억', created: '2026.06.10' },
  { id: 3, name: '박준호', phone: '010-5555-7890', type: 'TENANT', status: 'HOLD', fav: false, co: '㈜스마트오피스', cash: 0, buyMin: 0, buyMax: 0, memo: '사무실 100평 이상 임차', created: '2026.05.15' },
  { id: 4, name: '최민아', phone: '010-3333-4444', type: 'BUYER', status: 'COMPLETED', fav: false, co: '개인', cash: 150000, buyMin: 100000, buyMax: 250000, memo: '강남권 아파트 매수 희망', created: '2026.06.20' },
]));

const SEED_CALL_LOGS = withDevOwner(withDeletedAt([
  { id: 1, pid: 1, cid: 2, date: '2026-06-26', time: '14:30', content: '매도인 통화. 급매 의사 재확인. 430억 이하 협의 가능.', next: '현장 방문', nDate: '2026-06-28', schedId: 1 },
  { id: 2, pid: 1, cid: null, date: '2026-06-20', time: '11:00', content: '건폐율·용적률 추가 확인 요청. 5층 이상 도면 요청.', next: null, nDate: null, schedId: null },
  { id: 3, pid: 2, cid: 1, date: '2026-06-18', time: '09:30', content: '강남 아파트 관심. 25억 수준 가능.', next: '계약서 검토', nDate: '2026-06-30', schedId: 2 },
  { id: 4, pid: null, cid: 3, date: '2026-06-15', time: '16:00', content: '사무실 임차 조건 논의. 월세 300~400만 선호.', next: null, nDate: null, schedId: null },
  { id: 5, pid: 1, cid: 2, date: '2026-06-05', time: '15:45', content: '첫 문의. 매각 의사 확인. 자료 발송.', next: null, nDate: null, schedId: null },
]));

const SEED_SCHEDULES = withDevOwner(withDeletedAt([
  { id: 1, title: '현장 방문', date: '2026-06-28', time: '09:00', pri: 'IMPORTANT', pid: 1, callId: 1, memo: '통화 기록의 다음 액션에서 자동 등록\n통화일: 2026-06-26 14:30\n매도인 통화. 급매 의사 재확인. 430억 이하 협의 가능.', chk: [] },
  { id: 2, title: '계약서 검토', date: '2026-06-30', time: '09:00', pri: 'IMPORTANT', pid: 2, callId: 3, memo: '통화 기록의 다음 액션에서 자동 등록\n통화일: 2026-06-18 09:30\n강남 아파트 관심. 25억 수준 가능.', chk: [] },
  { id: 3, title: '월간 매물 미팅', date: '2026-07-03', time: '09:00', pri: 'NORMAL', pid: null, callId: null, chk: [] },
]));

const SEED_RENTALS = withDevOwner([
  { id: 1, pid: 1, floor: 'B2~B1', tenant: '', purpose: '주차장', area: 840, dep: null, rent: null, maint: null, memo: '' },
  { id: 2, pid: 1, floor: '1F', tenant: '편의점(A사)', purpose: '소매점', area: 120.5, dep: 1000, rent: 200, maint: 30, memo: '만료 2027.02' },
  { id: 3, pid: 1, floor: '2F~4F', tenant: '', purpose: '사무실', area: 1386.9, dep: null, rent: null, maint: null, memo: '공실' },
  { id: 4, pid: 1, floor: '5F~11F', tenant: '오피스(B사)', purpose: '사무실', area: 3712.8, dep: 0, rent: 0, maint: 0, memo: '2026.12 만료' },
]);

const LEGACY_DB_NAME = 'UpgroundDB';
export const DB_TABLES = ['properties', 'customers', 'call_logs', 'schedules', 'rentals'];

const BACKUP_FORMAT = 'rmxbak';
const BACKUP_VERSION = 1;

export const db = new Dexie('LandNoteDB');

db.version(1).stores({
  properties: '++id, status, main, trade, fav, created',
  customers: '++id, type, name, phone, fav, created',
  call_logs: '++id, pid, cid, date',
  schedules: '++id, date, pri, pid',
  rentals: '++id, pid',
});

db.version(2).stores({
  properties: '++id, status, main, trade, fav, created, deletedAt',
  customers: '++id, type, name, phone, fav, created, deletedAt',
  call_logs: '++id, pid, cid, date, deletedAt',
  schedules: '++id, date, pri, pid, deletedAt',
  rentals: '++id, pid',
}).upgrade(async (tx) => {
  for (const name of ['properties', 'customers', 'call_logs', 'schedules']) {
    await tx.table(name).toCollection().modify((rec) => {
      if (rec.deletedAt === undefined) rec.deletedAt = null;
    });
  }
});

db.version(3).stores({
  properties: '++id, status, main, trade, fav, created, deletedAt',
  customers: '++id, type, status, name, phone, fav, created, deletedAt',
  call_logs: '++id, pid, cid, date, deletedAt',
  schedules: '++id, date, pri, pid, deletedAt',
  rentals: '++id, pid',
}).upgrade(async (tx) => {
  await tx.table('customers').toCollection().modify((rec) => {
    if (!rec.status) rec.status = 'ACTIVE';
  });
});

function createdToIso(created) {
  if (!created) return null;
  const parts = String(created).split('.');
  if (parts.length !== 3) return null;
  return `${parts[0]}-${parts[1]}-${parts[2]}T00:00:00.000Z`;
}

db.version(4).stores({
  properties: '++id, status, main, trade, fav, favAt, created, deletedAt',
  customers: '++id, type, status, name, phone, fav, created, deletedAt',
  call_logs: '++id, pid, cid, date, deletedAt',
  schedules: '++id, date, pri, pid, deletedAt',
  rentals: '++id, pid',
}).upgrade(async (tx) => {
  await tx.table('properties').toCollection().modify((rec) => {
    if (rec.fav && !rec.favAt) rec.favAt = createdToIso(rec.created) || new Date().toISOString();
    if (!rec.fav && rec.favAt) rec.favAt = null;
  });
});

db.version(5).stores({
  properties: '++id, status, main, trade, fav, favAt, created, deletedAt, cloudId',
  customers: '++id, type, status, name, phone, fav, created, deletedAt',
  call_logs: '++id, pid, cid, date, deletedAt',
  schedules: '++id, date, pri, pid, deletedAt',
  rentals: '++id, pid',
});

db.version(6).stores({
  properties: '++id, status, main, trade, fav, favAt, created, deletedAt, cloudId',
  customers: '++id, type, status, name, phone, fav, created, deletedAt, cloudId',
  call_logs: '++id, pid, cid, date, deletedAt',
  schedules: '++id, date, pri, pid, deletedAt',
  rentals: '++id, pid',
});

db.version(7).stores({
  properties: '++id, status, main, trade, fav, favAt, created, deletedAt, cloudId',
  customers: '++id, type, status, name, phone, fav, created, deletedAt, cloudId',
  call_logs: '++id, pid, cid, date, deletedAt, schedId',
  schedules: '++id, date, pri, pid, deletedAt, callId',
  rentals: '++id, pid',
}).upgrade(async (tx) => {
  await tx.table('call_logs').toCollection().modify((rec) => {
    if (rec.schedId === undefined) rec.schedId = null;
  });
  await tx.table('schedules').toCollection().modify((rec) => {
    if (rec.callId === undefined) rec.callId = null;
  });
});

db.version(8).stores({
  properties: '++id, status, main, trade, fav, favAt, created, deletedAt, cloudId, ownerId',
  customers: '++id, type, status, name, phone, fav, created, deletedAt, cloudId, ownerId',
  call_logs: '++id, pid, cid, date, deletedAt, schedId, ownerId, cloudId',
  schedules: '++id, date, pri, pid, deletedAt, callId, ownerId, cloudId',
  rentals: '++id, pid, ownerId',
}).upgrade(async (tx) => {
  for (const name of DB_TABLES) {
    await tx.table(name).toCollection().modify((rec) => {
      if (rec.ownerId == null || rec.ownerId === '') rec.ownerId = DEV_LOCAL_OWNER;
    });
  }
});

db.version(9).stores({
  properties: '++id, status, main, trade, fav, favAt, created, deletedAt, cloudId, ownerId, companyId',
  customers: '++id, type, status, name, phone, fav, created, deletedAt, cloudId, ownerId, companyId',
  call_logs: '++id, pid, cid, date, deletedAt, schedId, ownerId, cloudId, companyId',
  schedules: '++id, date, pri, pid, deletedAt, callId, ownerId, cloudId, companyId',
  rentals: '++id, pid, ownerId, companyId',
});

/** 억 단위로 저장된 매매가·융자금 → 만 단위 (1억 = 10,000만) */
db.version(10).stores({
  properties: '++id, status, main, trade, fav, favAt, created, deletedAt, cloudId, ownerId, companyId',
  customers: '++id, type, status, name, phone, fav, created, deletedAt, cloudId, ownerId, companyId',
  call_logs: '++id, pid, cid, date, deletedAt, schedId, ownerId, cloudId, companyId',
  schedules: '++id, date, pri, pid, deletedAt, callId, ownerId, cloudId, companyId',
  rentals: '++id, pid, ownerId, companyId',
}).upgrade(async (tx) => {
  await tx.table('properties').toCollection().modify((rec) => {
    if (rec.trade !== 'SALE' && rec.trade !== 'PRESALE') return;
    if (looksLikeEokStored(rec.price)) rec.price = rec.price * EOK_TO_MAN;
    if (looksLikeEokStored(rec.loan)) rec.loan = rec.loan * EOK_TO_MAN;
  });
});

db.version(11).stores({
  properties: '++id, status, main, trade, fav, favAt, created, deletedAt, cloudId, ownerId, companyId',
  customers: '++id, type, status, name, phone, fav, created, deletedAt, cloudId, ownerId, companyId',
  call_logs: '++id, pid, cid, date, deletedAt, schedId, ownerId, cloudId, companyId',
  schedules: '++id, date, pri, pid, deletedAt, callId, ownerId, cloudId, companyId',
  rentals: '++id, pid, ownerId, companyId',
}).upgrade(async (tx) => {
  await tx.table('customers').toCollection().modify((rec) => {
    if (Array.isArray(rec.customer_types) && rec.customer_types.length) return;
    if (rec.type) rec.customer_types = [rec.type];
  });
});

db.version(12).stores({
  properties: '++id, status, main, trade, fav, favAt, created, deletedAt, cloudId, ownerId, companyId',
  customers: '++id, type, status, name, phone, fav, created, deletedAt, cloudId, ownerId, companyId',
  call_logs: '++id, pid, cid, date, deletedAt, schedId, ownerId, cloudId, companyId',
  schedules: '++id, date, pri, pid, deletedAt, callId, ownerId, cloudId, companyId',
  rentals: '++id, pid, ownerId, companyId',
}).upgrade(async (tx) => {
  await tx.table('customers').toCollection().modify((rec) => {
    if (looksLikeEokStored(rec.cash)) rec.cash = rec.cash * EOK_TO_MAN;
    if (looksLikeEokStored(rec.buyMin)) rec.buyMin = rec.buyMin * EOK_TO_MAN;
    if (looksLikeEokStored(rec.buyMax)) rec.buyMax = rec.buyMax * EOK_TO_MAN;
  });
});

/** 구글/ICS 일정 중복 방지용 icsKey 인덱스 */
db.version(13).stores({
  properties: '++id, status, main, trade, fav, favAt, created, deletedAt, cloudId, ownerId, companyId',
  customers: '++id, type, status, name, phone, fav, created, deletedAt, cloudId, ownerId, companyId',
  call_logs: '++id, pid, cid, date, deletedAt, schedId, ownerId, cloudId, companyId',
  schedules: '++id, date, pri, pid, deletedAt, callId, ownerId, cloudId, companyId, icsKey',
  rentals: '++id, pid, ownerId, companyId',
});

/** 전세보증금 jDep: 억 → 만 단위 */
db.version(14).stores({
  properties: '++id, status, main, trade, fav, favAt, created, deletedAt, cloudId, ownerId, companyId',
  customers: '++id, type, status, name, phone, fav, created, deletedAt, cloudId, ownerId, companyId',
  call_logs: '++id, pid, cid, date, deletedAt, schedId, ownerId, cloudId, companyId',
  schedules: '++id, date, pri, pid, deletedAt, callId, ownerId, cloudId, companyId, icsKey',
  rentals: '++id, pid, ownerId, companyId',
}).upgrade(async (tx) => {
  const { normalizeJDepToMan } = await import('./utils/formatMoney.js');
  await tx.table('properties').toCollection().modify((rec) => {
    if (rec.jDep == null || rec.jDep === '') return;
    const man = normalizeJDepToMan(rec.jDep);
    if (man > 0) rec.jDep = man;
  });
});

export const isActive = (item) => item != null && (item.deletedAt == null || item.deletedAt === '');

export function formatCreatedDate() {
  const d = new Date();
  return `${d.getFullYear()}.${String(d.getMonth() + 1).padStart(2, '0')}.${String(d.getDate()).padStart(2, '0')}`;
}

export function formatDeletedAt() {
  const d = new Date();
  const date = `${d.getFullYear()}.${String(d.getMonth() + 1).padStart(2, '0')}.${String(d.getDate()).padStart(2, '0')}`;
  const time = `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
  return `${date} ${time}`;
}

let seedPromise = null;

async function migrateLegacyDatabaseIfNeeded() {
  if (!(await Dexie.exists(LEGACY_DB_NAME))) return;

  await db.open();
  if ((await db.properties.count()) > 0) return;

  const legacyDb = new Dexie(LEGACY_DB_NAME);
  legacyDb.version(4).stores({
    properties: '++id, status, main, trade, fav, favAt, created, deletedAt',
    customers: '++id, type, status, name, phone, fav, created, deletedAt',
    call_logs: '++id, pid, cid, date, deletedAt',
    schedules: '++id, date, pri, pid, deletedAt',
    rentals: '++id, pid',
  });

  try {
    await legacyDb.open();
    await db.transaction('rw', DB_TABLES, async () => {
      for (const table of DB_TABLES) {
        const rows = await legacyDb.table(table).toArray();
        if (rows.length > 0) await db.table(table).bulkPut(rows);
      }
    });
    await legacyDb.close();
    await Dexie.delete(LEGACY_DB_NAME);
  } catch {
    try { await legacyDb.close(); } catch { /* ignore */ }
  }
}

export async function seedDatabase(options = {}) {
  if (seedPromise) return seedPromise;
  seedPromise = (async () => {
    await migrateLegacyDatabaseIfNeeded();
    if (options.skipSeed) return;
    const count = await db.properties.count();
    if (count > 0) return;

    await db.transaction('rw', [db.properties, db.customers, db.call_logs, db.schedules, db.rentals], async () => {
      if (await db.properties.count() > 0) return;
      await db.properties.bulkAdd(SEED_PROPERTIES);
      await db.customers.bulkAdd(SEED_CUSTOMERS);
      await db.call_logs.bulkAdd(SEED_CALL_LOGS);
      await db.schedules.bulkAdd(SEED_SCHEDULES);
      await db.rentals.bulkAdd(SEED_RENTALS);
    });

    const { backfillCallNextActionSchedules } = await import('./utils/callNextActionSchedule.js');
    await backfillCallNextActionSchedules();
  })();
  return seedPromise;
}

export function formatFavAt() {
  return new Date().toISOString();
}

export async function softDeleteProperty(id) {
  await assertOwned(db.properties, id);
  await db.properties.update(id, { deletedAt: formatDeletedAt() });
  await afterPropertyChange(id);
}

export async function setPropertyFav(id, fav) {
  await assertOwned(db.properties, id);
  await db.properties.update(id, { fav: !!fav, favAt: fav ? formatFavAt() : null });
  await afterPropertyChange(id);
}

export async function setCustomerFav(id, fav) {
  await assertOwned(db.customers, id);
  await db.customers.update(id, { fav: !!fav });
  await afterCustomerChange(id);
}

export async function softDeleteCustomer(id) {
  await assertOwned(db.customers, id);
  await db.customers.update(id, { deletedAt: formatDeletedAt() });
  await afterCustomerChange(id);
}

export async function softDeleteCallLog(id) {
  const call = await assertOwned(db.call_logs, id, 'call_logs');
  if (call?.schedId) await softDeleteSchedule(call.schedId);
  await db.call_logs.update(id, { deletedAt: formatDeletedAt() });
  await afterCallLogChange(id);
}

export async function softDeleteSchedule(id) {
  const rec = await assertOwned(db.schedules, id, 'schedules');
  // 구글/ICS 연동 일정은 휴지통 soft-delete 금지 — 중복 정리·동기화가 수천 건을 쌓던 경로와 분리
  if (rec?.icsUid || rec?.icsKey || rec?.icsSourceId) {
    await hardDeleteSchedule(id);
    return;
  }
  await db.schedules.update(id, { deletedAt: formatDeletedAt() });
  await afterScheduleChange(id);
}

export async function restoreProperty(id) {
  await assertOwned(db.properties, id);
  await db.properties.update(id, { deletedAt: null });
  await afterPropertyChange(id);
}

export async function restoreCustomer(id) {
  await assertOwned(db.customers, id);
  await db.customers.update(id, { deletedAt: null });
  await afterCustomerChange(id);
}

export async function restoreCallLog(id) {
  await assertOwned(db.call_logs, id, 'call_logs');
  await db.call_logs.update(id, { deletedAt: null });
  await afterCallLogChange(id);
}

export async function restoreSchedule(id) {
  await assertOwned(db.schedules, id, 'schedules');
  await db.schedules.update(id, { deletedAt: null });
  await afterScheduleChange(id);
}

export async function hardDeleteProperty(id) {
  const rec = await assertOwned(db.properties, id);
  const cloudId = rec.cloudId;
  try {
    await removePropertyFromCloud(id);
  } catch (err) {
    console.error('[hardDeleteProperty]', err);
  }
  if (cloudId) {
    try {
      const { rememberPurgedCloudId } = await import('./services/sync/purgedCloudIds.js');
      const { getSyncUserId } = await import('./services/sync/syncContext.js');
      rememberPurgedCloudId('properties', cloudId, getSyncUserId());
    } catch { /* ignore */ }
  }
  await db.properties.delete(id);
}

async function activeCustomersInScope() {
  const companyId = getSyncCompanyId();
  const ownerId = getActiveOwnerId();
  const list = companyId
    ? await db.customers.where('companyId').equals(companyId).toArray()
    : await db.customers.where('ownerId').equals(ownerId).toArray();
  return list.filter((c) => !c.deletedAt);
}

/** @param {string} phone @param {number|null} [excludeId] */
export async function findCustomerByPhone(phone, excludeId = null) {
  const key = customerPhoneKey(phone);
  if (!key) return null;
  const list = await activeCustomersInScope();
  return list.find((c) => c.id !== excludeId && customerPhoneKey(c.phone) === key) || null;
}

/** @returns {Promise<Set<string>>} */
export async function loadCustomerPhoneKeySet() {
  const list = await activeCustomersInScope();
  return new Set(list.map((c) => customerPhoneKey(c.phone)).filter(Boolean));
}

/** @param {Record<string, unknown>} data */
export async function addProperty(data) {
  const id = await db.properties.add(withOwnerId(data));
  await afterPropertyChange(id);
  return id;
}

/** 복사 시 제외할 식별·동기화·메타 필드 */
const PROPERTY_COPY_OMIT = new Set([
  'id',
  'cloudId',
  'cloudLocalId',
  'ownerId',
  'companyId',
  'fav',
  'favAt',
  'deletedAt',
  'created',
  'lastCall',
  'schedId',
  'photos', // 아래에서 독립 복제
]);

/**
 * 매물 복제 — 주소·건물 정보는 유지, 식별자·임대차·통화는 새 건으로 분리
 * (층수·가격 등 조건만 수정해 재등록할 때 사용)
 * 사진은 data URL로 복제 후 동기화 시 새 Storage 경로에 업로드
 * @param {number|Record<string, unknown>} sourceIdOrProp
 * @returns {Promise<{ id: number, record: Record<string, unknown> }>}
 */
export async function duplicateProperty(sourceIdOrProp) {
  const hint = typeof sourceIdOrProp === 'object' && sourceIdOrProp ? sourceIdOrProp : null;
  const sourceId = hint?.id ?? sourceIdOrProp;
  const fromDb = sourceId != null ? await db.properties.get(sourceId) : null;
  const source = fromDb || hint;
  if (!source) throw new Error('복사할 매물을 찾을 수 없습니다.');
  if (source.deletedAt) throw new Error('삭제된 매물은 복사할 수 없습니다.');

  /** @type {Record<string, unknown>} */
  const payload = {};
  for (const [k, v] of Object.entries(source)) {
    if (PROPERTY_COPY_OMIT.has(k)) continue;
    payload[k] = v;
  }

  const { clonePhotosForDuplicate, normalizePhotoList } = await import('./services/sync/propertyPhotoStorage.js');
  const photosDb = normalizePhotoList(fromDb?.photos);
  const photosHint = normalizePhotoList(hint?.photos);
  const photosSrc = photosDb.length >= photosHint.length ? photosDb : photosHint;
  payload.photos = await clonePhotosForDuplicate(photosSrc);

  const title = String(payload.bldg || '').trim();
  payload.bldg = title
    ? (title.includes('(복사)') ? title : `${title} (복사)`)
    : '복사 매물';
  payload.fav = false;
  payload.favAt = null;
  payload.deletedAt = null;
  payload.lastCall = '—';
  payload.created = formatCreatedDate();
  // 임대차·통화이력은 pid 기준 별도 테이블 — 복사하지 않음

  const id = await addProperty(payload);
  const record = await db.properties.get(id);
  return { id, record: record || { ...payload, id } };
}

/** @param {number} id @param {Record<string, unknown>} changes */
export async function updateProperty(id, changes) {
  await assertOwned(db.properties, id);
  await db.properties.update(id, changes);
  await afterPropertyChange(id);
}

/** @param {Record<string, unknown>} data */
export async function addCustomer(data) {
  const payload = normalizeCustomerRecord(data);
  const dup = await findCustomerByPhone(payload.phone);
  if (dup) {
    throw new Error('이미 등록된 연락처입니다.');
  }
  const id = await db.customers.add(withOwnerId(payload));
  await afterCustomerChange(id);
  return id;
}

/**
 * 고객 일괄 등록 — 단일 트랜잭션 bulk 저장 (클라우드 sync는 백그라운드)
 * @param {Record<string, unknown>[]} dataList
 * @returns {Promise<number[]>} 생성된 id 목록
 */
export async function bulkAddCustomers(dataList) {
  if (!dataList?.length) return [];

  const created = formatCreatedDate();
  const prepared = dataList.map((data) => withOwnerId(normalizeCustomerRecord({
    ...data,
    fav: data.fav ?? false,
    deletedAt: data.deletedAt ?? null,
    created: data.created ?? created,
  })));

  /** @type {number[]} */
  const ids = await db.transaction('rw', db.customers, async () => {
    const keys = await db.customers.bulkAdd(prepared, { allKeys: true });
    return Array.isArray(keys) ? keys : [];
  });

  queueMicrotask(() => {
    ids.forEach((id) => {
      afterCustomerChange(id).catch((err) => {
        console.error('[bulkAddCustomers sync]', id, err);
      });
    });
  });

  return ids;
}

/** @param {number} id @param {Record<string, unknown>} changes */
export async function updateCustomer(id, changes) {
  await assertOwned(db.customers, id);
  if (changes.phone != null) {
    const dup = await findCustomerByPhone(String(changes.phone), id);
    if (dup) {
      throw new Error('이미 등록된 연락처입니다.');
    }
  }
  const needsNormalize = changes.customer_types != null || changes.type != null
    || changes.cash != null || changes.buyMin != null || changes.buyMax != null
    || changes.preferred_trades != null;
  const payload = needsNormalize ? normalizeCustomerRecord(changes) : changes;
  await db.customers.update(id, payload);
  await afterCustomerChange(id);
}

export async function hardDeleteCustomer(id) {
  const rec = await assertOwned(db.customers, id);
  const cloudId = rec.cloudId;
  try {
    await removeCustomerFromCloud(id);
  } catch (err) {
    console.error('[hardDeleteCustomer]', err);
  }
  if (cloudId) {
    try {
      const { rememberPurgedCloudId } = await import('./services/sync/purgedCloudIds.js');
      const { getSyncUserId } = await import('./services/sync/syncContext.js');
      rememberPurgedCloudId('customers', cloudId, getSyncUserId());
    } catch { /* ignore */ }
  }
  await db.customers.delete(id);
}

export async function hardDeleteCallLog(id) {
  const rec = await assertOwned(db.call_logs, id, 'call_logs');
  const cloudId = rec.cloudId;
  try {
    await removeCallLogFromCloud(id);
  } catch (err) {
    console.error('[hardDeleteCallLog]', err);
  }
  if (cloudId) {
    try {
      const { rememberPurgedCloudId } = await import('./services/sync/purgedCloudIds.js');
      const { getSyncUserId } = await import('./services/sync/syncContext.js');
      rememberPurgedCloudId('call_logs', cloudId, getSyncUserId());
    } catch { /* ignore */ }
  }
  await db.call_logs.delete(id);
}

export async function hardDeleteSchedule(id) {
  const rec = await assertOwned(db.schedules, id, 'schedules');
  const cloudId = rec.cloudId;
  try {
    await removeScheduleFromCloud(id);
  } catch (err) {
    console.error('[hardDeleteSchedule]', err);
  }
  if (cloudId) {
    try {
      const { rememberPurgedCloudId } = await import('./services/sync/purgedCloudIds.js');
      const { getSyncUserId } = await import('./services/sync/syncContext.js');
      rememberPurgedCloudId('schedules', cloudId, getSyncUserId());
    } catch { /* ignore */ }
  }
  await db.schedules.delete(id);
}

/** @param {Record<string, unknown>} payload @param {number} [id] */
export async function saveCallLog(payload, id) {
  const { syncCallNextActionSchedule } = await import('./utils/callNextActionSchedule.js');
  return db.transaction('rw', [db.call_logs, db.schedules], async () => {
    let callId;
    if (id != null) {
      await assertOwned(db.call_logs, id, 'call_logs');
      await db.call_logs.update(id, payload);
      callId = id;
    } else {
      callId = await db.call_logs.add(withOwnerId({
        ...payload,
        schedId: payload.schedId ?? null,
        deletedAt: null,
      }));
    }
    await syncCallNextActionSchedule(callId, { ...payload, id: callId });
    return callId;
  }).then(async (callId) => {
    await afterCallLogChange(callId);
    return callId;
  });
}

/** @param {Record<string, unknown>} data */
export async function addCallLogDirect(data) {
  const id = await db.call_logs.add(withOwnerId({
    ...data,
    schedId: data.schedId ?? null,
    deletedAt: null,
  }));
  await afterCallLogChange(id);
  return id;
}

/** @param {Record<string, unknown>} data */
export async function addScheduleDirect(data) {
  const id = await db.schedules.add(withOwnerId({ ...data, deletedAt: null }));
  // 클라우드 동기화는 UI를 막지 않음 (네트워크 지연 시 「저장 무반응」방지)
  afterScheduleChange(id).catch((err) => {
    console.error('[addScheduleDirect] sync', err);
  });
  return id;
}

/** @param {number} id @param {Record<string, unknown>} changes */
export async function updateScheduleDirect(id, changes) {
  await assertOwned(db.schedules, id, 'schedules');
  await db.schedules.update(id, changes);
  afterScheduleChange(id).catch((err) => {
    console.error('[updateScheduleDirect] sync', err);
  });
}

const RESTORE_LOCAL_WINS_KEY = 'landnote.restoreLocalWins';

/** 백업 테이블별 구버전/별칭 키 지원 */
const BACKUP_TABLE_ALIASES = {
  properties: ['properties', 'props', 'property'],
  customers: ['customers', 'custs', 'customer'],
  call_logs: ['call_logs', 'callLogs', 'calls', 'call_log'],
  schedules: ['schedules', 'schedule', 'calendar'],
  rentals: ['rentals', 'rental'],
};

/** @param {Record<string, unknown>|null|undefined} tables @param {string} name */
function resolveBackupTableRows(tables, name) {
  if (!tables || typeof tables !== 'object') return [];
  const aliases = BACKUP_TABLE_ALIASES[name] || [name];
  for (const key of aliases) {
    if (Array.isArray(tables[key])) return tables[key];
  }
  return [];
}

/** @param {{ tables?: Record<string, unknown> }|null|undefined} backup */
export function getBackupTableCounts(backup) {
  /** @type {Record<string, number>} */
  const counts = {};
  for (const name of DB_TABLES) {
    counts[name] = resolveBackupTableRows(backup?.tables, name).length;
  }
  return counts;
}

/** @returns {Promise<Record<string, number>>} */
export async function getLocalTableCounts() {
  /** @type {Record<string, number>} */
  const counts = {};
  for (const name of DB_TABLES) {
    counts[name] = await db.table(name).count();
  }
  return counts;
}

/** @param {Record<string, number>|null|undefined} counts */
export function formatBackupCountsLabel(counts) {
  if (!counts) return '';
  return [
    `매물 ${counts.properties ?? 0}`,
    `고객 ${counts.customers ?? 0}`,
    `통화 ${counts.call_logs ?? 0}`,
    `일정 ${counts.schedules ?? 0}`,
    `임대차 ${counts.rentals ?? 0}`,
  ].join(' · ');
}

/**
 * 가져오기(병합) 결과 라벨 — 추가/중복건너뛰기
 * @param {{ added?: Record<string, number>, skipped?: Record<string, number>, properties?: number }} restored
 */
export function formatRestoreMergeLabel(restored) {
  const added = restored?.added ?? {
    properties: restored?.properties ?? 0,
    customers: restored?.customers ?? 0,
    call_logs: restored?.call_logs ?? 0,
    schedules: restored?.schedules ?? 0,
    rentals: restored?.rentals ?? 0,
  };
  const skipped = restored?.skipped ?? {};
  const addedTotal = DB_TABLES.reduce((n, k) => n + (added[k] ?? 0), 0);
  const skippedTotal = DB_TABLES.reduce((n, k) => n + (skipped[k] ?? 0), 0);
  const lines = [`추가 ${formatBackupCountsLabel(added)}`];
  if (skippedTotal > 0) {
    lines.push(`중복 건너뜀 ${formatBackupCountsLabel(skipped)}`);
  }
  if (addedTotal === 0 && skippedTotal > 0) {
    lines.unshift('이미 있는 데이터와 동일하여 새로 추가된 항목이 없습니다.');
  }
  return lines.join('\n');
}

export function markRestoreLocalWins() {
  try { localStorage.setItem(RESTORE_LOCAL_WINS_KEY, '1'); } catch { /* ignore */ }
}

/** @returns {boolean} */
export function consumeRestoreLocalWinsFlag() {
  try {
    const v = localStorage.getItem(RESTORE_LOCAL_WINS_KEY);
    if (v) localStorage.removeItem(RESTORE_LOCAL_WINS_KEY);
    return v === '1';
  } catch {
    return false;
  }
}

/**
 * 전체 로컬 데이터를 백업 객체로 직렬화 (소프트 삭제 항목 포함)
 * — 매물·고객·통화이력·일정·임대차 전부 포함
 */
export async function exportBackupData() {
  const tables = {};
  for (const name of DB_TABLES) {
    tables[name] = await db.table(name).toArray();
  }
  const counts = getBackupTableCounts({ tables });
  return {
    app: 'LandNote',
    format: BACKUP_FORMAT,
    version: BACKUP_VERSION,
    exportedAt: new Date().toISOString(),
    counts,
    tables,
  };
}

/** @param {unknown} backup */
export function isValidBackupData(backup) {
  return !!backup && typeof backup === 'object'
    && backup.format === BACKUP_FORMAT
    && !!backup.tables && typeof backup.tables === 'object';
}

/** @param {unknown} v */
function backupNormText(v) {
  return String(v ?? '').trim().toLowerCase().replace(/\s+/g, ' ');
}

/** @param {Record<string, unknown>} row */
function propertyBackupFingerprint(row) {
  const money = row.price ?? row.mDep ?? row.jDep ?? '';
  return [
    'p',
    backupNormText(row.addr),
    backupNormText(row.bldg),
    row.trade ?? '',
    row.main ?? '',
    money,
    row.mRent ?? '',
    row.deletedAt ?? '',
  ].join('|');
}

/** @param {Record<string, unknown>} row */
function customerBackupFingerprint(row) {
  return [
    'c',
    customerPhoneKey(row.phone) || '',
    backupNormText(row.name),
    row.type ?? '',
    row.deletedAt ?? '',
  ].join('|');
}

/** @param {Record<string, unknown>} row @param {unknown} pid @param {unknown} callId */
function scheduleBackupFingerprint(row, pid, callId) {
  return [
    's',
    row.date ?? '',
    row.time ?? '',
    backupNormText(row.title),
    pid ?? '',
    callId ?? '',
    row.deletedAt ?? '',
  ].join('|');
}

/** @param {Record<string, unknown>} row @param {unknown} pid @param {unknown} cid */
function callLogBackupFingerprint(row, pid, cid) {
  return [
    'k',
    row.date ?? '',
    row.time ?? '',
    backupNormText(row.content).slice(0, 200),
    pid ?? '',
    cid ?? '',
    customerPhoneKey(row.contactPhone) || '',
    row.deletedAt ?? '',
  ].join('|');
}

/** @param {Record<string, unknown>} row @param {unknown} pid */
function rentalBackupFingerprint(row, pid) {
  return [
    'r',
    pid ?? '',
    backupNormText(row.floor),
    backupNormText(row.tenant),
    backupNormText(row.purpose),
    row.area ?? '',
    row.dep ?? '',
    row.rent ?? '',
  ].join('|');
}

/**
 * @param {Record<string, unknown>} row
 * @param {{ ownerId: string, companyId: string|null|undefined, claimOwnership: boolean }} ctx
 */
function prepareImportedBackupRow(row, ctx) {
  const next = { ...row };
  delete next.id;
  delete next.cloudLocalId;
  delete next.cloudPid;
  delete next.cloudCid;
  delete next.cloudSchedId;
  delete next.cloudCallId;
  if (ctx.claimOwnership) {
    next.ownerId = ctx.ownerId;
    if (ctx.companyId) next.companyId = ctx.companyId;
    else next.companyId = null;
    // 신규 추가만 — 동일 지문은 기존(cloudId 유지)을 쓰므로 클라우드 중복 insert를 막음
    delete next.cloudId;
  }
  return next;
}

/**
 * @param {import('dexie').Table} table
 * @param {(row: Record<string, unknown>) => string} fingerprintOf
 * @returns {Promise<Map<string, Record<string, unknown>>>}
 */
async function buildFingerprintIndex(table, fingerprintOf) {
  /** @type {Map<string, Record<string, unknown>>} */
  const map = new Map();
  const existing = await table.toArray();
  for (const row of existing) {
    const fp = fingerprintOf(row);
    if (fp && !map.has(fp)) map.set(fp, row);
  }
  return map;
}

/**
 * 백업을 기존 로컬 데이터에 병합.
 * 동일 지문(핵심 필드)이 이미 있으면 건너뛰고, 신규만 추가한다.
 * FK(pid/cid/schedId/callId)는 백업 id → 로컬 id로 재매핑한다.
 * @param {Awaited<ReturnType<typeof exportBackupData>>} backup
 * @param {{ ownerId?: string|null, companyId?: string|null, claimOwnership?: boolean, markLocalWins?: boolean }} [options]
 */
export async function restoreBackupData(backup, options = {}) {
  if (!isValidBackupData(backup)) throw new Error('INVALID_BACKUP_FILE');

  const claimOwnership = options.claimOwnership !== false;
  const ownerId = options.ownerId ?? getActiveOwnerId();
  const companyId = options.companyId !== undefined ? options.companyId : getSyncCompanyId();
  const ctx = { ownerId, companyId, claimOwnership };

  /** @type {Record<string, { added: number, skipped: number, total: number }>} */
  const stats = {};
  for (const name of DB_TABLES) {
    stats[name] = { added: 0, skipped: 0, total: resolveBackupTableRows(backup.tables, name).length };
  }

  await db.transaction('rw', DB_TABLES.map((name) => db.table(name)), async () => {
    /** @type {Map<number|string, number>} */
    const propIdMap = new Map();
    /** @type {Map<number|string, number>} */
    const custIdMap = new Map();
    /** @type {Map<number|string, number>} */
    const callIdMap = new Map();
    /** @type {Map<number|string, number>} */
    const schedIdMap = new Map();

    const propIndex = await buildFingerprintIndex(db.properties, propertyBackupFingerprint);
    const custIndex = await buildFingerprintIndex(db.customers, customerBackupFingerprint);

    for (const row of resolveBackupTableRows(backup.tables, 'properties')) {
      const oldId = row.id;
      const fp = propertyBackupFingerprint(row);
      const matched = propIndex.get(fp);
      if (matched?.id != null) {
        if (oldId != null) propIdMap.set(oldId, matched.id);
        stats.properties.skipped += 1;
        continue;
      }
      const prepared = prepareImportedBackupRow(row, ctx);
      const newId = await db.properties.add(prepared);
      if (oldId != null) propIdMap.set(oldId, newId);
      propIndex.set(fp, { ...prepared, id: newId });
      stats.properties.added += 1;
    }

    for (const row of resolveBackupTableRows(backup.tables, 'customers')) {
      const oldId = row.id;
      const fp = customerBackupFingerprint(row);
      const matched = custIndex.get(fp);
      if (matched?.id != null) {
        if (oldId != null) custIdMap.set(oldId, matched.id);
        stats.customers.skipped += 1;
        continue;
      }
      const prepared = prepareImportedBackupRow(row, ctx);
      const newId = await db.customers.add(prepared);
      if (oldId != null) custIdMap.set(oldId, newId);
      custIndex.set(fp, { ...prepared, id: newId });
      stats.customers.added += 1;
    }

    const remapProp = (pid) => (pid == null ? null : (propIdMap.get(pid) ?? null));
    const remapCust = (cid) => (cid == null ? null : (custIdMap.get(cid) ?? null));

    const callIndex = await buildFingerprintIndex(db.call_logs, (r) =>
      callLogBackupFingerprint(r, r.pid ?? null, r.cid ?? null));

    /** @type {{ localId: number, backupSchedId: unknown }[]} */
    const callSchedPatch = [];

    for (const row of resolveBackupTableRows(backup.tables, 'call_logs')) {
      const oldId = row.id;
      const mappedPid = remapProp(row.pid);
      const mappedCid = remapCust(row.cid);
      // 백업 FK가 있었으나 매물/고객을 못 찾은 경우는 null로 저장·지문 계산
      const fp = callLogBackupFingerprint(row, mappedPid, mappedCid);
      const matched = callIndex.get(fp);
      if (matched?.id != null) {
        if (oldId != null) callIdMap.set(oldId, matched.id);
        stats.call_logs.skipped += 1;
        continue;
      }
      const prepared = prepareImportedBackupRow(row, ctx);
      prepared.pid = mappedPid;
      prepared.cid = mappedCid;
      const backupSchedId = prepared.schedId;
      prepared.schedId = null;
      const newId = await db.call_logs.add(prepared);
      if (oldId != null) callIdMap.set(oldId, newId);
      callIndex.set(fp, { ...prepared, id: newId });
      if (backupSchedId != null) callSchedPatch.push({ localId: newId, backupSchedId });
      stats.call_logs.added += 1;
    }

    const schedIndex = await buildFingerprintIndex(db.schedules, (r) =>
      scheduleBackupFingerprint(r, r.pid ?? null, r.callId ?? null));

    for (const row of resolveBackupTableRows(backup.tables, 'schedules')) {
      const oldId = row.id;
      const mappedPid = remapProp(row.pid);
      const mappedCallId = row.callId == null ? null : (callIdMap.get(row.callId) ?? null);
      const fp = scheduleBackupFingerprint(row, mappedPid, mappedCallId);
      const matched = schedIndex.get(fp);
      if (matched?.id != null) {
        if (oldId != null) schedIdMap.set(oldId, matched.id);
        stats.schedules.skipped += 1;
        continue;
      }
      const prepared = prepareImportedBackupRow(row, ctx);
      prepared.pid = mappedPid;
      prepared.callId = mappedCallId;
      const newId = await db.schedules.add(prepared);
      if (oldId != null) schedIdMap.set(oldId, newId);
      schedIndex.set(fp, { ...prepared, id: newId });
      stats.schedules.added += 1;
    }

    for (const patch of callSchedPatch) {
      const mappedSchedId = schedIdMap.get(patch.backupSchedId);
      if (mappedSchedId != null) {
        await db.call_logs.update(patch.localId, { schedId: mappedSchedId });
      }
    }

    const rentalIndex = await buildFingerprintIndex(db.rentals, (r) =>
      rentalBackupFingerprint(r, r.pid ?? null));

    for (const row of resolveBackupTableRows(backup.tables, 'rentals')) {
      const mappedPid = remapProp(row.pid);
      const fp = rentalBackupFingerprint(row, mappedPid);
      if (rentalIndex.has(fp)) {
        stats.rentals.skipped += 1;
        continue;
      }
      const prepared = prepareImportedBackupRow(row, ctx);
      prepared.pid = mappedPid;
      if (prepared.pid == null && row.pid != null) {
        // 매물 매핑 없으면 임대차는 건너뜀 (고아 레코드 방지)
        stats.rentals.skipped += 1;
        continue;
      }
      const newId = await db.rentals.add(prepared);
      rentalIndex.set(fp, { ...prepared, id: newId });
      stats.rentals.added += 1;
    }
  });

  if (options.markLocalWins !== false) markRestoreLocalWins();

  /** @type {Record<string, number> & { added?: Record<string, number>, skipped?: Record<string, number> }} */
  const result = {};
  /** @type {Record<string, number>} */
  const added = {};
  /** @type {Record<string, number>} */
  const skipped = {};
  for (const name of DB_TABLES) {
    result[name] = stats[name].added;
    added[name] = stats[name].added;
    skipped[name] = stats[name].skipped;
  }
  result.added = added;
  result.skipped = skipped;
  return result;
}

/** 로컬 매물 id — Dexie pid 인덱스 타입(number) 통일 */
export function normalizePropertyLocalId(pid) {
  if (pid == null || pid === '') return pid;
  if (typeof pid === 'string' && /^\d+$/.test(pid)) return Number(pid);
  return pid;
}

export async function saveRentalsForProperty(pid, rows) {
  const normalizedPid = normalizePropertyLocalId(pid);
  if (normalizedPid == null || normalizedPid === '') {
    throw new Error('PROPERTY_ID_REQUIRED');
  }
  const prop = await db.properties.get(normalizedPid);
  if (prop && !canMutateRecord(prop)) throw new Error('FORBIDDEN');
  const ownerId = prop?.ownerId ?? getActiveOwnerId();
  await db.transaction('rw', db.rentals, async () => {
    await db.rentals.where('pid').equals(normalizedPid).delete();
    for (const row of rows) {
      const { status, id: rowId, ...rest } = row;
      const dep = status === 'vacant' ? null : parseMoneyManOrNull(rest.dep);
      const rent = status === 'vacant' ? null : parseMoneyManOrNull(rest.rent);
      const maint = status === 'vacant' ? null : parseMoneyManOrNull(rest.maint);
      const payload = withOwnerId({
        pid: normalizedPid,
        floor: rest.floor || '',
        tenant: rest.tenant || '',
        purpose: rest.purpose || '',
        area: rest.area === '' || rest.area === undefined ? 0 : Number(rest.area),
        dep,
        rent,
        maint,
        leaseEnd: rest.leaseEnd || '',
        memo: rest.memo || '',
      }, ownerId);
      if (rowId && typeof rowId === 'number' && rowId < 1e10) {
        await db.rentals.add({ ...payload, id: rowId });
      } else {
        await db.rentals.add(payload);
      }
    }
  });
}
