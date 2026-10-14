insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('avatars', 'avatars', true, 2097152, array['image/webp']);

create function public.owns_avatar_path(p_path text)
returns boolean
language sql
stable
security invoker
set search_path = ''
as $$
  select p_path ~ '^[a-f0-9]{64}/[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}\.webp$'
    and split_part(p_path, '/', 1) = encode(sha256(convert_to(auth.jwt() ->> 'sub', 'UTF8')), 'hex');
$$;
revoke all on function public.owns_avatar_path(text) from public, anon, authenticated;
grant execute on function public.owns_avatar_path(text) to authenticated;

create table public.avatar_cleanup_tasks (
  object_path text primary key,
  owner_sub text not null default (auth.jwt() ->> 'sub'),
  state text not null default 'uploading' check (state in ('uploading', 'cleanup')),
  expires_at timestamptz not null default (now() + interval '10 minutes')
);
alter table public.avatar_cleanup_tasks enable row level security;
alter table public.avatar_cleanup_tasks force row level security;
revoke all on table public.avatar_cleanup_tasks from anon, authenticated;
grant select, delete on table public.avatar_cleanup_tasks to authenticated;
grant insert (object_path), update (state) on table public.avatar_cleanup_tasks to authenticated;

create policy avatar_tasks_select on public.avatar_cleanup_tasks for select to authenticated
using (owner_sub = (select auth.jwt() ->> 'sub'));
create policy avatar_tasks_insert on public.avatar_cleanup_tasks for insert to authenticated
with check (owner_sub = (select auth.jwt() ->> 'sub') and public.owns_avatar_path(object_path));
create policy avatar_tasks_update on public.avatar_cleanup_tasks for update to authenticated
using (owner_sub = (select auth.jwt() ->> 'sub'))
with check (owner_sub = (select auth.jwt() ->> 'sub') and public.owns_avatar_path(object_path));
create policy avatar_tasks_delete on public.avatar_cleanup_tasks for delete to authenticated
using (owner_sub = (select auth.jwt() ->> 'sub'));

create policy avatars_select_own on storage.objects for select to authenticated
using (bucket_id = 'avatars' and public.owns_avatar_path(name));
create policy avatars_insert_own on storage.objects for insert to authenticated
with check (
  bucket_id = 'avatars' and public.owns_avatar_path(name)
  and exists (select 1 from public.profiles where clerk_user_id = (select auth.jwt() ->> 'sub'))
  and exists (
    select 1 from public.avatar_cleanup_tasks
    where object_path = name and state = 'uploading' and expires_at > now()
  )
);
create policy avatars_delete_unused_own on storage.objects for delete to authenticated
using (
  bucket_id = 'avatars' and public.owns_avatar_path(name)
  and not exists (
    select 1 from public.profiles
    where clerk_user_id = (select auth.jwt() ->> 'sub')
      and right(avatar_url, length('/storage/v1/object/public/avatars/' || name))
        = '/storage/v1/object/public/avatars/' || name
  )
);

create function public.commit_profile_avatar(
  p_expected_url text, p_new_url text, p_object_path text
)
returns boolean
language plpgsql
security invoker
set search_path = ''
as $$
declare
  profile_id uuid;
  previous_path text;
begin
  if (select auth.jwt() ->> 'sub') is null then
    raise exception 'Authentication required' using errcode = '42501';
  end if;
  if p_new_url is not null and (
    p_object_path is null or not public.owns_avatar_path(p_object_path)
    or p_new_url !~ '^https://'
    or right(p_new_url, length('/storage/v1/object/public/avatars/' || p_object_path))
      is distinct from '/storage/v1/object/public/avatars/' || p_object_path
  ) then
    raise exception 'Invalid avatar reference' using errcode = '22023';
  end if;
  if p_new_url is null and p_object_path is not null then
    raise exception 'Invalid avatar removal' using errcode = '22023';
  end if;
  if p_expected_url is not null then
    previous_path := split_part(p_expected_url, '/storage/v1/object/public/avatars/', 2);
    if not coalesce(public.owns_avatar_path(previous_path), false) then
      raise exception 'Invalid previous avatar' using errcode = '22023';
    end if;
  end if;
  update public.profiles set avatar_url = p_new_url
  where clerk_user_id = (select auth.jwt() ->> 'sub')
    and avatar_url is not distinct from p_expected_url
    and (
      p_new_url is null or exists (
        select 1 from public.avatar_cleanup_tasks
        where object_path = p_object_path and state = 'uploading' and expires_at > now()
      )
    )
  returning id into profile_id;
  if profile_id is null then return false; end if;
  if p_object_path is not null then
    delete from public.avatar_cleanup_tasks where object_path = p_object_path;
  end if;
  if previous_path is not null then
    insert into public.avatar_cleanup_tasks (object_path) values (previous_path)
    on conflict (object_path) do update set state = 'cleanup';
    update public.avatar_cleanup_tasks set state = 'cleanup' where object_path = previous_path;
  end if;
  return true;
end;
$$;
revoke all on function public.commit_profile_avatar(text, text, text) from public, anon, authenticated;
grant execute on function public.commit_profile_avatar(text, text, text) to authenticated;
