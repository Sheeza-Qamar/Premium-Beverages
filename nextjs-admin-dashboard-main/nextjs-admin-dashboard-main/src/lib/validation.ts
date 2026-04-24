export function isValidEmail(value: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

export function toTrimmedString(value: unknown): string {
  return String(value ?? "").trim();
}

export function toOptionalTrimmedString(value: unknown): string | null {
  const parsed = toTrimmedString(value);
  return parsed === "" ? null : parsed;
}

export function parseNonNegativeNumber(value: unknown): number | null {
  const parsed = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(parsed) || parsed < 0) {
    return null;
  }
  return parsed;
}
