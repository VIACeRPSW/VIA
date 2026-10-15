import { createHash, randomUUID } from "node:crypto";
import { createClerkClient } from "@clerk/backend";
import { clerk, setupClerkTestingToken } from "@clerk/testing/playwright";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { expect, test } from "@playwright/test";
import sharp from "sharp";
import { deleteProfile } from "./profile-fixture";

test("creates plain-text comments once, paginates publicly and preserves drafts on failed requests", async ({ page, browser }) => {
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
    id: string; email: string; sessionId: string | null; client: SupabaseClient | null; hasProfile: boolean;
    uploads: { operation: string; lease: string }[];
  }[] = [];
  const visitor = await browser.newContext();
  const incomplete = await browser.newContext();
  try {
    for (const name of ["owner", "other", "missing"]) {
      const email = `via.comment.${name}.${suffix}+clerk_test@example.com`;
      const user = await backend.users.createUser({ emailAddress: [email], skipPasswordRequirement: true });
      const fixture: (typeof fixtures)[number] = {
        id: user.id, email, sessionId: null, client: null, hasProfile: false, uploads: [],
      };
      fixtures.push(fixture);
      const session = await backend.sessions.createSession({ userId: user.id });
      fixture.sessionId = session.id;
      fixture.client = createClient(origin, apiKey, {
        accessToken: async () => (await backend.sessions.getToken(session.id, "supabase")).jwt,
        auth: { persistSession: false },
      });
      if (name !== "missing") {
        expect((await fixture.client.from("profiles").insert({
          clerk_user_id: user.id, username: `comment_${name}_${suffix}`, display_name: `Comment ${name}`,
        })).error).toBeNull();
        fixture.hasProfile = true;
      }
    }
    const [owner, other, missing] = fixtures;
    if (!owner.client || !other.client || !other.sessionId || !missing.client) throw new Error("Fixture authentication failed");
    const categories = await owner.client.from("categories").select("id").limit(1).single();
    expect(categories.error).toBeNull();
    const bytes = await sharp({ create: { width: 48, height: 24, channels: 3, background: "#176b4d" } })
      .webp().toBuffer();
    const operation = randomUUID();
    const lease = randomUUID();
    owner.uploads.push({ operation, lease });
    const ticket = await owner.client.rpc("begin_post_upload", {
      p_operation_id: operation, p_lease_id: lease, p_title: `Comments ${suffix}`, p_description: "",
      p_category_id: categories.data!.id, p_hashtags: ["comments"],
      p_image_digest: createHash("sha256").update(bytes).digest("hex"),
    });
    expect(ticket.error).toBeNull();
    expect((await owner.client.storage.from("posts").upload(ticket.data.image_path, bytes, { contentType: "image/webp" })).error)
      .toBeNull();
    const committed = await owner.client.rpc("commit_post_upload", { p_operation_id: operation, p_lease_id: lease });
    expect(committed.error).toBeNull();
    const postId: string = committed.data;
    const detail = `/post/${postId}`;
    const frozen = await backend.sessions.getToken(other.sessionId, "supabase", 60);
    const payload: unknown = JSON.parse(Buffer.from(frozen.jwt.split(".")[1], "base64url").toString("utf8"));
    if (!payload || typeof payload !== "object" || !("exp" in payload) || typeof payload.exp !== "number") {
      throw new Error("Short-lived fixture token omitted expiration");
    }
    const expiration = payload.exp;
    const expiring = createClient(origin, apiKey, { accessToken: async () => frozen.jwt, auth: { persistSession: false } });
    const repeatedId = randomUUID();
    const concurrent = await Promise.all(Array.from({ length: 6 }, () =>
      expiring.rpc("create_post_comment", { p_post_id: postId, p_content: "Concurrent comment", p_operation_id: repeatedId })));
    expect(concurrent.every((result) => !result.error && result.data.commentCount === 1)).toBe(true);
    expect(new Set(concurrent.map((result) => result.data.comment.id)).size).toBe(1);
    for (let index = 0; index < 12; index++) {
      expect((await other.client.rpc("create_post_comment", {
        p_post_id: postId, p_content: index === 0 ? "\u{1F600}".repeat(1000) : `Seed ${index}`,
        p_operation_id: randomUUID(),
      })).error).toBeNull();
    }
    expect((await owner.client.from("comments").select("id").eq("post_id", postId)).data).toEqual([]);
    expect((await missing.client.rpc("create_post_comment", {
      p_post_id: postId, p_content: "Missing profile", p_operation_id: randomUUID(),
    })).error?.code).toBe("42501");
    expect((await other.client.from("comments").insert({
      post_id: postId, content: "Spoof", operation_id: randomUUID(), user_id: randomUUID(),
    })).error).not.toBeNull();

    await setupClerkTestingToken({ page });
    await page.goto("/");
    await page.waitForFunction(() => Boolean(window.Clerk?.loaded));
    await clerk.signIn({ emailAddress: other.email, page });
    await page.goto(detail);
    await expect(page.getByRole("heading", { name: "Comentarios (13)", exact: true })).toBeVisible();
    const textarea = page.getByLabel("Escribe un comentario", { exact: true });
    const submit = page.getByRole("button", { name: "Publicar comentario", exact: true });
    await textarea.fill(" \t ");
    await submit.click();
    await expect(textarea).toHaveAttribute("aria-invalid", "true");
    await expect(textarea).toBeFocused();
    await textarea.fill("\u{1F600}".repeat(1001));
    await submit.click();
    await expect(textarea).toHaveAttribute("aria-invalid", "true");
    const content = '<img src=x onerror="window.commentExecuted=true"> Texto seguro';
    await textarea.fill(content);
    let lost = false;
    await page.route(`**/post/${postId}`, async (route) => {
      if (!lost && route.request().method() === "POST" && route.request().postData()?.startsWith("[{")) {
        lost = true;
        await route.fetch();
        await route.abort("failed");
      } else await route.continue();
    });
    await submit.click();
    await expect(page.getByText(
      "No pudimos confirmar el comentario. Reintenta sin cambiar el texto para confirmar el mismo envío.", { exact: true },
    )).toBeVisible();
    await expect(textarea).toHaveValue(content);
    const persisted = await other.client.from("comments").select("id").eq("post_id", postId).eq("content", content);
    expect(persisted.error).toBeNull();
    expect(persisted.data).toHaveLength(1);
    await page.unroute(`**/post/${postId}`);
    await submit.click();
    await expect(page.getByText("Comentario publicado.", { exact: true })).toBeVisible();
    await expect(textarea).toHaveValue("");
    await expect(page.getByRole("heading", { name: "Comentarios (14)", exact: true })).toBeVisible();
    expect((await other.client.from("comments").select("id").eq("post_id", postId).eq("content", content)).data).toHaveLength(1);
    await expect(page.locator("#comentarios img")).toHaveCount(0);
    await expect(page.getByText(content, { exact: true })).toBeVisible();
    await page.reload();
    const list = page.getByRole("list", { name: "Comentarios de la publicación", exact: true });
    await expect(list.getByRole("listitem")).toHaveCount(12);
    await textarea.fill("Borrador conservado al paginar");
    let readFailed = false;
    await page.route(`**/post/${postId}`, async (route) => {
      if (!readFailed && route.request().method() === "POST" && route.request().postData()?.startsWith(`["${postId}"`)) {
        readFailed = true;
        await route.abort("failed");
      } else await route.continue();
    });
    await page.getByRole("button", { name: "Ver comentarios anteriores", exact: true }).click();
    await expect(page.getByText("No pudimos cargar los comentarios. Vuelve a intentarlo.", { exact: true })).toBeVisible();
    await expect(textarea).toHaveValue("Borrador conservado al paginar");
    await expect(list.getByRole("listitem")).toHaveCount(12);
    await page.unroute(`**/post/${postId}`);
    await page.getByRole("button", { name: "Reintentar comentarios", exact: true }).click();
    await expect(list.getByRole("listitem")).toHaveCount(14);
    const ids = await list.getByRole("listitem").evaluateAll((items) => items.map((item) => item.id));
    expect(new Set(ids).size).toBe(14);
    for (const width of [360, 768, 1280]) {
      await page.setViewportSize({ width, height: 900 });
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
      await textarea.focus();
      await expect(textarea).toBeFocused();
    }
    await page.goto("/inicio");
    const card = page.locator("article").filter({ has: page.getByRole("heading", { name: `Comments ${suffix}`, exact: true }) });
    await expect(card.getByRole("link", { name: "14 comentarios", exact: true })).toBeVisible();
    await card.getByRole("link", { name: "14 comentarios", exact: true }).click();
    await expect(page).toHaveURL(new RegExp(`/post/${postId}#comentarios$`));
    const publicPage = await visitor.newPage();
    await publicPage.goto(detail);
    await expect(publicPage.getByRole("heading", { name: "Comentarios (14)", exact: true })).toBeVisible();
    await expect(publicPage.getByText(content, { exact: true })).toBeVisible();
    await expect(publicPage.getByRole("link", { name: "Inicia sesión para comentar", exact: true })).toBeVisible();
    await expect(publicPage.locator("#comentarios textarea")).toHaveCount(0);
    const markup = await publicPage.content();
    expect(markup).not.toContain(other.id);
    expect(markup).not.toContain("operation_id");

    const missingPage = await incomplete.newPage();
    await setupClerkTestingToken({ page: missingPage });
    await missingPage.goto("/");
    await missingPage.waitForFunction(() => Boolean(window.Clerk?.loaded));
    await clerk.signIn({ emailAddress: missing.email, page: missingPage });
    await missingPage.goto(detail);
    await missingPage.getByLabel("Escribe un comentario", { exact: true }).fill("Sin perfil");
    await missingPage.getByRole("button", { name: "Publicar comentario", exact: true }).click();
    await expect(missingPage.getByText("Completa tu perfil antes de comentar.", { exact: true })).toBeVisible();
    await expect(missingPage.getByRole("link", { name: "Completar mi perfil", exact: true })).toBeVisible();
    await expect(missingPage.getByLabel("Escribe un comentario", { exact: true })).toHaveValue("Sin perfil");
    const wait = expiration * 1000 + 6_000 - Date.now();
    if (wait > 75_000) throw new Error("Fixture token does not have the requested short lifetime");
    if (wait > 0) await new Promise((resolve) => setTimeout(resolve, wait));
    const expired = await expiring.rpc("create_post_comment", {
      p_post_id: postId, p_content: "Expired", p_operation_id: randomUUID(),
    });
    expect([401, 403]).toContain(expired.status);
    expect(expired.error).not.toBeNull();
    expect((await other.client.rpc("get_public_post_comments", { p_post_id: postId })).data.commentCount).toBe(14);
    expect((await owner.client.from("posts").delete().eq("id", postId).select("id")).data).toHaveLength(1);
    expect((await other.client.from("comments").select("id").eq("post_id", postId)).data).toEqual([]);
    expect((await other.client.rpc("get_public_post_comments", { p_post_id: postId })).data).toBeNull();
  } finally {
    await page.goto("about:blank");
    await visitor.close();
    await incomplete.close();
    const failures: Error[] = [];
    for (const fixture of fixtures) {
      try {
        if (fixture.client) {
          for (const upload of fixture.uploads) {
            if ((await fixture.client.rpc("abort_post_upload", {
              p_operation_id: upload.operation, p_lease_id: upload.lease,
            })).error) throw new Error("Could not abort comment fixture upload");
          }
          if ((await fixture.client.from("posts").delete().not("id", "is", null)).error) {
            throw new Error("Could not retire comment fixture posts");
          }
          const tasks = await fixture.client.from("post_uploads").select("operation_id,image_path").eq("owner_sub", fixture.id);
          if (tasks.error) throw new Error("Could not read comment fixture cleanup");
          for (const task of tasks.data ?? []) {
            if ((await fixture.client.storage.from("posts").remove([task.image_path])).error) {
              throw new Error("Could not remove comment fixture image");
            }
            if ((await fixture.client.rpc("finish_post_cleanup", { p_operation_id: task.operation_id })).error) {
              throw new Error("Could not finish comment fixture cleanup");
            }
          }
        }
        if (fixture.hasProfile) deleteProfile(fixture.id);
        await backend.users.deleteUser(fixture.id);
      } catch (error) {
        console.error("Comment fixture cleanup failed", { errorType: error instanceof Error ? error.name : "UnknownError" });
        failures.push(new Error(`Cleanup required for comment fixture ${fixture.id}`));
      }
    }
    if (failures.length) throw new AggregateError(failures, "Comment fixtures were not fully cleaned up");
  }
});
