/** Preset sizes in the bottle size picker; users can still type any value (stored as material / order text). */
export const DEFAULT_BOTTLE_SIZE_CHOICES = ["500ml", "1 litre"] as const;

export function mergeBottleSizeSuggestions(inventoryBottleNames: string[]): string[] {
  const set = new Set<string>([...DEFAULT_BOTTLE_SIZE_CHOICES]);
  for (const n of inventoryBottleNames) {
    const t = String(n ?? "").trim();
    if (t) set.add(t);
  }
  return [...set].sort((a, b) => a.localeCompare(b, undefined, { sensitivity: "base" }));
}
