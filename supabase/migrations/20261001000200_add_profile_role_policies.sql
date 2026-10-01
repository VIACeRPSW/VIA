create function public.current_profile_role()
returns text
language sql
stable
security definer
set search_path = ''
as $$
  select profile.role
  from public.profiles as profile
  where profile.clerk_user_id = (select auth.jwt() ->> 'sub')
  limit 1;
$$;

revoke all on function public.current_profile_role() from public;
grant execute on function public.current_profile_role() to authenticated;

create function public.protect_profile_privileged_changes()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor_role text;
begin
  if new.id is distinct from old.id
    or new.clerk_user_id is distinct from old.clerk_user_id then
    raise exception 'Profile identity is immutable' using errcode = '42501';
  end if;

  select public.current_profile_role() into actor_role;

  if new.role is distinct from old.role then
    if actor_role is distinct from 'admin' then
      raise exception 'Only administrators can change roles' using errcode = '42501';
    end if;

    if old.role = 'admin'
      and new.role <> 'admin'
      and (select count(*) from public.profiles where role = 'admin') = 1 then
      raise exception 'The last administrator cannot be demoted' using errcode = '42501';
    end if;
  end if;

  return new;
end;
$$;

create function public.protect_last_admin_delete()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if old.role = 'admin'
    and (select count(*) from public.profiles where role = 'admin') = 1 then
    raise exception 'The last administrator cannot be deleted' using errcode = '42501';
  end if;

  return old;
end;
$$;

revoke all on function public.protect_profile_privileged_changes() from public;
revoke all on function public.protect_last_admin_delete() from public;

create trigger profiles_protect_privileged_changes
before update on public.profiles
for each row
execute function public.protect_profile_privileged_changes();

create trigger profiles_protect_last_admin_delete
before delete on public.profiles
for each row
execute function public.protect_last_admin_delete();

drop policy "profiles_select_own" on public.profiles;
drop policy "profiles_update_own" on public.profiles;

create policy "profiles_select_by_role"
on public.profiles
for select
to authenticated
using (
  (select auth.jwt() ->> 'sub') = clerk_user_id
  or (select public.current_profile_role()) = 'admin'
  or (
    (select public.current_profile_role()) = 'moderator'
    and role = 'user'
  )
);

create policy "profiles_update_by_role"
on public.profiles
for update
to authenticated
using (
  (select auth.jwt() ->> 'sub') = clerk_user_id
  or (select public.current_profile_role()) = 'admin'
  or (
    (select public.current_profile_role()) = 'moderator'
    and role = 'user'
  )
)
with check (
  (select auth.jwt() ->> 'sub') = clerk_user_id
  or (select public.current_profile_role()) = 'admin'
  or (
    (select public.current_profile_role()) = 'moderator'
    and role = 'user'
  )
);

create policy "profiles_delete_by_role"
on public.profiles
for delete
to authenticated
using (
  (select public.current_profile_role()) = 'admin'
  or (
    (select public.current_profile_role()) = 'moderator'
    and role = 'user'
  )
);

grant update (role) on table public.profiles to authenticated;
grant delete on table public.profiles to authenticated;