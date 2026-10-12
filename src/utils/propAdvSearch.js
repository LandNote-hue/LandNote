import { KR_SIDO, KR_GU, sidoMatch } from '../features/map/regions.js';
import { SALE_PROP_KIND_OPTS, propertyMatchesSaleKind } from '../data/propertyTypes.js';
import { m2ToPyung, priceInManForFilter } from './formatMoney.js';
import { PROP_AGENT_NONE, propertyMatchesAgentFilter } from './propAgent.js';
import { propSearchHaystack } from './propAddress.js';
import { PROP_STATUS_FILTER_LABELS, PROP_STATUS_LABEL_TO_CODE, propStatusFilterLabels } from './propStatus.js';

export { KR_SIDO, KR_GU, SALE_PROP_KIND_OPTS, PROP_AGENT_NONE, PROP_STATUS_FILTER_LABELS, propStatusFilterLabels };

export function emptyAdvSearchDraft() {
  return {
    selSido: '',
    selGu: '',
    advTag: '',
    advMain: '',
    advAgent: '',
    advStatus: '',
    advPriceMin: '',
    advPriceMax: '',
    advLandMin: '',
    advLandMax: '',
    advFloorMin: '',
    advFloorMax: '',
    advRoiMin: '',
  };
}

export function buildAppliedAdv(draft) {
  const d = draft || emptyAdvSearchDraft();
  return {
    sido: d.selSido,
    gu: d.selGu,
    tag: d.advTag,
    kind: d.advMain,
    trade: '',
    agent: d.advAgent,
    status: d.advStatus,
    priceMin: d.advPriceMin,
    priceMax: d.advPriceMax,
    landMin: d.advLandMin,
    landMax: d.advLandMax,
    floorMin: d.advFloorMin,
    floorMax: d.advFloorMax,
    roiMin: d.advRoiMin,
  };
}

/** 매물관리 상세검색 「검색 적용」과 동일한 조건 */
export function propertyMatchesAppliedAdv(p, appliedAdv) {
  if (!appliedAdv) return true;
  const a = appliedAdv;
  const num = (v) => {
    const n = parseFloat(String(v ?? '').replace(/,/g, ''));
    return Number.isFinite(n) ? n : null;
  };
  if (!sidoMatch(propSearchHaystack(p), a.sido)) return false;
  if (a.gu && !propSearchHaystack(p).includes(a.gu)) return false;
  if (a.tag && p.tag !== a.tag) return false;
  if (a.kind && !propertyMatchesSaleKind(p, a.kind)) return false;
  if (!a.kind && a.main && p.main !== a.main) return false;
  if (!propertyMatchesAgentFilter(p, a.agent)) return false;
  if (a.status && p.status !== PROP_STATUS_LABEL_TO_CODE[a.status]) return false;
  const price = priceInManForFilter(p);
  const pmin = num(a.priceMin);
  const pmax = num(a.priceMax);
  if (pmin != null && (price == null || price < pmin)) return false;
  if (pmax != null && (price == null || price > pmax)) return false;
  const landPy = p.land > 0 ? Number(m2ToPyung(p.land)) : 0;
  const lmin = num(a.landMin);
  const lmax = num(a.landMax);
  if (lmin != null && landPy < lmin) return false;
  if (lmax != null && landPy > lmax) return false;
  const floorPy = p.floor > 0 ? Number(m2ToPyung(p.floor)) : 0;
  const fmin = num(a.floorMin);
  const fmax = num(a.floorMax);
  if (fmin != null && floorPy < fmin) return false;
  if (fmax != null && floorPy > fmax) return false;
  const rmin = num(a.roiMin);
  if (rmin != null) {
    const roi = parseFloat(p.roi);
    if (!Number.isFinite(roi) || roi < rmin) return false;
  }
  return true;
}
