/**
 * Vercel 서버리스 친화적 upstream 프록시 (http-proxy-middleware 대체)
 * @param {{ target: string, stripPrefix: RegExp }} opts
 */
export function createFetchProxy({ target, stripPrefix }) {
  const base = String(target || '').replace(/\/$/, '');

  return async (req, res) => {
    try {
      const incoming = new URL(req.originalUrl || req.url || '/', 'http://localhost');
      const pathPart = incoming.pathname.replace(stripPrefix, '') || '/';
      const upstreamUrl = `${base}${pathPart.startsWith('/') ? pathPart : `/${pathPart}`}${incoming.search}`;

      /** @type {Record<string, string>} */
      const headers = { Accept: req.headers.accept || '*/*' };
      if (req.headers['user-agent']) headers['User-Agent'] = String(req.headers['user-agent']);
      if (req.headers['content-type']) headers['Content-Type'] = String(req.headers['content-type']);

      /** @type {RequestInit} */
      const init = { method: req.method, headers };
      if (req.method !== 'GET' && req.method !== 'HEAD') {
        if (Buffer.isBuffer(req.body)) {
          init.body = req.body;
        } else if (typeof req.body === 'string') {
          init.body = req.body;
        } else if (req.body != null && typeof req.body === 'object' && Object.keys(req.body).length) {
          init.body = JSON.stringify(req.body);
          headers['Content-Type'] = headers['Content-Type'] || 'application/json';
        }
      }

      const upstream = await fetch(upstreamUrl, init);
      const buf = Buffer.from(await upstream.arrayBuffer());
      res.status(upstream.status);
      const ct = upstream.headers.get('content-type');
      if (ct) res.setHeader('Content-Type', ct);
      const cache = upstream.headers.get('cache-control');
      if (cache) res.setHeader('Cache-Control', cache);
      res.send(buf);
    } catch (err) {
      console.error('[fetchProxy]', err);
      res.status(502).json({ message: 'Upstream proxy error', detail: err?.message || String(err) });
    }
  };
}
