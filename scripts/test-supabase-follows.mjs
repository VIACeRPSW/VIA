import { readFile, unlink, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { spawnSync } from "node:child_process";

if (process.argv.length !== 2) throw new Error("This test has no apply mode or arguments");
const name = "20261016003306_add_profile_follows.sql";
const [migration, rollback, tests] = (await Promise.all([
  readFile(join(process.cwd(), "supabase", "migrations", name), "utf8"),
  readFile(join(process.cwd(), "supabase", "rollbacks", name), "utf8"),
  readFile(join(process.cwd(), "supabase", "tests", "profile_follows.sql"), "utf8"),
])).map((text) => text.replaceAll("\r\n", "\n"));
const quote = (text) => `'${text.replaceAll("'", "''")}'`;
const guarded = tests.replace("set local role anon;", () =>
  `select pg_temp.expect_follow_failure(${quote(rollback)},'55000');\nset local role anon;`);
const sql = `${guarded}
begin;
create temporary table expected_follow_functions as
select proname,pg_get_functiondef(oid) as definition from pg_proc
where pronamespace='public'::regnamespace
and proname in('follow_session_is_active','get_profile_follows','set_profile_follow');
create temporary table expected_follow_profiles as select count(*) as total from public.profiles;
${rollback}
${migration}
do $$
begin
  if (select count(*) from expected_follow_functions)<>3 or exists (
    select 1 from expected_follow_functions expected left join pg_proc actual
    on actual.pronamespace='public'::regnamespace and actual.proname=expected.proname
    where actual.oid is null or pg_get_functiondef(actual.oid) is distinct from expected.definition
  ) then raise exception 'Follow functions differ after roundtrip'; end if;
  if (select count(*) from public.profiles)<>(select total from expected_follow_profiles)
    or not (select relrowsecurity and relforcerowsecurity from pg_class where oid='public.follows'::regclass)
    or has_table_privilege('anon','public.follows','SELECT')
    or has_table_privilege('authenticated','public.follows','UPDATE')
    or has_column_privilege('authenticated','public.follows','follower_id','INSERT')
    or not has_column_privilege('authenticated','public.follows','following_id','INSERT')
    or has_function_privilege('anon','public.set_profile_follow(uuid,boolean)','EXECUTE')
    or not has_function_privilege('anon','public.get_profile_follows(text,uuid)','EXECUTE')
    or (select count(*) from pg_policies where schemaname='public' and tablename='follows')<>4
    or not exists(select 1 from pg_policies where schemaname='public' and tablename='follows'
      and policyname='follows_active_session' and permissive='RESTRICTIVE')
    or (select count(*) from pg_constraint where conrelid='public.follows'::regclass
      and contype='f' and confdeltype='a')<>2 then
    raise exception 'Follow permissions/profiles/FKs differ after roundtrip';
  end if;
end;
$$;
rollback;
select 'Follow rollback/reapplication passed in a rolled-back transaction; profiles and migration history unchanged' as result;
`;
const path = join(tmpdir(), `via-follows-${process.pid}.sql`);
await writeFile(path, sql, "utf8");
try {
  const result = spawnSync(process.execPath, [
    join(process.cwd(), "node_modules", "supabase", "dist", "supabase.js"),
    "db", "query", "--linked", "--file", path, "--agent", "no", "--output-format", "text",
  ], { cwd: process.cwd(), encoding: "utf8" });
  if (result.error) throw result.error;
  process.stdout.write(result.stdout ?? "");
  process.stderr.write(result.stderr ?? "");
  if (result.status !== 0) throw new Error("Follow SQL validation failed; no apply mode was used");
} finally {
  await unlink(path);
}
