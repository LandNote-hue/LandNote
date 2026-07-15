-- 매물 local_id 중복 방지 (사용자별)
create unique index if not exists properties_user_local_id_unique
  on public.properties (user_id, local_id)
  where local_id is not null;

-- updated_at 자동 갱신
create or replace function public.set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists properties_updated_at on public.properties;
create trigger properties_updated_at
  before update on public.properties
  for each row execute function public.set_updated_at();
