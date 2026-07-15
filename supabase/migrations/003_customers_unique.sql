-- 고객 local_id 중복 방지 (사용자별)
create unique index if not exists customers_user_local_id_unique
  on public.customers (user_id, local_id)
  where local_id is not null;

drop trigger if exists customers_updated_at on public.customers;
create trigger customers_updated_at
  before update on public.customers
  for each row execute function public.set_updated_at();
