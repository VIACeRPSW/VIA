create function public.valid_comment_content(p_content text)
returns boolean language sql immutable security invoker set search_path = ''
as $$
  select coalesce(char_length(p_content) between 1 and 1000
    and p_content = btrim(p_content, E' \t\n\r\f' || chr(11)
      || U&'\00A0\1680\2000\2001\2002\2003\2004\2005\2006\2007\2008\2009\200A\2028\2029\202F\205F\3000\FEFF'), false);
$$;
revoke all on function public.valid_comment_content(text) from public, anon, authenticated;
grant execute on function public.valid_comment_content(text) to authenticated;

create table public.comments (
  id uuid primary key default gen_random_uuid(),
  post_id uuid not null references public.posts(id) on delete cascade,
  user_id uuid not null default public.current_post_profile_id() references public.profiles(id),
  operation_id uuid not null,
  content text not null check (public.valid_comment_content(content)),
  created_at timestamptz not null default now(),
  constraint comments_user_operation_key unique (user_id, operation_id)
);
create index comments_post_recent_idx on public.comments (post_id, created_at desc, id desc);
alter table public.comments enable row level security;
alter table public.comments force row level security;
revoke all on table public.comments from public, anon, authenticated;
grant select on table public.comments to authenticated;
grant insert (post_id, operation_id, content) on table public.comments to authenticated;
create policy comments_select_own on public.comments for select to authenticated
  using (user_id = (select public.current_post_profile_id()));
create policy comments_insert_own on public.comments for insert to authenticated
  with check (user_id = (select public.current_post_profile_id())
    and exists (select 1 from public.get_public_posts(comments.post_id)));

create function public.get_post_comment_counts(p_post_ids uuid[])
returns table (post_id uuid, comment_count bigint)
language plpgsql stable security definer set search_path = ''
as $$
begin
  if p_post_ids is null or cardinality(p_post_ids) not between 1 and 12
    or array_ndims(p_post_ids) <> 1 or array_lower(p_post_ids, 1) <> 1
    or array_position(p_post_ids, null) is not null then
    raise exception 'Invalid comment count batch' using errcode = '22023';
  end if;
  return query select post.id, count(comment.id)
  from public.posts as post
  left join public.comments as comment on comment.post_id = post.id
  where post.id = any(p_post_ids) and post.status = 'published'
  group by post.id;
end;
$$;
revoke all on function public.get_post_comment_counts(uuid[]) from public, anon, authenticated;
grant execute on function public.get_post_comment_counts(uuid[]) to anon, authenticated;

create function public.get_public_post_comments(
  p_post_id uuid, p_before_created_at timestamptz default null, p_before_id uuid default null
)
returns jsonb language plpgsql stable security definer set search_path = ''
as $$
declare result jsonb;
begin
  if p_post_id is null or (p_before_created_at is null) <> (p_before_id is null) then
    raise exception 'Invalid comment page' using errcode = '22023';
  end if;
  if not exists (select 1 from public.posts where id = p_post_id and status = 'published') then
    return null;
  end if;
  with page as materialized (
    select comment.id, comment.post_id, comment.content, comment.created_at,
      profile.username as author_username, profile.display_name as author_display_name
    from public.comments as comment
    join public.profiles as profile on profile.id = comment.user_id
    where comment.post_id = p_post_id
      and (p_before_created_at is null
        or (comment.created_at, comment.id) < (p_before_created_at, p_before_id))
    order by comment.created_at desc, comment.id desc limit 13
  ), visible as (
    select * from page order by created_at desc, id desc limit 12
  )
  select jsonb_build_object(
    'comments', coalesce((select jsonb_agg(to_jsonb(visible) order by created_at desc, id desc) from visible), '[]'::jsonb),
    'commentCount', (select count(*) from public.comments where post_id = p_post_id),
    'nextCursor', case when (select count(*) from page) > 12 then (
      select jsonb_build_object('before', created_at, 'beforeId', id)
      from visible order by created_at, id limit 1
    ) else null end
  ) into result;
  return result;
end;
$$;
revoke all on function public.get_public_post_comments(uuid, timestamptz, uuid) from public, anon, authenticated;
grant execute on function public.get_public_post_comments(uuid, timestamptz, uuid) to anon, authenticated;

create function public.create_post_comment(p_post_id uuid, p_content text, p_operation_id uuid)
returns jsonb language plpgsql security definer set search_path = ''
as $$
declare actor uuid; saved public.comments; result jsonb;
begin
  if p_post_id is null or p_operation_id is null or not public.valid_comment_content(p_content) then
    raise exception 'Invalid comment input' using errcode = '22023';
  end if;
  if (select auth.role()) is distinct from 'authenticated' then
    raise exception 'Authentication required' using errcode = '42501';
  end if;
  actor := public.current_post_profile_id();
  if actor is null then raise exception 'Profile required' using errcode = '42501'; end if;
  perform 1 from public.posts where id = p_post_id and status = 'published' for update;
  if not found then raise exception 'Post unavailable' using errcode = 'P0002'; end if;
  insert into public.comments (post_id, user_id, operation_id, content)
    values (p_post_id, actor, p_operation_id, p_content)
    on conflict on constraint comments_user_operation_key do nothing;
  select * into strict saved from public.comments where user_id = actor and operation_id = p_operation_id;
  if saved.post_id is distinct from p_post_id or saved.content is distinct from p_content then
    raise exception 'Comment operation reused with different content' using errcode = '23505';
  end if;
  select jsonb_build_object(
    'comment', jsonb_build_object('id', saved.id, 'post_id', saved.post_id,
      'content', saved.content, 'created_at', saved.created_at,
      'author_username', profile.username, 'author_display_name', profile.display_name),
    'commentCount', (select count(*) from public.comments where post_id = p_post_id)
  ) into result from public.profiles as profile where profile.id = actor;
  return result;
end;
$$;
revoke all on function public.create_post_comment(uuid, text, uuid) from public, anon, authenticated;
grant execute on function public.create_post_comment(uuid, text, uuid) to authenticated;
