-- properties.disco_url: 디스코 상세 페이지 직접 링크 (선택)
-- 있으면 시 매물 상세 「디스코」버튼이 이 URL로 이동. 없으면 지번주소 검색 URL 사용.

alter table public.properties
  add column if not exists disco_url text;

comment on column public.properties.disco_url is
  '디스코(disco.re) 매물 상세 URL. null이면 지번주소 검색(https://www.disco.re/search?q=…)으로 연결';
