import { fmtLandM2Unit, fmtLandPyUnit, fmtNum, fmtPropPrice as propPrice, m2ToPyung } from '../../utils/formatMoney.js';
import { propKindDisplayLabel, saleKindFromProp } from '../../data/propertyTypes.js';
import { isRentalListProperty } from '../../utils/propListKind.js';

export const MAP_TRADE_LABEL = {
  SALE: '매매', JEONSE: '전세', MONTHLY: '월세', SHORT_TERM: '단기', PRESALE: '매매',
};

const KIND_THEME = {
  BUILDING: { pin: '#E07070', text: '#D45C5C', chipBg: '#F7D4D4', chipFg: '#D45C5C' },
  DETACHED: { pin: '#E0A04A', text: '#C4841E', chipBg: '#F8E4C4', chipFg: '#C4841E' },
  FACTORY: { pin: '#7A8A99', text: '#5A6A78', chipBg: '#DDE4EC', chipFg: '#5A6A78' },
  LAND: { pin: '#5AAA68', text: '#3D8A4A', chipBg: '#D4EDD8', chipFg: '#3D8A4A' },
  KNOWLEDGE: { pin: '#5B8EE8', text: '#3B6FCF', chipBg: '#D4E3FA', chipFg: '#3B6FCF' },
  HOTEL: { pin: '#9B6AD0', text: '#7A48B0', chipBg: '#E8D6F6', chipFg: '#7A48B0' },
};

const SUB_THEME = {
  APARTMENT: KIND_THEME.KNOWLEDGE,
  APT_PRESALE: KIND_THEME.KNOWLEDGE,
  RECONSTRUCTION: KIND_THEME.KNOWLEDGE,
  REDEVELOPMENT: KIND_THEME.KNOWLEDGE,
  OFFICETEL_RESI: KIND_THEME.KNOWLEDGE,
  OFFICETEL_COMM: KIND_THEME.KNOWLEDGE,
  OFFICETEL_PRESALE: KIND_THEME.KNOWLEDGE,
  OFFICETEL_STUDIO: KIND_THEME.KNOWLEDGE,
  VILLA: KIND_THEME.DETACHED,
  DETACHED: KIND_THEME.DETACHED,
  COUNTRY_HOUSE: KIND_THEME.DETACHED,
  COMMERCIAL_HOUSE: KIND_THEME.BUILDING,
  ONEROOM: KIND_THEME.KNOWLEDGE,
  TWOROOM: KIND_THEME.KNOWLEDGE,
  STORE: KIND_THEME.BUILDING,
  OFFICE: KIND_THEME.KNOWLEDGE,
  WHOLE_BUILDING: KIND_THEME.BUILDING,
  FACTORY_WAREHOUSE: KIND_THEME.FACTORY,
  KNOWLEDGE_INDUSTRY: KIND_THEME.KNOWLEDGE,
  LAND: KIND_THEME.LAND,
  HOTEL_ACCOMMODATION: KIND_THEME.HOTEL,
  LIVING_ACCOMMODATION: KIND_THEME.HOTEL,
};

const FALLBACK_THEME = { pin: '#64748B', text: '#475569', chipBg: '#E8EAED', chipFg: '#475569' };

export function typeTheme(p) {
  const kind = saleKindFromProp(p);
  if (kind && KIND_THEME[kind]) return KIND_THEME[kind];
  if (p?.sub && SUB_THEME[p.sub]) return SUB_THEME[p.sub];
  const hay = `${p?.mainUse || ''} ${p?.tag || ''} ${propKindDisplayLabel(p) || ''}`;
  if (/상업/.test(hay)) return KIND_THEME.BUILDING;
  if (isRentalListProperty(p)) return KIND_THEME.KNOWLEDGE;
  return FALLBACK_THEME;
}

export function kindLabel(p) {
  return String(propKindDisplayLabel(p) || '').trim();
}

export function compactPrice(p) {
  const raw = propPrice(p);
  if (!raw || raw === '—') return '';
  return raw.replace(/원/g, '');
}

export function priceLine(p) {
  const price = compactPrice(p);
  if (!price) return '';
  return [MAP_TRADE_LABEL[p.trade], price].filter(Boolean).join(' ');
}

function unitPriceLabel(price, area, unit, prefix) {
  if (!(Number(price) > 0 && Number(area) > 0)) return '';
  const v = unit === 'm2' ? fmtLandM2Unit(price, area) : fmtLandPyUnit(price, area);
  if (!v || v === '—') return '';
  return `${prefix} ${v}`;
}

export function landPyLabel(p, unit = 'py') {
  if (isRentalListProperty(p)) return '';
  return unitPriceLabel(p?.price, p?.land, unit, '대지단가');
}

export function floorPyLabel(p, unit = 'py') {
  if (isRentalListProperty(p)) return '';
  return unitPriceLabel(p?.price, p?.floor, unit, '연면적단가');
}

export function formatArea(m2, unit = 'py') {
  const n = Number(m2);
  if (!Number.isFinite(n) || n <= 0) return '';
  if (unit === 'py') {
    const py = m2ToPyung(n);
    return py == null ? '' : `${fmtNum(py, { decimal: true })}평`;
  }
  return `${fmtNum(n, { decimal: true })}㎡`;
}

/** 대지면적 — 축소 배지용 */
export function landAreaLabel(p, unit = 'py') {
  return formatArea(p?.land, unit);
}
