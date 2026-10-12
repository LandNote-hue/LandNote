import { emptyLandForm } from '../services/publicData/mapToPropertyForm.js';
import { fmtNum } from './formatMoney.js';
import { landFromProperty, landToPropertyFields, parseFormNum } from './propertyForm.js';

export function extraParcelCount(p) {
  return Array.isArray(p?.extraParcels) ? p.extraParcels.filter(Boolean).length : 0;
}

export function extraParcelsSearchText(p) {
  if (!Array.isArray(p?.extraParcels)) return '';
  return p.extraParcels
    .map((x) => [x?.jibunAddr, x?.roadAddr].filter(Boolean).join(' '))
    .filter(Boolean)
    .join(' ');
}

/** 상세 소재지 — 대표 지번 외 N필지 */
export function formatJibunWithExtraParcels(jibun, extraCount) {
  const base = String(jibun || '').trim();
  const n = Number(extraCount) || 0;
  if (n <= 0) return base;
  if (!base) return `외 ${n}필지`;
  return `${base} 외 ${n}필지`;
}

export function formatPropertyJibunWithExtraParcels(p) {
  const jibun = String(p?.jibunAddr || p?.addr || '').trim();
  return formatJibunWithExtraParcels(jibun, extraParcelCount(p));
}

/** @param {Record<string, string>|null|undefined} keys */
export function parcelIdentityKey(keys) {
  if (!keys || typeof keys !== 'object') return '';
  const pnu = String(keys.pnu || '').trim();
  if (pnu) return `pnu:${pnu}`;
  const jibun = String(keys.jibunAddr || '').replace(/\s+/g, '');
  return jibun ? `jibun:${jibun}` : '';
}

function uniqueJoin(values) {
  const seen = new Set();
  const out = [];
  for (const raw of values) {
    const s = String(raw || '').trim();
    if (!s) continue;
    for (const part of s.split(/[,，]/).map((x) => x.trim()).filter(Boolean)) {
      if (seen.has(part)) continue;
      seen.add(part);
      out.push(part);
    }
  }
  return out.join(', ');
}

function areaNum(land) {
  const n = parseFormNum(land?.landAreaM2);
  return n > 0 ? n : 0;
}

function priceNum(land) {
  const n = parseFormNum(String(land?.officialPriceM2 ?? '').replace(/,/g, ''));
  return n > 0 ? n : 0;
}

/**
 * 면적 합 · 공시지가 면적가중평균(원/㎡) · 용도지역/지목은 서로 다르면 쉼표 나열 · 기준년도는 대표 필지
 */
export function aggregateLandForm(primaryLand, extraParcels = []) {
  const primary = { ...emptyLandForm(), ...primaryLand };
  const extras = Array.isArray(extraParcels) ? extraParcels : [];
  if (!extras.length) return primary;

  const lands = [primary, ...extras.map((p) => ({ ...emptyLandForm(), ...p.landForm }))];
  const totalArea = lands.reduce((s, l) => s + areaNum(l), 0);

  let weightSum = 0;
  let areaWithPrice = 0;
  for (const l of lands) {
    const a = areaNum(l);
    const pr = priceNum(l);
    if (a > 0 && pr > 0) {
      weightSum += pr * a;
      areaWithPrice += a;
    }
  }

  return {
    landAreaM2: totalArea > 0 ? String(Math.round(totalArea * 1000) / 1000) : '',
    landUseZone: uniqueJoin(lands.map((l) => l.landUseZone)),
    landCategory: uniqueJoin(lands.map((l) => l.landCategory)),
    officialPriceM2: areaWithPrice > 0 ? fmtNum(Math.round(weightSum / areaWithPrice)) : '',
    officialPriceYear: primary.officialPriceYear || '',
  };
}

/** @param {unknown} raw */
export function normalizeExtraParcels(raw) {
  if (!Array.isArray(raw)) return [];
  return raw.filter((x) => x && typeof x === 'object').map((x, i) => ({
    id: String(x.id || x.addressKeys?.pnu || `extra-${i}`),
    jibunAddr: String(x.jibunAddr || x.addressKeys?.jibunAddr || '').trim(),
    roadAddr: String(x.roadAddr || x.addressKeys?.roadAddr || '').trim(),
    addressKeys: x.addressKeys && typeof x.addressKeys === 'object' ? { ...x.addressKeys } : {},
    landForm: { ...emptyLandForm(), ...(x.landForm && typeof x.landForm === 'object' ? x.landForm : {}) },
    status: x.status === 'loading' || x.status === 'error' ? 'idle' : (x.status || 'success'),
    error: null,
  }));
}

/** @param {ReturnType<typeof normalizeExtraParcels>} parcels */
export function serializeExtraParcels(parcels) {
  return normalizeExtraParcels(parcels).map((p) => ({
    id: p.id,
    jibunAddr: p.jibunAddr,
    roadAddr: p.roadAddr,
    addressKeys: p.addressKeys,
    landForm: { ...emptyLandForm(), ...p.landForm },
  }));
}

export function landFromPropertyPrimary(p) {
  if (extraParcelCount(p) > 0 && p.primaryLand && typeof p.primaryLand === 'object') {
    return { ...emptyLandForm(), ...p.primaryLand };
  }
  return landFromProperty(p);
}

/** 대표 필지와 같은 추가 필지는 합산에서 제외 */
export function extrasWithoutPrimary(extraParcels, primaryKeys) {
  const pk = parcelIdentityKey(primaryKeys);
  if (!pk) return Array.isArray(extraParcels) ? extraParcels : [];
  return (Array.isArray(extraParcels) ? extraParcels : []).filter(
    (p) => parcelIdentityKey(p.addressKeys || p) !== pk,
  );
}

export function landFieldsForPropertySave(primaryLand, extraParcels, primaryKeys) {
  const extras = serializeExtraParcels(extrasWithoutPrimary(extraParcels, primaryKeys));
  const aggregated = aggregateLandForm(primaryLand, extras);
  return {
    ...landToPropertyFields(aggregated),
    extraParcels: extras,
    primaryLand: extras.length ? { ...emptyLandForm(), ...primaryLand } : null,
  };
}
