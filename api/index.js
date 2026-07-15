/**
 * Vercel Serverless — Express BFF 엔트리
 * /api/* · /juso-return.html → 이 함수로 rewrite (vercel.json)
 */
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import { createApp } from '../server/createApp.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
// 로컬 vercel dev 등에서 .env.local 로드 (Vercel 클라우드는 Dashboard env 사용)
dotenv.config({ path: path.resolve(__dirname, '../.env.local') });
dotenv.config({ path: path.resolve(__dirname, '../.env') });

const app = createApp(process.env);

export default app;
