import { test, expect } from "@playwright/test";

// E2E credentials. Mirrors tests/integration/setup.ts ROLE_CREDS —
// the same seeded TEST-branch users power both the Jest integration
// suite and the Playwright suite. Display names match the rows
// inserted during Phase 2 setup.
const CURATOR_EMAIL = "johnasija@outlook.com";
const CURATOR_DISPLAY_NAME = "Test Curator";

function requirePassword(): string {
  const value = process.env.TEST_CURATOR_PASSWORD;
  if (!value) {
    throw new Error("TEST_CURATOR_PASSWORD must be set in .env.local or CI secrets");
  }
  return value;
}

test.describe("admin login slice", () => {
  test("logged-out visitor to /admin is redirected to /admin/login", async ({
    page,
  }) => {
    await page.goto("/admin");

    await expect(page).toHaveURL(/\/admin\/login$/);
  });

  test("curator can sign in and land on the empty maps view", async ({
    page,
  }) => {
    const password = requirePassword();

    await page.goto("/admin/login");
    await page.locator("#email").fill(CURATOR_EMAIL);
    await page.locator("#password").fill(password);
    await page.getByRole("button", { name: /^sign in$/i }).click();

    await expect(page).toHaveURL(/\/admin$/, { timeout: 10_000 });
    await expect(page.getByTestId("maps-empty-state")).toBeVisible();
    await expect(page.getByTestId("signed-in-name")).toContainText(
      CURATOR_DISPLAY_NAME,
    );
  });

  test("bad password shows the inline error", async ({ page }) => {
    await page.goto("/admin/login");
    await page.locator("#email").fill(CURATOR_EMAIL);
    await page.locator("#password").fill("definitely-not-the-password");
    await page.getByRole("button", { name: /^sign in$/i }).click();

    await expect(page.getByTestId("login-error")).toBeVisible();
    await expect(page).toHaveURL(/\/admin\/login$/);
  });
});
