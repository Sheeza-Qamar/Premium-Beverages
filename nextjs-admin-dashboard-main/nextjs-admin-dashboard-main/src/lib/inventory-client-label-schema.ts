import { dbExecute } from "@/lib/db";
import { columnExists, indexExists } from "@/lib/schema-utils";

declare global {
  var __erpEnsureRawMaterialsClientLabelPromise: Promise<void> | undefined;
}

/**
 * Adds optional client / client_label linkage on raw_materials for branded label stock.
 * Safe to call repeatedly.
 */
export async function ensureRawMaterialsClientLabelColumns() {
  if (global.__erpEnsureRawMaterialsClientLabelPromise) {
    return global.__erpEnsureRawMaterialsClientLabelPromise;
  }

  global.__erpEnsureRawMaterialsClientLabelPromise = (async () => {
    if (!(await columnExists("raw_materials", "client_id"))) {
      await dbExecute(
        "ALTER TABLE raw_materials ADD COLUMN client_id BIGINT UNSIGNED NULL AFTER bottle_type",
      );
    }
    if (!(await columnExists("raw_materials", "client_label_id"))) {
      await dbExecute(
        "ALTER TABLE raw_materials ADD COLUMN client_label_id BIGINT UNSIGNED NULL AFTER client_id",
      );
    }

    if (!(await indexExists("raw_materials", "idx_raw_materials_client"))) {
      await dbExecute("ALTER TABLE raw_materials ADD INDEX idx_raw_materials_client (client_id)");
    }
    if (!(await indexExists("raw_materials", "idx_raw_materials_client_label"))) {
      await dbExecute(
        "ALTER TABLE raw_materials ADD INDEX idx_raw_materials_client_label (client_label_id)",
      );
    }
    if (!(await indexExists("raw_materials", "uq_raw_materials_client_label_id"))) {
      await dbExecute(
        "CREATE UNIQUE INDEX uq_raw_materials_client_label_id ON raw_materials (client_label_id)",
      );
    }
  })().catch((error) => {
    global.__erpEnsureRawMaterialsClientLabelPromise = undefined;
    throw error;
  });

  return global.__erpEnsureRawMaterialsClientLabelPromise;
}
