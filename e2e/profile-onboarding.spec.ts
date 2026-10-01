import { spawnSync } from "node:child_process";
import { join } from "node:path";
import { createClerkClient } from "@clerk/backend";
import { clerk } from "@clerk/testing/playwright";
import { expect, test } from "@playwright/test";

function deleteProfile(clerkUserId: string) {
  if (!/^user_[A-Za-z0-9]+$/.test(clerkUserId)) {
    throw new Error("Clerk returned an unexpected user identifier");
  }

  const supabaseCli = join(
    process.cwd(),
    "node_modules",
    "supabase",
    "dist",
    "supabase.js",
  );
  const result = spawnSync(
    process.execPath,
    [
      supabaseCli,
      "db",
      "query",
      "--linked",
      `delete from public.profiles where clerk_user_id = '${clerkUserId}';`,
      "--agent",
      "no",
      "--output-format",
      "text",
    ],
    { cwd: process.cwd(), encoding: "utf8" },
  );

  if (result.status !== 0) {
    throw new Error("Could not remove the E2E profile fixture");
  }
}

test("creates a profile after correcting invalid input", async ({ page }) => {
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
  const user = await clerkClient.users.createUser({
    emailAddress: [emailAddress],
    firstName: "VIA E2E",
    skipPasswordRequirement: true,
  });

  try {
    await page.goto("/");
    await page.waitForFunction(() => Boolean(window.Clerk?.loaded));
    await clerk.signIn({ emailAddress, page });
    await page.goto("/perfil");

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
  } finally {
    try {
      deleteProfile(user.id);
    } finally {
      await clerkClient.users.deleteUser(user.id);
    }
  }
});