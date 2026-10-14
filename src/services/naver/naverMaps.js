/** @typedef {{ lat: number, lng: number }} GeoPoint */

/** @typedef {{ id: string, title: string, subtitle: string, lat: number, lng: number, kind: 'place' | 'address' }} MapSearchResult */

import {
  attachMapLevelCompat,
  mapLevelToNaverZoom,
} from './mapLevel.js';

const geoCache = new Map();
/** @type {Promise<typeof window.naver> | null} */
let loadPromise = null;

export function getNaverMapClientId() {
  return (import.meta.env.VITE_NAVER_MAP_CLIENT_ID || '').trim();
}

function isNaverMapProdHost() {
  if (typeof window === 'undefined') return Boolean(import.meta.env.PROD);
  const host = window.location.hostname;
  return host !== 'localhost' && host !== '127.0.0.1';
}

/** @returns {string} */
export function getNaverMapSetupHint() {
  const origin = typeof window !== 'undefined' ? window.location.origin : 'http://localhost:5175';
  const keyHint = isNaverMapProdHost()
    ? '운영 빌드에는 Vercel 환경 변수 또는 .env.production의 VITE_NAVER_MAP_CLIENT_ID(ncpKeyId)가 들어가야 합니다.'
    : '.env.local의 VITE_NAVER_MAP_CLIENT_ID는 ncpKeyId(Client ID)입니다. 변경 후 개발 서버를 재시작하세요.';
  return (
    `현재 접속 주소: ${origin}\n`
    + '네이버 클라우드 플랫폼 → Application → AI·NAVER API → Maps → Web 서비스 URL에 '
    + `${origin} 을 등록하세요 (포트 번호는 넣지 않습니다).\n`
    + `${keyHint} 구버전 ncpClientId 파라미터는 사용하지 않습니다.`
  );
}

function installAuthFailureHandler() {
  if (typeof window === 'undefined') return;
  if (window.navermap_authFailure?.__lnInstalled) return;
  window.navermap_authFailure = function navermap_authFailure() {
    console.error(
      '[LandNote] 네이버 지도 인증에 실패했습니다. '
      + 'VITE_NAVER_MAP_CLIENT_ID(ncpKeyId)와 네이버 클라우드 콘솔의 Web 서비스 URL을 확인하세요. '
      + `현재 접속 주소: ${window.location.origin}`,
    );
  };
  window.navermap_authFailure.__lnInstalled = true;
}

/** @param {string} key @param {string[]} submodules */
function buildSdkUrl(key, submodules) {
  const mods = [...new Set(submodules.filter(Boolean))].join(',');
  let url = `https://oapi.map.naver.com/openapi/v3/maps.js?ncpKeyId=${encodeURIComponent(key)}`;
  if (mods) url += `&submodules=${mods}`;
  return url;
}

function isMapsReady() {
  return typeof window.naver?.maps?.Map === 'function'
    && typeof window.naver?.maps?.LatLng === 'function';
}

function hasGeocoder() {
  return typeof window.naver?.maps?.Service?.geocode === 'function';
}

function hasPanorama() {
  return typeof window.naver?.maps?.Panorama === 'function';
}

function rejectLoad(reject, headline) {
  loadPromise = null;
  reject(new Error(`${headline}\n\n${getNaverMapSetupHint()}`));
}

function waitForMapsReady(timeoutMs = 15000, { geocoder = true, panorama = false } = {}) {
  return new Promise((resolve, reject) => {
    const started = Date.now();

    const finish = () => {
      if (!isMapsReady()) return false;
      if (geocoder && !hasGeocoder()) return false;
      if (panorama && !hasPanorama()) return false;
      resolve(window.naver);
      return true;
    };

    const tick = () => {
      if (finish()) return;
      if (Date.now() - started > timeoutMs) {
        rejectLoad(reject, '네이버 지도 SDK 초기화 시간이 초과되었습니다.');
        return;
      }
      setTimeout(tick, 50);
    };

    if (finish()) return;
    tick();
  });
}

/** @param {string} key @param {string[]} submodules */
function appendSdkScript(key, submodules) {
  return new Promise((resolve, reject) => {
    const src = buildSdkUrl(key, submodules);
    const existing = document.querySelector(`script[data-naver-map-sdk="${src}"]`);
    const wantPanorama = submodules.includes('panorama');

    if (existing) {
      existing.addEventListener('load', () => {
        waitForMapsReady(15000, { geocoder: true, panorama: wantPanorama }).then(resolve).catch(reject);
      }, { once: true });
      existing.addEventListener('error', () => rejectLoad(reject, '네이버 지도 SDK를 불러오지 못했습니다.'), { once: true });
      if (isMapsReady() && hasGeocoder() && (!wantPanorama || hasPanorama())) {
        resolve(window.naver);
      }
      return;
    }

    const script = document.createElement('script');
    script.src = src;
    script.async = true;
    script.dataset.naverMapSdk = src;

    script.onload = () => {
      waitForMapsReady(15000, { geocoder: true, panorama: wantPanorama }).then(resolve).catch(reject);
    };
    script.onerror = () => {
      script.remove();
      rejectLoad(reject, '네이버 지도 SDK를 불러오지 못했습니다.');
    };

    document.head.appendChild(script);
  });
}

/**
 * 네이버 지도 JavaScript API v3 동적 로드 (ncpKeyId 신규 방식)
 * @param {{ panorama?: boolean }} [opts]
 */
export async function loadNaverMaps(opts = {}) {
  if (typeof window === 'undefined') {
    throw new Error('브라우저 환경에서만 사용할 수 있습니다.');
  }
  const key = getNaverMapClientId();
  if (!key) {
    throw new Error('VITE_NAVER_MAP_CLIENT_ID가 설정되지 않았습니다.');
  }

  installAuthFailureHandler();

  const wantPanorama = Boolean(opts.panorama);
  const submodules = wantPanorama ? ['geocoder', 'panorama'] : ['geocoder'];

  if (isMapsReady() && hasGeocoder() && (!wantPanorama || hasPanorama())) {
    return window.naver;
  }

  if (isMapsReady() && hasGeocoder() && wantPanorama && !hasPanorama()) {
    return appendSdkScript(key, ['geocoder', 'panorama']);
  }

  if (loadPromise) {
    const naver = await loadPromise;
    if (wantPanorama && !hasPanorama()) {
      return appendSdkScript(key, ['geocoder', 'panorama']);
    }
    return naver;
  }

  loadPromise = appendSdkScript(key, submodules);

  try {
    return await loadPromise;
  } catch (err) {
    loadPromise = null;
    throw err;
  }
}

const SIDO_SHORT_TO_FULL = [
  [/^서울(\s)/, '서울특별시$1'],
  [/^부산(\s)/, '부산광역시$1'],
  [/^대구(\s)/, '대구광역시$1'],
  [/^인천(\s)/, '인천광역시$1'],
  [/^광주(\s)/, '광주광역시$1'],
  [/^대전(\s)/, '대전광역시$1'],
  [/^울산(\s)/, '울산광역시$1'],
  [/^세종(\s)/, '세종특별자치시$1'],
  [/^경기(\s)/, '경기도$1'],
  [/^강원(\s)/, '강원특별자치도$1'],
  [/^충북(\s)/, '충청북도$1'],
  [/^충남(\s)/, '충청남도$1'],
  [/^전북(\s)/, '전북특별자치도$1'],
  [/^전남(\s)/, '전라남도$1'],
  [/^경북(\s)/, '경상북도$1'],
  [/^경남(\s)/, '경상남도$1'],
  [/^제주(\s)/, '제주특별자치도$1'],
];

const SIDO_FULL_TO_SHORT = [
  [/^서울특별시(\s)/, '서울$1'],
  [/^부산광역시(\s)/, '부산$1'],
  [/^대구광역시(\s)/, '대구$1'],
  [/^인천광역시(\s)/, '인천$1'],
  [/^광주광역시(\s)/, '광주$1'],
  [/^대전광역시(\s)/, '대전$1'],
  [/^울산광역시(\s)/, '울산$1'],
  [/^세종특별자치시(\s)/, '세종$1'],
  [/^경기도(\s)/, '경기$1'],
  [/^강원특별자치도(\s)/, '강원$1'],
  [/^충청북도(\s)/, '충북$1'],
  [/^충청남도(\s)/, '충남$1'],
  [/^전북특별자치도(\s)/, '전북$1'],
  [/^전라남도(\s)/, '전남$1'],
  [/^경상북도(\s)/, '경북$1'],
  [/^경상남도(\s)/, '경남$1'],
  [/^제주특별자치도(\s)/, '제주$1'],
];

/** @param {string} address */
export function expandAddressVariants(address) {
  const base = String(address || '').trim();
  if (!base || base === '—') return [];
  /** @type {string[]} */
  const variants = [base];
  for (const [re, repl] of SIDO_SHORT_TO_FULL) {
    if (re.test(base)) {
      variants.push(base.replace(re, repl));
      break;
    }
  }
  for (const [re, repl] of SIDO_FULL_TO_SHORT) {
    if (re.test(base)) {
      variants.push(base.replace(re, repl));
      break;
    }
  }
  return [...new Set(variants)];
}

/** @param {number} lat @param {number} lng */
export function latLng(lat, lng) {
  return new window.naver.maps.LatLng(lat, lng);
}

/** @param {unknown} coord */
export function coordToLatLng(coord) {
  if (!coord) return { lat: NaN, lng: NaN };
  const lat = typeof coord.lat === 'function'
    ? coord.lat()
    : (typeof coord.getLat === 'function' ? coord.getLat() : coord.y);
  const lng = typeof coord.lng === 'function'
    ? coord.lng()
    : (typeof coord.getLng === 'function' ? coord.getLng() : coord.x);
  return { lat, lng };
}

/** @param {object} map */
export function getMapBoundsBox(map) {
  try {
    const bounds = map?.getBounds?.();
    if (!bounds) return null;
    const sw = bounds.getSW?.() || bounds.getMin?.();
    const ne = bounds.getNE?.() || bounds.getMax?.();
    if (!sw || !ne) return null;
    const southWest = coordToLatLng(sw);
    const northEast = coordToLatLng(ne);
    if (![southWest.lat, southWest.lng, northEast.lat, northEast.lng].every(Number.isFinite)) {
      return null;
    }
    return {
      south: southWest.lat,
      west: southWest.lng,
      north: northEast.lat,
      east: northEast.lng,
    };
  } catch {
    return null;
  }
}

/**
 * @param {HTMLElement} container
 * @param {{ lat?: number, lng?: number, level?: number, interactive?: boolean }} [options]
 */
export function createNaverMap(container, options = {}) {
  const naver = window.naver;
  const map = new naver.maps.Map(container, {
    center: new naver.maps.LatLng(
      options.lat ?? 37.5665,
      options.lng ?? 126.978,
    ),
    zoom: mapLevelToNaverZoom(options.level ?? 6),
    minZoom: 7,
    maxZoom: 20,
    draggable: options.interactive !== false,
    scrollWheel: options.interactive !== false,
    keyboardShortcuts: options.interactive !== false,
    disableDoubleClickZoom: options.interactive === false,
    scaleControl: false,
    logoControl: true,
    mapDataControl: false,
    zoomControl: false,
    mapTypeControl: false,
  });
  return attachMapLevelCompat(map);
}

/** @param {string} address */
export function geocodeAddress(address) {
  const query = String(address || '').trim();
  if (!query || query === '—') return Promise.resolve(null);
  if (geoCache.has(query)) return Promise.resolve(geoCache.get(query) ?? null);

  return loadNaverMaps().then(() => new Promise((resolve) => {
    const naver = window.naver;
    if (typeof naver?.maps?.Service?.geocode !== 'function') {
      resolve(null);
      return;
    }
    naver.maps.Service.geocode({ query }, (status, response) => {
      if (status !== naver.maps.Service.Status.OK) {
        geoCache.set(query, null);
        resolve(null);
        return;
      }
      const item = response?.v2?.addresses?.[0];
      if (!item) {
        geoCache.set(query, null);
        resolve(null);
        return;
      }
      const point = {
        lat: parseFloat(item.y),
        lng: parseFloat(item.x),
      };
      if (!Number.isFinite(point.lat) || !Number.isFinite(point.lng)) {
        geoCache.set(query, null);
        resolve(null);
        return;
      }
      geoCache.set(query, point);
      resolve(point);
    });
  })).catch(() => null);
}

/**
 * @param {string | object} address
 * @param {string[] | string} [extra]
 * @param {{ maxVariants?: number } | string[]} [opts]
 */
export async function geocodeAddressVariants(address, extra = [], opts = {}) {
  let query = address;
  let extras = extra;
  let options = opts;
  if (query && typeof query === 'object' && typeof extra === 'string') {
    query = extra;
    extras = Array.isArray(opts) ? opts : [];
    options = arguments[3] && typeof arguments[3] === 'object' ? arguments[3] : {};
  }
  const maxVariants = options.maxVariants ?? 8;
  const variants = [...new Set([
    ...expandAddressVariants(query),
    ...(Array.isArray(extras) ? extras : []).flatMap((a) => expandAddressVariants(a)),
  ])].filter(Boolean).slice(0, maxVariants);
  for (const q of variants) {
    const point = await geocodeAddress(q);
    if (point) return point;
  }
  return null;
}

/**
 * 동시성 제한 풀 — 지도 일괄 지오코딩용
 * @template T, R
 * @param {T[]} items
 * @param {number} concurrency
 * @param {(item: T, index: number) => Promise<R>} worker
 * @returns {Promise<R[]>}
 */
export async function runPool(items, concurrency, worker) {
  /** @type {R[]} */
  const results = new Array(items.length);
  let cursor = 0;
  const n = Math.max(1, Math.min(concurrency, items.length || 1));
  await Promise.all(Array.from({ length: n }, async () => {
    while (cursor < items.length) {
      const i = cursor;
      cursor += 1;
      results[i] = await worker(items[i], i);
    }
  }));
  return results;
}

/** @param {string[]} addresses */
export async function geocodeAddresses(addresses) {
  /** @type {Record<string, GeoPoint|null>} */
  const out = {};
  for (const addr of addresses) {
    for (const q of expandAddressVariants(addr)) {
      if (!q || out[q] !== undefined) continue;
      out[q] = await geocodeAddress(q);
      await new Promise((r) => setTimeout(r, 50));
    }
  }
  return out;
}

/** @param {object} map @param {GeoPoint[]} points @param {number} [padding] */
export function fitMapToPoints(map, points, padding = 48) {
  const naver = window.naver;
  if (!map || !naver || !points.length) return;
  if (points.length === 1) {
    map.setCenter(new naver.maps.LatLng(points[0].lat, points[0].lng));
    return;
  }
  const first = new naver.maps.LatLng(points[0].lat, points[0].lng);
  const bounds = new naver.maps.LatLngBounds(first, first);
  points.slice(1).forEach((p) => {
    bounds.extend(new naver.maps.LatLng(p.lat, p.lng));
  });
  map.fitBounds(bounds, {
    top: padding,
    right: padding,
    bottom: padding,
    left: padding,
  });
}

function dedupeSearchResults(items) {
  const seen = new Set();
  return items.filter((item) => {
    const key = `${item.lat.toFixed(5)}:${item.lng.toFixed(5)}:${item.title}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

/**
 * 네이버 geocoder 서브모듈로 주소 검색 (Places API 없음)
 * @param {string} query
 * @returns {Promise<MapSearchResult[]>}
 */
export async function searchMapLocations(query) {
  const q = String(query || '').trim();
  if (!q) return [];
  await loadNaverMaps();
  const naver = window.naver;
  if (typeof naver?.maps?.Service?.geocode !== 'function') return [];

  return new Promise((resolve) => {
    naver.maps.Service.geocode({ query: q }, (status, response) => {
      if (status !== naver.maps.Service.Status.OK) {
        resolve([]);
        return;
      }
      const addresses = response?.v2?.addresses || [];
      const results = addresses.slice(0, 10).map((d, i) => {
        const road = d.roadAddress || '';
        const jibun = d.jibunAddress || '';
        return {
          id: `addr-${i}-${d.x}-${d.y}`,
          title: road || jibun || q,
          subtitle: road && jibun && road !== jibun ? jibun : (d.englishAddress || '주소'),
          lat: parseFloat(d.y),
          lng: parseFloat(d.x),
          kind: /** @type {'address'} */ ('address'),
        };
      }).filter((r) => Number.isFinite(r.lat) && Number.isFinite(r.lng));
      resolve(dedupeSearchResults(results).slice(0, 10));
    });
  });
}
