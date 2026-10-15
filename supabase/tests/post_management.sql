begin;
insert into public.profiles(clerk_user_id,username,display_name) values
  ('via_manage_a','via_manage_a','Manage A'),('via_manage_b','via_manage_b','Manage B');
create temporary table management_fixture(
  post_id uuid, old_path text, new_path text,
  operation uuid default gen_random_uuid(), lease uuid default gen_random_uuid()
);
insert into management_fixture default values;
grant all on management_fixture to authenticated;
create function pg_temp.expect_management_failure(query text, expected text)
returns void language plpgsql as $$
begin
  begin execute query;
  exception when others then
    if sqlstate=expected then return; end if;
    raise;
  end;
  raise exception 'Expected SQLSTATE %',expected;
end;
$$;
set local role authenticated;
select set_config('request.jwt.claims','{"sub":"via_manage_a","role":"authenticated"}',true);
do $$
declare f management_fixture; ticket jsonb; original_operation uuid := gen_random_uuid(); original_lease uuid := gen_random_uuid();
begin
  select * into f from management_fixture;
  ticket := public.begin_post_upload(original_operation,original_lease,'Original','',
    (select id from public.categories limit 1),array['original'],repeat('a',64));
  insert into storage.objects(bucket_id,name,owner_id) values('posts',ticket->>'image_path','via_manage_a');
  update management_fixture set old_path=ticket->>'image_path',
    post_id=public.commit_post_upload(original_operation,original_lease);
  ticket := public.begin_post_upload(f.operation,f.lease,'Replaced','New description',
    (select id from public.categories limit 1),array['updated'],repeat('b',64));
  update management_fixture set new_path=ticket->>'image_path';
  select * into f from management_fixture;
  perform pg_temp.expect_management_failure(format(
    'select public.commit_post_image_replacement(%L,1,%L,%L)',f.post_id,f.operation,f.lease),'42501');
  insert into storage.objects(bucket_id,name,owner_id) values('posts',f.new_path,'via_manage_a');
  perform pg_temp.expect_management_failure(format(
    'select public.commit_post_image_replacement(%L,1,%L,null)',f.post_id,f.operation),'42501');
  perform pg_temp.expect_management_failure(format(
    'select public.commit_post_image_replacement(%L,2,%L,%L)',f.post_id,f.operation,f.lease),'40001');
  if (select image_path from public.posts where id=f.post_id)<>f.old_path then raise exception 'Original lost on failed replacement'; end if;
end;
$$;
select set_config('request.jwt.claims','{"sub":"via_manage_b","role":"authenticated"}',true);
do $$
declare f management_fixture;
begin
  select * into f from management_fixture;
  perform pg_temp.expect_management_failure(format(
    'select public.commit_post_image_replacement(%L,1,%L,%L)',f.post_id,f.operation,f.lease),'P0002');
  update public.posts set title='Foreign' where id=f.post_id;
  if found then raise exception 'Foreign metadata changed'; end if;
  delete from public.posts where id=f.post_id;
  if found then raise exception 'Foreign post deleted'; end if;
end;
$$;
select set_config('request.jwt.claims','{"sub":"via_manage_a","role":"authenticated"}',true);
do $$
declare f management_fixture; committed uuid;
begin
  select * into f from management_fixture;
  committed := public.commit_post_image_replacement(f.post_id,1,f.operation,f.lease);
  if committed<>f.post_id or (select count(*) from public.posts)<>1 then raise exception 'Replacement duplicated post'; end if;
  if (select version from public.posts where id=f.post_id)<>2
    or (select title from public.posts where id=f.post_id)<>'Replaced'
    or (select image_path from public.posts where id=f.post_id)<>f.new_path then raise exception 'Replacement data mismatch'; end if;
  if not exists(select 1 from public.post_uploads where image_path=f.old_path and state='cleanup' and post_id is null)
    or not exists(select 1 from public.post_uploads where image_path=f.new_path and state='published' and post_id=f.post_id) then
    raise exception 'Replacement cleanup journal mismatch';
  end if;
  if public.is_public_post_image(f.old_path) or not public.is_public_post_image(f.new_path) then raise exception 'Public image reference not switched'; end if;
  if public.commit_post_image_replacement(f.post_id,1,f.operation,f.lease)<>f.post_id
    or (select version from public.posts where id=f.post_id)<>2 then raise exception 'Repeated replacement was not idempotent'; end if;
  update public.posts set title='Metadata only',hashtags=array['metadata'] where id=f.post_id and version=2;
  if not found then raise exception 'Metadata editing failed'; end if;
  update public.posts set title='Stale' where id=f.post_id and version=2;
  if found then raise exception 'Stale editor overwrote metadata'; end if;
  delete from public.posts where id=f.post_id and version=2;
  if found then raise exception 'Stale deletion succeeded'; end if;
  delete from public.posts where id=f.post_id and version=3;
  if not found then raise exception 'Own deletion failed'; end if;
  delete from public.posts where id=f.post_id;
  if found then raise exception 'Repeated deletion found another post'; end if;
  if public.is_public_post_image(f.new_path)
    or exists(select 1 from public.post_uploads where state='published') then raise exception 'Deletion left active image'; end if;
end;
$$;
set local role anon;
select set_config('request.jwt.claims','{}',true);
select pg_temp.expect_management_failure(
  'select public.commit_post_image_replacement(gen_random_uuid(),1,gen_random_uuid(),gen_random_uuid())','42501');
rollback;
select 'Post image replacement, version conflicts, own metadata, deletion and cleanup journals passed' as result;
