-- 028: 직원 공유 SELECT/UPDATE RLS 통일 (company_id NULL 포함)
-- 017 properties_select_rbac 가 company_id 직접 비교 → NULL 행은 직원에게 안 보임
-- 027 헬퍼가 없어도 동작하도록 effective/can_* 함수를 함께 보장

-- 백필 재실행
update public.properties p
set company_id = pr.company_id
from public.profiles pr
where p.user_id = pr.id
  and p.company_id is null
  and pr.company_id is not null;

update public.schedules s
set company_id = pr.company_id
from public.profiles pr
where s.user_id = pr.id
  and s.company_id is null
  and pr.company_id is not null;

update public.call_logs c
set company_id = pr.company_id
from public.profiles pr
where c.user_id = pr.id
  and c.company_id is null
  and pr.company_id is not null;

update public.customers cu
set company_id = pr.company_id
from public.profiles pr
where cu.user_id = pr.id
  and cu.company_id is null
  and pr.company_id is not null;

create or replace function public.effective_row_company_id(p_user_id uuid, p_company_id uuid)
returns uuid
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(
    p_company_id,
    (select pr.company_id from public.profiles pr where pr.id = p_user_id)
  );
$$;

create or replace function public.can_read_shareable_row(p_user_id uuid, p_company_id uuid, p_resource text)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select
    (
      public.effective_row_company_id(p_user_id, p_company_id) is null
      and p_user_id = auth.uid()
    )
    or (
      public.effective_row_company_id(p_user_id, p_company_id) is not null
      and public.effective_row_company_id(p_user_id, p_company_id) = public.current_company_id()
      and (
        public.is_company_ceo()
        or p_user_id = auth.uid()
        or (
          p_user_id <> auth.uid()
          and public.has_sharing_policy_view(p_resource)
        )
      )
    );
$$;

create or replace function public.can_write_shareable_row(
  p_user_id uuid,
  p_company_id uuid,
  p_resource text default 'properties'
)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select
    (
      public.effective_row_company_id(p_user_id, p_company_id) is null
      and p_user_id = auth.uid()
    )
    or (
      public.effective_row_company_id(p_user_id, p_company_id) is not null
      and public.effective_row_company_id(p_user_id, p_company_id) = public.current_company_id()
      and (
        public.is_company_ceo()
        or p_user_id = auth.uid()
        or (
          p_user_id <> auth.uid()
          and public.has_sharing_policy_edit(p_resource)
        )
      )
    );
$$;

-- ── properties ──
drop policy if exists "properties_select_rbac" on public.properties;
drop policy if exists "properties_update_rbac" on public.properties;
drop policy if exists "properties_delete_rbac" on public.properties;

create policy "properties_select_rbac" on public.properties
  for select to authenticated
  using (
    public.can_read_shareable_row(user_id, company_id, 'properties')
  );

create policy "properties_update_rbac" on public.properties
  for update to authenticated
  using (
    public.can_write_shareable_row(user_id, company_id, 'properties')
  )
  with check (
    public.can_write_shareable_row(user_id, company_id, 'properties')
  );

create policy "properties_delete_rbac" on public.properties
  for delete to authenticated
  using (
    public.can_write_shareable_row(user_id, company_id, 'properties')
  );

-- ── schedules ──
drop policy if exists "schedules_select_rbac" on public.schedules;
drop policy if exists "schedules_update_rbac" on public.schedules;
drop policy if exists "schedules_delete_rbac" on public.schedules;

create policy "schedules_select_rbac" on public.schedules
  for select to authenticated
  using (
    public.can_read_shareable_row(user_id, company_id, 'schedules')
  );

create policy "schedules_update_rbac" on public.schedules
  for update to authenticated
  using (
    public.can_write_shareable_row(user_id, company_id, 'schedules')
  )
  with check (
    public.can_write_shareable_row(user_id, company_id, 'schedules')
  );

create policy "schedules_delete_rbac" on public.schedules
  for delete to authenticated
  using (
    public.can_write_shareable_row(user_id, company_id, 'schedules')
  );

-- ── call_logs ──
drop policy if exists "call_logs_select_rbac" on public.call_logs;
drop policy if exists "call_logs_update_rbac" on public.call_logs;
drop policy if exists "call_logs_delete_rbac" on public.call_logs;

create policy "call_logs_select_rbac" on public.call_logs
  for select to authenticated
  using (
    public.can_read_shareable_row(user_id, company_id, 'call_logs')
  );

create policy "call_logs_update_rbac" on public.call_logs
  for update to authenticated
  using (
    public.can_write_shareable_row(user_id, company_id, 'call_logs')
  )
  with check (
    public.can_write_shareable_row(user_id, company_id, 'call_logs')
  );

create policy "call_logs_delete_rbac" on public.call_logs
  for delete to authenticated
  using (
    public.can_write_shareable_row(user_id, company_id, 'call_logs')
  );
