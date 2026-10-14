import { createClerkClient } from "@clerk/backend";
import { clerk, setupClerkTestingToken } from "@clerk/testing/playwright";
import { expect, test } from "@playwright/test";

import { deleteProfile, runProfileFixtureSql } from "./profile-fixture";

test("creates, edits and exposes only the public profile projection", async ({ page, browser }) => {
  test.setTimeout(180_000);

  const secretKey = process.env.CLERK_SECRET_KEY;
  const publishableKey = process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY;

  if (!secretKey?.startsWith("sk_test_") || !publishableKey?.startsWith("pk_test_")) {
    throw new Error("Clerk development keys are required for E2E tests");
  }

  const clerkClient = createClerkClient({ secretKey, publishableKey });
  const uniqueSuffix = Date.now().toString(36);
  const emailAddress = `via.e2e.${uniqueSuffix}+clerk_test@example.com`;
  const username = `via_e2e_${uniqueSuffix}`;
  const occupiedUsername = `via_e2e_taken_${uniqueSuffix}`;
  const occupiedIdentity = `user_viae2e${uniqueSuffix}`;
  const updatedUsername = `${username}_new`;
  const updatedBio = "Biografía actualizada de prueba.";
  const user = await clerkClient.users.createUser({
    emailAddress: [emailAddress],
    firstName: "VIA E2E",
    skipPasswordRequirement: true,
  });

  try {
    if (!/^user_[A-Za-z0-9]+$/.test(occupiedIdentity)
      || !/^[a-z0-9_]{3,30}$/.test(occupiedUsername)) {
      throw new Error("Unexpected conflict fixture identifiers");
    }
    runProfileFixtureSql(
      `insert into public.profiles (clerk_user_id, username, display_name)
       values ('${occupiedIdentity}', '${occupiedUsername}', 'Conflicto E2E');`,
    );
    await setupClerkTestingToken({ page });
    await page.goto("/");
    await page.waitForFunction(() => Boolean(window.Clerk?.loaded));
    await clerk.signIn({ emailAddress, page });
    await page.goto("/perfil/editar");

    await expect(page).toHaveURL(/\/perfil\/completar$/);
    await expect(
      page.getByRole("heading", { name: "Completa tu perfil" }),
    ).toBeVisible();

    await page.getByLabel("Nombre de usuario").fill("nombre inválido");
    await page.getByLabel("Nombre visible").fill("Perfil E2E");
    await page.getByLabel("Biografía").fill("Perfil temporal de prueba.");
    await page.getByRole("button", { name: "Crear perfil" }).click();

    await expect(page.getByLabel("Nombre de usuario")).toHaveAttribute(
      "aria-invalid",
      "true",
    );
    await expect(
      page.getByText("Usa solo letras minúsculas, números y guion bajo."),
    ).toBeVisible();

    await page.getByLabel("Nombre de usuario").fill(username);
    await page.getByRole("button", { name: "Crear perfil" }).click();

    await expect(page).toHaveURL(/\/perfil$/);
    await expect(page.getByText("user", { exact: true })).toBeVisible();
    await expect(page.getByRole("heading", { name: "Perfil E2E", exact: true })).toBeVisible();
    await expect(page.getByText(`@${username}`, { exact: true })).toBeVisible();
    await expect(page.getByText("Perfil temporal de prueba.", { exact: true })).toBeVisible();
    await page.reload();
    await expect(page.getByRole("heading", { name: "Perfil E2E", exact: true })).toBeVisible();
    for (const width of [375, 768, 1280]) {
      await page.setViewportSize({ width, height: 900 });
      expect(await page.evaluate(() =>
        document.documentElement.scrollWidth <= window.innerWidth,
      )).toBe(true);
    }
    await page.getByRole("link", { name: "Ver perfil público" }).focus();
    await expect(page.getByRole("link", { name: "Ver perfil público" })).toBeFocused();
    await page.keyboard.press("Enter");
    await expect(page).toHaveURL(new RegExp(`/usuario/${username}$`));
    await expect(page.getByRole("heading", { name: "Perfil E2E", exact: true })).toBeVisible();

    const visitor = await browser.newContext();
    try {
      const publicPage = await visitor.newPage();
      await setupClerkTestingToken({ page: publicPage });
      for (const width of [375, 768, 1280]) {
        await publicPage.setViewportSize({ width, height: 900 });
        await publicPage.goto(`/usuario/${username}`);
        await expect(publicPage.getByRole("heading", { name: "Perfil E2E", exact: true })).toBeVisible();
        await expect(publicPage.getByText("Perfil temporal de prueba.", { exact: true })).toBeVisible();
        await expect(publicPage.getByRole("img", { name: "Sin avatar" })).toBeVisible();
        await expect(publicPage.getByRole("link", { name: "Mi perfil" })).toBeVisible();
        expect(await publicPage.locator("main").ariaSnapshot()).toContain(
          'heading "Perfil E2E" [level=1]',
        );
        const contrast = await publicPage.locator(".profile-details .eyebrow").evaluate((element) => {
          function luminance(color: string) {
            const channels = color.match(/\d+/g);
            if (!channels || channels.length < 3) throw new Error("Unexpected computed color");
            const linear = channels.slice(0, 3).map((channel) => {
              const value = Number(channel) / 255;
              return value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4;
            });
            return linear[0] * 0.2126 + linear[1] * 0.7152 + linear[2] * 0.0722;
          }
          const foreground = luminance(getComputedStyle(element).color);
          const background = luminance(getComputedStyle(document.documentElement).backgroundColor);
          return (Math.max(foreground, background) + 0.05) / (Math.min(foreground, background) + 0.05);
        });
        expect(contrast).toBeGreaterThanOrEqual(4.5);
        expect(await publicPage.evaluate(() =>
          document.documentElement.scrollWidth <= window.innerWidth,
        )).toBe(true);
        const markup = await publicPage.content();
        expect(markup).not.toContain(user.id);
        expect(markup).not.toContain(emailAddress);
        expect(markup).not.toContain("clerk_user_id");
      }
      await publicPage.getByRole("link", { name: "Mi perfil" }).focus();
      await expect(publicPage.getByRole("link", { name: "Mi perfil" })).toBeFocused();
      const focusOutline = await publicPage.getByRole("link", { name: "Mi perfil" })
        .evaluate((element) => getComputedStyle(element).outlineStyle);
      expect(focusOutline).toBe("solid");
      await publicPage.setViewportSize({ width: 375, height: 900 });
      await publicPage.evaluate(() => {
        document.documentElement.style.fontSize = "200%";
      });
      expect(await publicPage.evaluate(() =>
        document.documentElement.scrollWidth <= window.innerWidth,
      )).toBe(true);

      await page.goto("/perfil");
      await page.getByRole("link", { name: "Editar mi perfil", exact: true }).focus();
      await page.keyboard.press("Enter");
      await expect(page).toHaveURL(/\/perfil\/editar$/);
      await expect(page.getByRole("heading", { name: "Editar mi perfil" })).toBeVisible();
      await expect(page.getByLabel("Nombre de usuario")).toHaveValue(username);
      await expect(page.getByLabel("Nombre visible")).toHaveValue("Perfil E2E");
      await expect(page.getByLabel("Biografía")).toHaveValue("Perfil temporal de prueba.");
      await expect(page.locator('input[name="role"]')).toHaveCount(0);
      for (const width of [375, 768, 1280]) {
        await page.setViewportSize({ width, height: 900 });
        expect(await page.evaluate(() =>
          document.documentElement.scrollWidth <= window.innerWidth,
        )).toBe(true);
      }
      await page.getByLabel("Nombre de usuario").fill("nombre inválido");
      await page.getByLabel("Nombre visible").fill("Perfil editado E2E");
      await page.getByLabel("Biografía").fill(updatedBio);
      await expect(page.getByText(`${updatedBio.length} de 300 caracteres.`, { exact: true })).toBeVisible();
      await page.getByRole("button", { name: "Guardar cambios" }).click();
      await expect(page.getByLabel("Nombre de usuario")).toHaveAttribute("aria-invalid", "true");
      await expect(page.getByLabel("Nombre de usuario")).toBeFocused();
      await publicPage.goto(`/usuario/${username}`);
      await expect(publicPage.getByRole("heading", { name: "Perfil E2E", exact: true })).toBeVisible();
      await expect(publicPage.getByText("Perfil temporal de prueba.", { exact: true })).toBeVisible();

      await page.getByLabel("Nombre de usuario").fill(occupiedUsername);
      await page.getByRole("button", { name: "Guardar cambios" }).click();
      await expect(page.getByText("Ese nombre de usuario ya está ocupado.").first()).toBeVisible();
      await expect(page.getByLabel("Nombre de usuario")).toBeFocused();
      await expect(page.getByLabel("Biografía")).toHaveValue(updatedBio);
      await publicPage.reload();
      await expect(publicPage.getByRole("heading", { name: "Perfil E2E", exact: true })).toBeVisible();

      await page.getByLabel("Nombre de usuario").fill(` ${updatedUsername.toUpperCase()} `);
      await page.locator("form").filter({ has: page.getByLabel("Nombre de usuario") }).evaluate((form, identity) => {
        for (const [name, value] of Object.entries({
          role: "admin", clerk_user_id: identity, id: "foreign-profile",
        })) {
          const input = document.createElement("input");
          input.type = "hidden";
          input.name = name;
          input.value = value;
          form.append(input);
        }
      }, occupiedIdentity);

      let releaseAction: () => void = () => { throw new Error("Action gate was not initialized"); };
      const actionGate = new Promise<void>((resolve) => { releaseAction = resolve; });
      await page.route("**/perfil/editar", async (route) => {
        if (route.request().method() === "POST") await actionGate;
        await route.continue();
      });
      try {
        await page.getByRole("button", { name: "Guardar cambios" }).click();
        await expect(page.getByRole("button", { name: "Guardando..." })).toBeDisabled();
        await expect(page.getByLabel("Nombre de usuario")).toBeDisabled();
        await expect(page.getByText("Guardando cambios...", { exact: true })).toBeVisible();
      } finally {
        releaseAction();
      }
      await expect(page.getByText("Perfil actualizado.", { exact: true })).toBeVisible();
      await expect(page.getByText("Perfil actualizado.", { exact: true })).toBeFocused();
      await expect(page.getByLabel("Nombre de usuario")).toHaveValue(updatedUsername);
      await page.unroute("**/perfil/editar");
      await page.reload();
      await expect(page.getByLabel("Nombre de usuario")).toHaveValue(updatedUsername);
      await expect(page.getByLabel("Nombre visible")).toHaveValue("Perfil editado E2E");
      await expect(page.getByLabel("Biografía")).toHaveValue(updatedBio);

      await Promise.all([
        page.waitForResponse((response) => response.request().method() === "POST"
          && Boolean(response.request().headers()["next-action"])),
        page.getByRole("button", { name: "Guardar cambios" }).click(),
      ]);
      await expect(page.getByText("Perfil actualizado.", { exact: true })).toBeVisible();
      await page.getByRole("link", { name: "Volver a mi perfil" }).click();
      await expect(page.getByRole("heading", { name: "Perfil editado E2E", exact: true })).toBeVisible();
      await expect(page.getByText("user", { exact: true })).toBeVisible();
      await expect(page.getByRole("link", { name: "Ver perfil público" }))
        .toHaveAttribute("href", `/usuario/${updatedUsername}`);
      await publicPage.goto(`/usuario/${updatedUsername}`);
      await expect(publicPage.getByRole("heading", { name: "Perfil editado E2E", exact: true })).toBeVisible();
      await expect(publicPage.getByText(updatedBio, { exact: true })).toBeVisible();
      await expect(publicPage.getByText("user", { exact: true })).toBeVisible();
      await publicPage.goto(`/usuario/${username}`);
      await expect(publicPage.getByRole("heading", { name: "Perfil no encontrado" })).toBeVisible();
      await publicPage.goto(`/usuario/${occupiedUsername}`);
      await expect(publicPage.getByRole("heading", { name: "Conflicto E2E", exact: true })).toBeVisible();
      await publicPage.goto("/perfil/editar");
      await expect(publicPage).toHaveURL(/\/sign-in/);

      await publicPage.goto(`/usuario/${username.toUpperCase()}`);
      await expect(publicPage.getByRole("heading", { name: "Perfil no encontrado" })).toBeVisible();
      await publicPage.goto(`/usuario/absent_${uniqueSuffix}`);
      await expect(publicPage.getByRole("heading", { name: "Perfil no encontrado" })).toBeVisible();
      await publicPage.goto("/perfil");
      await expect(publicPage).toHaveURL(/\/sign-in/);
    } finally {
      await visitor.close();
    }
  } finally {
    try {
      deleteProfile(user.id);
    } finally {
      try {
        deleteProfile(occupiedIdentity);
      } finally {
        await clerkClient.users.deleteUser(user.id);
      }
    }
  }
});

test("keeps the missing-profile return link below its message", async ({ page }) => {
  await setupClerkTestingToken({ page });

  for (const width of [375, 768, 1280]) {
    await page.setViewportSize({ width, height: 900 });
    await page.goto("/usuario/perfil_inexistente_prueba");
    await expect(page.getByRole("heading", { name: "Perfil no encontrado" })).toBeVisible();
    const description = page.getByText("No existe un perfil público con ese nombre de usuario.");
    const returnLink = page.getByRole("link", { name: "Volver al inicio" });
    const descriptionBox = await description.boundingBox();
    const returnBox = await returnLink.boundingBox();

    if (!descriptionBox || !returnBox) {
      throw new Error("Missing-profile message and return link must be visible");
    }

    expect(returnBox.y).toBeGreaterThanOrEqual(descriptionBox.y + descriptionBox.height);
    expect(await page.evaluate(() =>
      document.documentElement.scrollWidth <= window.innerWidth,
    )).toBe(true);
    await returnLink.focus();
    await expect(returnLink).toBeFocused();
    await page.keyboard.press("Enter");
    await expect(page).toHaveURL("http://localhost:3000/");
  }
});