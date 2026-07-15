/**
 * 매물 투자분석 — 임대차 내역 기반 자동 계산 (매물 상세)
 */

/** @param {Array<{ dep?: number|string|null, rent?: number|string|null, maint?: number|string|null }>} rentals */
export function sumRentalTotals(rentals) {
  return (rentals ?? []).reduce(
    (acc, r) => ({
      totalDep: acc.totalDep + (parseFloat(String(r.dep ?? '')) || 0),
      totalRent: acc.totalRent + (parseFloat(String(r.rent ?? '')) || 0),
      totalMaint: acc.totalMaint + (parseFloat(String(r.maint ?? '')) || 0),
    }),
    { totalDep: 0, totalRent: 0, totalMaint: 0 },
  );
}

/** 1. 기존임차보증금 = 임대차 총 보증금 (만) */
/** @param {Array<{ dep?: number|string|null }>} rentals */
export function calcExistingTenantDeposit(rentals) {
  return sumRentalTotals(rentals).totalDep;
}

/** 2. 월임대료 = 총 임대료 + 총 관리비 (만) */
/** @param {Array<{ rent?: number|string|null, maint?: number|string|null }>} rentals */
export function calcMonthlyRentFee(rentals) {
  const { totalRent, totalMaint } = sumRentalTotals(rentals);
  return totalRent + totalMaint;
}

/**
 * 3. 실투자금 = 매매가(만) − 기존임차보증금(만)
 * @param {number|string|null|undefined} priceMan 매매가·매각가 (만)
 * @param {number} depositMan 기존임차보증금 (만)
 * @returns {number|null} 만 단위
 */
export function calcRealInvestAmount(priceMan, depositMan) {
  const price = parseFloat(String(priceMan ?? ''));
  if (!Number.isFinite(price) || price <= 0) return null;
  const dep = Number(depositMan) || 0;
  return price - dep;
}

/**
 * 4. 수익률(%) = 월임대료(만)×12 ÷ 매각가(만) × 100
 * @param {number|string|null|undefined} priceMan
 * @param {number} monthlyRentMan
 * @returns {number|null}
 */
export function calcSaleYieldPercent(priceMan, monthlyRentMan) {
  const price = parseFloat(String(priceMan ?? ''));
  const monthly = Number(monthlyRentMan) || 0;
  if (!Number.isFinite(price) || price <= 0 || monthly <= 0) return null;
  return (monthly * 12) / price * 100;
}

/** @param {number|null|undefined} roi */
export function fmtYieldPercent(roi) {
  if (roi == null || !Number.isFinite(roi)) return '—';
  return `${roi.toFixed(2)}%`;
}

/**
 * @param {number|string|null|undefined} priceMan
 * @param {Array<{ dep?: number|string|null, rent?: number|string|null, maint?: number|string|null }>} rentals
 * @param {Record<string, unknown>|null|undefined} [propFallback]
 */
export function resolveSaleInvestmentMetrics(priceMan, rentals, propFallback = null) {
  const rentalTotals = sumRentalTotals(rentals);
  // 임대차 합계가 실제 값이 있을 때만 우선. 빈/공실 행만 있으면 매물 직접 입력값 사용
  const rentalsHaveValues =
    rentalTotals.totalDep > 0 || rentalTotals.totalRent > 0 || rentalTotals.totalMaint > 0;
  const totals = rentalsHaveValues
    ? rentalTotals
    : {
        totalDep: parseFloat(String(propFallback?.mDep ?? '')) || 0,
        totalRent: parseFloat(String(propFallback?.mRent ?? '')) || 0,
        totalMaint: parseFloat(String(propFallback?.maintenance ?? '')) || 0,
      };

  const existingDeposit = totals.totalDep;
  const monthlyRent = totals.totalRent;
  const maintenance = totals.totalMaint;
  const monthlyForYield = monthlyRent + maintenance;
  const realInvest = calcRealInvestAmount(priceMan, existingDeposit);
  const yieldPct = calcSaleYieldPercent(priceMan, monthlyForYield);

  return {
    existingDeposit,
    monthlyRent,
    maintenance,
    monthlyForYield,
    realInvest,
    yieldPct,
    yieldLabel: fmtYieldPercent(yieldPct),
    source: rentalsHaveValues ? 'rentals' : 'property',
  };
}

/**
 * @param {number|string|null|undefined} priceMan
 * @param {Array<{ dep?: number|string|null, rent?: number|string|null, maint?: number|string|null }>} rentals
 * @param {Record<string, unknown>|null|undefined} [propFallback]
 */
export function buildSaleInvestmentMetrics(priceMan, rentals, propFallback = null) {
  const m = resolveSaleInvestmentMetrics(priceMan, rentals, propFallback);
  return {
    existingDeposit: m.existingDeposit,
    monthlyRent: m.monthlyRent,
    maintenance: m.maintenance,
    realInvest: m.realInvest,
    yieldPct: m.yieldPct,
    yieldLabel: m.yieldLabel,
  };
}
