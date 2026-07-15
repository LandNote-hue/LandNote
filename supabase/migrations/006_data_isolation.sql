-- LandNote: 계정별 데이터 격리 확인 및 고아(주인 없는) 데이터 정리
-- Supabase Dashboard → SQL Editor에서 실행
-- 주의: 아래 DELETE는 테스트 DB에서만 실행하세요. 운영 데이터는 user_id를 먼저 백필하세요.

-- RLS가 꺼져 있으면 다시 활성화
alter table public.properties enable row level security;
alter table public.customers enable row level security;
alter table public.call_logs enable row level security;
alter table public.schedules enable row level security;

-- 정책이 없을 때만 생성 (001_initial.sql과 동일)
do $$ begin
  if not exists (
    select 1 from pg_policies where schemaname = 'public' and tablename = 'properties' and policyname = 'properties_own'
  ) then
    create policy "properties_own" on public.properties
      for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
  end if;
  if not exists (
    select 1 from pg_policies where schemaname = 'public' and tablename = 'customers' and policyname = 'customers_own'
  ) then
    create policy "customers_own" on public.customers
      for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
  end if;
  if not exists (
    select 1 from pg_policies where schemaname = 'public' and tablename = 'call_logs' and policyname = 'call_logs_own'
  ) then
    create policy "call_logs_own" on public.call_logs
      for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
  end if;
  if not exists (
    select 1 from pg_policies where schemaname = 'public' and tablename = 'schedules' and policyname = 'schedules_own'
  ) then
    create policy "schedules_own" on public.schedules
      for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
  end if;
end $$;

-- (선택) 테스트용: 특정 계정에 고아 데이터 일괄 귀속
-- update public.properties set user_id = 'YOUR-USER-UUID' where user_id is null;
-- update public.customers set user_id = 'YOUR-USER-UUID' where user_id is null;
-- update public.call_logs set user_id = 'YOUR-USER-UUID' where user_id is null;
-- update public.schedules set user_id = 'YOUR-USER-UUID' where user_id is null;

-- (선택) 테스트 DB 전체 비우기 — SQL Editor 또는 아래 npm 스크립트로 실행
--   supabase/scripts/truncate-test-data.sql
--   npm run db:clear-test-data
-- truncate public.property_folders, public.folders, public.rentals,
--   public.schedules, public.call_logs, public.customers, public.properties cascade;
