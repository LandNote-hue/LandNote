import { normalizePropListTab } from '../utils/propListKind.js';

const STORAGE_KEY = 'landnote.propListState';
const LEGACY_STORAGE_KEY = 'upground.propListState';

/** @returns {Record<string, unknown>} */
export function loadPropListState() {
  try {
    const raw = sessionStorage.getItem(STORAGE_KEY) ?? sessionStorage.getItem(LEGACY_STORAGE_KEY);
    if (raw && !sessionStorage.getItem(STORAGE_KEY) && sessionStorage.getItem(LEGACY_STORAGE_KEY)) {
      sessionStorage.setItem(STORAGE_KEY, raw);
      sessionStorage.removeItem(LEGACY_STORAGE_KEY);
    }
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
}

/** @param {Record<string, unknown>} partial */
export function savePropListState(partial) {
  try {
    const prev = loadPropListState();
    sessionStorage.setItem(STORAGE_KEY, JSON.stringify({ ...prev, ...partial }));
  } catch {
    /* ignore quota errors */
  }
}

export function clearPropListScroll() {
  savePropListState({ scrollTop: 0 });
}

/** 매물 등록·수정 후 목록을 최종수정일 최신순 맨 위로 */
export const PROP_LIST_LATEST_EVENT = 'landnote:prop-list-latest';

export function rememberPropListLatestActivity() {
  savePropListState({ sortKey: 'updatedAt', sortDir: 'desc', scrollTop: 0 });
  if (typeof window === 'undefined') return;
  try {
    window.dispatchEvent(new Event(PROP_LIST_LATEST_EVENT));
  } catch {
    /* ignore */
  }
}

/** 매물 목록 검색·필터·스크롤 등 저장 상태 전체 삭제 */
export function clearPropListState() {
  try {
    sessionStorage.removeItem(STORAGE_KEY);
    sessionStorage.removeItem(LEGACY_STORAGE_KEY);
  } catch {
    /* ignore */
  }
}

/** @param {unknown} [tab] */
export function rememberPropListTab(tab) {
  const id = normalizePropListTab(tab || loadPropListState().statusTab || 'ALL');
  savePropListState({ statusTab: id });
  return id;
}

/** 매물 목록 복귀 경로 (?tab= 포함) */
export function propertiesListPath() {
  const tab = normalizePropListTab(loadPropListState().statusTab || 'ALL');
  if (!tab || tab === 'ALL') return '/properties';
  return `/properties?tab=${encodeURIComponent(tab)}`;
}
