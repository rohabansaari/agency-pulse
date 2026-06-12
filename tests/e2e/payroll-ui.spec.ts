import { test, expect } from "@playwright/test";
import { registerAdmin } from "./helpers/api";

test.describe("Payroll admin UI", () => {
  test("admin can open payroll page and see settings", async ({ page, request }) => {
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
    await expect(page.getByText("Loading...")).toBeHidden({ timeout: 60_000 });

    await page.getByRole("link", { name: /^payroll$/i }).click();
    await expect(page).toHaveURL(/\/admin\/payroll/);
    await expect(page.getByRole("heading", { name: /payroll runs/i })).toBeVisible();
    await expect(page.getByRole("heading", { name: /payroll settings/i })).toBeVisible();
    await expect(page.getByLabel(/working days per month/i)).toBeVisible();
    await expect(page.getByLabel(/income tax %/i)).toBeVisible();
  });
});
