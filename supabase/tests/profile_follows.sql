begin;
create temporary table follow_fixture (
  actor_a text, actor_b text, actor_mod text, actor_admin text, actor_missing text,
  a uuid, b uuid, old_username text, new_username text
);
insert into follow_fixture(actor_a, actor_b, actor_mod, actor_admin, actor_missing, new_username)
select 'via_follow_a_' || suffix, 'via_follow_b_' || suffix, 'via_follow_m_' || suffix,
  'via_follow_d_' || suffix, 'via_follow_none_' || suffix, 'fr_' || substr(suffix,1,20)
from (select replace(gen_random_uuid()::text,'-','') as suffix) fixture;
insert into public.profiles(clerk_user_id, username, display_name, role)
select actor, 'follow_' || substr(md5(actor),1,20), 'Follow fixture', profile_role
from follow_fixture cross join lateral (
  values (actor_a,'user'),(actor_b,'user'),(actor_mod,'moderator'),(actor_admin,'admin')
) actors(actor,profile_role);
update follow_fixture set
  a = (select id from public.profiles where clerk_user_id = actor_a),
  b = (select id from public.profiles where clerk_user_id = actor_b),
  old_username = (select username from public.profiles where clerk_user_id = actor_a);
grant select on follow_fixture to anon, authenticated;
create function pg_temp.expect_follow_failure(query text, expected text)
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
create function pg_temp.follow_as(actor text, expiry jsonb default to_jsonb(extract(epoch from now()) + 1800),
  not_before jsonb default null)
returns void language plpgsql as $$
begin
  perform set_config('request.jwt.claims', jsonb_strip_nulls(jsonb_build_object(
    'sub',actor,'role','authenticated','exp',expiry,'nbf',not_before))::text,true);
end;
$$;
set local role authenticated;
select pg_temp.follow_as(actor_b) from follow_fixture;
do $$
declare f follow_fixture; first_result jsonb;
begin
  select * into f from follow_fixture;
  first_result := public.set_profile_follow(f.a,true);
  if first_result <> public.set_profile_follow(f.a,true)
    or first_result->'summary'->>'follower_count' <> '1'
    or first_result->'summary'->>'following' <> 'true'
    or (select count(*) from public.follows) <> 1 then raise exception 'Follow retry duplicated'; end if;
  if first_result::text ~ '"(clerk_user_id|follower_id|following_id)"' then raise exception 'Follow projection leaked'; end if;
  perform pg_temp.expect_follow_failure(format('select public.set_profile_follow(%L,true)',f.b),'22023');
  perform pg_temp.expect_follow_failure('select public.set_profile_follow(gen_random_uuid(),true)','P0002');
  perform pg_temp.expect_follow_failure('select public.set_profile_follow(null,true)','22023');
  perform pg_temp.expect_follow_failure(format(
    'insert into public.follows(following_id,follower_id) values(%L,%L)',f.a,f.a),'42501');
  perform pg_temp.expect_follow_failure(format(
    'insert into public.follows(following_id,created_at) values(%L,now())',f.a),'42501');
  perform pg_temp.expect_follow_failure(format('insert into public.follows(following_id) values(%L)',f.b),'23514');
  perform pg_temp.expect_follow_failure(format('insert into public.follows(following_id) values(%L)',f.a),'23505');
  perform pg_temp.expect_follow_failure('insert into public.follows(following_id) values(gen_random_uuid())','23503');
  perform pg_temp.expect_follow_failure('update public.follows set following_id=gen_random_uuid()','42501');
end;
$$;

set local role anon;
select set_config('request.jwt.claims','{"role":"anon"}',true);
do $$
declare f follow_fixture; summary jsonb;
begin
  select * into f from follow_fixture;
  summary := public.get_profile_follows(p_profile_id => f.a);
  if summary->>'viewer' <> 'anonymous' or summary->'following' <> 'null'::jsonb
    or summary->>'follower_count' <> '1' then raise exception 'Public follow summary mismatch'; end if;
  if public.get_profile_follows(p_profile_id => gen_random_uuid()) is not null then raise exception 'Missing target not distinguished'; end if;
  perform pg_temp.expect_follow_failure('select * from public.follows','42501');
  perform pg_temp.expect_follow_failure(format('select public.set_profile_follow(%L,true)',f.a),'42501');
  perform pg_temp.expect_follow_failure('select public.get_profile_follows()','22023');
  perform pg_temp.expect_follow_failure(format('select public.get_profile_follows(%L,%L)',f.old_username,f.a),'22023');
  perform pg_temp.expect_follow_failure('select public.get_profile_follows(''../bad'')','22023');
end;
$$;

set local role authenticated;
do $$
declare f follow_fixture; actor text; summary jsonb; expiry jsonb;
begin
  select * into f from follow_fixture;
  foreach actor in array array[f.actor_a,f.actor_mod,f.actor_admin,f.actor_missing] loop
    perform pg_temp.follow_as(actor);
    if exists(select 1 from public.follows where follower_id=f.b) then raise exception 'Foreign private relation visible'; end if;
    delete from public.follows where follower_id=f.b;
    if found then raise exception 'Foreign relation deleted'; end if;
    summary := public.get_profile_follows(p_profile_id => f.a);
    if summary->>'follower_count' <> '1' then raise exception 'Incoming count was altered'; end if;
    if actor=f.actor_missing then
      if summary->>'viewer' <> 'profile-required' then raise exception 'Missing profile state mismatch'; end if;
      perform pg_temp.expect_follow_failure(format('select public.set_profile_follow(%L,true)',f.a),'42501');
    elsif actor in (f.actor_mod,f.actor_admin) then
      perform public.set_profile_follow(f.a,true);
      if (select count(*) from public.follows) <> 1 then raise exception 'Role cannot read only its own outgoing relation'; end if;
      perform public.set_profile_follow(f.a,false);
    else
      if summary->>'viewer' <> 'self' or summary->'following' <> 'null'::jsonb then raise exception 'Self state mismatch'; end if;
      perform public.set_profile_follow(f.b,true);
    end if;
  end loop;
  for expiry in select value from jsonb_array_elements(jsonb_build_array(null,'invalid',extract(epoch from now())-1)) as expirations(value) loop
    perform pg_temp.follow_as(f.actor_b,expiry);
    if public.follow_session_is_active() or exists(select 1 from public.follows) then raise exception 'Inactive relation access'; end if;
    perform pg_temp.expect_follow_failure(format('select public.set_profile_follow(%L,false)',f.a),'42501');
    perform pg_temp.expect_follow_failure(format('insert into public.follows(following_id) values(%L)',f.a),'42501');
    delete from public.follows;
    if found then raise exception 'Inactive session deleted a relation'; end if;
    summary := public.get_profile_follows(p_profile_id => f.a);
    if summary->>'viewer'<>'expired' or summary->'following'<>'null'::jsonb then raise exception 'Inactive personal state leaked'; end if;
  end loop;
  perform pg_temp.follow_as(f.actor_b,to_jsonb(extract(epoch from now())+1800),to_jsonb(extract(epoch from now())+600));
  perform pg_temp.expect_follow_failure(format('select public.set_profile_follow(%L,false)',f.a),'42501');
  perform pg_temp.follow_as(f.actor_b,to_jsonb(extract(epoch from now())+1800),'"invalid"'::jsonb);
  perform pg_temp.expect_follow_failure(format('select public.set_profile_follow(%L,false)',f.a),'42501');
  perform pg_temp.follow_as(f.actor_a);
  update public.profiles set username=f.new_username where id=f.a;
  perform pg_temp.follow_as(f.actor_b);
  summary := public.get_profile_follows(p_profile_id => f.a);
  if summary->>'username'<>f.new_username or summary->>'following'<>'true'
    or public.get_profile_follows(p_username=>f.old_username) is not null then raise exception 'Rename broke stable target'; end if;
  summary := public.set_profile_follow(f.a,false);
  if summary<>public.set_profile_follow(f.a,false)
    or summary->'summary'->>'follower_count'<>'0' then raise exception 'Unfollow retry changed count'; end if;
  insert into public.follows(following_id) values(f.a);
  delete from public.follows where following_id=f.a;
  if not found then raise exception 'Direct own deletion blocked'; end if;
  perform public.set_profile_follow(f.a,true);
end;
$$;
reset role;
do $$
declare f follow_fixture;
begin
  select * into f from follow_fixture;
  perform pg_temp.expect_follow_failure(format('delete from public.profiles where id=%L',f.a),'23503');
  perform pg_temp.expect_follow_failure(format('delete from public.profiles where id=%L',f.b),'23503');
  if (select count(*) from public.follows where follower_id in(f.a,f.b))<>2 then raise exception 'Other relation lost'; end if;
  if (select count(*) from public.profiles where clerk_user_id in(f.actor_a,f.actor_b,f.actor_mod,f.actor_admin))<>4 then
    raise exception 'Follow mutation damaged profiles';
  end if;
end;
$$;
rollback;
select 'Follow desired state, own RLS, roles, expiry/nbf, rename, counts and restrictive profile FKs passed; fixtures rolled back' as result;
