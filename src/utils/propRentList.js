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

/** 임대 목록 묶음 키 — 지번주소 (공백 무시) */
export function rentalJibunGroupKey(p) {
  const jibun = propJibunAddr(p);
  const key = (jibun || '').replace(/\s+/g, '').toLowerCase();
  if (key) return key;
  return `__id:${p?.id ?? ''}`;
}

/**
 * 해당층 정렬값. 지하·B는 음수, 옥탑은 맨 뒤, 미입력은 그 다음.
 * @param {unknown} raw
 */
export function unitFloorSortKey(raw) {
  const s = String(raw ?? '').trim().toUpperCase().replace(/\s+/g, '');
  if (!s) return Number.POSITIVE_INFINITY;
  if (/옥탑|옥상|^PH|펜트/.test(s)) return 10000;
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
 */
export function sortRentalListByJibunGroups(items) {
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
  ranked.sort((a, b) => rentalCreatedDesc(a.newest, b.newest));
  return ranked.flatMap((g) => g.ordered);
}

export const RENT_LIST_SORT_KEYS = new Set([
  'addr', 'contractArea', 'exclusiveArea', 'deposit', 'rent', 'maintenance', 'lastCall', 'moveInDate', 'created',
]);

export const SALE_LIST_SORT_KEYS = new Set([
  'price', 'roi', 'landArea', 'floorArea', 'zoning', 'landPy', 'lastCall', 'created',
]);
