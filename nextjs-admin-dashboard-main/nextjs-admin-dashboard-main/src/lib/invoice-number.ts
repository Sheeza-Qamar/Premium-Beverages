import type { DbRow } from "@/lib/db";
import type { PoolConnection } from "mysql2/promise";

function parseInvoiceSuffix(invoiceNumber: string, prefix: string) {
  if (!invoiceNumber.startsWith(prefix)) {
    return null;
  }
  const suffix = invoiceNumber.slice(prefix.length);
  if (!/^\d{4}$/.test(suffix)) {
    return null;
  }
  return Number(suffix);
}

/** Next sequential invoice number for a calendar day (INV-YYYYMMDD-####). */
export async function generateInvoiceNumber(
  conn: PoolConnection,
  invoiceDate: string,
): Promise<string> {
  const prefix = `INV-${invoiceDate.replaceAll("-", "")}-`;
  const [rows] = await conn.query<(DbRow & { invoice_number: string | null })[]>(
    `SELECT invoice_number
     FROM orders
     WHERE invoice_number LIKE ?
     ORDER BY invoice_number DESC
     LIMIT 20`,
    [`${prefix}%`],
  );

  let maxSuffix = 0;
  for (const row of rows) {
    if (!row.invoice_number) {
      continue;
    }
    const suffix = parseInvoiceSuffix(row.invoice_number, prefix);
    if (suffix && suffix > maxSuffix) {
      maxSuffix = suffix;
    }
  }

  return `${prefix}${String(maxSuffix + 1).padStart(4, "0")}`;
}
