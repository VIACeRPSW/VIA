begin;

insert into public.profiles (clerk_user_id, username, display_name, bio)
values
  ('via_public_owner_test', 'via_public_owner_test', 'Public owner', 'Public biography'),
  ('via_public_other_test', 'via_public_other_test', 'Public other', '');

set local role anon;
select set_config('request.jwt.claims', '{}', true);

do $$
declare
  exposed_columns text[];
begin
  if (select count(*) from public.get_public_profile('via_public_owner_test')) <> 1 then
    raise exception 'Anonymous public lookup failed';
  end if;

  select array_agg(key order by key) into exposed_columns
  from jsonb_object_keys(
    (select to_jsonb(profile) from public.get_public_profile('via_public_owner_test') profile)
  ) key;

  if exposed_columns is distinct from array['avatar_url', 'bio', 'display_name', 'role', 'username'] then
    raise exception 'Public projection contains unexpected fields';
  end if;

  if exists (select 1 from public.get_public_profile('VIA_PUBLIC_OWNER_TEST'))
    or exists (select 1 from public.get_public_profile(' via_public_owner_test'))
    or exists (select 1 from public.get_public_profile('via_public_absent_test'))
    or exists (select 1 from public.get_public_profile(null))
    or exists (select 1 from public.get_public_profile('x'' or true --')) then
    raise exception 'Invalid or missing username returned a profile';
  end if;

  begin
    perform clerk_user_id from public.profiles;
    raise exception 'Anonymous role can read internal profile data';
  exception
    when insufficient_privilege then null;
  end;

  begin
    update public.profiles set bio = 'Unauthorized';
    raise exception 'Anonymous role can update profiles';
  exception
    when insufficient_privilege then null;
  end;
end;
$$;

set local role authenticated;
select set_config(
  'request.jwt.claims',
  '{"sub":"via_public_owner_test","role":"authenticated"}',
  true
);

do $$
begin
  if (select count(*) from public.get_public_profile('via_public_other_test')) <> 1 then
    raise exception 'Authenticated public lookup failed';
  end if;

  if (select count(*) from public.profiles where clerk_user_id = 'via_public_owner_test') <> 1 then
    raise exception 'Own private profile is no longer readable';
  end if;

  if exists (select 1 from public.profiles where clerk_user_id = 'via_public_other_test') then
    raise exception 'Public lookup broadened private table access';
  end if;

  update public.profiles set bio = 'Unauthorized' where clerk_user_id = 'via_public_other_test';
  if found then
    raise exception 'Public lookup broadened profile write access';
  end if;
end;
$$;

reset role;

do $$
declare
  function_definition text;
  original_acl aclitem[];
begin
  select pg_get_functiondef(oid), proacl
  into function_definition, original_acl
  from pg_proc where oid = 'public.get_public_profile(text)'::regprocedure;

  execute 'drop function public.get_public_profile(text)';
  if to_regprocedure('public.get_public_profile(text)') is not null then
    raise exception 'Public lookup rollback failed';
  end if;

  execute function_definition;
  revoke all on function public.get_public_profile(text) from public;
  grant execute on function public.get_public_profile(text) to anon, authenticated;

  if (select proacl from pg_proc where oid = 'public.get_public_profile(text)'::regprocedure)
    is distinct from original_acl then
    raise exception 'Public lookup privileges changed after reapplication';
  end if;

  if (select count(*) from public.get_public_profile('via_public_owner_test')) <> 1 then
    raise exception 'Public lookup reapplication failed';
  end if;
end;
$$;

rollback;
select 'Public profile permissions and transactional rollback passed' as result;
