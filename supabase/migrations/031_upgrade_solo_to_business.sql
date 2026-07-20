-- 개인(SOLO) 워크스페이스를 회사형(CEO/BUSINESS)으로 인플레이스 승격
-- company_id는 유지하므로 매물·일정·통화 company_id 이전 불필요

create or replace function public.upgrade_solo_to_business(p_company_name text)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_company_id uuid;
  v_role text;
  v_user_type text;
  v_name text;
  v_slug text;
  cleaned text;
  candidate text;
  suffix int := 0;
  v_updated int;
begin
  if v_uid is null then
    raise exception 'NOT_AUTHENTICATED';
  end if;

  v_name := nullif(trim(coalesce(p_company_name, '')), '');
  if v_name is null then
    raise exception 'COMPANY_NAME_REQUIRED';
  end if;

  select p.company_id, p.role, p.user_type
  into v_company_id, v_role, v_user_type
  from public.profiles p
  where p.id = v_uid;

  if not found then
    raise exception 'PROFILE_NOT_FOUND';
  end if;

  if v_user_type = 'BUSINESS'
     or v_role in ('CEO', 'MANAGER', 'MEMBER') then
    raise exception 'ALREADY_BUSINESS';
  end if;

  if v_company_id is null then
    v_company_id := public.create_solo_workspace_for_user(v_uid, null);
  end if;

  cleaned := lower(regexp_replace(trim(v_name), '[^a-zA-Z0-9가-힣]+', '-', 'g'));
  cleaned := regexp_replace(cleaned, '(^-+|-+$)', '', 'g');
  if cleaned = '' then
    cleaned := 'workspace';
  end if;
  candidate := cleaned;
  while exists (
    select 1 from public.companies c
    where c.slug = candidate and c.id <> v_company_id
  ) loop
    suffix := suffix + 1;
    candidate := cleaned || '-' || suffix::text;
  end loop;
  v_slug := candidate;

  update public.companies
  set
    name = v_name,
    slug = v_slug,
    representative_id = v_uid,
    created_by = coalesce(created_by, v_uid),
    updated_at = now()
  where id = v_company_id;
  get diagnostics v_updated = row_count;

  if v_updated = 0 then
    insert into public.companies (id, name, slug, created_by, representative_id)
    values (v_company_id, v_name, v_slug, v_uid, v_uid);
  end if;

  insert into public.company_members (company_id, user_id, role)
  values (v_company_id, v_uid, 'CEO')
  on conflict (company_id, user_id) do update set role = 'CEO';

  update public.profiles
  set
    company_id = v_company_id,
    role = 'CEO',
    user_type = 'BUSINESS',
    agency_name = coalesce(nullif(trim(agency_name), ''), v_name),
    updated_at = now()
  where id = v_uid;

  return v_company_id;
end;
$$;

grant execute on function public.upgrade_solo_to_business(text) to authenticated;

comment on function public.upgrade_solo_to_business(text) is
  'SOLO 워크스페이스를 회사명으로 승격(CEO/BUSINESS). company_id 유지.';

notify pgrst, 'reload schema';
