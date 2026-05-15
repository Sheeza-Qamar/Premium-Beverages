import { requireAuth } from "@/lib/auth";
import { dbQuery, type DbRow, withTransaction } from "@/lib/db";
import { generateInvoiceNumber } from "@/lib/invoice-number";
import { ensureOrdersSchema } from "@/lib/orders-schema";
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
  bottle_size: string | null;
  quantity: string;
  unit_price: string;
  total_price: string;
  sort_order: number;
};

type ClientRow = DbRow & { id: number };

type CreateItemInput = {
  productName: string;
  bottleType: "mix" | "pure" | null;
  bottleSize: string | null;
  quantity: number;
  unitPrice: number;
};

function isValidDate(value: string) {
  return /^\d{4}-\d{2}-\d{2}$/.test(value);
}

export async function GET() {
  const auth = await requireAuth();
  if (!auth.ok) {
    return auth.response;
  }
  await ensureOrdersSchema();
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
    bottleSize: string | null;
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
         bottle_size,
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
        bottleSize: item.bottle_size ? String(item.bottle_size).trim() : null,
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
      bottleSize: string | null;
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
  await ensureOrdersSchema();
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
    const bottleSizeRaw = toOptionalTrimmedString(
      (item as { bottleSize?: unknown })?.bottleSize,
    );
    const bottleSize = bottleSizeRaw && bottleSizeRaw.length > 0 ? bottleSizeRaw : null;
    const quantity = parseNonNegativeNumber((item as { quantity?: unknown })?.quantity);
    const unitPrice = parseNonNegativeNumber((item as { unitPrice?: unknown })?.unitPrice);

    if (!productName) {
      return NextResponse.json(
        { message: `Item ${index + 1}: product name is required.` },
        { status: 400 },
      );
    }
    if (!bottleSize || bottleSize.length > 80) {
      return NextResponse.json(
        {
          message: !bottleSize
            ? `Item ${index + 1}: bottle size is required.`
            : `Item ${index + 1}: bottle size must be 80 characters or less.`,
        },
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

    items.push({ productName, bottleType, bottleSize, quantity, unitPrice });
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
           (order_id, product_name, bottle_type, bottle_size, quantity, unit_price, total_price, sort_order)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
          [
            orderResult.insertId,
            item.productName,
            item.bottleType,
            item.bottleSize,
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
