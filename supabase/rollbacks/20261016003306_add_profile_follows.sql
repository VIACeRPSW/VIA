lock table public.follows in access exclusive mode;
do $$
begin
  if exists (select 1 from public.follows) then
    raise exception 'Cannot remove follows with existing relations' using errcode = '55000';
  end if;
end;
$$;
drop function public.set_profile_follow(uuid, boolean);
drop function public.get_profile_follows(text, uuid);
drop table public.follows;
drop function public.follow_session_is_active();
