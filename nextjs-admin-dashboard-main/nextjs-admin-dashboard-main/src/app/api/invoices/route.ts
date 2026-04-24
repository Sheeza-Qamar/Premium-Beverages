import { requireAuth } from "@/lib/auth";
import { dbQuery, type DbRow, withTransaction } from "@/lib/db";
import { parseNonNegativeNumber, toOptionalTrimmedString } from "@/lib/validation";
import type { PoolConnection, ResultSetHeader } from "mysql2/promise";
import { NextResponse } from "next/server";

type InvoiceRow = DbRow & {
  id: number;
  invoice_number: string;
  order_date: string;
  total_amount: string;
  payment_type: "credit" | "cash";
  status: "pending" | "completed" | "cancelled";
  notes: string | null;
  created_at: string;
  client_id: number;
  client_name: string;
  client_email: string | null;
  client_contact_number: string | null;
  client_address: string | null;
};

type OrderItemRow = DbRow & {
  order_id: number;
  id: number;
  product_name: string;
  bottle_type: "mix" | "pure" | null;
  quantity: string;
  unit_price: string;
  total_price: string;
  sort_order: number;
};

type ClientRow = DbRow & { id: number };

type CreateItemInput = {
  productName: string;
  bottleType: "mix" | "pure" | null;
  quantity: number;
  unitPrice: number;
};

function isValidDate(value: string) {
  return /^\d{4}-\d{2}-\d{2}$/.test(value);
}

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

async function generateInvoiceNumber(conn: PoolConnection, invoiceDate: string) {
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

export async function GET() {
  const auth = await requireAuth();
  if (!auth.ok) {
    return auth.response;
  }
  const [rows] = await dbQuery<InvoiceRow[]>(
    `SELECT
       o.id,
       o.invoice_number,
       o.order_date,
       o.total_amount,
       o.payment_type,
       o.status,
       o.notes,
       o.created_at,
       c.id AS client_id,
       c.name AS client_name,
       c.email AS client_email,
       c.contact_number AS client_contact_number,
       c.address AS client_address
     FROM orders o
     INNER JOIN clients c ON c.id = o.client_id
     WHERE o.invoice_number IS NOT NULL
     ORDER BY o.order_date DESC, o.id DESC
     LIMIT 150`,
  );

  const orderIds = rows.map((row) => row.id);
  let itemsByOrder = new Map<number, Array<{
    id: number;
    productName: string;
    bottleType: "mix" | "pure" | null;
    quantity: number;
    unitPrice: number;
    totalPrice: number;
    sortOrder: number;
  }>>();

  if (orderIds.length > 0) {
    const placeholders = orderIds.map(() => "?").join(", ");
    const [items] = await dbQuery<OrderItemRow[]>(
      `SELECT
         order_id,
         id,
         product_name,
         bottle_type,
         quantity,
         unit_price,
         total_price,
         sort_order
       FROM order_items
       WHERE order_id IN (${placeholders})
       ORDER BY sort_order ASC, id ASC`,
      orderIds,
    );

    itemsByOrder = items.reduce((map, item) => {
      const list = map.get(item.order_id) ?? [];
      list.push({
        id: item.id,
        productName: item.product_name,
        bottleType: item.bottle_type,
        quantity: Number(item.quantity),
        unitPrice: Number(item.unit_price),
        totalPrice: Number(item.total_price),
        sortOrder: item.sort_order,
      });
      map.set(item.order_id, list);
      return map;
    }, new Map<number, Array<{
      id: number;
      productName: string;
      bottleType: "mix" | "pure" | null;
      quantity: number;
      unitPrice: number;
      totalPrice: number;
      sortOrder: number;
    }>>());
  }

  return NextResponse.json({
    invoices: rows.map((row) => ({
      id: row.id,
      invoiceNumber: row.invoice_number,
      invoiceDate: row.order_date,
      totalAmount: Number(row.total_amount),
      paymentType: row.payment_type,
      status: row.status,
      notes: row.notes,
      createdAt: row.created_at,
      client: {
        id: row.client_id,
        name: row.client_name,
        email: row.client_email,
        contactNumber: row.client_contact_number,
        address: row.client_address,
      },
      items: itemsByOrder.get(row.id) ?? [],
    })),
  });
}

export async function POST(request: Request) {
  const auth = await requireAuth();
  if (!auth.ok) {
    return auth.response;
  }
  const body = await request.json().catch(() => null);
  const clientId = Number(body?.clientId);
  const invoiceDate = String(body?.invoiceDate ?? "").trim();
  const paymentType = String(body?.paymentType ?? "").toLowerCase();
  const statusRaw = String(body?.status ?? "pending").toLowerCase();
  const status =
    statusRaw === "completed" || statusRaw === "cancelled" ? statusRaw : "pending";
  const invoiceNumberRaw = toOptionalTrimmedString(body?.invoiceNumber);
  const notes = toOptionalTrimmedString(body?.notes);

  if (!Number.isInteger(clientId) || clientId < 1) {
    return NextResponse.json({ message: "Valid client is required." }, { status: 400 });
  }
  if (!invoiceDate || !isValidDate(invoiceDate)) {
    return NextResponse.json(
      { message: "Invoice date is required (YYYY-MM-DD)." },
      { status: 400 },
    );
  }
  if (paymentType !== "credit" && paymentType !== "cash") {
    return NextResponse.json(
      { message: "Payment type must be credit or cash." },
      { status: 400 },
    );
  }

  const rawItems = Array.isArray(body?.items) ? body.items : [];
  if (rawItems.length === 0) {
    return NextResponse.json(
      { message: "At least one invoice item is required." },
      { status: 400 },
    );
  }

  const items: CreateItemInput[] = [];
  for (const [index, item] of rawItems.entries()) {
    const productName = String((item as { productName?: unknown })?.productName ?? "").trim();
    const bottleTypeRaw = (item as { bottleType?: unknown })?.bottleType;
    const bottleType =
      bottleTypeRaw === "mix" || bottleTypeRaw === "pure" ? bottleTypeRaw : null;
    const quantity = parseNonNegativeNumber((item as { quantity?: unknown })?.quantity);
    const unitPrice = parseNonNegativeNumber((item as { unitPrice?: unknown })?.unitPrice);

    if (!productName) {
      return NextResponse.json(
        { message: `Item ${index + 1}: product name is required.` },
        { status: 400 },
      );
    }
    if (quantity === null || quantity <= 0) {
      return NextResponse.json(
        { message: `Item ${index + 1}: quantity must be greater than zero.` },
        { status: 400 },
      );
    }
    if (unitPrice === null || unitPrice < 0) {
      return NextResponse.json(
        { message: `Item ${index + 1}: unit price must be zero or positive.` },
        { status: 400 },
      );
    }

    items.push({ productName, bottleType, quantity, unitPrice });
  }

  try {
    const created = await withTransaction(async (conn: PoolConnection) => {
      const [clients] = await conn.query<ClientRow[]>(
        "SELECT id FROM clients WHERE id = ? LIMIT 1",
        [clientId],
      );
      if (clients.length === 0) {
        throw new Error("Client not found.");
      }

      const invoiceNumber = invoiceNumberRaw ?? (await generateInvoiceNumber(conn, invoiceDate));
      const [invoiceExists] = await conn.query<DbRow[]>(
        "SELECT id FROM orders WHERE invoice_number = ? LIMIT 1",
        [invoiceNumber],
      );
      if (invoiceExists.length > 0) {
        throw new Error("Invoice number already exists. Try another value.");
      }

      const totalAmount = items.reduce((sum, item) => sum + item.quantity * item.unitPrice, 0);
      const [orderResult] = await conn.execute<ResultSetHeader>(
        `INSERT INTO orders
         (client_id, order_date, total_amount, status, payment_type, invoice_number, notes, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, NOW(), NOW())`,
        [clientId, invoiceDate, totalAmount, status, paymentType, invoiceNumber, notes],
      );

      for (const [sortOrder, item] of items.entries()) {
        const totalPrice = item.quantity * item.unitPrice;
        await conn.execute<ResultSetHeader>(
          `INSERT INTO order_items
           (order_id, product_name, bottle_type, quantity, unit_price, total_price, sort_order)
           VALUES (?, ?, ?, ?, ?, ?, ?)`,
          [
            orderResult.insertId,
            item.productName,
            item.bottleType,
            item.quantity,
            item.unitPrice,
            totalPrice,
            sortOrder + 1,
          ],
        );
      }

      return { id: orderResult.insertId, invoiceNumber, totalAmount };
    });

    return NextResponse.json(
      {
        message: "Invoice generated successfully.",
        id: created.id,
        invoiceNumber: created.invoiceNumber,
        totalAmount: created.totalAmount,
      },
      { status: 201 },
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unable to generate invoice.";
    return NextResponse.json({ message }, { status: 400 });
  }
}
