alter table public.profiles
  drop constraint if exists profiles_bio_length_check,
  drop constraint if exists profiles_display_name_length_check,
  drop constraint if exists profiles_username_format_check,
  alter column display_name drop not null,
  alter column username drop not null;