create function public.current_post_profile_id()
returns uuid
language sql
stable
security definer
set search_path = ''
as $$
  select profile.id from public.profiles as profile
  where profile.clerk_user_id = (select auth.jwt() ->> 'sub')
    and profile.role in ('user', 'moderator', 'admin');
$$;
revoke all on function public.current_post_profile_id() from public, anon, authenticated;
grant execute on function public.current_post_profile_id() to authenticated;

create function public.valid_post_hashtags(p_tags text[])
returns boolean
language sql
immutable
security invoker
set search_path = ''
as $$
  select coalesce(
    array_ndims(p_tags) = 1 and array_lower(p_tags, 1) = 1
    and cardinality(p_tags) between 1 and 5
    and not exists (
      select 1 from unnest(p_tags) as tag
      where tag is null or char_length(tag) not between 2 and 30
        or tag collate pg_catalog.pg_c_utf8 !~ '^[[:alnum:]_]+$'
        or tag collate "C" <> normalize(lower(tag collate pg_catalog.pg_c_utf8), NFC) collate "C"
    )
    and (select count(distinct tag collate "C") from unnest(p_tags) as tag) = cardinality(p_tags),
    false
  );
$$;
revoke all on function public.valid_post_hashtags(text[]) from public, anon, authenticated;
grant execute on function public.valid_post_hashtags(text[]) to authenticated;

create function public.owns_post_image(p_path text)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(
    p_path ~ '^[a-f0-9]{64}/[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}\.webp$'
    and split_part(p_path, '/', 1) = encode(sha256(convert_to(auth.jwt() ->> 'sub', 'UTF8')), 'hex')
    and exists (
      select 1 from storage.objects as object
      where object.bucket_id = 'posts' and object.name = p_path
        and object.owner_id = (select auth.jwt() ->> 'sub')
    ),
    false
  );
$$;
revoke all on function public.owns_post_image(text) from public, anon, authenticated;
grant execute on function public.owns_post_image(text) to authenticated;

create table public.categories (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  description text not null default '',
  created_at timestamptz not null default now(),
  constraint categories_name_check check (char_length(name) between 1 and 80 and name = btrim(name))
);
insert into public.categories (name) values
  ('Historia'), ('Ciencia'), ('Arte'), (U&'Tecnolog\00EDa'), (U&'Matem\00E1ticas');

alter table public.categories enable row level security;
alter table public.categories force row level security;
revoke all on table public.categories from public, anon, authenticated;
grant select on table public.categories to anon, authenticated;
create policy categories_read on public.categories for select to anon, authenticated using (true);

create table public.posts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default public.current_post_profile_id() references public.profiles(id),
  category_id uuid not null references public.categories(id),
  title text not null,
  description text not null default '',
  hashtags text[] not null,
  image_path text not null unique,
  status text not null default 'published',
  operation_id uuid not null,
  version bigint not null default 1,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint posts_title_check check (
    char_length(title) between 1 and 120
    and title = btrim(title, E' \t\n\r\f' || chr(11)
      || U&'\00A0\1680\2000\2001\2002\2003\2004\2005\2006\2007\2008\2009\200A\2028\2029\202F\205F\3000\FEFF')
  ),
  constraint posts_description_check check (char_length(description) <= 2000),
  constraint posts_hashtags_check check (public.valid_post_hashtags(hashtags)),
  constraint posts_image_path_check check (
    image_path ~ '^[a-f0-9]{64}/[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}\.webp$'
  ),
  constraint posts_status_check check (status = 'published'),
  constraint posts_version_check check (version > 0),
  constraint posts_owner_operation_key unique (user_id, operation_id)
);
create index posts_recent_idx on public.posts (created_at desc, id desc);
create index posts_author_recent_idx on public.posts (user_id, created_at desc, id desc);
create index posts_category_recent_idx on public.posts (category_id, created_at desc, id desc);

create function public.protect_post_fields()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  if new.id is distinct from old.id or new.user_id is distinct from old.user_id
    or new.operation_id is distinct from old.operation_id
    or new.created_at is distinct from old.created_at
    or new.status is distinct from old.status then
    raise exception 'Post identity and lifecycle fields are immutable' using errcode = '42501';
  end if;
  new.version := old.version + 1;
  new.updated_at := clock_timestamp();
  return new;
end;
$$;
revoke all on function public.protect_post_fields() from public, anon, authenticated;
create trigger posts_protect_fields before update on public.posts
for each row execute function public.protect_post_fields();

alter table public.posts enable row level security;
alter table public.posts force row level security;
revoke all on table public.posts from public, anon, authenticated;
grant select, delete on table public.posts to authenticated;
grant insert (category_id, title, description, hashtags, image_path, operation_id)
  on table public.posts to authenticated;
grant update (category_id, title, description, hashtags, image_path)
  on table public.posts to authenticated;

create policy posts_select_own on public.posts for select to authenticated
using (user_id = (select public.current_post_profile_id()));
create policy posts_insert_own on public.posts for insert to authenticated
with check (
  user_id = (select public.current_post_profile_id()) and public.owns_post_image(image_path)
);
create policy posts_update_own on public.posts for update to authenticated
using (user_id = (select public.current_post_profile_id()))
with check (
  user_id = (select public.current_post_profile_id()) and public.owns_post_image(image_path)
);
create policy posts_delete_own on public.posts for delete to authenticated
using (user_id = (select public.current_post_profile_id()));

create function public.get_public_posts(
  p_id uuid default null,
  p_author_username text default null,
  p_before_created_at timestamptz default null,
  p_before_id uuid default null
)
returns table (
  id uuid,
  title text,
  description text,
  hashtags text[],
  image_path text,
  category_id uuid,
  category_name text,
  created_at timestamptz,
  updated_at timestamptz,
  author_username text,
  author_display_name text,
  author_avatar_url text
)
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if (p_before_created_at is null) <> (p_before_id is null)
    or (p_id is not null and (p_before_created_at is not null or p_author_username is not null))
    or (p_author_username is not null and p_author_username !~ '^[a-z0-9_]{3,30}$') then
    raise exception 'Invalid public post query' using errcode = '22023';
  end if;
  return query
  select post.id, post.title, post.description, post.hashtags, post.image_path,
    category.id, category.name, post.created_at, post.updated_at,
    profile.username, profile.display_name, profile.avatar_url
  from public.posts as post
  join public.profiles as profile on profile.id = post.user_id
  join public.categories as category on category.id = post.category_id
  where post.status = 'published'
    and (p_id is null or post.id = p_id)
    and (p_author_username is null or profile.username = p_author_username)
    and (p_before_created_at is null or (post.created_at, post.id) < (p_before_created_at, p_before_id))
  order by post.created_at desc, post.id desc
  limit 12;
end;
$$;
revoke all on function public.get_public_posts(uuid, text, timestamptz, uuid) from public, anon, authenticated;
grant execute on function public.get_public_posts(uuid, text, timestamptz, uuid) to anon, authenticated;
