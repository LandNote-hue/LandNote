/**
 * LandNote BFF — 로컬/Render용 long-running 서버
 * Vercel은 api/index.js → createApp() 사용
 */
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import express from 'express';
import { createApp } from './createApp.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.resolve(__dirname, '../.env.local') });
dotenv.config({ path: path.resolve(__dirname, '../.env') });

const PORT = Number(process.env.BFF_PORT || 3001);
const distDir = path.resolve(__dirname, '../dist');
const serveStatic = process.env.SERVE_STATIC === 'true' || process.argv.includes('--static');

const app = createApp(process.env);

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
