import { dbExecute } from "@/lib/db";
import { columnExists, indexExists, tableConstraintExists } from "@/lib/schema-utils";

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

    const hasOrderId = await columnExists("production", "order_id");
    if (!hasOrderId) {
      await dbExecute(
        "ALTER TABLE production ADD COLUMN order_id BIGINT UNSIGNED NULL AFTER client_id",
      );
    }
    if (!(await indexExists("production", "idx_production_order"))) {
      await dbExecute("ALTER TABLE production ADD INDEX idx_production_order (order_id)");
    }
    if (!(await tableConstraintExists("production", "fk_production_order"))) {
      await dbExecute(
        "ALTER TABLE production ADD CONSTRAINT fk_production_order FOREIGN KEY (order_id) REFERENCES orders (id) ON DELETE RESTRICT",
      );
    }
  })().catch((error) => {
    global.__erpEnsureProductionSchemaPromise = undefined;
    throw error;
  });

  return global.__erpEnsureProductionSchemaPromise;
}
