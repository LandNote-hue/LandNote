-- 017: sharing_policies CEO 중앙 권한 모델
-- member_id + resource_type + can_view/can_edit
-- (구 grantor→grantee 피어 공유는 sharing_policies_peer_legacy 로 보존)

-- ── 1. 기존 peer-to-peer 테이블 보관 ──
drop policy if exists "sharing_policies_select" on public.sharing_policies;
drop policy if exists "sharing_policies_manage" on public.sharing_policies;

do $$
begin
  if exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'sharing_policies'
      and column_name = 'grantor_user_id'
  ) then
    alter table public.sharing_policies rename to sharing_policies_peer_legacy;
  end if;
end $$;

-- ── 2. CEO 중앙 권한 테이블 ──
create table if not exists public.sharing_policies (
  id bigint generated always as identity primary key,
  company_id uuid not null references public.companies(id) on delete cascade,
  member_id uuid not null references auth.users(id) on delete cascade,
  resource_type text not null,
  can_view boolean not null default false,
  can_edit boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint sharing_policies_resource_type_check
    check (resource_type in ('properties', 'schedules', 'call_logs')),
  constraint sharing_policies_can_edit_requires_view
    check (not can_edit or can_view),
  constraint sharing_policies_unique_member_resource
    unique (company_id, member_id, resource_type)
);

create index if not exists sharing_policies_member_idx
  on public.sharing_policies(company_id, member_id);

alter table public.sharing_policies enable row level security;

-- ── 3. company_member_permissions → sharing_policies 이관 후 제거 ──
do $$
begin
  if exists (
    select 1 from information_schema.tables
    where table_schema = 'public' and table_name = 'company_member_permissions'
  ) then
    insert into public.sharing_policies (company_id, member_id, resource_type, can_view, can_edit)
    select company_id, user_id, 'properties', read_properties, write_properties
    from public.company_member_permissions
    on conflict (company_id, member_id, resource_type) do update
      set can_view = excluded.can_view, can_edit = excluded.can_edit, updated_at = now();

    insert into public.sharing_policies (company_id, member_id, resource_type, can_view, can_edit)
    select company_id, user_id, 'schedules', read_schedules, write_schedules
    from public.company_member_permissions
    on conflict (company_id, member_id, resource_type) do update
      set can_view = excluded.can_view, can_edit = excluded.can_edit, updated_at = now();

    insert into public.sharing_policies (company_id, member_id, resource_type, can_view, can_edit)
    select company_id, user_id, 'call_logs', read_calls, write_calls
    from public.company_member_permissions
    on conflict (company_id, member_id, resource_type) do update
      set can_view = excluded.can_view, can_edit = excluded.can_edit, updated_at = now();

    drop trigger if exists ensure_member_permissions_on_join on public.company_members;
    drop table public.company_member_permissions cascade;
  end if;
end $$;

-- ── 4. RLS 헬퍼 (CEO가 부여한 회사 전체 공유) ──
create or replace function public.has_sharing_policy_view(p_resource_type text)
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
      and sp.member_id = auth.uid()
      and sp.resource_type = p_resource_type
      and sp.can_view = true
  );
$$;

create or replace function public.has_sharing_policy_edit(p_resource_type text)
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
      and sp.member_id = auth.uid()
      and sp.resource_type = p_resource_type
      and sp.can_edit = true
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
    (
      p_company_id is null
      and p_user_id = auth.uid()
    )
    or (
      p_company_id is not null
      and p_company_id = public.current_company_id()
      and (
        public.is_company_ceo()
        or p_user_id = auth.uid()
        or (
          p_user_id <> auth.uid()
          and public.has_sharing_policy_view(p_resource)
        )
      )
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
    (
      p_company_id is null
      and p_user_id = auth.uid()
    )
    or (
      p_company_id is not null
      and p_company_id = public.current_company_id()
      and (
        public.is_company_ceo()
        or p_user_id = auth.uid()
        or (
          p_user_id <> auth.uid()
          and public.has_sharing_policy_edit(p_resource)
        )
      )
    );
$$;

-- 구 has_share_grant / has_member_* 제거 (017부터 sharing_policies 단일 소스)
drop function if exists public.has_share_grant(uuid, text);
drop function if exists public.has_member_read_grant(uuid, text);
drop function if exists public.has_member_write_grant(uuid, text);

-- ── 5. properties RLS (명시적 정책) ──
drop policy if exists "properties_select_rbac" on public.properties;
drop policy if exists "properties_update_rbac" on public.properties;
drop policy if exists "properties_delete_rbac" on public.properties;

create policy "properties_select_rbac" on public.properties
  for select to authenticated
  using (
    (company_id is null and user_id = auth.uid())
    or (
      company_id = public.current_company_id()
      and (
        user_id = auth.uid()
        or public.is_company_ceo()
        or (
          public.current_member_role() in ('MEMBER', 'MANAGER')
          and user_id <> auth.uid()
          and exists (
            select 1
            from public.sharing_policies sp
            where sp.company_id = properties.company_id
              and sp.member_id = auth.uid()
              and sp.resource_type = 'properties'
              and sp.can_view = true
          )
        )
      )
    )
  );

create policy "properties_update_rbac" on public.properties
  for update to authenticated
  using (
    (company_id is null and user_id = auth.uid())
    or (
      company_id = public.current_company_id()
      and (
        user_id = auth.uid()
        or public.is_company_ceo()
        or (
          public.current_member_role() in ('MEMBER', 'MANAGER')
          and user_id <> auth.uid()
          and exists (
            select 1
            from public.sharing_policies sp
            where sp.company_id = properties.company_id
              and sp.member_id = auth.uid()
              and sp.resource_type = 'properties'
              and sp.can_edit = true
          )
        )
      )
    )
  )
  with check (
    company_id = public.current_company_id()
    and public.can_write_shareable_row(user_id, company_id, 'properties')
  );

create policy "properties_delete_rbac" on public.properties
  for delete to authenticated
  using (
    public.can_write_shareable_row(user_id, company_id, 'properties')
  );

-- call_logs / schedules UPDATE·DELETE에 resource 인자 반영
drop policy if exists "call_logs_update_rbac" on public.call_logs;
drop policy if exists "call_logs_delete_rbac" on public.call_logs;
create policy "call_logs_update_rbac" on public.call_logs
  for update using (public.can_write_shareable_row(user_id, company_id, 'call_logs'))
  with check (public.can_write_shareable_row(user_id, company_id, 'call_logs') and company_id = public.current_company_id());
create policy "call_logs_delete_rbac" on public.call_logs
  for delete using (public.can_write_shareable_row(user_id, company_id, 'call_logs'));

drop policy if exists "schedules_update_rbac" on public.schedules;
drop policy if exists "schedules_delete_rbac" on public.schedules;
create policy "schedules_update_rbac" on public.schedules
  for update using (public.can_write_shareable_row(user_id, company_id, 'schedules'))
  with check (public.can_write_shareable_row(user_id, company_id, 'schedules') and company_id = public.current_company_id());
create policy "schedules_delete_rbac" on public.schedules
  for delete using (public.can_write_shareable_row(user_id, company_id, 'schedules'));

-- ── 6. sharing_policies 테이블 RLS (대표만 쓰기, 멤버는 본인 행 조회) ──
drop policy if exists sharing_policies_select on public.sharing_policies;
drop policy if exists sharing_policies_ceo_manage on public.sharing_policies;

create policy sharing_policies_select on public.sharing_policies
  for select to authenticated
  using (
    company_id = public.current_company_id()
    and (
      member_id = auth.uid()
      or public.is_company_ceo()
    )
  );

create policy sharing_policies_ceo_manage on public.sharing_policies
  for all to authenticated
  using (
    company_id = public.current_company_id()
    and public.is_company_ceo()
  )
  with check (
    company_id = public.current_company_id()
    and public.is_company_ceo()
    and member_id <> auth.uid()
  );

-- ── 7. CEO Upsert RPC ──
create or replace function public.upsert_member_sharing_policy(
  p_member_id uuid,
  p_resource_type text,
  p_can_view boolean,
  p_can_edit boolean
)
returns public.sharing_policies
language plpgsql
security definer
set search_path = public
as $$
declare
  v_company_id uuid;
  v_row public.sharing_policies%rowtype;
  v_view boolean;
  v_edit boolean;
begin
  v_company_id := public.current_company_id();
  if v_company_id is null or not public.is_company_ceo() then
    raise exception 'FORBIDDEN';
  end if;

  if p_member_id = auth.uid() then
    raise exception 'CANNOT_EDIT_SELF';
  end if;

  if p_resource_type not in ('properties', 'schedules', 'call_logs') then
    raise exception 'INVALID_RESOURCE_TYPE';
  end if;

  if not exists (
    select 1 from public.company_members
    where company_id = v_company_id
      and user_id = p_member_id
      and role <> 'CEO'
  ) then
    raise exception 'MEMBER_NOT_FOUND';
  end if;

  v_view := coalesce(p_can_view, false);
  v_edit := coalesce(p_can_edit, false);
  if v_edit then
    v_view := true;
  end if;

  insert into public.sharing_policies (
    company_id, member_id, resource_type, can_view, can_edit, updated_at
  )
  values (v_company_id, p_member_id, p_resource_type, v_view, v_edit, now())
  on conflict (company_id, member_id, resource_type) do update
    set can_view = excluded.can_view,
        can_edit = excluded.can_edit,
        updated_at = now()
  returning * into v_row;

  return v_row;
end;
$$;

-- 일괄 저장: [{ "resource_type": "properties", "can_view": true, "can_edit": false }, ...]
create or replace function public.upsert_member_sharing_policies_batch(
  p_member_id uuid,
  p_policies jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_item jsonb;
  v_resource text;
  v_view boolean;
  v_edit boolean;
  v_result jsonb := '[]'::jsonb;
begin
  if p_policies is null or jsonb_typeof(p_policies) <> 'array' then
    raise exception 'INVALID_POLICIES';
  end if;

  for v_item in select * from jsonb_array_elements(p_policies)
  loop
    v_resource := v_item->>'resource_type';
    v_view := coalesce((v_item->>'can_view')::boolean, false);
    v_edit := coalesce((v_item->>'can_edit')::boolean, false);

    perform public.upsert_member_sharing_policy(
      p_member_id, v_resource, v_view, v_edit
    );

    v_result := v_result || jsonb_build_array(jsonb_build_object(
      'resource_type', v_resource,
      'can_view', v_view,
      'can_edit', v_edit
    ));
  end loop;

  return v_result;
end;
$$;

-- ── 8. 프론트 호환 RPC (016 API 유지, 내부는 sharing_policies) ──
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
begin
  v_company_id := public.current_company_id();
  if v_company_id is null then
    return null;
  end if;

  v_role := public.current_member_role();
  if v_role = 'CEO' then
    return jsonb_build_object(
      'read_properties', true, 'write_properties', true,
      'read_schedules', true, 'write_schedules', true,
      'read_calls', true, 'write_calls', true
    );
  end if;

  return jsonb_build_object(
    'read_properties', coalesce((
      select can_view from public.sharing_policies
      where company_id = v_company_id and member_id = auth.uid() and resource_type = 'properties'
    ), false),
    'write_properties', coalesce((
      select can_edit from public.sharing_policies
      where company_id = v_company_id and member_id = auth.uid() and resource_type = 'properties'
    ), false),
    'read_schedules', coalesce((
      select can_view from public.sharing_policies
      where company_id = v_company_id and member_id = auth.uid() and resource_type = 'schedules'
    ), false),
    'write_schedules', coalesce((
      select can_edit from public.sharing_policies
      where company_id = v_company_id and member_id = auth.uid() and resource_type = 'schedules'
    ), false),
    'read_calls', coalesce((
      select can_view from public.sharing_policies
      where company_id = v_company_id and member_id = auth.uid() and resource_type = 'call_logs'
    ), false),
    'write_calls', coalesce((
      select can_edit from public.sharing_policies
      where company_id = v_company_id and member_id = auth.uid() and resource_type = 'call_logs'
    ), false)
  );
end;
$$;

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
    coalesce(sp_prop.can_view, false),
    coalesce(sp_prop.can_edit, false),
    coalesce(sp_sched.can_view, false),
    coalesce(sp_sched.can_edit, false),
    coalesce(sp_call.can_view, false),
    coalesce(sp_call.can_edit, false)
  from public.company_members cm
  join auth.users u on u.id = cm.user_id
  left join public.profiles p on p.id = cm.user_id
  left join public.sharing_policies sp_prop
    on sp_prop.company_id = cm.company_id and sp_prop.member_id = cm.user_id and sp_prop.resource_type = 'properties'
  left join public.sharing_policies sp_sched
    on sp_sched.company_id = cm.company_id and sp_sched.member_id = cm.user_id and sp_sched.resource_type = 'schedules'
  left join public.sharing_policies sp_call
    on sp_call.company_id = cm.company_id and sp_call.member_id = cm.user_id and sp_call.resource_type = 'call_logs'
  where cm.company_id = v_company_id
    and cm.role <> 'CEO'
  order by cm.created_at asc;
end;
$$;

create or replace function public.get_my_member_permissions_for_user(p_user_id uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_company_id uuid;
begin
  v_company_id := public.current_company_id();
  if not public.is_company_ceo() then
    raise exception 'FORBIDDEN';
  end if;

  return jsonb_build_object(
    'read_properties', coalesce((
      select can_view from public.sharing_policies
      where company_id = v_company_id and member_id = p_user_id and resource_type = 'properties'
    ), false),
    'write_properties', coalesce((
      select can_edit from public.sharing_policies
      where company_id = v_company_id and member_id = p_user_id and resource_type = 'properties'
    ), false),
    'read_schedules', coalesce((
      select can_view from public.sharing_policies
      where company_id = v_company_id and member_id = p_user_id and resource_type = 'schedules'
    ), false),
    'write_schedules', coalesce((
      select can_edit from public.sharing_policies
      where company_id = v_company_id and member_id = p_user_id and resource_type = 'schedules'
    ), false),
    'read_calls', coalesce((
      select can_view from public.sharing_policies
      where company_id = v_company_id and member_id = p_user_id and resource_type = 'call_logs'
    ), false),
    'write_calls', coalesce((
      select can_edit from public.sharing_policies
      where company_id = v_company_id and member_id = p_user_id and resource_type = 'call_logs'
    ), false)
  );
end;
$$;

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
  v_resource text;
  v_view boolean := false;
  v_edit boolean := false;
begin
  case p_permission
    when 'read_properties' then v_resource := 'properties';
    when 'write_properties' then v_resource := 'properties';
    when 'read_schedules' then v_resource := 'schedules';
    when 'write_schedules' then v_resource := 'schedules';
    when 'read_calls' then v_resource := 'call_logs';
    when 'write_calls' then v_resource := 'call_logs';
    else raise exception 'INVALID_PERMISSION';
  end case;

  select sp.can_view, sp.can_edit
  into v_view, v_edit
  from public.sharing_policies sp
  where sp.company_id = public.current_company_id()
    and sp.member_id = p_user_id
    and sp.resource_type = v_resource;

  v_view := coalesce(v_view, false);
  v_edit := coalesce(v_edit, false);

  if p_permission like 'read_%' then
    v_view := p_enabled;
    if not p_enabled then
      v_edit := false;
    end if;
  else
    v_edit := p_enabled;
    if p_enabled then
      v_view := true;
    end if;
  end if;

  perform public.upsert_member_sharing_policy(p_user_id, v_resource, v_view, v_edit);
  return public.get_my_member_permissions_for_user(p_user_id);
end;
$$;

-- ── 9. 탈퇴 시 sharing_policies 정리 (015 prepare_user_data_for_deletion 갱신) ──
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
  delete from public.sharing_policies where member_id = p_user_id;

  if exists (
    select 1 from information_schema.tables
    where table_schema = 'public' and table_name = 'sharing_policies_peer_legacy'
  ) then
    delete from public.sharing_policies_peer_legacy
    where grantor_user_id = p_user_id or grantee_user_id = p_user_id;
  end if;

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

comment on table public.sharing_policies is
  'CEO가 직원(member_id)별로 resource_type 단위 can_view/can_edit 권한을 부여. 고객(customers)은 공유 불가.';

grant execute on function public.upsert_member_sharing_policy(uuid, text, boolean, boolean) to authenticated;
grant execute on function public.upsert_member_sharing_policies_batch(uuid, jsonb) to authenticated;
grant execute on function public.get_my_member_permissions_for_user(uuid) to authenticated;
