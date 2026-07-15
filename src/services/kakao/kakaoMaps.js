/** @typedef {{ lat: number, lng: number }} GeoPoint */

/** @typedef {{ id: string, title: string, subtitle: string, lat: number, lng: number, kind: 'place' | 'address' }} MapSearchResult */

const geoCache = new Map();
let loadPromise = null;

export function getKakaoMapJsKey() {
  return (import.meta.env.VITE_KAKAO_MAP_JS_KEY || '').trim();
}

/** @returns {string} */
export function getKakaoMapSetupHint() {
  const origin = typeof window !== 'undefined' ? window.location.origin : 'http://localhost:5175';
  return (
    `현재 접속 주소: ${origin}\n`
    + '카카오 디벨로퍼스 → [내 애플리케이션] → [앱] → [플랫폼 키] → [JavaScript 키] → [JavaScript SDK 도메인]에 '
    + `${origin} 을 등록하세요. (「제품 링크 관리」·Web 플랫폼 사이트 도메인과 다릅니다)\n`
    + '가능하면 http://localhost:5175 로 접속하세요. 127.0.0.1을 쓰면 http://127.0.0.1:5175 도 등록해야 합니다.'
  );
}

function buildSdkUrl(key, libraries) {
  const libs = [...new Set(libraries.filter(Boolean))];
  const params = new URLSearchParams({ appkey: key, autoload: 'false' });
  if (libs.length) params.set('libraries', libs.join(','));
  return `https://dapi.kakao.com/v2/maps/sdk.js?${params.toString()}`;
}

function isMapsReady() {
  return typeof window.kakao?.maps?.Map === 'function'
    && typeof window.kakao?.maps?.LatLng === 'function';
}

function hasRoadviewLibrary() {
  return typeof window.kakao?.maps?.Roadview === 'function'
    && typeof window.kakao?.maps?.RoadviewClient === 'function';
}

function rejectLoad(reject, headline) {
  loadPromise = null;
  reject(new Error(`${headline}\n\n${getKakaoMapSetupHint()}`));
}

function waitForMapsReady(timeoutMs = 15000) {
  return new Promise((resolve, reject) => {
    const started = Date.now();

    const finish = () => {
      if (isMapsReady()) {
        resolve(window.kakao);
        return true;
      }
      return false;
    };

    const viaLoad = () => {
      if (!window.kakao?.maps?.load) return false;
      window.kakao.maps.load(() => {
        if (finish()) return;
        rejectLoad(reject, '카카오맵 SDK 초기화에 실패했습니다.');
      });
      return true;
    };

    const tick = () => {
      if (finish()) return;
      if (Date.now() - started > timeoutMs) {
        rejectLoad(reject, '카카오맵 SDK 초기화 시간이 초과되었습니다.');
        return;
      }
      setTimeout(tick, 50);
    };

    if (finish()) return;
    if (!viaLoad()) tick();
  });
}

function appendSdkScript(key, libraries) {
  return new Promise((resolve, reject) => {
    const src = buildSdkUrl(key, libraries);
    const existing = document.querySelector(`script[data-kakao-map-sdk="${src}"]`);
    if (existing) {
      existing.addEventListener('load', () => waitForMapsReady().then(resolve).catch(reject), { once: true });
      existing.addEventListener('error', () => rejectLoad(reject, '카카오맵 SDK를 불러오지 못했습니다.'), { once: true });
      if (isMapsReady()) resolve(window.kakao);
      return;
    }

    const script = document.createElement('script');
    script.src = src;
    script.async = true;
    script.dataset.kakaoMapSdk = src;

    script.onload = () => {
      waitForMapsReady().then(resolve).catch(reject);
    };
    script.onerror = () => {
      script.remove();
      rejectLoad(reject, '카카오맵 SDK를 불러오지 못했습니다.');
    };

    document.head.appendChild(script);
  });
}

/**
 * 카카오맵 JavaScript SDK 동적 로드 (1회)
 * @param {string[]} [libraries]
 */
export async function loadKakaoMaps(libraries = ['services']) {
  if (typeof window === 'undefined') {
    throw new Error('브라우저 환경에서만 사용할 수 있습니다.');
  }
  const key = getKakaoMapJsKey();
  if (!key) {
    throw new Error('VITE_KAKAO_MAP_JS_KEY가 설정되지 않았습니다.');
  }

  const libs = [...new Set(libraries.filter(Boolean))];
  const wantRoadview = libs.includes('roadview');

  if (isMapsReady()) {
    if (wantRoadview && !hasRoadviewLibrary()) {
      await appendSdkScript(key, ['services', 'roadview']);
      await waitForMapsReady();
      if (!hasRoadviewLibrary()) {
        throw new Error('로드뷰 라이브러리를 불러오지 못했습니다.');
      }
    }
    return window.kakao;
  }

  if (loadPromise) return loadPromise;

  const initialLibs = wantRoadview ? ['services', 'roadview'] : libs;

  loadPromise = (async () => {
    try {
      return await appendSdkScript(key, initialLibs);
    } catch (err) {
      // clusterer 등 부가 라이브러리 오류 시 services만 재시도
      const wantsExtra = initialLibs.some((lib) => lib && lib !== 'services');
      if (wantsExtra) {
        loadPromise = null;
        return appendSdkScript(key, ['services']);
      }
      throw err;
    }
  })();

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

/** @param {typeof window.kakao} kakao @param {string} address */
export function geocodeAddress(kakao, address) {
  const query = String(address || '').trim();
  if (!query || query === '—') return Promise.resolve(null);
  if (geoCache.has(query)) return Promise.resolve(geoCache.get(query) ?? null);

  return new Promise((resolve) => {
    if (!kakao?.maps?.services?.Geocoder) {
      resolve(null);
      return;
    }
    const geocoder = new kakao.maps.services.Geocoder();
    geocoder.addressSearch(query, (result, status) => {
      if (status === kakao.maps.services.Status.OK && result?.[0]) {
        /** @type {GeoPoint} */
        const point = {
          lat: parseFloat(result[0].y),
          lng: parseFloat(result[0].x),
        };
        geoCache.set(query, point);
        resolve(point);
        return;
      }
      // 실패도 캐시해 동일 주소 재시도·로딩 지연 방지
      geoCache.set(query, null);
      resolve(null);
    });
  });
}

/**
 * @param {typeof window.kakao} kakao
 * @param {string} address
 * @param {string[]} [extra]
 * @param {{ maxVariants?: number }} [opts]
 */
export async function geocodeAddressVariants(kakao, address, extra = [], opts = {}) {
  const maxVariants = opts.maxVariants ?? 8;
  const variants = [...new Set([
    ...expandAddressVariants(address),
    ...extra.flatMap((a) => expandAddressVariants(a)),
  ])].filter(Boolean).slice(0, maxVariants);
  for (const q of variants) {
    const point = await geocodeAddress(kakao, q);
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

/** @param {typeof window.kakao} kakao @param {string[]} addresses */
export async function geocodeAddresses(kakao, addresses) {
  /** @type {Record<string, GeoPoint|null>} */
  const out = {};
  for (const addr of addresses) {
    for (const q of expandAddressVariants(addr)) {
      if (!q || out[q] !== undefined) continue;
      out[q] = await geocodeAddress(kakao, q);
      await new Promise((r) => setTimeout(r, 50));
    }
  }
  return out;
}

/** @param {typeof window.kakao} kakao @param {GeoPoint[]} points @param {number} [padding] */
export function fitMapToPoints(kakao, map, points, padding = 48) {
  if (!points.length) return;
  if (points.length === 1) {
    map.setCenter(new kakao.maps.LatLng(points[0].lat, points[0].lng));
    return;
  }
  const bounds = new kakao.maps.LatLngBounds();
  points.forEach((p) => bounds.extend(new kakao.maps.LatLng(p.lat, p.lng)));
  map.setBounds(bounds, padding, padding, padding, padding);
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
 * 카카오맵 장소·주소 통합 검색 (지도 검색)
 * @param {typeof window.kakao} kakao
 * @param {string} query
 * @returns {Promise<MapSearchResult[]>}
 */
export function searchMapLocations(kakao, query) {
  const q = String(query || '').trim();
  if (!q || !kakao?.maps?.services) return Promise.resolve([]);

  /** @type {MapSearchResult[]} */
  const results = [];
  /** @type {Promise<void>[]} */
  const tasks = [];

  if (typeof kakao.maps.services.Geocoder === 'function') {
    tasks.push(new Promise((resolve) => {
      const geocoder = new kakao.maps.services.Geocoder();
      geocoder.addressSearch(q, (data, status) => {
        if (status === kakao.maps.services.Status.OK && data?.length) {
          data.slice(0, 6).forEach((d, i) => {
            results.push({
              id: `addr-${i}-${d.x}-${d.y}`,
              title: d.address_name || d.road_address?.address_name || q,
              subtitle: d.road_address?.address_name || d.address_type || '주소',
              lat: parseFloat(d.y),
              lng: parseFloat(d.x),
              kind: 'address',
            });
          });
        }
        resolve();
      });
    }));
  }

  if (typeof kakao.maps.services.Places === 'function') {
    tasks.push(new Promise((resolve) => {
      const places = new kakao.maps.services.Places();
      places.keywordSearch(q, (data, status) => {
        if (status === kakao.maps.services.Status.OK && data?.length) {
          data.slice(0, 8).forEach((d) => {
            results.push({
              id: `place-${d.id}`,
              title: d.place_name,
              subtitle: d.road_address_name || d.address_name || '장소',
              lat: parseFloat(d.y),
              lng: parseFloat(d.x),
              kind: 'place',
            });
          });
        }
        resolve();
      });
    }));
  }

  if (!tasks.length) return Promise.resolve([]);
  return Promise.all(tasks).then(() => dedupeSearchResults(results).slice(0, 10));
}
