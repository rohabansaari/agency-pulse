/** In-memory payroll PIN for the current browser tab only — never persisted. */

let payrollPin: string | null = null;

export function getPayrollPin(): string | null {
  return payrollPin;
}

export function setPayrollPin(pin: string | null): void {
  payrollPin = pin;
}

export function clearPayrollPin(): void {
  payrollPin = null;
}
