import { dbExecute } from "@/lib/db";
import { columnExists, indexExists } from "@/lib/schema-utils";

declare global {
  var __erpEnsureBottleTypeSchemaPromise: Promise<void> | undefined;
}


/**
 * Ensures inventory schema can handle bottle type.
 * Safe to call repeatedly; applies once per process.
 */
export async function ensureInventoryBottleTypeSchema() {
  if (global.__erpEnsureBottleTypeSchemaPromise) {
    return global.__erpEnsureBottleTypeSchemaPromise;
  }

  global.__erpEnsureBottleTypeSchemaPromise = (async () => {
    const hasBottleType = await columnExists("raw_materials", "bottle_type");
    if (!hasBottleType) {
      await dbExecute(
        "ALTER TABLE raw_materials ADD COLUMN bottle_type ENUM('mix','pure') NULL AFTER material_type",
      );
      await dbExecute(
        "UPDATE raw_materials SET bottle_type = 'mix' WHERE material_type = 'bottle' AND bottle_type IS NULL",
      );
    }

    const hasBottleTypeIndex = await indexExists(
      "raw_materials",
      "idx_raw_materials_bottle_type",
    );
    if (!hasBottleTypeIndex) {
      await dbExecute(
        "ALTER TABLE raw_materials ADD INDEX idx_raw_materials_bottle_type (bottle_type)",
      );
    }
  })().catch((error) => {
    global.__erpEnsureBottleTypeSchemaPromise = undefined;
    throw error;
  });

  return global.__erpEnsureBottleTypeSchemaPromise;
}
