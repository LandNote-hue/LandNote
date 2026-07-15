/**
 * 가입·역할 진단 (단일 이메일)
 * 사용: node scripts/diagnose-signup-account.mjs secret1120@naver.com
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

async function findUserByEmail(admin, email) {
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

async function main() {
  const email = process.argv[2]?.trim().toLowerCase();
  if (!email) {
    console.error('사용: node scripts/diagnose-signup-account.mjs <email>');
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

  console.log(`\n=== 가입 진단: ${email} ===\n`);

  const user = await findUserByEmail(admin, email);
  if (!user) {
    console.log('auth.users: 없음 (미가입 또는 탈퇴)');
    const { data: inv } = await admin
      .from('company_invites')
      .select('id, invited_email, role, accepted_at, expires_at, company_id')
      .ilike('invited_email', email);
    console.log('company_invites (이메일):', inv?.length ? inv : '없음');
    process.exit(0);
  }

  const meta = user.raw_user_meta_data ?? {};
  console.log('auth.users.id:', user.id);
  console.log('email_confirmed:', !!user.email_confirmed_at);
  console.log('provider:', user.app_metadata?.provider ?? 'email');
  console.log('user_metadata:', {
    user_type: meta.user_type,
    company_name: meta.company_name,
    agency_name: meta.agency_name,
    invite_token: meta.invite_token ? '(있음)' : null,
    display_name: meta.display_name,
    website: meta.website,
    terms_required_agreed: meta.terms_required_agreed,
  });

  const { data: profile } = await admin
    .from('profiles')
    .select('id, role, user_type, company_id, agency_name, display_name, terms_required_agreed, terms_version')
    .eq('id', user.id)
    .maybeSingle();
  console.log('\nprofiles:', profile);

  if (profile?.company_id) {
    const { data: company } = await admin
      .from('companies')
      .select('id, name, slug, created_by, representative_id')
      .eq('id', profile.company_id)
      .maybeSingle();
    console.log('companies:', company);
  }

  const { data: members } = await admin
    .from('company_members')
    .select('company_id, role')
    .eq('user_id', user.id);
  console.log('company_members:', members);

  const { data: invites } = await admin
    .from('company_invites')
    .select('id, invited_email, role, accepted_at, accepted_by, expires_at')
    .ilike('invited_email', email);
  console.log('company_invites (이메일):', invites?.length ? invites : '없음');

  const { data: consents } = await admin
    .from('user_terms_consents')
    .select('signup_method, terms_version, agreed_at')
    .eq('user_id', user.id)
    .order('agreed_at', { ascending: false })
    .limit(3);
  console.log('user_terms_consents:', consents);

  // handle_new_user CEO 가드(019) 적용 여부 — 소스에 invite+company_name 가드 문자열 존재 확인은 DB에서 함수 정의 조회 불가(postgrest)
  console.log('\n--- 해석 ---');
  if (!profile?.company_id) {
    console.log('⚠ company_id 없음 → 가입 미완료(OAuth) 또는 회사 생성 실패');
  } else if (members?.some((m) => m.role === 'CEO')) {
    console.log('✓ CEO 역할');
  } else if (members?.some((m) => m.role === 'MEMBER' || m.role === 'MANAGER')) {
    console.log('⚠ 직원(MEMBER/MANAGER)으로 합류됨 — 초대 링크·pendingInvite·019 미적용 의심');
  } else {
    console.log('⚠ company_id 있으나 company_members 역할 불명');
  }
  if (meta.website && String(meta.website).includes('@')) {
    console.log('⚠ user_metadata.website에 이메일 형식 값 저장됨 (브라우저 자동완성→저장 가능)');
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
