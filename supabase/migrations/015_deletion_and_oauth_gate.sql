-- 탈퇴 시 약관 이력 삭제 + OAuth 미완료(약관 없이 워크스페이스만 있는) 프로필 정리

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

  delete from public.user_terms_consents where user_id = p_user_id;
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

-- OAuth 가입 절차 우회로 생성된 워크스페이스(약관 미동의) 정리 — 재가입 시 가입 화면 유도
create or replace function public.complete_oauth_registration(
  p_terms_version text,
  p_terms_required_agreed boolean,
  p_marketing_agreed boolean default false,
  p_terms_agreed_at timestamptz default null,
  p_terms_items jsonb default '[]'::jsonb,
  p_user_type text default 'SOLO',
  p_display_name text default null,
  p_company_name text default null,
  p_invite_token text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  uid uuid := auth.uid();
  v_user_type text;
  v_display_name text;
  v_company_name text;
  v_invite text;
  v_company_id uuid;
  v_profile public.profiles%rowtype;
begin
  if uid is null then
    raise exception 'NOT_AUTHENTICATED';
  end if;

  if not coalesce(p_terms_required_agreed, false) then
    raise exception 'TERMS_REQUIRED';
  end if;

  if nullif(trim(p_terms_version), '') is null then
    raise exception 'TERMS_VERSION_REQUIRED';
  end if;

  select * into v_profile from public.profiles where id = uid;
  if not found then
    raise exception 'PROFILE_NOT_FOUND';
  end if;

  if coalesce(v_profile.terms_required_agreed, false) and v_profile.company_id is not null then
    raise exception 'REGISTRATION_ALREADY_COMPLETE';
  end if;

  v_user_type := upper(coalesce(nullif(trim(p_user_type), ''), 'SOLO'));
  if v_user_type not in ('SOLO', 'BUSINESS') then
    v_user_type := 'SOLO';
  end if;

  v_display_name := coalesce(
    nullif(trim(p_display_name), ''),
    v_profile.display_name,
    split_part((select email from auth.users where id = uid), '@', 1)
  );

  v_company_name := nullif(trim(p_company_name), '');
  v_invite := nullif(trim(p_invite_token), '');

  update public.profiles
  set
    display_name = v_display_name,
    terms_version = p_terms_version,
    terms_required_agreed = true,
    marketing_agreed = coalesce(p_marketing_agreed, false),
    terms_agreed_at = coalesce(p_terms_agreed_at, now()),
    user_type = case when v_invite is not null then 'BUSINESS' else v_user_type end,
    updated_at = now()
  where id = uid;

  insert into public.user_terms_consents (
    user_id, terms_version, terms_required_agreed, marketing_agreed,
    agreed_at, terms_items, signup_method
  )
  values (
    uid, p_terms_version, true, coalesce(p_marketing_agreed, false),
    coalesce(p_terms_agreed_at, now()), coalesce(p_terms_items, '[]'::jsonb), 'oauth'
  );

  if v_invite is not null then
    v_company_id := public.accept_company_invite_for_user(uid, v_invite);
    update public.profiles set user_type = 'BUSINESS', updated_at = now() where id = uid;
  elsif v_user_type = 'BUSINESS' then
    if v_company_name is null then
      raise exception 'COMPANY_NAME_REQUIRED';
    end if;
    v_company_id := public.create_company_for_user(uid, v_company_name, v_display_name);
    update public.profiles set agency_name = v_company_name, updated_at = now() where id = uid;
  else
    v_company_id := public.create_solo_workspace_for_user(uid, v_display_name);
  end if;

  return jsonb_build_object(
    'ok', true,
    'company_id', v_company_id,
    'user_type', case when v_invite is not null then 'BUSINESS' else v_user_type end
  );
end;
$$;

notify pgrst, 'reload schema';
