import { readFile, unlink, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { spawnSync } from "node:child_process";

const args = process.argv.slice(2);
if (args.length > 1 || (args.length === 1 && args[0] !== "--preflight")) {
  throw new Error("Usage: node scripts/test-supabase-posts-migration.mjs [--preflight]");
}
const preflight = args[0] === "--preflight";
const name = "20261015162153_add_posts_contract.sql";
const [migration, rollback, testSource] = await Promise.all([
  readFile(join(process.cwd(), "supabase", "migrations", name), "utf8"),
  readFile(join(process.cwd(), "supabase", "rollbacks", name), "utf8"),
  readFile(join(process.cwd(), "supabase", "tests", "posts_rls.sql"), "utf8"),
]);
const tests = testSource.replaceAll("\r\n", "\n");
if (!tests.startsWith("begin;") || !tests.includes("\nrollback;\n")) {
  throw new Error("Posts SQL tests must be wrapped in a rollback transaction");
}
const testBody = tests.replace(/^begin;\s*/u, "").replace(/\nrollback;\n/u, "\n")
  .replace("-- POSTS_ROLLBACK_GUARD",
    () => `select pg_temp.expect_post_failure($post_rollback_guard$${rollback}$post_rollback_guard$, '55000');`);
const temporaryPath = join(tmpdir(), `via-posts-migration-${process.pid}.sql`);
const snapshot = `
create function pg_temp.posts_snapshot() returns jsonb language sql as $$
select jsonb_build_object(
  'categories', (select jsonb_agg(jsonb_build_object('name',name,'description',description) order by name)
    from public.categories),
  'columns', (select jsonb_agg(to_jsonb(c) order by table_name,ordinal_position)
    from (select table_name,column_name,ordinal_position,column_default,is_nullable,data_type,udt_name
      from information_schema.columns where table_schema='public' and table_name in ('posts','categories')) c),
  'constraints', (select jsonb_agg(jsonb_build_object('table',r.relname,'name',c.conname,'definition',pg_get_constraintdef(c.oid))
    order by r.relname,c.conname) from pg_constraint c join pg_class r on r.oid=c.conrelid
    where c.conrelid in ('public.posts'::regclass,'public.categories'::regclass)),
  'indexes', (select jsonb_agg(to_jsonb(i) order by tablename,indexname) from pg_indexes i
    where schemaname='public' and tablename in ('posts','categories')),
  'policies', (select jsonb_agg(to_jsonb(p) order by tablename,policyname) from pg_policies p
    where schemaname='public' and tablename in ('posts','categories')),
  'triggers', (select jsonb_agg(pg_get_triggerdef(oid) order by tgname) from pg_trigger
    where tgrelid='public.posts'::regclass and not tgisinternal),
  'rls', (select jsonb_agg(jsonb_build_object('name',relname,'rls',relrowsecurity,'forced',relforcerowsecurity) order by relname)
    from pg_class where oid in ('public.posts'::regclass,'public.categories'::regclass)),
  'table_grants', (select jsonb_agg(to_jsonb(g) order by table_name,grantee,privilege_type)
    from (select table_name,grantee,privilege_type from information_schema.role_table_grants
      where table_schema='public' and table_name in ('posts','categories') and grantee in ('anon','authenticated')) g),
  'column_grants', (select jsonb_agg(to_jsonb(g) order by table_name,column_name,grantee,privilege_type)
    from (select table_name,column_name,grantee,privilege_type from information_schema.role_column_grants
      where table_schema='public' and table_name in ('posts','categories') and grantee in ('anon','authenticated')) g),
  'functions', (select jsonb_agg(jsonb_build_object('name',proname,
    'definition',replace(pg_get_functiondef(oid),chr(13)||chr(10),chr(10)),'acl',proacl) order by proname)
    from pg_proc where oid in (
      'public.current_post_profile_id()'::regprocedure,'public.valid_post_hashtags(text[])'::regprocedure,
      'public.owns_post_image(text)'::regprocedure,'public.protect_post_fields()'::regprocedure,
      'public.get_public_posts(uuid,text,timestamptz,uuid)'::regprocedure))
);
$$;
`;
await writeFile(temporaryPath, `
begin;
do $$ begin
  if to_regclass('public.post_uploads') is not null then
    raise exception 'Rehearse the publishing rollback first; posts contract has publishing dependencies' using errcode='55000';
  end if;
end; $$;
create temporary table original_profile_rows as select id,to_jsonb(profile) as value from public.profiles profile;
create temporary table original_profile_schema as
select jsonb_build_object(
  'policies',(select jsonb_agg(to_jsonb(p) order by policyname) from pg_policies p where schemaname='public' and tablename='profiles'),
  'triggers',(select jsonb_agg(pg_get_triggerdef(oid) order by tgname) from pg_trigger where tgrelid='public.profiles'::regclass and not tgisinternal)
) as value;
${preflight ? migration : ""}
${snapshot}
create temporary table expected_posts_schema as select pg_temp.posts_snapshot() as value;
${testBody}
do $category_rollback_test$ declare fixture_id uuid; begin
  insert into public.categories(name) values ('VIA posts rollback fixture') returning id into fixture_id;
  perform pg_temp.expect_post_failure($post_rollback_guard$${rollback}$post_rollback_guard$, '55000');
  delete from public.categories where id=fixture_id;
end; $category_rollback_test$;
${rollback}
do $$ begin
  if to_regclass('public.posts') is not null or to_regclass('public.categories') is not null
    or to_regprocedure('public.get_public_posts(uuid,text,timestamptz,uuid)') is not null
    or to_regprocedure('public.current_post_profile_id()') is not null
    or to_regprocedure('public.valid_post_hashtags(text[])') is not null
    or to_regprocedure('public.owns_post_image(text)') is not null
    or to_regprocedure('public.protect_post_fields()') is not null then
    raise exception 'Posts rollback left resources';
  end if;
end; $$;
${migration}
do $$ begin
  if (select value from expected_posts_schema) is distinct from pg_temp.posts_snapshot() then
    raise exception 'Posts migration reapplication differs: %', (
      select string_agg(key, ', ' order by key) from jsonb_each((select value from expected_posts_schema))
      where value is distinct from pg_temp.posts_snapshot() -> key
    );
  end if;
  if exists (select 1 from original_profile_rows original
    left join public.profiles profile on profile.id=original.id
    where original.value is distinct from to_jsonb(profile)) then
    raise exception 'Posts rehearsal modified existing profiles';
  end if;
  if (select value from original_profile_schema) is distinct from jsonb_build_object(
    'policies',(select jsonb_agg(to_jsonb(p) order by policyname) from pg_policies p where schemaname='public' and tablename='profiles'),
    'triggers',(select jsonb_agg(pg_get_triggerdef(oid) order by tgname) from pg_trigger where tgrelid='public.profiles'::regclass and not tgisinternal)
  ) then raise exception 'Posts rehearsal modified profile authorization'; end if;
end; $$;
rollback;
select 'Posts migration, RLS, rollback/reapplication and existing profile preservation passed' as result;
`, "utf8");
try {
  const result = spawnSync(process.execPath, [
    join(process.cwd(), "node_modules", "supabase", "dist", "supabase.js"),
    "db", "query", "--linked", "--file", temporaryPath, "--agent", "no", "--output-format", "text",
  ], { cwd: process.cwd(), encoding: "utf8" });
  if (result.error) throw result.error;
  process.stdout.write(result.stdout ?? "");
  process.stderr.write(result.stderr ?? "");
  if (result.status !== 0) throw new Error("Posts migration rehearsal failed");
} finally {
  await unlink(temporaryPath);
}
