-- 022: 초대 이력 조회 + 기존 회원 소속 이관

-- ── 초대 미리보기 확장: 초대 이메일·기존 회원 여부 ──
-- 018과 반환 컬럼 수가 달라 replace 불가 → drop 후 재생성
drop function if exists public.preview_company_invite(text);

create function public.preview_company_invite(p_token text)
returns table (
  company_name text,
  invite_role text,
  expires_at timestamptz,
  valid boolean,
  invited_email text,
  existing_user boolean,
  existing_has_company boolean
)
language plpgsql
security definer
stable
set search_path = public
as $$
#variable_conflict use_column
declare
  inv public.company_invites%rowtype;
  cname text;
  v_user_id uuid;
  v_company_id uuid;
begin
  if nullif(trim(p_token), '') is null then
    return query select null::text, null::text, null::timestamptz, false, null::text, false, false;
    return;
  end if;

  select * into inv
  from public.company_invites
  where token = trim(p_token)
    and accepted_at is null
    and expires_at > now()
  limit 1;

  if inv.id is null then
    return query select null::text, null::text, null::timestamptz, false, null::text, false, false;
    return;
  end if;

  select c.name into cname
  from public.companies c
  where c.id = inv.company_id;

  select u.id into v_user_id
  from auth.users u
  where lower(trim(u.email)) = lower(trim(inv.invited_email))
  limit 1;

  v_company_id := null;
  if v_user_id is not null then
    select p.company_id into v_company_id
    from public.profiles p
    where p.id = v_user_id;
  end if;

  return query select
    coalesce(nullif(trim(cname), ''), '회사'),
    inv.role,
    inv.expires_at,
    true,
    inv.invited_email,
    v_user_id is not null,
    v_company_id is not null;
end;
$$;

revoke all on function public.preview_company_invite(text) from public;
grant execute on function public.preview_company_invite(text) to anon, authenticated;

-- ── CEO: 초대 진행 이력 (이메일당 최종 발송 1건만) ──
create or replace function public.list_company_invite_history()
returns table (
  id uuid,
  invited_email text,
  role text,
  token text,
  created_at timestamptz,
  expires_at timestamptz,
  accepted_at timestamptz,
  status text
)
language sql
stable
security definer
set search_path = public
as $$
  select
    x.id,
    x.invited_email,
    x.role,
    x.token,
    x.created_at,
    x.expires_at,
    x.accepted_at,
    x.status
  from (
    select distinct on (lower(trim(i.invited_email)))
      i.id,
      i.invited_email,
      i.role,
      i.token,
      i.created_at,
      i.expires_at,
      i.accepted_at,
      case
        when i.accepted_at is not null then 'accepted'
        when i.expires_at <= now() then 'expired'
        else 'pending'
      end as status
    from public.company_invites i
    where i.company_id = public.current_company_id()
      and public.is_company_manager()
    order by lower(trim(i.invited_email)), i.created_at desc
  ) x
  order by x.created_at desc;
$$;

grant execute on function public.list_company_invite_history() to authenticated;

-- ── 기존 회원 소속 이관 (초대 수락) ──
create or replace function public.transfer_company_invite_for_user(p_user_id uuid, p_token text)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  inv public.company_invites%rowtype;
  user_email text;
  v_old_company uuid;
  v_old_role text;
  v_other_members int;
begin
  if p_user_id is null or nullif(trim(p_token), '') is null then
    raise exception 'INVITE_INVALID';
  end if;

  select email into user_email from auth.users where id = p_user_id;
  if user_email is null then
    raise exception 'USER_NOT_FOUND';
  end if;

  select * into inv
  from public.company_invites
  where token = trim(p_token)
    and accepted_at is null
    and expires_at > now()
  limit 1;

  if inv.id is null then
    raise exception 'INVITE_INVALID';
  end if;

  if lower(trim(inv.invited_email)) <> lower(trim(user_email)) then
    raise exception 'INVITE_EMAIL_MISMATCH';
  end if;

  select company_id, role into v_old_company, v_old_role
  from public.profiles
  where id = p_user_id;

  if v_old_company is null then
    return public.accept_company_invite_for_user(p_user_id, p_token);
  end if;

  if v_old_company = inv.company_id then
    raise exception 'ALREADY_IN_THIS_COMPANY';
  end if;

  if v_old_role = 'CEO' then
    select count(*)::int into v_other_members
    from public.company_members cm
    where cm.company_id = v_old_company
      and cm.user_id <> p_user_id;

    if v_other_members > 0 then
      raise exception 'CEO_HAS_MEMBERS';
    end if;
  end if;

  delete from public.company_member_permissions
  where company_id = v_old_company and user_id = p_user_id;

  delete from public.company_members
  where company_id = v_old_company and user_id = p_user_id;

  insert into public.company_members (company_id, user_id, role)
  values (inv.company_id, p_user_id, inv.role)
  on conflict (company_id, user_id) do update set role = excluded.role;

  update public.profiles
  set
    company_id = inv.company_id,
    role = inv.role,
    user_type = 'BUSINESS',
    updated_at = now()
  where id = p_user_id;

  update public.company_invites
  set accepted_at = now(), accepted_by = p_user_id
  where id = inv.id;

  return inv.company_id;
exception
  when others then
    raise;
end;
$$;

create or replace function public.transfer_company_invite(p_token text)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
begin
  return public.transfer_company_invite_for_user(auth.uid(), p_token);
end;
$$;

grant execute on function public.transfer_company_invite_for_user(uuid, text) to authenticated;
grant execute on function public.transfer_company_invite(text) to authenticated;

comment on function public.list_company_invite_history() is
  'CEO/팀장: 회사 초대 전체 이력 (대기·가입완료·만료)';
comment on function public.transfer_company_invite(text) is
  '기존 가입 회원의 초대 수락 — profiles.company_id·role 이관 (개인 데이터는 user_id 유지)';

notify pgrst, 'reload schema';
