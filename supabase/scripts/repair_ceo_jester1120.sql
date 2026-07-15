-- jester1120@naver.com (또는 다른 이메일) CEO 복구
-- Supabase Dashboard → SQL Editor → 1단계 진단 후 2단계 실행

-- ── 1. 진단 ──
select
  u.email,
  u.raw_user_meta_data->>'invite_token' as signup_invite_token,
  u.raw_user_meta_data->>'company_name' as signup_company_name,
  p.role as profile_role,
  cm.role as member_role,
  c.name as joined_company
from auth.users u
left join public.profiles p on p.id = u.id
left join public.company_members cm on cm.user_id = u.id and cm.company_id = p.company_id
left join public.companies c on c.id = p.company_id
where lower(u.email) = 'jester1120@naver.com';

select invited_email, role, accepted_at, created_at
from public.company_invites
where lower(invited_email) = 'jester1120@naver.com'
order by created_at desc;

-- ── 2. CEO 복구 (회사명을 실제 상호로 바꾼 뒤 주석 해제·Run) ──
/*
do $$
declare
  v_user_id uuid;
  v_old_company uuid;
  v_company_name text := '여기에_회사명';
begin
  select u.id, p.company_id into v_user_id, v_old_company
  from auth.users u
  join public.profiles p on p.id = u.id
  where lower(u.email) = 'jester1120@naver.com';

  if v_user_id is null then
    raise exception 'USER_NOT_FOUND';
  end if;

  delete from public.company_members where user_id = v_user_id;

  update public.profiles
  set company_id = null, role = null, updated_at = now()
  where id = v_user_id;

  perform public.create_company_for_user(v_user_id, v_company_name, null);
end $$;
*/

-- 실행 후: 로그아웃 → 재로그인 → 설정 → 「대표(CEO)」 확인 → /team/manage
