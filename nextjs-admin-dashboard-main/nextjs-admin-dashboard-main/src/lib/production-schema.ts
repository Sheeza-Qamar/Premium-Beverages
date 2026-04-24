import { dbExecute } from "@/lib/db";
import { columnExists } from "@/lib/schema-utils";

/* eslint-disable no-var */
declare global {
  var __erpEnsureProductionSchemaPromise: Promise<void> | undefined;
}

/**
 * Backward-compatible guard for production module schema.
 */
export async function ensureProductionSchema() {
  if (global.__erpEnsureProductionSchemaPromise) {
    return global.__erpEnsureProductionSchemaPromise;
  }

  global.__erpEnsureProductionSchemaPromise = (async () => {
    const hasBottleType = await columnExists("production", "bottle_type");
    if (!hasBottleType) {
      await dbExecute(
        "ALTER TABLE production ADD COLUMN bottle_type ENUM('mix','pure') NOT NULL DEFAULT 'mix' AFTER client_id",
      );
    }
  })().catch((error) => {
    global.__erpEnsureProductionSchemaPromise = undefined;
    throw error;
  });

  return global.__erpEnsureProductionSchemaPromise;
}
