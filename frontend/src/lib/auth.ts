const TOKEN_KEY = "agencypulse_token";
const ORG_KEY = "agencypulse_organization_id";

export function getToken(): string | null {
  if (typeof window === "undefined") {
    return null;
  }

  return localStorage.getItem(TOKEN_KEY);
}

export function setToken(token: string): void {
  localStorage.setItem(TOKEN_KEY, token);
}

export function clearToken(): void {
  localStorage.removeItem(TOKEN_KEY);
  clearOrganizationId();
}

export function getOrganizationId(): number | null {
  if (typeof window === "undefined") {
    return null;
  }

  const value = localStorage.getItem(ORG_KEY);
  return value ? Number(value) : null;
}

export function setOrganizationId(organizationId: number): void {
  localStorage.setItem(ORG_KEY, String(organizationId));
}

export function clearOrganizationId(): void {
  localStorage.removeItem(ORG_KEY);
}
