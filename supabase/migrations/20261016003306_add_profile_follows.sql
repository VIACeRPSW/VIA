create function public.follow_session_is_active()
returns boolean language sql volatile security invoker set search_path = ''
as $$
  select coalesce((select auth.role()) = 'authenticated'
    and case when jsonb_typeof((select auth.jwt())->'exp') = 'number'
      then ((select auth.jwt())->>'exp')::numeric > extract(epoch from clock_timestamp()) else false end
    and case when not ((select auth.jwt()) ? 'nbf') then true
      when jsonb_typeof((select auth.jwt())->'nbf') = 'number'
      then ((select auth.jwt())->>'nbf')::numeric <= extract(epoch from clock_timestamp()) else false end, false);
$$;
revoke all on function public.follow_session_is_active() from public, anon, authenticated;
grant execute on function public.follow_session_is_active() to authenticated;

create table public.follows (
  id uuid primary key default gen_random_uuid(),
  follower_id uuid not null default public.current_post_profile_id() references public.profiles(id),
  following_id uuid not null references public.profiles(id),
  created_at timestamptz not null default now(),
  constraint follows_pair_key unique (follower_id, following_id),
  constraint follows_no_self check (follower_id <> following_id)
);
create index follows_following_idx on public.follows (following_id, follower_id);
alter table public.follows enable row level security;
alter table public.follows force row level security;
revoke all on table public.follows from public, anon, authenticated;
grant select, delete on table public.follows to authenticated;
grant insert (following_id) on table public.follows to authenticated;
create policy follows_select_own on public.follows for select to authenticated
  using (follower_id = (select public.current_post_profile_id()));
create policy follows_insert_own on public.follows for insert to authenticated
  with check (follower_id = (select public.current_post_profile_id()));
create policy follows_delete_own on public.follows for delete to authenticated
  using (follower_id = (select public.current_post_profile_id()));
create policy follows_active_session on public.follows as restrictive for all to authenticated
  using ((select public.follow_session_is_active()))
  with check ((select public.follow_session_is_active()));

create function public.get_profile_follows(p_username text default null, p_profile_id uuid default null)
returns jsonb language plpgsql volatile security definer set search_path = ''
as $$
declare target public.profiles; actor uuid; viewer text := 'anonymous';
begin
  if (p_username is null) = (p_profile_id is null)
    or (p_username is not null and p_username !~ '^[a-z0-9_]{3,30}$') then
    raise exception 'Invalid follow target' using errcode = '22023';
  end if;
  select * into target from public.profiles
    where (p_profile_id is not null and id = p_profile_id) or (p_username is not null and username = p_username);
  if not found then return null; end if;
  if (select auth.role()) = 'authenticated' then
    if not public.follow_session_is_active() then viewer := 'expired';
    else
      actor := public.current_post_profile_id();
      viewer := case when actor is null then 'profile-required'
        when actor = target.id then 'self' else 'ready' end;
    end if;
  end if;
  return jsonb_build_object('profile_id', target.id, 'username', target.username,
    'follower_count', (select count(*) from public.follows where following_id = target.id),
    'following_count', (select count(*) from public.follows where follower_id = target.id),
    'viewer', viewer, 'following', case when viewer = 'ready' then exists (
      select 1 from public.follows where follower_id = actor and following_id = target.id
    ) else null::boolean end);
end;
$$;
revoke all on function public.get_profile_follows(text, uuid) from public, anon, authenticated;
grant execute on function public.get_profile_follows(text, uuid) to anon, authenticated;

create function public.set_profile_follow(p_profile_id uuid, p_following boolean)
returns jsonb language plpgsql security definer set search_path = ''
as $$
declare actor uuid; actor_username text; locked integer;
begin
  if p_profile_id is null or p_following is null then
    raise exception 'Invalid follow input' using errcode = '22023';
  end if;
  if not public.follow_session_is_active() then
    raise exception 'Active follow session required' using errcode = '42501';
  end if;
  actor := public.current_post_profile_id();
  if actor is null then raise exception 'Profile required' using errcode = '42501'; end if;
  if actor = p_profile_id then raise exception 'Self follow forbidden' using errcode = '22023'; end if;
  perform 1 from public.profiles where id in (actor, p_profile_id) order by id for update;
  get diagnostics locked = row_count;
  if locked <> 2 then raise exception 'Profile unavailable' using errcode = 'P0002'; end if;
  if not public.follow_session_is_active() then
    raise exception 'Active follow session required' using errcode = '42501';
  end if;
  select username into actor_username from public.profiles where id = actor;
  if p_following then
    insert into public.follows(follower_id, following_id) values (actor, p_profile_id)
      on conflict on constraint follows_pair_key do nothing;
  else
    delete from public.follows where follower_id = actor and following_id = p_profile_id;
  end if;
  return jsonb_build_object('actor_username', actor_username,
    'summary', public.get_profile_follows(p_profile_id => p_profile_id));
end;
$$;
revoke all on function public.set_profile_follow(uuid, boolean) from public, anon, authenticated;
grant execute on function public.set_profile_follow(uuid, boolean) to authenticated;
