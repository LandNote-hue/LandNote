import axios from 'axios';

const baseURL = import.meta.env.DEV
  ? '/api/vworld'
  : (import.meta.env.VITE_VWORLD_BASE_URL || '/api/vworld');

export const vworldClient = axios.create({
  baseURL,
  timeout: 30_000,
  headers: { Accept: 'application/json' },
});

export function getVworldKey() {
  const key = import.meta.env.VITE_VWORLD_API_KEY;
  if (!key) console.warn('[vworld] VITE_VWORLD_API_KEY 미설정');
  return key || '';
}

export function getVworldDomain() {
  return import.meta.env.VITE_VWORLD_DOMAIN || window.location.hostname || 'localhost';
}

/**
 * @param {string} path e.g. /ned/data/getIndvdLandPriceAttr
 * @param {Record<string, string|number>} params
 */
export async function vworldGet(path, params = {}) {
  const { data } = await vworldClient.get(path, {
    params: {
      key: getVworldKey(),
      domain: getVworldDomain(),
      format: 'json',
      ...params,
    },
  });
  return data;
}

function fieldToArray(field) {
  if (field == null) return [];
  return Array.isArray(field) ? field : [field];
}

/** vworld API별 실제 JSON 루트 키 (공식 문서와 불일치하는 경우 포함) */
const ROOT_KEY_ALIASES = {
  landCharacteristics: ['landCharacteristics', 'landCharacteristicss', 'landCharacteristic'],
  indvdLandPrices: ['indvdLandPrices', 'indvdLandPrice', 'indvdLandPriceAttr'],
  landUses: ['landUses', 'landUse', 'landUseAttr'],
};

function collectRootCandidates(response, rootKey) {
  /** @type {unknown[]} */
  const candidates = [];
  const aliases = rootKey
    ? (ROOT_KEY_ALIASES[rootKey] ?? [rootKey])
    : [];

  for (const key of aliases) {
    candidates.push(
      response[key],
      response.response?.[key],
      response.data?.[key],
    );
  }

  candidates.push(
    response.response?.result,
    response.result,
    response.response,
  );

  if (rootKey && typeof response === 'object') {
    for (const [key, value] of Object.entries(response)) {
      if (!aliases.some(a => key.toLowerCase().includes(a.toLowerCase()))) continue;
      candidates.push(value);
    }
  }

  return candidates.filter(Boolean);
}

function extractFieldsFromRoot(root) {
  if (!root || typeof root !== 'object') return [];
  const obj = /** @type {Record<string, unknown>} */ (root);

  if (obj.field != null) return fieldToArray(obj.field);
  if (obj.fields?.field != null) return fieldToArray(obj.fields.field);
  if (Array.isArray(obj.fields)) return obj.fields;

  if (
    obj.lndpclAr != null
    || obj.lndPclAr != null
    || obj.pblntfPclnd != null
    || obj.lndcgrCodeNm != null
    || obj.prposAreaDstrcCodeNm != null
    || obj.prposArea1Nm != null
  ) {
    return [obj];
  }

  return [];
}

/**
 * vworld JSON — 응답 형식이 API마다 달라 여러 경로 탐색
 * @param {Record<string, unknown>|null|undefined} response
 * @param {string} [rootKey] e.g. landCharacteristics, indvdLandPrices, landUses
 */
export function vworldExtractFields(response, rootKey) {
  if (!response || typeof response !== 'object') return [];

  for (const root of collectRootCandidates(response, rootKey)) {
    const fields = extractFieldsFromRoot(root);
    if (fields.length) return fields;
  }

  return [];
}

/** @param {Record<string, unknown>|null|undefined} response @param {string} rootKey */
export function vworldFirstField(response, rootKey) {
  return vworldExtractFields(response, rootKey)[0] ?? null;
}

/** @param {Record<string, unknown>|null|undefined} response */
export function vworldHasData(response) {
  const total = parseInt(
    String(response?.response?.totalCount ?? response?.totalCount ?? ''),
    10,
  );
  if (!Number.isNaN(total) && total > 0) return true;
  return vworldExtractFields(response).length > 0
    || vworldExtractFields(response, 'landCharacteristics').length > 0
    || vworldExtractFields(response, 'indvdLandPrices').length > 0
    || vworldExtractFields(response, 'landUses').length > 0;
}
