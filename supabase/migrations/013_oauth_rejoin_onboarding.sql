-- OAuth(구글) 로그인: 약관·유형 선택 전까지 워크스페이스 생성 보류
-- 탈퇴(Hard Delete) 후 동일 구글 계정 재로그인 → 신규 auth.users + 가입 완료 RPC 필요

-- ── 가입 트리거: OAuth는 약관 동의 전 프로필 스텁만 ──
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  meta jsonb;
  agreed_at timestamptz;
  required_agreed boolean;
  marketing boolean;
  terms_ver text;
  signup_method text;
  display_name text;
  company_name text;
  invite_token text;
  user_type text;
  v_company_id uuid;
begin
  meta := coalesce(new.raw_user_meta_data, '{}'::jsonb);
  required_agreed := coalesce((meta->>'terms_required_agreed')::boolean, false);
  marketing := coalesce((meta->>'marketing_agreed')::boolean, false);
  terms_ver := nullif(trim(meta->>'terms_version'), '');
  signup_method := case when new.encrypted_password is not null then 'email' else 'oauth' end;
  invite_token := nullif(trim(meta->>'invite_token'), '');
  user_type := upper(coalesce(nullif(trim(meta->>'user_type'), ''), 'SOLO'));
  if user_type not in ('SOLO', 'BUSINESS') then
    user_type := 'SOLO';
  end if;

  agreed_at := case
    when meta ? 'terms_agreed_at' and nullif(trim(meta->>'terms_agreed_at'), '') is not null
      then (meta->>'terms_agreed_at')::timestamptz
    else null
  end;

  display_name := coalesce(
    nullif(trim(meta->>'display_name'), ''),
    meta->>'full_name',
    meta->>'name',
    split_part(new.email, '@', 1)
  );

  company_name := nullif(trim(meta->>'company_name'), '');

  insert into public.profiles (
    id, display_name, agency_name,
    terms_version, terms_required_agreed, marketing_agreed, terms_agreed_at,
    user_type
  )
  values (
    new.id, display_name, coalesce(company_name, meta->>'agency_name'),
    terms_ver, required_agreed, marketing, agreed_at,
    case when invite_token is not null then 'BUSINESS' else user_type end
  )
  on conflict (id) do update set
    display_name = excluded.display_name,
    agency_name = coalesce(excluded.agency_name, public.profiles.agency_name),
    terms_version = coalesce(excluded.terms_version, public.profiles.terms_version),
    terms_required_agreed = coalesce(excluded.terms_required_agreed, public.profiles.terms_required_agreed),
    marketing_agreed = excluded.marketing_agreed,
    terms_agreed_at = coalesce(excluded.terms_agreed_at, public.profiles.terms_agreed_at),
    user_type = coalesce(excluded.user_type, public.profiles.user_type),
    updated_at = now();

  -- OAuth 로그인(약관 미동의): 프로필 스텁만 — 워크스페이스·약관 이력은 complete_oauth_registration 에서
  if signup_method = 'oauth' and not required_agreed then
    return new;
  end if;

  if required_agreed and terms_ver is not null then
    insert into public.user_terms_consents (
      user_id, terms_version, terms_required_agreed, marketing_agreed,
      agreed_at, terms_items, signup_method
    )
    values (
      new.id, terms_ver, true, marketing,
      coalesce(agreed_at, now()), coalesce(meta->'terms_items', '[]'::jsonb), signup_method
    );
  end if;

  if invite_token is not null then
    v_company_id := public.accept_company_invite_for_user(new.id, invite_token);
    update public.profiles set user_type = 'BUSINESS', updated_at = now() where id = new.id;
    return new;
  end if;

  if user_type = 'BUSINESS' then
    v_company_id := public.create_company_for_user(new.id, company_name, display_name);
  else
    v_company_id := public.create_solo_workspace_for_user(new.id, display_name);
  end if;

  return new;
exception
  when others then
    raise exception 'SIGNUP_FAILED: %', SQLERRM;
end;
$$;

-- ── OAuth 가입 완료 (약관 + SOLO/BUSINESS/초대) ──
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

  if v_profile.company_id is not null and coalesce(v_profile.terms_required_agreed, false) then
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

-- ── OAuth 가입 중 이탈: 미완료 auth.users 정리 ──
create or replace function public.abandon_incomplete_registration()
returns void
language plpgsql
security definer
set search_path = public, auth
as $$
declare
  uid uuid := auth.uid();
  v_profile public.profiles%rowtype;
begin
  if uid is null then
    raise exception 'NOT_AUTHENTICATED';
  end if;

  select * into v_profile from public.profiles where id = uid;

  if not found then
    delete from auth.users where id = uid;
    return;
  end if;

  if v_profile.company_id is not null
    and coalesce(v_profile.terms_required_agreed, false) then
    raise exception 'REGISTRATION_ALREADY_COMPLETE';
  end if;

  delete from auth.users where id = uid;
end;
$$;

grant execute on function public.complete_oauth_registration(
  text, boolean, boolean, timestamptz, jsonb, text, text, text, text
) to authenticated;
grant execute on function public.abandon_incomplete_registration() to authenticated;

comment on function public.complete_oauth_registration is
  '구글 OAuth 가입 완료: 약관 동의 + SOLO/BUSINESS/팀 초대 워크스페이스 생성';
comment on function public.abandon_incomplete_registration is
  'OAuth 가입 미완료 이탈 시 auth.users 삭제 (프로필 cascade)';

notify pgrst, 'reload schema';
