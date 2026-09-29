import nextEnv from "@next/env";
import { createClerkClient } from "@clerk/backend";

const { loadEnvConfig } = nextEnv;
loadEnvConfig(process.cwd());

const secretKey = process.env.CLERK_SECRET_KEY;
const publishableKey = process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY;
const testUrl =
  process.env.CLERK_SESSION_TEST_URL ?? "http://localhost:3000/perfil";

if (
  !secretKey?.startsWith("sk_test_") ||
  !publishableKey?.startsWith("pk_test_")
) {
  throw new Error("Clerk development keys are required");
}

const clerk = createClerkClient({ publishableKey, secretKey });
const users = await clerk.users.getUserList({ limit: 1 });
const user = users.data[0];

if (!user) {
  throw new Error("A Clerk development user is required");
}

const session = await clerk.sessions.createSession({ userId: user.id });

async function requestProfile(jwt) {
  return fetch(testUrl, {
    headers: { Authorization: `Bearer ${jwt}` },
    redirect: "manual",
  });
}

try {
  const validToken = await clerk.sessions.getToken(session.id, undefined, 60);
  const validResponse = await requestProfile(validToken.jwt);

  if (validResponse.status !== 200) {
    throw new Error(
      `Valid Clerk token returned HTTP ${validResponse.status}, expected 200`,
    );
  }

  const cacheControl = validResponse.headers.get("cache-control") ?? "";
  const validBody = await validResponse.text();

  if (cacheControl.match(/(?:^|,)\s*(?:public|s-maxage)\b/i)) {
    throw new Error("Authenticated profile response permits public caching");
  }

  if (!validBody.includes(">user<")) {
    throw new Error("Authenticated profile response omitted the server role");
  }

  const expiringToken = await clerk.sessions.getToken(session.id, undefined, 60);
  await new Promise((resolve) => setTimeout(resolve, 67_000));

  const expiredResponse = await requestProfile(expiringToken.jwt);
  const location = expiredResponse.headers.get("location");

  if (expiredResponse.status !== 307 || !location?.includes("/sign-in")) {
    throw new Error(
      `Expired Clerk token returned HTTP ${expiredResponse.status}, expected a sign-in redirect`,
    );
  }

  console.log("Clerk expired session test passed.");
} finally {
  await clerk.sessions.revokeSession(session.id);
}