-- 018: 초대 링크 미리보기 (사원 가입 페이지에서 회사명 표시)
-- anon 호출 가능 — 토큰 유효성·회사명만 반환 (이메일 등 PII 미포함)

create or replace function public.preview_company_invite(p_token text)
returns table (
  company_name text,
  invite_role text,
  expires_at timestamptz,
  valid boolean
)
language plpgsql
security definer
stable
set search_path = public
as $$
declare
  inv public.company_invites%rowtype;
  cname text;
begin
  if nullif(trim(p_token), '') is null then
    return query select null::text, null::text, null::timestamptz, false;
    return;
  end if;

  select * into inv
  from public.company_invites
  where token = trim(p_token)
    and accepted_at is null
    and expires_at > now()
  limit 1;

  if inv.id is null then
    return query select null::text, null::text, null::timestamptz, false;
    return;
  end if;

  select c.name into cname
  from public.companies c
  where c.id = inv.company_id;

  return query select
    coalesce(nullif(trim(cname), ''), '회사'),
    inv.role,
    inv.expires_at,
    true;
end;
$$;

revoke all on function public.preview_company_invite(text) from public;
grant execute on function public.preview_company_invite(text) to anon, authenticated;

comment on function public.preview_company_invite(text) is
  '초대 토큰으로 회사명·역할·만료 시각 미리보기 (사원 가입 페이지용)';
