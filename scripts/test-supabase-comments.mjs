import { readFile, unlink, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { spawnSync } from "node:child_process";

if (process.argv.length !== 2) throw new Error("This test has no apply mode or arguments");
const names = ["20261015231817_add_post_comments.sql", "20261015232459_enforce_comment_token_expiry.sql"];
async function readScripts(directory, files) {
  return (await Promise.all(files.map((name) => readFile(
    join(process.cwd(), "supabase", directory, name), "utf8",
  )))).join("\n");
}
const [migration, rollback, tests] = (await Promise.all([
  readScripts("migrations", names),
  readScripts("rollbacks", [...names].reverse()),
  readFile(join(process.cwd(), "supabase", "tests", "post_comments.sql"), "utf8"),
])).map((text) => text.replaceAll("\r\n", "\n"));
const path = join(tmpdir(), `via-comments-${process.pid}.sql`);
const quote = (text) => `'${text.replaceAll("'", "''")}'`;
const guardedTests = tests.replace("set local role anon;", () =>
  `select pg_temp.expect_comment_failure(${quote(rollback)}, '55000');\nset local role anon;`);
const sql = `${guardedTests}
begin;
create temporary table expected_comment_functions as
select proname, pg_get_functiondef(oid) as definition from pg_proc
where pronamespace = 'public'::regnamespace and proname in
  ('valid_comment_content','get_post_comment_counts','get_public_post_comments','create_post_comment',
   'comment_session_is_active','enforce_comment_session');
${rollback}
${migration}
do $$
begin
  if exists (
    select 1 from expected_comment_functions expected
    left join pg_proc actual on actual.pronamespace = 'public'::regnamespace and actual.proname = expected.proname
    where actual.oid is null or pg_get_functiondef(actual.oid) is distinct from expected.definition
  ) or (select count(*) from expected_comment_functions) <> 6 then
    raise exception 'Comment functions differ after rollback/reapplication';
  end if;
  if not (select relrowsecurity and relforcerowsecurity from pg_class where oid='public.comments'::regclass)
    or has_function_privilege('anon','public.create_post_comment(uuid,text,uuid)','EXECUTE')
    or not has_function_privilege('anon','public.get_public_post_comments(uuid,timestamptz,uuid)','EXECUTE')
    or not exists (select 1 from pg_trigger where tgrelid='public.comments'::regclass and tgname='comments_require_active_session')
    or not exists (select 1 from pg_policies where schemaname='public' and tablename='comments'
      and policyname='comments_active_session' and permissive='RESTRICTIVE') then
    raise exception 'Comment permissions differ after rollback/reapplication';
  end if;
end;
$$;
rollback;
select 'Comment rollback/reapplication passed inside a rolled-back transaction; migration history unchanged' as result;
`;
await writeFile(path, sql, "utf8");
try {
  const result = spawnSync(process.execPath, [
    join(process.cwd(), "node_modules", "supabase", "dist", "supabase.js"),
    "db", "query", "--linked", "--file", path, "--agent", "no", "--output-format", "text",
  ], { cwd: process.cwd(), encoding: "utf8" });
  if (result.error) throw result.error;
  process.stdout.write(result.stdout ?? "");
  process.stderr.write(result.stderr ?? "");
  if (result.status !== 0) throw new Error("Comment SQL validation failed; no apply mode was used");
} finally {
  await unlink(path);
}
