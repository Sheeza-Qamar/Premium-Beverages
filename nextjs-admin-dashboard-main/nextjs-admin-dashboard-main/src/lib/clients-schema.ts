import { dbExecute } from "@/lib/db";
import { columnExists, indexExists } from "@/lib/schema-utils";

/* eslint-disable no-var */
declare global {
  var __erpEnsureClientsSchemaPromise: Promise<void> | undefined;
}

export async function ensureClientsSchema() {
  if (global.__erpEnsureClientsSchemaPromise) {
    return global.__erpEnsureClientsSchemaPromise;
  }

  global.__erpEnsureClientsSchemaPromise = (async () => {
    const hasEmail = await columnExists("clients", "email");
    if (!hasEmail) {
      await dbExecute(
        "ALTER TABLE clients ADD COLUMN email VARCHAR(190) NULL AFTER name",
      );
    }

    const hasEmailIndex = await indexExists("clients", "idx_clients_email");
    if (!hasEmailIndex) {
      await dbExecute("ALTER TABLE clients ADD INDEX idx_clients_email (email)");
    }
  })().catch((error) => {
    global.__erpEnsureClientsSchemaPromise = undefined;
    throw error;
  });

  return global.__erpEnsureClientsSchemaPromise;
}
