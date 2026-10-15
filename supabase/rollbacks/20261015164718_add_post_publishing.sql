do $$
begin
  if exists(select 1 from public.posts) or exists(select 1 from public.post_uploads)
    or exists(select 1 from storage.objects where bucket_id = 'posts') then
    raise exception 'Retire posts, objects and upload journal before rollback' using errcode = '55000';
  end if;
end;
$$;
drop trigger posts_schedule_cleanup on public.posts;
drop function public.schedule_deleted_post_cleanup();
drop function public.finish_post_cleanup(uuid);
drop function public.abort_post_upload(uuid, uuid);
drop function public.commit_post_upload(uuid, uuid);
drop function public.begin_post_upload(uuid, uuid, text, text, uuid, text[], text);
drop policy posts_objects_delete_unused on storage.objects;
drop policy posts_objects_insert_own on storage.objects;
drop policy posts_objects_select_own on storage.objects;
drop policy posts_objects_select_public on storage.objects;
drop table public.post_uploads;
alter table public.posts drop constraint posts_title_check;
alter table public.posts add constraint posts_title_check check (
  char_length(title) between 1 and 120
  and title = btrim(title, E' \t\n\r\f' || chr(11)
    || U&'\00A0\1680\2000\2001\2002\2003\2004\2005\2006\2007\2008\2009\200A\2028\2029\202F\205F\3000\FEFF')
);
drop function public.valid_post_title(text);
drop function public.is_public_post_image(text);
drop function public.owns_post_path(text);
grant insert (category_id, title, description, hashtags, image_path, operation_id)
  on table public.posts to authenticated;
grant update (image_path) on table public.posts to authenticated;
-- Remove the empty private bucket through the Storage API, never SQL.
