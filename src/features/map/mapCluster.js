import { latLng } from '../../services/naver/naverMaps.js';
import { addMapListener, removeMapListener } from './mapEvents.js';

function markerKey(id) {
  return id == null ? '' : String(id);
}

function cellKey(lat, lng, zoom) {
  const cell = 360 / (2 ** Math.max(Number(zoom) || 1, 1)) * 0.4;
  return `${Math.floor(lng / cell)}:${Math.floor(lat / cell)}`;
}

function badgeSize(count) {
  if (count < 10) return 36;
  if (count < 100) return 42;
  return 48;
}

function clusterBadgeHtml(count) {
  const size = badgeSize(count);
  return (
    `<div style="width:${size}px;height:${size}px;border-radius:50%;`
    + 'background:#2563EB;border:2px solid #fff;'
    + 'box-shadow:0 2px 8px rgba(37,99,235,.35);color:#fff;'
    + `font:700 13px/${size}px system-ui,sans-serif;text-align:center">${count}</div>`
  );
}

/**
 * 네이버 SDK에 MarkerClusterer가 없어, 줌 구간별로 배지 클러스터를 직접 그린다.
 * @returns {{ clear: () => void }}
 */
export function placeClusteredMarkers(naver, map, items, {
  onClick,
  selectedId,
  minLevel = 5,
  markerMapRef,
} = {}) {
  /** @type {object[]} */
  const markers = [];
  /** @type {unknown[]} */
  const listeners = [];
  let zoomListener = null;

  const wipe = () => {
    listeners.forEach(removeMapListener);
    listeners.length = 0;
    markers.forEach((m) => {
      try { m.setMap(null); } catch { /* ignore */ }
    });
    markers.length = 0;
  };

  const render = () => {
    wipe();
    if (!map || !items.length) return;

    const level = typeof map.getLevel === 'function' ? map.getLevel() : 6;
    const zoom = typeof map.getZoom === 'function' ? map.getZoom() : 15;
    const useCluster = level >= minLevel && items.length > 1;

    /** @param {typeof items[number]} item */
    const addPin = (item) => {
      const isSelected = markerKey(selectedId) === markerKey(item.id);
      const marker = new naver.maps.Marker({
        position: latLng(item.lat, item.lng),
        map,
        title: item.title || '',
        zIndex: isSelected ? 20 : 10,
      });
      if (onClick) listeners.push(addMapListener(marker, 'click', () => onClick(item)));
      if (item.id != null && markerMapRef) {
        markerMapRef.current.set(markerKey(item.id), { marker, item });
      }
      markers.push(marker);
    };

    if (!useCluster) {
      items.forEach(addPin);
      return;
    }

    const groups = new Map();
    items.forEach((item) => {
      const key = cellKey(item.lat, item.lng, zoom);
      if (!groups.has(key)) groups.set(key, []);
      groups.get(key).push(item);
    });

    groups.forEach((group) => {
      if (group.length === 1) {
        addPin(group[0]);
        return;
      }
      const lat = group.reduce((s, i) => s + i.lat, 0) / group.length;
      const lng = group.reduce((s, i) => s + i.lng, 0) / group.length;
      const size = badgeSize(group.length);
      const marker = new naver.maps.Marker({
        position: latLng(lat, lng),
        map,
        icon: {
          content: clusterBadgeHtml(group.length),
          anchor: new naver.maps.Point(size / 2, size / 2),
        },
        zIndex: 30,
        title: `${group.length}건`,
      });
      listeners.push(addMapListener(marker, 'click', () => {
        map.setCenter(latLng(lat, lng));
        map.setLevel(Math.max(1, map.getLevel() - 2));
      }));
      markers.push(marker);
    });
  };

  render();
  zoomListener = addMapListener(map, 'zoom_changed', render);

  return {
    clear() {
      removeMapListener(zoomListener);
      wipe();
    },
  };
}
