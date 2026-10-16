import { randomUUID } from "node:crypto";
import { createClerkClient } from "@clerk/backend";
import { clerk, setupClerkTestingToken } from "@clerk/testing/playwright";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { expect, test, type Page } from "@playwright/test";
import { deleteProfile } from "./profile-fixture";

test("follows stable profiles with private actor state, idempotent retries and unchanged feed", async ({ page, browser }) => {
  test.setTimeout(300_000);
  const secretKey = process.env.CLERK_SECRET_KEY;
  const publishableKey = process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY;
  const origin = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const apiKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  if (!secretKey?.startsWith("sk_test_") || !publishableKey?.startsWith("pk_test_") || !origin || !apiKey) {
    throw new Error("Development Clerk and Supabase configuration is required");
  }
  const backend = createClerkClient({ secretKey, publishableKey });
  const suffix = Date.now().toString(36);
  const fixtures: { id: string; email: string; username: string; profileId: string | null;
    sessionId: string; client: SupabaseClient }[] = [];
  const unregisteredUsers = new Set<string>();
  const anonymous = await browser.newContext();
  const incomplete = await browser.newContext();
  async function signIn(target: Page, email: string) {
    await setupClerkTestingToken({ page: target });
    await target.goto("/");
    await target.waitForFunction(() => Boolean(window.Clerk?.loaded));
    await clerk.signIn({ emailAddress: email, page: target });
  }
  const section = page.getByRole("region", { name: "Seguimiento del perfil", exact: true });
  const followers = section.getByText("Seguidores", { exact: true }).locator("..").locator("dd");
  const following = section.getByText("Seguidos", { exact: true }).locator("..").locator("dd");
  try {
    for (const name of ["owner", "other", "missing"]) {
      const email = `via.follow.${name}.${suffix}+clerk_test@example.com`;
      const user = await backend.users.createUser({ emailAddress: [email], skipPasswordRequirement: true });
      unregisteredUsers.add(user.id);
      const session = await backend.sessions.createSession({ userId: user.id });
      const client = createClient(origin, apiKey, {
        accessToken: async () => (await backend.sessions.getToken(session.id, "supabase")).jwt,
        auth: { persistSession: false },
      });
      const fixture: (typeof fixtures)[number] = {
        id: user.id, email, username: `follow_${name}_${suffix}`, profileId: null, sessionId: session.id, client,
      };
      fixtures.push(fixture);
      unregisteredUsers.delete(user.id);
      if (name !== "missing") {
        const profile = await client.from("profiles").insert({
          clerk_user_id: user.id, username: fixture.username, display_name: `Follow ${name}`,
        }).select("id").single();
        expect(profile.error).toBeNull();
        fixture.profileId = profile.data!.id;
      }
    }
    const [owner, other, missing] = fixtures;
    if (!owner.profileId || !other.profileId) throw new Error("Follow fixture profiles missing");
    const targetId = owner.profileId;
    const path = `/usuario/${owner.username}`;
    const frozen = await backend.sessions.getToken(other.sessionId, "supabase", 60);
    const claims: unknown = JSON.parse(Buffer.from(frozen.jwt.split(".")[1], "base64url").toString("utf8"));
    if (!claims || typeof claims !== "object" || !("exp" in claims) || typeof claims.exp !== "number") {
      throw new Error("Short-lived follow token omitted expiration");
    }
    const expiration = claims.exp;
    const expiring = createClient(origin, apiKey, { accessToken: async () => frozen.jwt, auth: { persistSession: false } });
    const repeated = await Promise.all(Array.from({ length: 6 }, () => expiring.rpc("set_profile_follow", {
      p_profile_id: targetId, p_following: true,
    })));
    expect(repeated.every((result) => !result.error && result.data.summary.follower_count === 1)).toBe(true);
    const reciprocal = await Promise.all([
      owner.client.rpc("set_profile_follow", { p_profile_id: other.profileId, p_following: true }),
      other.client.rpc("set_profile_follow", { p_profile_id: targetId, p_following: true }),
    ]);
    expect(reciprocal.every((result) => !result.error && result.data.summary.follower_count === 1)).toBe(true);
    const desiredStates = [true, false, true, false, true, false];
    const raced = await Promise.all(desiredStates.map((desired) => other.client.rpc("set_profile_follow", {
      p_profile_id: targetId, p_following: desired,
    })));
    expect(raced.every((result, index) => !result.error && result.data.summary.following === desiredStates[index]
      && result.data.summary.follower_count === Number(desiredStates[index]))).toBe(true);
    const afterRace = await other.client.rpc("get_profile_follows", { p_profile_id: targetId });
    expect(afterRace.error).toBeNull();
    expect(afterRace.data.follower_count).toBe(Number(afterRace.data.following));
    expect((await owner.client.from("follows").select("id").eq("follower_id", other.profileId)).data).toEqual([]);
    expect((await owner.client.from("follows").delete().eq("follower_id", other.profileId).select("id")).data).toEqual([]);
    expect((await owner.client.from("follows").insert({ follower_id: other.profileId, following_id: targetId })).error).not.toBeNull();
    expect((await other.client.rpc("set_profile_follow", { p_profile_id: other.profileId, p_following: true })).error?.code).toBe("22023");
    expect((await other.client.rpc("set_profile_follow", { p_profile_id: randomUUID(), p_following: true })).error?.code).toBe("P0002");
    expect((await missing.client.rpc("set_profile_follow", { p_profile_id: targetId, p_following: true })).error?.code).toBe("42501");
    expect((await owner.client.rpc("set_profile_follow", { p_profile_id: other.profileId, p_following: false })).error).toBeNull();
    expect((await other.client.rpc("set_profile_follow", { p_profile_id: targetId, p_following: false })).error).toBeNull();
    await signIn(page, other.email);
    await page.goto("/inicio");
    const beforeFeed = await page.locator(".feed-card-copy h2 a").evaluateAll((links) => links.map((link) => link.getAttribute("href")));
    await page.goto(path);
    await expect(followers).toHaveText("0");
    await expect(following).toHaveText("0");
    for (const width of [360, 768, 1280]) {
      await page.setViewportSize({ width, height: 900 });
      const follow = section.getByRole("button", { name: "Seguir", exact: true });
      await expect(follow).toBeEnabled();
      await follow.focus();
      await page.keyboard.press("Enter");
      const unfollow = section.getByRole("button", { name: "Dejar de seguir", exact: true });
      await expect(unfollow).toHaveAttribute("aria-pressed", "true");
      await expect(followers).toHaveText("1");
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
      await unfollow.focus();
      await page.keyboard.press("Enter");
      await expect(follow).toHaveAttribute("aria-pressed", "false");
      await expect(followers).toHaveText("0");
    }
    await page.route(`**${path}`, async (route) => {
      if (route.request().method() === "POST" && route.request().postData()?.includes('"following":true')) await route.abort("failed");
      else await route.continue();
    });
    await section.getByRole("button", { name: "Seguir", exact: true }).click();
    const retry = section.getByRole("button", { name: "Reintentar seguimiento", exact: true });
    await expect(retry).toBeVisible();
    await expect(followers).toHaveText("0");
    expect((await other.client.rpc("get_profile_follows", { p_profile_id: targetId })).data.following).toBe(false);
    await page.unroute(`**${path}`);
    let lost = false;
    await page.route(`**${path}`, async (route) => {
      if (!lost && route.request().method() === "POST" && route.request().postData()?.includes('"following":true')) {
        lost = true;
        await route.fetch();
        await route.abort("failed");
      } else await route.continue();
    });
    await retry.click();
    await expect.poll(() => lost).toBe(true);
    await expect(retry).toBeEnabled();
    await expect(followers).toHaveText("0");
    expect((await other.client.rpc("get_profile_follows", { p_profile_id: targetId })).data.follower_count).toBe(1);
    await page.unroute(`**${path}`);
    await retry.click();
    await expect(section.getByRole("button", { name: "Dejar de seguir", exact: true })).toHaveAttribute("aria-pressed", "true");
    await expect(followers).toHaveText("1");
    await page.reload();
    await expect(section.getByRole("button", { name: "Dejar de seguir", exact: true })).toHaveAttribute("aria-pressed", "true");
    await page.goto("/perfil");
    await expect(following).toHaveText("1");
    await expect(section.getByText("Este es tu perfil.", { exact: true })).toBeVisible();
    await expect(section.getByRole("button", { name: "Seguir", exact: true })).toHaveCount(0);
    const visitor = await anonymous.newPage();
    await visitor.goto(path);
    const publicSection = visitor.getByRole("region", { name: "Seguimiento del perfil", exact: true });
    await expect(publicSection.getByText("Seguidores", { exact: true }).locator("..").locator("dd")).toHaveText("1");
    await expect(publicSection.getByRole("link", { name: "Inicia sesión para seguir", exact: true })).toBeVisible();
    expect(await visitor.content()).not.toContain(other.id);
    const missingPage = await incomplete.newPage();
    await signIn(missingPage, missing.email);
    await missingPage.goto(path);
    await expect(missingPage.getByRole("link", { name: "Completa tu perfil para seguir autores", exact: true })).toBeVisible();
    await page.goto(path);
    const wait = expiration * 1000 + 6_000 - Date.now();
    if (wait > 75_000) throw new Error("Follow token does not have the requested short lifetime");
    if (wait > 0) await new Promise((resolve) => setTimeout(resolve, wait));
    const expired = await expiring.rpc("set_profile_follow", { p_profile_id: targetId, p_following: false });
    expect([401, 403]).toContain(expired.status);
    expect(expired.error).not.toBeNull();
    const invalid = createClient(origin, apiKey, { accessToken: async () => `${frozen.jwt}invalid`, auth: { persistSession: false } });
    const invalidResult = await invalid.rpc("set_profile_follow", { p_profile_id: targetId, p_following: false });
    expect([401, 403]).toContain(invalidResult.status);
    expect(invalidResult.error).not.toBeNull();
    expect((await other.client.rpc("get_profile_follows", { p_profile_id: targetId })).data.follower_count).toBe(1);
    await clerk.signOut({ page });
    await page.goto(path);
    await expect(section.getByRole("link", { name: "Inicia sesión para seguir", exact: true })).toBeVisible();
    await clerk.signIn({ emailAddress: owner.email, page });
    await page.goto(path);
    await expect(section.getByText("Este es tu perfil.", { exact: true })).toBeVisible();
    await expect(section.getByRole("button", { name: "Dejar de seguir", exact: true })).toHaveCount(0);
    await clerk.signOut({ page });
    await clerk.signIn({ emailAddress: other.email, page });
    await page.goto(path);
    await expect(section.getByRole("button", { name: "Dejar de seguir", exact: true })).toHaveAttribute("aria-pressed", "true");
    expect((await other.client.rpc("set_profile_follow", { p_profile_id: targetId, p_following: false })).error).toBeNull();
    await page.evaluate(() => window.dispatchEvent(new Event("focus")));
    await expect(section.getByRole("button", { name: "Seguir", exact: true })).toHaveAttribute("aria-pressed", "false");
    expect((await other.client.rpc("set_profile_follow", { p_profile_id: targetId, p_following: true })).error).toBeNull();
    await page.evaluate(() => document.dispatchEvent(new Event("visibilitychange")));
    await expect(section.getByRole("button", { name: "Dejar de seguir", exact: true })).toHaveAttribute("aria-pressed", "true");
    const renamed = `follow_new_${suffix}`;
    expect((await owner.client.from("profiles").update({ username: renamed }).eq("id", targetId)).error).toBeNull();
    await page.evaluate(() => window.dispatchEvent(new Event("focus")));
    await expect(section.getByRole("link", { name: `@${renamed}`, exact: true })).toBeVisible();
    await section.getByRole("link", { name: `@${renamed}`, exact: true }).click();
    await expect(page).toHaveURL(new RegExp(`/usuario/${renamed}$`));
    await section.getByRole("button", { name: "Dejar de seguir", exact: true }).click();
    await expect(followers).toHaveText("0");
    expect((await other.client.rpc("get_profile_follows", { p_profile_id: targetId })).data.profile_id).toBe(targetId);
    const oldRoute = await visitor.goto(path);
    expect([200, 404]).toContain(oldRoute?.status());
    await expect(visitor.getByRole("heading", { name: "Perfil no encontrado", exact: true })).toBeVisible();
    await expect(visitor.getByRole("heading", { name: "Follow owner", exact: true })).toHaveCount(0);
    await expect(publicSection).toHaveCount(0);
    expect((await other.client.rpc("get_profile_follows", { p_username: owner.username })).data).toBeNull();
    await page.goto("/perfil");
    await expect(following).toHaveText("0");
    await page.reload();
    await expect(following).toHaveText("0");
    await expect(section.getByText("Este es tu perfil.", { exact: true })).toBeVisible();
    await page.goto("/inicio");
    expect(await page.locator(".feed-card-copy h2 a").evaluateAll((links) => links.map((link) => link.getAttribute("href")))).toEqual(beforeFeed);
    await page.goto(`/usuario/${renamed}`);
    await expect(section.getByRole("button", { name: "Seguir", exact: true })).toBeEnabled();
    deleteProfile(owner.id);
    owner.profileId = null;
    await page.evaluate(() => window.dispatchEvent(new Event("focus")));
    await expect(section.getByText("Este perfil ya no está disponible.", { exact: true })).toBeVisible();
    await expect(section.getByRole("button", { name: "Seguir", exact: true })).toHaveCount(0);
  } finally {
    await page.goto("about:blank");
    await anonymous.close();
    await incomplete.close();
    const failures: Error[] = [];
    for (const fixture of fixtures) {
      try {
        if ((await fixture.client.from("follows").delete().not("id", "is", null)).error) {
          throw new Error("Could not remove follow fixture relations");
        }
      } catch (error) {
        console.error("Follow relation cleanup failed", { errorType: error instanceof Error ? error.name : "UnknownError" });
        failures.push(new Error(`Follow relation cleanup required for ${fixture.id}`));
      }
    }
    for (const fixture of fixtures) {
      try {
        deleteProfile(fixture.id);
        await backend.users.deleteUser(fixture.id);
      } catch (error) {
        console.error("Follow fixture cleanup failed", { errorType: error instanceof Error ? error.name : "UnknownError" });
        failures.push(new Error(`Follow profile/user cleanup required for ${fixture.id}`));
      }
    }
    for (const id of unregisteredUsers) {
      try {
        await backend.users.deleteUser(id);
      } catch (error) {
        console.error("Follow session fixture cleanup failed", { errorType: error instanceof Error ? error.name : "UnknownError" });
        failures.push(new Error(`Follow user cleanup required for ${id}`));
      }
    }
    if (failures.length) throw new AggregateError(failures, "Follow fixtures were not fully cleaned up");
  }
});
