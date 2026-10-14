do $$
begin
  perform set_config('lock_timeout', '5s', true);
  lock table public.profiles, public.avatar_cleanup_tasks in share mode;
  perform id from storage.buckets where id = 'avatars' for update;
  if exists (select 1 from storage.objects where bucket_id = 'avatars')
    or exists (select 1 from public.avatar_cleanup_tasks)
    or exists (select 1 from public.profiles where avatar_url like '%/storage/v1/object/public/avatars/%') then
    raise exception 'Remove avatar objects, references and cleanup tasks before rollback';
  end if;
end;
$$;
drop function public.commit_profile_avatar(text, text, text);
drop policy avatars_delete_unused_own on storage.objects;
drop policy avatars_insert_own on storage.objects;
drop policy avatars_select_own on storage.objects;
drop table public.avatar_cleanup_tasks;
drop function public.owns_avatar_path(text);
-- Remove the empty bucket separately through the Storage API, never through SQL.
