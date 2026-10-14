import { formatKoreanAmountFromMan } from './formatMoney.js';
import { PROP_TRADE_LABELS } from './propCategorySearch.js';
import { PROP_RENT_STATUS_LABEL, PROP_STATUS_LABEL } from './propStatus.js';
import { propListActivityMs } from './propRentList.js';

export const LOCKED_CALL_KIND = 'property_audit';
export const LOCKED_CALL_LOG_MSG = '변경기록은 수정하거나 삭제할 수 없습니다.';

/** @param {Record<string, unknown>|null|undefined} call */
export function isLockedCallLog(call) {
  if (!call) return false;
  if (call.locked === true || call.lockedKind === LOCKED_CALL_KIND) return true;
  return String(call.content || '').startsWith('[변경기록]');
}

/** 변경기록·통화내용 — 줄바꿈 없이 한 줄 */
export function fmtCallContentOneLine(content) {
  return String(content ?? '').replace(/\s+/g, ' ').trim();
}

export function nowCallStamp() {
  const d = new Date();
  const pad = (n) => String(n).padStart(2, '0');
  return {
    date: `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`,
    time: `${pad(d.getHours())}:${pad(d.getMinutes())}`,
  };
}

/** 목록 표시용 YYYY.MM.DD — 최종수정(등록 포함) */
export function fmtPropUpdatedAt(p) {
  const ms = propListActivityMs(p);
  if (!ms) {
    const created = String(p?.created || '').trim();
    return created ? created.replace(/-/g, '.') : '—';
  }
  const d = new Date(ms);
  const pad = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}.${pad(d.getMonth() + 1)}.${pad(d.getDate())}`;
}

const SKIP_KEYS = new Set([
  'id', 'cloudId', 'cloudLocalId', 'ownerId', 'companyId',
  'syncStatus', 'syncRev', 'syncPushedRev', 'syncDirtyAt', 'syncError', 'syncConflictRemoteAt',
  'syncRequestId', 'cloudUpdatedAt', 'updatedAt', 'deleteIntent',
  'mapLat', 'mapLng', 'mapGeocodedAt', 'mapLevel',
  'deletedAt', 'favAt', 'lastCall', 'schedId', 'fav',
  'premium', 'realInvest',
]);

const FIELD_LABELS = {
  status: '상태',
  pub: '공개여부',
  addr: '주소',
  jibunAddr: '지번',
  roadAddr: '도로명',
  bldg: '건물명',
  trade: '거래방식',
  price: '매도호가',
  inPrice: '입금가',
  land: '대지면적',
  floor: '연면적',
  roi: '수익률',
  tag: '종류',
  main: '대분류',
  sub: '세부분류',
  promo: '홍보문구',
  memo: '내부메모',
  ownerName: '소유자',
  ownerTel: '소유자 연락처',
  roadInfo: '도로현황',
  zoning: '용도지역',
  landCategory: '지목',
  officialLandPrice: '공시지가',
  agentName: '담당자',
  agentTel: '담당자 연락처',
  discoUrl: '디스코 링크',
  folderUrl: '저장폴더',
  title: '게시글 제목',
  photos: '사진',
  jDep: '전세보증금',
  mDep: '보증금',
  mRent: '월세',
  loan: '대출',
  leaseEnd: '기한',
  premium: '권리금',
  realInvest: '실투자금',
  structure: '구조',
  mainUse: '주용도',
  approvalDate: '사용승인일',
  floorsAbove: '지상층',
  floorsBelow: '지하층',
  parking: '주차',
  elevators: '승강기',
  buildingArea: '건축면적',
  farArea: '연면적(건축)',
  buildingCoverage: '건폐율',
  floorAreaRatio: '용적률',
  contractArea: '계약면적',
  exclusiveArea: '전용면적',
  unitFloor: '해당층',
  moveInDate: '입주가능일',
};

const MONEY_KEYS = new Set(['price', 'inPrice', 'jDep', 'mDep', 'mRent', 'loan', 'premium', 'realInvest', 'officialLandPrice']);

function emptyVal(v) {
  return v == null || v === '' || (Array.isArray(v) && v.length === 0);
}

function sameVal(a, b) {
  if (emptyVal(a) && emptyVal(b)) return true;
  if (Array.isArray(a) || Array.isArray(b)) {
    return JSON.stringify(a ?? []) === JSON.stringify(b ?? []);
  }
  if (typeof a === 'object' && typeof b === 'object') {
    return JSON.stringify(a ?? null) === JSON.stringify(b ?? null);
  }
  return String(a ?? '') === String(b ?? '');
}

function formatFieldValue(key, value, rent) {
  if (emptyVal(value)) return '없음';
  if (key === 'status') {
    const map = rent ? PROP_RENT_STATUS_LABEL : PROP_STATUS_LABEL;
    return map[value] || String(value);
  }
  if (key === 'trade') return PROP_TRADE_LABELS[value] || String(value);
  if (key === 'pub') return value ? '공개' : '비공개';
  if (key === 'photos') return `${Array.isArray(value) ? value.filter(Boolean).length : 0}장`;
  if (MONEY_KEYS.has(key)) {
    const n = Number(value);
    if (Number.isFinite(n) && n > 0) return formatKoreanAmountFromMan(n);
  }
  if (typeof value === 'boolean') return value ? '예' : '아니오';
  if (typeof value === 'object') return JSON.stringify(value);
  return String(value);
}

/**
 * @param {Record<string, unknown>} prev
 * @param {Record<string, unknown>} next
 * @returns {string}
 */
export function summarizePropertyChanges(prev, next) {
  const rent = next?.trade && next.trade !== 'SALE' && next.trade !== 'PRESALE';
  const lines = [];
  const keys = new Set([...Object.keys(prev || {}), ...Object.keys(next || {})]);
  for (const key of keys) {
    if (SKIP_KEYS.has(key) || key.startsWith('sync')) continue;
    const before = prev?.[key];
    const after = next?.[key];
    if (sameVal(before, after)) continue;
    const label = FIELD_LABELS[key] || key;
    lines.push(`· ${label}: ${formatFieldValue(key, before, rent)} → ${formatFieldValue(key, after, rent)}`);
  }
  if (!lines.length) return '';
  return lines.join(' · ');
}

export function propertyRegisterAuditContent() {
  return '[변경기록] 매물 신규 등록';
}

export function rentalChangeAuditContent() {
  return '[변경기록] 임대차 내역 변경';
}
