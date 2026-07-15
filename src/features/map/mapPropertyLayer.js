/**
 * 지도 매물 레이어 — 화면 좌표(screen-space) HTML 레이어
 *
 * CustomOverlay는 콘텐츠 크기·렌더 타이밍에 따라 앵커가 틀어집니다.
 * → map.getProjection().containerPointFromCoords() 로 픽셀 좌표를 직접 계산
 * → 카드+핀을 하나의 flex 스택(MapMarkerStack)으로 핀 끝에 고정
 */

import { createRoot } from 'react-dom/client';

function markerKey(id) {
  return id == null ? '' : String(id);
}

/** @param {typeof window.kakao} kakao @param {unknown} map @param {number} lat @param {number} lng */
function latLngToContainerPoint(kakao, map, lat, lng) {
  const projection = map?.getProjection?.();
  if (!projection?.containerPointFromCoords) return null;
  try {
    const point = projection.containerPointFromCoords(new kakao.maps.LatLng(lat, lng));
    if (!point || !Number.isFinite(point.x) || !Number.isFinite(point.y)) return null;
    return { x: point.x, y: point.y };
  } catch {
    return null;
  }
}

function positionScreenMarker(kakao, map, entry, mapContainerEl) {
  const { el, item } = entry;
  if (!el || !item || !Number.isFinite(item.lat) || !Number.isFinite(item.lng)) return;

  const pt = latLngToContainerPoint(kakao, map, item.lat, item.lng);
  if (!pt) {
    el.style.visibility = 'hidden';
    return;
  }

  if (mapContainerEl) {
    const w = mapContainerEl.clientWidth;
    const h = mapContainerEl.clientHeight;
    if (pt.x < 0 || pt.x > w || pt.y < 0 || pt.y > h) {
      el.style.visibility = 'hidden';
      return;
    }
  }

  el.style.visibility = 'visible';
  el.style.transform = `translate(${Math.round(pt.x)}px, ${Math.round(pt.y)}px)`;
}

/** @param {typeof window.kakao} kakao @param {unknown} map @param {{ current: unknown[] }} propertyRefs @param {HTMLElement | null} [mapContainerEl] */
export function refreshScreenMarkerPositions(kakao, map, propertyRefs, mapContainerEl = null) {
  if (!kakao || !map) return;
  propertyRefs.current.forEach((entry) => positionScreenMarker(kakao, map, entry, mapContainerEl));
}

/**
 * 줌·드래그·idle 시 화면 좌표 재계산 (지도 컨테이너 위 HTML 레이어)
 * @returns {() => void} cleanup
 */
export function attachScreenMarkerPositionSync(kakao, map, propertyRefs, mapContainer) {
  if (!map || !kakao?.maps?.event) return () => {};

  const refresh = () => refreshScreenMarkerPositions(kakao, map, propertyRefs, mapContainer ?? null);

  const onZoom = () => refresh();
  const onDrag = () => refresh();
  const onIdle = () => refresh();
  const onCenter = () => refresh();

  kakao.maps.event.addListener(map, 'zoom_changed', onZoom);
  kakao.maps.event.addListener(map, 'drag', onDrag);
  kakao.maps.event.addListener(map, 'idle', onIdle);
  kakao.maps.event.addListener(map, 'center_changed', onCenter);

  let resizeObserver = null;
  if (mapContainer && typeof ResizeObserver !== 'undefined') {
    resizeObserver = new ResizeObserver(refresh);
    resizeObserver.observe(mapContainer);
  }

  refresh();
  requestAnimationFrame(() => requestAnimationFrame(refresh));

  return () => {
    resizeObserver?.disconnect();
    kakao.maps.event.removeListener(map, 'zoom_changed', onZoom);
    kakao.maps.event.removeListener(map, 'drag', onDrag);
    kakao.maps.event.removeListener(map, 'idle', onIdle);
    kakao.maps.event.removeListener(map, 'center_changed', onCenter);
  };
}

/** @deprecated refreshScreenMarkerPositions 사용 */
export function refreshCardOverlayPositions(kakao, propertyRefs) {
  refreshScreenMarkerPositions(kakao, null, propertyRefs);
}

/** @deprecated attachScreenMarkerPositionSync 사용 */
export function scheduleCardOverlayLayoutSync(kakao, map, propertyRefs) {
  refreshScreenMarkerPositions(kakao, map, propertyRefs);
  requestAnimationFrame(() => requestAnimationFrame(() => {
    refreshScreenMarkerPositions(kakao, map, propertyRefs);
  }));
}

export function syncCardOverlaysOnIdle(kakao, map, propertyRefs) {
  scheduleCardOverlayLayoutSync(kakao, map, propertyRefs);
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
 * @param {typeof window.kakao} kakao
 * @param {unknown} map
 * @param {HTMLElement} screenLayer
 */
export function placePropertyLayer(
  kakao,
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

  refreshScreenMarkerPositions(kakao, map, propertyRefs);
  requestAnimationFrame(() => requestAnimationFrame(() => {
    refreshScreenMarkerPositions(kakao, map, propertyRefs);
  }));
}

export function updatePropertyLayerInPlace(
  kakao,
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

  refreshScreenMarkerPositions(kakao, map, propertyRefs);
  requestAnimationFrame(() => requestAnimationFrame(() => {
    refreshScreenMarkerPositions(kakao, map, propertyRefs);
  }));
  return true;
}
