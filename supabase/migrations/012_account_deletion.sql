-- LandNote 회원탈퇴: 데이터 파기·익명화 + CEO 방어 + auth.users 삭제 RPC
-- Supabase SQL Editor → Run → Success 확인 후 앱 새로고침

alter table public.profiles
  add column if not exists user_type text check (user_type is null or user_type in ('SOLO', 'BUSINESS'));

-- ── 회사 자산 익명화를 위해 user_id nullable + SET NULL ──
alter table public.properties alter column user_id drop not null;
alter table public.call_logs alter column user_id drop not null;

alter table public.properties drop constraint if exists properties_user_id_fkey;
alter table public.properties
  add constraint properties_user_id_fkey
  foreign key (user_id) references auth.users(id) on delete set null;

alter table public.call_logs drop constraint if exists call_logs_user_id_fkey;
alter table public.call_logs
  add constraint call_logs_user_id_fkey
  foreign key (user_id) references auth.users(id) on delete set null;

-- ── 탈퇴 가능 여부 (CEO + 남은 직원) ──
create or replace function public.can_delete_my_account()
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  uid uuid := auth.uid();
  v_company_id uuid;
  v_role text;
  v_user_type text;
  v_other_members int;
begin
  if uid is null then
    return jsonb_build_object('allowed', false, 'code', 'NOT_AUTHENTICATED', 'reason', '로그인이 필요합니다.');
  end if;

  select p.company_id, p.user_type, cm.role
  into v_company_id, v_user_type, v_role
  from public.profiles p
  left join public.company_members cm
    on cm.user_id = p.id and cm.company_id = p.company_id
  where p.id = uid;

  if v_user_type = 'SOLO' or v_role = 'SOLO' or v_company_id = uid then
    return jsonb_build_object('allowed', true, 'code', 'OK', 'reason', null, 'account_kind', 'SOLO');
  end if;

  if v_role = 'CEO' and v_company_id is not null then
    select count(*) into v_other_members
    from public.company_members cm
    where cm.company_id = v_company_id and cm.user_id <> uid;

    if v_other_members > 0 then
      return jsonb_build_object(
        'allowed', false,
        'code', 'CEO_HAS_MEMBERS',
        'reason', '소속된 직원이 있어 탈퇴할 수 없습니다. 대표 권한을 위임하거나 직원을 먼저 정리해 주세요.',
        'account_kind', 'BUSINESS',
        'member_count', v_other_members
      );
    end if;
  end if;

  return jsonb_build_object(
    'allowed', true,
    'code', 'OK',
    'reason', null,
    'account_kind', coalesce(v_user_type, 'BUSINESS'),
    'role', v_role
  );
end;
$$;

-- ── 탈퇴 전 데이터 정리 ──
create or replace function public.prepare_user_data_for_deletion(p_user_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_company_id uuid;
  v_user_type text;
  v_role text;
  v_is_solo boolean;
  v_check jsonb;
begin
  if p_user_id is null then
    raise exception 'USER_ID_REQUIRED';
  end if;

  if auth.uid() is distinct from p_user_id then
    raise exception 'FORBIDDEN';
  end if;

  v_check := public.can_delete_my_account();
  if not coalesce((v_check->>'allowed')::boolean, false) then
    raise exception '%', coalesce(v_check->>'code', 'DELETE_NOT_ALLOWED');
  end if;

  select p.company_id, p.user_type, cm.role
  into v_company_id, v_user_type, v_role
  from public.profiles p
  left join public.company_members cm
    on cm.user_id = p.id and cm.company_id = p.company_id
  where p.id = p_user_id;

  v_is_solo := coalesce(v_user_type, 'SOLO') = 'SOLO'
    or v_role = 'SOLO'
    or (v_company_id is not null and v_company_id = p_user_id);

  delete from public.property_folders where user_id = p_user_id;
  delete from public.schedules where user_id = p_user_id;
  delete from public.rentals where user_id = p_user_id;
  delete from public.folders where user_id = p_user_id;
  delete from public.customers where user_id = p_user_id;
  delete from public.sharing_policies
  where grantor_user_id = p_user_id or grantee_user_id = p_user_id;
  delete from public.company_invites
  where invited_by = p_user_id or accepted_by = p_user_id;

  if v_is_solo then
    delete from public.properties
    where user_id = p_user_id or company_id = v_company_id;
    delete from public.call_logs
    where user_id = p_user_id or company_id = v_company_id;
    delete from public.company_members where user_id = p_user_id;
    if v_company_id is not null then
      delete from public.companies where id = v_company_id;
    end if;
  else
    update public.properties
    set user_id = null, updated_at = now()
    where user_id = p_user_id;

    update public.call_logs
    set user_id = null, updated_at = now()
    where user_id = p_user_id;

    delete from public.company_members where user_id = p_user_id;

    if v_role = 'CEO' and v_company_id is not null then
      delete from public.companies where id = v_company_id;
    end if;
  end if;
end;
$$;

-- ── 회원탈퇴 (auth.users 삭제 → profiles 등 cascade) ──
create or replace function public.delete_my_account()
returns void
language plpgsql
security definer
set search_path = public, auth
as $$
declare
  uid uuid := auth.uid();
begin
  if uid is null then
    raise exception 'NOT_AUTHENTICATED';
  end if;

  perform public.prepare_user_data_for_deletion(uid);

  delete from auth.users where id = uid;
end;
$$;

grant execute on function public.can_delete_my_account() to authenticated;
grant execute on function public.delete_my_account() to authenticated;

comment on function public.delete_my_account is
  '회원탈퇴: 개인 데이터 삭제, 회사 매물·통화 익명화(user_id NULL), CEO+직원 있으면 차단';

notify pgrst, 'reload schema';
