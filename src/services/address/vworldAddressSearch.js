/**
 * vworld 주소 검색 (지번 PARCEL · 도로명 ROAD)
 * juso 검색 API에 없는 토지 필지 보완
 * @see https://www.vworld.kr/dev/v4dv_2daddress_api2.do
 */

import { vworldClient, getVworldKey, getVworldDomain } from '../vworld/vworldClient.js';
import { parsePnuFromId } from './buildPnu.js';
import { filterJusoResults } from './jusoFilter.js';

/** @typedef {import('./jusoApi.js').AddressSearchMode} AddressSearchMode */

/**
 * @param {Record<string, unknown>} item vworld search item
 */
export function mapVworldSearchItem(item) {
  const parsed = parsePnuFromId(String(item.id || ''));
  const parcel = String(item.address?.parcel || '').trim();
  let road = String(item.address?.road || '').trim();
  const bldnm = String(item.address?.bldnm || '').trim();

  if (road && !/특별|광역|도\s|시\s|군\s|구\s/.test(road) && parcel) {
    const m = parcel.match(/^(.+?(?:시|군|구)\s+.+?(?:동|리|읍|면))/);
    if (m) road = `${m[1]} ${road}`.trim();
  }

  return {
    roadAddr: road,
    jibunAddr: parcel,
    admCd: parsed?.admCd || '',
    sigunguCd: parsed?.sigunguCd,
    bjdongCd: parsed?.bjdongCd,
    platGbCd: parsed?.platGbCd || '0',
    bun: parsed?.bun,
    ji: parsed?.ji,
    bdNm: bldnm,
    detBdNmList: '',
    bdKdcd: bldnm ? '1' : '0',
    zipNo: String(item.address?.zipcode || '').trim(),
    pnu: String(item.id || ''),
    source: 'vworld',
  };
}

/**
 * @param {AddressSearchMode} mode
 * @returns {'PARCEL'|'ROAD'[]}
 */
function vworldCategoriesForMode(mode) {
  if (mode === 'road' || mode === 'building') return ['ROAD'];
  if (mode === 'land' || mode === 'jibun') return ['PARCEL'];
  return ['PARCEL', 'ROAD'];
}

/**
 * @param {object} params
 * @param {string} params.keyword
 * @param {AddressSearchMode} [params.mode]
 * @param {number} [params.currentPage]
 * @param {number} [params.countPerPage]
 */
export async function searchVworldAddress({
  keyword,
  mode = 'all',
  currentPage = 1,
  countPerPage = 20,
}) {
  if (!getVworldKey()) return { items: [], totalCount: 0 };

  const q = String(keyword || '').trim();
  if (q.length < 2) return { items: [], totalCount: 0 };

  const categories = vworldCategoriesForMode(mode);
  /** @type {ReturnType<typeof mapVworldSearchItem>[]} */
  const merged = [];
  const seen = new Set();

  for (const category of categories) {
    try {
      const { data } = await vworldClient.get('/req/search', {
        params: {
          service: 'search',
          request: 'search',
          version: '2.0',
          crs: 'EPSG:4326',
          size: String(countPerPage),
          page: String(currentPage),
          query: q,
          type: 'address',
          category,
          format: 'json',
          errorformat: 'json',
          key: getVworldKey(),
          domain: getVworldDomain(),
        },
      });

      if (data?.response?.status !== 'OK') continue;

      const raw = data?.response?.result?.items;
      const list = Array.isArray(raw) ? raw : (raw ? [raw] : []);
      for (const item of list) {
        const mapped = mapVworldSearchItem(item);
        const key = mapped.pnu || mapped.jibunAddr || mapped.roadAddr;
        if (!key || seen.has(key)) continue;
        seen.add(key);
        merged.push(mapped);
      }
    } catch (err) {
      console.warn('[vworld search]', category, err);
    }
  }

  const filtered = filterJusoResults(merged, mode, q);
  const items = filtered.length ? filtered : merged;
  return { items, totalCount: items.length };
}
