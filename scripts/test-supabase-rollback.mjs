import { readdir, readFile, unlink, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { spawnSync } from "node:child_process";

const temporaryPath = join(tmpdir(), `via-rollback-test-${process.pid}.sql`);

const migrationsDirectory = join(process.cwd(), "supabase", "migrations");
const rollbacksDirectory = join(process.cwd(), "supabase", "rollbacks");
const migrationNames = (await readdir(migrationsDirectory))
  .filter((name) => name.endsWith(".sql"))
  .sort();
const rollbackNames = [...migrationNames].reverse();

const migrations = await Promise.all(
  migrationNames.map((name) => readFile(join(migrationsDirectory, name), "utf8")),
);
const rollbacks = await Promise.all(
  rollbackNames.map((name) => readFile(join(rollbacksDirectory, name), "utf8")),
);
const migration = migrations.join("\n");
const rollback = rollbacks.join("\n");

const testSql = `
begin;

create function pg_temp.profiles_schema_snapshot()
returns jsonb
language sql
as $$
  select jsonb_build_object(
    'columns', (
      select jsonb_agg(
        jsonb_build_object(
          'name', column_name,
          'type', data_type,
          'nullable', is_nullable,
          'default', column_default
        )
        order by ordinal_position
      )
      from information_schema.columns
      where table_schema = 'public' and table_name = 'profiles'
    ),
    'constraints', (
      select jsonb_agg(
        jsonb_build_object(
          'name', conname,
          'type', contype,
          'definition', pg_get_constraintdef(oid)
        )
        order by conname
      )
      from pg_constraint
      where conrelid = 'public.profiles'::regclass
    ),
    'policies', (
      select jsonb_agg(to_jsonb(policy_row) order by policyname)
      from (
        select policyname, permissive, roles, cmd, qual, with_check
        from pg_policies
        where schemaname = 'public' and tablename = 'profiles'
      ) as policy_row
    ),
    'triggers', (
      select jsonb_agg(
        jsonb_build_object('name', tgname, 'definition', pg_get_triggerdef(oid))
        order by tgname
      )
      from pg_trigger
      where tgrelid = 'public.profiles'::regclass and not tgisinternal
    ),
    'table_security', (
      select jsonb_build_object(
        'rls', relrowsecurity,
        'force_rls', relforcerowsecurity
      )
      from pg_class
      where oid = 'public.profiles'::regclass
    ),
    'table_grants', (
      select jsonb_agg(
        jsonb_build_object('grantee', grantee, 'privilege', privilege_type)
        order by grantee, privilege_type
      )
      from information_schema.role_table_grants
      where table_schema = 'public'
        and table_name = 'profiles'
        and grantee in ('anon', 'authenticated')
    ),
    'column_grants', (
      select jsonb_agg(
        jsonb_build_object(
          'grantee', grantee,
          'column', column_name,
          'privilege', privilege_type
        )
        order by grantee, column_name, privilege_type
      )
      from information_schema.role_column_grants
      where table_schema = 'public'
        and table_name = 'profiles'
        and grantee in ('anon', 'authenticated')
    ),
    'function', pg_get_functiondef('public.set_updated_at()'::regprocedure)
  );
$$;

create temporary table expected_profiles_schema as
select pg_temp.profiles_schema_snapshot() as snapshot;

${rollback}

do $$
begin
  if to_regclass('public.profiles') is not null then
    raise exception 'Rollback did not remove public.profiles';
  end if;

  if to_regprocedure('public.set_updated_at()') is not null then
    raise exception 'Rollback did not remove public.set_updated_at()';
  end if;
end;
$$;

${migration}

do $$
begin
  if to_regclass('public.profiles') is null then
    raise exception 'Migration did not restore public.profiles';
  end if;

  if to_regprocedure('public.set_updated_at()') is null then
    raise exception 'Migration did not restore public.set_updated_at()';
  end if;

  if (select snapshot from expected_profiles_schema)
    is distinct from pg_temp.profiles_schema_snapshot() then
    raise exception 'Reapplied migration produced a different schema';
  end if;
end;
$$;

select 'profiles rollback and reapply passed' as result;

rollback;
`;

await writeFile(temporaryPath, testSql, "utf8");

try {
  const supabaseCli = join(
    process.cwd(),
    "node_modules",
    "supabase",
    "dist",
    "supabase.js",
  );
  const result = spawnSync(
    process.execPath,
    [
      supabaseCli,
      "db",
      "query",
      "--linked",
      "--file",
      temporaryPath,
      "--agent",
      "no",
      "--output-format",
      "text",
    ],
    { cwd: process.cwd(), stdio: "inherit" },
  );

  if (result.error) {
    throw result.error;
  }

  process.exitCode = result.status ?? 1;
} finally {
  await unlink(temporaryPath).catch(() => undefined);
}