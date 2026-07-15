-- 024: 초대 이력 — 동일 이메일은 최종 발송(created_at 최신) 1건만 표시

create or replace function public.list_company_invite_history()
returns table (
  id uuid,
  invited_email text,
  role text,
  token text,
  created_at timestamptz,
  expires_at timestamptz,
  accepted_at timestamptz,
  status text
)
language sql
stable
security definer
set search_path = public
as $$
  select
    x.id,
    x.invited_email,
    x.role,
    x.token,
    x.created_at,
    x.expires_at,
    x.accepted_at,
    x.status
  from (
    select distinct on (lower(trim(i.invited_email)))
      i.id,
      i.invited_email,
      i.role,
      i.token,
      i.created_at,
      i.expires_at,
      i.accepted_at,
      case
        when i.accepted_at is not null then 'accepted'
        when i.expires_at <= now() then 'expired'
        else 'pending'
      end as status
    from public.company_invites i
    where i.company_id = public.current_company_id()
      and public.is_company_manager()
    order by lower(trim(i.invited_email)), i.created_at desc
  ) x
  order by x.created_at desc;
$$;

grant execute on function public.list_company_invite_history() to authenticated;

comment on function public.list_company_invite_history() is
  'CEO/팀장: 회사 초대 이력 (이메일당 최종 발송 1건, 대기·가입완료·만료)';

notify pgrst, 'reload schema';
