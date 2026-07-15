/**
 * LandNote BFF Express 앱 (listen 없음) — 로컬 서버·Vercel 서버리스 공용
 */
import express from 'express';
import cors from 'cors';
import { API_PROXY_ROUTES } from './lib/proxyConfig.js';
import { createFetchProxy } from './lib/fetchProxy.js';
import { createJusoSearchHandler, SEARCH_PATH, SEARCH_PATH_ALIAS } from './routes/jusoSearch.js';
import { createJusoReturnHandler } from './routes/jusoReturn.js';
import { createGoogleCalendarIcalHandler, GOOGLE_CALENDAR_ICAL_PATH } from './routes/googleCalendarIcal.js';
import { createSignUpConsentRouter, SIGNUP_CONSENT_PATH } from './routes/signUpConsent.js';
import { createPropertyBulkImportHandler, BULK_IMPORT_PATH } from './routes/propertyBulkImport.js';

/**
 * Vercel `api/[...path]` 는 종종 `/api` 접두사를 뺀 path 를 넘김.
 * Express 라우트는 `/api/...` 기준이므로 맞춰 준다.
 * @param {import('express').Request} req
 */
function normalizeVercelApiUrl(req) {
  const raw = req.headers['x-forwarded-uri']
    || req.headers['x-original-uri']
    || req.headers['x-invoke-path']
    || req.headers['x-vercel-forwarded-path'];
  if (typeof raw === 'string' && raw.startsWith('/')) {
    try {
      const u = new URL(raw, 'http://localhost');
      return `${u.pathname}${u.search}`;
    } catch {
      /* fall through */
    }
  }

  const url = req.url || '/';
  const qIdx = url.indexOf('?');
  const pathname = qIdx >= 0 ? url.slice(0, qIdx) : url;
  const search = qIdx >= 0 ? url.slice(qIdx) : '';

  if (
    pathname === '/api'
    || pathname.startsWith('/api/')
    || pathname === '/juso-return.html'
  ) {
    return url;
  }

  // catch-all: /health, /juso-search/..., /public-data/... → /api/...
  const withSlash = pathname.startsWith('/') ? pathname : `/${pathname}`;
  return `/api${withSlash}${search}`;
}

/**
 * @param {NodeJS.ProcessEnv} [env]
 */
export function createApp(env = process.env) {
  const app = express();

  app.use((req, _res, next) => {
    req.url = normalizeVercelApiUrl(req);
    next();
  });

  app.use(cors({ origin: true, credentials: true }));
  app.use(express.urlencoded({ extended: false }));
  app.use(express.json({ limit: '2mb' }));

  for (const [routePath, config] of Object.entries(API_PROXY_ROUTES)) {
    const strip = new RegExp(`^${routePath.replace(/\//g, '\\/')}`);
    app.use(routePath, createFetchProxy({
      target: config.target,
      stripPrefix: strip,
    }));
  }

  const jusoSearch = createJusoSearchHandler(env);
  app.get(SEARCH_PATH, jusoSearch);
  app.get(SEARCH_PATH_ALIAS, jusoSearch);
  // 하위 호환: 긴 .do 경로 / 짧은 alias
  app.get('/api/juso-search/addrlink/addrLinkApi.do', jusoSearch);

  app.get(GOOGLE_CALENDAR_ICAL_PATH, createGoogleCalendarIcalHandler());
  app.use(SIGNUP_CONSENT_PATH, createSignUpConsentRouter());
  app.post('/juso-return.html', createJusoReturnHandler());
  app.post(BULK_IMPORT_PATH, createPropertyBulkImportHandler(env));

  app.get('/health', (_req, res) => {
    res.json({ ok: true, service: 'landnote-bff' });
  });

  app.get('/api/health', (_req, res) => {
    res.json({ ok: true, service: 'landnote-bff' });
  });

  return app;
}
