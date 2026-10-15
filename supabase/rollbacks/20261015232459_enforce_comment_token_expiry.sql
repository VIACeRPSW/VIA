lock table public.comments in access exclusive mode;
do $$
begin
  if exists (select 1 from public.comments) then
    raise exception 'Cannot remove comment session protection with existing content' using errcode = '55000';
  end if;
end;
$$;
drop policy comments_active_session on public.comments;
drop trigger comments_require_active_session on public.comments;
drop function public.enforce_comment_session();
drop function public.comment_session_is_active();
