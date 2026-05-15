import { dbExecute } from "@/lib/db";

declare global {
  var __erpRetirePlasticPromise: Promise<void> | undefined;
}

/** Reclassify legacy `plastic` rows to `other` (idempotent). */
export async function ensurePlasticRetiredFromRawMaterials() {
  if (global.__erpRetirePlasticPromise) {
    return global.__erpRetirePlasticPromise;
  }

  global.__erpRetirePlasticPromise = (async () => {
    await dbExecute(
      "UPDATE raw_materials SET material_type = 'other', updated_at = NOW() WHERE material_type = 'plastic'",
    );
  })().catch((error) => {
    global.__erpRetirePlasticPromise = undefined;
    throw error;
  });

  return global.__erpRetirePlasticPromise;
}
