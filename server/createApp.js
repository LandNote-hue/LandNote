/**
 * LandNote BFF Express 앱 (listen 없음) — 로컬 서버·Vercel 서버리스 공용
 */
import express from 'express';
import cors from 'cors';
import { API_PROXY_ROUTES } from './lib/proxyConfig.js';
import { createFetchProxy } from './lib/fetchProxy.js';
import { createJusoSearchHandler, SEARCH_PATH } from './routes/jusoSearch.js';
import { createJusoReturnHandler } from './routes/jusoReturn.js';
import { createGoogleCalendarIcalHandler, GOOGLE_CALENDAR_ICAL_PATH } from './routes/googleCalendarIcal.js';
import { createSignUpConsentRouter, SIGNUP_CONSENT_PATH } from './routes/signUpConsent.js';
import { createPropertyBulkImportHandler, BULK_IMPORT_PATH } from './routes/propertyBulkImport.js';

/**
 * @param {NodeJS.ProcessEnv} [env]
 */
export function createApp(env = process.env) {
  const app = express();

  // Vercel rewrite 등으로 url이 /api 로만 올 때 원본 경로 복구
  app.use((req, _res, next) => {
    const raw = req.headers['x-forwarded-uri']
      || req.headers['x-invoke-path']
      || req.headers['x-vercel-forwarded-path'];
    if (typeof raw === 'string' && raw.startsWith('/') && raw !== req.url) {
      try {
        const u = new URL(raw, 'http://localhost');
        req.url = `${u.pathname}${u.search}`;
      } catch {
        /* ignore */
      }
    }
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

  app.get(SEARCH_PATH, createJusoSearchHandler(env));
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
