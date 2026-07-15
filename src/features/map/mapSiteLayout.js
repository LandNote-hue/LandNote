/** 지도 우측 컨트롤 공통 레이아웃 (툴바·줌 겹침 방지) */
export const MAP_CONTROL_RIGHT = 10;
export const MAP_TOOLBAR_TOP = 10;
export const MAP_TOOLBAR_HEIGHT = 32;
export const MAP_CONTROL_GAP = 8;
export const MAP_ZOOM_RAIL_WIDTH = 36;
export const MAP_ZOOM_RAIL_TOP = MAP_TOOLBAR_TOP + MAP_TOOLBAR_HEIGHT + MAP_CONTROL_GAP;

/** 툴바가 줌 레일 영역을 침범하지 않도록 우측 여백 */
export const MAP_TOOLBAR_MAX_WIDTH = `calc(100% - ${MAP_CONTROL_RIGHT * 2 + MAP_ZOOM_RAIL_WIDTH}px)`;
