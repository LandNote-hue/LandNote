/**
 * juso 검색 API — 승인키를 서버에서만 주입 (클라이언트에 검색키 노출 최소화)
 * @see https://business.juso.go.kr/addrlink/devAddrLinkRequestWrite.do?menu=menu2
 */

import { loadEnv } from 'vite';

const SEARCH_PATH = '/api/juso-search/addrlink/addrLinkApi.do';

function getSearchKey(env) {
  return (
    env.VITE_JUSO_SEARCH_KEY
    || env.VITE_JUSO_CONFIRM_KEY
    || ''
  ).trim();
}

export function jusoSearchProxyPlugin() {
  let searchKey = '';

  return {
    name: 'juso-search-proxy',
    config(_config, { mode }) {
      const env = loadEnv(mode, process.cwd(), '');
      searchKey = getSearchKey(env);
    },
    configureServer(server) {
      server.middlewares.use(async (req, res, next) => {
        const path = req.url?.split('?')[0];
        if (path !== SEARCH_PATH || req.method !== 'GET') {
          next();
          return;
        }

        if (!searchKey) {
          res.statusCode = 503;
          res.setHeader('Content-Type', 'application/json; charset=utf-8');
          res.end(JSON.stringify({
            results: {
              common: {
                errorCode: 'E0001',
                errorMessage: 'VITE_JUSO_SEARCH_KEY가 설정되지 않았습니다. juso.go.kr에서 도로명주소 검색 API 승인키를 신청하세요.',
                totalCount: '0',
                currentPage: '1',
                countPerPage: '0',
              },
              juso: null,
            },
          }));
          return;
        }

        try {
          const incoming = new URL(req.url, 'http://localhost');
          incoming.searchParams.set('confmKey', searchKey);
          if (!incoming.searchParams.get('resultType')) {
            incoming.searchParams.set('resultType', 'json');
          }

          const upstream = `https://business.juso.go.kr/addrlink/addrLinkApi.do?${incoming.searchParams.toString()}`;
          const upstreamRes = await fetch(upstream, {
            headers: { Accept: 'application/json' },
          });
          const body = await upstreamRes.text();
          res.statusCode = upstreamRes.status;
          res.setHeader('Content-Type', 'application/json; charset=utf-8');
          res.end(body);
        } catch (err) {
          console.error('[juso-search-proxy]', err);
          res.statusCode = 502;
          res.setHeader('Content-Type', 'application/json; charset=utf-8');
          res.end(JSON.stringify({
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
          }));
        }
      });
    },
  };
}
