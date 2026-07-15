-- Google/이메일 가입 시 display_name 자동 설정 (001 스키마 기준)
-- 확장 필드(직함·연락처·주소 등)는 auth.users.user_metadata에 저장 (컬럼 추가 불필요)

create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, display_name)
  values (
    new.id,
    coalesce(
      new.raw_user_meta_data->>'full_name',
      new.raw_user_meta_data->>'name',
      split_part(new.email, '@', 1)
    )
  );
  return new;
end;
$$;
