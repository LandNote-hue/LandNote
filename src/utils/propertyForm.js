import { fmtNum, fmtInputNum, normalizeJDepToMan } from './formatMoney.js';
import { calcRealInvestAmount, calcSaleYieldPercent, fmtYieldPercent } from './propInvestment.js';

/** @param {unknown} v */
export function parseFormNum(v) {
  const n = parseFloat(String(v ?? '').replace(/,/g, ''));
  return Number.isFinite(n) ? n : 0;
}

/** @param {unknown} v */
function fmtFormInt(v) {
  if (v == null || v === '') return '';
  return fmtNum(v);
}

/** @param {ReturnType<typeof emptyPriceForm>} priceForm */
export function deriveSalePriceFormFields(priceForm) {
  const price = parseFormNum(priceForm.price);
  const deposit = parseFormNum(priceForm.mDep);
  const rent = parseFormNum(priceForm.mRent);
  const maint = parseFormNum(priceForm.maintenance);
  const yieldPct = calcSaleYieldPercent(price, rent + maint);
  const realInvest = calcRealInvestAmount(price, deposit);
  return {
    roi: yieldPct != null ? fmtYieldPercent(yieldPct) : '',
    realInvest: realInvest != null ? fmtNum(realInvest) : '',
  };
}

/** @param {unknown} v */
function fmtFormDecimal(v) {
  if (v == null || v === '') return '';
  return fmtInputNum(v, { decimal: true });
}

export function emptyPriceForm() {
  return {
    price: '',
    loan: '',
    mDep: '',
    mRent: '',
    jDep: '',
    premium: '',
    leaseEnd: '',
    jLeaseEnd: '',
    roi: '',
    realInvest: '',
    maintenance: '',
    maintenanceDetail: '',
    shortTermPeriod: '',
    unitFloor: '',
    exclusiveArea: '',
    contractArea: '',
    priceNegotiable: false,
  };
}

/** @param {Record<string, unknown>|null|undefined} prop */
export function priceFormFromProperty(prop) {
  if (!prop) return emptyPriceForm();
  return {
    price: fmtFormInt(prop.price),
    loan: fmtFormInt(prop.loan),
    mDep: fmtFormInt(prop.mDep),
    mRent: fmtFormInt(prop.mRent),
    jDep: fmtFormInt(normalizeJDepToMan(prop.jDep) || ''),
    premium: fmtFormInt(prop.premium),
    leaseEnd: prop.leaseEnd ?? '',
    jLeaseEnd: prop.jLeaseEnd ?? prop.leaseEnd ?? '',
    roi: prop.roi && prop.roi !== '—' ? prop.roi : '',
    realInvest: prop.realInvest ?? '',
    maintenance: fmtFormInt(prop.maintenance),
    maintenanceDetail: prop.maintenanceDetail ?? '',
    shortTermPeriod: prop.shortTermPeriod ?? '',
    unitFloor: prop.unitFloor ?? '',
    exclusiveArea: fmtFormDecimal(prop.exclusiveArea),
    contractArea: fmtFormDecimal(prop.contractArea),
    priceNegotiable: Boolean(prop.priceNegotiable),
  };
}

/** @param {string} trade @param {ReturnType<typeof emptyPriceForm>} pf */
export function buildPriceFields(trade, pf) {
  const n = parseFormNum;
  const common = {
    price: 0,
    jDep: 0,
    mDep: 0,
    mRent: 0,
    loan: 0,
    premium: 0,
    leaseEnd: '',
    jLeaseEnd: '',
    maintenance: 0,
    maintenanceDetail: '',
    shortTermPeriod: '',
    unitFloor: '',
    exclusiveArea: 0,
    contractArea: 0,
    priceNegotiable: Boolean(pf.priceNegotiable),
    roi: pf.roi?.trim() || '—',
    realInvest: pf.realInvest?.trim() || '',
  };

  const unitFields = {
    unitFloor: String(pf.unitFloor ?? '').trim(),
    exclusiveArea: n(pf.exclusiveArea),
    contractArea: n(pf.contractArea),
    premium: n(pf.premium),
  };

  if (trade === 'SALE' || trade === 'PRESALE') {
    const price = n(pf.price);
    const maint = n(pf.maintenance);
    return {
      ...common,
      price,
      loan: n(pf.loan),
      mDep: 0,
      mRent: 0,
      maintenance: maint,
      premium: n(pf.premium),
      leaseEnd: '',
      roi: '—',
      realInvest: '',
    };
  }
  if (trade === 'JEONSE') {
    return {
      ...common,
      ...unitFields,
      jDep: normalizeJDepToMan(n(pf.jDep)),
      jLeaseEnd: pf.jLeaseEnd || '',
    };
  }
  if (trade === 'MONTHLY') {
    return {
      ...common,
      ...unitFields,
      mDep: n(pf.mDep),
      mRent: n(pf.mRent),
      maintenance: n(pf.maintenance),
      maintenanceDetail: pf.maintenanceDetail || '',
    };
  }
  if (trade === 'SHORT_TERM') {
    return {
      ...common,
      ...unitFields,
      mDep: n(pf.mDep),
      mRent: n(pf.mRent),
      maintenance: n(pf.maintenance),
      shortTermPeriod: pf.shortTermPeriod || '',
    };
  }
  return common;
}

/** @param {Record<string, unknown>|null|undefined} p */
export function landFromProperty(p) {
  if (!p) {
    return { landAreaM2: '', landUseZone: '', landCategory: '', officialPriceM2: '', officialPriceYear: '' };
  }
  return {
    landAreaM2: p.land ?? '',
    landUseZone: p.zoning ?? '',
    landCategory: p.landCategory ?? '',
    officialPriceM2: p.officialLandPrice != null && p.officialLandPrice !== ''
      ? fmtNum(String(p.officialLandPrice).replace(/,/g, ''))
      : '',
    officialPriceYear: p.baseYear ?? '',
  };
}

/** @param {Record<string, unknown>|null|undefined} p */
export function buildingFromProperty(p) {
  if (!p) {
    return {
      grossFloorAreaM2: '', vlRatEstmTotAreaM2: '', archAreaM2: '', bcRat: '', vlRat: '',
      grndFlrCnt: '', ugrndFlrCnt: '', parkingCnt: '', elevatorCnt: '',
      strctCdNm: '', mainPurpsCdNm: '', useAprDay: '',
    };
  }
  return {
    grossFloorAreaM2: fmtFormDecimal(p.floor),
    vlRatEstmTotAreaM2: fmtFormDecimal(p.farArea),
    archAreaM2: fmtFormDecimal(p.buildingArea),
    bcRat: fmtFormDecimal(p.buildingCoverage),
    vlRat: fmtFormDecimal(p.floorAreaRatio),
    grndFlrCnt: p.floorsAbove ?? '',
    ugrndFlrCnt: p.floorsBelow ?? '',
    parkingCnt: p.parking ?? '',
    elevatorCnt: p.elevators ?? '',
    strctCdNm: p.structure ?? '',
    mainPurpsCdNm: p.mainUse ?? '',
    useAprDay: p.approvalDate ?? '',
  };
}

/** @param {{ landAreaM2?: string|number, landUseZone?: string, landCategory?: string, officialPriceM2?: string|number, officialPriceYear?: string|number }} land */
export function landToPropertyFields(land) {
  return {
    land: parseFormNum(land.landAreaM2),
    zoning: land.landUseZone || '',
    landCategory: land.landCategory || '',
    officialLandPrice: land.officialPriceM2 != null && land.officialPriceM2 !== ''
      ? fmtNum(String(land.officialPriceM2).replace(/,/g, ''))
      : '',
    baseYear: land.officialPriceYear || '',
  };
}

/** @param {ReturnType<typeof buildingFromProperty>} bld */
export function buildingToPropertyFields(bld) {
  return {
    floor: parseFormNum(bld.grossFloorAreaM2),
    farArea: parseFormNum(bld.vlRatEstmTotAreaM2),
    buildingArea: parseFormNum(bld.archAreaM2),
    buildingCoverage: parseFormNum(bld.bcRat),
    floorAreaRatio: parseFormNum(bld.vlRat),
    floorsAbove: parseFormNum(bld.grndFlrCnt),
    floorsBelow: parseFormNum(bld.ugrndFlrCnt),
    parking: parseFormNum(bld.parkingCnt),
    elevators: parseFormNum(bld.elevatorCnt),
    structure: bld.strctCdNm || '',
    mainUse: bld.mainPurpsCdNm || '',
    approvalDate: bld.useAprDay || '',
  };
}

import { formatPhone } from './formatPhone.js';

/** @param {Record<string, unknown>|null|undefined} prop */
/** @param {{ displayName?: string, phone?: string }|null|undefined} defaults */
export function detailFormFromProperty(prop, defaults) {
  return {
    title: prop?.bldg || '',
    agentName: prop?.agentName || defaults?.displayName || '',
    agentTel: formatPhone(prop?.agentTel || defaults?.phone || ''),
    promo: prop?.promo || '',
    memo: prop?.memo || '',
  };
}
