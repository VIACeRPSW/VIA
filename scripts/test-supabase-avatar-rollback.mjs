import { readFile, writeFile, unlink } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { spawnSync } from "node:child_process";

const name = process.argv[2];
if (!name || !/^\d{14}_add_avatar_storage\.sql$/u.test(name)) {
  throw new Error("Provide the versioned avatar migration filename");
}
const migration = await readFile(join(process.cwd(), "supabase", "migrations", name), "utf8");
const rollback = await readFile(join(process.cwd(), "supabase", "rollbacks", name), "utf8");
const bucketInsert = /^insert into storage\.buckets\b[^;]+;\s*/u;
if (!bucketInsert.test(migration)) throw new Error("Avatar bucket creation statement was not found");
const applicationMigration = migration.replace(bucketInsert, "");
const temporaryPath = join(tmpdir(), `via-avatar-rollback-${process.pid}.sql`);
const snapshot = `
create function pg_temp.avatar_snapshot() returns jsonb language sql as $$
select jsonb_build_object(
  'bucket', (select to_jsonb(b) - 'created_at' - 'updated_at' from storage.buckets b where id = 'avatars'),
  'policies', (select jsonb_agg(to_jsonb(p) order by policyname) from pg_policies p
    where (schemaname = 'storage' and policyname like 'avatars_%')
      or (schemaname = 'public' and tablename = 'avatar_cleanup_tasks')),
  'columns', (select jsonb_agg(jsonb_build_object('name', column_name, 'type', data_type, 'default', column_default)
    order by ordinal_position) from information_schema.columns where table_schema = 'public' and table_name = 'avatar_cleanup_tasks'),
  'functions', (select jsonb_agg(jsonb_build_object('name', proname,
    'body', regexp_replace(regexp_replace(btrim(prosrc), '\\s+', ' ', 'g'),
      '\\s*([(),;])\\s*', '\\1', 'g'), 'definer', prosecdef, 'config', proconfig, 'acl', proacl)
    order by proname) from pg_proc where oid in ('public.owns_avatar_path(text)'::regprocedure,
      'public.commit_profile_avatar(text,text,text)'::regprocedure))
);
$$;
`;
await writeFile(temporaryPath, `
begin;
select id from storage.buckets where id = 'avatars' for update;
${snapshot}
create temporary table expected_avatar_schema as select pg_temp.avatar_snapshot() as value;
${rollback}
do $$ begin
  if not exists(select 1 from storage.buckets where id = 'avatars')
    or to_regclass('public.avatar_cleanup_tasks') is not null
    or to_regprocedure('public.commit_profile_avatar(text,text,text)') is not null then
    raise exception 'Avatar rollback left resources';
  end if;
end; $$;
${applicationMigration}
do $$ begin
  if (select value from expected_avatar_schema) is distinct from pg_temp.avatar_snapshot() then
    raise exception 'Reapplied avatar migration differs';
  end if;
end; $$;
rollback;
select 'Application rollback and reapplication passed; empty bucket retained for Storage API removal' as result;
`, "utf8");
try {
  const result = spawnSync(process.execPath, [
    join(process.cwd(), "node_modules", "supabase", "dist", "supabase.js"),
    "db", "query", "--linked", "--file", temporaryPath, "--agent", "no", "--output-format", "text",
  ], { cwd: process.cwd(), encoding: "utf8" });
  if (result.error) throw result.error;
  process.stdout.write(result.stdout ?? "");
  process.stderr.write(result.stderr ?? "");
  if (result.status !== 0) throw new Error("Avatar rollback rehearsal failed");
} finally {
  await unlink(temporaryPath);
}
