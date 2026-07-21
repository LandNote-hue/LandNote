/** 지도 우측 컨트롤 공통 레이아웃 (툴바·줌 겹침 방지) */
export const MAP_CONTROL_RIGHT = 10;
export const MAP_TOOLBAR_TOP = 10;
export const MAP_TOOLBAR_HEIGHT = 32;
export const MAP_CONTROL_GAP = 8;
export const MAP_ZOOM_RAIL_WIDTH = 36;
export const MAP_ZOOM_RAIL_TOP = MAP_TOOLBAR_TOP + MAP_TOOLBAR_HEIGHT + MAP_CONTROL_GAP;

/** 툴바가 줌 레일 영역을 침범하지 않도록 우측 여백 */
export const MAP_TOOLBAR_MAX_WIDTH = `calc(100% - ${MAP_CONTROL_RIGHT * 2 + MAP_ZOOM_RAIL_WIDTH}px)`;

/* ── 모바일: 장소검색 → 툴바/줌 세로 스택 (동일 top 겹침 방지) ── */
export const MAP_MOBILE_INSET = 8;
export const MAP_MOBILE_PLACE_SEARCH_TOP = 8;
export const MAP_MOBILE_PLACE_SEARCH_HEIGHT = 40;
export const MAP_MOBILE_STACK_GAP = 8;
/** 장소검색 바로 아래 — 툴바·줌이 같은 행 */
export const MAP_MOBILE_TOOLBAR_TOP =
  MAP_MOBILE_PLACE_SEARCH_TOP + MAP_MOBILE_PLACE_SEARCH_HEIGHT + MAP_MOBILE_STACK_GAP;
export const MAP_MOBILE_ZOOM_TOP = MAP_MOBILE_TOOLBAR_TOP;
/** 툴바가 줌 레일과 겹치지 않도록 */
export const MAP_MOBILE_TOOLBAR_MAX_WIDTH =
  `calc(100% - ${MAP_MOBILE_INSET * 2 + MAP_ZOOM_RAIL_WIDTH + MAP_MOBILE_STACK_GAP}px)`;
