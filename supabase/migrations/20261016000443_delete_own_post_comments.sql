grant delete on table public.comments to authenticated;
create policy comments_delete_own on public.comments for delete to authenticated
  using (user_id = (select public.current_post_profile_id()));

create function public.delete_own_post_comment(p_post_id uuid, p_comment_id uuid)
returns jsonb language plpgsql security definer set search_path = ''
as $$
declare actor uuid; saved public.comments;
begin
  if p_post_id is null or p_comment_id is null then
    raise exception 'Invalid comment deletion' using errcode = '22023';
  end if;
  if not public.comment_session_is_active() then
    raise exception 'Active comment session required' using errcode = '42501';
  end if;
  actor := public.current_post_profile_id();
  if actor is null then raise exception 'Profile required' using errcode = '42501'; end if;
  perform 1 from public.posts where id = p_post_id and status = 'published' for update;
  if not public.comment_session_is_active() then
    raise exception 'Active comment session required' using errcode = '42501';
  end if;
  if not found then return null; end if;
  select * into saved from public.comments where id = p_comment_id;
  if found and (saved.user_id is distinct from actor or saved.post_id is distinct from p_post_id) then
    raise exception 'Comment does not belong to this author and post' using errcode = '42501';
  end if;
  delete from public.comments where id = p_comment_id and user_id = actor and post_id = p_post_id;
  return jsonb_build_object('postId', p_post_id, 'commentId', p_comment_id,
    'page', public.get_public_post_comments(p_post_id));
end;
$$;
revoke all on function public.delete_own_post_comment(uuid, uuid) from public, anon, authenticated;
grant execute on function public.delete_own_post_comment(uuid, uuid) to authenticated;
