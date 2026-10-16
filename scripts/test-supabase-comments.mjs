import { readFile, unlink, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { spawnSync } from "node:child_process";

if (process.argv.length !== 2) throw new Error("This test has no apply mode or arguments");
const names = ["20261015231817_add_post_comments.sql", "20261015232459_enforce_comment_token_expiry.sql",
  "20261016000443_delete_own_post_comments.sql"];
async function readScripts(directory, files) {
  return (await Promise.all(files.map((name) => readFile(
    join(process.cwd(), "supabase", directory, name), "utf8",
  )))).join("\n");
}
const [migration, rollback, deletionMigration, deletionRollback, tests] = (await Promise.all([
  readScripts("migrations", names),
  readScripts("rollbacks", [...names].reverse()),
  readScripts("migrations", names.slice(-1)),
  readScripts("rollbacks", names.slice(-1)),
  readFile(join(process.cwd(), "supabase", "tests", "post_comments.sql"), "utf8"),
])).map((text) => text.replaceAll("\r\n", "\n"));
const path = join(tmpdir(), `via-comments-${process.pid}.sql`);
const quote = (text) => `'${text.replaceAll("'", "''")}'`;
const guardedTests = tests.replace("set local role anon;", () =>
  `select pg_temp.expect_comment_failure(${quote(rollback)}, '55000');\nset local role anon;`);
const sql = `${guardedTests}
begin;
lock table public.comments in access exclusive mode;
create temporary table expected_comment_data as
select count(*) as total, md5(coalesce(jsonb_agg(to_jsonb(comment) order by id)::text, '[]')) as digest
from public.comments comment;
create temporary table comment_roundtrip_scope (scope text);
create temporary table expected_comment_functions as
select proname, pg_get_functiondef(oid) as definition from pg_proc
where pronamespace = 'public'::regnamespace and proname in
  ('valid_comment_content','get_post_comment_counts','get_public_post_comments','create_post_comment',
   'comment_session_is_active','enforce_comment_session','delete_own_post_comment');
do $roundtrip$
begin
  if exists (select 1 from public.comments) then
    execute ${quote(deletionRollback)};
    if has_table_privilege('authenticated','public.comments','DELETE')
      or to_regprocedure('public.delete_own_post_comment(uuid,uuid)') is not null then
      raise exception 'Deletion rollback retained permissions';
    end if;
    execute ${quote(deletionMigration)};
    insert into comment_roundtrip_scope values ('Own-deletion rollback/reapplication passed with existing data preserved; full table rollback intentionally not run');
  else
    execute ${quote(rollback)};
    execute ${quote(migration)};
    insert into comment_roundtrip_scope values ('Full comment schema rollback/reapplication passed on an empty table');
  end if;
end;
$roundtrip$;
do $$
begin
  if exists (select 1 from expected_comment_data expected cross join lateral (
    select count(*) as total, md5(coalesce(jsonb_agg(to_jsonb(comment) order by id)::text, '[]')) as digest
    from public.comments comment
  ) actual where expected.total <> actual.total or expected.digest <> actual.digest) then
    raise exception 'Rollback/reapplication changed existing comments';
  end if;
  if exists (
    select 1 from expected_comment_functions expected
    left join pg_proc actual on actual.pronamespace = 'public'::regnamespace and actual.proname = expected.proname
    where actual.oid is null or pg_get_functiondef(actual.oid) is distinct from expected.definition
  ) or (select count(*) from expected_comment_functions) <> 7 then
    raise exception 'Comment functions differ after rollback/reapplication';
  end if;
  if not (select relrowsecurity and relforcerowsecurity from pg_class where oid='public.comments'::regclass)
    or has_function_privilege('anon','public.create_post_comment(uuid,text,uuid)','EXECUTE')
    or not has_function_privilege('anon','public.get_public_post_comments(uuid,timestamptz,uuid)','EXECUTE')
    or not exists (select 1 from pg_trigger where tgrelid='public.comments'::regclass and tgname='comments_require_active_session')
    or not exists (select 1 from pg_policies where schemaname='public' and tablename='comments'
      and policyname='comments_active_session' and permissive='RESTRICTIVE')
    or not exists (select 1 from pg_policies where schemaname='public' and tablename='comments'
      and policyname='comments_delete_own' and cmd='DELETE')
    or not has_table_privilege('authenticated','public.comments','DELETE')
    or has_function_privilege('anon','public.delete_own_post_comment(uuid,uuid)','EXECUTE')
    or not has_function_privilege('authenticated','public.delete_own_post_comment(uuid,uuid)','EXECUTE') then
    raise exception 'Comment permissions differ after rollback/reapplication';
  end if;
end;
$$;
select scope || '; transaction will be rolled back; migration history unchanged' as result from comment_roundtrip_scope;
rollback;
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
