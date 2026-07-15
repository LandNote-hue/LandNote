/**
 * Supabase 테스트 데이터 일괄 삭제 (006 TRUNCATE와 동일)
 * 사용: node scripts/clear-supabase-test-data.mjs
 * 필요: .env.local 의 SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY
 */
import { readFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createClient } from '@supabase/supabase-js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = resolve(__dirname, '..');

function loadEnvLocal() {
  const path = resolve(root, '.env.local');
  const text = readFileSync(path, 'utf8');
  /** @type {Record<string, string>} */
  const env = {};
  for (const line of text.split('\n')) {
    const t = line.trim();
    if (!t || t.startsWith('#')) continue;
    const i = t.indexOf('=');
    if (i < 0) continue;
    env[t.slice(0, i).trim()] = t.slice(i + 1).trim();
  }
  return env;
}

const TABLES = [
  'property_folders',
  'folders',
  'rentals',
  'schedules',
  'call_logs',
  'customers',
  'properties',
];

async function clearTable(supabase, table) {
  const { count, error: countErr } = await supabase
    .from(table)
    .select('*', { count: 'exact', head: true });
  if (countErr) throw new Error(`${table} count: ${countErr.message}`);

  if (!count) {
    console.log(`  ${table}: 0 rows (skip)`);
    return 0;
  }

  let error;
  if (table === 'property_folders') {
    ({ error } = await supabase.from(table).delete().not('user_id', 'is', null));
  } else {
    ({ error } = await supabase.from(table).delete().gte('id', 0));
  }
  if (error) throw new Error(`${table}: ${error.message}`);

  const { count: after } = await supabase
    .from(table)
    .select('*', { count: 'exact', head: true });
  console.log(`  ${table}: ${count} → ${after ?? 0} rows`);
  return count ?? 0;
}

async function main() {
  const env = loadEnvLocal();
  const url = env.SUPABASE_URL;
  const key = env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    console.error('SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY 가 .env.local 에 없습니다.');
    process.exit(1);
  }

  const supabase = createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  console.log('Supabase 테스트 데이터 삭제 시작…');
  let total = 0;
  for (const table of TABLES) {
    total += await clearTable(supabase, table);
  }
  console.log(`완료. 삭제 대상 약 ${total}행 (테이블별 합계).`);
}

main().catch((err) => {
  console.error(err.message || err);
  process.exit(1);
});
