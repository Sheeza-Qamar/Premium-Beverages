import { dbExecute } from "@/lib/db";

declare global {
  var __erpRetireCapPromise: Promise<void> | undefined;
}

/** Reclassify legacy `cap` rows to `other` and narrow the enum (idempotent). */
export async function ensureCapRetiredFromRawMaterials() {
  if (global.__erpRetireCapPromise) {
    return global.__erpRetireCapPromise;
  }

  global.__erpRetireCapPromise = (async () => {
    await dbExecute(
      "UPDATE raw_materials SET material_type = 'other', updated_at = NOW() WHERE material_type = 'cap'",
    );
    try {
      await dbExecute(
        "ALTER TABLE raw_materials MODIFY COLUMN `material_type` ENUM('bottle','label','other') NOT NULL DEFAULT 'other'",
      );
    } catch {
      /* ENUM may already be narrowed or ALTER not permitted — rows are migrated */
    }
  })().catch((error) => {
    global.__erpRetireCapPromise = undefined;
    throw error;
  });

  return global.__erpRetireCapPromise;
}
