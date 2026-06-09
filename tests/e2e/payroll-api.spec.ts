import { test, expect } from "@playwright/test";
import {
  authHeaders,
  registerAdmin,
  todayDdMmYyyy,
  unlockPayrollVault,
} from "./helpers/api";

const apiBase = process.env.E2E_API_URL ?? "http://localhost:8080/api/v1";

test.describe("Payroll API", () => {
  test.setTimeout(120_000);

  test("settings defaults and deduction snapshot on payroll run", async ({ request }) => {
    const session = await registerAdmin(request);
    const headers = authHeaders(session);

    await unlockPayrollVault(request, session);

    const settingsGet = await request.get(`${apiBase}/payroll/settings`, { headers });
    expect(settingsGet.ok()).toBeTruthy();
    const defaults = await settingsGet.json();
    expect(defaults.working_days_per_month).toBe(22);
    expect(defaults.working_hours_per_day).toBe(8);
    expect(defaults.expected_monthly_hours).toBe(176);

    const settingsPatch = await request.patch(`${apiBase}/payroll/settings`, {
      headers,
      data: {
        income_tax_percent: 10,
        eobi_percent: 1,
        social_security_percent: 2,
        custom_deduction_percent: 0.5,
      },
    });
    expect(settingsPatch.ok()).toBeTruthy();

    const employeeEmail = `qa-employee-${Date.now()}@example.com`;
    const employeeCreate = await request.post(`${apiBase}/team/create-employee`, {
      headers,
      data: {
        name: "QA Employee",
        email: employeeEmail,
        password: "password123",
        salary_type: "hourly",
        hourly_rate: 100,
        payroll_pin: "1234",
        payroll_pin_confirmation: "1234",
      },
    });
    expect(employeeCreate.status()).toBe(201);

    const today = todayDdMmYyyy();
    const runCreate = await request.post(`${apiBase}/payroll-runs`, {
      headers,
      data: {
        period_start: today,
        period_end: today,
      },
    });

    if (runCreate.status() === 422) {
      const body = await runCreate.json();
      test.skip(
        body.errors?.period_start?.[0]?.includes("overlapping") ?? false,
        "Overlapping payroll period from prior test data",
      );
    }

    expect(runCreate.status()).toBe(201);
    const runBody = await runCreate.json();
    const run = runBody.payroll_run;

    expect(run.status).toBe("draft");
    expect(run.total_pay_snapshot).toBe("0.00");
    expect(run.total_net_snapshot).toBe("0.00");
    expect(run.employee_records ?? []).toHaveLength(0);
  });

  test("fbr slab mode is rejected", async ({ request }) => {
    const session = await registerAdmin(request);
    const headers = authHeaders(session);
    await unlockPayrollVault(request, session);

    const response = await request.patch(`${apiBase}/payroll/settings`, {
      headers,
      data: { deduction_mode: "fbr_slabs" },
    });

    expect(response.status()).toBe(422);
    const body = await response.json();
    expect(body.errors?.deduction_mode).toBeDefined();
  });

  test("employee cannot access payroll settings", async ({ request }) => {
    const admin = await registerAdmin(request);
    const headers = authHeaders(admin);

    const employeeEmail = `qa-employee-rbac-${Date.now()}@example.com`;
    const employeeCreate = await request.post(`${apiBase}/team/create-employee`, {
      headers,
      data: {
        name: "QA Employee",
        email: employeeEmail,
        password: "password123",
        salary_type: "hourly",
        hourly_rate: 50,
        payroll_pin: "1234",
        payroll_pin_confirmation: "1234",
      },
    });
    expect(employeeCreate.status()).toBe(201);

    const login = await request.post(`${apiBase}/auth/login`, {
      data: {
        email: employeeEmail,
        password: "password123",
      },
    });
    expect(login.ok()).toBeTruthy();
    const employeeSession = await login.json();

    const employeeHeaders = {
      Authorization: `Bearer ${employeeSession.token}`,
      "X-Organization-Id": String(admin.organizationId),
      Accept: "application/json",
      "Content-Type": "application/json",
    };

    const response = await request.patch(`${apiBase}/payroll/settings`, {
      headers: employeeHeaders,
      data: { income_tax_percent: 5 },
    });

    expect(response.status()).toBe(403);
  });
});
