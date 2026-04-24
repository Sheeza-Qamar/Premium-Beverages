/** Premium Beverages — single source for product name and brand palette (matches logo teal). */
export const BRAND = {
  name: "Premium Beverages",
  /** Primary teal from logo background */
  primaryHex: "#1a7a9b",
  /** Darker teal for hovers / emphasis */
  primaryDarkHex: "#146a84",
  /** Light tint for surfaces / gradients */
  primaryMutedHex: "#e5f2f6",
} as const;

/** Chart series — lighter teals harmonize with `BRAND.primaryHex` */
export const CHART_PALETTE = [
  BRAND.primaryHex,
  "#2a9db8",
  "#4db8d4",
  "#7ecce0",
] as const;
