/**
 * 카카오맵 로드뷰 — 지도 + 로드뷰 패널 (공식 샘플 기반)
 */

import { loadKakaoMaps } from '../../services/kakao/kakaoMaps.js';

function hasRoadviewApi(kakao) {
  return typeof kakao?.maps?.Roadview === 'function'
    && typeof kakao?.maps?.RoadviewClient === 'function';
}

export async function ensureRoadviewLibrary() {
  await loadKakaoMaps(['services', 'roadview']);
  if (!hasRoadviewApi(window.kakao)) {
    throw new Error('로드뷰 API를 사용할 수 없습니다.');
  }
  return window.kakao;
}

/**
 * @param {typeof window.kakao} kakao
 * @param {object} map
 * @param {HTMLElement} roadviewContainer
 * @param {{ onLayout?: () => void }} [options]
 */
export function createMapRoadviewController(kakao, map, roadviewContainer, options = {}) {
  /** @type {{ target: object, type: string, fn: (...args: unknown[]) => void }[]} */
  const listeners = [];
  let roadview = null;
  let client = null;
  let marker = null;
  let enabled = false;

  const relayout = () => {
    try { map.relayout(); } catch { /* ignore */ }
    try { roadview?.relayout(); } catch { /* ignore */ }
    options.onLayout?.();
  };

  const addListener = (target, type, fn) => {
    kakao.maps.event.addListener(target, type, fn);
    listeners.push({ target, type, fn });
  };

  const clearListeners = () => {
    listeners.forEach(({ target, type, fn }) => {
      try { kakao.maps.event.removeListener(target, type, fn); } catch { /* ignore */ }
    });
    listeners.length = 0;
  };

  const showAt = (position) => {
    if (!client || !roadview) return;
    client.getNearestPanoId(position, 50, (panoId) => {
      if (panoId == null) {
        window.alert('이 위치 주변에 로드뷰가 없습니다.');
        return;
      }
      roadview.setPanoId(panoId, position);
      relayout();
    });
  };

  return {
    isEnabled: () => enabled,

    async enable() {
      if (enabled) return;
      await ensureRoadviewLibrary();

      if (!roadview) {
        roadview = new kakao.maps.Roadview(roadviewContainer);
        client = new kakao.maps.RoadviewClient();
      }

      map.addOverlayMapTypeId(kakao.maps.MapTypeId.ROADVIEW);
      enabled = true;

      const center = map.getCenter();

      if (!marker) {
        marker = new kakao.maps.Marker({
          position: center,
          map,
          draggable: true,
          zIndex: 100,
        });
        addListener(marker, 'dragend', () => showAt(marker.getPosition()));
      } else {
        marker.setMap(map);
        marker.setPosition(center);
      }

      addListener(map, 'click', (mouseEvent) => {
        const pos = mouseEvent.latLng;
        marker.setPosition(pos);
        showAt(pos);
      });

      requestAnimationFrame(() => {
        relayout();
        showAt(center);
      });
    },

    disable() {
      if (!enabled) return;
      try { map.removeOverlayMapTypeId(kakao.maps.MapTypeId.ROADVIEW); } catch { /* ignore */ }
      marker?.setMap(null);
      clearListeners();
      enabled = false;
      requestAnimationFrame(relayout);
    },

    async toggle() {
      if (enabled) {
        this.disable();
        return false;
      }
      await this.enable();
      return true;
    },

    destroy() {
      this.disable();
      marker = null;
      roadview = null;
      client = null;
    },
  };
}
