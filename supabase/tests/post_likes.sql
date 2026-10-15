begin;
create temporary table like_fixture (
  actor_a text, actor_b text, actor_mod text, actor_admin text, actor_missing text,
  profile_a uuid, post_id uuid, image_path text, operation uuid, lease uuid
);
insert into like_fixture (actor_a, actor_b, actor_mod, actor_admin, actor_missing, operation, lease)
select 'via_like_a_' || suffix, 'via_like_b_' || suffix, 'via_like_m_' || suffix,
  'via_like_d_' || suffix, 'via_like_none_' || suffix, gen_random_uuid(), gen_random_uuid()
from (select replace(gen_random_uuid()::text, '-', '') as suffix) as fixture;
insert into public.profiles (clerk_user_id, username, display_name, role)
select actor, 'like_' || substr(md5(actor), 1, 20), 'Like fixture', profile_role
from like_fixture cross join lateral (
  values (actor_a, 'user'), (actor_b, 'user'), (actor_mod, 'moderator'), (actor_admin, 'admin')
) as actors(actor, profile_role);
update like_fixture set profile_a = (select id from public.profiles where clerk_user_id = actor_a);
grant select, update on like_fixture to authenticated;
grant select on like_fixture to anon;
create function pg_temp.expect_like_failure(query text, expected text)
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
select set_config('request.jwt.claims', jsonb_build_object('sub', actor_a, 'role', 'authenticated')::text, true)
from like_fixture;
do $$
declare f like_fixture; ticket jsonb;
begin
  select * into f from like_fixture;
  ticket := public.begin_post_upload(f.operation, f.lease, 'Like fixture', '',
    (select id from public.categories limit 1), array['fixture'], repeat('c', 64));
  insert into storage.objects (bucket_id, name, owner_id) values ('posts', ticket->>'image_path', f.actor_a);
  update like_fixture set image_path = ticket->>'image_path',
    post_id = public.commit_post_upload(f.operation, f.lease);
end;
$$;

do $$
declare f like_fixture; reaction record;
begin
  select * into f from like_fixture;
  select * into reaction from public.set_post_like(f.post_id, true);
  if reaction.like_count <> 1 or not reaction.liked then raise exception 'Own post like failed'; end if;
  perform public.set_post_like(f.post_id, true);
  if (select count(*) from public.likes where post_id = f.post_id) <> 1 then raise exception 'Repeated like duplicated'; end if;
  perform pg_temp.expect_like_failure(format(
    'insert into public.likes (post_id,user_id) values (%L,%L)', f.post_id, f.profile_a), '42501');
  perform pg_temp.expect_like_failure(format(
    'update public.likes set created_at=now() where post_id=%L', f.post_id), '42501');
  perform pg_temp.expect_like_failure('select public.set_post_like(gen_random_uuid(),true)', 'P0002');
  perform pg_temp.expect_like_failure(format('select public.set_post_like(%L,null)', f.post_id), '22023');
  perform pg_temp.expect_like_failure('select public.get_post_likes(array[]::uuid[])', '22023');
  perform pg_temp.expect_like_failure('select public.get_post_likes(array_fill(gen_random_uuid(),array[13]))', '22023');
  perform pg_temp.expect_like_failure('select public.get_post_likes(array[null]::uuid[])', '22023');
end;
$$;

select set_config('request.jwt.claims', jsonb_build_object('sub', actor_b, 'role', 'authenticated')::text, true)
from like_fixture;
do $$
declare f like_fixture; reaction record;
begin
  select * into f from like_fixture;
  if exists (select 1 from public.likes where post_id = f.post_id) then raise exception 'Foreign likes visible'; end if;
  delete from public.likes where post_id = f.post_id;
  if found then raise exception 'Foreign unlike succeeded'; end if;
  select * into reaction from public.get_post_likes(array[f.post_id]);
  if reaction.like_count <> 1 or reaction.liked or not reaction.can_like then raise exception 'B initial projection failed'; end if;
  select * into reaction from public.set_post_like(f.post_id, true);
  if reaction.like_count <> 2 or not reaction.liked then raise exception 'B like on A failed'; end if;
  perform public.set_post_like(f.post_id, true);
  select * into reaction from public.set_post_like(f.post_id, false);
  if reaction.like_count <> 1 or reaction.liked then raise exception 'B unlike failed'; end if;
  perform public.set_post_like(f.post_id, false);
  insert into public.likes (post_id) values (f.post_id);
  perform pg_temp.expect_like_failure(format('insert into public.likes(post_id) values(%L)', f.post_id), '23505');
end;
$$;

do $$
declare f like_fixture; actor text; reaction record;
begin
  select * into f from like_fixture;
  foreach actor in array array[f.actor_mod, f.actor_admin] loop
    perform set_config('request.jwt.claims', jsonb_build_object('sub', actor, 'role', 'authenticated')::text, true);
    if exists (select 1 from public.likes where post_id = f.post_id) then raise exception 'Elevated role read foreign likes'; end if;
    delete from public.likes where post_id = f.post_id;
    if found then raise exception 'Elevated role deleted foreign likes'; end if;
    perform public.set_post_like(f.post_id, false);
    select * into reaction from public.get_post_likes(array[f.post_id]);
    if reaction.like_count <> 2 then raise exception 'Elevated role changed foreign counts'; end if;
  end loop;
  perform set_config('request.jwt.claims', jsonb_build_object('sub', f.actor_missing, 'role', 'authenticated')::text, true);
  perform pg_temp.expect_like_failure(format('select public.set_post_like(%L,true)', f.post_id), '42501');
  perform pg_temp.expect_like_failure(format('insert into public.likes(post_id) values(%L)', f.post_id), '42501');
  select * into reaction from public.get_post_likes(array[f.post_id]);
  if reaction.can_like or reaction.liked or reaction.like_count <> 2 then raise exception 'Missing profile projection failed'; end if;
end;
$$;

set local role anon;
select set_config('request.jwt.claims', '{"role":"anon"}', true);
do $$
declare f like_fixture; reaction record;
begin
  select * into f from like_fixture;
  select * into reaction from public.get_post_likes(array[f.post_id]);
  if reaction.like_count <> 2 or reaction.liked is not null or reaction.can_like then raise exception 'Anonymous projection failed'; end if;
  perform pg_temp.expect_like_failure('select * from public.likes', '42501');
  perform pg_temp.expect_like_failure(format('select public.set_post_like(%L,true)', f.post_id), '42501');
end;
$$;

set local role authenticated;
select set_config('request.jwt.claims', jsonb_build_object('sub', actor_a, 'role', 'authenticated')::text, true)
from like_fixture;
do $$
declare f like_fixture;
begin
  select * into f from like_fixture;
  delete from public.posts where id = f.post_id;
  if not found then raise exception 'Own post deletion failed'; end if;
  if exists (select 1 from public.get_post_likes(array[f.post_id]))
    or exists (select 1 from public.likes where post_id = f.post_id) then raise exception 'Deleted post retained reactions'; end if;
  if not exists (select 1 from public.post_uploads where operation_id = f.operation
    and state = 'cleanup' and post_id is null) then raise exception 'Image cleanup journal lost'; end if;
  perform pg_temp.expect_like_failure(format('select public.set_post_like(%L,true)', f.post_id), 'P0002');
end;
$$;
reset role;
do $$
begin
  if exists (select 1 from public.likes where post_id = (select post_id from like_fixture)) then
    raise exception 'Cascade left foreign likes';
  end if;
  if (select count(*) from public.profiles where clerk_user_id in
    (select actor_a from like_fixture union all select actor_b from like_fixture
      union all select actor_mod from like_fixture union all select actor_admin from like_fixture)) <> 4 then
    raise exception 'Post deletion removed profiles';
  end if;
end;
$$;
rollback;
select 'Likes A/B/anon/no-profile/elevated roles, idempotency, constraints and post cleanup passed; fixtures rolled back' as result;
