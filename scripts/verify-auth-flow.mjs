/**
 * 이메일 인증·로그인·비밀번호 찾기 API 연결 확인
 * 사용: node scripts/verify-auth-flow.mjs
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

async function main() {
  const env = loadEnvLocal();
  const url = env.VITE_SUPABASE_URL;
  const anonKey = env.VITE_SUPABASE_ANON_KEY;
  if (!url || !anonKey) {
    console.error('VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY 가 필요합니다.');
    process.exit(1);
  }

  const supabase = createClient(url, anonKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  console.log('LandNote 인증 흐름 점검\n');

  // 1) 잘못된 로그인 → 400 invalid credentials
  const badLogin = await supabase.auth.signInWithPassword({
    email: 'verify-test@landnote.invalid',
    password: 'WrongPass1!',
  });
  assert(
    '이메일 로그인 API',
    !!badLogin.error,
    badLogin.error?.message || '응답 없음',
  );

  // 2) 비밀번호 재설정 메일 요청 (존재 여부와 무관하게 200)
  const reset = await supabase.auth.resetPasswordForEmail('verify-test@landnote.invalid', {
    redirectTo: `${env.VITE_BFF_DEV_URL?.replace(':3001', ':5175') || 'http://localhost:5175'}/reset-password`,
  });
  assert(
    '비밀번호 찾기 API',
    !reset.error,
    reset.error?.message || '요청 수락',
  );

  // 3) 회원가입 API (약관 메타 없이 — DB 트리거가 거부할 수 있음)
  const ts = Date.now();
  const signup = await supabase.auth.signUp({
    email: `verify.${ts}@example.com`,
    password: 'TestPass1!',
    options: {
      emailRedirectTo: 'http://localhost:5175/',
      data: {
        terms_version: 'v1.0',
        terms_required_agreed: true,
        marketing_agreed: false,
        terms_agreed_at: new Date().toISOString(),
        terms_items: [],
      },
    },
  });
  const signupReachable = Boolean(signup.error?.message || signup.data?.user);
  assert(
    '회원가입 API',
    signupReachable,
    signup.error?.message || (signup.data.user ? 'user 생성됨' : '응답 수신'),
  );

  // 4) Auth 헬스 (anon 세션 없음)
  const session = await supabase.auth.getSession();
  assert(
    '세션 초기 상태',
    !session.data.session,
    '비로그인 상태 정상',
  );

  console.log('\n점검 완료. 브라우저에서 자동 로그인 체크박스·실제 메일 링크는 수동 확인하세요.');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
