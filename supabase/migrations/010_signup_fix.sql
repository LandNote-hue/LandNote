-- 가입 실패(HTTP 500 / {} 오류) 복구
-- 007 재실행 후 create_company_for_user 가 role 'owner' 로 되돌아가면
-- 008 역할 제약(CEO/MANAGER/MEMBER)과 충돌하여 가입 트리거가 실패합니다.
-- SQL Editor에서 Run → Success 확인 후 회원가입 재시도

-- ── 역할 제약 (008) ──
alter table public.company_members drop constraint if exists company_members_role_check;
update public.company_members set role = 'CEO' where role = 'owner';
update public.company_members set role = 'MANAGER' where role = 'admin';
update public.company_members set role = 'MEMBER' where role = 'member';
alter table public.company_members
  add constraint company_members_role_check
  check (role in ('CEO', 'MANAGER', 'MEMBER'));

alter table public.companies
  add column if not exists representative_id uuid references auth.users(id) on delete set null;

-- ── CEO 회사 생성 (008 버전 — owner 아님) ──
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
    v_name := coalesce(nullif(trim(p_display_name), ''), '내') || ' 워크스페이스';
  end if;

  v_slug := public.make_company_slug(v_name);

  insert into public.companies (name, slug, created_by, representative_id)
  values (v_name, v_slug, p_user_id, p_user_id)
  returning id into v_company_id;

  insert into public.company_members (company_id, user_id, role)
  values (v_company_id, p_user_id, 'CEO')
  on conflict (company_id, user_id) do update set role = excluded.role;

  update public.profiles
  set company_id = v_company_id, role = 'CEO', updated_at = now()
  where id = p_user_id;

  return v_company_id;
end;
$$;

-- ── 가입 트리거 (009 — profiles 중복·초대 토큰) ──
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
  v_company_id uuid;
begin
  meta := coalesce(new.raw_user_meta_data, '{}'::jsonb);
  required_agreed := coalesce((meta->>'terms_required_agreed')::boolean, false);
  marketing := coalesce((meta->>'marketing_agreed')::boolean, false);
  terms_ver := nullif(trim(meta->>'terms_version'), '');
  signup_method := case when new.encrypted_password is not null then 'email' else 'oauth' end;
  invite_token := nullif(trim(meta->>'invite_token'), '');

  agreed_at := case
    when meta ? 'terms_agreed_at' and nullif(trim(meta->>'terms_agreed_at'), '') is not null
      then (meta->>'terms_agreed_at')::timestamptz
    else null
  end;

  display_name := coalesce(
    meta->>'full_name',
    meta->>'name',
    split_part(new.email, '@', 1)
  );

  company_name := nullif(trim(meta->>'company_name'), '');

  insert into public.profiles (
    id, display_name, agency_name,
    terms_version, terms_required_agreed, marketing_agreed, terms_agreed_at
  )
  values (
    new.id, display_name, coalesce(company_name, meta->>'agency_name'),
    terms_ver, required_agreed, marketing, agreed_at
  )
  on conflict (id) do update set
    display_name = excluded.display_name,
    agency_name = coalesce(excluded.agency_name, public.profiles.agency_name),
    terms_version = coalesce(excluded.terms_version, public.profiles.terms_version),
    terms_required_agreed = coalesce(excluded.terms_required_agreed, public.profiles.terms_required_agreed),
    marketing_agreed = excluded.marketing_agreed,
    terms_agreed_at = coalesce(excluded.terms_agreed_at, public.profiles.terms_agreed_at),
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
    return new;
  end if;

  v_company_id := public.create_company_for_user(new.id, company_name, display_name);
  return new;
exception
  when others then
    raise exception 'SIGNUP_FAILED: %', SQLERRM;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

notify pgrst, 'reload schema';
