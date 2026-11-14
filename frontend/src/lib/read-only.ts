/**
 * Preview mode: a self sign-up workspace waits for a platform admin's approval.
 * Until then everything can be seen and nothing can be changed. The server
 * enforces it; this keeps the UI honest about it before a request is sent.
 */

export const READ_ONLY_EVENT = "ap:read-only-blocked";

export const READ_ONLY_MESSAGE =
  "Your workspace is waiting for approval. You can look around, and editing unlocks once it's approved.";

let readOnly = false;

export function setReadOnlyMode(value: boolean): void {
  readOnly = value;
}

export function isReadOnlyMode(): boolean {
  return readOnly;
}

/** Writes that stay allowed in preview mode (sign-out, password, and the payroll PIN that guards the payroll screens). */
const ALLOWED_WRITES = [/^\/auth\//, /^\/payroll\/vault\/(initialize|unlock|lock)$/];

export function isBlockedWrite(path: string, method: string | undefined): boolean {
  const verb = (method ?? "GET").toUpperCase();
  if (verb === "GET" || verb === "HEAD" || verb === "OPTIONS") {
    return false;
  }
  const bare = path.split("?")[0];
  return !ALLOWED_WRITES.some((pattern) => pattern.test(bare));
}

export function announceReadOnlyBlock(): void {
  if (typeof window !== "undefined") {
    window.dispatchEvent(new CustomEvent(READ_ONLY_EVENT));
  }
}
