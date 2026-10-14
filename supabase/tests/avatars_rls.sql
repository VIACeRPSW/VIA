begin;
insert into public.profiles (clerk_user_id, username, display_name)
values ('via_avatar_owner_test', 'via_avatar_owner_test', 'Avatar owner'),
  ('via_avatar_other_test', 'via_avatar_other_test', 'Avatar other');

create function pg_temp.avatar_test_path(subject text, suffix text)
returns text language sql as $$
  select encode(sha256(convert_to(subject, 'UTF8')), 'hex') || '/' || suffix || '.webp';
$$;

set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"via_avatar_owner_test","role":"authenticated"}', true);
insert into public.avatar_cleanup_tasks (object_path)
values (pg_temp.avatar_test_path('via_avatar_owner_test', 'b02e9ce0-0a90-4e7c-a5cb-f54ff20f228a'));
insert into storage.objects (bucket_id, name, metadata)
values ('avatars', pg_temp.avatar_test_path('via_avatar_owner_test', 'b02e9ce0-0a90-4e7c-a5cb-f54ff20f228a'),
  '{"mimetype":"image/webp","size":16}');

do $$
declare
  path text := pg_temp.avatar_test_path('via_avatar_owner_test', 'b02e9ce0-0a90-4e7c-a5cb-f54ff20f228a');
  url text := 'https://avatar-test.invalid/storage/v1/object/public/avatars/' || path;
  affected integer;
begin
  if not public.owns_avatar_path(path) then raise exception 'Own avatar path rejected'; end if;
  if public.owns_avatar_path(pg_temp.avatar_test_path('via_avatar_other_test', 'b02e9ce0-0a90-4e7c-a5cb-f54ff20f228a')) then
    raise exception 'Foreign avatar path accepted';
  end if;
  if not public.commit_profile_avatar(null, url, path) then raise exception 'Own avatar commit failed'; end if;
  if exists (select 1 from public.avatar_cleanup_tasks where object_path = path) then
    raise exception 'Committed upload retained its pending ticket';
  end if;
  update storage.objects set name = 'forbidden.webp' where bucket_id = 'avatars' and name = path;
  get diagnostics affected = row_count;
  if affected <> 0 then raise exception 'Immutable avatar could be overwritten'; end if;
  begin
    insert into public.avatar_cleanup_tasks (object_path)
    values (pg_temp.avatar_test_path('via_avatar_other_test', 'b02e9ce0-0a90-4e7c-a5cb-f54ff20f228a'));
    raise exception 'Foreign cleanup ticket accepted';
  exception when insufficient_privilege then null;
  end;
  begin
    insert into public.avatar_cleanup_tasks (object_path) values ('../foreign.webp');
    raise exception 'Manipulated path accepted';
  exception when insufficient_privilege then null;
  end;
  if public.commit_profile_avatar(null, null, null) then raise exception 'Stale avatar comparison succeeded'; end if;
  if not public.commit_profile_avatar(url, null, null) then raise exception 'Avatar retirement failed'; end if;
  if not exists (select 1 from public.avatar_cleanup_tasks where object_path = path and state = 'cleanup') then
    raise exception 'Retirement did not durably schedule cleanup';
  end if;
end;
$$;

reset role;
update public.avatar_cleanup_tasks set state = 'uploading', expires_at = now() - interval '1 minute'
where owner_sub = 'via_avatar_owner_test';
set local role authenticated;
do $$
declare
  path text := pg_temp.avatar_test_path('via_avatar_owner_test', 'b02e9ce0-0a90-4e7c-a5cb-f54ff20f228a');
begin
  if public.commit_profile_avatar(null, 'https://avatar-test.invalid/storage/v1/object/public/avatars/' || path, path) then
    raise exception 'Expired upload was committed';
  end if;
end;
$$;
select set_config('request.jwt.claims', '{"sub":"via_avatar_other_test","role":"authenticated"}', true);
do $$
begin
  if exists (select 1 from storage.objects where bucket_id = 'avatars') then raise exception 'Foreign object metadata exposed'; end if;
  if exists (select 1 from public.avatar_cleanup_tasks) then raise exception 'Foreign cleanup tasks exposed'; end if;
  begin
    insert into storage.objects (bucket_id, name)
    values ('avatars', pg_temp.avatar_test_path('via_avatar_owner_test', '12b387e1-81cb-462b-a279-fd777a181a7d'));
    raise exception 'Foreign upload permitted';
  exception when insufficient_privilege then null;
  end;
end;
$$;
reset role;
set local role anon;
do $$
begin
  if has_table_privilege('anon', 'public.avatar_cleanup_tasks', 'SELECT')
    or has_function_privilege('anon', 'public.commit_profile_avatar(text,text,text)', 'EXECUTE') then
    raise exception 'Anonymous role gained private avatar privileges';
  end if;
end;
$$;
rollback;
select 'Avatar ownership, private journal, CAS and expiry passed' as result;
