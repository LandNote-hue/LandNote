/** 지도 우측 컨트롤 공통 레이아웃 */
export const MAP_CONTROL_RIGHT = 10;
/** 데스크톱: 지도/스카이뷰·로드뷰·레이어·내보내기 툴바 — 우측 중앙(세로 가운데) 고정, 세로 1열 */
export const MAP_TOOLBAR_ROW_GAP = 4;
export const MAP_ZOOM_RAIL_WIDTH = 36;
/** 데스크톱: 확대·축소 레일은 툴바와 분리해 우측 하단 고정 */
export const MAP_CONTROL_BOTTOM = 10;

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
