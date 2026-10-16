import { createHash, randomUUID } from "node:crypto";
import { createClerkClient } from "@clerk/backend";
import { clerk, setupClerkTestingToken } from "@clerk/testing/playwright";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { expect, test, type Page } from "@playwright/test";
import sharp from "sharp";
import { deleteProfile } from "./profile-fixture";

test("integrates social interactions, post isolation, keyboard layouts and retired image delivery", async ({ page, browser }) => {
  test.setTimeout(300_000);
  const hydrationErrors: string[] = [];
  function trackHydration(target: Page) {
    target.on("pageerror", (error) => {
      if (/hydration|hydrating|#418/i.test(error.message)) hydrationErrors.push(error.message);
    });
    target.on("console", (message) => {
      if (message.type() === "error" && /hydration|hydrating|#418/i.test(message.text())) {
        hydrationErrors.push(message.text());
      }
    });
  }
  trackHydration(page);
  const secretKey = process.env.CLERK_SECRET_KEY;
  const publishableKey = process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY;
  const origin = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const apiKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  if (!secretKey?.startsWith("sk_test_") || !publishableKey?.startsWith("pk_test_") || !origin || !apiKey) {
    throw new Error("Development Clerk and Supabase configuration is required");
  }
  const backend = createClerkClient({ secretKey, publishableKey });
  const fixtures: {
    id: string; email: string; client: SupabaseClient | null; profileId: string | null;
    uploads: { operation: string; lease: string }[];
  }[] = [];
  const otherContext = await browser.newContext();
  const publicContext = await browser.newContext();
  const suffix = Date.now().toString(36);
  try {
    for (const name of ["owner", "other"]) {
      const email = `via.close.${name}.${suffix}+clerk_test@example.com`;
      const user = await backend.users.createUser({ emailAddress: [email], skipPasswordRequirement: true });
      if (!/^user_[A-Za-z0-9]+$/.test(user.id)) throw new Error("Unexpected fixture identity");
      const fixture: (typeof fixtures)[number] = { id: user.id, email, client: null, profileId: null, uploads: [] };
      fixtures.push(fixture);
      const session = await backend.sessions.createSession({ userId: user.id });
      fixture.client = createClient(origin, apiKey, {
        accessToken: async () => (await backend.sessions.getToken(session.id, "supabase")).jwt,
      });
      const profile = await fixture.client.from("profiles").insert({
        clerk_user_id: user.id, username: `via_e2e_close_${name}_${suffix}`, display_name: `Cierre ${name}`,
      }).select("id").single();
      expect(profile.error).toBeNull();
      fixture.profileId = profile.data!.id;
    }
    const [owner, other] = fixtures;
    if (!owner.client || !other.client || !owner.profileId || !other.profileId) {
      throw new Error("Fixture authentication failed");
    }
    const anonymous = createClient(origin, apiKey, { auth: { persistSession: false } });
    const categories = await owner.client.from("categories").select("id").limit(1).single();
    expect(categories.error).toBeNull();
    const bytes = await sharp({ create: { width: 48, height: 24, channels: 3, background: "#176b4d" } })
      .webp().toBuffer();
    const operation = randomUUID();
    const lease = randomUUID();
    owner.uploads.push({ operation, lease });
    const ticket = await owner.client.rpc("begin_post_upload", {
      p_operation_id: operation, p_lease_id: lease, p_title: `Cierre ${suffix}`, p_description: "",
      p_category_id: categories.data!.id, p_hashtags: ["cierre"],
      p_image_digest: createHash("sha256").update(bytes).digest("hex"),
    });
    expect(ticket.error).toBeNull();
    const imagePath: string = ticket.data.image_path;
    expect((await owner.client.storage.from("posts").upload(imagePath, bytes, { contentType: "image/webp" })).error).toBeNull();
    expect((await other.client.storage.from("posts").createSignedUrl(imagePath, 60)).error).not.toBeNull();
    expect((await anonymous.storage.from("posts").createSignedUrl(imagePath, 60)).error).not.toBeNull();
    const committed = await owner.client.rpc("commit_post_upload", { p_operation_id: operation, p_lease_id: lease });
    expect(committed.error).toBeNull();
    const postId: string = committed.data;
    const detail = `/post/${postId}`;
    expect((await other.client.from("posts").select("id").eq("id", postId)).data).toEqual([]);
    expect((await other.client.from("posts").update({ title: "Foreign" }).eq("id", postId).select("id")).data).toEqual([]);
    expect((await other.client.from("posts").delete().eq("id", postId).select("id")).data).toEqual([]);
    expect((await other.client.storage.from("posts").upload(imagePath, bytes, { contentType: "image/webp", upsert: true })).error)
      .not.toBeNull();
    const foreignRemoval = await other.client.storage.from("posts").remove([imagePath]);
    expect(foreignRemoval.error).toBeNull();
    expect(foreignRemoval.data).toEqual([]);
    const signed = await anonymous.storage.from("posts").createSignedUrl(imagePath, 60);
    expect(signed.error).toBeNull();
    const signedUrl = signed.data!.signedUrl;
    const signedAt = Date.now();
    expect((await fetch(signedUrl)).ok).toBe(true);

    const otherPage = await otherContext.newPage();
    trackHydration(otherPage);
    await setupClerkTestingToken({ page: otherPage });
    await otherPage.goto("/");
    await otherPage.waitForFunction(() => Boolean(window.Clerk?.loaded));
    await clerk.signIn({ emailAddress: other.email, page: otherPage });
    await otherPage.goto(detail);
    await expect(otherPage.getByRole("heading", { name: `Cierre ${suffix}`, exact: true })).toBeVisible();
    await expect(otherPage.getByRole("link", { name: "Editar publicación", exact: true })).toHaveCount(0);
    await expect(otherPage.getByRole("button", { name: "Eliminar publicación", exact: true })).toHaveCount(0);
    expect(await otherPage.content()).not.toContain(owner.id);
    const initialComment = `Interacción integrada ${suffix}`;
    const retainedComment = `Comentario para retirada ${suffix}`;
    const authorPath = `/usuario/via_e2e_close_owner_${suffix}`;
    const followSection = otherPage.getByRole("region", { name: "Seguimiento del perfil", exact: true });
    const followerCount = followSection.getByText("Seguidores", { exact: true }).locator("..").locator("dd");
    await otherPage.getByRole("button", { name: "Dar me gusta", exact: true }).click();
    await expect(otherPage.getByRole("button", { name: "Quitar me gusta", exact: true }))
      .toHaveAttribute("aria-pressed", "true");
    await otherPage.getByLabel("Escribe un comentario", { exact: true }).fill(initialComment);
    await otherPage.getByRole("button", { name: "Publicar comentario", exact: true }).click();
    await expect(otherPage.getByRole("heading", { name: "Comentarios (1)", exact: true })).toBeVisible();
    await otherPage.reload();
    await expect(otherPage.getByText(initialComment, { exact: true })).toBeVisible();
    await expect(otherPage.getByRole("button", { name: "Quitar me gusta", exact: true }))
      .toHaveAttribute("aria-pressed", "true");
    await otherContext.grantPermissions(["clipboard-read", "clipboard-write"], { origin: "http://localhost:3000" });
    await otherPage.getByRole("button", { name: "Compartir", exact: true }).click();
    const shareDialog = otherPage.getByRole("dialog");
    await shareDialog.getByRole("button", { name: "Copiar enlace", exact: true }).click();
    const sharedUrl = await otherPage.evaluate(() => navigator.clipboard.readText());
    expect(sharedUrl).toBe(`http://localhost:3000${detail}`);
    await otherPage.keyboard.press("Escape");
    const publicPage = await publicContext.newPage();
    trackHydration(publicPage);
    await publicPage.goto(sharedUrl);
    await expect(publicPage.getByText(initialComment, { exact: true })).toBeVisible();
    await expect(publicPage.getByText("1 me gusta", { exact: true })).toBeVisible();
    await expect(publicPage.getByRole("button", { name: "Eliminar comentario", exact: true })).toHaveCount(0);
    await otherPage.goto(authorPath);
    await followSection.getByRole("button", { name: "Seguir", exact: true }).click();
    await expect(followSection.getByRole("button", { name: "Dejar de seguir", exact: true }))
      .toHaveAttribute("aria-pressed", "true");
    await expect(followerCount).toHaveText("1");
    await otherPage.reload();
    await expect(followSection.getByRole("button", { name: "Dejar de seguir", exact: true }))
      .toHaveAttribute("aria-pressed", "true");
    await publicPage.goto(authorPath);
    await expect(publicPage.getByText("Seguidores", { exact: true }).locator("..").locator("dd")).toHaveText("1");
    await expect(publicPage.getByRole("button", { name: "Seguir", exact: true })).toHaveCount(0);
    expect(await publicPage.content()).not.toContain(other.id);
    await otherPage.goto(`${detail}/editar`);
    await expect(otherPage.getByRole("heading", { name: "Editar publicación", exact: true })).toHaveCount(0);
    await otherPage.goto("/imagenes");
    await expect(otherPage.getByText("Total: 0 publicaciones.", { exact: true })).toBeVisible();
    await otherPage.goto("/perfil");
    await expect(otherPage.locator('[data-clerk-component="UserButton"]')).toBeVisible();
    await otherPage.getByRole("button", { name: "Cerrar sesión", exact: true }).click();
    await expect(otherPage).toHaveURL("http://localhost:3000/");
    await otherPage.goto("/crear");
    await expect(otherPage).toHaveURL(/\/sign-in/);

    await setupClerkTestingToken({ page });
    await page.goto("/");
    await page.waitForFunction(() => Boolean(window.Clerk?.loaded));
    await clerk.signIn({ emailAddress: owner.email, page });
    await page.goto("/perfil");
    await expect(page.locator('[data-clerk-component="UserButton"]')).toBeVisible();
    await page.reload();
    await expect(page.locator('[data-clerk-component="UserButton"]')).toBeVisible();
    await expect(page.getByText("Seguidores", { exact: true }).locator("..").locator("dd")).toHaveText("1");
    await page.goto(detail);
    await expect(page.getByRole("button", { name: "Eliminar comentario", exact: true })).toHaveCount(0);
    await expect(page.getByRole("button", { name: "Dar me gusta", exact: true })).toHaveAttribute("aria-pressed", "false");
    for (const width of [360, 768, 1280]) {
      await page.setViewportSize({ width, height: 900 });
      for (const route of ["/crear", `${detail}/editar`, detail, "/imagenes", "/inicio"]) {
        await page.goto(route);
        await expect(page.locator("h1")).toHaveCount(1);
        expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
      }
      await page.goto(detail);
      const commentSubmit = page.getByRole("button", { name: "Publicar comentario", exact: true });
      await expect(commentSubmit).toBeEnabled();
      const textContrast = await commentSubmit.evaluate((element) => {
        const style = getComputedStyle(element);
        function luminance(color: string) {
          const channels = color.match(/\d+(?:\.\d+)?/g)?.map(Number);
          if (!channels || channels.length !== 3) throw new Error("Expected an opaque RGB control color");
          const [red, green, blue] = channels.map((value) => {
            const srgb = value / 255;
            return srgb <= 0.04045 ? srgb / 12.92 : ((srgb + 0.055) / 1.055) ** 2.4;
          });
          return red * 0.2126 + green * 0.7152 + blue * 0.0722;
        }
        const foreground = luminance(style.color);
        const background = luminance(style.backgroundColor);
        return (Math.max(foreground, background) + 0.05) / (Math.min(foreground, background) + 0.05);
      });
      expect(textContrast).toBeGreaterThanOrEqual(4.5);
      const trigger = page.getByRole("button", { name: "Eliminar publicación", exact: true });
      await trigger.focus();
      await page.keyboard.press("Enter");
      await expect(page.getByRole("dialog")).toBeVisible();
      await expect(page.getByRole("button", { name: "Cancelar", exact: true })).toBeFocused();
      expect(await page.getByRole("dialog").evaluate((element) => element.scrollWidth <= element.clientWidth)).toBe(true);
      await page.keyboard.press("Tab");
      await expect(page.getByRole("button", { name: "Confirmar eliminación", exact: true })).toBeFocused();
      await page.keyboard.press("Shift+Tab");
      await page.keyboard.press("Enter");
      await expect(trigger).toBeFocused();
    }
    await page.goto(`${detail}/editar`);
    const updatedTitle = `Cierre actualizado ${suffix}`;
    await page.getByLabel("Título", { exact: true }).fill(updatedTitle);
    await page.getByLabel("Hashtags", { exact: true }).fill("#ARTE #niños");
    await page.getByRole("button", { name: "Guardar cambios", exact: true }).click();
    await expect(page).toHaveURL(new RegExp(`${detail}$`), { timeout: 30_000 });
    await page.reload();
    await expect(page.getByRole("heading", { name: updatedTitle, exact: true })).toBeVisible();
    await expect(page.getByText("#niños", { exact: true })).toBeVisible();
    for (const route of ["/inicio", "/imagenes", `/usuario/via_e2e_close_owner_${suffix}`]) {
      await page.goto(route);
      await page.reload();
      if (route === "/inicio") {
        const card = page.locator(".feed-card").filter({ has: page.getByRole("heading", { name: updatedTitle, exact: true }) });
        await expect(card).toHaveCount(1);
        await expect(card.getByText("#niños", { exact: true })).toBeVisible();
        await expect(card.getByLabel("1 me gusta", { exact: true })).toBeVisible();
        await expect(card.getByRole("link", { name: "1 comentario", exact: true })).toBeVisible();
      } else {
        await expect(page.getByRole("link", { name: `Ver publicación: ${updatedTitle}`, exact: true })).toBeVisible();
        await expect(page.getByRole("list", { name: "Publicaciones", exact: true }).getByRole("heading")).toHaveCount(0);
      }
    }
    expect((await owner.client.from("posts").select("image_path,hashtags").eq("id", postId).single()).data)
      .toEqual({ image_path: imagePath, hashtags: ["arte", "niños"] });
    await otherPage.goto("/");
    await otherPage.waitForFunction(() => Boolean(window.Clerk?.loaded));
    await clerk.signIn({ emailAddress: other.email, page: otherPage });
    await otherPage.goto(detail);
    await expect(otherPage.getByRole("heading", { name: updatedTitle, exact: true })).toBeVisible();
    await otherPage.getByRole("button", { name: "Eliminar comentario", exact: true }).click();
    await otherPage.getByRole("dialog").getByRole("button", { name: "Confirmar eliminación", exact: true }).click();
    await expect(otherPage.getByRole("heading", { name: "Comentarios (0)", exact: true })).toBeVisible();
    await expect(otherPage.getByText(initialComment, { exact: true })).toHaveCount(0);
    await otherPage.getByLabel("Escribe un comentario", { exact: true }).fill(retainedComment);
    await otherPage.getByRole("button", { name: "Publicar comentario", exact: true }).click();
    await expect(otherPage.getByRole("heading", { name: "Comentarios (1)", exact: true })).toBeVisible();
    await otherPage.getByRole("button", { name: "Quitar me gusta", exact: true }).click();
    await expect(otherPage.getByRole("button", { name: "Dar me gusta", exact: true }))
      .toHaveAttribute("aria-pressed", "false");
    await otherPage.reload();
    await expect(otherPage.getByLabel("0 me gusta", { exact: true })).toBeVisible();
    await otherPage.getByRole("button", { name: "Dar me gusta", exact: true }).click();
    await expect(otherPage.getByRole("button", { name: "Quitar me gusta", exact: true }))
      .toHaveAttribute("aria-pressed", "true");
    const activeChildren = await Promise.all([
      other.client.from("likes").select("id").eq("post_id", postId),
      other.client.from("comments").select("id").eq("post_id", postId),
    ]);
    for (const children of activeChildren) {
      expect(children.error).toBeNull();
      expect(children.data).toHaveLength(1);
    }
    await page.goto("/crear");
    const input = page.getByLabel("Imagen de la publicación", { exact: true });
    await input.focus();
    await expect(input).toBeFocused();
    await input.setInputFiles({ name: "valid.webp", mimeType: "image/webp", buffer: bytes });
    await expect(page.getByAltText("Previsualización de la publicación")).toBeVisible();
    await page.getByRole("button", { name: "Quitar imagen seleccionada", exact: true }).focus();
    await page.keyboard.press("Enter");
    await expect(input).toBeFocused();
    await expect(page.getByAltText("Previsualización de la publicación")).toHaveCount(0);
    await input.setInputFiles({ name: "broken.png", mimeType: "image/png", buffer: Buffer.from("not an image") });
    await page.getByLabel("Título", { exact: true }).fill("Borrador conservado");
    await page.getByLabel("Categoría", { exact: true }).selectOption(categories.data!.id);
    await page.getByLabel("Hashtags", { exact: true }).fill("#cierre");
    await page.getByRole("button", { name: "Publicar", exact: true }).click();
    await expect(input).toHaveAttribute("aria-invalid", "true");
    await expect(input).toBeFocused();
    await input.setInputFiles({ name: "valid.webp", mimeType: "image/webp", buffer: bytes });
    await page.route("**/crear", async (route) => {
      if (route.request().method() === "POST") await route.abort("failed");
      else await route.continue();
    });
    await page.getByRole("button", { name: "Publicar", exact: true }).click();
    await expect(page.getByRole("status")).toContainText("No pudimos enviar la publicación");
    await expect(page.getByLabel("Título", { exact: true })).toHaveValue("Borrador conservado");
    await page.unroute("**/crear");
    expect((await owner.client.from("posts").select("id")).data).toEqual([{ id: postId }]);

    expect((await owner.client.from("posts").delete().eq("id", postId)).error).toBeNull();
    for (const table of ["likes", "comments"]) {
      const children = await other.client.from(table).select("id").eq("post_id", postId);
      expect(children.error).toBeNull();
      expect(children.data).toEqual([]);
    }
    const retiredShared = await publicPage.goto(sharedUrl);
    expect(retiredShared?.status()).toBe(404);
    await expect(publicPage.getByRole("heading", { name: updatedTitle, exact: true })).toHaveCount(0);
    await expect(publicPage.getByText(retainedComment, { exact: true })).toHaveCount(0);
    await otherPage.goto(authorPath);
    await expect(followerCount).toHaveText("1");
    await followSection.getByRole("button", { name: "Dejar de seguir", exact: true }).click();
    await expect(followSection.getByRole("button", { name: "Seguir", exact: true })).toHaveAttribute("aria-pressed", "false");
    await expect(followerCount).toHaveText("0");
    await otherPage.goto("/perfil");
    await otherPage.reload();
    await expect(otherPage.getByText("Seguidos", { exact: true }).locator("..").locator("dd")).toHaveText("0");
    expect((await anonymous.storage.from("posts").createSignedUrl(imagePath, 60)).error).not.toBeNull();
    await page.goto(detail);
    await expect(page.getByRole("heading", { name: updatedTitle, exact: true })).toHaveCount(0);
    await page.goto("/imagenes");
    await expect(page.getByText("Total: 0 publicaciones.", { exact: true })).toBeVisible();
    await new Promise((resolve) => setTimeout(resolve, Math.max(0, signedAt + 67_000 - Date.now())));
    const expired = await fetch(signedUrl, { headers: { "Cache-Control": "no-cache" } });
    expect(expired.ok).toBe(false);
    await page.getByRole("button", { name: "Limpiar imágenes pendientes", exact: true }).click();
    await expect(page.locator(".post-cleanup").getByRole("status")).toContainText("Limpieza completada");
    expect((await owner.client.from("post_uploads").select("operation_id")).data).toEqual([]);
    expect((await owner.client.storage.from("posts").list(imagePath.split("/")[0])).data).toEqual([]);
    expect(hydrationErrors).toEqual([]);
  } finally {
    const contexts = await Promise.allSettled([
      page.goto("about:blank"), otherContext.close(), publicContext.close(),
    ]);
    const relations = await Promise.allSettled(fixtures.map(async ({ client, profileId }) => {
      if (client && profileId) {
        const removed = await client.from("follows").delete().eq("follower_id", profileId);
        if (removed.error) throw new Error("Could not remove closure fixture follows");
      }
    }));
    const cleanup = await Promise.allSettled(fixtures.map(async ({ id, client, uploads }) => {
      try {
        if (client) {
          for (const upload of uploads) {
            const aborted = await client.rpc("abort_post_upload", {
              p_operation_id: upload.operation, p_lease_id: upload.lease,
            });
            if (aborted.error) throw new Error("Could not abort closure fixture upload");
          }
          const retired = await client.from("posts").delete().not("id", "is", null);
          if (retired.error) throw new Error("Could not retire closure fixture posts");
          const tickets = await client.from("post_uploads").select("operation_id,image_path").eq("owner_sub", id);
          if (tickets.error) throw new Error("Could not read closure fixture cleanup");
          for (const ticket of tickets.data ?? []) {
            const removed = await client.storage.from("posts").remove([ticket.image_path]);
            if (removed.error) throw new Error("Could not remove closure fixture image");
            const finished = await client.rpc("finish_post_cleanup", { p_operation_id: ticket.operation_id });
            if (finished.error) throw new Error("Could not finish closure fixture cleanup");
          }
        }
        deleteProfile(id);
      } finally {
        await backend.users.deleteUser(id);
      }
    }));
    const failures = [...contexts, ...relations, ...cleanup].filter((result) => result.status === "rejected");
    if (failures.length) throw new AggregateError(failures.map((result) => result.reason), "Closure fixture cleanup failed");
  }
});
