import { parseFormNum, deriveSalePriceFormFields } from './propertyForm.js';
import {
  resolveSaleInvestmentMetrics,
} from './propInvestment.js';
import { fmtNum, normalizeJDepToMan, m2ToPyung } from './formatMoney.js';

/** 매매·분양 시 투자분석(보증금·월임대료·관리비·수익률) 입력/표시 여부 */
export function showsSaleInvestmentFields(trade, sub) {
  if (trade !== 'SALE' && trade !== 'PRESALE') return false;
  if (sub === 'LAND') return false;
  return true;
}

/** 상가 소분류 — 권리금 필드 (매매·분양) */
export function showsPremiumField(trade, sub) {
  return (trade === 'SALE' || trade === 'PRESALE') && sub === 'STORE';
}

/** 전세·월세·단기 — 해당 층·전용/계약면적·권리금 */
export function showsRentalUnitFields(trade) {
  return trade === 'JEONSE' || trade === 'MONTHLY' || trade === 'SHORT_TERM';
}

/** @param {unknown} m2 */
function fmtAreaM2Display(m2) {
  const n = parseFormNum(m2);
  if (!n) return '—';
  const py = m2ToPyung(n);
  const m2Label = `${fmtNum(n, { decimal: true })}㎡`;
  return py != null ? `${m2Label} (${fmtNum(py, { decimal: true })}평)` : m2Label;
}

/** 전세·월세·단기 공통 유닛 정보 */
function rentalUnitInfoItems(prop) {
  return [
    { k: '해당 층', v: prop.unitFloor ? String(prop.unitFloor) : '—' },
    { k: '전용면적', v: fmtAreaM2Display(prop.exclusiveArea) },
    { k: '계약면적', v: fmtAreaM2Display(prop.contractArea) },
    { k: '권리금', v: fmtManwonDisplay(prop.premium) },
  ];
}

/**
 * 임대차 내역 우선, 없으면 매물 직접 입력값 사용
 * @param {number|string|null|undefined} priceMan
 * @param {Array<{ dep?: number|string|null, rent?: number|string|null, maint?: number|string|null }>} rentals
 * @param {Record<string, unknown>|null|undefined} prop
 */
export function getSaleMetricsForDisplay(priceMan, rentals, prop) {
  return resolveSaleInvestmentMetrics(priceMan, rentals, prop);
}

/**
 * 등록/수정 폼 — 매매·분양 수익률·실투자금 자동 계산
 * @param {ReturnType<import('./propertyForm.js').emptyPriceForm>} priceForm
 */
export function deriveSalePriceFormFieldsForUi(priceForm) {
  return deriveSalePriceFormFields(priceForm);
}

/** @param {number} v @param {string} unit */
export function fmtManwonDisplay(v, unit = '만') {
  const n = parseFormNum(v);
  if (!n) return '—';
  return `${fmtNum(n)}${unit}`;
}

/** 임대차 행들의 임차계약만료일 요약 (빠른 만료일 우선) */
export function formatRentalLeaseEnds(rentals, propFallback) {
  const ends = (rentals ?? [])
    .map((r) => String(r?.leaseEnd ?? '').trim())
    .filter(Boolean)
    .map((s) => s.replace(/-/g, '.'))
    .sort();
  if (ends.length === 0) {
    return propFallback?.leaseEnd ? String(propFallback.leaseEnd).replace(/-/g, '.') : '—';
  }
  if (ends.length === 1) return ends[0];
  return `${ends[0]} 외 ${ends.length - 1}건`;
}

/**
 * 매물 상세 — 매각정보 그리드 행 (거래방식별)
 * @param {Record<string, unknown>} prop
 * @param {Array<Record<string, unknown>>} rentals
 * @param {{ fmtSalePriceEokWon: (p: unknown)=>string, fmtLandPyUnit: (price: number, area: number)=>string }} fmt
 */
export function buildPropSaleInfoRows(prop, rentals, fmt) {
  const trade = prop.trade;
  const sub = prop.sub;

  if (trade === 'SALE' || trade === 'PRESALE') {
    const metrics = getSaleMetricsForDisplay(prop.price, rentals, prop);
    const rows = [
      {
        full: {
          k: '매각가액',
          v: fmt.fmtSalePriceEokWon(prop.price),
          c: '#C8102E',
          bold: true,
        },
      },
      {
        left: {
          k: '대지평단가',
          v: prop.land > 0 && prop.price > 0 ? fmt.fmtLandPyUnit(prop.price, prop.land) : '—',
        },
        right: {
          k: '연면적평단가',
          v: prop.floor > 0 && prop.price > 0 ? fmt.fmtLandPyUnit(prop.price, prop.floor) : '—',
        },
      },
    ];

    if (showsSaleInvestmentFields(trade, sub)) {
      const realInvestLabel =
        metrics.realInvest != null && Number.isFinite(metrics.realInvest)
          ? `${fmtNum(metrics.realInvest)}만원`
          : (prop.realInvest ? `${String(prop.realInvest).replace(/만원$/, '')}만원` : '—');
      const leaseEndLabel = formatRentalLeaseEnds(rentals, prop);

      rows.push(
        {
          left: {
            k: '보증금',
            v: metrics.existingDeposit > 0 ? `${fmtNum(metrics.existingDeposit)}만원` : '—',
          },
          right: {
            k: '월임대료',
            v: metrics.monthlyRent > 0 ? `${fmtNum(metrics.monthlyRent)}만원` : '—',
          },
        },
        {
          left: {
            k: '관리비',
            v: metrics.maintenance > 0 ? `${fmtNum(metrics.maintenance)}만원` : '—',
          },
          right: {
            k: '수익률',
            v: metrics.yieldLabel !== '—' ? metrics.yieldLabel : (prop.roi || '—'),
          },
        },
        {
          left: {
            k: '실투자금',
            v: realInvestLabel,
          },
          right: {
            k: '임차계약만료일',
            v: leaseEndLabel,
          },
        },
      );

      if (showsPremiumField(trade, sub)) {
        const premium = parseFormNum(prop.premium);
        const loan = parseFormNum(prop.loan);
        rows.push({
          left: {
            k: '권리금',
            v: premium > 0 ? `${fmtNum(premium)}만원` : '—',
          },
          right: {
            k: '융자금',
            v: loan > 0 ? `${fmtNum(loan)}만원` : '—',
          },
        });
      }
    }

    return rows;
  }

  if (trade === 'JEONSE') {
    return null;
  }

  return null;
}

/** 거래방식별 매각정보 (매매·분양 외) — PropInfoGrid items */
export function buildTradePriceInfoItems(prop, TL) {
  const trade = prop.trade;
  if (trade === 'JEONSE') {
    return [
      { k: '거래방식', v: TL.JEONSE, c: '#2563EB' },
      { k: '전세보증금', v: fmtManwonDisplay(normalizeJDepToMan(prop.jDep)), c: '#C8102E' },
      ...rentalUnitInfoItems(prop),
      ...(prop.jLeaseEnd || prop.leaseEnd
        ? [{ k: '전세계약만료일', v: String(prop.jLeaseEnd || prop.leaseEnd).replace(/-/g, '.') }]
        : []),
    ];
  }
  if (trade === 'MONTHLY') {
    return [
      { k: '거래방식', v: TL.MONTHLY, c: '#2563EB' },
      { k: '보증금', v: fmtManwonDisplay(prop.mDep), c: '#C8102E' },
      { k: '월세', v: fmtManwonDisplay(prop.mRent), c: '#2563EB' },
      { k: '관리비', v: fmtManwonDisplay(prop.maintenance) },
      ...rentalUnitInfoItems(prop),
      ...(prop.maintenanceDetail ? [{ k: '관리비 포함', v: prop.maintenanceDetail, full: true }] : []),
    ];
  }
  if (trade === 'SHORT_TERM') {
    return [
      { k: '거래방식', v: TL.SHORT_TERM, c: '#2563EB' },
      { k: '보증금', v: fmtManwonDisplay(prop.mDep), c: '#C8102E' },
      { k: '단기임대료', v: fmtManwonDisplay(prop.mRent), c: '#2563EB' },
      { k: '관리비', v: fmtManwonDisplay(prop.maintenance) },
      ...rentalUnitInfoItems(prop),
      ...(prop.shortTermPeriod ? [{ k: '단기임대기간', v: prop.shortTermPeriod }] : []),
    ];
  }
  return [
    { k: '거래방식', v: TL[trade] || '—', c: '#2563EB' },
    { k: '가격', v: prop.price ? fmtManwonDisplay(prop.price) : '—', c: '#C8102E' },
  ];
}
