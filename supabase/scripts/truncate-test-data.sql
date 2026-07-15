-- LandNote 테스트 DB 일회성 초기화 (006_data_isolation.sql 주석과 동일)
-- Supabase Dashboard → SQL Editor에서 붙여넣어 실행하세요.
-- ⚠️ 매물·고객·일정·통화·폴더·임대 데이터가 전부 삭제됩니다.

truncate public.property_folders, public.folders, public.rentals,
  public.schedules, public.call_logs, public.customers, public.properties cascade;
