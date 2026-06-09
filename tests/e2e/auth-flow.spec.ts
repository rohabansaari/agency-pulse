import { test, expect } from "@playwright/test";

test.describe("Authentication", () => {
  test("register and reach dashboard", async ({ page }) => {
    test.setTimeout(90_000);

    const email = `qa-${Date.now()}@example.com`;

    await page.goto("/register");
    await page.getByLabel(/full name/i).fill("QA Admin");
    await page.getByLabel(/email/i).fill(email);
    await page.getByLabel(/^password$/i).fill("password123");
    await page.getByRole("button", { name: /create account/i }).click();

    await expect(page.getByRole("button", { name: /creating account/i })).toBeHidden({
      timeout: 60_000,
    });

    await expect(page).toHaveURL(/\/dashboard/, { timeout: 15_000 });
    await expect(page.getByText("Loading...")).toBeHidden({ timeout: 60_000 });
    await expect(
      page.getByRole("heading", { name: /organization control center/i }),
    ).toBeVisible({ timeout: 15_000 });
    await expect(page.getByRole("link", { name: /^payroll$/i })).toBeVisible();
  });

  test("login with invalid credentials shows error", async ({ page }) => {
    await page.goto("/login");
    await page.getByLabel(/email/i).fill("nobody@example.com");
    await page.getByLabel(/password/i).fill("wrong-password");
    await page.getByRole("button", { name: /sign in/i }).click();

    await expect(page.getByRole("button", { name: /signing in/i })).toBeHidden({
      timeout: 60_000,
    });

    await expect(page.locator("form .border-red-200, form .border-red-900")).toBeVisible();
    await expect(page).toHaveURL(/\/login/);
  });
});
