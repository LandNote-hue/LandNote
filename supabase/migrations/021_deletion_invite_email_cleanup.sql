-- 021: 탈퇴 시 초대 이메일(invited_email) 기준 company_invites 정리
-- (기존: invited_by / accepted_by 만 삭제 → 탈퇴 회원 이메일로 남은 초대 레코드 잔존)

create or replace function public.prepare_user_data_for_deletion(p_user_id uuid)
returns void
language plpgsql
security definer
set search_path = public, auth
as $$
declare
  v_company_id uuid;
  v_user_type text;
  v_role text;
  v_is_solo boolean;
  v_check jsonb;
  v_email text;
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

  select email into v_email from auth.users where id = p_user_id;

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
  where invited_by = p_user_id
     or accepted_by = p_user_id
     or (
       v_email is not null
       and lower(trim(invited_email)) = lower(trim(v_email))
     );

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

notify pgrst, 'reload schema';
