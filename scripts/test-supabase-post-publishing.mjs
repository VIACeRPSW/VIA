import { readFile, unlink, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { spawnSync } from "node:child_process";

const args = process.argv.slice(2);
if (args.length > 1 || (args.length === 1 && args[0] !== "--preflight")) {
  throw new Error("Usage: node scripts/test-supabase-post-publishing.mjs [--preflight]");
}
const preflight = args[0] === "--preflight";
const name = "20261015164718_add_post_publishing.sql";
const [migration, rollback, tests] = await Promise.all([
  readFile(join(process.cwd(), "supabase", "migrations", name), "utf8"),
  readFile(join(process.cwd(), "supabase", "rollbacks", name), "utf8"),
  readFile(join(process.cwd(), "supabase", "tests", "post_publishing.sql"), "utf8"),
]);
const bucketEnd = migration.indexOf("create function");
if (bucketEnd < 0 || !tests.replaceAll("\r\n", "\n").startsWith("begin;\n")) {
  throw new Error("Unexpected publishing migration or test structure");
}
const reapply = migration.slice(bucketEnd);
const path = join(tmpdir(), `via-post-publishing-${process.pid}.sql`);
const testTransaction = tests.replace(/^begin;/u, () => `begin;\n${preflight ? migration : ""}`);
await writeFile(path, `${testTransaction}
begin;
${preflight ? migration : ""}
create temporary table original_profiles as select id, to_jsonb(p) as value from public.profiles p;
create function pg_temp.publishing_snapshot() returns jsonb language sql as $$
select jsonb_build_object(
  'functions',(select jsonb_agg(jsonb_build_object('name',proname,'acl',proacl,
    'definition',replace(pg_get_functiondef(oid),chr(13)||chr(10),chr(10))) order by proname)
    from pg_proc where pronamespace='public'::regnamespace
      and proname in ('begin_post_upload','commit_post_upload','abort_post_upload','finish_post_cleanup',
        'schedule_deleted_post_cleanup','owns_post_path','is_public_post_image','valid_post_title')),
  'policies',(select jsonb_agg(to_jsonb(p) order by schemaname,tablename,policyname)
    from pg_policies p where (schemaname='public' and tablename in ('posts','post_uploads','profiles'))
      or (schemaname='storage' and tablename='objects')),
  'columns',(select jsonb_agg(to_jsonb(c) order by table_name,ordinal_position)
    from information_schema.columns c where table_schema='public' and table_name in ('posts','post_uploads')),
  'grants',(select jsonb_agg(to_jsonb(g) order by table_name,column_name,grantee,privilege_type)
    from information_schema.role_column_grants g where table_schema='public'
      and table_name in ('posts','post_uploads') and grantee in ('anon','authenticated')),
  'constraints',(select jsonb_agg(jsonb_build_object('table',r.relname,'name',c.conname,'def',pg_get_constraintdef(c.oid))
    order by r.relname,c.conname) from pg_constraint c join pg_class r on r.oid=c.conrelid
    where r.oid in ('public.posts'::regclass,'public.post_uploads'::regclass)),
  'triggers',(select jsonb_agg(pg_get_triggerdef(oid) order by tgname) from pg_trigger
    where tgrelid='public.posts'::regclass and not tgisinternal),
  'rls',(select jsonb_agg(jsonb_build_object('name',relname,'enabled',relrowsecurity,'forced',relforcerowsecurity)
    order by relname) from pg_class where oid in ('public.posts'::regclass,'public.post_uploads'::regclass)),
  'bucket',(select to_jsonb(b) - 'created_at' - 'updated_at' from storage.buckets b where id='posts')
);
$$;
create temporary table expected_publishing as select pg_temp.publishing_snapshot() as value;
${rollback}
do $$ begin
  if to_regclass('public.post_uploads') is not null
    or to_regprocedure('public.begin_post_upload(uuid,uuid,text,text,uuid,text[],text)') is not null
    or to_regprocedure('public.commit_post_upload(uuid,uuid)') is not null then
    raise exception 'Publishing rollback left resources';
  end if;
end; $$;
${reapply}
do $$ begin
  if (select value from expected_publishing) is distinct from pg_temp.publishing_snapshot() then
    raise exception 'Publishing reapplication differs: %',(
      select string_agg(key,', ' order by key) from jsonb_each((select value from expected_publishing))
      where value is distinct from pg_temp.publishing_snapshot()->key);
  end if;
  if exists(select 1 from original_profiles o left join public.profiles p on p.id=o.id
    where o.value is distinct from to_jsonb(p)) then raise exception 'Existing profiles changed'; end if;
end; $$;
rollback;
select 'Publishing protocol, Storage RLS, rollback/reapplication and existing profile preservation passed' as result;
`, "utf8");
try {
  const result = spawnSync(process.execPath, [
    join(process.cwd(), "node_modules", "supabase", "dist", "supabase.js"),
    "db", "query", "--linked", "--file", path, "--agent", "no", "--output-format", "text",
  ], { cwd: process.cwd(), encoding: "utf8" });
  if (result.error) throw result.error;
  process.stdout.write(result.stdout ?? "");
  process.stderr.write(result.stderr ?? "");
  if (result.status !== 0) throw new Error("Post publishing rehearsal failed");
} finally {
  await unlink(path);
}
