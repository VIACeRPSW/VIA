import { createHash, randomUUID } from "node:crypto";
import { createClerkClient } from "@clerk/backend";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { expect, test } from "@playwright/test";
import sharp from "sharp";
import { deleteProfile } from "./profile-fixture";

declare global {
  interface Window {
    viaSharePayload?: ShareData;
    viaShareMode?: "success" | "cancel" | "error";
  }
}

test("shares canonical public links with real Clipboard and explicitly simulated API failures/native sharing", async ({ page, browser }) => {
  test.setTimeout(180_000);
  const secretKey = process.env.CLERK_SECRET_KEY;
  const publishableKey = process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY;
  const origin = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const apiKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  if (!secretKey?.startsWith("sk_test_") || !publishableKey?.startsWith("pk_test_") || !origin || !apiKey) {
    throw new Error("Development Clerk and Supabase configuration is required");
  }
  const backend = createClerkClient({ secretKey, publishableKey });
  const suffix = Date.now().toString(36);
  const title = `Share fixture ${suffix}`;
  const operation = randomUUID();
  const lease = randomUUID();
  let userId: string | null = null;
  let client: SupabaseClient | null = null;
  let profileCreated = false;
  let postId: string | null = null;
  let uploadStarted = false;
  const anonymous = await browser.newContext();
  try {
    const user = await backend.users.createUser({
      emailAddress: [`via.share.${suffix}+clerk_test@example.com`], skipPasswordRequirement: true,
    });
    userId = user.id;
    const session = await backend.sessions.createSession({ userId });
    client = createClient(origin, apiKey, {
      accessToken: async () => (await backend.sessions.getToken(session.id, "supabase")).jwt,
      auth: { persistSession: false },
    });
    expect((await client.from("profiles").insert({
      clerk_user_id: userId, username: `share_${suffix}`, display_name: "Share fixture",
    })).error).toBeNull();
    profileCreated = true;
    const category = await client.from("categories").select("id").limit(1).single();
    expect(category.error).toBeNull();
    const image = await sharp({ create: { width: 48, height: 24, channels: 3, background: "#176b4d" } }).webp().toBuffer();
    const ticket = await client.rpc("begin_post_upload", {
      p_operation_id: operation, p_lease_id: lease, p_title: title, p_description: "",
      p_category_id: category.data!.id, p_hashtags: ["share"],
      p_image_digest: createHash("sha256").update(image).digest("hex"),
    });
    expect(ticket.error).toBeNull();
    uploadStarted = true;
    expect((await client.storage.from("posts").upload(ticket.data.image_path, image, { contentType: "image/webp" })).error).toBeNull();
    const committed = await client.rpc("commit_post_upload", { p_operation_id: operation, p_lease_id: lease });
    expect(committed.error).toBeNull();
    if (typeof committed.data !== "string") throw new Error("Fixture post ID missing");
    postId = committed.data;
    const expectedUrl = `http://localhost:3000/post/${postId}`;
    await page.context().grantPermissions(["clipboard-read", "clipboard-write"], { origin: "http://localhost:3000" });
    await page.goto("/inicio");
    const card = page.locator("article").filter({ has: page.getByRole("heading", { name: title, exact: true }) });
    const trigger = card.getByRole("button", { name: "Compartir", exact: true });
    const dialog = page.getByRole("dialog", { name: "Compartir publicación", exact: true });
    for (const width of [360, 768, 1280]) {
      await page.setViewportSize({ width, height: 900 });
      await trigger.focus();
      await page.keyboard.press("Enter");
      await expect(dialog).toBeVisible();
      await expect(dialog.getByLabel("Enlace público", { exact: true })).toHaveValue(expectedUrl);
      await expect(dialog.getByRole("button", { name: "Copiar enlace", exact: true })).toBeFocused();
      expect(await dialog.evaluate((element) => {
        const box = element.getBoundingClientRect();
        return box.left >= 0 && box.right <= window.innerWidth && document.documentElement.scrollWidth <= window.innerWidth;
      })).toBe(true);
      await page.keyboard.press("Escape");
      await expect(dialog).not.toBeVisible();
      await expect(trigger).toBeFocused();
    }
    await test.step("Real Chromium Clipboard write/read with browser permissions", async () => {
      await trigger.click();
      await page.keyboard.press("Enter");
      await expect(dialog.getByText("Enlace copiado.", { exact: true })).toBeVisible();
      expect(await page.evaluate(() => navigator.clipboard.readText())).toBe(expectedUrl);
      await dialog.getByRole("button", { name: "Cerrar", exact: true }).click();
      await expect(trigger).toBeFocused();
    });
    const visitor = await anonymous.newPage();
    const response = await visitor.goto(expectedUrl);
    expect(response?.status()).toBe(200);
    await expect(visitor.getByRole("heading", { name: title, exact: true })).toBeVisible();
    await expect(visitor.getByRole("button", { name: "Compartir", exact: true })).toBeEnabled();
    const visitorDialog = visitor.getByRole("dialog", { name: "Compartir publicación", exact: true });
    const visitorTrigger = visitor.getByRole("button", { name: "Compartir", exact: true });
    await test.step("Simulated missing Clipboard and native APIs offer manual copy", async () => {
      await visitor.evaluate(() => {
        Object.defineProperty(navigator, "clipboard", { configurable: true, value: undefined });
        Object.defineProperty(navigator, "share", { configurable: true, value: undefined });
      });
      await visitorTrigger.click();
      await expect(visitorDialog.getByRole("button", { name: "Compartir con otra aplicación", exact: true })).toHaveCount(0);
      await visitorDialog.getByRole("button", { name: "Copiar enlace", exact: true }).click();
      await expect(visitorDialog.getByText(
        "Este navegador no permite copiar automáticamente. Selecciona el enlace y cópialo manualmente.", { exact: true },
      )).toBeVisible();
      await expect(visitorDialog.getByLabel("Enlace público", { exact: true })).toBeFocused();
      await expect(visitorDialog.getByText("Enlace copiado.", { exact: true })).toHaveCount(0);
      await visitorDialog.getByRole("button", { name: "Cerrar", exact: true }).click();
    });
    await test.step("Simulated Clipboard permission denial is not copy success", async () => {
      await visitor.evaluate(() => {
        Object.defineProperty(navigator, "clipboard", { configurable: true, value: {
          writeText: async () => { throw new DOMException("Simulated denial", "NotAllowedError"); },
        } });
      });
      await visitorTrigger.click();
      await visitorDialog.getByRole("button", { name: "Copiar enlace", exact: true }).click();
      await expect(visitorDialog.getByText("No pudimos copiar el enlace. Selecciónalo y cópialo manualmente.", { exact: true })).toBeVisible();
      await expect(visitorDialog.getByLabel("Enlace público", { exact: true })).toBeFocused();
      await expect(visitorDialog.getByText("Enlace copiado.", { exact: true })).toHaveCount(0);
      await visitorDialog.getByRole("button", { name: "Cerrar", exact: true }).click();
    });
    await test.step("Simulated Web Share success, user cancellation and service rejection", async () => {
      await visitor.evaluate(() => {
        window.viaShareMode = "success";
        Object.defineProperty(navigator, "share", { configurable: true, value: async (data: ShareData) => {
          window.viaSharePayload = data;
          if (window.viaShareMode === "cancel") throw new DOMException("Simulated cancellation", "AbortError");
          if (window.viaShareMode === "error") throw new DOMException("Simulated failure", "NotAllowedError");
        } });
      });
      await visitorTrigger.click();
      const native = visitorDialog.getByRole("button", { name: "Compartir con otra aplicación", exact: true });
      await native.click();
      await expect(visitorDialog.getByText("Acción de compartir completada.", { exact: true })).toBeVisible();
      expect(await visitor.evaluate(() => window.viaSharePayload)).toEqual({ url: expectedUrl });
      await visitor.evaluate(() => { window.viaShareMode = "cancel"; });
      await native.click();
      await expect(visitorDialog.getByText("Compartir cancelado. Puedes copiar el enlace si lo prefieres.", { exact: true })).toBeVisible();
      await expect(visitorDialog.getByText("Acción de compartir completada.", { exact: true })).toHaveCount(0);
      await visitor.evaluate(() => { window.viaShareMode = "error"; });
      await native.click();
      await expect(visitorDialog.getByText("No pudimos compartir el enlace. Puedes copiarlo o intentarlo de nuevo.", { exact: true })).toBeVisible();
      await expect(visitorDialog.getByText("Enlace copiado.", { exact: true })).toHaveCount(0);
      await visitorDialog.getByRole("button", { name: "Cerrar", exact: true }).click();
      await expect(visitorTrigger).toBeFocused();
    });
    expect((await client.from("posts").delete().eq("id", postId).select("id")).data).toHaveLength(1);
    const retired = await visitor.reload();
    expect(retired?.status()).toBe(404);
    await expect(visitor.getByRole("heading", { name: title, exact: true })).toHaveCount(0);
    await expect(visitor.getByRole("button", { name: "Compartir", exact: true })).toHaveCount(0);
  } finally {
    await page.goto("about:blank");
    await anonymous.close();
    if (client && userId) {
      if (uploadStarted && (await client.rpc("abort_post_upload", { p_operation_id: operation, p_lease_id: lease })).error) {
        throw new Error("Could not abort share fixture upload");
      }
      if (postId && (await client.from("posts").delete().eq("id", postId)).error) {
        throw new Error("Could not retire share fixture post");
      }
      const tasks = await client.from("post_uploads").select("operation_id,image_path").eq("owner_sub", userId);
      if (tasks.error) throw new Error("Could not read share fixture cleanup");
      for (const task of tasks.data ?? []) {
        if ((await client.storage.from("posts").remove([task.image_path])).error) throw new Error("Could not remove share fixture image");
        if ((await client.rpc("finish_post_cleanup", { p_operation_id: task.operation_id })).error) {
          throw new Error("Could not finish share fixture cleanup");
        }
      }
    }
    if (userId) {
      if (profileCreated) deleteProfile(userId);
      await backend.users.deleteUser(userId);
    }
  }
});
