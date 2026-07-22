-- 032: company_members / companies SELECT RLS 무한 재귀 제거
-- 007 정책이 company_members를 자기 참조 → "infinite recursion detected in policy"
-- security definer 헬퍼로 멤버십 판정 후 정책 단순화

create or replace function public.is_company_member_of(p_company_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.company_members cm
    where cm.company_id = p_company_id
      and cm.user_id = auth.uid()
  );
$$;

create or replace function public.is_same_company_member(p_company_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select public.is_company_member_of(p_company_id);
$$;

revoke all on function public.is_company_member_of(uuid) from public;
grant execute on function public.is_company_member_of(uuid) to authenticated;

revoke all on function public.is_same_company_member(uuid) from public;
grant execute on function public.is_same_company_member(uuid) to authenticated;

drop policy if exists "companies_select_member" on public.companies;
create policy "companies_select_member" on public.companies
  for select to authenticated
  using (public.is_company_member_of(id));

drop policy if exists "company_members_select_own_company" on public.company_members;
create policy "company_members_select_own_company" on public.company_members
  for select to authenticated
  using (
    user_id = auth.uid()
    or public.is_company_member_of(company_id)
  );

-- 프로필 불일치 보정: SOLO 워크스페이스(company_id = id, role SOLO)인데 user_type만 BUSINESS인 경우
update public.profiles
set user_type = 'SOLO', updated_at = now()
where role = 'SOLO'
  and company_id = id
  and user_type = 'BUSINESS';

notify pgrst, 'reload schema';
