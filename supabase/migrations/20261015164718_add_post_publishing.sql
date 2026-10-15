insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('posts', 'posts', false, 5242880, array['image/webp']);

create function public.owns_post_path(p_path text)
returns boolean language sql stable security invoker set search_path = ''
as $$
  select coalesce(
    p_path ~ '^[a-f0-9]{64}/[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}\.webp$'
    and split_part(p_path, '/', 1) = encode(sha256(convert_to(auth.jwt() ->> 'sub', 'UTF8')), 'hex'), false);
$$;
revoke all on function public.owns_post_path(text) from public, anon, authenticated;
grant execute on function public.owns_post_path(text) to authenticated;

create function public.is_public_post_image(p_path text)
returns boolean language sql stable security definer set search_path = ''
as $$
  select exists (select 1 from public.posts where image_path = p_path and status = 'published');
$$;
revoke all on function public.is_public_post_image(text) from public, anon, authenticated;
grant execute on function public.is_public_post_image(text) to anon, authenticated;

create function public.valid_post_title(p_title text)
returns boolean language sql immutable security invoker set search_path = ''
as $$
  select coalesce(char_length(p_title) between 1 and 120
    and p_title = btrim(p_title, E' \t\n\r\f' || chr(11)
      || U&'\00A0\1680\2000\2001\2002\2003\2004\2005\2006\2007\2008\2009\200A\2028\2029\202F\205F\3000\FEFF'), false);
$$;
revoke all on function public.valid_post_title(text) from public, anon, authenticated;
grant execute on function public.valid_post_title(text) to authenticated;
alter table public.posts drop constraint posts_title_check;
alter table public.posts add constraint posts_title_check check (public.valid_post_title(title));

create table public.post_uploads (
  owner_sub text not null,
  operation_id uuid not null,
  lease_id uuid not null,
  image_path text not null unique,
  image_digest text not null check (image_digest ~ '^[a-f0-9]{64}$'),
  title text not null check (public.valid_post_title(title)),
  description text not null check (char_length(description) <= 2000),
  category_id uuid not null references public.categories(id),
  hashtags text[] not null check (public.valid_post_hashtags(hashtags)),
  state text not null default 'uploading' check (state in ('uploading', 'published', 'cleanup')),
  expires_at timestamptz not null default (now() + interval '10 minutes'),
  post_id uuid references public.posts(id),
  primary key (owner_sub, operation_id),
  constraint post_upload_state_check check ((state = 'published') = (post_id is not null))
);
alter table public.post_uploads enable row level security;
alter table public.post_uploads force row level security;
revoke all on table public.post_uploads from public, anon, authenticated;
grant select on table public.post_uploads to authenticated;
create policy post_uploads_select_own on public.post_uploads for select to authenticated
using (owner_sub = (select auth.jwt() ->> 'sub'));
revoke insert on table public.posts from authenticated;
revoke insert (category_id, title, description, hashtags, image_path, operation_id)
  on table public.posts from authenticated;
revoke update (image_path) on table public.posts from authenticated;

create policy posts_objects_select_public on storage.objects for select to anon, authenticated
using (bucket_id = 'posts' and public.is_public_post_image(name));
create policy posts_objects_select_own on storage.objects for select to authenticated
using (bucket_id = 'posts' and public.owns_post_path(name));
create policy posts_objects_insert_own on storage.objects for insert to authenticated
with check (
  bucket_id = 'posts' and public.owns_post_path(name) and owner_id = (select auth.jwt() ->> 'sub')
  and (select public.current_post_profile_id()) is not null
  and exists (
    select 1 from public.post_uploads
    where image_path = name and state = 'uploading' and expires_at > now()
  )
);
create policy posts_objects_delete_unused on storage.objects for delete to authenticated
using (
  bucket_id = 'posts' and public.owns_post_path(name)
  and not public.is_public_post_image(name)
  and exists (
    select 1 from public.post_uploads where image_path = name
      and (state = 'cleanup' or (state = 'uploading' and expires_at <= now()))
  )
);

create function public.begin_post_upload(
  p_operation_id uuid, p_lease_id uuid, p_title text, p_description text,
  p_category_id uuid, p_hashtags text[], p_image_digest text
)
returns jsonb language plpgsql security definer set search_path = ''
as $$
declare
  actor text := auth.jwt() ->> 'sub';
  upload public.post_uploads;
begin
  if public.current_post_profile_id() is null then
    raise exception 'Profile and authentication required' using errcode = '42501';
  end if;
  insert into public.post_uploads(owner_sub, operation_id, lease_id, image_path,
    title, description, category_id, hashtags, image_digest)
  values (actor, p_operation_id, p_lease_id,
    encode(sha256(convert_to(actor, 'UTF8')), 'hex') || '/' || gen_random_uuid() || '.webp',
    p_title, p_description, p_category_id, p_hashtags, p_image_digest)
  on conflict (owner_sub, operation_id) do nothing;
  select * into strict upload from public.post_uploads
  where owner_sub = actor and operation_id = p_operation_id for update;
  if row(upload.title, upload.description, upload.category_id, upload.hashtags, upload.image_digest)
    is distinct from row(p_title, p_description, p_category_id, p_hashtags, p_image_digest) then
    return jsonb_build_object('status', 'conflict');
  end if;
  if upload.state = 'published' then
    return jsonb_build_object('status', 'published', 'post_id', upload.post_id);
  end if;
  if upload.state = 'cleanup' or upload.expires_at <= now() then
    return jsonb_build_object('status', 'cleanup');
  end if;
  if upload.lease_id <> p_lease_id then
    return jsonb_build_object('status', 'busy');
  end if;
  return jsonb_build_object('status', 'ready', 'image_path', upload.image_path);
end;
$$;
revoke all on function public.begin_post_upload(uuid, uuid, text, text, uuid, text[], text) from public, anon, authenticated;
grant execute on function public.begin_post_upload(uuid, uuid, text, text, uuid, text[], text) to authenticated;

create function public.commit_post_upload(p_operation_id uuid, p_lease_id uuid)
returns uuid language plpgsql security definer set search_path = ''
as $$
declare
  actor_id uuid := public.current_post_profile_id();
  upload public.post_uploads;
  result uuid;
begin
  if actor_id is null then raise exception 'Authentication required' using errcode = '42501'; end if;
  select * into strict upload from public.post_uploads
  where owner_sub = (auth.jwt() ->> 'sub') and operation_id = p_operation_id for update;
  if upload.state = 'published' then return upload.post_id; end if;
  if upload.state <> 'uploading' or p_lease_id is null or upload.lease_id <> p_lease_id
    or upload.expires_at <= now() or not public.owns_post_image(upload.image_path) then
    raise exception 'Upload cannot be confirmed' using errcode = '42501';
  end if;
  insert into public.posts(user_id, category_id, title, description, hashtags, image_path, operation_id)
  values (actor_id, upload.category_id, upload.title, upload.description,
    upload.hashtags, upload.image_path, p_operation_id)
  returning id into result;
  update public.post_uploads set state = 'published', post_id = result
  where owner_sub = upload.owner_sub and operation_id = p_operation_id;
  return result;
end;
$$;
revoke all on function public.commit_post_upload(uuid, uuid) from public, anon, authenticated;
grant execute on function public.commit_post_upload(uuid, uuid) to authenticated;

create function public.abort_post_upload(p_operation_id uuid, p_lease_id uuid)
returns void language sql security definer set search_path = ''
as $$
  update public.post_uploads set state = 'cleanup', expires_at = now()
  where owner_sub = (auth.jwt() ->> 'sub') and operation_id = p_operation_id
    and lease_id = p_lease_id and state = 'uploading';
$$;
revoke all on function public.abort_post_upload(uuid, uuid) from public, anon, authenticated;
grant execute on function public.abort_post_upload(uuid, uuid) to authenticated;

create function public.finish_post_cleanup(p_operation_id uuid)
returns void language plpgsql security definer set search_path = ''
as $$
declare
  upload public.post_uploads;
begin
  select * into strict upload from public.post_uploads
  where owner_sub = (auth.jwt() ->> 'sub') and operation_id = p_operation_id for update;
  if (upload.state <> 'cleanup' and not (upload.state = 'uploading' and upload.expires_at <= now()))
    or public.is_public_post_image(upload.image_path)
    or exists (select 1 from storage.objects where bucket_id = 'posts' and name = upload.image_path) then
    raise exception 'Upload cleanup is not complete' using errcode = '42501';
  end if;
  delete from public.post_uploads where owner_sub = upload.owner_sub and operation_id = p_operation_id;
end;
$$;
revoke all on function public.finish_post_cleanup(uuid) from public, anon, authenticated;
grant execute on function public.finish_post_cleanup(uuid) to authenticated;

create function public.schedule_deleted_post_cleanup()
returns trigger language plpgsql security definer set search_path = ''
as $$
begin
  update public.post_uploads set state = 'cleanup', post_id = null, expires_at = now()
  where post_id = old.id;
  return old;
end;
$$;
revoke all on function public.schedule_deleted_post_cleanup() from public, anon, authenticated;
create trigger posts_schedule_cleanup before delete on public.posts
for each row execute function public.schedule_deleted_post_cleanup();
