-- 033 임대차-매물 연결 사전 진단 (SELECT only)
-- 실행 순서:
--   1) 이 파일을 로컬/스테이징에서만 실행한다. 운영 DB에는 실행하지 않는다.
--   2) 각 SELECT 결과를 CSV/쿼리 기록으로 보관한다. 마이그레이션 트랜잭션 밖이므로
--      이후 033 마이그레이션이 RAISE로 실패해도 이 결과는 남아 있다.
--   3) supabase/migrations/033_rentals_property_cloud_id.sql 을 적용한다.
-- 이 파일은 INSERT/UPDATE/DELETE/행 연결을 하지 않는다. 중복 행을 삭제하지 않는다.

-- A. (user_id, local_id) 중복 그룹
select user_id, local_id, count(*) as row_count, array_agg(id order by id) as rental_ids
from public.rentals
where local_id is not null
group by user_id, local_id
having count(*) > 1
order by row_count desc, user_id, local_id;

-- B. 중복에 속한 개별 임대차 행
select r.id, r.user_id, r.company_id, r.local_id, r.pid, r.property_id
from public.rentals r
where r.local_id is not null
  and exists (
    select 1 from public.rentals r2
    where r2.user_id = r.user_id and r2.local_id = r.local_id and r2.id <> r.id
  )
order by r.user_id, r.local_id, r.id;

-- C. pid 기준 부모 매물 후보가 0건 또는 2건 이상 (연결 불가·다중 후보)
select r.id as rental_id, r.pid, r.user_id, r.company_id, r.property_id,
  (
    select count(*)
    from public.properties p
    where p.user_id = r.user_id
      and p.company_id is not distinct from r.company_id
      and p.local_id = r.pid
  ) as candidate_count,
  coalesce((
    select array_agg(p.id order by p.id)
    from public.properties p
    where p.user_id = r.user_id
      and p.company_id is not distinct from r.company_id
      and p.local_id = r.pid
  ), '{}') as candidate_property_ids
from public.rentals r
where r.property_id is null
  and r.pid is not null
  and (
    select count(*)
    from public.properties p
    where p.user_id = r.user_id
      and p.company_id is not distinct from r.company_id
      and p.local_id = r.pid
  ) <> 1
order by candidate_count desc, r.id;

-- D. 유일하게 연결 가능한 행 수 (033 UPDATE 대상 건수 확인. 여기서는 변경하지 않음)
select count(*) as unambiguous_link_count
from public.rentals r
where r.property_id is null
  and r.pid is not null
  and (
    select count(*)
    from public.properties p
    where p.user_id = r.user_id
      and p.company_id is not distinct from r.company_id
      and p.local_id = r.pid
  ) = 1;
