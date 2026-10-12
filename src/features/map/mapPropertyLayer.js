/**
 * 지도 매물 레이어 — 화면 좌표(screen-space) HTML 레이어
 *
 * CustomOverlay는 콘텐츠 크기·렌더 타이밍에 따라 앵커가 틀어집니다.
 * → projection.fromCoordToOffset / containerPointFromCoords 로 픽셀 좌표를 직접 계산
 * → 카드+핀을 하나의 flex 스택(MapMarkerStack)으로 핀 끝에 고정
 */

import { createRoot } from 'react-dom/client';
import { latLng } from '../../services/naver/naverMaps.js';
import { addMapListener, removeMapListener } from './mapEvents.js';

function markerKey(id) {
  return id == null ? '' : String(id);
}

function readXy(pt) {
  if (!pt) return null;
  const x = Number(pt.x);
  const y = Number(pt.y);
  if (!Number.isFinite(x) || !Number.isFinite(y)) return null;
  return { x, y };
}

function paneOffset(map, lat, lng) {
  const projection = map?.getProjection?.();
  if (!projection) return null;
  try {
    const coord = latLng(lat, lng);
    if (typeof projection.fromCoordToOffset === 'function') {
      return readXy(projection.fromCoordToOffset(coord));
    }
    if (typeof projection.containerPointFromCoords === 'function') {
      return readXy(projection.containerPointFromCoords(coord));
    }
  } catch {
    /* ignore */
  }
  return null;
}

function mapCenterLatLng(map) {
  const center = map?.getCenter?.();
  if (!center) return null;
  const lat = typeof center.lat === 'function' ? center.lat() : center.lat;
  const lng = typeof center.lng === 'function' ? center.lng() : center.lng;
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;
  return { lat, lng };
}

/** 지도 컨테이너(뷰포트) 기준 픽셀 — 팬 후 getCenter 반영 */
function viewportPoint(map, lat, lng) {
  const offset = paneOffset(map, lat, lng);
  if (!offset) return null;
  try {
    const center = mapCenterLatLng(map);
    const size = map.getSize?.();
    if (center && size) {
      const c = paneOffset(map, center.lat, center.lng);
      if (c && Number.isFinite(size.width) && Number.isFinite(size.height)) {
        return {
          x: size.width / 2 + (offset.x - c.x),
          y: size.height / 2 + (offset.y - c.y),
        };
      }
    }
  } catch {
    /* fall through */
  }
  return offset;
}

function markerUsesMapPane(map, el) {
  const mapEl = typeof map?.getElement === 'function' ? map.getElement() : null;
  return !!(mapEl && el && mapEl.contains(el));
}

function positionScreenMarker(naver, map, entry, mapContainerEl) {
  const { el, item } = entry;
  if (!el || !item || !Number.isFinite(item.lat) || !Number.isFinite(item.lng)) return;

  const viewPt = viewportPoint(map, item.lat, item.lng);
  const panePt = paneOffset(map, item.lat, item.lng);
  if (!viewPt && !panePt) {
    el.style.visibility = 'hidden';
    return;
  }

  if (mapContainerEl && viewPt) {
    const w = mapContainerEl.clientWidth;
    const h = mapContainerEl.clientHeight;
    const pad = 120;
    if (viewPt.x < -pad || viewPt.x > w + pad || viewPt.y < -pad || viewPt.y > h + pad) {
      el.style.visibility = 'hidden';
      return;
    }
  }

  const inPane = markerUsesMapPane(map, el);
  const pt = inPane ? (panePt || viewPt) : (viewPt || panePt);
  el.style.visibility = 'visible';
  el.style.transform = `translate(${Math.round(pt.x)}px, ${Math.round(pt.y)}px)`;
}

/** @param {typeof window.naver} naver @param {unknown} map @param {{ current: unknown[] }} propertyRefs @param {HTMLElement | null} [mapContainerEl] */
export function refreshScreenMarkerPositions(naver, map, propertyRefs, mapContainerEl = null) {
  if (!naver || !map) return;
  propertyRefs.current.forEach((entry) => positionScreenMarker(naver, map, entry, mapContainerEl));
}

/**
 * 줌·드래그·idle 시 화면 좌표 재계산 (지도 컨테이너 위 HTML 레이어)
 * @returns {() => void} cleanup
 */
export function attachScreenMarkerPositionSync(naver, map, propertyRefs, mapContainer) {
  if (!map || !naver?.maps?.Event) return () => {};

  const refresh = () => refreshScreenMarkerPositions(naver, map, propertyRefs, mapContainer ?? null);

  let dragging = false;
  let raf = 0;
  const tick = () => {
    raf = 0;
    refresh();
    if (dragging) raf = requestAnimationFrame(tick);
  };
  const startDrag = () => {
    dragging = true;
    if (!raf) raf = requestAnimationFrame(tick);
  };
  const endDrag = () => {
    dragging = false;
    refresh();
  };

  const listeners = [
    addMapListener(map, 'zoom_changed', refresh),
    addMapListener(map, 'zoomend', refresh),
    addMapListener(map, 'dragstart', startDrag),
    addMapListener(map, 'drag', refresh),
    addMapListener(map, 'dragend', endDrag),
    addMapListener(map, 'idle', refresh),
    addMapListener(map, 'center_changed', refresh),
    addMapListener(map, 'bounds_changed', refresh),
  ];

  let resizeObserver = null;
  if (mapContainer && typeof ResizeObserver !== 'undefined') {
    resizeObserver = new ResizeObserver(refresh);
    resizeObserver.observe(mapContainer);
  }

  refresh();
  requestAnimationFrame(() => requestAnimationFrame(refresh));

  return () => {
    dragging = false;
    if (raf) cancelAnimationFrame(raf);
    resizeObserver?.disconnect();
    listeners.forEach(removeMapListener);
  };
}

/**
 * HTML 카드 레이어를 네이버 지도 팬 페인에 붙여, 드래그 시 타일과 같이 움직이게 한다.
 * @returns {{ host: HTMLElement, unmount: () => void } | null}
 */
export function mountOverlayHost(naver, map) {
  if (!naver?.maps?.OverlayView || !map) return null;

  const host = document.createElement('div');
  host.style.cssText = [
    'position:absolute',
    'left:0',
    'top:0',
    'width:0',
    'height:0',
    'overflow:visible',
    'pointer-events:none',
  ].join(';');

  const OverlayView = naver.maps.OverlayView;
  function Binder() {
    OverlayView.call(this);
  }
  Binder.prototype = Object.create(OverlayView.prototype);
  Binder.prototype.constructor = Binder;
  Binder.prototype.onAdd = function onAdd() {
    const panes = this.getPanes();
    const pane = panes?.overlayMouseTarget || panes?.floatPane || panes?.overlayLayer;
    pane?.appendChild(host);
  };
  Binder.prototype.draw = function draw() {};
  Binder.prototype.onRemove = function onRemove() {
    if (host.parentNode) host.parentNode.removeChild(host);
  };

  const binder = new Binder();
  binder.setMap(map);

  return {
    host,
    unmount() {
      try { binder.setMap(null); } catch { /* ignore */ }
    },
  };
}

/** @deprecated refreshScreenMarkerPositions 사용 */
export function refreshCardOverlayPositions(naver, propertyRefs) {
  refreshScreenMarkerPositions(naver, null, propertyRefs);
}

/** @deprecated attachScreenMarkerPositionSync 사용 */
export function scheduleCardOverlayLayoutSync(naver, map, propertyRefs) {
  refreshScreenMarkerPositions(naver, map, propertyRefs);
  requestAnimationFrame(() => requestAnimationFrame(() => {
    refreshScreenMarkerPositions(naver, map, propertyRefs);
  }));
}

export function syncCardOverlaysOnIdle(naver, map, propertyRefs) {
  scheduleCardOverlayLayoutSync(naver, map, propertyRefs);
}

export function clearPropertyLayer(propertyRefs) {
  propertyRefs.current.forEach((entry) => {
    try { entry.root?.unmount(); } catch { /* unmount */ }
    try { entry.el?.remove(); } catch { /* unmount */ }
  });
  propertyRefs.current = [];
}

/** @param {{ current: unknown[] }} propertyRefs @param {unknown[]} resolved */
export function propertyLayerMatchesResolved(propertyRefs, resolved) {
  if (propertyRefs.current.length !== resolved.length) return false;
  const ids = new Set(resolved.map((r) => markerKey(r.id)));
  return propertyRefs.current.every(({ id }) => ids.has(markerKey(id)));
}

/** 화면 레이어는 DOM 구조가 동일 — 모드 전환 시 in-place 갱신 가능 */
export function propertyLayerCardStructureMatches() {
  return true;
}

function createScreenMarker(
  item,
  isSelected,
  cardDisplayMode,
  renderMarkerCard,
  onMarkerClick,
) {
  const el = document.createElement('div');
  el.style.cssText = [
    'position:absolute',
    'left:0',
    'top:0',
    'width:0',
    'height:0',
    'overflow:visible',
    'will-change:transform',
    'pointer-events:none',
    `z-index:${isSelected ? 32 : 22}`,
  ].join(';');

  const inner = document.createElement('div');
  inner.style.cssText = [
    'position:absolute',
    'left:0',
    'bottom:0',
    'transform:translate(-50%, 0)',
    'display:flex',
    'flex-direction:column',
    'align-items:center',
    'pointer-events:auto',
  ].join(';');
  el.appendChild(inner);

  const root = createRoot(inner);
  root.render(renderMarkerCard(item, isSelected, cardDisplayMode));

  if (onMarkerClick) {
    inner.addEventListener('click', (e) => {
      e.stopPropagation();
      onMarkerClick(item);
    });
  }

  return { el, root, inner };
}

/**
 * @param {typeof window.naver} naver
 * @param {unknown} map
 * @param {HTMLElement} screenLayer
 */
export function placePropertyLayer(
  naver,
  map,
  resolved,
  renderMarkerCard,
  selectedId,
  cardDisplayMode,
  propertyRefs,
  markerMapRef,
  onMarkerClick,
  screenLayer,
) {
  clearPropertyLayer(propertyRefs);
  if (!map || !screenLayer || !resolved.length || !renderMarkerCard) return;

  resolved.forEach((item) => {
    const isSelected = markerKey(selectedId) === markerKey(item.id);
    const { el, root } = createScreenMarker(
      item,
      isSelected,
      cardDisplayMode,
      renderMarkerCard,
      onMarkerClick,
    );
    screenLayer.appendChild(el);

    propertyRefs.current.push({
      id: item.id,
      item,
      el,
      root,
    });

    if (item.id != null) {
      markerMapRef.current.set(markerKey(item.id), { marker: null, item });
    }
  });

  refreshScreenMarkerPositions(naver, map, propertyRefs);
  requestAnimationFrame(() => requestAnimationFrame(() => {
    refreshScreenMarkerPositions(naver, map, propertyRefs);
  }));
}

export function updatePropertyLayerInPlace(
  naver,
  map,
  propertyRefs,
  renderMarkerCard,
  selectedId,
  cardDisplayMode,
) {
  if (!renderMarkerCard) return false;

  propertyRefs.current.forEach((entry) => {
    const { item, el, root } = entry;
    if (!item || !root) return;
    const isSelected = markerKey(selectedId) === markerKey(item.id);

    if (el) el.style.zIndex = isSelected ? '32' : '22';
    root.render(renderMarkerCard(item, isSelected, cardDisplayMode));
  });

  refreshScreenMarkerPositions(naver, map, propertyRefs);
  requestAnimationFrame(() => requestAnimationFrame(() => {
    refreshScreenMarkerPositions(naver, map, propertyRefs);
  }));
  return true;
}
