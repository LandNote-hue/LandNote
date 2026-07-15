-- 탈퇴( auth.users 삭제 ) 후 남은 고아 데이터 일괄 정리
-- Supabase Dashboard → SQL Editor → Run

-- ── 1. 진단 ──
select 'company_invites (탈퇴 이메일)' as kind, count(*) as cnt
from public.company_invites ci
where not exists (
  select 1 from auth.users u
  where lower(trim(u.email)) = lower(trim(ci.invited_email))
);

select 'profiles (auth.users 없음)' as kind, count(*) as cnt
from public.profiles p
where not exists (select 1 from auth.users u where u.id = p.id);

select 'company_members (auth.users 없음)' as kind, count(*) as cnt
from public.company_members cm
where not exists (select 1 from auth.users u where u.id = cm.user_id);

-- ── 2. 정리 (주석 해제 후 Run) ──
/*
delete from public.company_invites ci
where not exists (
  select 1 from auth.users u
  where lower(trim(u.email)) = lower(trim(ci.invited_email))
);

delete from public.company_members cm
where not exists (select 1 from auth.users u where u.id = cm.user_id);

delete from public.profiles p
where not exists (select 1 from auth.users u where u.id = p.id);
*/
