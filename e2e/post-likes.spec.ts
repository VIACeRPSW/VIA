import { createHash, randomUUID } from "node:crypto";
import { createClerkClient } from "@clerk/backend";
import { clerk, setupClerkTestingToken } from "@clerk/testing/playwright";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { expect, test } from "@playwright/test";
import sharp from "sharp";
import { deleteProfile } from "./profile-fixture";

test("persists likes across feed, detail, scroll and sessions without exposing other actors", async ({ page, browser }) => {
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
  const fixtures: {
    id: string; email: string; client: SupabaseClient | null; hasProfile: boolean;
    uploads: { operation: string; lease: string }[];
  }[] = [];
  const visitor = await browser.newContext();
  try {
    for (const name of ["owner", "other", "missing"]) {
      const email = `via.like.${name}.${suffix}+clerk_test@example.com`;
      const user = await backend.users.createUser({ emailAddress: [email], skipPasswordRequirement: true });
      const fixture: (typeof fixtures)[number] = { id: user.id, email, client: null, hasProfile: false, uploads: [] };
      fixtures.push(fixture);
      const session = await backend.sessions.createSession({ userId: user.id });
      fixture.client = createClient(origin, apiKey, {
        accessToken: async () => (await backend.sessions.getToken(session.id, "supabase")).jwt,
        auth: { persistSession: false },
      });
      if (name !== "missing") {
        const profile = await fixture.client.from("profiles").insert({
          clerk_user_id: user.id, username: `like_${name}_${suffix}`, display_name: `Like ${name}`,
        });
        expect(profile.error).toBeNull();
        fixture.hasProfile = true;
      }
    }
    const [owner, other, missing] = fixtures;
    if (!owner.client || !other.client || !missing.client) throw new Error("Fixture authentication failed");
    const anonymous = createClient(origin, apiKey, { auth: { persistSession: false } });
    const categories = await owner.client.from("categories").select("id").limit(1).single();
    expect(categories.error).toBeNull();
    const bytes = await sharp({ create: { width: 48, height: 24, channels: 3, background: "#176b4d" } })
      .webp().toBuffer();
    const postIds: string[] = [];
    for (let index = 0; index < 13; index++) {
      const operation = randomUUID();
      const lease = randomUUID();
      owner.uploads.push({ operation, lease });
      const ticket = await owner.client.rpc("begin_post_upload", {
        p_operation_id: operation, p_lease_id: lease, p_title: `Like ${suffix} ${index}`, p_description: "",
        p_category_id: categories.data!.id, p_hashtags: ["likes"],
        p_image_digest: createHash("sha256").update(bytes).digest("hex"),
      });
      expect(ticket.error).toBeNull();
      expect((await owner.client.storage.from("posts").upload(ticket.data.image_path, bytes, { contentType: "image/webp" })).error)
        .toBeNull();
      const committed = await owner.client.rpc("commit_post_upload", { p_operation_id: operation, p_lease_id: lease });
      expect(committed.error).toBeNull();
      postIds.push(committed.data);
    }
    const postId = postIds[0];
    const detail = `/post/${postId}`;
    const duplicates = await Promise.all(Array.from({ length: 8 }, () =>
      other.client!.rpc("set_post_like", { p_post_id: postId, p_liked: true })));
    expect(duplicates.every((result) => !result.error && result.data[0].like_count === 1 && result.data[0].liked)).toBe(true);
    expect((await owner.client.from("likes").select("id").eq("post_id", postId)).data).toEqual([]);
    expect((await other.client.from("likes").select("id").eq("post_id", postId)).data).toHaveLength(1);
    expect((await missing.client.rpc("set_post_like", { p_post_id: postId, p_liked: true })).error?.code).toBe("42501");
    expect((await anonymous.rpc("set_post_like", { p_post_id: postId, p_liked: true })).error).not.toBeNull();
    expect((await other.client.from("likes").insert({ post_id: postId, user_id: randomUUID() })).error).not.toBeNull();
    const invalidTokenClient = createClient(origin, apiKey, {
      accessToken: async () => "invalid.jwt.token", auth: { persistSession: false },
    });
    expect((await invalidTokenClient.rpc("set_post_like", { p_post_id: postId, p_liked: true })).error).not.toBeNull();

    await setupClerkTestingToken({ page });
    await page.goto("/");
    await page.waitForFunction(() => Boolean(window.Clerk?.loaded));
    await clerk.signIn({ emailAddress: other.email, page });
    await page.goto(detail);
    let button = page.getByRole("button", { name: "Quitar me gusta", exact: true });
    await expect(button).toHaveAttribute("aria-pressed", "true");
    await expect(button.getByLabel("1 me gusta", { exact: true })).toBeVisible();
    await page.reload();
    await expect(button).toHaveAttribute("aria-pressed", "true");
    for (const width of [360, 768, 1280]) {
      await page.setViewportSize({ width, height: 900 });
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
      await button.focus();
      await expect(button).toBeFocused();
    }
    await page.keyboard.press("Enter");
    button = page.getByRole("button", { name: "Dar me gusta", exact: true });
    await expect(button).toHaveAttribute("aria-pressed", "false");
    await expect(button.getByLabel("0 me gusta", { exact: true })).toBeVisible();
    let blocked = false;
    await page.route(`**/post/${postId}`, async (route) => {
      if (!blocked && route.request().method() === "POST") {
        blocked = true;
        await route.abort("failed");
      } else await route.continue();
    });
    await button.click();
    await expect(page.getByText("No pudimos confirmar el cambio. Vuelve a intentarlo.", { exact: true })).toBeVisible();
    await expect(button).toHaveAttribute("aria-pressed", "false");
    await page.unroute(`**/post/${postId}`);
    await button.click();
    await expect(page.getByRole("button", { name: "Quitar me gusta", exact: true })).toHaveAttribute("aria-pressed", "true");
    let responseLost = false;
    await page.route(`**/post/${postId}`, async (route) => {
      if (!responseLost && route.request().method() === "POST") {
        responseLost = true;
        await route.fetch();
        await route.abort("failed");
      } else await route.continue();
    });
    await page.getByRole("button", { name: "Quitar me gusta", exact: true }).click();
    await expect(page.getByText("No pudimos confirmar el cambio. Vuelve a intentarlo.", { exact: true })).toBeVisible();
    await expect(page.getByRole("button", { name: "Quitar me gusta", exact: true })).toHaveAttribute("aria-pressed", "true");
    const lost = await other.client.rpc("get_post_likes", { p_post_ids: [postId] });
    expect(lost.error).toBeNull();
    expect(lost.data[0]).toMatchObject({ liked: false, like_count: 0 });
    await page.unroute(`**/post/${postId}`);
    await page.getByRole("button", { name: "Quitar me gusta", exact: true }).click();
    await expect(page.getByRole("button", { name: "Dar me gusta", exact: true })).toHaveAttribute("aria-pressed", "false");
    await page.getByRole("button", { name: "Dar me gusta", exact: true }).click();
    await expect(page.getByRole("button", { name: "Quitar me gusta", exact: true })).toHaveAttribute("aria-pressed", "true");

    const visitorPage = await visitor.newPage();
    await visitorPage.goto(detail);
    await expect(visitorPage.getByText("1 me gusta", { exact: true })).toBeVisible();
    await expect(visitorPage.getByRole("link", { name: "Inicia sesión para dar me gusta" })).toBeVisible();
    await expect(visitorPage.getByRole("button", { name: "Quitar me gusta" })).toHaveCount(0);
    expect(await visitorPage.content()).not.toContain(other.id);

    const likeBatches: string[][] = [];
    page.on("request", (request) => {
      const body = request.postData();
      if (request.method() === "POST" && body?.startsWith('[["')) {
        const ids = body.match(/[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}/g);
        if (ids) likeBatches.push(ids);
      }
    });
    await page.goto("/inicio");
    await expect(page.getByRole("button", { name: /^(Dar|Quitar) me gusta$/ }).first()).toBeVisible();
    expect(likeBatches).toHaveLength(1);
    expect(likeBatches[0]).toHaveLength(12);
    const card = page.locator("article").filter({ has: page.getByRole("heading", { name: `Like ${suffix} 0`, exact: true }) });
    for (let attempt = 0; attempt < 3 && !(await card.count()); attempt++) {
      const load = page.getByRole("button", { name: "Cargar más publicaciones", exact: true });
      await expect(load).toBeEnabled();
      await load.click();
      await expect(page.getByText("Cargando más imágenes...", { exact: true })).toHaveCount(0);
    }
    await expect(card.getByRole("button", { name: "Quitar me gusta" })).toHaveAttribute("aria-pressed", "true");
    expect(likeBatches).toHaveLength(2);
    expect(likeBatches[1].length).toBeGreaterThan(0);
    expect(likeBatches[1].length).toBeLessThanOrEqual(12);
    expect(likeBatches[1].some((id) => likeBatches[0].includes(id))).toBe(false);
    await card.getByRole("button", { name: "Quitar me gusta" }).click();
    await expect(card.getByRole("button", { name: "Dar me gusta" })).toHaveAttribute("aria-pressed", "false");
    await page.goto(detail);
    await expect(page.getByRole("button", { name: "Dar me gusta" })).toHaveAttribute("aria-pressed", "false");
    await other.client.rpc("set_post_like", { p_post_id: postId, p_liked: true });
    await page.evaluate(() => window.dispatchEvent(new Event("focus")));
    await expect(page.getByRole("button", { name: "Quitar me gusta" })).toHaveAttribute("aria-pressed", "true");
    await clerk.signOut({ page });
    await page.goto(detail);
    await expect(page.getByRole("link", { name: "Inicia sesión para dar me gusta" })).toBeVisible();
    await clerk.signIn({ emailAddress: owner.email, page });
    await page.goto(detail);
    await expect(page.getByRole("button", { name: "Dar me gusta" })).toHaveAttribute("aria-pressed", "false");
    await page.getByRole("button", { name: "Dar me gusta" }).click();
    await expect(page.getByLabel("2 me gusta", { exact: true })).toBeVisible();
    await page.goto("/imagenes");
    await expect(page.getByRole("button", { name: /me gusta/i })).toHaveCount(0);
    await expect(page.getByRole("list", { name: "Publicaciones", exact: true }).getByRole("heading")).toHaveCount(0);
    const retired = await owner.client.from("posts").delete().eq("id", postId).select("id");
    expect(retired.error).toBeNull();
    expect(retired.data).toHaveLength(1);
    expect((await other.client.from("likes").select("id").eq("post_id", postId)).data).toEqual([]);
    expect((await other.client.rpc("set_post_like", { p_post_id: postId, p_liked: true })).error?.code).toBe("P0002");
  } finally {
    await visitor.close();
    const failures: Error[] = [];
    for (const fixture of fixtures) {
      try {
        if (fixture.client) {
          for (const upload of fixture.uploads) {
            const aborted = await fixture.client.rpc("abort_post_upload", {
              p_operation_id: upload.operation, p_lease_id: upload.lease,
            });
            if (aborted.error) throw new Error("Could not abort like fixture upload");
          }
          const reactions = await fixture.client.from("likes").delete().not("id", "is", null);
          if (reactions.error) throw new Error("Could not remove like fixture reactions");
          const retired = await fixture.client.from("posts").delete().not("id", "is", null);
          if (retired.error) throw new Error("Could not retire like fixture posts");
          const tasks = await fixture.client.from("post_uploads").select("operation_id,image_path").eq("owner_sub", fixture.id);
          if (tasks.error) throw new Error("Could not load like fixture cleanup");
          for (const task of tasks.data ?? []) {
            if ((await fixture.client.storage.from("posts").remove([task.image_path])).error) {
              throw new Error("Could not remove like fixture image");
            }
            if ((await fixture.client.rpc("finish_post_cleanup", { p_operation_id: task.operation_id })).error) {
              throw new Error("Could not finish like fixture cleanup");
            }
          }
        }
        if (fixture.hasProfile) deleteProfile(fixture.id);
        await backend.users.deleteUser(fixture.id);
      } catch (error) {
        console.error("Like fixture cleanup failed", { errorType: error instanceof Error ? error.name : "UnknownError" });
        failures.push(new Error(`Cleanup required for like fixture ${fixture.id}`));
      }
    }
    if (failures.length) throw new AggregateError(failures, "Like fixtures were not fully cleaned up");
  }
});
