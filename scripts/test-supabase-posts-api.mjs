import assert from "node:assert/strict";
import nextEnv from "@next/env";

const { loadEnvConfig } = nextEnv;
loadEnvConfig(process.cwd());
const origin = process.env.NEXT_PUBLIC_SUPABASE_URL;
const apiKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
if (!origin || !apiKey) throw new Error("Supabase environment is not configured");

async function request(path, body) {
  return fetch(new URL(`/rest/v1/${path}`, origin), {
    method: body === undefined ? "GET" : "POST",
    headers: { apikey: apiKey, "Content-Type": "application/json" },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
  });
}

const categories = await request("categories?select=id,name,description");
assert.equal(categories.status, 200, "Anonymous category catalog should be readable");
const categoryRows = await categories.json();
assert.ok(Array.isArray(categoryRows));
const expectedNames = ["Historia", "Ciencia", "Arte", "Tecnolog\u00eda", "Matem\u00e1ticas"];
for (const name of expectedNames) {
  assert.ok(categoryRows.some((row) => row.name === name), `Missing category: ${name}`);
}
const privateRows = await request("posts?select=*");
assert.equal(privateRows.status, 401, "Anonymous clients must not read private post rows");
const alteredToken = await fetch(new URL("/rest/v1/posts?select=id", origin), {
  headers: { apikey: apiKey, Authorization: "Bearer invalid.jwt.token" },
});
assert.equal(alteredToken.status, 401, "An altered token must not read private post rows");
const privateProfiles = await request("profiles?select=clerk_user_id");
assert.equal(privateProfiles.status, 401, "Post reads must not expose private profiles");

const feed = await request("rpc/get_public_posts", {});
assert.equal(feed.status, 200, "Anonymous public posts RPC failed");
const rows = await feed.json();
assert.ok(Array.isArray(rows) && rows.length <= 12, "Feed must return an array of at most 12 posts");
const expectedFields = [
  "author_avatar_url", "author_display_name", "author_username", "category_id", "category_name",
  "created_at", "description", "hashtags", "id", "image_path", "title", "updated_at",
];
for (const row of rows) {
  assert.deepEqual(Object.keys(row).sort(), expectedFields);
}
const invalidCursor = await request("rpc/get_public_posts", { p_before_id: "00000000-0000-0000-0000-000000000000" });
assert.equal(invalidCursor.status, 400, "Incomplete cursor must fail explicitly");
assert.equal((await invalidCursor.json()).code, "22023");

console.log("Posts HTTP catalog, private table boundary, public RPC and cursor validation passed.");
