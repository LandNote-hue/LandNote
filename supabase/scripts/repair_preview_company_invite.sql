-- preview_company_invite RPC 복구 (expires_at ambiguous 오류)
-- Supabase SQL Editor에서 실행

drop function if exists public.preview_company_invite(text);

create function public.preview_company_invite(p_token text)
returns table (
  company_name text,
  invite_role text,
  expires_at timestamptz,
  valid boolean,
  invited_email text,
  existing_user boolean,
  existing_has_company boolean
)
language plpgsql
security definer
stable
set search_path = public
as $$
#variable_conflict use_column
declare
  inv public.company_invites%rowtype;
  cname text;
  v_user_id uuid;
  v_company_id uuid;
begin
  if nullif(trim(p_token), '') is null then
    return query select null::text, null::text, null::timestamptz, false, null::text, false, false;
    return;
  end if;

  select * into inv
  from public.company_invites
  where token = trim(p_token)
    and accepted_at is null
    and expires_at > now()
  limit 1;

  if inv.id is null then
    return query select null::text, null::text, null::timestamptz, false, null::text, false, false;
    return;
  end if;

  select c.name into cname
  from public.companies c
  where c.id = inv.company_id;

  select u.id into v_user_id
  from auth.users u
  where lower(trim(u.email)) = lower(trim(inv.invited_email))
  limit 1;

  v_company_id := null;
  if v_user_id is not null then
    select p.company_id into v_company_id
    from public.profiles p
    where p.id = v_user_id;
  end if;

  return query select
    coalesce(nullif(trim(cname), ''), '회사'),
    inv.role,
    inv.expires_at,
    true,
    inv.invited_email,
    v_user_id is not null,
    v_company_id is not null;
end;
$$;

revoke all on function public.preview_company_invite(text) from public;
grant execute on function public.preview_company_invite(text) to anon, authenticated;

notify pgrst, 'reload schema';
