/**
 * 032 마이그레이션 적용 + SOLO 프로필 보정
 * 사용:
 *   node scripts/apply-032-company-rls.mjs
 * DB DDL까지 적용하려면 .env.local 에 DATABASE_URL (또는 SUPABASE_DB_URL) 필요
 */
import { readFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createClient } from '@supabase/supabase-js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = resolve(__dirname, '..');

function loadEnvLocal() {
  const path = resolve(root, '.env.local');
  /** @type {Record<string, string>} */
  const env = {};
  try {
    const text = readFileSync(path, 'utf8');
    for (const line of text.split('\n')) {
      const t = line.trim();
      if (!t || t.startsWith('#')) continue;
      const i = t.indexOf('=');
      if (i < 0) continue;
      env[t.slice(0, i).trim()] = t.slice(i + 1).trim().replace(/^["']|["']$/g, '');
    }
  } catch {
    /* ignore */
  }
  return env;
}

const env = { ...process.env, ...loadEnvLocal() };
const url = env.VITE_SUPABASE_URL || env.SUPABASE_URL;
const key = env.SUPABASE_SERVICE_ROLE_KEY;
const dbUrl = env.DATABASE_URL || env.SUPABASE_DB_URL || env.POSTGRES_URL;

if (!url || !key) {
  console.error('SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY required');
  process.exit(1);
}

const sb = createClient(url, key, { auth: { persistSession: false } });

async function repairSoloProfiles() {
  const { data, error } = await sb
    .from('profiles')
    .update({ user_type: 'SOLO', updated_at: new Date().toISOString() })
    .eq('role', 'SOLO')
    .eq('user_type', 'BUSINESS')
    .filter('company_id', 'eq', 'id'); // may not work — PostgREST can't compare columns
  // PostgREST can't do company_id = id in filter easily; fetch then update
  void data;
  void error;

  const { data: rows, error: listErr } = await sb
    .from('profiles')
    .select('id, role, user_type, company_id')
    .eq('role', 'SOLO')
    .eq('user_type', 'BUSINESS');
  if (listErr) throw listErr;
  const targets = (rows || []).filter((r) => r.company_id && r.company_id === r.id);
  console.log(`profile repair candidates: ${targets.length}`);
  for (const r of targets) {
    const { error: upErr } = await sb
      .from('profiles')
      .update({ user_type: 'SOLO', updated_at: new Date().toISOString() })
      .eq('id', r.id);
    if (upErr) throw upErr;
    console.log('  repaired', r.id);
  }
}

async function applySqlMigration() {
  if (!dbUrl) {
    console.warn('DATABASE_URL not set — skip DDL. Apply supabase/migrations/032_fix_company_members_rls_recursion.sql in SQL Editor.');
    return false;
  }
  const { default: pg } = await import('pg').catch(() => ({ default: null }));
  if (!pg) {
    console.warn('pg package not installed — skip DDL');
    return false;
  }
  const sqlPath = resolve(root, 'supabase/migrations/032_fix_company_members_rls_recursion.sql');
  const sql = readFileSync(sqlPath, 'utf8');
  const client = new pg.Client({ connectionString: dbUrl, ssl: { rejectUnauthorized: false } });
  await client.connect();
  try {
    await client.query(sql);
    console.log('DDL applied via DATABASE_URL');
    return true;
  } finally {
    await client.end();
  }
}

await repairSoloProfiles();
await applySqlMigration();
console.log('done');
