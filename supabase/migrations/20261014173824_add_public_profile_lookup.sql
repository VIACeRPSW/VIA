create function public.get_public_profile(p_username text)
returns table (
  username text,
  display_name text,
  bio text,
  avatar_url text,
  role text
)
language sql
stable
security definer
set search_path = ''
as $$
  select profile.username, profile.display_name, profile.bio,
    profile.avatar_url, profile.role
  from public.profiles as profile
  where p_username ~ '^[a-z0-9_]{3,30}$'
    and profile.username = p_username;
$$;

revoke all on function public.get_public_profile(text) from public;
grant execute on function public.get_public_profile(text) to anon, authenticated;
