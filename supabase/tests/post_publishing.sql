begin;
-- Mirror the Storage API guard only for synthetic metadata inside this rolled-back test.
set local storage.allow_delete_query = 'true';
create function pg_temp.expect_publish_failure(p_sql text, p_state text)
returns void language plpgsql security invoker as $$
begin
  begin execute p_sql;
  exception when others then
    if sqlstate = p_state then return; end if;
    raise;
  end;
  raise exception 'Expected SQLSTATE %', p_state;
end;
$$;
insert into public.profiles(clerk_user_id,username,display_name,role) values
  ('via_publish_a','via_publish_a','Publish A','user'),
  ('via_publish_b','via_publish_b','Publish B','user'),
  ('via_publish_mod','via_publish_mod','Publish moderator','moderator'),
  ('via_publish_admin','via_publish_admin','Publish admin','admin');
create temporary table publish_fixture (
  operation_id uuid default gen_random_uuid(), lease_id uuid default gen_random_uuid(),
  image_path text, post_id uuid
);
insert into publish_fixture default values;
grant all on table publish_fixture to authenticated;

set local role authenticated;
select set_config('request.jwt.claims','{"sub":"via_publish_a","role":"authenticated"}',true);
do $$
declare
  fixture publish_fixture;
  result jsonb;
  category uuid := (select id from public.categories where name='Ciencia');
  invalid_tags text[];
  invalid_title text;
begin
  select * into fixture from publish_fixture;
  foreach invalid_title in array array['', ' ', E'\tTitle', U&'\FEFFTitle', repeat('x',121)] loop
    perform pg_temp.expect_publish_failure(format(
      'select public.begin_post_upload(gen_random_uuid(),gen_random_uuid(),%L,'''',%L,array[''ok''],%L)',
      invalid_title,category,repeat('a',64)), '23514');
  end loop;
  for invalid_tags in select tags from (values
    (array[]::text[]),(array['a']),(array[repeat('x',31)]),(array['ok','ok']),
    (array['OK']),(array[U&'a\0301rbol']),(array['bad tag']),(array['#tag']),
    (array['aa','bb','cc','dd','ee','ff']),(array['aa',null])
  ) cases(tags) loop
    perform pg_temp.expect_publish_failure(format(
      'select public.begin_post_upload(gen_random_uuid(),gen_random_uuid(),''Title'','''',%L,%L,%L)',
      category,invalid_tags,repeat('a',64)), '23514');
  end loop;
  perform pg_temp.expect_publish_failure(format(
    'select public.begin_post_upload(gen_random_uuid(),gen_random_uuid(),''Title'',%L,%L,array[''ok''],%L)',
    repeat('x',2001),category,repeat('a',64)), '23514');
  perform pg_temp.expect_publish_failure(format(
    'select public.begin_post_upload(gen_random_uuid(),gen_random_uuid(),''Title'','''',gen_random_uuid(),array[''ok''],%L)',
    repeat('a',64)), '23503');
  result := public.begin_post_upload(fixture.operation_id,fixture.lease_id,repeat('t',120),repeat('d',2000),
    category,array['aa',U&'ni\00F1os',U&'\00E1rbol',U&'\4E2D\6587',repeat('x',30)],repeat('a',64));
  if result->>'status' <> 'ready' then raise exception 'Valid upload did not start'; end if;
  update publish_fixture set image_path=result->>'image_path';
  select * into fixture from publish_fixture;
  if (public.begin_post_upload(fixture.operation_id,gen_random_uuid(),repeat('t',120),repeat('d',2000),
    category,array['aa',U&'ni\00F1os',U&'\00E1rbol',U&'\4E2D\6587',repeat('x',30)],repeat('a',64))->>'status') <> 'busy' then
    raise exception 'Concurrent upload acquired an active lease';
  end if;
  if (public.begin_post_upload(fixture.operation_id,gen_random_uuid(),'Changed','',
    category,array['aa'],repeat('b',64))->>'status') <> 'conflict' then
    raise exception 'Changed operation payload was accepted';
  end if;
  perform pg_temp.expect_publish_failure(format(
    'select public.commit_post_upload(%L,%L)',fixture.operation_id,fixture.lease_id), '42501');
  perform pg_temp.expect_publish_failure(format(
    'select public.finish_post_cleanup(%L)',fixture.operation_id), '42501');
  perform pg_temp.expect_publish_failure(format(
    'insert into public.posts(category_id,title,hashtags,image_path,operation_id) values (%L,''Bypass'',array[''ok''],%L,gen_random_uuid())',
    category,fixture.image_path), '42501');
  insert into storage.objects(bucket_id,name,owner_id)
  values ('posts',fixture.image_path,'via_publish_a');
end;
$$;

select set_config('request.jwt.claims','{"sub":"via_publish_b","role":"authenticated"}',true);
do $$
declare fixture publish_fixture;
begin
  select * into fixture from publish_fixture;
  if exists(select 1 from public.post_uploads) then raise exception 'Foreign journal exposed'; end if;
  if exists(select 1 from storage.objects where bucket_id='posts' and name=fixture.image_path) then
    raise exception 'Pending private upload exposed';
  end if;
  perform pg_temp.expect_publish_failure(format(
    'select public.commit_post_upload(%L,%L)',fixture.operation_id,fixture.lease_id), 'P0002');
  perform pg_temp.expect_publish_failure(format(
    'insert into storage.objects(bucket_id,name,owner_id) values (''posts'',%L,''via_publish_b'')',fixture.image_path), '42501');
  delete from storage.objects where bucket_id='posts' and name=fixture.image_path;
  if found then raise exception 'Foreign upload deleted'; end if;
end;
$$;
set local role anon;
select set_config('request.jwt.claims','{}',true);
do $$
begin
  if exists(select 1 from public.get_public_posts(p_author_username=>'via_publish_a')) then
    raise exception 'Pending upload became a public post';
  end if;
  if exists(select 1 from storage.objects where bucket_id='posts'
    and name like encode(sha256(convert_to('via_publish_a','UTF8')),'hex')||'/%') then
    raise exception 'Anonymous role sees pending upload';
  end if;
  perform pg_temp.expect_publish_failure('select * from public.post_uploads', '42501');
  perform pg_temp.expect_publish_failure('select * from public.posts', '42501');
  perform pg_temp.expect_publish_failure('select public.commit_post_upload(gen_random_uuid(),gen_random_uuid())', '42501');
end;
$$;

set local role authenticated;
select set_config('request.jwt.claims','{"sub":"via_publish_a","role":"authenticated"}',true);
do $$
declare fixture publish_fixture; first_id uuid; fields text[];
begin
  select * into fixture from publish_fixture;
  perform pg_temp.expect_publish_failure(format(
    'select public.commit_post_upload(%L,null)',fixture.operation_id), '42501');
  first_id := public.commit_post_upload(fixture.operation_id,fixture.lease_id);
  update publish_fixture set post_id=first_id;
  if public.commit_post_upload(fixture.operation_id,fixture.lease_id) <> first_id
    or (select count(*) from public.posts) <> 1 then raise exception 'Commit duplicated a post'; end if;
  if (public.begin_post_upload(fixture.operation_id,gen_random_uuid(),repeat('t',120),repeat('d',2000),
    (select id from public.categories where name='Ciencia'),
    array['aa',U&'ni\00F1os',U&'\00E1rbol',U&'\4E2D\6587',repeat('x',30)],repeat('a',64))->>'post_id') <> first_id::text then
    raise exception 'Lost response cannot recover the published post';
  end if;
  perform public.abort_post_upload(fixture.operation_id,fixture.lease_id);
  if (select state from public.post_uploads where operation_id=fixture.operation_id) <> 'published' then
    raise exception 'Abort removed a confirmed post';
  end if;
  delete from storage.objects where bucket_id='posts' and name=fixture.image_path;
  if found then raise exception 'Active post image deleted'; end if;
  perform pg_temp.expect_publish_failure(format('select public.finish_post_cleanup(%L)',fixture.operation_id), '42501');
  select array_agg(key order by key) into fields from jsonb_object_keys(
    (select to_jsonb(post) from public.get_public_posts(p_id=>first_id) post)) key;
  if fields is distinct from array['author_avatar_url','author_display_name','author_username',
    'category_id','category_name','created_at','description','hashtags','id','image_path','title','updated_at'] then
    raise exception 'Public projection exposed internal fields';
  end if;
  update public.posts set title='x', description='', hashtags=array['ok'] where id=first_id and version=1;
  if not found then raise exception 'Own metadata update failed'; end if;
  update public.posts set title='Stale' where id=first_id and version=1;
  if found then raise exception 'Stale version updated a post'; end if;
  perform pg_temp.expect_publish_failure(format(
    'update public.posts set hashtags=array[]::text[] where id=%L',first_id),'23514');
  perform pg_temp.expect_publish_failure(format(
    'update public.posts set user_id=gen_random_uuid() where id=%L',first_id),'42501');
end;
$$;

do $$
declare actor text; fixture publish_fixture;
begin
  select * into fixture from publish_fixture;
  foreach actor in array array['via_publish_b','via_publish_mod','via_publish_admin'] loop
    perform set_config('request.jwt.claims',jsonb_build_object('sub',actor,'role','authenticated')::text,true);
    if exists(select 1 from public.posts) then raise exception 'Foreign private rows exposed'; end if;
    update public.posts set title='Foreign' where id=fixture.post_id;
    if found then raise exception 'Role updated a foreign post'; end if;
    delete from public.posts where id=fixture.post_id;
    if found then raise exception 'Role deleted a foreign post'; end if;
    delete from storage.objects where bucket_id='posts' and name=fixture.image_path;
    if found then raise exception 'Role deleted a foreign image'; end if;
  end loop;
end;
$$;
set local role anon;
select set_config('request.jwt.claims','{}',true);
do $$
begin
  if (select count(*) from public.get_public_posts(p_author_username=>'via_publish_a')) <> 1 then
    raise exception 'Confirmed post is not public';
  end if;
  if (select count(*) from storage.objects where bucket_id='posts'
    and name like encode(sha256(convert_to('via_publish_a','UTF8')),'hex')||'/%') <> 1 then
    raise exception 'Confirmed image cannot be signed publicly';
  end if;
end;
$$;
set local role authenticated;
select set_config('request.jwt.claims','{"sub":"via_publish_a","role":"authenticated"}',true);
delete from public.posts where id=(select post_id from publish_fixture);
do $$
begin
  if exists(select 1 from public.get_public_posts(p_author_username=>'via_publish_a'))
    or (select state from public.post_uploads where operation_id=(select operation_id from publish_fixture)) <> 'cleanup' then
    raise exception 'Post retirement did not schedule cleanup';
  end if;
end;
$$;
rollback;
select 'Post publishing leases, idempotency, private Storage, public read and role matrix passed' as result;
