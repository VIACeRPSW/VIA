begin;

insert into public.profiles (clerk_user_id, username, display_name)
values ('via_rls_other_test', 'via_rls_other_test', 'Other test');

do $$
begin
  begin
    insert into public.profiles (clerk_user_id, username, display_name, role)
    values (
      'via_rls_invalid_role_test',
      'via_rls_invalid_role_test',
      'Invalid role test',
      'owner'
    );
    raise exception 'Expected unknown role to be rejected';
  exception
    when check_violation then null;
  end;
end;
$$;

set local role authenticated;
select set_config('request.jwt.claims', '{}', true);

do $$
declare
  visible_rows integer;
begin
  select count(*)
  into visible_rows
  from public.profiles;

  if visible_rows <> 0 then
    raise exception 'RLS exposed profiles without a subject claim';
  end if;

  begin
    insert into public.profiles (clerk_user_id, username, display_name)
    values ('via_rls_missing_sub_test', 'via_rls_missing_sub_test', 'Missing sub');
    raise exception 'Expected insert without a subject claim to be rejected';
  exception
    when insufficient_privilege then null;
  end;
end;
$$;

select set_config('request.jwt.claims', 'not-json', true);

do $$
declare
  visible_rows integer;
begin
  begin
    select count(*)
    into visible_rows
    from public.profiles;
    raise exception 'Expected malformed claims to fail closed';
  exception
    when invalid_text_representation then null;
  end;
end;
$$;

select set_config(
  'request.jwt.claims',
  '{"sub":"via_rls_owner_test","role":"authenticated"}',
  true
);

insert into public.profiles (clerk_user_id, username, display_name)
values ('via_rls_owner_test', 'via_rls_owner_test', 'RLS owner');

update public.profiles
set display_name = 'RLS owner'
where clerk_user_id = 'via_rls_owner_test';

do $$
declare
  owner_role text;
  owner_display_name text;
  other_rows integer;
begin
  select role, display_name
  into owner_role, owner_display_name
  from public.profiles
  where clerk_user_id = 'via_rls_owner_test';

  if owner_role is distinct from 'user' then
    raise exception 'Expected default role user, got %', owner_role;
  end if;

  if owner_display_name is distinct from 'RLS owner' then
    raise exception 'Expected own profile update to succeed';
  end if;

  select count(*)
  into other_rows
  from public.profiles
  where clerk_user_id = 'via_rls_other_test';

  if other_rows <> 0 then
    raise exception 'RLS exposed another user profile';
  end if;

  begin
    insert into public.profiles (clerk_user_id, username, display_name)
    values ('via_rls_foreign_test', 'via_rls_foreign_test', 'Foreign test');
    raise exception 'Expected foreign identity insert to be rejected';
  exception
    when insufficient_privilege then null;
  end;

  begin
    insert into public.profiles (clerk_user_id, username, display_name, role)
    values (
      'via_rls_owner_test_admin',
      'via_rls_owner_test_admin',
      'Owner admin test',
      'admin'
    );
    raise exception 'Expected privileged role insert to be rejected';
  exception
    when insufficient_privilege then null;
  end;

  begin
    update public.profiles
    set role = 'admin'
    where clerk_user_id = 'via_rls_owner_test';
    raise exception 'Expected role elevation to be rejected';
  exception
    when insufficient_privilege then null;
  end;

  begin
    update public.profiles
    set clerk_user_id = 'via_rls_reassigned_test'
    where clerk_user_id = 'via_rls_owner_test';
    raise exception 'Expected identity reassignment to be rejected';
  exception
    when insufficient_privilege then null;
  end;

  begin
    update public.profiles
    set username = 'Invalid-Name'
    where clerk_user_id = 'via_rls_owner_test';
    raise exception 'Expected invalid username to be rejected';
  exception
    when check_violation then null;
  end;

  begin
    update public.profiles
    set bio = repeat('a', 301)
    where clerk_user_id = 'via_rls_owner_test';
    raise exception 'Expected oversized bio to be rejected';
  exception
    when check_violation then null;
  end;
end;
$$;

select 'profiles RLS tests passed' as result;

rollback;