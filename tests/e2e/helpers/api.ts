const apiBase = process.env.E2E_API_URL ?? "http://localhost:8080/api/v1";

export type AuthSession = {
  token: string;
  organizationId: number;
  userId: number;
  email: string;
};

async function activateInvitedUser(
  request: import("@playwright/test").APIRequestContext,
  email: string,
  password: string,
): Promise<void> {
  const activate = await request.post(`${apiBase}/testing/activate-invited-user`, {
    data: { email, password },
  });

  if (!activate.ok()) {
    throw new Error(`Activate invited user failed: ${activate.status()} ${await activate.text()}`);
  }
}

export async function registerAdmin(
  request: import("@playwright/test").APIRequestContext,
  suffix = Date.now(),
): Promise<AuthSession> {
  const email = `qa-admin-${suffix}@example.com`;
  const password = "password123";

  const superLogin = await request.post(`${apiBase}/auth/login`, {
    data: {
      email: process.env.E2E_SUPER_ADMIN_EMAIL ?? "superadmin@gmail.com",
      password: process.env.E2E_SUPER_ADMIN_PASSWORD ?? "12345678",
    },
  });

  if (!superLogin.ok()) {
    throw new Error(`Super admin login failed: ${superLogin.status()} ${await superLogin.text()}`);
  }

  const superBody = await superLogin.json();

  const createOrg = await request.post(`${apiBase}/platform/organizations`, {
    headers: {
      Authorization: `Bearer ${superBody.token}`,
      Accept: "application/json",
      "Content-Type": "application/json",
    },
    data: {
      organization_name: `QA Org ${suffix}`,
      admin_name: "QA Admin",
      admin_email: email,
    },
  });

  if (!createOrg.ok()) {
    throw new Error(`Create org failed: ${createOrg.status()} ${await createOrg.text()}`);
  }

  await activateInvitedUser(request, email, password);

  const login = await request.post(`${apiBase}/auth/login`, {
    data: { email, password },
  });

  if (!login.ok()) {
    throw new Error(`Admin login failed: ${login.status()} ${await login.text()}`);
  }

  const body = await login.json();

  return {
    token: body.token,
    organizationId: body.current_organization_id,
    userId: body.user.id,
    email,
  };
}

export async function activateTeamMember(
  request: import("@playwright/test").APIRequestContext,
  email: string,
  password = "password123",
): Promise<void> {
  await activateInvitedUser(request, email, password);
}

export function authHeaders(session: AuthSession): Record<string, string> {
  return {
    Authorization: `Bearer ${session.token}`,
    "X-Organization-Id": String(session.organizationId),
    Accept: "application/json",
    "Content-Type": "application/json",
  };
}

export function authHeadersWithPayroll(
  session: AuthSession,
  pin = "1234",
): Record<string, string> {
  return {
    ...authHeaders(session),
    "X-Payroll-Pin": pin,
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
