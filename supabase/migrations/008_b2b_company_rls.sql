-- LandNote B2B 2단계: company_id on data + RBAC RLS + sharing_policies
-- 역할: CEO(대표) | MANAGER(팀장) | MEMBER(일반)
-- 고객(customers): MEMBER는 본인만, CEO는 회사 전체
-- 매물/일정/통화: CEO 회사 전체, MEMBER/MANAGER는 본인 + sharing_policies

-- ── 역할 체계 정리 (owner/admin/member → CEO/MANAGER/MEMBER) ──
alter table public.company_members drop constraint if exists company_members_role_check;

update public.company_members set role = 'CEO' where role = 'owner';
update public.company_members set role = 'MANAGER' where role = 'admin';
update public.company_members set role = 'MEMBER' where role = 'member';

alter table public.company_members
  add constraint company_members_role_check
  check (role in ('CEO', 'MANAGER', 'MEMBER'));

-- companies: 대표자(CEO) 참조
alter table public.companies
  add column if not exists representative_id uuid references auth.users(id) on delete set null;

update public.companies c
set representative_id = coalesce(
  c.representative_id,
  c.created_by,
  (select cm.user_id from public.company_members cm
   where cm.company_id = c.id and cm.role = 'CEO' limit 1)
);

-- profiles: 역할 캐시 (조회 편의, canonical 은 company_members)
alter table public.profiles
  add column if not exists role text check (role is null or role in ('CEO', 'MANAGER', 'MEMBER'));

update public.profiles p
set role = cm.role
from public.company_members cm
where cm.user_id = p.id and cm.company_id = p.company_id and p.role is distinct from cm.role;

-- ── 선택적 공유 (고객 정보는 공유 불가 — 컬럼 없음) ──
create table if not exists public.sharing_policies (
  id bigint generated always as identity primary key,
  company_id uuid not null references public.companies(id) on delete cascade,
  grantor_user_id uuid not null references auth.users(id) on delete cascade,
  grantee_user_id uuid not null references auth.users(id) on delete cascade,
  share_properties boolean not null default false,
  share_calls boolean not null default false,
  share_schedules boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint sharing_policies_distinct_users check (grantor_user_id <> grantee_user_id),
  constraint sharing_policies_unique_pair unique (company_id, grantor_user_id, grantee_user_id)
);

create index if not exists sharing_policies_grantee_idx
  on public.sharing_policies(company_id, grantee_user_id);

alter table public.sharing_policies enable row level security;

-- ── 데이터 테이블: company_id ──
alter table public.properties
  add column if not exists company_id uuid references public.companies(id) on delete cascade;
alter table public.customers
  add column if not exists company_id uuid references public.companies(id) on delete cascade;
alter table public.call_logs
  add column if not exists company_id uuid references public.companies(id) on delete cascade;
alter table public.schedules
  add column if not exists company_id uuid references public.companies(id) on delete cascade;
alter table public.rentals
  add column if not exists company_id uuid references public.companies(id) on delete cascade;
alter table public.folders
  add column if not exists company_id uuid references public.companies(id) on delete cascade;

create index if not exists properties_company_id_idx on public.properties(company_id);
create index if not exists customers_company_id_idx on public.customers(company_id);
create index if not exists call_logs_company_id_idx on public.call_logs(company_id);
create index if not exists schedules_company_id_idx on public.schedules(company_id);

-- user_id → profiles.company_id 백필
update public.properties t
set company_id = p.company_id
from public.profiles p
where t.user_id = p.id and t.company_id is null and p.company_id is not null;

update public.customers t
set company_id = p.company_id
from public.profiles p
where t.user_id = p.id and t.company_id is null and p.company_id is not null;

update public.call_logs t
set company_id = p.company_id
from public.profiles p
where t.user_id = p.id and t.company_id is null and p.company_id is not null;

update public.schedules t
set company_id = p.company_id
from public.profiles p
where t.user_id = p.id and t.company_id is null and p.company_id is not null;

update public.rentals t
set company_id = p.company_id
from public.profiles p
where t.user_id = p.id and t.company_id is null and p.company_id is not null;

update public.folders t
set company_id = p.company_id
from public.profiles p
where t.user_id = p.id and t.company_id is null and p.company_id is not null;

-- ── RBAC 헬퍼 ──
create or replace function public.current_company_id()
returns uuid
language sql
stable
security definer
set search_path = public
as $$
  select company_id from public.profiles where id = auth.uid();
$$;

create or replace function public.current_member_role()
returns text
language sql
stable
security definer
set search_path = public
as $$
  select cm.role
  from public.company_members cm
  inner join public.profiles p on p.id = auth.uid() and p.company_id = cm.company_id
  where cm.user_id = auth.uid()
  limit 1;
$$;

create or replace function public.is_company_ceo()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select public.current_member_role() = 'CEO';
$$;

create or replace function public.is_company_manager()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select public.current_member_role() in ('CEO', 'MANAGER');
$$;

create or replace function public.has_share_grant(p_owner_user_id uuid, p_resource text)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.sharing_policies sp
    where sp.company_id = public.current_company_id()
      and sp.grantor_user_id = p_owner_user_id
      and sp.grantee_user_id = auth.uid()
      and (
        (p_resource = 'properties' and sp.share_properties)
        or (p_resource = 'call_logs' and sp.share_calls)
        or (p_resource = 'schedules' and sp.share_schedules)
      )
  );
$$;

create or replace function public.can_read_shareable_row(p_user_id uuid, p_company_id uuid, p_resource text)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select
    p_company_id is not null
    and p_company_id = public.current_company_id()
    and (
      public.is_company_ceo()
      or p_user_id = auth.uid()
      or public.has_share_grant(p_user_id, p_resource)
    );
$$;

create or replace function public.can_write_shareable_row(p_user_id uuid, p_company_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select
    p_company_id is not null
    and p_company_id = public.current_company_id()
    and (public.is_company_ceo() or p_user_id = auth.uid());
$$;

-- ── create_company_for_user: CEO 역할 ──
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

-- profiles.role 동기화 트리거
create or replace function public.sync_profile_role_from_member()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.profiles
  set role = new.role, company_id = new.company_id, updated_at = now()
  where id = new.user_id;
  return new;
end;
$$;

drop trigger if exists sync_profile_role_on_member on public.company_members;
create trigger sync_profile_role_on_member
  after insert or update of role, company_id on public.company_members
  for each row execute function public.sync_profile_role_from_member();

-- ── 기존 RLS 정책 제거 ──
drop policy if exists "properties_own" on public.properties;
drop policy if exists "customers_own" on public.customers;
drop policy if exists "call_logs_own" on public.call_logs;
drop policy if exists "schedules_own" on public.schedules;
drop policy if exists "rentals_own" on public.rentals;
drop policy if exists "folders_own" on public.folders;
drop policy if exists "property_folders_own" on public.property_folders;

-- ── properties RLS ──
create policy "properties_select_rbac" on public.properties
  for select using (
    public.can_read_shareable_row(user_id, company_id, 'properties')
  );

create policy "properties_insert_rbac" on public.properties
  for insert with check (
    user_id = auth.uid()
    and company_id = public.current_company_id()
  );

create policy "properties_update_rbac" on public.properties
  for update using (
    public.can_write_shareable_row(user_id, company_id)
  ) with check (
    public.can_write_shareable_row(user_id, company_id)
    and company_id = public.current_company_id()
  );

create policy "properties_delete_rbac" on public.properties
  for delete using (
    public.can_write_shareable_row(user_id, company_id)
  );

-- ── customers RLS (MEMBER: 본인만 / CEO: 회사 전체) ──
create policy "customers_select_rbac" on public.customers
  for select using (
    company_id = public.current_company_id()
    and (user_id = auth.uid() or public.is_company_ceo())
  );

create policy "customers_insert_rbac" on public.customers
  for insert with check (
    user_id = auth.uid()
    and company_id = public.current_company_id()
  );

create policy "customers_update_rbac" on public.customers
  for update using (
    company_id = public.current_company_id()
    and (user_id = auth.uid() or public.is_company_ceo())
  ) with check (
    company_id = public.current_company_id()
    and (user_id = auth.uid() or public.is_company_ceo())
  );

create policy "customers_delete_rbac" on public.customers
  for delete using (
    company_id = public.current_company_id()
    and (user_id = auth.uid() or public.is_company_ceo())
  );

-- ── call_logs RLS ──
create policy "call_logs_select_rbac" on public.call_logs
  for select using (
    public.can_read_shareable_row(user_id, company_id, 'call_logs')
  );

create policy "call_logs_insert_rbac" on public.call_logs
  for insert with check (
    user_id = auth.uid() and company_id = public.current_company_id()
  );

create policy "call_logs_update_rbac" on public.call_logs
  for update using (public.can_write_shareable_row(user_id, company_id))
  with check (public.can_write_shareable_row(user_id, company_id) and company_id = public.current_company_id());

create policy "call_logs_delete_rbac" on public.call_logs
  for delete using (public.can_write_shareable_row(user_id, company_id));

-- ── schedules RLS ──
create policy "schedules_select_rbac" on public.schedules
  for select using (
    public.can_read_shareable_row(user_id, company_id, 'schedules')
  );

create policy "schedules_insert_rbac" on public.schedules
  for insert with check (
    user_id = auth.uid() and company_id = public.current_company_id()
  );

create policy "schedules_update_rbac" on public.schedules
  for update using (public.can_write_shareable_row(user_id, company_id))
  with check (public.can_write_shareable_row(user_id, company_id) and company_id = public.current_company_id());

create policy "schedules_delete_rbac" on public.schedules
  for delete using (public.can_write_shareable_row(user_id, company_id));

-- ── rentals / folders (properties 와 동일 패턴) ──
create policy "rentals_select_rbac" on public.rentals
  for select using (
    company_id = public.current_company_id()
    and (
      public.is_company_ceo()
      or user_id = auth.uid()
      or exists (
        select 1 from public.properties pr
        where pr.id = rentals.pid
          and public.can_read_shareable_row(pr.user_id, pr.company_id, 'properties')
      )
    )
  );

create policy "rentals_write_rbac" on public.rentals
  for all using (
    company_id = public.current_company_id() and (public.is_company_ceo() or user_id = auth.uid())
  ) with check (
    user_id = auth.uid() and company_id = public.current_company_id()
  );

create policy "folders_select_rbac" on public.folders
  for select using (
    company_id = public.current_company_id()
    and (public.is_company_ceo() or user_id = auth.uid())
  );

create policy "folders_write_rbac" on public.folders
  for all using (
    company_id = public.current_company_id() and (public.is_company_ceo() or user_id = auth.uid())
  ) with check (user_id = auth.uid() and company_id = public.current_company_id());

create policy "property_folders_select_rbac" on public.property_folders
  for select using (
    user_id = auth.uid() or public.is_company_ceo()
  );

create policy "property_folders_write_rbac" on public.property_folders
  for all using (user_id = auth.uid() or public.is_company_ceo())
  with check (user_id = auth.uid() or public.is_company_ceo());

-- ── sharing_policies RLS ──
create policy "sharing_policies_select" on public.sharing_policies
  for select using (
    company_id = public.current_company_id()
    and (public.is_company_manager() or grantor_user_id = auth.uid() or grantee_user_id = auth.uid())
  );

create policy "sharing_policies_manage" on public.sharing_policies
  for all using (
    company_id = public.current_company_id()
    and (public.is_company_ceo() or grantor_user_id = auth.uid())
  ) with check (
    company_id = public.current_company_id()
    and grantor_user_id = auth.uid()
  );

grant execute on function public.current_company_id() to authenticated;
grant execute on function public.current_member_role() to authenticated;
grant execute on function public.is_company_ceo() to authenticated;

comment on table public.sharing_policies is '매물/통화/일정 선택 공유. 고객(customers)은 공유 불가';
comment on column public.properties.company_id is '소속 회사. CEO는 company_id 로 전체 조회';
