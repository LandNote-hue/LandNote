-- 026: 회사 소속 데이터의 company_id 백필 (직원 공유 RLS용)
-- properties / schedules / call_logs / customers 중 company_id NULL 이고
-- 소유자 profiles.company_id 가 있으면 행을 채웁니다.

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
