/**
 * 네이버 지도 거리뷰(Panorama) — 지도 + 로드뷰 패널
 * 왼쪽 지도에는 현재 시점을 나타내는 Peg + 보는 방향 부채꼴을 표시한다.
 */

import { loadNaverMaps, latLng, coordToLatLng } from '../../services/naver/naverMaps.js';
import { addMapListener, removeMapListener } from './mapEvents.js';
import { setStreetLayer } from './mapLayers.js';

const MAP_BLUE = '#3396FF';
const VIEW_SIZE = 176;
const CONE_R = 78;
const GRAD_ID = 'ln-rv-cone-grad';
const PEG = 11;

function hasPanoramaApi(naver) {
  return typeof naver?.maps?.Panorama === 'function';
}

export async function ensureRoadviewLibrary() {
  const naver = await loadNaverMaps({ panorama: true });
  if (!hasPanoramaApi(naver)) {
    throw new Error('거리뷰 API를 사용할 수 없습니다. 스크립트에 panorama 서브모듈이 필요합니다.');
  }
  return naver;
}

function resizeMap(map) {
  try { map?.autoResize?.(); } catch { /* ignore */ }
  try { window.naver?.maps?.Event?.trigger?.(map, 'resize'); } catch { /* ignore */ }
}

function coneHalfDeg(fov) {
  const n = Number(fov);
  const f = Number.isFinite(n) ? n : 100;
  return Math.max(16, Math.min(70, f * 0.42));
}

function conePathD(halfDeg) {
  const cx = VIEW_SIZE / 2;
  const cy = VIEW_SIZE / 2;
  const rad = (halfDeg * Math.PI) / 180;
  const x1 = cx - CONE_R * Math.sin(rad);
  const y1 = cy - CONE_R * Math.cos(rad);
  const x2 = cx + CONE_R * Math.sin(rad);
  const y2 = cy - CONE_R * Math.cos(rad);
  return `M ${cx} ${cy} L ${x1.toFixed(1)} ${y1.toFixed(1)} A ${CONE_R} ${CONE_R} 0 0 1 ${x2.toFixed(1)} ${y2.toFixed(1)} Z`;
}

function readPov(panorama) {
  const pov = panorama?.getPov?.() || {};
  const pan = Number(pov.pan);
  const fov = Number(pov.fov);
  return {
    pan: Number.isFinite(pan) ? pan : 0,
    fov: Number.isFinite(fov) ? fov : 100,
  };
}

function createViewpointEl() {
  const el = document.createElement('div');
  el.style.cssText = [
    'position:absolute',
    `width:${VIEW_SIZE}px`,
    `height:${VIEW_SIZE}px`,
    `margin-left:-${VIEW_SIZE / 2}px`,
    `margin-top:-${VIEW_SIZE / 2}px`,
    'pointer-events:none',
    'z-index:120',
  ].join(';');
  el.innerHTML = `
    <div data-rv-cone style="position:absolute;inset:0;transform-origin:50% 50%;will-change:transform;">
      <svg width="${VIEW_SIZE}" height="${VIEW_SIZE}" viewBox="0 0 ${VIEW_SIZE} ${VIEW_SIZE}" aria-hidden="true">
        <defs>
          <radialGradient id="${GRAD_ID}" cx="50%" cy="50%" r="72%">
            <stop offset="0%" stop-color="${MAP_BLUE}" stop-opacity="0.50"/>
            <stop offset="70%" stop-color="${MAP_BLUE}" stop-opacity="0.18"/>
            <stop offset="100%" stop-color="${MAP_BLUE}" stop-opacity="0.02"/>
          </radialGradient>
        </defs>
        <path data-rv-fan fill="url(#${GRAD_ID})" stroke="${MAP_BLUE}" stroke-opacity="0.55" stroke-width="1.4"/>
      </svg>
    </div>
    <div style="
      position:absolute;left:50%;top:50%;width:${PEG * 2}px;height:${PEG * 2}px;
      margin:-${PEG}px 0 0 -${PEG}px;border-radius:50%;background:${MAP_BLUE};
      border:2.5px solid #fff;box-shadow:0 1px 5px rgba(15,23,42,.35);
    "></div>
  `;
  return el;
}

function updateViewpointEl(el, pan, fov) {
  if (!el) return;
  const cone = el.querySelector('[data-rv-cone]');
  const fan = el.querySelector('[data-rv-fan]');
  if (cone) cone.style.transform = `rotate(${pan}deg)`;
  if (fan) fan.setAttribute('d', conePathD(coneHalfDeg(fov)));
}

function offsetOf(map, position) {
  const projection = map?.getProjection?.();
  if (!projection || !position) return null;
  try {
    if (typeof projection.fromCoordToOffset === 'function') {
      return projection.fromCoordToOffset(position);
    }
  } catch { /* ignore */ }
  try {
    if (typeof projection.fromLatLngToOffset === 'function') {
      return projection.fromLatLngToOffset(position);
    }
  } catch { /* ignore */ }
  return null;
}

/**
 * 지도 위에 고정되는 시선 표시 (팬·줌과 함께 이동, CSS로 회전)
 * @param {typeof window.naver} ns
 * @param {object} map
 */
function createViewpointOverlay(ns, map) {
  const el = createViewpointEl();
  let position = map.getCenter();
  const OverlayView = ns.maps.OverlayView;

  function Binder() {
    OverlayView.call(this);
  }
  Binder.prototype = Object.create(OverlayView.prototype);
  Binder.prototype.constructor = Binder;
  Binder.prototype.onAdd = function onAdd() {
    const panes = this.getPanes();
    const pane = panes?.overlayLayer || panes?.floatPane || panes?.overlayMouseTarget;
    pane?.appendChild(el);
  };
  Binder.prototype.draw = function draw() {
    const pt = offsetOf(map, position);
    if (!pt) {
      el.style.visibility = 'hidden';
      return;
    }
    const x = pt.x ?? pt.left;
    const y = pt.y ?? pt.top;
    if (!Number.isFinite(x) || !Number.isFinite(y)) {
      el.style.visibility = 'hidden';
      return;
    }
    el.style.visibility = 'visible';
    el.style.left = `${x}px`;
    el.style.top = `${y}px`;
  };
  Binder.prototype.onRemove = function onRemove() {
    if (el.parentNode) el.parentNode.removeChild(el);
  };

  const binder = new Binder();
  binder.setMap(map);
  updateViewpointEl(el, 0, 100);

  return {
    el,
    setPosition(next) {
      if (!next) return;
      position = next;
      try { binder.draw(); } catch { /* ignore */ }
    },
    setPov(pan, fov) {
      updateViewpointEl(el, pan, fov);
    },
    setMap(nextMap) {
      try { binder.setMap(nextMap); } catch { /* ignore */ }
    },
    destroy() {
      try { binder.setMap(null); } catch { /* ignore */ }
    },
  };
}

/**
 * @param {typeof window.naver} naver
 * @param {object} map
 * @param {HTMLElement} roadviewContainer
 * @param {{ onLayout?: () => void }} [options]
 */
export function createMapRoadviewController(naver, map, roadviewContainer, options = {}) {
  /** @type {unknown[]} */
  const listeners = [];
  let panorama = null;
  let marker = null;
  let overlay = null;
  let enabled = false;
  let dragging = false;
  let panoStatusListener = null;

  const relayout = () => {
    resizeMap(map);
    try { panorama?.setSize?.(); } catch { /* ignore */ }
    options.onLayout?.();
  };

  const syncViewpointFromPano = () => {
    if (!panorama || !overlay) return;
    const { pan, fov } = readPov(panorama);
    overlay.setPov(pan, fov);
  };

  const syncMarkerFromPano = () => {
    if (dragging || !panorama) return;
    try {
      const pos = panorama.getPosition?.();
      if (!pos) return;
      marker?.setPosition(pos);
      overlay?.setPosition(pos);
    } catch { /* ignore */ }
  };

  const showAt = (position) => {
    if (!panorama) return;
    try {
      panorama.setPosition(position);
    } catch {
      window.alert('이 위치 주변에 거리뷰가 없습니다.');
    }
  };

  return {
    isEnabled: () => enabled,

    async enable() {
      if (enabled) return;
      const ns = await ensureRoadviewLibrary();

      if (!panorama) {
        const center = map.getCenter();
        panorama = new ns.maps.Panorama(roadviewContainer, {
          position: center,
          pov: { pan: 0, tilt: 0, fov: 100 },
          aroundControl: true,
        });
        panoStatusListener = addMapListener(panorama, 'pano_status', (status) => {
          if (status && ns.maps.PanoramaStatus && status !== ns.maps.PanoramaStatus.OK) {
            window.alert('이 위치 주변에 거리뷰가 없습니다.');
          }
        });
      }

      setStreetLayer(map, true);
      enabled = true;

      const center = map.getCenter();

      if (!overlay) overlay = createViewpointOverlay(ns, map);
      else overlay.setMap(map);
      overlay.setPosition(center);
      overlay.setPov(0, 100);

      if (!marker) {
        marker = new ns.maps.Marker({
          position: center,
          map,
          icon: {
            content: `<div style="width:${PEG * 2}px;height:${PEG * 2}px;border-radius:50%;cursor:grab"></div>`,
            anchor: new ns.maps.Point(PEG, PEG),
          },
          draggable: true,
          zIndex: 121,
        });
      } else {
        marker.setMap(map);
        marker.setPosition(center);
      }

      listeners.push(addMapListener(marker, 'dragstart', () => { dragging = true; }));
      listeners.push(addMapListener(marker, 'drag', () => {
        overlay?.setPosition(marker.getPosition());
      }));
      listeners.push(addMapListener(marker, 'dragend', () => {
        dragging = false;
        const pos = marker.getPosition();
        overlay?.setPosition(pos);
        showAt(pos);
      }));

      listeners.push(addMapListener(map, 'click', (e) => {
        const pos = e?.coord || e?.latlng || latLng(
          coordToLatLng(map.getCenter()).lat,
          coordToLatLng(map.getCenter()).lng,
        );
        marker.setPosition(pos);
        overlay?.setPosition(pos);
        showAt(pos);
      }));

      listeners.push(addMapListener(panorama, 'pov_changed', syncViewpointFromPano));
      listeners.push(addMapListener(panorama, 'pano_changed', () => {
        syncMarkerFromPano();
        syncViewpointFromPano();
      }));

      requestAnimationFrame(() => {
        relayout();
        showAt(center);
        syncViewpointFromPano();
      });
    },

    disable() {
      if (!enabled) return;
      setStreetLayer(map, false);
      marker?.setMap(null);
      overlay?.setMap(null);
      listeners.forEach(removeMapListener);
      listeners.length = 0;
      dragging = false;
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
      removeMapListener(panoStatusListener);
      panoStatusListener = null;
      overlay?.destroy();
      overlay = null;
      marker = null;
      try {
        if (roadviewContainer) roadviewContainer.replaceChildren();
      } catch { /* ignore */ }
      panorama = null;
    },
  };
}
