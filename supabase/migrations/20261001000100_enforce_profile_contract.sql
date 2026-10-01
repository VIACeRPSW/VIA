do $$
begin
  if exists (
    select 1
    from public.profiles
    where username is null
      or display_name is null
      or btrim(display_name) = ''
  ) then
    raise exception 'Existing profiles must be completed before enforcing the profile contract';
  end if;
end;
$$;

alter table public.profiles
  alter column username set not null,
  alter column display_name set not null,
  add constraint profiles_username_format_check check (
    username = lower(username)
    and username ~ '^[a-z0-9_]{3,30}$'
  ),
  add constraint profiles_display_name_length_check check (
    char_length(btrim(display_name)) between 1 and 80
  ),
  add constraint profiles_bio_length_check check (
    char_length(bio) <= 300
  );