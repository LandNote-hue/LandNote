/**
 * 행정안전부 도로명주소 검색 API (addrLinkApi)
 * 도로명·지번·건물명 통합 검색 + vworld 지번(PARCEL) 보조
 * @see https://business.juso.go.kr/addrlink/devAddrLinkRequestWrite.do?menu=menu2
 */

import axios from 'axios';
import {
  parseDongLotKeyword,
  compactDongLotKeyword,
} from './parseJibunAddress.js';
import { filterJusoResults, filterByDongLot } from './jusoFilter.js';
import { searchVworldAddress } from './vworldAddressSearch.js';

/** 기본: BFF가 confmKey 주입 (`/api/juso-search`). 직접 juso URL을 쓸 때만 VITE_JUSO_API_BASE_URL 지정 */
const baseURL = import.meta.env.VITE_JUSO_API_BASE_URL || '/api/juso-search';
const serverInjectsKey = /juso-search/i.test(baseURL);

const jusoClient = axios.create({
  baseURL,
  timeout: 20_000,
  headers: { Accept: 'application/json' },
});

function getSearchKey() {
  const key = (
    import.meta.env.VITE_JUSO_SEARCH_KEY
    || import.meta.env.VITE_JUSO_CONFIRM_KEY
  )?.trim();
  if (!key) {
    throw new Error(
      '도로명주소 검색 API 승인키가 없습니다. juso.go.kr에서 「검색 API」를 신청하고 .env.local에 VITE_JUSO_SEARCH_KEY를 설정하세요. (팝업 API 키와는 별도입니다)',
    );
  }
  return key;
}

/** @param {string} code @param {string} msg */
export function formatJusoApiError(code, msg) {
  if (code === 'E0001') {
    return `[juso ${code}] ${msg}\n\n팁: 팝업 API 승인키로는 검색 API를 사용할 수 없습니다. juso.go.kr → API신청 → 「도로명주소 검색 API」 승인키를 VITE_JUSO_SEARCH_KEY에 등록하세요.`;
  }
  return `[juso ${code}] ${msg}`;
}

/** @typedef {'all'|'road'|'jibun'|'building'|'land'} AddressSearchMode */

/**
 * @param {Record<string, unknown>} item juso API juso[] 항목
 */
export function mapJusoApiItem(item) {
  if (!item) return { jibunAddr: '' };
  return {
    roadAddr: String(item.roadAddr || item.roadAddrPart1 || '').trim(),
    jibunAddr: String(item.jibunAddr || '').trim(),
    admCd: String(item.admCd || '').trim(),
    platGbCd: item.mtYn === '1' ? '1' : '0',
    bun: item.lnbrMnnm != null ? String(item.lnbrMnnm) : undefined,
    ji: item.lnbrSlno != null ? String(item.lnbrSlno) : undefined,
    bdNm: String(item.bdNm || '').trim(),
    detBdNmList: String(item.detBdNmList || '').trim(),
    zipNo: String(item.zipNo || '').trim(),
    bdKdcd: String(item.bdKdcd || '').trim(),
    siNm: String(item.siNm || '').trim(),
    sggNm: String(item.sggNm || '').trim(),
    emdNm: String(item.emdNm || '').trim(),
    source: 'juso',
  };
}

/**
 * @param {object} opts
 * @param {string} opts.keyword
 * @param {number} opts.currentPage
 * @param {number} opts.countPerPage
 * @param {string} opts.firstSort
 * @param {boolean} opts.mobile
 */
async function fetchJusoPage({ keyword, currentPage, countPerPage, firstSort, mobile }) {
  const params = {
    currentPage,
    countPerPage,
    keyword,
    resultType: 'json',
    hstryYn: 'N',
    addInfoYn: 'Y',
    firstSort,
  };
  // BFF(`/api/juso-search`)는 서버에서 키를 넣고, 그 외 직접 호출일 때만 클라이언트 키 사용
  if (!serverInjectsKey) {
    const confmKey = mobile
      ? (import.meta.env.VITE_JUSO_POPUP_MOBILE_KEY?.trim()
        || import.meta.env.VITE_JUSO_MOBILE_KEY?.trim()
        || getSearchKey())
      : getSearchKey();
    params.confmKey = confmKey;
  }

  const { data } = await jusoClient.get('/addrlink/addrLinkApi.do', { params });
  const common = data?.results?.common;
  const errorCode = common?.errorCode;
  if (errorCode && errorCode !== '0') {
    const msg = common?.errorMessage || '주소 검색 API 오류';
    throw new Error(formatJusoApiError(errorCode, msg));
  }

  const raw = data?.results?.juso;
  const list = Array.isArray(raw) ? raw : (raw ? [raw] : []);
  return {
    items: list.map(mapJusoApiItem),
    totalCount: parseInt(String(common?.totalCount ?? list.length), 10) || list.length,
  };
}

/**
 * @param {{ dong: string, lot: string, mode: AddressSearchMode, mobile: boolean, countPerPage: number }} opts
 */
async function searchJusoByDongLot({ dong, lot, mode, mobile, countPerPage }) {
  const MAX_PAGES = 10;
  const PAGE_SIZE = 100;
  const found = [];

  for (let page = 1; page <= MAX_PAGES; page++) {
    const { items, totalCount } = await fetchJusoPage({
      keyword: dong,
      currentPage: page,
      countPerPage: PAGE_SIZE,
      firstSort: 'none',
      mobile,
    });
    found.push(...filterByDongLot(items, dong, lot));
    if (found.length >= countPerPage) break;
    if (page * PAGE_SIZE >= totalCount) break;
  }

  const filterKw = `${dong} ${lot}`;
  const filtered = filterJusoResults(found, mode, filterKw);
  return filtered.length ? filtered : found;
}

/**
 * @param {object} params
 * @param {string} params.keyword
 * @param {number} [params.currentPage]
 * @param {number} [params.countPerPage]
 * @param {AddressSearchMode} [params.mode]
 * @param {boolean} [params.mobile]
 */
export async function searchJusoAddress({
  keyword,
  currentPage = 1,
  countPerPage = 20,
  mode = 'all',
  mobile = false,
}) {
  const q = String(keyword || '').trim();
  if (q.length < 2) {
    return { items: [], totalCount: 0, page: currentPage, error: '검색어를 2자 이상 입력하세요.' };
  }

  const firstSort = mode === 'road' ? 'road' : 'none';
  const variants = [...new Set([q, compactDongLotKeyword(q)].filter(Boolean))];

  let mapped = [];
  let totalCount = 0;

  for (const variant of variants) {
    const res = await fetchJusoPage({
      keyword: variant,
      currentPage,
      countPerPage,
      firstSort,
      mobile,
    });
    if (res.items.length) {
      mapped = res.items;
      totalCount = res.totalCount;
      break;
    }
  }

  let filtered = filterJusoResults(mapped, mode, q);

  if (!filtered.length && !mapped.length) {
    const parsed = parseDongLotKeyword(q);
    if (parsed) {
      const fallback = await searchJusoByDongLot({
        dong: parsed.dong,
        lot: parsed.lot,
        mode,
        mobile,
        countPerPage,
      });
      if (fallback.length) {
        mapped = fallback;
        filtered = fallback;
        totalCount = fallback.length;
      }
    }
  } else if (!filtered.length && mapped.length && mode !== 'all') {
    const relaxed = filterJusoResults(mapped, 'all', q);
    if (relaxed.length) {
      mapped = relaxed;
      filtered = relaxed;
    }
  }

  let items = filtered.length ? filtered : mapped;

  if (!items.length) {
    const vworld = await searchVworldAddress({
      keyword: q,
      mode,
      currentPage,
      countPerPage,
    });
    if (vworld.items.length) {
      items = vworld.items;
      totalCount = vworld.totalCount;
    }
  }

  const hint = !items.length
    ? '검색 결과가 없습니다. 지번·도로명·동 이름을 다시 확인해 주세요.'
    : null;

  return {
    items,
    totalCount: items.length ? (totalCount || items.length) : 0,
    page: currentPage,
    error: hint,
  };
}
