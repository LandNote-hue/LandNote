-- 009 복구/신규 적용용 (테이블 없어도 실행 가능)
-- repair 전용 파일은 RPC만 있었으나, company_invites 테이블도 함께 생성합니다.

create table if not exists public.company_invites (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  invited_email text not null,
  role text not null default 'MEMBER' check (role in ('MANAGER', 'MEMBER')),
  token text not null unique,
  invited_by uuid not null references auth.users(id) on delete cascade,
  expires_at timestamptz not null,
  accepted_at timestamptz,
  accepted_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  constraint company_invites_email_not_empty check (char_length(trim(invited_email)) > 0)
);

create index if not exists company_invites_company_idx on public.company_invites(company_id, created_at desc);
create index if not exists company_invites_token_idx on public.company_invites(token) where accepted_at is null;

alter table public.company_invites enable row level security;

drop policy if exists "company_invites_select_manager" on public.company_invites;
create policy "company_invites_select_manager" on public.company_invites
  for select using (
    company_id = public.current_company_id()
    and public.is_company_manager()
  );

create or replace function public.accept_company_invite_for_user(p_user_id uuid, p_token text)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  inv public.company_invites%rowtype;
  user_email text;
  existing_company uuid;
begin
  if p_user_id is null or nullif(trim(p_token), '') is null then
    raise exception 'INVITE_INVALID';
  end if;

  select email into user_email from auth.users where id = p_user_id;
  if user_email is null then
    raise exception 'USER_NOT_FOUND';
  end if;

  select company_id into existing_company from public.profiles where id = p_user_id;
  if existing_company is not null then
    raise exception 'ALREADY_IN_COMPANY';
  end if;

  select * into inv
  from public.company_invites
  where token = trim(p_token)
    and accepted_at is null
    and expires_at > now()
  limit 1;

  if inv.id is null then
    raise exception 'INVITE_INVALID';
  end if;

  if lower(trim(inv.invited_email)) <> lower(trim(user_email)) then
    raise exception 'INVITE_EMAIL_MISMATCH';
  end if;

  insert into public.company_members (company_id, user_id, role)
  values (inv.company_id, p_user_id, inv.role)
  on conflict (company_id, user_id) do update set role = excluded.role;

  update public.profiles
  set company_id = inv.company_id, role = inv.role, updated_at = now()
  where id = p_user_id;

  update public.company_invites
  set accepted_at = now(), accepted_by = p_user_id
  where id = inv.id;

  return inv.company_id;
end;
$$;

create or replace function public.create_company_invite(
  p_email text,
  p_role text default 'MEMBER'
)
returns table(invite_id uuid, token text, expires_at timestamptz)
language plpgsql
security definer
set search_path = public
as $$
declare
  cid uuid;
  new_token text;
  exp timestamptz;
  norm_role text;
begin
  if not public.is_company_ceo() then
    raise exception 'FORBIDDEN';
  end if;

  cid := public.current_company_id();
  if cid is null then
    raise exception 'NO_COMPANY';
  end if;

  norm_role := upper(trim(coalesce(p_role, 'MEMBER')));
  if norm_role not in ('MANAGER', 'MEMBER') then
    raise exception 'INVALID_ROLE';
  end if;

  if nullif(trim(p_email), '') is null then
    raise exception 'EMAIL_REQUIRED';
  end if;

  new_token := replace(gen_random_uuid()::text, '-', '');
  exp := now() + interval '7 days';

  return query
  insert into public.company_invites (company_id, invited_email, role, token, invited_by, expires_at)
  values (cid, lower(trim(p_email)), norm_role, new_token, auth.uid(), exp)
  returning id, company_invites.token, company_invites.expires_at;
end;
$$;

create or replace function public.revoke_company_invite(p_invite_id uuid)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.is_company_ceo() then
    raise exception 'FORBIDDEN';
  end if;

  delete from public.company_invites
  where id = p_invite_id
    and company_id = public.current_company_id()
    and accepted_at is null;

  return found;
end;
$$;

create or replace function public.list_company_team()
returns table(
  user_id uuid,
  display_name text,
  email text,
  role text,
  joined_at timestamptz
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
    cm.joined_at
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

create or replace function public.list_pending_invites()
returns setof public.company_invites
language sql
stable
security definer
set search_path = public
as $$
  select i.*
  from public.company_invites i
  where i.company_id = public.current_company_id()
    and i.accepted_at is null
    and i.expires_at > now()
    and public.is_company_manager()
  order by i.created_at desc;
$$;

create or replace function public.accept_company_invite(p_token text)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
begin
  return public.accept_company_invite_for_user(auth.uid(), p_token);
end;
$$;

grant execute on function public.create_company_invite(text, text) to authenticated;
grant execute on function public.revoke_company_invite(uuid) to authenticated;
grant execute on function public.list_company_team() to authenticated;
grant execute on function public.list_pending_invites() to authenticated;
grant execute on function public.accept_company_invite(text) to authenticated;

-- 가입 트리거: 초대 토큰 우선 (009 본문과 동일)
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
  invite_token text;
  v_company_id uuid;
begin
  meta := coalesce(new.raw_user_meta_data, '{}'::jsonb);
  required_agreed := coalesce((meta->>'terms_required_agreed')::boolean, false);
  marketing := coalesce((meta->>'marketing_agreed')::boolean, false);
  terms_ver := nullif(trim(meta->>'terms_version'), '');
  signup_method := case when new.encrypted_password is not null then 'email' else 'oauth' end;
  invite_token := nullif(trim(meta->>'invite_token'), '');

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
    id, display_name, agency_name,
    terms_version, terms_required_agreed, marketing_agreed, terms_agreed_at
  )
  values (
    new.id, display_name, coalesce(company_name, meta->>'agency_name'),
    terms_ver, required_agreed, marketing, agreed_at
  );

  if required_agreed and terms_ver is not null then
    insert into public.user_terms_consents (
      user_id, terms_version, terms_required_agreed, marketing_agreed,
      agreed_at, terms_items, signup_method
    )
    values (
      new.id, terms_ver, true, marketing,
      coalesce(agreed_at, now()), coalesce(meta->'terms_items', '[]'::jsonb), signup_method
    );
  end if;

  if invite_token is not null then
    v_company_id := public.accept_company_invite_for_user(new.id, invite_token);
    return new;
  end if;

  v_company_id := public.create_company_for_user(new.id, company_name, display_name);
  return new;
end;
$$;

notify pgrst, 'reload schema';
