/** 행정안전부 도로명주소 검색 API 업스트림 호출 */

export const JUSO_LINK_API = 'https://business.juso.go.kr/addrlink/addrLinkApi.do';

const FETCH_HEADERS = {
  Accept: 'application/json, text/plain, */*',
  'User-Agent':
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
};

export function jusoErrorBody(errorCode, errorMessage) {
  return JSON.stringify({
    results: {
      common: {
        errorCode,
        errorMessage,
        totalCount: '0',
        currentPage: '1',
        countPerPage: '0',
      },
      juso: null,
    },
  });
}

function looksLikeJusoJson(body) {
  if (!body || typeof body !== 'string') return false;
  const t = body.trim();
  return t.startsWith('{') && t.includes('"results"');
}

/**
 * @param {URLSearchParams} searchParams confmKey·resultType 포함
 * @param {{ timeoutMs?: number, retries?: number }} [opts]
 * @returns {Promise<{ status: number, body: string }>}
 */
export async function fetchJusoLinkApi(searchParams, opts = {}) {
  const timeoutMs = opts.timeoutMs ?? 12_000;
  const retries = opts.retries ?? 1;
  const url = `${JUSO_LINK_API}?${searchParams.toString()}`;

  let lastFail = null;
  for (let attempt = 0; attempt <= retries; attempt++) {
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), timeoutMs);
    try {
      const res = await fetch(url, { headers: FETCH_HEADERS, signal: ctrl.signal });
      const body = await res.text();
      if (looksLikeJusoJson(body)) {
        return { status: 200, body };
      }
      lastFail = { status: res.status, body };
      if (res.ok) {
        return {
          status: 502,
          body: jusoErrorBody('E9999', '주소 검색 응답을 해석하지 못했습니다.'),
        };
      }
    } catch (err) {
      lastFail = err;
    } finally {
      clearTimeout(timer);
    }
    if (attempt < retries) {
      await new Promise((r) => setTimeout(r, 400));
    }
  }

  const msg = lastFail?.name === 'AbortError'
    ? '주소 검색 시간이 초과되었습니다. 잠시 후 다시 시도해 주세요.'
    : '주소 검색 서버가 일시적으로 응답하지 않습니다. 잠시 후 다시 시도해 주세요.';
  return { status: 502, body: jusoErrorBody('E9999', msg) };
}
