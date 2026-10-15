begin;

create function pg_temp.expect_post_failure(p_sql text, p_state text)
returns void language plpgsql security invoker as $$
begin
  begin
    execute p_sql;
  exception when others then
    if sqlstate = p_state then return; end if;
    raise;
  end;
  raise exception 'Expected SQLSTATE % for %', p_state, p_sql;
end;
$$;

insert into public.profiles (clerk_user_id, username, display_name, role) values
  ('via_posts_a', 'via_posts_a', 'Post owner A', 'user'),
  ('via_posts_b', 'via_posts_b', 'Post owner B', 'user'),
  ('via_posts_mod', 'via_posts_mod', 'Post moderator', 'moderator'),
  ('via_posts_admin', 'via_posts_admin', 'Post admin', 'admin');

-- Transaction-only metadata fixtures; no Storage API or physical files.
insert into storage.buckets (id, name, public) values ('posts', 'posts', false)
on conflict (id) do nothing;
create temporary table post_test_images as
select actor, encode(sha256(convert_to(actor, 'UTF8')), 'hex') || '/' || gen_random_uuid() || '.webp' as path,
  n from unnest(array['via_posts_a', 'via_posts_b', 'via_posts_mod', 'via_posts_admin']) actor
cross join generate_series(1, 22) n;
grant select on table post_test_images to anon, authenticated;
insert into storage.objects (bucket_id, name, owner_id)
select 'posts', path, case when actor = 'via_posts_a' and n = 19 then 'via_posts_b' else actor end
from post_test_images;

set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"via_posts_a","role":"authenticated"}', true);

do $$
declare
  category uuid := (select id from public.categories where name = 'Historia');
  image text := (select path from post_test_images where actor = 'via_posts_a' and n = 1);
  invalid text[];
  bad_title text;
  record public.posts;
begin
  if public.current_post_profile_id() is distinct from
    (select id from public.profiles where clerk_user_id = 'via_posts_a') then
    raise exception 'Author does not resolve from the Clerk subject';
  end if;

  for invalid in select tags from (values
    (array['x']), (array[repeat('x', 31)]), (array['#historia']), (array['dos palabras']),
    (array['Historia']), (array[U&'a\0301rbol']), (array['emoji' || chr(128512)]),
    (array['ok', 'ok']), (array[]::text[]), (array['ok', null]),
    (array['aa', 'bb', 'cc', 'dd', 'ee', 'ff'])
  ) as cases(tags) loop
    perform pg_temp.expect_post_failure(format(
      'insert into public.posts(category_id,title,hashtags,image_path,operation_id) values (%L,%L,%L,%L,gen_random_uuid())',
      category, 'Invalid hashtags', invalid, image), '23514');
  end loop;
  if public.valid_post_hashtags(null) or public.valid_post_hashtags(array[]::text[])
    or public.valid_post_hashtags(array[['aa', 'bb'], ['cc', 'dd']])
    or public.valid_post_hashtags('[0:0]={ok}'::text[]) then
    raise exception 'Null, empty, multidimensional or nonstandard arrays accepted';
  end if;
  if not public.valid_post_hashtags(array[U&'ciencia', U&'ni\00F1os', U&'\00E1rbol', U&'\4E2D\6587', repeat('x', 30)])
    or not public.valid_post_hashtags(array['ab']) then
    raise exception 'Valid Unicode or exact tag boundaries rejected';
  end if;

  foreach bad_title in array array['', ' ', ' untrimmed', E'\tTitle', U&'\FEFFTitle', repeat('x', 121)] loop
    perform pg_temp.expect_post_failure(format(
      'insert into public.posts(category_id,title,hashtags,image_path,operation_id) values (%L,%L,array[''ok''],%L,gen_random_uuid())',
      category, bad_title, image), '23514');
  end loop;
  perform pg_temp.expect_post_failure(format(
    'insert into public.posts(category_id,title,description,hashtags,image_path,operation_id) values (%L,''x'',%L,array[''ok''],%L,gen_random_uuid())',
    category, repeat('x', 2001), image), '23514');
  perform pg_temp.expect_post_failure(format(
    'insert into public.posts(category_id,title,hashtags,image_path,operation_id) values (gen_random_uuid(),''x'',array[''ok''],%L,gen_random_uuid())',
    image), '23503');
  perform pg_temp.expect_post_failure(format(
    'insert into public.posts(category_id,title,hashtags,image_path,operation_id) values (%L,''x'',null,%L,gen_random_uuid())',
    category, image), '23502');
  perform pg_temp.expect_post_failure(format(
    'insert into public.posts(user_id,category_id,title,hashtags,image_path,operation_id) values (gen_random_uuid(),%L,''x'',array[''ok''],%L,gen_random_uuid())',
    category, image), '42501');

  insert into public.posts(category_id, title, description, hashtags, image_path, operation_id)
  values (category, repeat('x',120), repeat('x',2000),
    array['aa', 'bb', 'cc', 'dd', repeat('e',30)], image, gen_random_uuid())
  returning * into record;
  if record.version <> 1 or record.status <> 'published' then
    raise exception 'Server-owned defaults are incorrect';
  end if;
  perform pg_temp.expect_post_failure(format(
    'insert into public.posts(category_id,title,hashtags,image_path,operation_id) values (%L,''duplicate operation'',array[''ok''],%L,%L)',
    category, (select path from post_test_images where actor = 'via_posts_a' and n = 22), record.operation_id), '23505');
  perform pg_temp.expect_post_failure(format(
    'insert into public.posts(category_id,title,hashtags,image_path,operation_id) values (%L,''duplicate image'',array[''ok''],%L,gen_random_uuid())',
    category, image), '23505');

  update public.posts set title = 'x', description = '', hashtags = array[U&'ni\00F1os']
  where id = record.id and version = 1;
  if not found then raise exception 'Own versioned update failed'; end if;
  update public.posts set title = 'Stale' where id = record.id and version = 1;
  if found then raise exception 'Stale version overwrote a post'; end if;
  if (select version from public.posts where id = record.id) <> 2 then
    raise exception 'Version was not incremented';
  end if;
  perform pg_temp.expect_post_failure(format(
    'update public.posts set title = ''Partial'', hashtags = array[]::text[] where id = %L', record.id), '23514');
  if (select title from public.posts where id = record.id) <> 'x' then
    raise exception 'Invalid hashtags partially changed a post';
  end if;
  perform pg_temp.expect_post_failure(format(
    'update public.posts set user_id = gen_random_uuid() where id = %L', record.id), '42501');
  perform pg_temp.expect_post_failure(format(
    'update public.posts set version = 100 where id = %L', record.id), '42501');
  perform pg_temp.expect_post_failure(format(
    'update public.posts set status = ''draft'' where id = %L', record.id), '42501');
  perform pg_temp.expect_post_failure(format(
    'update public.posts set created_at = now() where id = %L', record.id), '42501');
end;
$$;

insert into public.posts(category_id, title, hashtags, image_path, operation_id)
select (select id from public.categories where name = 'Historia'), 'Cursor fixture ' || n,
  array['historia'], path, gen_random_uuid()
from post_test_images where actor = 'via_posts_a' and n between 2 and 17;

reset role;
set local role anon;
select set_config('request.jwt.claims', '{}', true);
do $$
declare
  first_ids uuid[];
  second_ids uuid[];
  cursor_time timestamptz;
  cursor_id uuid;
  fields text[];
begin
  if (select count(*) from public.categories) <> 5 then raise exception 'Category seed differs'; end if;
  perform pg_temp.expect_post_failure('select * from public.posts', '42501');
  perform pg_temp.expect_post_failure(
    'insert into public.posts(category_id,title,hashtags,image_path,operation_id) values (gen_random_uuid(),''Anon'',array[''ok''],''invalid'',gen_random_uuid())',
    '42501');
  perform pg_temp.expect_post_failure('delete from public.posts', '42501');
  perform pg_temp.expect_post_failure('select clerk_user_id from public.profiles', '42501');
  perform pg_temp.expect_post_failure('insert into public.categories(name) values (''Forged'')', '42501');
  perform pg_temp.expect_post_failure('select public.current_post_profile_id()', '42501');
  perform pg_temp.expect_post_failure('select public.owns_post_image(''foreign'')', '42501');
  perform pg_temp.expect_post_failure('select * from public.get_public_posts(p_before_id => gen_random_uuid())', '22023');
  perform pg_temp.expect_post_failure('select * from public.get_public_posts(p_author_username => ''Via_Posts_A'')', '22023');
  select array_agg(post.id) into first_ids from public.get_public_posts(p_author_username => 'via_posts_a') post;
  if cardinality(first_ids) <> 12 then raise exception 'First page is not 12 posts'; end if;
  select post.created_at, post.id into cursor_time, cursor_id
  from public.get_public_posts(p_author_username => 'via_posts_a') post
  order by post.created_at, post.id limit 1;
  select array_agg(post.id) into second_ids from public.get_public_posts(
    p_author_username => 'via_posts_a', p_before_created_at => cursor_time, p_before_id => cursor_id
  ) post;
  if cardinality(second_ids) <> 5 or first_ids && second_ids then
    raise exception 'Cursor skipped or duplicated tied posts';
  end if;
  if exists (
    select 1 from public.get_public_posts(p_author_username => 'via_posts_a') post
    where post.created_at <> cursor_time
  ) then raise exception 'Timestamp tie fixture is not effective'; end if;
  select array_agg(key order by key) into fields from jsonb_object_keys(
    (select to_jsonb(post) from public.get_public_posts(p_id => first_ids[1]) post)
  ) key;
  if fields is distinct from array[
    'author_avatar_url','author_display_name','author_username','category_id','category_name',
    'created_at','description','hashtags','id','image_path','title','updated_at'
  ] then raise exception 'Public post projection leaked or omitted fields'; end if;
  if exists (select 1 from public.get_public_posts(p_id => gen_random_uuid())) then
    raise exception 'Missing detail returned a post';
  end if;
end;
$$;

set local role authenticated;
do $$
declare
  actor_sub text;
  target uuid;
  image text;
  category uuid := (select id from public.categories where name = 'Ciencia');
begin
  foreach actor_sub in array array['via_posts_b', 'via_posts_mod', 'via_posts_admin'] loop
    perform set_config('request.jwt.claims', jsonb_build_object('sub',actor_sub,'role','authenticated')::text, true);
    if exists (select 1 from public.posts) then raise exception 'Actor % can read foreign private rows', actor_sub; end if;
    select post.id into target from public.get_public_posts(p_author_username => 'via_posts_a') post limit 1;
    update public.posts set title = 'Foreign edit' where id = target;
    if found then raise exception 'Actor % updated foreign post', actor_sub; end if;
    delete from public.posts where id = target;
    if found then raise exception 'Actor % deleted foreign post', actor_sub; end if;
    image := (select path from post_test_images where post_test_images.actor = actor_sub and n = 1);
    insert into public.posts(category_id,title,hashtags,image_path,operation_id)
    values (category,'Own role post',array['ciencia'],image,gen_random_uuid())
    returning id into target;
    update public.posts set title = 'Own role edit' where id = target;
    if not found then raise exception 'Actor % could not edit own post', actor_sub; end if;
    delete from public.posts where id = target;
    if not found then raise exception 'Actor % could not delete own post', actor_sub; end if;
    perform pg_temp.expect_post_failure('update public.categories set name = ''Unauthorized''', '42501');
  end loop;
end;
$$;

select set_config('request.jwt.claims', '{"sub":"via_posts_a","role":"admin"}', true);
do $$
declare
  category uuid := (select id from public.categories where name = 'Historia');
  own_image text := (select path from post_test_images where actor = 'via_posts_a' and n = 18);
  foreign_image text := (select path from post_test_images where actor = 'via_posts_b' and n = 18);
  mismatched_image text := (select path from post_test_images where actor = 'via_posts_a' and n = 19);
  missing_image text := encode(sha256(convert_to('via_posts_a','UTF8')),'hex') || '/' || gen_random_uuid() || '.webp';
  existing_id uuid := (select id from public.posts limit 1);
begin
  if public.owns_post_image(foreign_image) or public.owns_post_image(missing_image)
    or public.owns_post_image(mismatched_image) then
    raise exception 'Foreign or missing image accepted';
  end if;
  perform pg_temp.expect_post_failure(format(
    'insert into public.posts(category_id,title,hashtags,image_path,operation_id) values (%L,''foreign image'',array[''ok''],%L,gen_random_uuid())',
    category, foreign_image), '42501');
  perform pg_temp.expect_post_failure(format(
    'insert into public.posts(category_id,title,hashtags,image_path,operation_id) values (%L,''missing image'',array[''ok''],%L,gen_random_uuid())',
    category, missing_image), '42501');
  perform pg_temp.expect_post_failure(format(
    'insert into public.posts(category_id,title,hashtags,image_path,operation_id) values (%L,''mismatched owner'',array[''ok''],%L,gen_random_uuid())',
    category, mismatched_image), '42501');
  perform pg_temp.expect_post_failure(format(
    'update public.posts set image_path = %L where id = %L', foreign_image, existing_id), '42501');
  foreach foreign_image in array array['https://foreign.example/image.webp', '../image.webp', 'not-a-path'] loop
    perform pg_temp.expect_post_failure(format(
      'insert into public.posts(category_id,title,hashtags,image_path,operation_id) values (%L,''bad path'',array[''ok''],%L,gen_random_uuid())',
      category, foreign_image), '42501');
  end loop;
  perform set_config('request.jwt.claims', '{}', true);
  perform pg_temp.expect_post_failure(format(
    'insert into public.posts(category_id,title,hashtags,image_path,operation_id) values (%L,''no subject'',array[''ok''],%L,gen_random_uuid())',
    category, own_image), '42501');
  perform set_config('request.jwt.claims', '{"sub":42}', true);
  perform pg_temp.expect_post_failure(format(
    'insert into public.posts(category_id,title,hashtags,image_path,operation_id) values (%L,''invalid subject'',array[''ok''],%L,gen_random_uuid())',
    category, own_image), '42501');
  perform set_config('request.jwt.claims', '{"sub":"via_posts_without_profile","role":"authenticated"}', true);
  if public.current_post_profile_id() is not null then raise exception 'Missing profile resolved an author'; end if;
  perform pg_temp.expect_post_failure(format(
    'insert into public.posts(category_id,title,hashtags,image_path,operation_id) values (%L,''no profile'',array[''ok''],%L,gen_random_uuid())',
    category, own_image), '42501');
end;
$$;

reset role;
do $$
declare
  target uuid := (select post.id from public.posts post
    join public.profiles profile on profile.id = post.user_id where profile.clerk_user_id = 'via_posts_a' limit 1);
begin
  perform pg_temp.expect_post_failure(format(
    'update public.posts set user_id = gen_random_uuid() where id = %L', target), '42501');
  perform pg_temp.expect_post_failure(format(
    'update public.posts set operation_id = gen_random_uuid() where id = %L', target), '42501');
  perform pg_temp.expect_post_failure(format(
    'update public.posts set status = ''draft'' where id = %L', target), '42501');
  perform pg_temp.expect_post_failure(format(
    'insert into public.posts(user_id,category_id,title,hashtags,image_path,operation_id,status) select user_id,category_id,''Draft'',hashtags,%L,gen_random_uuid(),''draft'' from public.posts where id=%L',
    (select path from post_test_images where actor='via_posts_a' and n=20), target), '23514');
end;
$$;

-- POSTS_ROLLBACK_GUARD
delete from public.posts where user_id in (select id from public.profiles where clerk_user_id in
  ('via_posts_a','via_posts_b','via_posts_mod','via_posts_admin'));
rollback;
select 'Posts contracts, public projection, tied cursor and ownership matrix passed' as result;
