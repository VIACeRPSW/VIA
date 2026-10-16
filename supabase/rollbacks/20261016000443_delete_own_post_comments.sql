drop function public.delete_own_post_comment(uuid, uuid);
drop policy comments_delete_own on public.comments;
revoke delete on table public.comments from authenticated;
