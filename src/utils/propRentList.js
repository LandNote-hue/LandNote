import { fmtNum, normalizeJDepToMan, formatKoreanAmountFromMan, m2ToPyung } from './formatMoney.js';
import { RENT_TRADE_LABELS } from './propListKind.js';
import { fmtMoveInDate, isMoveInImmediate } from './propertyForm.js';
import { propDisplayAddr, propJibunAddr } from './propAddress.js';

export { RENT_TRADE_LABELS };

/** 전세는 jDep, 월세·단기는 mDep (만원) */
export function rentalDepositMan(p) {
  if (p?.trade === 'JEONSE') return normalizeJDepToMan(p.jDep);
  const n = Number(p?.mDep);
  return Number.isFinite(n) && n > 0 ? n : 0;
}

export function rentalRentMan(p) {
  const n = Number(p?.mRent);
  return Number.isFinite(n) && n > 0 ? n : 0;
}

export function rentalMaintMan(p) {
  const n = Number(p?.maintenance);
  return Number.isFinite(n) && n > 0 ? n : 0;
}

export function fmtRentalMan(v) {
  const n = Number(v);
  if (!Number.isFinite(n) || n <= 0) return '—';
  return formatKoreanAmountFromMan(n);
}

export function rentalAreaParts(m2) {
  const n = Number(m2);
  if (!Number.isFinite(n) || n <= 0) return null;
  const py = m2ToPyung(n);
  const m2Label = `${fmtNum(n, { decimal: true })}㎡`;
  const pyLabel = py != null ? `(${fmtNum(py, { decimal: true })}평)` : null;
  return { m2Label, pyLabel };
}

export function fmtRentalAreaCell(m2) {
  const parts = rentalAreaParts(m2);
  if (!parts) return '—';
  return parts.pyLabel ? `${parts.m2Label} ${parts.pyLabel}` : parts.m2Label;
}

export function fmtListDotDate(iso) {
  return fmtMoveInDate(iso);
}

/** 즉시입주는 날짜보다 앞에 오도록 정렬 */
export function moveInSortKey(v) {
  if (!v) return '';
  if (isMoveInImmediate(v)) return '0000-00-00';
  return String(v);
}

export function rentalTradeLabel(trade) {
  return RENT_TRADE_LABELS[trade] || trade || '—';
}

/** 목록에 보이는 주소 + 건물명 (한글·숫자 정렬용) */
export function rentalAddrSortKey(p) {
  const addr = propDisplayAddr(p);
  const a = !addr || addr === '—' ? '' : addr;
  const bldg = (p?.bldg || '').trim();
  return `${a} ${bldg}`.trim();
}

/** 목록 기본(등록일)에서도 지번 묶음을 쓴다. 다른 열 정렬일 때만 끈다. */
export function rentalListUsesJibunGroups(sortKey) {
  return !sortKey || sortKey === 'created';
}

function normalizeJibunGroupText(s) {
  return String(s || '')
    .replace(/서울특별시|서울시/g, '서울')
    .replace(/부산광역시|부산시/g, '부산')
    .replace(/대구광역시|대구시/g, '대구')
    .replace(/인천광역시|인천시/g, '인천')
    .replace(/광주광역시|광주시/g, '광주')
    .replace(/대전광역시|대전시/g, '대전')
    .replace(/울산광역시|울산시/g, '울산')
    .replace(/세종특별자치시|세종시/g, '세종')
    .replace(/제주특별자치도|제주도/g, '제주')
    .replace(/강원특별자치도/g, '강원')
    .replace(/전북특별자치도/g, '전북')
    .replace(/특별자치시|특별자치도|광역시|특별시/g, '')
    .replace(/\([^)]*\)/g, '')
    .replace(/\s+/g, '')
    .toLowerCase();
}

function isEmptyJibunGroupText(s) {
  const t = normalizeJibunGroupText(s);
  return !t || t === '—' || t === '-' || t === '주소미입력';
}

/** 임대 목록 묶음 키 — 화면에 보이는 지번주소 (서울특별시/서울 표기 차이 무시) */
export function rentalJibunGroupKey(p) {
  const display = propDisplayAddr(p);
  const jibun = propJibunAddr(p);
  const raw = [jibun, display, p?.addr].find((s) => !isEmptyJibunGroupText(s)) || '';
  const key = normalizeJibunGroupText(raw);
  if (!key || isEmptyJibunGroupText(key)) return `__id:${p?.id ?? ''}`;
  return key;
}

/**
 * 해당층 정렬값. 지하·B는 음수, 옥탑은 맨 뒤, 미입력은 그 다음.
 * 목록의 `8/14층`은 해당층(앞 숫자)만 쓴다.
 * @param {unknown} raw
 */
export function unitFloorSortKey(raw) {
  const s = String(raw ?? '').trim().toUpperCase().replace(/\s+/g, '');
  if (!s) return Number.POSITIVE_INFINITY;
  if (/옥탑|옥상|^PH|펜트/.test(s)) return 10000;
  const slash = s.match(/^(-?\d+(?:\.\d+)?)[/／]/);
  if (slash) return Number(slash[1]);
  const range = s.match(/(-?\d+(?:\.\d+)?)[~～\-]+(-?\d+(?:\.\d+)?)/);
  if (range) return Math.min(Number(range[1]), Number(range[2]));
  const basement = s.match(/(?:B|지하|반지하)(\d+)/);
  if (basement) return -Number(basement[1]);
  if (/^(지하|반지하|B)$/.test(s)) return -1;
  const num = s.match(/-?\d+(?:\.\d+)?/);
  if (num) return Number(num[0]);
  return Number.POSITIVE_INFINITY - 1;
}

function rentalCreatedDesc(a, b) {
  const c = String(b?.created || '').localeCompare(String(a?.created || ''));
  if (c !== 0) return c;
  return (b?.id || 0) - (a?.id || 0);
}

/**
 * 지번이 같은 임대 매물을 연달아 두고, 그룹은 가장 최근 등록이 위.
 * 그룹 안에서는 해당층 낮은 순.
 * @param {Array<Record<string, unknown>>} items
 * @param {{ createdDir?: 'asc'|'desc' }} [opts]
 */
export function sortRentalListByJibunGroups(items, opts = {}) {
  const createdDir = opts.createdDir === 'asc' ? 'asc' : 'desc';
  const groups = new Map();
  for (const p of items) {
    const k = rentalJibunGroupKey(p);
    const list = groups.get(k);
    if (list) list.push(p);
    else groups.set(k, [p]);
  }
  const ranked = [...groups.values()].map((list) => {
    const newest = list.reduce((acc, cur) => (rentalCreatedDesc(acc, cur) < 0 ? acc : cur));
    const ordered = [...list].sort((a, b) => {
      const fa = unitFloorSortKey(a.unitFloor);
      const fb = unitFloorSortKey(b.unitFloor);
      if (fa !== fb) return fa - fb;
      return rentalCreatedDesc(a, b);
    });
    return { newest, ordered };
  });
  ranked.sort((a, b) => {
    const c = rentalCreatedDesc(a.newest, b.newest);
    return createdDir === 'asc' ? -c : c;
  });
  return ranked.flatMap((g) => g.ordered);
}

export const RENT_LIST_SORT_KEYS = new Set([
  'addr', 'contractArea', 'exclusiveArea', 'deposit', 'rent', 'maintenance', 'lastCall', 'moveInDate', 'created',
]);

export const SALE_LIST_SORT_KEYS = new Set([
  'price', 'roi', 'landArea', 'floorArea', 'zoning', 'landPy', 'lastCall', 'created',
]);
