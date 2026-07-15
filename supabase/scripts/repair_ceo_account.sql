-- secret1120@naver.com 계정 진단 + 대표(CEO) 권한 복구
-- Supabase Dashboard → SQL Editor → 붙여넣기 → Run
--
-- ⚠️ 실행 전 1단계(진단) 결과를 확인한 뒤, 상황에 맞는 복구 블록만 실행하세요.

-- ── 1. 진단: 현재 상태 확인 ──
select
  u.id as user_id,
  u.email,
  u.raw_user_meta_data->>'invite_token' as signup_invite_token,
  u.raw_user_meta_data->>'company_name' as signup_company_name,
  u.raw_user_meta_data->>'user_type' as signup_user_type,
  p.role as profile_role,
  p.user_type,
  p.company_id,
  p.agency_name,
  cm.role as member_role,
  c.name as company_name
from auth.users u
left join public.profiles p on p.id = u.id
left join public.company_members cm on cm.user_id = u.id and cm.company_id = p.company_id
left join public.companies c on c.id = p.company_id
where lower(u.email) = 'secret1120@naver.com';

-- 해당 이메일로 발급된 초대가 있었는지
select id, invited_email, role, token, accepted_at, expires_at, created_at
from public.company_invites
where lower(invited_email) = 'secret1120@naver.com'
order by created_at desc;

-- ── 2-A. 복구: 잘못 합류한 직원 → 새 회사 대표(CEO)로 승격 ──
-- (다른 회사에 MEMBER로 들어간 경우, 본인 회사를 새로 개설)
-- 아래 '여기에_회사명' 을 실제 회사명으로 바꾸세요.

/*
do $$
declare
  v_user_id uuid;
  v_old_company uuid;
  v_new_company uuid;
  v_company_name text := '여기에_회사명';
begin
  select u.id, p.company_id into v_user_id, v_old_company
  from auth.users u
  join public.profiles p on p.id = u.id
  where lower(u.email) = 'secret1120@naver.com';

  if v_user_id is null then
    raise exception 'USER_NOT_FOUND';
  end if;

  delete from public.company_members
  where user_id = v_user_id and company_id = v_old_company;

  update public.profiles
  set company_id = null, role = null, updated_at = now()
  where id = v_user_id;

  v_new_company := public.create_company_for_user(v_user_id, v_company_name, null);
  raise notice 'CEO company created: %', v_new_company;
end $$;
*/

-- ── 2-B. 대안: 계정 삭제 후 /signup 에서 CEO로 재가입 ──
-- 앱 설정 → 회원탈퇴 후, 브라우저 시크릿 창에서
-- http://localhost:5175/signup → 「회사·팀으로 시작」+ 회사명 입력
-- (초대 링크 /signup/invite 는 사용하지 마세요)
