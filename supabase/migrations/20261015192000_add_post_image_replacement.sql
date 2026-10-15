create function public.commit_post_image_replacement(
  p_post_id uuid, p_version bigint, p_operation_id uuid, p_lease_id uuid
)
returns uuid language plpgsql security definer set search_path = ''
as $$
declare
  actor uuid := public.current_post_profile_id();
  current_post public.posts;
  upload public.post_uploads;
begin
  if actor is null then raise exception 'Authentication required' using errcode = '42501'; end if;
  select * into strict current_post from public.posts
    where id = p_post_id and user_id = actor for update;
  select * into strict upload from public.post_uploads
    where owner_sub = (auth.jwt() ->> 'sub') and operation_id = p_operation_id for update;
  if upload.state = 'published' then
    if upload.post_id = p_post_id then return p_post_id; end if;
    raise exception 'Operation belongs to another post' using errcode = '42501';
  end if;
  if p_version is null or current_post.version <> p_version then
    raise exception 'Post changed since editing began' using errcode = '40001';
  end if;
  if upload.state <> 'uploading' or p_lease_id is null or upload.lease_id <> p_lease_id
    or upload.expires_at <= now() or not public.owns_post_image(upload.image_path) then
    raise exception 'Replacement cannot be confirmed' using errcode = '42501';
  end if;
  update public.post_uploads set state = 'cleanup', post_id = null, expires_at = now()
    where post_id = p_post_id and state = 'published';
  update public.posts set title = upload.title, description = upload.description,
    category_id = upload.category_id, hashtags = upload.hashtags, image_path = upload.image_path
    where id = p_post_id;
  update public.post_uploads set state = 'published', post_id = p_post_id
    where owner_sub = upload.owner_sub and operation_id = p_operation_id;
  return p_post_id;
end;
$$;
revoke all on function public.commit_post_image_replacement(uuid, bigint, uuid, uuid) from public, anon, authenticated;
grant execute on function public.commit_post_image_replacement(uuid, bigint, uuid, uuid) to authenticated;
