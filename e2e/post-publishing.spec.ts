import { createHash, randomUUID } from "node:crypto";
import { createClerkClient } from "@clerk/backend";
import { clerk, setupClerkTestingToken } from "@clerk/testing/playwright";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { expect, test } from "@playwright/test";
import sharp from "sharp";
import { deleteProfile, runProfileFixtureSql } from "./profile-fixture";

test("publishes a minimal post with a 5 MiB image and reads it anonymously", async ({ page, browser }) => {
  test.setTimeout(240_000);
  const secretKey = process.env.CLERK_SECRET_KEY;
  const publishableKey = process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY;
  const origin = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const apiKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  if (!secretKey?.startsWith("sk_test_") || !publishableKey?.startsWith("pk_test_") || !origin || !apiKey) {
    throw new Error("Development Clerk and Supabase configuration is required");
  }
  const backend = createClerkClient({ secretKey, publishableKey });
  const suffix = Date.now().toString(36);
  const email = `via.post.${suffix}+clerk_test@example.com`;
  const username = `via_e2e_post_${suffix}`;
  let userId: string | undefined;
  let client: SupabaseClient | undefined;
  const leases: { operation: string; lease: string }[] = [];
  const visitor = await browser.newContext();
  try {
    const user = await backend.users.createUser({ emailAddress: [email], skipPasswordRequirement: true });
    userId = user.id;
    if (!/^user_[A-Za-z0-9]+$/.test(userId)) throw new Error("Unexpected fixture identity");
    const session = await backend.sessions.createSession({ userId });
    client = createClient(origin, apiKey, {
      accessToken: async () => (await backend.sessions.getToken(session.id, "supabase")).jwt,
    });
    runProfileFixtureSql(`insert into public.profiles(clerk_user_id,username,display_name)
      values('${userId}','${username}','Publicación E2E');`);
    await setupClerkTestingToken({ page });
    await page.goto("/");
    await page.waitForFunction(() => Boolean(window.Clerk?.loaded));
    await clerk.signIn({ emailAddress: email, page });
    await page.goto("/perfil");
    await page.getByRole("link", { name: "Mi galería", exact: true }).click();
    await expect(page.getByText("Todavía no hay publicaciones.", { exact: true })).toBeVisible();
    await expect(page.getByText("Total: 0 publicaciones.", { exact: true })).toBeVisible();
    await page.goto("/perfil");
    await page.getByRole("link", { name: "Crear publicación", exact: true }).click();
    await expect(page.getByRole("heading", { name: "Crear publicación" })).toBeVisible();
    const operation = await page.locator('input[name="operationId"]').inputValue();
    const input = page.getByLabel("Imagen de la publicación");
    const png = await sharp({ create: { width: 32, height: 16, channels: 3, background: "#176b4d" } })
      .png().toBuffer();
    const bytes = Buffer.alloc(5 * 1024 * 1024);
    png.copy(bytes);
    await input.setInputFiles({ name: "boundary.png", mimeType: "image/png", buffer: bytes });
    await page.getByRole("button", { name: "Publicar", exact: true }).click();
    await expect(page.getByLabel("Título", { exact: true })).toBeFocused();
    await page.getByLabel("Título", { exact: true }).fill("Mi publicación mínima");
    await page.getByLabel("Categoría", { exact: true }).selectOption({ label: "Ciencia" });
    await page.getByLabel("Hashtags", { exact: true }).fill("#CIENCIA");
    await page.getByRole("button", { name: "Publicar", exact: true }).click();
    await expect(page).toHaveURL(/\/post\/[a-f0-9-]{36}$/, { timeout: 60_000 });
    const detailUrl = page.url();
    await expect(page.getByRole("heading", { name: "Mi publicación mínima" })).toBeVisible();
    await page.reload();
    await expect(page.getByText("#ciencia", { exact: true })).toBeVisible();
    const rows = await client.from("posts").select("id,image_path,description,category_id,hashtags")
      .eq("operation_id", operation);
    expect(rows.error).toBeNull();
    expect(rows.data).toHaveLength(1);
    const post = rows.data![0];
    expect(post.description).toBe("");
    expect(post.hashtags).toEqual(["ciencia"]);
    await page.getByRole("link", { name: "Mi galería", exact: true }).click();
    await expect(page.getByText("Total: 1 publicación.", { exact: true })).toBeVisible();
    await expect(page.getByRole("list", { name: "Publicaciones", exact: true }).getByRole("link")).toHaveCount(1);
    await expect(page.getByRole("list", { name: "Publicaciones", exact: true }).getByRole("heading")).toHaveCount(0);
    await page.getByRole("link", { name: "Ver publicación: Mi publicación mínima", exact: true }).click();
    await expect(page).toHaveURL(detailUrl);
    const repeated = await client.rpc("commit_post_upload", {
      p_operation_id: operation, p_lease_id: null,
    });
    expect(repeated.error).toBeNull();
    expect(repeated.data).toBe(post.id);
    const publicPage = await visitor.newPage();
    await publicPage.goto(detailUrl);
    const image = publicPage.getByRole("img", { name: "Mi publicación mínima", exact: true });
    await expect(image).toBeVisible();
    await expect.poll(() => image.evaluate((element: HTMLImageElement) => element.naturalWidth)).toBe(32);
    const src = await image.getAttribute("src");
    expect(src).toContain("/storage/v1/object/sign/posts/");
    expect(src).not.toContain("/_next/image");
    const response = await fetch(src!);
    expect(response.status).toBe(200);
    expect((await sharp(Buffer.from(await response.arrayBuffer())).metadata()).format).toBe("webp");
    for (const width of [375, 768, 1280]) {
      await publicPage.setViewportSize({ width, height: 900 });
      expect(await publicPage.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
    }
    expect(await publicPage.content()).not.toContain(userId);
    await publicPage.getByRole("link", { name: "Ver feed", exact: true }).click();
    await expect(publicPage.getByRole("heading", { name: "Publicaciones recientes" })).toBeVisible();
    await publicPage.getByRole("heading", { name: "Mi publicación mínima", exact: true }).getByRole("link").click();
    await expect(publicPage).toHaveURL(detailUrl);
    await publicPage.getByRole("link", { name: `Publicación E2E (@${username})`, exact: true }).click();
    await expect(publicPage.getByRole("list", { name: "Publicaciones", exact: true }).getByRole("link")).toHaveCount(1);
    const extraImage = await sharp(png).webp().toBuffer();
    for (let index = 0; index < 12; index++) {
      const operation = randomUUID();
      const lease = randomUUID();
      leases.push({ operation, lease });
      const ticket = await client.rpc("begin_post_upload", {
        p_operation_id: operation, p_lease_id: lease, p_title: `Galería ${index}`,
        p_description: "", p_category_id: post.category_id, p_hashtags: ["galeria"],
        p_image_digest: createHash("sha256").update(extraImage).digest("hex"),
      });
      expect(ticket.error).toBeNull();
      expect((await client.storage.from("posts").upload(ticket.data.image_path, extraImage, { contentType: "image/webp" })).error)
        .toBeNull();
      expect((await client.rpc("commit_post_upload", { p_operation_id: operation, p_lease_id: lease })).error).toBeNull();
    }
    await page.goto("/imagenes");
    await expect(page.getByText("Total: 13 publicaciones.", { exact: true })).toBeVisible();
    await expect(page.getByRole("list", { name: "Publicaciones", exact: true }).getByRole("link")).toHaveCount(12);
    await page.getByRole("link", { name: "Ver anteriores", exact: true }).click();
    await expect(page.getByRole("list", { name: "Publicaciones", exact: true }).getByRole("link")).toHaveCount(1);
    await expect(page.getByRole("link", { name: "Ver publicación: Mi publicación mínima", exact: true })).toBeVisible();
    await expect(page.getByRole("link", { name: "Ver anteriores", exact: true })).toHaveCount(0);
    await page.getByRole("link", { name: "Volver a las recientes", exact: true }).click();
    for (const width of [360, 768, 1280]) {
      await page.setViewportSize({ width, height: 900 });
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
    }
    await page.goto("/inicio");
    await expect(page.locator(".feed-card")).toHaveCount(12);
    const firstCards = await page.locator(".feed-card").evaluateAll((cards) => cards.slice(0, 2).map((card) => card.getBoundingClientRect().toJSON()));
    expect(firstCards[0].x).toBe(firstCards[1].x);
    expect(firstCards[1].top).toBeGreaterThan(firstCards[0].bottom);
    await page.locator(".feed-load-more").scrollIntoViewIfNeeded();
    await expect(page.locator(".feed-card").filter({ hasText: "Mi publicación mínima" })).toHaveCount(1, { timeout: 30_000 });
    await page.goto(detailUrl);
    await page.getByRole("link", { name: "Editar publicación", exact: true }).click();
    await page.getByLabel("Título", { exact: true }).fill("Publicación editada");
    await page.getByLabel("Descripción (opcional)", { exact: true }).fill("Una idea renovada");
    await page.getByLabel("Hashtags", { exact: true }).fill("#ARTE #niños");
    await page.getByRole("button", { name: "Guardar cambios", exact: true }).click();
    await expect(page).toHaveURL(detailUrl, { timeout: 30_000 });
    await expect(page.getByRole("heading", { name: "Publicación editada", exact: true })).toBeVisible();
    expect((await client.from("posts").select("image_path,version").eq("id", post.id).single()).data)
      .toMatchObject({ image_path: post.image_path, version: 2 });
    await page.getByRole("link", { name: "Editar publicación", exact: true }).click();
    const replacement = await sharp({ create: { width: 48, height: 24, channels: 3, background: "#aa7700" } }).png().toBuffer();
    await page.getByLabel("Reemplazar imagen (opcional)", { exact: true })
      .setInputFiles({ name: "replacement.png", mimeType: "image/png", buffer: replacement });
    await page.getByRole("button", { name: "Guardar cambios", exact: true }).click();
    await expect(page).toHaveURL(detailUrl, { timeout: 30_000 });
    await expect.poll(() => page.getByRole("img", { name: "Publicación editada", exact: true })
      .evaluate((element: HTMLImageElement) => element.naturalWidth)).toBe(48);
    const replaced = await client.from("posts").select("image_path,version").eq("id", post.id).single();
    expect(replaced.data?.image_path).not.toBe(post.image_path);
    expect(replaced.data?.version).toBe(3);
    expect((await client.from("post_uploads").select("operation_id").eq("image_path", post.image_path)).data).toEqual([]);
    await publicPage.goto(detailUrl);
    await expect(publicPage.getByRole("link", { name: "Editar publicación", exact: true })).toHaveCount(0);
    await publicPage.goto(`${detailUrl}/editar`);
    await expect(publicPage).toHaveURL(/\/sign-in/);
    await page.getByRole("button", { name: "Eliminar publicación", exact: true }).click();
    await expect(page.getByRole("dialog")).toBeVisible();
    await page.getByRole("button", { name: "Cancelar", exact: true }).click();
    await expect(page.getByRole("dialog")).not.toBeVisible();
    await expect(page.getByRole("button", { name: "Eliminar publicación", exact: true })).toBeFocused();
    await page.getByRole("button", { name: "Eliminar publicación", exact: true }).click();
    await page.getByRole("button", { name: "Confirmar eliminación", exact: true }).click();
    await expect(page).toHaveURL(/\/imagenes\?retirado=1/, { timeout: 30_000 });
    await expect(page.getByText("Total: 12 publicaciones.", { exact: true })).toBeVisible();
    expect((await client.from("posts").select("id").eq("id", post.id)).data).toEqual([]);
    expect((await client.from("post_uploads").select("operation_id").eq("image_path", replaced.data!.image_path)).data).toEqual([]);
    await publicPage.goto(detailUrl);
    await expect(publicPage.getByRole("heading", { name: "Publicación editada", exact: true })).toHaveCount(0);
    await publicPage.goto("/imagenes");
    await expect(publicPage).toHaveURL(/\/sign-in/);
    const anonymous = createClient(origin, apiKey, { auth: { persistSession: false } });
    expect((await anonymous.storage.from("posts").getPublicUrl(post.image_path)).data.publicUrl)
      .toContain("/object/public/posts/");
    expect((await fetch(`${origin}/storage/v1/object/public/posts/${post.image_path}`)).ok).toBe(false);
    const pendingOperation = randomUUID();
    const lease = randomUUID();
    leases.push({ operation: pendingOperation, lease });
    const pending = await client.rpc("begin_post_upload", {
      p_operation_id: pendingOperation, p_lease_id: lease, p_title: "Pending", p_description: "",
      p_category_id: post.category_id, p_hashtags: ["pending"],
      p_image_digest: createHash("sha256").update(png).digest("hex"),
    });
    expect(pending.error).toBeNull();
    expect(pending.data.status).toBe("ready");
    const webp = await sharp(png).webp().toBuffer();
    expect((await client.storage.from("posts").upload(pending.data.image_path, webp, { contentType: "image/webp" })).error)
      .toBeNull();
    expect((await anonymous.storage.from("posts").createSignedUrl(pending.data.image_path, 60)).error).not.toBeNull();
    expect((await client.rpc("abort_post_upload", { p_operation_id: pendingOperation, p_lease_id: lease })).error).toBeNull();
  } finally {
    await visitor.close();
    if (userId && client) {
      for (const lease of leases) {
        const aborted = await client.rpc("abort_post_upload", {
          p_operation_id: lease.operation, p_lease_id: lease.lease,
        });
        if (aborted.error) throw new Error("Could not abort E2E upload");
      }
      const deleted = await client.from("posts").delete().not("id", "is", null);
      if (deleted.error) throw new Error("Could not retire E2E posts");
      const tickets = await client.from("post_uploads").select("operation_id,image_path").eq("owner_sub", userId);
      if (tickets.error) throw new Error("Could not read E2E upload cleanup");
      for (const ticket of tickets.data ?? []) {
        const removed = await client.storage.from("posts").remove([ticket.image_path]);
        if (removed.error) throw new Error("Could not remove E2E image");
        const finished = await client.rpc("finish_post_cleanup", { p_operation_id: ticket.operation_id });
        if (finished.error) throw new Error("Could not finish E2E cleanup");
      }
      deleteProfile(userId);
    }
    if (userId) await backend.users.deleteUser(userId);
  }
});
