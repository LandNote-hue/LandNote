-- 029: 매물 사진 Storage (회사 구성원이 URL로 공유 열람)
-- path: {company_id|solo}/{owner_user_id}/{property_cloud_id}/{slot}.{ext}

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'property-photos',
  'property-photos',
  true,
  5242880,
  array['image/jpeg', 'image/png', 'image/webp', 'image/gif']
)
on conflict (id) do update set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "property_photos_select" on storage.objects;
drop policy if exists "property_photos_insert" on storage.objects;
drop policy if exists "property_photos_update" on storage.objects;
drop policy if exists "property_photos_delete" on storage.objects;

-- public 버킷이지만, 인증 사용자의 업로드/수정/삭제는 회사·소유자만 허용
create policy "property_photos_select"
on storage.objects for select
using (bucket_id = 'property-photos');

create policy "property_photos_insert"
on storage.objects for insert to authenticated
with check (
  bucket_id = 'property-photos'
  and (
    auth.uid()::text = (storage.foldername(name))[2]
    or (
      public.current_company_id() is not null
      and (storage.foldername(name))[1] = public.current_company_id()::text
    )
  )
);

create policy "property_photos_update"
on storage.objects for update to authenticated
using (
  bucket_id = 'property-photos'
  and (
    auth.uid()::text = (storage.foldername(name))[2]
    or public.is_company_ceo()
    or (
      public.current_company_id() is not null
      and (storage.foldername(name))[1] = public.current_company_id()::text
    )
  )
)
with check (
  bucket_id = 'property-photos'
  and (
    auth.uid()::text = (storage.foldername(name))[2]
    or public.is_company_ceo()
    or (
      public.current_company_id() is not null
      and (storage.foldername(name))[1] = public.current_company_id()::text
    )
  )
);

create policy "property_photos_delete"
on storage.objects for delete to authenticated
using (
  bucket_id = 'property-photos'
  and (
    auth.uid()::text = (storage.foldername(name))[2]
    or public.is_company_ceo()
    or (
      public.current_company_id() is not null
      and (storage.foldername(name))[1] = public.current_company_id()::text
    )
  )
);
