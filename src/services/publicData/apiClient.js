import axios from 'axios';

/**
 * 공공데이터포털(data.go.kr) Axios 클라이언트
 * - 브라우저 CORS: Vite dev proxy `/api/public-data` 사용 (vite.config.js)
 * - 운영: 백엔드 프록시 또는 서버리스 권장 (API 키 노출 방지)
 */
const baseURL = import.meta.env.DEV
  ? '/api/public-data'
  : (import.meta.env.VITE_PUBLIC_DATA_BASE_URL || '/api/public-data');

export const publicDataClient = axios.create({
  baseURL,
  timeout: 30_000,
  headers: { Accept: 'application/json' },
});

/** @param {string} name VITE_* 키 suffix e.g. DATA_GO_KR_SERVICE_KEY */
export function getServiceKey(name = 'DATA_GO_KR_SERVICE_KEY') {
  const key = import.meta.env[`VITE_${name}`];
  if (!key) {
    console.warn(`[publicData] VITE_${name} 미설정 — .env.local 참고`);
  }
  return key || '';
}

/**
 * @param {import('axios').AxiosInstance} client
 * @param {string} path
 * @param {Record<string, string|number>} params
 */
export async function publicDataGet(client, path, params = {}) {
  const rawKey = getServiceKey();
  const serviceKey = rawKey.includes('%') ? rawKey : encodeURIComponent(rawKey);
  const { data } = await client.get(path, {
    params: {
      serviceKey,
      numOfRows: params.numOfRows ?? 100,
      pageNo: 1,
      _type: 'json',
      ...params,
    },
  });
  const code = data?.response?.header?.resultCode;
  if (code && code !== '00') {
    const msg = data?.response?.header?.resultMsg || '공공데이터 API 오류';
    throw new Error(`[data.go.kr ${code}] ${msg}`);
  }
  return data;
}

/** 공공데이터 공통 응답에서 items 배열 추출 (스켈레톤) */
export function unwrapItems(response, itemPath = 'response.body.items.item') {
  const parts = itemPath.split('.');
  let cur = response;
  for (const p of parts) {
    cur = cur?.[p];
    if (cur == null) return [];
  }
  return Array.isArray(cur) ? cur : cur ? [cur] : [];
}
