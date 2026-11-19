import { expect, test } from "@playwright/test";

// Set E2E_SKIP=1 to skip (e.g. CI jobs without browsers installed).
test.skip(Boolean(process.env.E2E_SKIP), "E2E_SKIP is set");

test("login page loads and dev login reaches the app shell", async ({ page }) => {
  await page.goto("/login");
  await expect(page.getByText("Sign in", { exact: true })).toBeVisible();

  await page.getByLabel("Email").fill("dev@example.com");
  await page.getByRole("button", { name: "Continue" }).click();

  // Authenticated: redirected away from /login into the shell.
  await expect(page).not.toHaveURL(/\/login/);
  await expect(page.getByText("Dashboard").first()).toBeVisible();
});

test("unauthenticated visits are redirected to /login", async ({ page }) => {
  await page.goto("/catalog/items");
  await expect(page).toHaveURL(/\/login/);
});
