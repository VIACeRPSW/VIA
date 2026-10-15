do $$
begin
  if exists (select 1 from public.posts) then
    raise exception 'Back up and retire posts before rollback' using errcode = '55000';
  end if;
  if exists (
    select 1 from public.categories
    where name not in ('Historia', 'Ciencia', 'Arte', U&'Tecnolog\00EDa', U&'Matem\00E1ticas')
      or description <> ''
  ) or (select count(*) from public.categories) <> 5 then
    raise exception 'Back up customized categories before rollback' using errcode = '55000';
  end if;
end;
$$;

drop function public.get_public_posts(uuid, text, timestamptz, uuid);
drop table public.posts;
drop function public.protect_post_fields();
drop table public.categories;
drop function public.owns_post_image(text);
drop function public.valid_post_hashtags(text[]);
drop function public.current_post_profile_id();
