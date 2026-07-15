-- 027: company_id NULL 레코드도 소유자 프로필 company_id 기준으로 공유 RLS 허용
-- + company_id 백필 재실행 + insert/update 시 자동 채움

-- 026 백필 재적용 (이미 채워진 행은 no-op)
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

create or replace function public.trg_fill_company_id_from_profile()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.company_id is null and new.user_id is not null then
    select pr.company_id into new.company_id
    from public.profiles pr
    where pr.id = new.user_id;
  end if;
  return new;
end;
$$;

drop trigger if exists properties_fill_company_id on public.properties;
create trigger properties_fill_company_id
  before insert or update of user_id, company_id on public.properties
  for each row execute function public.trg_fill_company_id_from_profile();

drop trigger if exists schedules_fill_company_id on public.schedules;
create trigger schedules_fill_company_id
  before insert or update of user_id, company_id on public.schedules
  for each row execute function public.trg_fill_company_id_from_profile();

drop trigger if exists call_logs_fill_company_id on public.call_logs;
create trigger call_logs_fill_company_id
  before insert or update of user_id, company_id on public.call_logs
  for each row execute function public.trg_fill_company_id_from_profile();

drop trigger if exists customers_fill_company_id on public.customers;
create trigger customers_fill_company_id
  before insert or update of user_id, company_id on public.customers
  for each row execute function public.trg_fill_company_id_from_profile();
