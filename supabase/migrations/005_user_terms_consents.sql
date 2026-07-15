-- 약관 동의 이력 및 가입 시 백엔드 검증
-- 프론트 termsData.js TERMS_VERSION 과 동기화 (현재 v1.0)

-- profiles: 최신 동의 스냅샷 (조회용)
alter table public.profiles
  add column if not exists terms_version text,
  add column if not exists terms_required_agreed boolean,
  add column if not exists marketing_agreed boolean not null default false,
  add column if not exists terms_agreed_at timestamptz;

-- 약관 동의 이력 (감사·법적 증빙)
create table if not exists public.user_terms_consents (
  id bigint generated always as identity primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  terms_version text not null,
  terms_required_agreed boolean not null,
  marketing_agreed boolean not null default false,
  agreed_at timestamptz not null,
  terms_items jsonb not null default '[]'::jsonb,
  signup_method text not null default 'email',
  created_at timestamptz not null default now(),
  constraint user_terms_consents_required_check check (terms_required_agreed = true)
);

create index if not exists user_terms_consents_user_id_idx
  on public.user_terms_consents(user_id, agreed_at desc);

alter table public.user_terms_consents enable row level security;

create policy "user_terms_consents_select_own" on public.user_terms_consents
  for select using (auth.uid() = user_id);

-- 이메일·비밀번호 가입: 필수 약관 동의 백엔드 검증 (DB 레벨)
create or replace function public.validate_signup_terms()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  meta jsonb;
  required_agreed boolean;
  terms_ver text;
begin
  meta := coalesce(new.raw_user_meta_data, '{}'::jsonb);

  -- OAuth 등 비밀번호 없는 가입은 별도 약관 플로우 (차단하지 않음)
  if new.encrypted_password is null then
    return new;
  end if;

  required_agreed := coalesce((meta->>'terms_required_agreed')::boolean, false);
  terms_ver := nullif(trim(meta->>'terms_version'), '');

  if not required_agreed then
    raise exception 'TERMS_REQUIRED'
      using
        message = 'Required terms must be agreed',
        detail = 'terms_required_agreed is false or missing',
        hint = 'TERMS_REQUIRED';
  end if;

  if terms_ver is null then
    raise exception 'TERMS_VERSION_REQUIRED'
      using
        message = 'Terms version is missing',
        detail = 'terms_version is empty',
        hint = 'TERMS_VERSION_REQUIRED';
  end if;

  return new;
end;
$$;

drop trigger if exists validate_signup_terms_before_insert on auth.users;
create trigger validate_signup_terms_before_insert
  before insert on auth.users
  for each row execute function public.validate_signup_terms();

-- 가입 완료 시 profiles + 약관 이력 저장
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
begin
  meta := coalesce(new.raw_user_meta_data, '{}'::jsonb);
  required_agreed := coalesce((meta->>'terms_required_agreed')::boolean, false);
  marketing := coalesce((meta->>'marketing_agreed')::boolean, false);
  terms_ver := nullif(trim(meta->>'terms_version'), '');
  signup_method := case when new.encrypted_password is not null then 'email' else 'oauth' end;

  agreed_at := case
    when meta ? 'terms_agreed_at' and nullif(trim(meta->>'terms_agreed_at'), '') is not null
      then (meta->>'terms_agreed_at')::timestamptz
    else null
  end;

  insert into public.profiles (
    id,
    display_name,
    terms_version,
    terms_required_agreed,
    marketing_agreed,
    terms_agreed_at
  )
  values (
    new.id,
    coalesce(
      meta->>'full_name',
      meta->>'name',
      split_part(new.email, '@', 1)
    ),
    terms_ver,
    required_agreed,
    marketing,
    agreed_at
  );

  if required_agreed and terms_ver is not null then
    insert into public.user_terms_consents (
      user_id,
      terms_version,
      terms_required_agreed,
      marketing_agreed,
      agreed_at,
      terms_items,
      signup_method
    )
    values (
      new.id,
      terms_ver,
      true,
      marketing,
      coalesce(agreed_at, now()),
      coalesce(meta->'terms_items', '[]'::jsonb),
      signup_method
    );
  end if;

  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();
