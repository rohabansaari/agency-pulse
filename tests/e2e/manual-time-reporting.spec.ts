import { test, expect } from "@playwright/test";
import { activateTeamMember, authHeaders, registerAdmin } from "./helpers/api";

const apiBase = process.env.E2E_API_URL ?? "http://localhost:8080/api/v1";

function isoToday(): string {
  return new Date().toISOString().slice(0, 10);
}

test.describe("Manual time visibility", () => {
  test.setTimeout(180_000);

  test("approved manual entry appears in dashboard and reports", async ({ request }) => {
    const admin = await registerAdmin(request);
    const headers = authHeaders(admin);
    const manualSeconds = 5400;

    const managerEmail = `qa-mgr-${Date.now()}@example.com`;
    const invite = await request.post(`${apiBase}/team/invite`, {
      headers,
      data: { name: "QA Manager", email: managerEmail, role: "manager" },
    });
    expect(invite.status()).toBe(201);

    const roster = await request.get(`${apiBase}/team`, { headers });
    expect(roster.ok()).toBeTruthy();
    const members = await roster.json();
    const managerMembership = members.find((m: { email: string }) => m.email === managerEmail);
    expect(managerMembership).toBeTruthy();

    await activateTeamMember(request, managerEmail);

    const employeeEmail = `qa-emp-${Date.now()}@example.com`;
    const employeeCreate = await request.post(`${apiBase}/team/create-employee`, {
      headers,
      data: {
        name: "QA Employee",
        email: employeeEmail,
        salary_type: "hourly",
        hourly_rate: 50,
        payroll_pin: "1234",
        payroll_pin_confirmation: "1234",
      },
    });
    expect(employeeCreate.status()).toBe(201);
    const employeeId = (await employeeCreate.json()).member.user_id as number;

    await activateTeamMember(request, employeeEmail);

    const teamCreate = await request.post(`${apiBase}/teams`, {
      headers,
      data: { name: `QA Team ${Date.now()}` },
    });
    expect(teamCreate.status()).toBe(201);
    const teamId = (await teamCreate.json()).team.id as number;

    const assignManager = await request.post(`${apiBase}/teams/${teamId}/assign-manager`, {
      headers,
      data: { manager_id: managerMembership.user_id },
    });
    expect(assignManager.ok()).toBeTruthy();

    const addMember = await request.post(`${apiBase}/teams/${teamId}/add-member`, {
      headers,
      data: { user_id: employeeId },
    });
    expect(addMember.ok()).toBeTruthy();

    const projectCreate = await request.post(`${apiBase}/projects`, {
      headers,
      data: {
        name: `QA Project ${Date.now()}`,
        client_name: "QA Client",
        status: "active",
      },
    });
    expect(projectCreate.status()).toBe(201);
    const projectId = (await projectCreate.json()).project.id as number;

    const assignProject = await request.post(`${apiBase}/projects/${projectId}/members`, {
      headers,
      data: { user_id: employeeId },
    });
    expect(assignProject.ok()).toBeTruthy();

    const manualCreate = await request.post(`${apiBase}/time/manual`, {
      headers,
      data: {
        user_id: employeeId,
        team_id: teamId,
        project_id: projectId,
        manager_id: managerMembership.user_id,
        date: isoToday(),
        duration: manualSeconds,
        description: "E2E approved manual entry",
        auto_approve: true,
      },
    });
    expect(manualCreate.status()).toBe(201);

    const adminDashboard = await request.get(`${apiBase}/dashboard`, { headers });
    expect(adminDashboard.ok()).toBeTruthy();
    expect((await adminDashboard.json()).today_tracked_seconds).toBe(manualSeconds);

    const orgReport = await request.get(`${apiBase}/reports/organization`, { headers });
    expect(orgReport.ok()).toBeTruthy();
    expect((await orgReport.json()).hours_today_seconds).toBe(manualSeconds);

    const managerLogin = await request.post(`${apiBase}/auth/login`, {
      data: { email: managerEmail, password: "password123" },
    });
    expect(managerLogin.ok()).toBeTruthy();
    const managerSession = await managerLogin.json();
    const managerHeaders = {
      Authorization: `Bearer ${managerSession.token}`,
      "X-Organization-Id": String(admin.organizationId),
      Accept: "application/json",
    };

    const managerDashboard = await request.get(`${apiBase}/dashboard`, {
      headers: managerHeaders,
    });
    expect(managerDashboard.ok()).toBeTruthy();
    const mgrDash = await managerDashboard.json();
    expect(mgrDash.teams[0].hours_today_seconds).toBe(manualSeconds);
    expect(mgrDash.summary.hours_today_seconds).toBe(manualSeconds);

    const managerReport = await request.get(`${apiBase}/reports/manager`, {
      headers: managerHeaders,
    });
    expect(managerReport.ok()).toBeTruthy();
    expect((await managerReport.json()).teams[0].hours_today_seconds).toBe(manualSeconds);

    const employeeLogin = await request.post(`${apiBase}/auth/login`, {
      data: { email: employeeEmail, password: "password123" },
    });
    expect(employeeLogin.ok()).toBeTruthy();
    const employeeSession = await employeeLogin.json();
    const employeeHeaders = {
      Authorization: `Bearer ${employeeSession.token}`,
      "X-Organization-Id": String(admin.organizationId),
      Accept: "application/json",
    };

    const employeeDashboard = await request.get(`${apiBase}/dashboard`, {
      headers: employeeHeaders,
    });
    expect(employeeDashboard.ok()).toBeTruthy();
    const empDash = await employeeDashboard.json();
    expect(empDash.today_total_seconds).toBe(manualSeconds);
    expect(empDash.personal_report.hours_today_seconds).toBe(manualSeconds);

    const projectReport = await request.get(`${apiBase}/reports/projects/${projectId}`, { headers });
    expect(projectReport.ok()).toBeTruthy();
    expect((await projectReport.json()).total_tracked_seconds).toBe(manualSeconds);
  });
});
