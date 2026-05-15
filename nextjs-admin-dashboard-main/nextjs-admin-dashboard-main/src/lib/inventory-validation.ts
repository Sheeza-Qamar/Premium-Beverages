import { parseNonNegativeNumber, toOptionalTrimmedString } from "@/lib/validation";

export const UNITS = new Set(["pcs", "kg"]);
export const MATERIAL_TYPES = new Set(["bottle", "label", "other"]);
export const BOTTLE_TYPES = new Set(["mix", "pure"]);

export function normalizeBottleType(value: unknown): "mix" | "pure" | null {
  const parsed = toOptionalTrimmedString(value)?.toLowerCase() ?? null;
  if (!parsed) {
    return null;
  }
  if (!BOTTLE_TYPES.has(parsed)) {
    return null;
  }
  return parsed as "mix" | "pure";
}

export function parseNonNegativeNumberOr(
  value: unknown,
  fallback: number,
): number {
  const parsed = parseNonNegativeNumber(value);
  return parsed === null ? fallback : parsed;
}
