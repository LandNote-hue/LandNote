/**
 * 탈퇴 계정 잔존 데이터 점검
 * 사용: node scripts/verify-account-deleted.mjs topaz.ran@gmail.com
 */
import { readFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createClient } from '@supabase/supabase-js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = resolve(__dirname, '..');

function loadEnvLocal() {
  const text = readFileSync(resolve(root, '.env.local'), 'utf8');
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

function assert(name, ok, detail = '') {
  const mark = ok ? '✓' : '✗';
  console.log(`  ${mark} ${name}${detail ? ` — ${detail}` : ''}`);
  return ok;
}

async function findAuthUserByEmail(admin, email) {
  let page = 1;
  const target = email.trim().toLowerCase();
  while (page <= 20) {
    const { data, error } = await admin.auth.admin.listUsers({ page, perPage: 200 });
    if (error) throw error;
    const users = data?.users ?? [];
    const hit = users.find((u) => (u.email || '').toLowerCase() === target);
    if (hit) return hit;
    if (users.length < 200) break;
    page += 1;
  }
  return null;
}

async function countByUserId(admin, table, userId) {
  const { count, error } = await admin
    .from(table)
    .select('*', { count: 'exact', head: true })
    .eq('user_id', userId);
  if (error) return { error: error.message, count: null };
  return { count: count ?? 0 };
}

async function main() {
  const email = process.argv[2]?.trim().toLowerCase();
  if (!email) {
    console.error('사용: node scripts/verify-account-deleted.mjs <email>');
    process.exit(1);
  }

  const env = loadEnvLocal();
  const url = env.VITE_SUPABASE_URL || env.SUPABASE_URL;
  const key = env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    console.error('SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY 필요');
    process.exit(1);
  }

  const admin = createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const ref = url.match(/https:\/\/([^.]+)\.supabase\.co/)?.[1];
  console.log(`LandNote 탈퇴 계정 점검: ${email}`);
  console.log(`프로젝트: ${ref ?? '?'}\n`);

  let allOk = true;

  const authUser = await findAuthUserByEmail(admin, email);
  allOk = assert('auth.users (Auth 계정)', !authUser, authUser ? `존재 — id=${authUser.id}` : '없음') && allOk;

  if (authUser) {
    const uid = authUser.id;
    console.log('\n  연관 데이터 (user_id 기준):');
    for (const table of [
      'profiles', 'properties', 'customers', 'call_logs', 'schedules',
      'rentals', 'folders', 'company_members', 'user_terms_consents',
    ]) {
      const { count, error } = await countByUserId(admin, table, uid);
      if (error) {
        assert(`  ${table}`, false, error);
        allOk = false;
      } else {
        allOk = assert(`  ${table}`, count === 0, `${count}행`) && allOk;
      }
    }

    const { count: pfCount } = await admin
      .from('property_folders')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', uid);
    allOk = assert('  property_folders', (pfCount ?? 0) === 0, `${pfCount ?? 0}행`) && allOk;

    const { data: profile } = await admin.from('profiles').select('company_id, user_type, role').eq('id', uid).maybeSingle();
    if (profile?.company_id) {
      const cid = profile.company_id;
      const soloWs = cid === uid;
      console.log(`\n  company_id=${cid} (${soloWs ? 'SOLO 워크스페이스' : 'BUSINESS'})`);
      if (soloWs) {
        const { count: coCount } = await admin.from('companies').select('*', { count: 'exact', head: true }).eq('id', cid);
        allOk = assert('  companies (SOLO)', (coCount ?? 0) === 0, `${coCount ?? 0}행`) && allOk;
      }
    }
  } else {
    console.log('\n  Auth 계정 없음 → profiles 등은 id 없이 이메일만으로는 추가 조회 불가.');
    console.log('  (탈퇴 처리 정상 시 auth.users·profiles cascade 삭제됨)\n');

    const { data: rpcCheck, error: rpcErr } = await admin.rpc('can_delete_my_account');
    if (rpcErr && /schema cache|could not find/i.test(rpcErr.message)) {
      assert('012 RPC (can_delete_my_account)', false, '미설치');
    } else if (rpcErr) {
      assert('012 RPC', true, '설치됨 (비로그인 호출은 세션 없음)');
    } else {
      assert('012 RPC', true, '설치됨');
    }
  }

  console.log('\n' + (allOk && !authUser
    ? '결론: Auth 계정이 삭제되어 탈퇴 처리된 것으로 보입니다.'
    : allOk
      ? '결론: 계정·연관 데이터가 남아 있습니다. 추가 정리가 필요합니다.'
      : '결론: 일부 데이터가 남아 있거나 RPC 미설치 상태입니다.'));
  process.exit(allOk && !authUser ? 0 : 1);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
