import { test, expect } from "@playwright/test";

const apiBase = process.env.E2E_API_URL ?? "http://localhost:8080/api/v1";

test.describe("System health", () => {
  test("API health endpoint responds", async ({ request }) => {
    const response = await request.get(`${apiBase}/health`);
    expect(response.ok()).toBeTruthy();

    const body = await response.json();
    expect(body.status).toBe("ok");
  });

  test("login page renders", async ({ page }) => {
    await page.goto("/login");
    await expect(page.getByRole("heading", { name: /sign in/i })).toBeVisible();
    await expect(page.getByLabel(/email/i)).toBeVisible();
    await expect(page.getByLabel(/password/i)).toBeVisible();
  });
});
