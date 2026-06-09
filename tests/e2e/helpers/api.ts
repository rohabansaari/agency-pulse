const apiBase = process.env.E2E_API_URL ?? "http://localhost:8080/api/v1";

export type AuthSession = {
  token: string;
  organizationId: number;
  userId: number;
  email: string;
};

export async function registerAdmin(
  request: import("@playwright/test").APIRequestContext,
  suffix = Date.now(),
): Promise<AuthSession> {
  const email = `qa-admin-${suffix}@example.com`;

  const response = await request.post(`${apiBase}/auth/register`, {
    data: {
      name: "QA Admin",
      email,
      password: "password123",
    },
  });

  if (!response.ok()) {
    throw new Error(`Register failed: ${response.status()} ${await response.text()}`);
  }

  const body = await response.json();

  return {
    token: body.token,
    organizationId: body.current_organization_id,
    userId: body.user.id,
    email,
  };
}

export function authHeaders(session: AuthSession): Record<string, string> {
  return {
    Authorization: `Bearer ${session.token}`,
    "X-Organization-Id": String(session.organizationId),
    Accept: "application/json",
    "Content-Type": "application/json",
  };
}

export async function unlockPayrollVault(
  request: import("@playwright/test").APIRequestContext,
  session: AuthSession,
  pin = "1234",
): Promise<void> {
  const headers = authHeaders(session);

  const init = await request.post(`${apiBase}/payroll/vault/initialize`, {
    headers,
    data: {
      payroll_pin: pin,
      payroll_pin_confirmation: pin,
    },
  });

  if (!init.ok() && init.status() !== 422) {
    throw new Error(`Vault init failed: ${init.status()} ${await init.text()}`);
  }

  const unlock = await request.post(`${apiBase}/payroll/vault/unlock`, {
    headers,
    data: { payroll_pin: pin },
  });

  if (!unlock.ok()) {
    throw new Error(`Vault unlock failed: ${unlock.status()} ${await unlock.text()}`);
  }
}

export function todayDdMmYyyy(): string {
  const now = new Date();
  const day = String(now.getDate()).padStart(2, "0");
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const year = now.getFullYear();
  return `${day}/${month}/${year}`;
}
