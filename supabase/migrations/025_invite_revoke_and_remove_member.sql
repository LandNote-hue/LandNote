-- 025: 초대 취소(이메일별 대기 전체) + CEO 직원 팀 제거

-- ── 초대 취소: 동일 이메일의 대기 중 초대 전부 삭제 ──
create or replace function public.revoke_company_invite(p_invite_id uuid)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  v_email text;
  v_deleted int;
begin
  if not public.is_company_ceo() then
    raise exception 'FORBIDDEN';
  end if;

  select i.invited_email into v_email
  from public.company_invites i
  where i.id = p_invite_id
    and i.company_id = public.current_company_id()
    and i.accepted_at is null;

  if v_email is null then
    return false;
  end if;

  delete from public.company_invites
  where company_id = public.current_company_id()
    and accepted_at is null
    and lower(trim(invited_email)) = lower(trim(v_email));

  get diagnostics v_deleted = row_count;
  return v_deleted > 0;
end;
$$;

-- ── CEO: 직원 팀에서 제거 (계정 삭제 아님 → 개인 SOLO 워크스페이스) ──
create or replace function public.remove_company_member(p_user_id uuid)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  v_company_id uuid;
  v_target_role text;
  v_display_name text;
begin
  if not public.is_company_ceo() then
    raise exception 'FORBIDDEN';
  end if;

  if p_user_id is null or p_user_id = auth.uid() then
    raise exception 'CANNOT_REMOVE_SELF';
  end if;

  v_company_id := public.current_company_id();
  if v_company_id is null then
    raise exception 'NO_COMPANY';
  end if;

  select cm.role into v_target_role
  from public.company_members cm
  where cm.company_id = v_company_id
    and cm.user_id = p_user_id;

  if v_target_role is null then
    raise exception 'MEMBER_NOT_FOUND';
  end if;

  if v_target_role = 'CEO' then
    raise exception 'CANNOT_REMOVE_CEO';
  end if;

  delete from public.sharing_policies
  where company_id = v_company_id
    and member_id = p_user_id;

  delete from public.company_members
  where company_id = v_company_id
    and user_id = p_user_id;

  update public.properties
  set company_id = p_user_id, updated_at = now()
  where user_id = p_user_id
    and company_id = v_company_id;

  update public.schedules
  set company_id = p_user_id, updated_at = now()
  where user_id = p_user_id
    and company_id = v_company_id;

  update public.call_logs
  set company_id = p_user_id, updated_at = now()
  where user_id = p_user_id
    and company_id = v_company_id;

  select p.display_name into v_display_name
  from public.profiles p
  where p.id = p_user_id;

  update public.profiles
  set company_id = null, role = null, updated_at = now()
  where id = p_user_id
    and company_id = v_company_id;

  perform public.create_solo_workspace_for_user(p_user_id, v_display_name);

  return true;
exception
  when others then
    raise;
end;
$$;

grant execute on function public.remove_company_member(uuid) to authenticated;

comment on function public.remove_company_member(uuid) is
  'CEO가 직원을 팀에서 제거. auth 계정은 유지하고 SOLO 워크스페이스로 전환.';

notify pgrst, 'reload schema';
