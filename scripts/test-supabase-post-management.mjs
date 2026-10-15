import { readFile, unlink, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { spawnSync } from "node:child_process";

const args = process.argv.slice(2);
if (args.length > 1 || (args.length === 1 && !["--preflight", "--apply"].includes(args[0]))) {
  throw new Error("Usage: [--preflight | --apply]");
}
const name = "20261015192000_add_post_image_replacement.sql";
const [migration, rollback, tests] = await Promise.all([
  readFile(join(process.cwd(), "supabase", "migrations", name), "utf8"),
  readFile(join(process.cwd(), "supabase", "rollbacks", name), "utf8"),
  readFile(join(process.cwd(), "supabase", "tests", "post_management.sql"), "utf8"),
]);
const path = join(tmpdir(), `via-post-management-${process.pid}.sql`);
const quote = (text) => `'${text.replaceAll("'", "''")}'`;
const sql = args[0] === "--apply" ? `
begin;
${migration}
insert into supabase_migrations.schema_migrations(version,name,statements,rollback)
values ('20261015192000','add_post_image_replacement',array[${quote(migration)}],array[${quote(rollback)}]);
commit;
select 'Post image replacement migration applied and recorded atomically' as result;
` : tests.replace(/^begin;/u, () => `begin;\n${args.length ? migration : ""}`) + `
begin;
${args.length ? migration : ""}
create temporary table expected_management as
select pg_get_functiondef('public.commit_post_image_replacement(uuid,bigint,uuid,uuid)'::regprocedure) as definition;
${rollback}
${migration}
do $$ begin
  if (select definition from expected_management) is distinct from
    pg_get_functiondef('public.commit_post_image_replacement(uuid,bigint,uuid,uuid)'::regprocedure) then
    raise exception 'Management migration reapplication differs';
  end if;
end; $$;
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
  if (result.status !== 0) throw new Error("Post management SQL validation failed");
} finally {
  await unlink(path);
}
