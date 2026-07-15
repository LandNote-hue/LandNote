import { getSearchKey } from '../lib/proxyConfig.js';

/** 레거시(Vite 플러그인·구 클라이언트) */
const SEARCH_PATH = '/api/juso-search/addrlink/addrLinkApi.do';
/** Vercel 권장(.do 확장자 정적 404 회피) */
const SEARCH_PATH_ALIAS = '/api/juso-search';

export function createJusoSearchHandler(env) {
  const searchKey = getSearchKey(env);

  return async (req, res) => {
    if (!searchKey) {
      res.status(503).json({
        results: {
          common: {
            errorCode: 'E0001',
            errorMessage: 'VITE_JUSO_SEARCH_KEY가 설정되지 않았습니다.',
            totalCount: '0',
            currentPage: '1',
            countPerPage: '0',
          },
          juso: null,
        },
      });
      return;
    }

    try {
      const incoming = new URL(req.originalUrl || req.url || '/', 'http://localhost');
      incoming.searchParams.set('confmKey', searchKey);
      if (!incoming.searchParams.get('resultType')) {
        incoming.searchParams.set('resultType', 'json');
      }

      const upstream = `https://business.juso.go.kr/addrlink/addrLinkApi.do?${incoming.searchParams.toString()}`;
      const upstreamRes = await fetch(upstream, { headers: { Accept: 'application/json' } });
      const body = await upstreamRes.text();
      res.status(upstreamRes.status).type('json').send(body);
    } catch (err) {
      console.error('[juso-search]', err);
      res.status(502).json({
        results: {
          common: {
            errorCode: 'E9999',
            errorMessage: '주소 검색 서버 연결 실패',
            totalCount: '0',
            currentPage: '1',
            countPerPage: '0',
          },
          juso: null,
        },
      });
    }
  };
}

export { SEARCH_PATH, SEARCH_PATH_ALIAS };
