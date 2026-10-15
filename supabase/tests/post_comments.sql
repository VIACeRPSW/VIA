begin;
create temporary table comment_fixture (
  actor_a text, actor_b text, actor_missing text, actor_mod text, actor_admin text,
  post_id uuid, other_post_id uuid, operation uuid default gen_random_uuid(), comment_id uuid
);
insert into comment_fixture (actor_a, actor_b, actor_missing, actor_mod, actor_admin)
select 'via_comment_a_' || suffix, 'via_comment_b_' || suffix, 'via_comment_none_' || suffix,
  'via_comment_m_' || suffix, 'via_comment_d_' || suffix
from (select replace(gen_random_uuid()::text, '-', '') as suffix) as fixture;
insert into public.profiles (clerk_user_id, username, display_name, role)
select actor, 'comment_' || substr(md5(actor), 1, 20), 'Comment fixture', profile_role
from comment_fixture cross join lateral (
  values (actor_a, 'user'), (actor_b, 'user'), (actor_mod, 'moderator'), (actor_admin, 'admin')
) as actors(actor, profile_role);
grant select, update on comment_fixture to authenticated;
grant select on comment_fixture to anon;
create function pg_temp.expect_comment_failure(query text, expected text)
returns void language plpgsql as $$
begin
  begin execute query;
  exception when others then
    if sqlstate = expected then return; end if;
    raise;
  end;
  raise exception 'Expected SQLSTATE %', expected;
end;
$$;
set local role authenticated;
select set_config('request.jwt.claims', jsonb_build_object('sub', actor_a, 'role', 'authenticated',
  'exp', extract(epoch from now()) + 1800)::text, true)
from comment_fixture;
do $$
declare f comment_fixture; operation uuid; lease uuid; ticket jsonb; post uuid;
begin
  select * into f from comment_fixture;
  for index in 1..2 loop
    operation := gen_random_uuid(); lease := gen_random_uuid();
    ticket := public.begin_post_upload(operation, lease, 'Comment fixture', '',
      (select id from public.categories limit 1), array['fixture'], repeat('d', 64));
    insert into storage.objects (bucket_id, name, owner_id) values ('posts', ticket->>'image_path', f.actor_a);
    post := public.commit_post_upload(operation, lease);
    if index = 1 then update comment_fixture set post_id = post;
    else update comment_fixture set other_post_id = post; end if;
  end loop;
  if public.valid_comment_content('') or public.valid_comment_content(repeat('a', 1001))
    or public.valid_comment_content(E' \t\n') or public.valid_comment_content(U&'\FEFFa')
    or public.valid_comment_content(U&'a\00A0') then raise exception 'Invalid text accepted'; end if;
  if not public.valid_comment_content('a') or not public.valid_comment_content(repeat('a', 999))
    or not public.valid_comment_content(repeat(U&'\+01F600', 1000))
    or public.valid_comment_content(repeat(U&'\+01F600', 1001)) then raise exception 'Unicode boundary mismatch'; end if;
end;
$$;

select set_config('request.jwt.claims', jsonb_build_object('sub', actor_b, 'role', 'authenticated',
  'exp', extract(epoch from now()) + 1800)::text, true)
from comment_fixture;
do $$
declare f comment_fixture; result jsonb; repeated jsonb;
begin
  select * into f from comment_fixture;
  result := public.create_post_comment(f.post_id, '<script>inert</script>', f.operation);
  repeated := public.create_post_comment(f.post_id, '<script>inert</script>', f.operation);
  if result <> repeated or (result->>'commentCount')::int <> 1 then raise exception 'Comment retry duplicated'; end if;
  update comment_fixture set comment_id = (result->'comment'->>'id')::uuid;
  if result::text ~ '"(clerk_user_id|user_id|operation_id)"' then raise exception 'Private comment projection leaked'; end if;
  perform pg_temp.expect_comment_failure(format(
    'select public.create_post_comment(%L,%L,%L)', f.post_id, 'changed', f.operation), '23505');
  perform pg_temp.expect_comment_failure(format(
    'select public.create_post_comment(%L,%L,%L)', f.other_post_id, '<script>inert</script>', f.operation), '23505');
  perform pg_temp.expect_comment_failure(format(
    'select public.create_post_comment(%L,%L,gen_random_uuid())', f.post_id, ' '), '22023');
  perform pg_temp.expect_comment_failure(format(
    'select public.create_post_comment(%L,repeat(''a'',1001),gen_random_uuid())', f.post_id), '22023');
  perform pg_temp.expect_comment_failure(
    'select public.create_post_comment(gen_random_uuid(),''Missing'',gen_random_uuid())', 'P0002');
  perform pg_temp.expect_comment_failure(format(
    'insert into public.comments(post_id,content,operation_id,user_id) values(%L,''Spoof'',gen_random_uuid(),gen_random_uuid())', f.post_id), '42501');
  perform pg_temp.expect_comment_failure(format(
    'insert into public.comments(post_id,content,operation_id,created_at) values(%L,''Spoof'',gen_random_uuid(),now())', f.post_id), '42501');
  perform pg_temp.expect_comment_failure(format(
    'insert into public.comments(post_id,content,operation_id) values(%L,'' '',gen_random_uuid())', f.post_id), '23514');
  perform pg_temp.expect_comment_failure('update public.comments set content=''Changed''', '42501');
  perform pg_temp.expect_comment_failure('delete from public.comments', '42501');
  if (select count(*) from public.comments where post_id = f.post_id) <> 1 then raise exception 'Failed mutation left content'; end if;
end;
$$;
do $$
declare f comment_fixture; expiry jsonb;
begin
  select * into f from comment_fixture;
  for expiry in select value from jsonb_array_elements(
    jsonb_build_array(null, extract(epoch from now()) - 1, 'invalid')) as expirations(value) loop
    perform set_config('request.jwt.claims', jsonb_build_object(
      'sub', f.actor_b, 'role', 'authenticated', 'exp', expiry)::text, true);
    if public.comment_session_is_active() or exists (select 1 from public.comments where post_id = f.post_id) then
      raise exception 'Inactive session retained private comment access';
    end if;
    perform pg_temp.expect_comment_failure(format(
      'select public.create_post_comment(%L,''Expired'',gen_random_uuid())', f.post_id), '42501');
    perform pg_temp.expect_comment_failure(format(
      'insert into public.comments(post_id,content,operation_id) values(%L,''Expired'',gen_random_uuid())', f.post_id), '42501');
  end loop;
  perform set_config('request.jwt.claims', jsonb_build_object(
    'sub', f.actor_b, 'role', 'authenticated', 'exp', extract(epoch from now()) + 1800)::text, true);
end;
$$;
reset role;
insert into public.comments (post_id, user_id, operation_id, content, created_at)
select f.post_id, profile.id, gen_random_uuid(), 'Cursor fixture ' || index,
  '2026-01-01T12:00:00.123456Z'::timestamptz
from comment_fixture f join public.profiles profile on profile.clerk_user_id = f.actor_b
cross join generate_series(1, 25) as index;

set local role anon;
select set_config('request.jwt.claims', '{"role":"anon"}', true);
do $$
declare f comment_fixture; page jsonb; cursor jsonb; seen uuid[] := '{}'; ids uuid[]; pages int := 0;
begin
  select * into f from comment_fixture;
  loop
    page := public.get_public_post_comments(f.post_id,
      (cursor->>'before')::timestamptz, (cursor->>'beforeId')::uuid);
    pages := pages + 1;
    if (page->>'commentCount')::int <> 26 or jsonb_array_length(page->'comments') > 12 then
      raise exception 'Page count/size mismatch';
    end if;
    select array_agg((item->>'id')::uuid) into ids from jsonb_array_elements(page->'comments') item;
    if seen && ids then raise exception 'Cursor duplicated comments'; end if;
    seen := seen || ids;
    if page::text ~ '"(clerk_user_id|user_id|operation_id)"' then raise exception 'Public page leaked identity'; end if;
    cursor := nullif(page->'nextCursor', 'null'::jsonb);
    exit when cursor is null;
    if pages > 3 then raise exception 'Cursor did not advance'; end if;
    if (cursor->>'before')::timestamptz <> '2026-01-01T12:00:00.123456Z'::timestamptz then
      raise exception 'Cursor timestamp precision lost';
    end if;
  end loop;
  if cardinality(seen) <> 26 or pages <> 3 then raise exception 'Cursor omitted comments'; end if;
  page := public.get_public_post_comments(f.other_post_id);
  if jsonb_array_length(page->'comments') <> 0 or page->>'commentCount' <> '0'
    or page->'nextCursor' <> 'null'::jsonb then raise exception 'Empty page mismatch'; end if;
  if public.get_public_post_comments(gen_random_uuid()) is not null then raise exception 'Missing post not distinguished'; end if;
  if (select comment_count from public.get_post_comment_counts(array[f.post_id])) <> 26 then raise exception 'Batch count mismatch'; end if;
  perform pg_temp.expect_comment_failure('select * from public.comments', '42501');
  perform pg_temp.expect_comment_failure(format(
    'select public.create_post_comment(%L,''Anonymous'',gen_random_uuid())', f.post_id), '42501');
  perform pg_temp.expect_comment_failure(format(
    'select public.get_public_post_comments(%L,now(),null)', f.post_id), '22023');
  perform pg_temp.expect_comment_failure('select public.get_post_comment_counts(array[]::uuid[])', '22023');
  perform pg_temp.expect_comment_failure('select public.get_post_comment_counts(array_fill(gen_random_uuid(),array[13]))', '22023');
end;
$$;

set local role authenticated;
do $$
declare f comment_fixture; actor text;
begin
  select * into f from comment_fixture;
  foreach actor in array array[f.actor_a, f.actor_mod, f.actor_admin, f.actor_missing] loop
    perform set_config('request.jwt.claims', jsonb_build_object('sub', actor, 'role', 'authenticated',
      'exp', extract(epoch from now()) + 1800)::text, true);
    if exists (select 1 from public.comments where post_id = f.post_id) then raise exception 'Foreign private comments visible'; end if;
    perform pg_temp.expect_comment_failure('delete from public.comments', '42501');
  end loop;
  perform pg_temp.expect_comment_failure(format(
    'select public.create_post_comment(%L,''Missing profile'',gen_random_uuid())', f.post_id), '42501');
  perform set_config('request.jwt.claims', jsonb_build_object('sub', f.actor_a, 'role', 'authenticated',
    'exp', extract(epoch from now()) + 1800)::text, true);
  delete from public.posts where id = f.post_id;
  if not found then raise exception 'Author post deletion failed'; end if;
  if public.get_public_post_comments(f.post_id) is not null then raise exception 'Deleted post still readable'; end if;
  if not exists (select 1 from public.post_uploads where title = 'Comment fixture'
    and state = 'cleanup' and post_id is null) then raise exception 'Cleanup journal lost'; end if;
  perform pg_temp.expect_comment_failure(format(
    'select public.create_post_comment(%L,''Retired'',gen_random_uuid())', f.post_id), 'P0002');
end;
$$;
reset role;
do $$
begin
  if exists (select 1 from public.comments where post_id = (select post_id from comment_fixture)) then
    raise exception 'Post cascade left foreign comments';
  end if;
  if not exists (select 1 from public.posts where id = (select other_post_id from comment_fixture))
    or (select count(*) from public.profiles where clerk_user_id in (
      select actor_a from comment_fixture union all select actor_b from comment_fixture
      union all select actor_mod from comment_fixture union all select actor_admin from comment_fixture)) <> 4 then
    raise exception 'Post deletion damaged other resources';
  end if;
end;
$$;
rollback;
select 'Comments Unicode, idempotency, RLS, private projection, cursor ties and post cleanup passed; fixtures rolled back' as result;
