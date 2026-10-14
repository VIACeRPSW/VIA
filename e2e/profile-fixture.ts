import { spawnSync } from "node:child_process";
import { join } from "node:path";

export function runProfileFixtureSql(query: string) {
  const result = spawnSync(process.execPath, [
    join(process.cwd(), "node_modules", "supabase", "dist", "supabase.js"),
    "db", "query", "--linked", query, "--agent", "no", "--output-format", "text",
  ], { cwd: process.cwd(), encoding: "utf8" });
  if (result.status !== 0) throw new Error("Could not prepare or clean up an E2E profile fixture");
}

export function deleteProfile(clerkUserId: string) {
  if (!/^user_[A-Za-z0-9]+$/.test(clerkUserId)) throw new Error("Unexpected fixture identity");
  runProfileFixtureSql(`delete from public.profiles where clerk_user_id = '${clerkUserId}';`);
}
