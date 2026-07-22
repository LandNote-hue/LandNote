import { GCAL_LINK_COLORS, listGoogleCalendarLinks } from '../services/googleCalendarLinks.js';

/** 일정 우선순위 색 — 긴급(빨강) · 중요(주황) · 보통(파랑) */
export const PRI_C = { URGENT: '#DC2626', IMPORTANT: '#D97706', NORMAL: '#2563EB' };
export const PRI_BG = {
  URGENT: 'rgba(220,38,38,.16)',
  IMPORTANT: 'rgba(217,119,6,.16)',
  NORMAL: 'rgba(37,99,235,.16)',
};
export const PRI_L = { URGENT: '긴급', IMPORTANT: '중요', NORMAL: '보통' };
export const PRI_OPTS = [['URGENT', '긴급'], ['IMPORTANT', '중요'], ['NORMAL', '보통']];

export function schedulePriColor(pri) {
  return PRI_C[pri] || PRI_C.NORMAL;
}

export function schedulePriBg(pri) {
  return PRI_BG[pri] || PRI_BG.NORMAL;
}

/** @param {string} hex @param {number} [alpha] */
export function hexToRgba(hex, alpha = 0.16) {
  const h = String(hex || '').replace('#', '');
  const r = parseInt(h.slice(0, 2), 16);
  const g = parseInt(h.slice(2, 4), 16);
  const b = parseInt(h.slice(4, 6), 16);
  return `rgba(${r},${g},${b},${alpha})`;
}

/** 구버전(색 미지정) 연동 링크용 — sourceId로부터 결정적으로 색 선택 */
export function gcalFallbackColor(sourceId) {
  let h = 0;
  const s = String(sourceId || '');
  for (let i = 0; i < s.length; i += 1) h = (h * 31 + s.charCodeAt(i)) >>> 0;
  return GCAL_LINK_COLORS[h % GCAL_LINK_COLORS.length];
}

/** @param {{ label?: string, sourceLink?: string, icsUrl?: string }} link */
export function gcalLinkDisplayLabel(link) {
  if (link?.label && String(link.label).trim()) return String(link.label).trim();
  const src = link?.sourceLink || link?.icsUrl || '';
  if (!src) return '연동된 캘린더';
  return src.length > 42 ? `${src.slice(0, 42)}…` : src;
}

/**
 * 일정 표시색 — 연동 캘린더에서 가져온 일정은 캘린더 구분색, 직접 등록한 일정은 우선순위색
 * @param {{ pri?: string, icsSourceId?: string }} s
 * @param {Map<string, { color: string, label: string }>|null|undefined} gcalMeta
 */
export function scheduleSourceInfo(s, gcalMeta) {
  const src = s?.icsSourceId ? gcalMeta?.get(s.icsSourceId) : null;
  if (src) return { c: src.color, bg: hexToRgba(src.color, 0.08), label: src.label, isSource: true };
  return {
    c: schedulePriColor(s?.pri),
    bg: schedulePriBg(s?.pri),
    label: PRI_L[s?.pri] || '보통',
    isSource: false,
  };
}

/**
 * @param {string|null|undefined} ownerId
 * @returns {Map<string, { color: string, label: string }>}
 */
export function buildGcalMeta(ownerId) {
  const m = new Map();
  listGoogleCalendarLinks(ownerId).forEach((l) => {
    const color = l.color && GCAL_LINK_COLORS.includes(l.color)
      ? l.color
      : gcalFallbackColor(l.sourceId);
    m.set(l.sourceId, { color, label: gcalLinkDisplayLabel(l) });
  });
  return m;
}
