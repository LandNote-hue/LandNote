-- LandNote B2B 1단계: 조직(Company/Workspace) + profiles.company_id
-- 회원가입 시 회사 생성, 가입자를 owner 로 company_members 에 등록
-- 이후 RBAC(roles/permissions) 확장의 기반

-- ── 조직(워크스paces) ──
create table if not exists public.companies (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  slug text not null unique,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint companies_name_not_empty check (char_length(trim(name)) > 0)
);

create index if not exists companies_created_by_idx on public.companies(created_by);

-- ── 멤버십 (RBAC 2단계에서 role_permissions 연결 예정) ──
create table if not exists public.company_members (
  company_id uuid not null references public.companies(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  role text not null default 'owner'
    check (role in ('owner', 'admin', 'member')),
  joined_at timestamptz not null default now(),
  primary key (company_id, user_id)
);

create index if not exists company_members_user_id_idx on public.company_members(user_id);

-- ── 사용자(profiles) → 조직 ──
-- Supabase auth.users 는 직접 ALTER 불가 → profiles.company_id 로 연결
alter table public.profiles
  add column if not exists company_id uuid references public.companies(id) on delete set null;

create index if not exists profiles_company_id_idx on public.profiles(company_id);

-- ── slug 유틸 ──
create or replace function public.make_company_slug(base_name text)
returns text
language plpgsql
as $$
declare
  cleaned text;
  candidate text;
  suffix int := 0;
begin
  cleaned := lower(regexp_replace(trim(coalesce(base_name, 'workspace')), '[^a-zA-Z0-9가-힣]+', '-', 'g'));
  cleaned := regexp_replace(cleaned, '(^-+|-+$)', '', 'g');
  if cleaned = '' then
    cleaned := 'workspace';
  end if;
  candidate := cleaned;
  while exists (select 1 from public.companies c where c.slug = candidate) loop
    suffix := suffix + 1;
    candidate := cleaned || '-' || suffix::text;
  end loop;
  return candidate;
end;
$$;

-- ── 회사 생성 + 멤버 owner 등록 (트리거·백필·레거시 계정용) ──
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

  select company_id into v_company_id
  from public.profiles
  where id = p_user_id;

  if v_company_id is not null then
    return v_company_id;
  end if;

  v_name := nullif(trim(coalesce(p_company_name, '')), '');
  if v_name is null then
    v_name := coalesce(nullif(trim(p_display_name), ''), '내') || ' 워크스페이스';
  end if;

  v_slug := public.make_company_slug(v_name);

  insert into public.companies (name, slug, created_by)
  values (v_name, v_slug, p_user_id)
  returning id into v_company_id;

  insert into public.company_members (company_id, user_id, role)
  values (v_company_id, p_user_id, 'owner')
  on conflict (company_id, user_id) do nothing;

  update public.profiles
  set company_id = v_company_id, updated_at = now()
  where id = p_user_id;

  return v_company_id;
end;
$$;

-- ── RLS ──
alter table public.companies enable row level security;
alter table public.company_members enable row level security;

drop policy if exists "companies_select_member" on public.companies;
create policy "companies_select_member" on public.companies
  for select using (
    exists (
      select 1 from public.company_members cm
      where cm.company_id = companies.id and cm.user_id = auth.uid()
    )
  );

drop policy if exists "company_members_select_own_company" on public.company_members;
create policy "company_members_select_own_company" on public.company_members
  for select using (
    user_id = auth.uid()
    or exists (
      select 1 from public.company_members cm
      where cm.company_id = company_members.company_id
        and cm.user_id = auth.uid()
    )
  );

-- profiles: company_id 조회는 기존 own 정책으로 충분

-- ── 가입 트리거: profiles + 약관 + 회사 생성 ──
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
  v_company_id uuid;
begin
  meta := coalesce(new.raw_user_meta_data, '{}'::jsonb);
  required_agreed := coalesce((meta->>'terms_required_agreed')::boolean, false);
  marketing := coalesce((meta->>'marketing_agreed')::boolean, false);
  terms_ver := nullif(trim(meta->>'terms_version'), '');
  signup_method := case when new.encrypted_password is not null then 'email' else 'oauth' end;

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
    id,
    display_name,
    agency_name,
    terms_version,
    terms_required_agreed,
    marketing_agreed,
    terms_agreed_at
  )
  values (
    new.id,
    display_name,
    coalesce(company_name, meta->>'agency_name'),
    terms_ver,
    required_agreed,
    marketing,
    agreed_at
  );

  if required_agreed and terms_ver is not null then
    insert into public.user_terms_consents (
      user_id,
      terms_version,
      terms_required_agreed,
      marketing_agreed,
      agreed_at,
      terms_items,
      signup_method
    )
    values (
      new.id,
      terms_ver,
      true,
      marketing,
      coalesce(agreed_at, now()),
      coalesce(meta->'terms_items', '[]'::jsonb),
      signup_method
    );
  end if;

  v_company_id := public.create_company_for_user(new.id, company_name, display_name);

  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ── 기존 계정 백필 (company_id 없는 profiles) ──
do $$
declare
  rec record;
begin
  for rec in
    select p.id, p.display_name, p.agency_name
    from public.profiles p
    where p.company_id is null
  loop
    perform public.create_company_for_user(
      rec.id,
      rec.agency_name,
      rec.display_name
    );
  end loop;
end $$;

-- ── 레거시·OAuth 사용자: 로그인 시 company 없으면 생성 (본인만) ──
create or replace function public.ensure_my_company(p_company_name text default null)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  uid uuid := auth.uid();
  display_name text;
begin
  if uid is null then
    raise exception 'NOT_AUTHENTICATED';
  end if;

  select p.display_name into display_name
  from public.profiles p
  where p.id = uid;

  return public.create_company_for_user(uid, p_company_name, display_name);
end;
$$;

grant execute on function public.ensure_my_company(text) to authenticated;

comment on table public.companies is 'B2B 워크스페이스(조직). 1단계: 가입 시 자동 생성';
comment on column public.profiles.company_id is '소속 조직. auth.users 대신 profiles 에 FK';
comment on table public.company_members is '조직 멤버 및 역할(owner/admin/member). RBAC 2단계 확장 예정';
