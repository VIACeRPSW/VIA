create table public.likes (
  id uuid primary key default gen_random_uuid(),
  post_id uuid not null references public.posts(id) on delete cascade,
  user_id uuid not null default public.current_post_profile_id() references public.profiles(id),
  created_at timestamptz not null default now(),
  constraint likes_post_user_key unique (post_id, user_id)
);
create index likes_user_post_idx on public.likes (user_id, post_id);

alter table public.likes enable row level security;
alter table public.likes force row level security;
revoke all on table public.likes from public, anon, authenticated;
grant select, delete on table public.likes to authenticated;
grant insert (post_id) on table public.likes to authenticated;

create policy likes_select_own on public.likes for select to authenticated
  using (user_id = (select public.current_post_profile_id()));
create policy likes_insert_own on public.likes for insert to authenticated
  with check (
    user_id = (select public.current_post_profile_id())
    and exists (select 1 from public.get_public_posts(likes.post_id))
  );
create policy likes_delete_own on public.likes for delete to authenticated
  using (user_id = (select public.current_post_profile_id()));

create function public.get_post_likes(p_post_ids uuid[])
returns table (post_id uuid, like_count bigint, liked boolean, can_like boolean)
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  actor uuid;
begin
  if p_post_ids is null or cardinality(p_post_ids) not between 1 and 12
    or array_ndims(p_post_ids) <> 1 or array_lower(p_post_ids, 1) <> 1
    or array_position(p_post_ids, null) is not null then
    raise exception 'Invalid likes batch' using errcode = '22023';
  end if;
  if (select auth.role()) = 'authenticated' then
    actor := public.current_post_profile_id();
  end if;
  return query
  select post.id, count(reaction.id),
    case when (select auth.role()) = 'authenticated'
      then coalesce(bool_or(reaction.user_id = actor), false)
      else null::boolean end,
    actor is not null
  from public.posts as post
  left join public.likes as reaction on reaction.post_id = post.id
  where post.id = any(p_post_ids) and post.status = 'published'
  group by post.id;
end;
$$;
revoke all on function public.get_post_likes(uuid[]) from public, anon, authenticated;
grant execute on function public.get_post_likes(uuid[]) to anon, authenticated;

create function public.set_post_like(p_post_id uuid, p_liked boolean)
returns table (post_id uuid, like_count bigint, liked boolean, can_like boolean)
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor uuid;
begin
  if p_post_id is null or p_liked is null then
    raise exception 'Invalid like state' using errcode = '22023';
  end if;
  if (select auth.role()) is distinct from 'authenticated' then
    raise exception 'Authentication required' using errcode = '42501';
  end if;
  actor := public.current_post_profile_id();
  if actor is null then
    raise exception 'Profile required' using errcode = '42501';
  end if;
  perform 1 from public.posts as post
    where post.id = p_post_id and post.status = 'published' for update;
  if not found then
    raise exception 'Post unavailable' using errcode = 'P0002';
  end if;
  if p_liked then
    insert into public.likes (post_id, user_id) values (p_post_id, actor)
      on conflict on constraint likes_post_user_key do nothing;
  else
    delete from public.likes as reaction
      where reaction.post_id = p_post_id and reaction.user_id = actor;
  end if;
  return query select p_post_id,
    (select count(*) from public.likes as reaction where reaction.post_id = p_post_id),
    exists (select 1 from public.likes as reaction
      where reaction.post_id = p_post_id and reaction.user_id = actor),
    true;
end;
$$;
revoke all on function public.set_post_like(uuid, boolean) from public, anon, authenticated;
grant execute on function public.set_post_like(uuid, boolean) to authenticated;
