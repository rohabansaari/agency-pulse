import { test, expect } from "@playwright/test";
import { registerAdmin } from "./helpers/api";

test.describe("Authentication", () => {
  test("register route redirects to login", async ({ page }) => {
    await page.goto("/register");
    await expect(page).toHaveURL(/\/login/, { timeout: 10_000 });
  });

  test("admin can login and reach dashboard", async ({ page, request }) => {
    test.setTimeout(90_000);

    const session = await registerAdmin(request);

    await page.goto("/login");
    await page.getByLabel(/email/i).fill(session.email);
    await page.getByLabel(/password/i).fill("password123");
    await page.getByRole("button", { name: /sign in/i }).click();

    await expect(page.getByRole("button", { name: /signing in/i })).toBeHidden({
      timeout: 60_000,
    });

    await expect(page).toHaveURL(/\/dashboard|\/onboarding/, { timeout: 15_000 });
  });

  test("login with invalid credentials shows error", async ({ page }) => {
    await page.goto("/login");
    await page.getByLabel(/email/i).fill("nobody@example.com");
    await page.getByLabel(/password/i).fill("wrong-password");
    await page.getByRole("button", { name: /sign in/i }).click();

    await expect(page.getByRole("button", { name: /signing in/i })).toBeHidden({
      timeout: 60_000,
    });

    await expect(page.locator("form")).toContainText(/sign in|credentials|unable/i);
    await expect(page).toHaveURL(/\/login/);
  });
});
