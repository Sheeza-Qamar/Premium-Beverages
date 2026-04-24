import { dbExecute } from "@/lib/db";
import { columnExists } from "@/lib/schema-utils";

/* eslint-disable no-var */
declare global {
  var __erpEnsureOrdersSchemaPromise: Promise<void> | undefined;
}

/**
 * Ensures order schema supports payment type and item bottle type.
 */
export async function ensureOrdersSchema() {
  if (global.__erpEnsureOrdersSchemaPromise) {
    return global.__erpEnsureOrdersSchemaPromise;
  }

  global.__erpEnsureOrdersSchemaPromise = (async () => {
    const hasPaymentType = await columnExists("orders", "payment_type");
    if (!hasPaymentType) {
      await dbExecute(
        "ALTER TABLE orders ADD COLUMN payment_type ENUM('credit','cash') NOT NULL DEFAULT 'credit' AFTER status",
      );
    }

    const hasBottleType = await columnExists("order_items", "bottle_type");
    if (!hasBottleType) {
      await dbExecute(
        "ALTER TABLE order_items ADD COLUMN bottle_type ENUM('mix','pure') NULL AFTER product_name",
      );
    }
  })().catch((error) => {
    global.__erpEnsureOrdersSchemaPromise = undefined;
    throw error;
  });

  return global.__erpEnsureOrdersSchemaPromise;
}
