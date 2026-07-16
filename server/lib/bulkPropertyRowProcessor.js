import { getSearchKey } from '../lib/proxyConfig.js';

const TYPE_MAP = {
  '아파트': { main: 'APT_OFFICETEL', sub: 'APARTMENT', tag: '아파트' },
  '오피스텔': { main: 'APT_OFFICETEL', sub: 'OFFICETEL_RESI', tag: '오피스텔' },
  '빌라': { main: 'VILLA_HOUSE', sub: 'VILLA', tag: '빌라/연립' },
  '단독': { main: 'VILLA_HOUSE', sub: 'DETACHED', tag: '단독/다가구' },
  '상가': { main: 'COMMERCIAL', sub: 'STORE', tag: '상가' },
  '사무실': { main: 'COMMERCIAL', sub: 'OFFICE', tag: '사무실' },
  '건물': { main: 'COMMERCIAL', sub: 'WHOLE_BUILDING', tag: '건물(통건물)' },
  '토지': { main: 'COMMERCIAL', sub: 'LAND', tag: '토지' },
};

const TRADE_MAP = { '매매': 'SALE', '전세': 'JEONSE', '월세': 'MONTHLY', '임대': 'MONTHLY', '단기': 'SHORT_TERM', '분양': 'PRESALE' };

const BUILDING_LEDGER = {
  TITLE: 'https://apis.data.go.kr/1613000/BldRgstHubService/getBrTitleInfo',
  RECAP: 'https://apis.data.go.kr/1613000/BldRgstHubService/getBrRecapTitleInfo',
  JIJIGU: 'https://apis.data.go.kr/1613000/BldRgstHubService/getBrJijiguInfo',
  EXPOS: 'https://apis.data.go.kr/1613000/BldRgstHubService/getBrExposInfo',
};

function pad4(n) {
  const v = parseInt(String(n || '0'), 10) || 0;
  return String(v).padStart(4, '0');
}

function parseDongHo(detail) {
  const s = String(detail || '').trim();
  const dongMatch = s.match(/(\d+)\s*동/);
  const hoMatch = s.match(/(\d+)\s*호/);
  return {
    dongNm: dongMatch?.[1] ? `${dongMatch[1]}동` : '',
    hoNm: hoMatch?.[1] ? `${hoMatch[1]}호` : '',
  };
}

function unwrapItem(data) {
  const items = data?.response?.body?.items?.item;
  if (Array.isArray(items)) return items[0] || null;
  return items || null;
}

function getServiceKey(env) {
  return (env.VITE_DATA_GO_KR_SERVICE_KEY || env.DATA_GO_KR_SERVICE_KEY || '').trim();
}

async function fetchJuso(keyword, env) {
  const searchKey = getSearchKey(env);
  if (!searchKey) throw new Error('주소 API 키 미설정');
  const params = new URLSearchParams({
    currentPage: '1',
    countPerPage: '5',
    keyword,
    resultType: 'json',
    confmKey: searchKey,
  });
  const url = `https://business.juso.go.kr/addrlink/addrLinkApi.do?${params}`;
  const res = await fetch(url, { headers: { Accept: 'application/json' } });
  const data = await res.json();
  const common = data?.results?.common;
  if (common?.errorCode && common.errorCode !== '0') {
    throw new Error(common.errorMessage || '주소 검색 실패');
  }
  const raw = data?.results?.juso;
  const list = Array.isArray(raw) ? raw : (raw ? [raw] : []);
  return list[0] || null;
}

/**
 * 건축물대장 API 순차 조회 (표제부 → 총괄표제부 → 지역지구구역 → 전유부)
 * @param {object} keys
 * @param {Record<string, string>} env
 * @param {{ dongNm?: string, hoNm?: string }} [opts]
 */
async function fetchBuildingLedgerSequential(keys, env, opts = {}) {
  const serviceKey = getServiceKey(env);
  if (!serviceKey || !keys.sigunguCd) return {};

  const base = {
    serviceKey,
    sigunguCd: keys.sigunguCd,
    bjdongCd: keys.bjdongCd,
    platGbCd: keys.platGbCd || '0',
    bun: keys.bun,
    ji: keys.ji,
    numOfRows: '10',
    pageNo: '1',
    _type: 'json',
  };

  /** @type {Record<string, unknown>} */
  const merged = {};

  const endpoints = [
    BUILDING_LEDGER.TITLE,
    BUILDING_LEDGER.RECAP,
    BUILDING_LEDGER.JIJIGU,
  ];

  if (opts.dongNm || opts.hoNm) {
    endpoints.push(BUILDING_LEDGER.EXPOS);
  }

  for (const endpoint of endpoints) {
    try {
      const params = new URLSearchParams(base);
      if (endpoint === BUILDING_LEDGER.EXPOS) {
        if (opts.dongNm) params.set('dongNm', opts.dongNm);
        if (opts.hoNm) params.set('hoNm', opts.hoNm);
      }
      const res = await fetch(`${endpoint}?${params}`);
      const data = await res.json();
      const item = unwrapItem(data);
      if (item) Object.assign(merged, item);
    } catch (err) {
      console.warn('[bulk-server] building ledger step skip', endpoint, err?.message || err);
    }
  }

  return merged;
}

function mapBuildingFields(item) {
  if (!item || !Object.keys(item).length) return {};
  const pick = (...vals) => vals.find((v) => v != null && v !== '') ?? '';
  const toNum = (v) => {
    const n = parseFloat(String(v).replace(/,/g, ''));
    return Number.isFinite(n) ? n : 0;
  };
  const toInt = (v) => parseInt(String(v), 10) || 0;

  return {
    structure: pick(item.strctCdNm, item.etcStrct),
    mainUse: pick(item.mainPurpsCdNm, item.etcPurps),
    approvalDate: pick(item.useAprDay, item.useConfDay),
    floorsAbove: toInt(item.grndFlrCnt),
    floorsBelow: toInt(item.ugrndFlrCnt),
    buildingArea: toNum(item.archArea),
    floorAreaRatio: toNum(item.vlRat),
    buildingCoverage: toNum(item.bcRat),
    land: toNum(item.platArea),
    farArea: toNum(item.totArea),
    floor: toInt(item.flrNo),
    parking: toInt(item.indrMechUtcnt) + toInt(item.indrAutoUtcnt)
      + toInt(item.oudrMechUtcnt) + toInt(item.oudrAutoUtcnt),
    elevators: toInt(item.rideUseElvtCnt) + toInt(item.emgenUseElvtCnt),
    zoning: pick(item.jijiguCdNm, item.jijiguCd),
  };
}

function formatCreatedDate() {
  const d = new Date();
  return `${d.getFullYear()}.${String(d.getMonth() + 1).padStart(2, '0')}.${String(d.getDate()).padStart(2, '0')}`;
}

function pyeongToM2(pyeong) {
  const n = parseFloat(String(pyeong || '').replace(/,/g, ''));
  if (!Number.isFinite(n) || n <= 0) return 0;
  return Math.round(n * 3.305785 * 100) / 100;
}

function buildPriceFields(trade, row) {
  const priceNum = parseFloat(String(row.priceManwon || '').replace(/,/g, '')) || 0;
  const depositNum = parseFloat(String(row.depositManwon || '').replace(/,/g, '')) || 0;
  const rentNum = parseFloat(String(row.monthlyRentManwon || '').replace(/,/g, '')) || 0;
  const premiumNum = parseFloat(String(row.premiumManwon || '').replace(/,/g, '')) || 0;
  const maintenanceNum = parseFloat(String(row.maintenanceManwon || '').replace(/,/g, '')) || 0;
  const exclusiveAreaNum = parseFloat(String(row.exclusiveArea || '').replace(/,/g, '')) || 0;
  const contractAreaNum = parseFloat(String(row.contractArea || '').replace(/,/g, '')) || 0;
  const jLeaseEnd = String(row.jLeaseEnd || '');
  const shortTermPeriod = String(row.shortTermPeriod || '');

  const base = {
    price: 0, jDep: 0, mDep: 0, mRent: 0, loan: 0, premium: 0,
    leaseEnd: '', jLeaseEnd: '', maintenance: 0, maintenanceDetail: '',
    shortTermPeriod: '', priceNegotiable: false, roi: '—', realInvest: '',
    unitFloor: '', exclusiveArea: 0, contractArea: 0,
  };

  if (trade === 'SALE' || trade === 'PRESALE') {
    return {
      ...base,
      price: priceNum || 0,
      mDep: 0,
      mRent: 0,
      premium: premiumNum,
      maintenance: maintenanceNum,
    };
  }
  if (trade === 'JEONSE') {
    return {
      ...base,
      jDep: priceNum || 0,
      jLeaseEnd,
      premium: premiumNum,
      exclusiveArea: exclusiveAreaNum,
      contractArea: contractAreaNum,
    };
  }
  if (trade === 'MONTHLY' || trade === 'SHORT_TERM') {
    return {
      ...base,
      mDep: depositNum,
      mRent: rentNum || priceNum,
      premium: premiumNum,
      maintenance: maintenanceNum,
      shortTermPeriod: trade === 'SHORT_TERM' ? shortTermPeriod : '',
      exclusiveArea: exclusiveAreaNum,
      contractArea: contractAreaNum,
    };
  }
  return base;
}

/**
 * @param {object} row
 * @param {Record<string, string>} env
 */
export async function processBulkPropertyRow(row, env) {
  const address = String(row.address || '').trim();
  if (!address) throw new Error('주소가 비어 있습니다.');

  const detail = String(row.detailAddress || '').trim();
  const { dongNm, hoNm } = parseDongHo(detail);
  const typeInfo = row.resolvedType || TYPE_MAP[String(row.propertyType || '').trim()] || TYPE_MAP['아파트'];
  const trade = TRADE_MAP[String(row.tradeType || '').trim()] || 'SALE';

  const juso = await fetchJuso(address, env);
  if (!juso) throw new Error('주소 불분명');

  const jibunAddr = String(juso.jibunAddr || '').trim();
  const roadAddr = String(juso.roadAddr || juso.roadAddrPart1 || '').trim();
  const admCd = String(juso.admCd || '').trim();
  const keys = {
    sigunguCd: admCd.slice(0, 5),
    bjdongCd: admCd.slice(5, 10),
    platGbCd: juso.mtYn === '1' ? '1' : '0',
    bun: pad4(juso.lnbrMnnm),
    ji: pad4(juso.lnbrSlno),
  };

  let buildingExtra = {};
  try {
    const ledger = await fetchBuildingLedgerSequential(keys, env, { dongNm, hoNm });
    buildingExtra = mapBuildingFields(ledger);
  } catch (err) {
    console.warn('[bulk-server] building ledger skip', err?.message || err);
  }

  const postTitle = String(row.postTitle || '').trim();
  const bldg = postTitle || [juso.bdNm, detail].filter(Boolean).join(' ').trim() || typeInfo.tag;
  const notes = String(row.notes || '').trim();
  const areaM2 = pyeongToM2(row.areaPyeong);
  const roadInfo = String(row.roadInfo || '').trim() || detail;

  return {
    main: typeInfo.main,
    sub: typeInfo.sub,
    status: row.status || 'NEW',
    pub: row.pub !== false,
    trade,
    fav: false,
    favAt: null,
    addr: jibunAddr || address,
    jibunAddr,
    roadAddr,
    bldg,
    ownerTel: '',
    roadInfo,
    promo: String(row.promoText || '').trim() || notes,
    memo: String(row.internalMemo || '').trim() || notes,
    agentName: String(row.agentName || '').trim(),
    agentTel: String(row.agentTel || '').trim(),
    photos: [],
    tag: typeInfo.tag,
    lastCall: '—',
    created: formatCreatedDate(),
    deletedAt: null,
    land: areaM2 || buildingExtra.land || 0,
    floor: buildingExtra.floor || 0,
    farArea: buildingExtra.farArea || 0,
    zoning: buildingExtra.zoning || '',
    landCategory: '',
    officialLandPrice: '',
    baseYear: '',
    parking: buildingExtra.parking || 0,
    elevators: buildingExtra.elevators || 0,
    ...buildingExtra,
    ...buildPriceFields(trade, row),
  };
}
