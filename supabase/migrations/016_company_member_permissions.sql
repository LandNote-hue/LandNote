-- 016: CEO 중앙 직원 권한 (매물·일정·통화 × 보기/쓰기)
-- sharing_policies(개인→개인)와 병행. CEO가 멤버별 권한을 토글하면 즉시 RLS에 반영.

create table if not exists public.company_member_permissions (
  company_id uuid not null references public.companies(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  read_properties boolean not null default false,
  write_properties boolean not null default false,
  read_schedules boolean not null default false,
  write_schedules boolean not null default false,
  read_calls boolean not null default false,
  write_calls boolean not null default false,
  updated_at timestamptz not null default now(),
  primary key (company_id, user_id)
);

create index if not exists idx_cmp_company on public.company_member_permissions(company_id);

alter table public.company_member_permissions enable row level security;

-- 멤버는 본인 권한 행만 조회, CEO는 회사 전체 관리
drop policy if exists cmp_select on public.company_member_permissions;
create policy cmp_select on public.company_member_permissions
  for select to authenticated
  using (
    user_id = auth.uid()
    or (
      company_id = public.current_company_id()
      and public.is_company_ceo()
    )
  );

drop policy if exists cmp_ceo_all on public.company_member_permissions;
create policy cmp_ceo_all on public.company_member_permissions
  for all to authenticated
  using (
    company_id = public.current_company_id()
    and public.is_company_ceo()
  )
  with check (
    company_id = public.current_company_id()
    and public.is_company_ceo()
    and user_id <> auth.uid()
  );

-- 신규 팀원 가입 시 권한 행 자동 생성 (CEO 제외, 기본 전부 OFF)
create or replace function public.ensure_member_permissions_row()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.role <> 'CEO' then
    insert into public.company_member_permissions (company_id, user_id)
    values (new.company_id, new.user_id)
    on conflict (company_id, user_id) do nothing;
  end if;
  return new;
end;
$$;

drop trigger if exists ensure_member_permissions_on_join on public.company_members;
create trigger ensure_member_permissions_on_join
  after insert on public.company_members
  for each row execute function public.ensure_member_permissions_row();

-- 기존 멤버 백필
insert into public.company_member_permissions (company_id, user_id)
select cm.company_id, cm.user_id
from public.company_members cm
where cm.role <> 'CEO'
on conflict (company_id, user_id) do nothing;

-- CEO가 부여한 회사 내 타인 데이터 열람 권한
create or replace function public.has_member_read_grant(p_owner_user_id uuid, p_resource text)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.company_member_permissions cmp
    where cmp.company_id = public.current_company_id()
      and cmp.user_id = auth.uid()
      and p_owner_user_id <> auth.uid()
      and (
        (p_resource = 'properties' and cmp.read_properties)
        or (p_resource = 'schedules' and cmp.read_schedules)
        or (p_resource = 'call_logs' and cmp.read_calls)
      )
  );
$$;

create or replace function public.has_member_write_grant(p_owner_user_id uuid, p_resource text)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.company_member_permissions cmp
    where cmp.company_id = public.current_company_id()
      and cmp.user_id = auth.uid()
      and p_owner_user_id <> auth.uid()
      and (
        (p_resource = 'properties' and cmp.write_properties)
        or (p_resource = 'schedules' and cmp.write_schedules)
        or (p_resource = 'call_logs' and cmp.write_calls)
      )
  );
$$;

-- RLS 헬퍼 갱신 (sharing_policies + CEO 중앙 권한)
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
      or public.has_member_read_grant(p_user_id, p_resource)
    );
$$;

create or replace function public.can_write_shareable_row(
  p_user_id uuid,
  p_company_id uuid,
  p_resource text default 'properties'
)
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
      or public.has_member_write_grant(p_user_id, p_resource)
    );
$$;

-- 내 권한 조회 (프론트 동적 UI)
create or replace function public.get_my_member_permissions()
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_company_id uuid;
  v_role text;
  v_row public.company_member_permissions%rowtype;
begin
  v_company_id := public.current_company_id();
  if v_company_id is null then
    return null;
  end if;

  v_role := public.current_member_role();

  if v_role = 'CEO' then
    return jsonb_build_object(
      'read_properties', true,
      'write_properties', true,
      'read_schedules', true,
      'write_schedules', true,
      'read_calls', true,
      'write_calls', true
    );
  end if;

  select * into v_row
  from public.company_member_permissions cmp
  where cmp.company_id = v_company_id and cmp.user_id = auth.uid();

  if not found then
    return jsonb_build_object(
      'read_properties', false,
      'write_properties', false,
      'read_schedules', false,
      'write_schedules', false,
      'read_calls', false,
      'write_calls', false
    );
  end if;

  return jsonb_build_object(
    'read_properties', v_row.read_properties,
    'write_properties', v_row.write_properties,
    'read_schedules', v_row.read_schedules,
    'write_schedules', v_row.write_schedules,
    'read_calls', v_row.read_calls,
    'write_calls', v_row.write_calls
  );
end;
$$;

-- CEO 대시보드: 팀원 + 권한 매트릭스
create or replace function public.list_member_permissions_dashboard()
returns table (
  user_id uuid,
  display_name text,
  email text,
  role text,
  joined_at timestamptz,
  read_properties boolean,
  write_properties boolean,
  read_schedules boolean,
  write_schedules boolean,
  read_calls boolean,
  write_calls boolean
)
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_company_id uuid;
begin
  v_company_id := public.current_company_id();
  if v_company_id is null or not public.is_company_ceo() then
    raise exception 'FORBIDDEN';
  end if;

  return query
  select
    cm.user_id,
    coalesce(p.display_name, split_part(u.email, '@', 1)) as display_name,
    u.email::text,
    cm.role::text,
    cm.created_at as joined_at,
    coalesce(cmp.read_properties, false),
    coalesce(cmp.write_properties, false),
    coalesce(cmp.read_schedules, false),
    coalesce(cmp.write_schedules, false),
    coalesce(cmp.read_calls, false),
    coalesce(cmp.write_calls, false)
  from public.company_members cm
  join auth.users u on u.id = cm.user_id
  left join public.profiles p on p.id = cm.user_id
  left join public.company_member_permissions cmp
    on cmp.company_id = cm.company_id and cmp.user_id = cm.user_id
  where cm.company_id = v_company_id
    and cm.role <> 'CEO'
  order by cm.created_at asc;
end;
$$;

-- CEO: 권한 토글 (즉시 저장)
create or replace function public.set_member_permission(
  p_user_id uuid,
  p_permission text,
  p_enabled boolean
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_company_id uuid;
  v_read_col text;
begin
  v_company_id := public.current_company_id();
  if v_company_id is null or not public.is_company_ceo() then
    raise exception 'FORBIDDEN';
  end if;

  if p_user_id = auth.uid() then
    raise exception 'CANNOT_EDIT_SELF';
  end if;

  if not exists (
    select 1 from public.company_members
    where company_id = v_company_id and user_id = p_user_id and role <> 'CEO'
  ) then
    raise exception 'MEMBER_NOT_FOUND';
  end if;

  insert into public.company_member_permissions (company_id, user_id)
  values (v_company_id, p_user_id)
  on conflict (company_id, user_id) do nothing;

  case p_permission
    when 'read_properties' then
      update public.company_member_permissions
      set read_properties = p_enabled, updated_at = now()
      where company_id = v_company_id and user_id = p_user_id;
      if not p_enabled then
        update public.company_member_permissions
        set write_properties = false, updated_at = now()
        where company_id = v_company_id and user_id = p_user_id;
      end if;
    when 'write_properties' then
      update public.company_member_permissions
      set write_properties = p_enabled,
          read_properties = case when p_enabled then true else read_properties end,
          updated_at = now()
      where company_id = v_company_id and user_id = p_user_id;
    when 'read_schedules' then
      update public.company_member_permissions
      set read_schedules = p_enabled, updated_at = now()
      where company_id = v_company_id and user_id = p_user_id;
      if not p_enabled then
        update public.company_member_permissions
        set write_schedules = false, updated_at = now()
        where company_id = v_company_id and user_id = p_user_id;
      end if;
    when 'write_schedules' then
      update public.company_member_permissions
      set write_schedules = p_enabled,
          read_schedules = case when p_enabled then true else read_schedules end,
          updated_at = now()
      where company_id = v_company_id and user_id = p_user_id;
    when 'read_calls' then
      update public.company_member_permissions
      set read_calls = p_enabled, updated_at = now()
      where company_id = v_company_id and user_id = p_user_id;
      if not p_enabled then
        update public.company_member_permissions
        set write_calls = false, updated_at = now()
        where company_id = v_company_id and user_id = p_user_id;
      end if;
    when 'write_calls' then
      update public.company_member_permissions
      set write_calls = p_enabled,
          read_calls = case when p_enabled then true else read_calls end,
          updated_at = now()
      where company_id = v_company_id and user_id = p_user_id;
    else
      raise exception 'INVALID_PERMISSION';
  end case;

  return (
    select jsonb_build_object(
      'read_properties', read_properties,
      'write_properties', write_properties,
      'read_schedules', read_schedules,
      'write_schedules', write_schedules,
      'read_calls', read_calls,
      'write_calls', write_calls
    )
    from public.company_member_permissions
    where company_id = v_company_id and user_id = p_user_id
  );
end;
$$;

grant execute on function public.get_my_member_permissions() to authenticated;
grant execute on function public.list_member_permissions_dashboard() to authenticated;
grant execute on function public.set_member_permission(uuid, text, boolean) to authenticated;
