const DD_MM_YYYY = /^(\d{2})\/(\d{2})\/(\d{4})$/;

export function todayDdMmYyyy(): string {
  return formatDateDdMmYyyy(new Date());
}

export function formatDateDdMmYyyy(date: Date): string {
  const day = String(date.getDate()).padStart(2, "0");
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const year = date.getFullYear();

  return `${day}/${month}/${year}`;
}

export function isValidDdMmYyyy(value: string): boolean {
  const match = value.trim().match(DD_MM_YYYY);
  if (!match) {
    return false;
  }

  const day = Number(match[1]);
  const month = Number(match[2]);
  const year = Number(match[3]);
  const date = new Date(year, month - 1, day);

  return (
    date.getFullYear() === year &&
    date.getMonth() === month - 1 &&
    date.getDate() === day
  );
}

export function parseDdMmYyyy(value: string): Date | null {
  if (!isValidDdMmYyyy(value)) {
    return null;
  }

  const match = value.match(DD_MM_YYYY);
  if (!match) {
    return null;
  }

  return new Date(Number(match[3]), Number(match[2]) - 1, Number(match[1]));
}

export function compareDdMmYyyy(a: string, b: string): number {
  return toSortable(a).localeCompare(toSortable(b));
}

export function isBeforeDdMmYyyy(a: string, b: string): boolean {
  return compareDdMmYyyy(a, b) < 0;
}

export function formatAsDdMmYyyyTyping(raw: string): string {
  const digits = raw.replace(/\D/g, "").slice(0, 8);

  if (digits.length <= 2) {
    return digits;
  }

  if (digits.length <= 4) {
    return `${digits.slice(0, 2)}/${digits.slice(2)}`;
  }

  return `${digits.slice(0, 2)}/${digits.slice(2, 4)}/${digits.slice(4)}`;
}

export function normalizeDdMmYyyy(value: string): string {
  const trimmed = value.trim();
  if (!isValidDdMmYyyy(trimmed)) {
    return formatAsDdMmYyyyTyping(trimmed);
  }

  return trimmed;
}

export function displayLeaveDate(value: string | null | undefined): string {
  if (!value) {
    return "—";
  }

  if (isValidDdMmYyyy(value)) {
    return value;
  }

  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    return value;
  }

  return formatDateDdMmYyyy(parsed);
}

function toSortable(value: string): string {
  const match = value.match(DD_MM_YYYY);
  if (!match) {
    return value;
  }

  return `${match[3]}-${match[2]}-${match[1]}`;
}

/** Convert dd/mm/yyyy to yyyy-mm-dd for API payloads. */
export function ddMmYyyyToIso(value: string): string {
  const parsed = parseDdMmYyyy(value);
  if (!parsed) {
    return value;
  }

  const year = parsed.getFullYear();
  const month = String(parsed.getMonth() + 1).padStart(2, "0");
  const day = String(parsed.getDate()).padStart(2, "0");

  return `${year}-${month}-${day}`;
}

/** Convert yyyy-mm-dd (or ISO date) to dd/mm/yyyy for display. */
export function isoToDdMmYyyy(value: string): string {
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    return value;
  }

  return formatDateDdMmYyyy(parsed);
}
