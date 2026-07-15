-- 019: 회사명(CEO 개설) 가입 시 invite_token 무시 — 직원(MEMBER)으로 잘못 합류하는 것 방지

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
  user_type text;
  v_company_id uuid;
begin
  meta := coalesce(new.raw_user_meta_data, '{}'::jsonb);
  required_agreed := coalesce((meta->>'terms_required_agreed')::boolean, false);
  marketing := coalesce((meta->>'marketing_agreed')::boolean, false);
  terms_ver := nullif(trim(meta->>'terms_version'), '');
  signup_method := case when new.encrypted_password is not null then 'email' else 'oauth' end;
  invite_token := nullif(trim(meta->>'invite_token'), '');
  user_type := upper(coalesce(nullif(trim(meta->>'user_type'), ''), 'SOLO'));
  if user_type not in ('SOLO', 'BUSINESS') then
    user_type := 'SOLO';
  end if;

  agreed_at := case
    when meta ? 'terms_agreed_at' and nullif(trim(meta->>'terms_agreed_at'), '') is not null
      then (meta->>'terms_agreed_at')::timestamptz
    else null
  end;

  display_name := coalesce(
    nullif(trim(meta->>'display_name'), ''),
    meta->>'full_name',
    meta->>'name',
    split_part(new.email, '@', 1)
  );

  company_name := nullif(trim(meta->>'company_name'), '');

  -- CEO 회사 개설 의도(회사명 있음)면 초대 토큰 무시
  if user_type = 'BUSINESS' and company_name is not null and invite_token is not null then
    invite_token := null;
  end if;

  insert into public.profiles (
    id, display_name, agency_name,
    terms_version, terms_required_agreed, marketing_agreed, terms_agreed_at,
    user_type
  )
  values (
    new.id, display_name, coalesce(company_name, meta->>'agency_name'),
    terms_ver, required_agreed, marketing, agreed_at,
    case when invite_token is not null then 'BUSINESS' else user_type end
  )
  on conflict (id) do update set
    display_name = excluded.display_name,
    agency_name = coalesce(excluded.agency_name, public.profiles.agency_name),
    terms_version = coalesce(excluded.terms_version, public.profiles.terms_version),
    terms_required_agreed = coalesce(excluded.terms_required_agreed, public.profiles.terms_required_agreed),
    marketing_agreed = excluded.marketing_agreed,
    terms_agreed_at = coalesce(excluded.terms_agreed_at, public.profiles.terms_agreed_at),
    user_type = coalesce(excluded.user_type, public.profiles.user_type),
    updated_at = now();

  if signup_method = 'oauth' and not required_agreed then
    return new;
  end if;

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
    update public.profiles set user_type = 'BUSINESS', updated_at = now() where id = new.id;
    return new;
  end if;

  if user_type = 'BUSINESS' then
    v_company_id := public.create_company_for_user(new.id, company_name, display_name);
  else
    v_company_id := public.create_solo_workspace_for_user(new.id, display_name);
  end if;

  return new;
exception
  when others then
    raise exception 'SIGNUP_FAILED: %', SQLERRM;
end;
$$;
