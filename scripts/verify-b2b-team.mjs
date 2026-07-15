/**
 * B2B 팀 초대·조직 RPC 스키마 및 E2E 흐름 점검
 * 사용: node scripts/verify-b2b-team.mjs
 * 필요: .env.local — VITE_SUPABASE_URL, VITE_SUPABASE_ANON_KEY, SUPABASE_SERVICE_ROLE_KEY
 *
 * 참고: RPC는 authenticated 역할에만 GRANT 되어 있어 service_role로는
 * PostgREST 스키마 캐시에 노출되지 않습니다. RPC 검증은 로그인 세션으로 수행합니다.
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

function formatAuthError(err) {
  if (!err) return '알 수 없는 오류';
  const parts = [err.message, err.code, err.status != null ? `HTTP ${err.status}` : ''].filter(Boolean);
  return parts.join(' — ') || err.name || 'Auth API 오류';
}

function assert(name, ok, detail = '') {
  const mark = ok ? '✓' : '✗';
  console.log(`  ${mark} ${name}${detail ? ` — ${detail}` : ''}`);
  return ok;
}

const TERMS_META = {
  terms_version: 'v1.0',
  terms_required_agreed: true,
  marketing_agreed: false,
  terms_agreed_at: new Date().toISOString(),
  terms_items: [],
};

/** @param {import('@supabase/supabase-js').SupabaseClient} client */
async function probeRpc(client, name, args) {
  const { error } = await client.rpc(name, args);
  if (!error) return { exists: true, detail: '호출 가능' };
  if (/could not find the function|schema cache/i.test(error.message)) {
    return { exists: false, detail: error.message };
  }
  return { exists: true, detail: error.message };
}

async function checkTables(admin, url) {
  console.log('1) 테이블 스키마 확인\n');

  const projectRef = url?.match(/https:\/\/([^.]+)\.supabase\.co/)?.[1];
  if (projectRef) {
    console.log(`  연결 프로젝트: ${projectRef}\n`);
  }

  const tables = ['companies', 'company_members', 'company_invites', 'sharing_policies'];
  let ok = true;
  for (const table of tables) {
    const { error } = await admin.from(table).select('*', { count: 'exact', head: true });
    ok = assert(`테이블 ${table}`, !error, error?.message || '접근 가능') && ok;
  }

  const { error: profileColErr } = await admin.from('profiles').select('company_id, role').limit(1);
  ok = assert(
    'profiles.company_id / role 컬럼 (007)',
    !profileColErr,
    profileColErr?.message || '존재',
  ) && ok;

  return ok;
}

/** @param {import('@supabase/supabase-js').SupabaseClient} admin */
async function cleanupUser(admin, userId) {
  if (!userId) return;
  await admin.auth.admin.deleteUser(userId);
}

/** @param {import('@supabase/supabase-js').SupabaseClient} authClient */
async function checkInviteRpcs(authClient) {
  console.log('\n2) RPC 확인 (CEO 로그인 세션)\n');

  let ok = true;
  const base = await probeRpc(authClient, 'is_company_ceo');
  ok = assert('RPC is_company_ceo', base.exists, base.detail) && ok;

  for (const rpc of ['list_company_team', 'list_pending_invites']) {
    const probe = await probeRpc(authClient, rpc);
    ok = assert(`RPC ${rpc}`, probe.exists, probe.detail) && ok;
  }

  const inviteProbe = await probeRpc(authClient, 'create_company_invite', {
    p_email: '__probe__@invalid.local',
    p_role: 'MEMBER',
  });
  ok = assert('RPC create_company_invite', inviteProbe.exists, inviteProbe.detail) && ok;

  const acceptProbe = await probeRpc(authClient, 'accept_company_invite', { p_token: '__invalid__' });
  ok = assert('RPC accept_company_invite', acceptProbe.exists, acceptProbe.detail) && ok;

  return ok;
}

async function runE2E(url, anonKey, admin) {
  console.log('\n3) 팀 초대 E2E (CEO → 초대 → 멤버 가입)\n');

  const ts = Date.now();
  const ceoEmail = `b2b.ceo.${ts}@landnote.test`;
  const memberEmail = `b2b.member.${ts}@landnote.test`;
  const password = 'TestPass1!';

  /** @type {string[]} */
  const createdUserIds = [];
  let rpcOk = false;
  let flowOk = false;

  try {
    const { data: ceoData, error: ceoCreateErr } = await admin.auth.admin.createUser({
      email: ceoEmail,
      password,
      email_confirm: true,
      user_metadata: {
        ...TERMS_META,
        company_name: `테스트법인-${ts}`,
      },
    });
    if (ceoCreateErr) {
      assert('CEO 계정 생성', false, formatAuthError(ceoCreateErr));
      const authBlocked = /rate limit|too many|429/i.test(formatAuthError(ceoCreateErr));
      const triggerError = ceoCreateErr.status === 500;
      return { rpcOk: false, flowOk: false, profileMissing: false, authBlocked, triggerError, schemaOnlyOk: false };
    }
    const ceoId = ceoData.user.id;
    createdUserIds.push(ceoId);
    assert('CEO 계정 생성', true, ceoEmail);

    const { data: ceoProfile, error: profileErr } = await admin
      .from('profiles')
      .select('company_id, role')
      .eq('id', ceoId)
      .single();
    if (profileErr || !ceoProfile?.company_id) {
      assert('CEO 회사 자동 생성', false, profileErr?.message || 'company_id 없음');
      return { rpcOk: false, flowOk: false, profileMissing: /company_id does not exist/i.test(profileErr?.message || '') };
    }
    assert('CEO 회사 자동 생성', true, `company_id=${ceoProfile.company_id.slice(0, 8)}…`);
    assert('CEO 역할', ceoProfile.role === 'CEO', ceoProfile.role || '역할 없음');

    const ceoClient = createClient(url, anonKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
    const { error: signInErr } = await ceoClient.auth.signInWithPassword({
      email: ceoEmail,
      password,
    });
    if (signInErr) {
      assert('CEO 로그인', false, signInErr.message);
      return { rpcOk: false, flowOk: false };
    }
    assert('CEO 로그인', true);

    rpcOk = await checkInviteRpcs(ceoClient);
    if (!rpcOk) {
      return { rpcOk: false, flowOk: false };
    }

    console.log('\n4) 초대·합류 흐름\n');

    const { data: inviteRows, error: inviteErr } = await ceoClient.rpc('create_company_invite', {
      p_email: memberEmail,
      p_role: 'MEMBER',
    });
    if (inviteErr) {
      assert('초대 생성', false, inviteErr.message);
      return { rpcOk: true, flowOk: false };
    }
    const inviteRow = Array.isArray(inviteRows) ? inviteRows[0] : inviteRows;
    const token = inviteRow?.token ?? inviteRow?.invite_token;
    if (!token) {
      assert('초대 토큰 수신', false, JSON.stringify(inviteRows));
      return { rpcOk: true, flowOk: false };
    }
    assert('초대 생성', true, `token=${token.slice(0, 8)}…`);

    const { data: pending, error: pendingErr } = await ceoClient.rpc('list_pending_invites');
    assert(
      '대기 초대 목록',
      !pendingErr && Array.isArray(pending) && pending.length >= 1,
      pendingErr?.message || `${pending?.length ?? 0}건`,
    );

    const { data: memberData, error: memberCreateErr } = await admin.auth.admin.createUser({
      email: memberEmail,
      password,
      email_confirm: true,
      user_metadata: {
        ...TERMS_META,
        invite_token: token,
      },
    });
    if (memberCreateErr) {
      assert('초대 멤버 가입', false, memberCreateErr.message);
      return { rpcOk: true, flowOk: false };
    }
    const memberId = memberData.user.id;
    createdUserIds.push(memberId);
    assert('초대 멤버 가입', true, memberEmail);

    const { data: memberProfile, error: memberProfileErr } = await admin
      .from('profiles')
      .select('company_id, role')
      .eq('id', memberId)
      .single();
    const sameCompany = memberProfile?.company_id === ceoProfile.company_id;
    assert(
      '멤버 회사 합류',
      !memberProfileErr && sameCompany,
      memberProfileErr?.message || (sameCompany ? '동일 company_id' : 'company_id 불일치'),
    );
    assert('멤버 역할', memberProfile?.role === 'MEMBER', memberProfile?.role || '역할 없음');

    const { data: team, error: teamErr } = await ceoClient.rpc('list_company_team');
    const teamCount = Array.isArray(team) ? team.length : 0;
    assert(
      '팀원 목록 (CEO)',
      !teamErr && teamCount >= 2,
      teamErr?.message || `${teamCount}명`,
    );

    flowOk = sameCompany && teamCount >= 2;
    return { rpcOk, flowOk };
  } finally {
    console.log('\n5) 테스트 계정 정리\n');
    for (const uid of createdUserIds.reverse()) {
      try {
        await cleanupUser(admin, uid);
        assert('계정 삭제', true, uid.slice(0, 8) + '…');
      } catch (err) {
        assert('계정 삭제', false, err?.message || String(err));
      }
    }
  }
}

async function main() {
  const env = loadEnvLocal();
  const url = env.VITE_SUPABASE_URL || env.SUPABASE_URL;
  const anonKey = env.VITE_SUPABASE_ANON_KEY;
  const serviceKey = env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !anonKey) {
    console.error('VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY 가 필요합니다.');
    process.exit(1);
  }
  if (!serviceKey) {
    console.error('E2E 테스트에는 SUPABASE_SERVICE_ROLE_KEY 가 .env.local 에 필요합니다.');
    process.exit(1);
  }

  const admin = createClient(url, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  console.log('LandNote B2B 팀 초대 점검\n');

  const tablesOk = await checkTables(admin, url);
  if (!tablesOk) {
    console.log('\n⚠ B2B 마이그레이션이 불완전합니다.');
    console.log('   profiles.company_id 가 없으면 007부터 적용하세요:');
    console.log('   supabase/migrations/007_companies_rbac_foundation.sql');
    console.log('   이어서 008 → 009 (또는 009_company_invites_rpc_repair.sql)');
    console.log('   (supabase/SETUP.md 2번 참고)');
    process.exit(1);
  }

  const { rpcOk, flowOk, profileMissing, authBlocked, triggerError } = await runE2E(url, anonKey, admin);

  if (profileMissing) {
    console.log('\n⚠ profiles.company_id 컬럼이 없습니다 — 007 마이그레이션 미적용.');
    console.log('   → supabase/migrations/007_companies_rbac_foundation.sql 실행 후 008, 009 순서 적용');
    process.exit(1);
  }

  if (authBlocked) {
    console.log('\n✓ DB 스키마(007~009)는 정상입니다.');
    console.log('⚠ Auth 테스트 계정 생성이 rate limit 등으로 차단되어 E2E는 생략되었습니다.');
    console.log('   잠시 후 npm run verify:b2b 재시도, 또는 브라우저에서 직접 확인하세요.');
    process.exit(0);
  }

  if (triggerError) {
    console.log('\n✓ DB 스키마(007~009) 테이블·컬럼은 정상입니다.');
    console.log('⚠ 테스트 계정 생성 시 HTTP 500 — handle_new_user 트리거 오류 가능성');
    console.log('   Supabase Dashboard → Logs → Postgres 에서 signup 시 에러 확인');
    console.log('   브라우저에서 회원가입(회사명 입력)을 시도해 보세요.');
    process.exit(1);
  }

  if (!rpcOk) {
    console.log('\n⚠ RPC가 authenticated 세션에서도 보이지 않습니다.');
    console.log('   → supabase/migrations/009_company_invites_rpc_repair.sql 실행');
    console.log('   SQL Editor 에러 메시지가 있었다면 공유해 주세요.');
    process.exit(1);
  }

  console.log('\n' + (flowOk ? '점검 완료 — B2B 팀 초대 흐름 정상' : 'RPC는 정상, E2E 일부 실패 — 위 ✗ 항목 확인'));
  console.log('브라우저 수동 확인: 설정 → 팀 초대 패널, 공유 정책 패널');
  process.exit(flowOk ? 0 : 1);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
