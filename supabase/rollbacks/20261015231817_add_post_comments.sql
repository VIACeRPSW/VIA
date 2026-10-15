lock table public.comments in access exclusive mode;
do $$
begin
  if exists (select 1 from public.comments) then
    raise exception 'Cannot roll back comments with existing content' using errcode = '55000';
  end if;
end;
$$;
drop function public.create_post_comment(uuid, text, uuid);
drop function public.get_public_post_comments(uuid, timestamptz, uuid);
drop function public.get_post_comment_counts(uuid[]);
drop table public.comments;
drop function public.valid_comment_content(text);
