import { createHash, randomBytes, randomUUID } from "node:crypto";
import { createClerkClient } from "@clerk/backend";
import { clerk, setupClerkTestingToken } from "@clerk/testing/playwright";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { expect, test } from "@playwright/test";
import sharp from "sharp";
import { deleteProfile, runProfileFixtureSql } from "./profile-fixture";

test("validates, publishes, replaces and retires avatars with real Storage ownership", async ({ page, browser }) => {
  test.setTimeout(240_000);
  const secretKey = process.env.CLERK_SECRET_KEY;
  const publishableKey = process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY;
  const origin = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const apiKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  if (!secretKey?.startsWith("sk_test_") || !publishableKey?.startsWith("pk_test_") || !origin || !apiKey) {
    throw new Error("Development Clerk and Supabase configuration is required");
  }
  const backend = createClerkClient({ secretKey, publishableKey });
  const fixtures: { id: string; client: SupabaseClient | null }[] = [];
  const suffix = Date.now().toString(36);
  const username = `via_e2e_avatar_${suffix}`;
  const email = `via.avatar.${suffix}+clerk_test@example.com`;
  const visitor = await browser.newContext();
  try {
    for (const address of [email, `via.other.${suffix}+clerk_test@example.com`]) {
      const user = await backend.users.createUser({ emailAddress: [address], skipPasswordRequirement: true });
      if (!/^user_[A-Za-z0-9]+$/.test(user.id)) throw new Error("Unexpected fixture identity");
      const fixture = { id: user.id, client: null as SupabaseClient | null };
      fixtures.push(fixture);
      const session = await backend.sessions.createSession({ userId: user.id });
      fixture.client = createClient(origin, apiKey, {
        accessToken: async () => (await backend.sessions.getToken(session.id, "supabase")).jwt,
      });
    }
    const owner = fixtures[0];
    const other = fixtures[1];
    if (!owner.client || !other.client) throw new Error("Fixture authentication failed");
    runProfileFixtureSql(`insert into public.profiles (clerk_user_id, username, display_name) values
      ('${owner.id}', '${username}', 'Avatar E2E'),
      ('${other.id}', 'via_e2e_other_${suffix}', 'Otro E2E');`);
    const anonymous = createClient(origin, apiKey, { auth: { persistSession: false } });
    const folder = createHash("sha256").update(owner.id).digest("hex");
    const png = await sharp(randomBytes(800 * 800 * 3), {
      raw: { width: 800, height: 800, channels: 3 },
    }).png({ compressionLevel: 0 }).toBuffer();
    expect(png.length).toBeGreaterThan(1024 * 1024);
    expect(png.length).toBeLessThanOrEqual(2 * 1024 * 1024);
    const webp = await sharp({ create: { width: 32, height: 32, channels: 3, background: "#00aa55" } })
      .webp().toBuffer();

    await setupClerkTestingToken({ page });
    await page.goto("/");
    await page.waitForFunction(() => Boolean(window.Clerk?.loaded));
    await clerk.signIn({ emailAddress: email, page });
    await page.goto("/perfil/editar");
    await expect(page.getByRole("heading", { name: "Avatar", exact: true })).toBeVisible();
    const input = page.getByLabel("Imagen de avatar");
    for (const invalid of [
      { name: "empty.png", mimeType: "image/png", buffer: Buffer.alloc(0), message: "Selecciona una imagen que no esté vacía." },
      { name: "broken.png", mimeType: "image/png", buffer: Buffer.from("not an image"), message: "No pudimos leer esa imagen. Selecciona un archivo válido." },
      { name: "false.png", mimeType: "image/png", buffer: webp, message: "El contenido de la imagen no coincide con su formato." },
      { name: "large.png", mimeType: "image/png", buffer: Buffer.alloc(2 * 1024 * 1024 + 1), message: "El avatar debe pesar como máximo 2 MiB." },
    ]) {
      await input.setInputFiles({ name: invalid.name, mimeType: invalid.mimeType, buffer: invalid.buffer });
      await page.getByRole("button", { name: "Subir avatar", exact: true }).click();
      await expect(page.getByText(invalid.message, { exact: true })).toBeVisible();
      await expect(page.getByText(invalid.message, { exact: true })).toBeFocused();
    }
    await input.setInputFiles({ name: "valid.png", mimeType: "image/png", buffer: png });
    await expect(page.getByAltText("Previsualización del nuevo avatar")).toBeVisible();
    let release: () => void = () => {};
    const gate = new Promise<void>((resolve) => { release = resolve; });
    await page.route("**/perfil/editar", async (route) => {
      if (route.request().method() === "POST") await gate;
      await route.continue();
    });
    const saved = page.waitForResponse((response) => response.request().method() === "POST"
      && Boolean(response.request().headers()["next-action"]), { timeout: 60_000 });
    try {
      await page.getByRole("button", { name: "Subir avatar", exact: true }).click();
      await expect(page.getByText("Procesando avatar...", { exact: true })).toBeVisible();
      await expect(input).toBeDisabled();
    } finally { release(); }
    expect((await saved).ok()).toBe(true);
    await expect(page.getByText("Avatar actualizado.", { exact: true })).toBeVisible();
    await page.unroute("**/perfil/editar");
    await page.reload();
    await expect(page.getByAltText("Tu avatar actual")).toBeVisible();

    const row = await owner.client.from("profiles").select("avatar_url").eq("clerk_user_id", owner.id).single();
    expect(row.error).toBeNull();
    const url: string = row.data?.avatar_url;
    expect(url).not.toContain(owner.id);
    const path = new URL(url).pathname.split("/storage/v1/object/public/avatars/")[1];
    expect(path).toMatch(/^[a-f0-9]{64}\/[a-f0-9-]{36}\.webp$/);
    const published = await fetch(url);
    expect(published.status).toBe(200);
    expect(published.headers.get("content-type")).toContain("image/webp");
    const metadata = await sharp(Buffer.from(await published.arrayBuffer())).metadata();
    expect(metadata.width).toBeLessThanOrEqual(512);
    expect(metadata.height).toBeLessThanOrEqual(512);
    expect(metadata.exif).toBeUndefined();
    const publicPage = await visitor.newPage();
    await publicPage.goto(`/usuario/${username}`);
    for (const width of [375, 768, 1280]) {
      await publicPage.setViewportSize({ width, height: 900 });
      const image = publicPage.getByRole("img", { name: "Avatar de Avatar E2E", exact: true });
      await expect(image).toBeVisible();
      await expect.poll(() => image.evaluate((element: HTMLImageElement) => element.naturalWidth), { timeout: 20_000 })
        .toBeGreaterThan(0);
      await expect(image).toHaveAttribute("src", /\/_next\/image\?/);
      expect(await publicPage.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
      expect(await publicPage.content()).not.toContain(owner.id);
    }
    await page.goto("/perfil");
    await expect(page.getByRole("img", { name: "Avatar de Avatar E2E", exact: true })).toBeVisible();
    await page.goto("/perfil/editar");

    const unauthorizedPath = `${folder}/${randomUUID()}.webp`;
    expect((await owner.client.storage.from("avatars").upload(unauthorizedPath, webp, { contentType: "image/webp" })).error)
      .not.toBeNull();
    for (const client of [other.client, anonymous]) {
      expect((await client.storage.from("avatars").upload(path, webp, { upsert: true, contentType: "image/webp" })).error)
        .not.toBeNull();
      await client.storage.from("avatars").remove([path]);
      expect((await fetch(url)).status).toBe(200);
      const listing = await client.storage.from("avatars").list(folder);
      expect(listing.error).toBeNull();
      expect(listing.data).toEqual([]);
    }
    const foreignTasks = await other.client.from("avatar_cleanup_tasks").select("object_path").eq("owner_sub", owner.id);
    expect(foreignTasks.error).toBeNull();
    expect(foreignTasks.data).toEqual([]);
    expect((await anonymous.from("avatar_cleanup_tasks").select("object_path")).error).not.toBeNull();
    expect((await owner.client.storage.from("avatars").upload(path, webp, { upsert: true, contentType: "image/webp" })).error)
      .not.toBeNull();
    await owner.client.storage.from("avatars").remove([path]);
    expect((await fetch(url)).status).toBe(200);
    const protectedObject = await owner.client.storage.from("avatars").list(folder);
    expect(protectedObject.error).toBeNull();
    expect(protectedObject.data?.some((object) => object.name === path.split("/")[1])).toBe(true);

    await input.setInputFiles({ name: "replacement.webp", mimeType: "image/webp", buffer: webp });
    await Promise.all([
      page.waitForResponse((response) => response.request().method() === "POST"
        && Boolean(response.request().headers()["next-action"]), { timeout: 60_000 }),
      page.getByRole("button", { name: "Reemplazar avatar", exact: true }).click(),
    ]);
    await expect(page.getByText("Avatar actualizado.", { exact: true })).toBeVisible();
    await expect.poll(async () => {
      const listing = await owner.client?.storage.from("avatars").list(folder);
      return listing?.data?.some((object) => object.name === path.split("/")[1]);
    }).toBe(false);
    await page.reload();
    const replacement = await owner.client.from("profiles").select("avatar_url").eq("clerk_user_id", owner.id).single();
    expect(replacement.error).toBeNull();
    expect(replacement.data?.avatar_url).not.toBe(url);
    await publicPage.reload();
    await expect(publicPage.getByRole("img", { name: "Avatar de Avatar E2E", exact: true })).toBeVisible();
    await Promise.all([
      page.waitForResponse((response) => response.request().method() === "POST"
        && Boolean(response.request().headers()["next-action"]), { timeout: 60_000 }),
      page.getByRole("button", { name: "Retirar avatar", exact: true }).click(),
    ]);
    await expect(page.getByText("Avatar retirado.", { exact: true })).toBeVisible();
    await page.reload();
    await expect(page.getByText("Sin avatar.", { exact: true })).toBeVisible();
    await publicPage.reload();
    await expect(publicPage.getByRole("img", { name: "Avatar de Avatar E2E", exact: true })).toHaveCount(0);
    const retired = await owner.client.from("profiles").select("avatar_url").eq("clerk_user_id", owner.id).single();
    expect(retired.error).toBeNull();
    expect(retired.data?.avatar_url).toBeNull();
    const empty = await owner.client.storage.from("avatars").list(folder);
    expect(empty.error).toBeNull();
    expect(empty.data).toEqual([]);
    const journal = await owner.client.from("avatar_cleanup_tasks").select("object_path");
    expect(journal.error).toBeNull();
    expect(journal.data).toEqual([]);
  } finally {
    await visitor.close();
    await Promise.all(fixtures.map(async ({ id, client }) => {
      deleteProfile(id);
      if (client) {
        const folder = createHash("sha256").update(id).digest("hex");
        const objects = await client.storage.from("avatars").list(folder, { limit: 1000 });
        if (objects.error) throw new Error("Could not enumerate avatar fixture objects");
        const paths = objects.data.map((object) => `${folder}/${object.name}`);
        if (paths.length) {
          const removed = await client.storage.from("avatars").remove(paths);
          if (removed.error) throw new Error("Could not clean avatar fixture objects");
        }
        const remaining = await client.storage.from("avatars").list(folder);
        if (remaining.error || remaining.data.length) throw new Error("Avatar fixture objects remain");
        const journal = await client.from("avatar_cleanup_tasks").delete().eq("owner_sub", id);
        if (journal.error) throw new Error("Could not clean avatar fixture journal");
      }
      await backend.users.deleteUser(id);
    }));
  }
});
