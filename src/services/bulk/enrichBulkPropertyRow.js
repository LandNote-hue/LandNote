import { searchJusoAddress } from '../address/jusoApi.js';
import { normalizeAddressKeys, toPublicDataQuery } from '../address/parseJibunAddress.js';
import { buildPnu } from '../address/buildPnu.js';
import { fetchAllBuildingLedger } from '../publicData/buildingLedger.js';
import { fetchVworldLandBundle } from '../vworld/landData.js';
import { fetchRegulationForPrimaryZone } from '../eum/landUseRegulation.js';
import { mapPublicDataToPropertyForm } from '../publicData/mapToPropertyForm.js';
import { buildPropertyAddressFields } from '../../utils/propAddress.js';
import { buildPriceFields, landToPropertyFields, buildingToPropertyFields } from '../../utils/propertyForm.js';
import { BULK_PROPERTY_TYPE_MAP, BULK_TRADE_TYPE_MAP } from '../../data/propertyBulkCsv.js';
import { normalizeBulkRow } from './mapUnifiedBulkRow.js';

function parseDongHo(detail) {
  const s = String(detail || '').trim();
  const dong = s.match(/(\d+)\s*동/)?.[1] ? `${s.match(/(\d+)\s*동/)?.[1]}동` : '';
  const ho = s.match(/(\d+)\s*호/)?.[1] ? `${s.match(/(\d+)\s*호/)?.[1]}호` : '';
  return { dongNm: dong, hoNm: ho };
}

function mapType(propertyType, resolvedType) {
  if (resolvedType) return resolvedType;
  const key = String(propertyType || '').trim();
  return BULK_PROPERTY_TYPE_MAP[key] || BULK_PROPERTY_TYPE_MAP['아파트'];
}

function mapTrade(tradeType) {
  const key = String(tradeType || '').trim();
  return BULK_TRADE_TYPE_MAP[key] || 'SALE';
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

/**
 * @param {Record<string, string>} row CSV row object (통합·구 양식)
 */
export async function enrichBulkPropertyRow(rawRow) {
  const row = normalizeBulkRow(rawRow);
  const unified = row._unified || {};

  const address = row['주소(필수)']?.trim();
  if (!address) throw new Error('주소가 비어 있습니다.');

  const detail = row['상세주소(동호수)']?.trim() || '';
  const { dongNm, hoNm } = parseDongHo(detail);
  const typeInfo = mapType(row['매물유형'], unified.resolvedType);
  const trade = mapTrade(row['거래유형']);
  const priceManwon = row['가격(만원)']?.trim() || '0';
  const depositManwon = row['보증금(월세)']?.trim() || '0';
  const monthlyRentManwon = unified.monthlyRentManwon || '0';
  const notes = row['특이사항']?.trim() || '';

  const juso = await searchJusoAddress({ keyword: address, countPerPage: 5, mode: 'all' });
  if (!juso.items?.length) {
    throw new Error('주소 불분명 — juso 검색 결과 없음');
  }

  const addrHit = juso.items[0];
  const normalized = normalizeAddressKeys(addrHit);
  const keys = {
    roadAddr: normalized.roadAddr,
    jibunAddr: normalized.jibunAddr,
    sigunguCd: normalized.sigunguCd,
    bjdongCd: normalized.bjdongCd,
    bun: normalized.bun,
    ji: normalized.ji,
    platGbCd: normalized.platGbCd,
    pnu: buildPnu({
      admCd: addrHit.admCd,
      sigunguCd: normalized.sigunguCd,
      bjdongCd: normalized.bjdongCd,
      bun: normalized.bun,
      ji: normalized.ji,
      platGbCd: normalized.platGbCd,
    }),
  };
  if (addrHit.pnu) keys.pnu = String(addrHit.pnu);

  let landForm = {};
  let buildingForm = {};
  if (keys.sigunguCd && keys.bjdongCd) {
    try {
      const queryKeys = toPublicDataQuery(keys);
      const includeExpos = !!(dongNm || hoNm);
      const [building, vworld] = await Promise.all([
        fetchAllBuildingLedger(queryKeys, { includeExpos, dongNm, hoNm }),
        keys.pnu ? fetchVworldLandBundle(keys.pnu, String(new Date().getFullYear())) : Promise.resolve(null),
      ]);
      let regulation = null;
      if (vworld?.landUse?.fields?.length || vworld?.landUse?.item) {
        const useFields = vworld.landUse?.fields?.length
          ? vworld.landUse.fields
          : [vworld.landUse.item];
        regulation = await fetchRegulationForPrimaryZone(keys.pnu, useFields).catch(() => null);
      }
      const mapped = mapPublicDataToPropertyForm(building, { vworld, regulation });
      landForm = mapped.landForm || {};
      buildingForm = mapped.buildingForm || {};
    } catch (err) {
      console.warn('[bulk] public data partial fail', err?.message || err);
    }
  }

  const roadInfo = unified.roadInfo || detail;

  const locationForm = {
    roadAddr: normalized.roadAddr,
    jibunAddr: normalized.jibunAddr,
    roadInfo,
    ownerTel: '',
  };

  const priceForm = {
    price: '',
    loan: '',
    mDep: '',
    mRent: '',
    jDep: '',
    premium: '',
    leaseEnd: '',
    jLeaseEnd: unified.jLeaseEnd || '',
    roi: '—',
    realInvest: '',
    maintenance: String(parseFloat(String(unified.maintenanceManwon || '0').replace(/,/g, '')) || 0),
    maintenanceDetail: '',
    shortTermPeriod: unified.shortTermPeriod || '',
    unitFloor: '',
    exclusiveArea: unified.exclusiveArea || '',
    contractArea: unified.contractArea || '',
    priceNegotiable: false,
  };

  const priceNum = parseFloat(String(priceManwon).replace(/,/g, '')) || 0;

  if (trade === 'SALE' || trade === 'PRESALE') {
    priceForm.price = String(priceNum || 0);
  } else if (trade === 'JEONSE') {
    priceForm.jDep = String(priceNum || 0);
  } else if (trade === 'MONTHLY' || trade === 'SHORT_TERM') {
    priceForm.mDep = String(parseFloat(String(depositManwon).replace(/,/g, '')) || 0);
    priceForm.mRent = String(parseFloat(String(monthlyRentManwon).replace(/,/g, '')) || 0);
  }

  priceForm.premium = String(parseFloat(String(unified.premiumManwon || '0').replace(/,/g, '')) || 0);

  const addressFields = buildPropertyAddressFields(locationForm, address);
  const bldgTitle = unified.postTitle || [addrHit.bdNm, detail].filter(Boolean).join(' ').trim();
  const areaOverride = pyeongToM2(unified.areaPyeong);

  const property = {
    main: typeInfo.main,
    sub: typeInfo.sub,
    status: unified.status || 'NEW',
    pub: unified.pub !== false,
    trade,
    fav: false,
    favAt: null,
    ...addressFields,
    bldg: bldgTitle || typeInfo.tag,
    ownerTel: '',
    roadInfo,
    promo: unified.promoText || notes,
    memo: unified.internalMemo || notes,
    agentName: unified.agentName || '',
    agentTel: unified.agentTel || '',
    photos: [],
    tag: typeInfo.tag,
    lastCall: '—',
    created: formatCreatedDate(),
    deletedAt: null,
    ...buildPriceFields(trade, priceForm),
    ...landToPropertyFields(landForm),
    ...buildingToPropertyFields(buildingForm),
  };

  if (areaOverride > 0) {
    property.land = areaOverride;
  }

  return property;
}
