import { test, expect } from "@playwright/test";

test.describe("Payroll admin UI", () => {
  test("admin can open payroll page and see settings", async ({ page }) => {
    test.setTimeout(90_000);

    const email = `qa-payroll-${Date.now()}@example.com`;

    await page.goto("/register");
    await page.getByLabel(/full name/i).fill("Payroll QA Admin");
    await page.getByLabel(/email/i).fill(email);
    await page.getByLabel(/^password$/i).fill("password123");
    await page.getByRole("button", { name: /create account/i }).click();

    await expect(page.getByRole("button", { name: /creating account/i })).toBeHidden({
      timeout: 60_000,
    });
    await expect(page).toHaveURL(/\/dashboard/, { timeout: 15_000 });
    await expect(page.getByText("Loading...")).toBeHidden({ timeout: 60_000 });

    await page.getByRole("link", { name: /^payroll$/i }).click();
    await expect(page).toHaveURL(/\/admin\/payroll/);
    await expect(page.getByRole("heading", { name: /payroll runs/i })).toBeVisible();
    await expect(page.getByRole("heading", { name: /payroll settings/i })).toBeVisible();
    await expect(page.getByLabel(/working days per month/i)).toBeVisible();
    await expect(page.getByLabel(/income tax %/i)).toBeVisible();
  });
});
