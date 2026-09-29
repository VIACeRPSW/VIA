import nextEnv from "@next/env";

const { loadEnvConfig } = nextEnv;
loadEnvConfig(process.cwd());

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const publishableKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;

if (!url || !publishableKey) {
  throw new Error("Supabase environment is not configured");
}

const endpoint = new URL("/rest/v1/profiles", url);
endpoint.searchParams.set("select", "id");
endpoint.searchParams.set("limit", "1");

async function expectUnauthorized(name, authorization) {
  const headers = { apikey: publishableKey };

  if (authorization) {
    headers.Authorization = authorization;
  }

  const response = await fetch(endpoint, { headers });

  if (response.status !== 401) {
    throw new Error(`${name} returned HTTP ${response.status}, expected 401`);
  }
}

await expectUnauthorized("Anonymous request");
await expectUnauthorized(
  "Altered token request",
  "Bearer eyJhbGciOiJSUzI1NiJ9.eyJzdWIiOiJ2aWFfYWx0ZXJlZF90ZXN0In0.invalid",
);

console.log("Supabase auth boundary tests passed.");