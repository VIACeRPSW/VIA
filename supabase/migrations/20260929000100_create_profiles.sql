create table public.profiles (
  id uuid primary key default gen_random_uuid(),
  clerk_user_id text not null,
  username text,
  display_name text,
  bio text not null default '',
  avatar_url text,
  role text not null default 'user',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint profiles_clerk_user_id_key unique (clerk_user_id),
  constraint profiles_username_key unique (username),
  constraint profiles_role_check check (role in ('user', 'moderator', 'admin'))
);

create function public.set_updated_at()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger profiles_set_updated_at
before update on public.profiles
for each row
execute function public.set_updated_at();

alter table public.profiles enable row level security;
alter table public.profiles force row level security;

revoke all on table public.profiles from anon, authenticated;
grant select, insert on table public.profiles to authenticated;
grant update (username, display_name, bio, avatar_url) on table public.profiles to authenticated;

create policy "profiles_select_own"
on public.profiles
for select
to authenticated
using ((select auth.jwt() ->> 'sub') = clerk_user_id);

create policy "profiles_insert_own_as_user"
on public.profiles
for insert
to authenticated
with check (
  (select auth.jwt() ->> 'sub') = clerk_user_id
  and role = 'user'
);

create policy "profiles_update_own"
on public.profiles
for update
to authenticated
using ((select auth.jwt() ->> 'sub') = clerk_user_id)
with check ((select auth.jwt() ->> 'sub') = clerk_user_id);