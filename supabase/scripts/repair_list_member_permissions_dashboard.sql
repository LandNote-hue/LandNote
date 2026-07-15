-- 직원 권한 대시보드 RPC 복구 (cm.created_at → cm.joined_at)
-- Supabase SQL Editor에서 실행

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
    cm.joined_at,
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

notify pgrst, 'reload schema';
