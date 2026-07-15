/**
 * 탈퇴 계정 잔존(고아) 데이터 정리
 * 사용: node scripts/cleanup-withdrawn-orphans.mjs [--dry-run]
 */
import { readFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createClient } from '@supabase/supabase-js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = resolve(__dirname, '..');
const dryRun = process.argv.includes('--dry-run');

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

async function listAllAuthEmails(admin) {
  /** @type {Set<string>} */
  const emails = new Set();
  /** @type {Set<string>} */
  const ids = new Set();
  let page = 1;
  while (page <= 50) {
    const { data, error } = await admin.auth.admin.listUsers({ page, perPage: 200 });
    if (error) throw error;
    const users = data?.users ?? [];
    for (const u of users) {
      ids.add(u.id);
      if (u.email) emails.add(u.email.trim().toLowerCase());
    }
    if (users.length < 200) break;
    page += 1;
  }
  return { emails, ids };
}

async function main() {
  const env = loadEnvLocal();
  const url = env.VITE_SUPABASE_URL || env.SUPABASE_URL;
  const key = env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    console.error('SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY 필요 (.env.local)');
    process.exit(1);
  }

  const admin = createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  console.log(dryRun ? '[DRY RUN] ' : '', '탈퇴 계정 고아 데이터 정리\n');

  const { emails: authEmails, ids: authIds } = await listAllAuthEmails(admin);
  console.log(`활성 auth.users: ${authIds.size}명\n`);

  const { data: invites, error: invErr } = await admin
    .from('company_invites')
    .select('id, invited_email, accepted_at, created_at');
  if (invErr) throw invErr;

  const orphanInvites = (invites ?? []).filter((row) => {
    const em = String(row.invited_email || '').trim().toLowerCase();
    return em && !authEmails.has(em);
  });

  const { data: profiles, error: profErr } = await admin.from('profiles').select('id');
  if (profErr) throw profErr;
  const orphanProfiles = (profiles ?? []).filter((p) => !authIds.has(p.id));

  const { data: members, error: memErr } = await admin.from('company_members').select('user_id, company_id');
  if (memErr) throw memErr;
  const orphanMembers = (members ?? []).filter((m) => !authIds.has(m.user_id));

  console.log(`고아 company_invites: ${orphanInvites.length}건`);
  for (const row of orphanInvites.slice(0, 20)) {
    console.log(`  - ${row.invited_email} (id=${row.id})`);
  }
  if (orphanInvites.length > 20) console.log(`  … 외 ${orphanInvites.length - 20}건`);

  console.log(`\n고아 profiles: ${orphanProfiles.length}건`);
  console.log(`고아 company_members: ${orphanMembers.length}건`);

  if (dryRun) {
    console.log('\n[DRY RUN] 삭제하지 않았습니다. 실행하려면 --dry-run 없이 다시 실행하세요.');
    return;
  }

  if (orphanInvites.length) {
    const ids = orphanInvites.map((r) => r.id);
    const { error } = await admin.from('company_invites').delete().in('id', ids);
    if (error) throw error;
    console.log(`\n삭제: company_invites ${ids.length}건`);
  }

  if (orphanMembers.length) {
    for (const row of orphanMembers) {
      const { error } = await admin
        .from('company_members')
        .delete()
        .eq('user_id', row.user_id)
        .eq('company_id', row.company_id);
      if (error) throw error;
    }
    console.log(`삭제: company_members ${orphanMembers.length}건`);
  }

  if (orphanProfiles.length) {
    const ids = orphanProfiles.map((p) => p.id);
    const { error } = await admin.from('profiles').delete().in('id', ids);
    if (error) throw error;
    console.log(`삭제: profiles ${ids.length}건`);
  }

  if (!orphanInvites.length && !orphanMembers.length && !orphanProfiles.length) {
    console.log('\n정리할 고아 데이터가 없습니다.');
  } else {
    console.log('\n완료.');
  }
}

main().catch((err) => {
  console.error(err.message || err);
  process.exit(1);
});
