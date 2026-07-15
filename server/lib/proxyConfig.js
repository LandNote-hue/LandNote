/** @typedef {{ target: string, rewrite: (path: string) => string }} ProxyRoute */

/** @type {Record<string, ProxyRoute>} */
export const API_PROXY_ROUTES = {
  '/api/public-data': {
    target: 'https://apis.data.go.kr',
    rewrite: (path) => path.replace(/^\/api\/public-data/, ''),
  },
  '/api/vworld': {
    target: 'https://api.vworld.kr',
    rewrite: (path) => path.replace(/^\/api\/vworld/, ''),
  },
  '/api/eum': {
    target: 'https://www.eum.go.kr',
    rewrite: (path) => path.replace(/^\/api\/eum/, ''),
  },
  '/api/juso': {
    target: 'https://business.juso.go.kr',
    rewrite: (path) => path.replace(/^\/api\/juso/, ''),
  },
};

export function getSearchKey(env) {
  return (
    env.VITE_JUSO_SEARCH_KEY
    || env.VITE_JUSO_CONFIRM_KEY
    || ''
  ).trim();
}
