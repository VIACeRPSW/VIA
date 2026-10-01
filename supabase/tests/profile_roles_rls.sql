begin;

insert into public.profiles (clerk_user_id, username, display_name, role)
values
  ('via_roles_admin_one', 'via_roles_admin_one', 'Admin one', 'admin'),
  ('via_roles_admin_two', 'via_roles_admin_two', 'Admin two', 'admin'),
  ('via_roles_moderator', 'via_roles_moderator', 'Moderator', 'moderator'),
  ('via_roles_user_one', 'via_roles_user_one', 'User one', 'user'),
  ('via_roles_user_two', 'via_roles_user_two', 'User two', 'user');

set local role authenticated;
select set_config(
  'request.jwt.claims',
  '{"sub":"via_roles_user_one","role":"authenticated"}',
  true
);

do $$
declare
  visible_rows integer;
  affected_rows integer;
begin
  select count(*) into visible_rows
  from public.profiles
  where clerk_user_id like 'via_roles_%';
  if visible_rows <> 1 then
    raise exception 'User expected 1 visible profile, got %', visible_rows;
  end if;

  update public.profiles
  set display_name = 'User one updated'
  where clerk_user_id = 'via_roles_user_one';

  update public.profiles
  set display_name = 'Forbidden user update'
  where clerk_user_id = 'via_roles_user_two';
  get diagnostics affected_rows = row_count;
  if affected_rows <> 0 then
    raise exception 'User updated another profile';
  end if;

  begin
    update public.profiles
    set role = 'admin'
    where clerk_user_id = 'via_roles_user_one';
    raise exception 'Expected user role elevation to fail';
  exception
    when insufficient_privilege then null;
  end;

  delete from public.profiles
  where clerk_user_id = 'via_roles_user_one';
  get diagnostics affected_rows = row_count;
  if affected_rows <> 0 then
    raise exception 'User deleted own profile';
  end if;
end;
$$;

select set_config(
  'request.jwt.claims',
  '{"sub":"via_roles_moderator","role":"authenticated"}',
  true
);

do $$
declare
  visible_rows integer;
  affected_rows integer;
begin
  select count(*) into visible_rows
  from public.profiles
  where clerk_user_id like 'via_roles_%';
  if visible_rows <> 3 then
    raise exception 'Moderator expected self and 2 users, got %', visible_rows;
  end if;

  update public.profiles
  set display_name = 'User one moderated'
  where clerk_user_id = 'via_roles_user_one';
  get diagnostics affected_rows = row_count;
  if affected_rows <> 1 then
    raise exception 'Moderator could not edit user profile';
  end if;

  update public.profiles
  set display_name = 'Forbidden admin update'
  where clerk_user_id = 'via_roles_admin_one';
  get diagnostics affected_rows = row_count;
  if affected_rows <> 0 then
    raise exception 'Moderator updated administrator profile';
  end if;

  begin
    update public.profiles
    set role = 'moderator'
    where clerk_user_id = 'via_roles_user_one';
    raise exception 'Expected moderator role change to fail';
  exception
    when insufficient_privilege then null;
  end;

  delete from public.profiles
  where clerk_user_id = 'via_roles_user_two';
  get diagnostics affected_rows = row_count;
  if affected_rows <> 1 then
    raise exception 'Moderator could not delete user profile';
  end if;

  delete from public.profiles
  where clerk_user_id = 'via_roles_admin_two';
  get diagnostics affected_rows = row_count;
  if affected_rows <> 0 then
    raise exception 'Moderator deleted administrator profile';
  end if;
end;
$$;

select set_config(
  'request.jwt.claims',
  '{"sub":"via_roles_admin_one","role":"authenticated"}',
  true
);

do $$
declare
  visible_rows integer;
  affected_rows integer;
begin
  select count(*) into visible_rows
  from public.profiles
  where clerk_user_id like 'via_roles_%';
  if visible_rows <> 4 then
    raise exception 'Admin expected all 4 remaining profiles, got %', visible_rows;
  end if;

  update public.profiles
  set role = 'moderator'
  where clerk_user_id = 'via_roles_user_one';

  update public.profiles
  set display_name = 'Moderator managed by admin'
  where clerk_user_id = 'via_roles_moderator';

  begin
    update public.profiles
    set clerk_user_id = 'via_roles_reassigned'
    where clerk_user_id = 'via_roles_moderator';
    raise exception 'Expected identity reassignment to fail';
  exception
    when insufficient_privilege then null;
  end;

  delete from public.profiles
  where clerk_user_id = 'via_roles_admin_two';
  get diagnostics affected_rows = row_count;
  if affected_rows <> 1 then
    raise exception 'Admin could not delete another administrator';
  end if;
end;
$$;

reset role;
alter table public.profiles disable trigger profiles_protect_privileged_changes;
update public.profiles
set role = 'user'
where role = 'admin'
  and clerk_user_id <> 'via_roles_admin_one';
alter table public.profiles enable trigger profiles_protect_privileged_changes;
set local role authenticated;

do $$
begin
  begin
    update public.profiles
    set role = 'user'
    where clerk_user_id = 'via_roles_admin_one';
    raise exception 'Expected last administrator demotion to fail';
  exception
    when insufficient_privilege then null;
  end;

  begin
    delete from public.profiles
    where clerk_user_id = 'via_roles_admin_one';
    raise exception 'Expected last administrator deletion to fail';
  exception
    when insufficient_privilege then null;
  end;
end;
$$;

select 'profile role RLS tests passed' as result;

rollback;