import { getSearchKey } from '../lib/proxyConfig.js';
import { fetchJusoLinkApi, jusoErrorBody } from '../lib/jusoUpstream.js';

/** 레거시(Vite 플러그인·구 클라이언트) */
const SEARCH_PATH = '/api/juso-search/addrlink/addrLinkApi.do';
/** Vercel 권장(.do 확장자 정적 404 회피) */
const SEARCH_PATH_ALIAS = '/api/juso-search';

export function createJusoSearchHandler(env) {
  const searchKey = getSearchKey(env);

  return async (req, res) => {
    if (!searchKey) {
      res.status(503).type('json').send(jusoErrorBody(
        'E0001',
        'VITE_JUSO_SEARCH_KEY가 설정되지 않았습니다.',
      ));
      return;
    }

    try {
      const incoming = new URL(req.originalUrl || req.url || '/', 'http://localhost');
      incoming.searchParams.set('confmKey', searchKey);
      if (!incoming.searchParams.get('resultType')) {
        incoming.searchParams.set('resultType', 'json');
      }

      const { status, body } = await fetchJusoLinkApi(incoming.searchParams);
      res.status(status).type('json').send(body);
    } catch (err) {
      console.error('[juso-search]', err);
      res.status(502).type('json').send(jusoErrorBody('E9999', '주소 검색 서버 연결 실패'));
    }
  };
}

export { SEARCH_PATH, SEARCH_PATH_ALIAS };
