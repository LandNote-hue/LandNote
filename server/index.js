/**
 * LandNote BFF — 공공 API 프록시 + juso 검색/반환
 * 운영 배포 시 API 키를 서버 환경변수로만 관리합니다.
 */
import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import { createProxyMiddleware } from 'http-proxy-middleware';
import path from 'path';
import { fileURLToPath } from 'url';
import { API_PROXY_ROUTES } from './lib/proxyConfig.js';
import { createJusoSearchHandler, SEARCH_PATH } from './routes/jusoSearch.js';
import { createJusoReturnHandler } from './routes/jusoReturn.js';
import { createGoogleCalendarIcalHandler, GOOGLE_CALENDAR_ICAL_PATH } from './routes/googleCalendarIcal.js';
import { createSignUpConsentRouter, SIGNUP_CONSENT_PATH } from './routes/signUpConsent.js';
import { createPropertyBulkImportHandler, BULK_IMPORT_PATH } from './routes/propertyBulkImport.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.resolve(__dirname, '../.env.local') });
dotenv.config({ path: path.resolve(__dirname, '../.env') });

const app = express();
const PORT = Number(process.env.BFF_PORT || 3001);
const distDir = path.resolve(__dirname, '../dist');
const serveStatic = process.env.SERVE_STATIC === 'true' || process.argv.includes('--static');

app.use(cors({ origin: true, credentials: true }));
app.use(express.urlencoded({ extended: false }));
app.use(express.json());

for (const [routePath, config] of Object.entries(API_PROXY_ROUTES)) {
  app.use(routePath, createProxyMiddleware({
    target: config.target,
    changeOrigin: true,
    pathRewrite: (_path, req) => config.rewrite(req.originalUrl),
  }));
}

app.get(SEARCH_PATH, createJusoSearchHandler(process.env));
app.get(GOOGLE_CALENDAR_ICAL_PATH, createGoogleCalendarIcalHandler());
app.use(SIGNUP_CONSENT_PATH, createSignUpConsentRouter());
app.post('/juso-return.html', createJusoReturnHandler());

app.post(BULK_IMPORT_PATH, createPropertyBulkImportHandler(process.env));
app.get('/health', (_req, res) => {
  res.json({ ok: true, service: 'landnote-bff' });
});

if (serveStatic) {
  app.use(express.static(distDir));
  app.get(/^(?!\/api\/).*/, (_req, res) => {
    res.sendFile(path.join(distDir, 'index.html'));
  });
}

app.listen(PORT, () => {
  console.log(`[landnote-bff] http://localhost:${PORT}`);
  if (serveStatic) {
    console.log('[landnote-bff] serving static from dist/');
  }
});
