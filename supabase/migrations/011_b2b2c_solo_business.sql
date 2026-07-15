-- LandNote B2B2C: 개인(SOLO) / 회사(BUSINESS) 병행 가입
-- SOLO: company_id = user_id (개인 독립 공간), role = SOLO
-- BUSINESS: companies 생성 + CEO (기존 B2B)

-- ── profiles.user_type ──
alter table public.profiles
  add column if not exists user_type text check (user_type is null or user_type in ('SOLO', 'BUSINESS'));

-- 레거시: company_id = 본인 id 이면 SOLO, 그 외 BUSINESS
update public.profiles p
set user_type = 'SOLO'
where p.user_type is null and p.company_id is not null and p.company_id = p.id;

update public.profiles p
set user_type = 'BUSINESS'
where p.user_type is null and p.company_id is not null;

-- ── 역할: SOLO 추가 ──
alter table public.company_members drop constraint if exists company_members_role_check;
alter table public.profiles drop constraint if exists profiles_role_check;

alter table public.company_members
  add constraint company_members_role_check
  check (role in ('SOLO', 'CEO', 'MANAGER', 'MEMBER'));

alter table public.profiles
  add constraint profiles_role_check
  check (role is null or role in ('SOLO', 'CEO', 'MANAGER', 'MEMBER'));

-- ── 개인(SOLO) 워크스페이스: company_id = user_id ──
create or replace function public.create_solo_workspace_for_user(
  p_user_id uuid,
  p_display_name text default null
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_name text;
  v_slug text;
  existing uuid;
begin
  if p_user_id is null then
    raise exception 'USER_ID_REQUIRED';
  end if;

  select company_id into existing from public.profiles where id = p_user_id;
  if existing is not null then
    return existing;
  end if;

  v_name := coalesce(nullif(trim(p_display_name), ''), '개인') || ' 워크스페이스';
  v_slug := public.make_company_slug('solo-' || replace(p_user_id::text, '-', ''));

  insert into public.companies (id, name, slug, created_by, representative_id)
  values (p_user_id, v_name, v_slug, p_user_id, p_user_id)
  on conflict (id) do update set
    name = excluded.name,
    updated_at = now();

  insert into public.company_members (company_id, user_id, role)
  values (p_user_id, p_user_id, 'SOLO')
  on conflict (company_id, user_id) do update set role = 'SOLO';

  update public.profiles
  set company_id = p_user_id, role = 'SOLO', user_type = 'SOLO', updated_at = now()
  where id = p_user_id;

  return p_user_id;
end;
$$;

-- ── 회사(BUSINESS) 생성 — 회사명 필수 ──
create or replace function public.create_company_for_user(
  p_user_id uuid,
  p_company_name text,
  p_display_name text default null
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_company_id uuid;
  v_name text;
  v_slug text;
begin
  if p_user_id is null then
    raise exception 'USER_ID_REQUIRED';
  end if;

  select company_id into v_company_id from public.profiles where id = p_user_id;
  if v_company_id is not null then
    return v_company_id;
  end if;

  v_name := nullif(trim(coalesce(p_company_name, '')), '');
  if v_name is null then
    raise exception 'COMPANY_NAME_REQUIRED';
  end if;

  v_slug := public.make_company_slug(v_name);

  insert into public.companies (name, slug, created_by, representative_id)
  values (v_name, v_slug, p_user_id, p_user_id)
  returning id into v_company_id;

  insert into public.company_members (company_id, user_id, role)
  values (v_company_id, p_user_id, 'CEO')
  on conflict (company_id, user_id) do update set role = excluded.role;

  update public.profiles
  set company_id = v_company_id, role = 'CEO', user_type = 'BUSINESS', updated_at = now()
  where id = p_user_id;

  return v_company_id;
end;
$$;

-- ── RBAC: SOLO는 CEO/Manager 아님 ──
create or replace function public.is_solo_user()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(
    (select user_type from public.profiles where id = auth.uid()),
    public.current_member_role()
  ) = 'SOLO'
  or public.current_member_role() = 'SOLO';
$$;

create or replace function public.is_company_ceo()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select public.current_member_role() = 'CEO'
    and not public.is_solo_user();
$$;

create or replace function public.is_company_manager()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select public.current_member_role() in ('CEO', 'MANAGER')
    and not public.is_solo_user();
$$;

-- ── 가입 트리거: user_type 분기 ──
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

grant execute on function public.is_solo_user() to authenticated;

notify pgrst, 'reload schema';
