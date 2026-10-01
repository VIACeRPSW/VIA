revoke delete on table public.profiles from authenticated;
revoke update (role) on table public.profiles from authenticated;

drop policy if exists "profiles_delete_by_role" on public.profiles;
drop policy if exists "profiles_update_by_role" on public.profiles;
drop policy if exists "profiles_select_by_role" on public.profiles;

create policy "profiles_select_own"
on public.profiles
for select
to authenticated
using ((select auth.jwt() ->> 'sub') = clerk_user_id);

create policy "profiles_update_own"
on public.profiles
for update
to authenticated
using ((select auth.jwt() ->> 'sub') = clerk_user_id)
with check ((select auth.jwt() ->> 'sub') = clerk_user_id);

drop trigger if exists profiles_protect_last_admin_delete on public.profiles;
drop trigger if exists profiles_protect_privileged_changes on public.profiles;

drop function if exists public.protect_last_admin_delete();
drop function if exists public.protect_profile_privileged_changes();
drop function if exists public.current_profile_role();