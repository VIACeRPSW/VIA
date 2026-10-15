lock table public.likes in access exclusive mode;
do $$
begin
  if exists (select 1 from public.likes) then
    raise exception 'Cannot roll back likes with existing reactions' using errcode = '55000';
  end if;
end;
$$;
drop function public.set_post_like(uuid, boolean);
drop function public.get_post_likes(uuid[]);
drop table public.likes;
