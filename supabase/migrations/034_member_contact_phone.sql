-- 034: 멤버 담당자 연락처 + 팀 목록·권한 대시보드에 전화번호 노출
-- CEO가 직원 연락처를 저장하면 profiles.phone 및 auth.users metadata에 반영

alter table public.profiles
  add column if not exists phone text;

update public.profiles p
set phone = nullif(trim(coalesce(p.phone, u.raw_user_meta_data->>'phone', u.raw_user_meta_data->>'tel', '')), '')
from auth.users u
where u.id = p.id
  and nullif(trim(coalesce(p.phone, '')), '') is null
  and nullif(trim(coalesce(u.raw_user_meta_data->>'phone', u.raw_user_meta_data->>'tel', '')), '') is not null;

drop function if exists public.list_company_team();
create function public.list_company_team()
returns table(
  user_id uuid,
  display_name text,
  email text,
  role text,
  joined_at timestamptz,
  phone text
)
language sql
stable
security definer
set search_path = public
as $$
  select
    cm.user_id,
    p.display_name,
    u.email,
    cm.role,
    cm.joined_at,
    coalesce(
      nullif(trim(p.phone), ''),
      nullif(trim(u.raw_user_meta_data->>'phone'), ''),
      nullif(trim(u.raw_user_meta_data->>'tel'), '')
    ) as phone
  from public.company_members cm
  inner join public.profiles p on p.id = cm.user_id
  inner join auth.users u on u.id = cm.user_id
  where cm.company_id = public.current_company_id()
    and exists (
      select 1 from public.company_members me
      where me.company_id = cm.company_id and me.user_id = auth.uid()
    )
  order by
    case cm.role when 'CEO' then 0 when 'MANAGER' then 1 else 2 end,
    cm.joined_at asc;
$$;

grant execute on function public.list_company_team() to authenticated;

drop function if exists public.list_member_permissions_dashboard();
create function public.list_member_permissions_dashboard()
returns table (
  user_id uuid,
  display_name text,
  email text,
  role text,
  joined_at timestamptz,
  phone text,
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
    cm.joined_at,
    coalesce(
      nullif(trim(p.phone), ''),
      nullif(trim(u.raw_user_meta_data->>'phone'), ''),
      nullif(trim(u.raw_user_meta_data->>'tel'), '')
    ) as phone,
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
  order by cm.joined_at asc;
end;
$$;

grant execute on function public.list_member_permissions_dashboard() to authenticated;

create or replace function public.update_company_member_contact(p_user_id uuid, p_phone text)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  v_company_id uuid;
  v_phone text;
  v_current text;
begin
  if not public.is_company_ceo() then
    raise exception 'FORBIDDEN';
  end if;
  v_company_id := public.current_company_id();
  if v_company_id is null then
    raise exception 'NO_COMPANY';
  end if;
  if p_user_id is null then
    raise exception 'MEMBER_NOT_FOUND';
  end if;

  select cm.role into v_current
  from public.company_members cm
  where cm.company_id = v_company_id and cm.user_id = p_user_id;

  if v_current is null then
    raise exception 'MEMBER_NOT_FOUND';
  end if;
  if v_current = 'CEO' then
    raise exception 'CANNOT_EDIT_CEO';
  end if;

  v_phone := nullif(trim(coalesce(p_phone, '')), '');

  update public.profiles
  set phone = v_phone, updated_at = now()
  where id = p_user_id;

  update auth.users
  set raw_user_meta_data = coalesce(raw_user_meta_data, '{}'::jsonb)
    || jsonb_build_object('phone', coalesce(v_phone, ''))
  where id = p_user_id;

  return coalesce(v_phone, '');
end;
$$;

grant execute on function public.update_company_member_contact(uuid, text) to authenticated;

notify pgrst, 'reload schema';
