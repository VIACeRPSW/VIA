create function public.comment_session_is_active()
returns boolean language sql volatile security invoker set search_path = ''
as $$
  select coalesce((select auth.role()) = 'authenticated' and
    case when jsonb_typeof((select auth.jwt()) -> 'exp') = 'number'
      then ((select auth.jwt()) ->> 'exp')::numeric > extract(epoch from clock_timestamp())
      else false end, false);
$$;
revoke all on function public.comment_session_is_active() from public, anon, authenticated;
grant execute on function public.comment_session_is_active() to authenticated;

create function public.enforce_comment_session()
returns trigger language plpgsql security invoker set search_path = ''
as $$
begin
  if not public.comment_session_is_active() then
    raise exception 'Active comment session required' using errcode = '42501';
  end if;
  return new;
end;
$$;
revoke all on function public.enforce_comment_session() from public, anon, authenticated;
create trigger comments_require_active_session
  before insert on public.comments for each row execute function public.enforce_comment_session();
create policy comments_active_session on public.comments as restrictive for all to authenticated
  using ((select public.comment_session_is_active()))
  with check ((select public.comment_session_is_active()));
