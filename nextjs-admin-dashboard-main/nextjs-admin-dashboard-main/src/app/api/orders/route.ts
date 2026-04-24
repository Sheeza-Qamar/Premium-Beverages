import { requireAuth } from "@/lib/auth";
import { dbQuery, type DbRow, withTransaction } from "@/lib/db";
import { parseNonNegativeNumber, toOptionalTrimmedString } from "@/lib/validation";
import type { PoolConnection, ResultSetHeader } from "mysql2/promise";
import { NextResponse } from "next/server";

type OrderRow = DbRow & {
  id: number;
  client_id: number;
  client_name: string;
  order_date: string;
  total_amount: string;
  status: "pending" | "completed" | "cancelled";
  payment_type: "credit" | "cash";
  invoice_number: string | null;
  notes: string | null;
  created_at: string;
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

export async function GET() {
  const auth = await requireAuth();
  if (!auth.ok) {
    return auth.response;
  }
  const [orders] = await dbQuery<OrderRow[]>(
    `SELECT
       o.id,
       o.client_id,
       c.name AS client_name,
       o.order_date,
       o.total_amount,
       o.status,
       o.payment_type,
       o.invoice_number,
       o.notes,
       o.created_at
     FROM orders o
     INNER JOIN clients c ON c.id = o.client_id
     ORDER BY o.order_date DESC, o.id DESC
     LIMIT 100`,
  );

  const orderIds = orders.map((o) => o.id);
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

    itemsByOrder = items.reduce((map, row) => {
      const list = map.get(row.order_id) ?? [];
      list.push({
        id: row.id,
        productName: row.product_name,
        bottleType: row.bottle_type,
        quantity: Number(row.quantity),
        unitPrice: Number(row.unit_price),
        totalPrice: Number(row.total_price),
        sortOrder: row.sort_order,
      });
      map.set(row.order_id, list);
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
    orders: orders.map((o) => ({
      id: o.id,
      clientId: o.client_id,
      clientName: o.client_name,
      orderDate: o.order_date,
      totalAmount: Number(o.total_amount),
      status: o.status,
      paymentType: o.payment_type,
      invoiceNumber: o.invoice_number,
      notes: o.notes,
      createdAt: o.created_at,
      items: itemsByOrder.get(o.id) ?? [],
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
  const orderDate = String(body?.orderDate ?? "").trim();
  const paymentType = String(body?.paymentType ?? "").toLowerCase();
  const statusRaw = String(body?.status ?? "pending").toLowerCase();
  const status =
    statusRaw === "completed" || statusRaw === "cancelled" ? statusRaw : "pending";
  const invoiceNumber =
    body?.invoiceNumber === undefined || body?.invoiceNumber === null
      ? null
      : toOptionalTrimmedString(body.invoiceNumber);
  const notes =
    body?.notes === undefined || body?.notes === null
      ? null
      : toOptionalTrimmedString(body.notes);

  if (!Number.isInteger(clientId) || clientId < 1) {
    return NextResponse.json({ message: "Valid client is required." }, { status: 400 });
  }
  if (!orderDate || !isValidDate(orderDate)) {
    return NextResponse.json(
      { message: "Order date is required (YYYY-MM-DD)." },
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
      { message: "At least one order item is required." },
      { status: 400 },
    );
  }

  const items: CreateItemInput[] = [];
  for (const [index, item] of rawItems.entries()) {
    const productName = String((item as { productName?: unknown })?.productName ?? "").trim();
    const bottleTypeRaw = (item as { bottleType?: unknown })?.bottleType;
    const bottleType =
      bottleTypeRaw === "mix" || bottleTypeRaw === "pure"
        ? bottleTypeRaw
        : null;
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

      const [exists] = await conn.query<DbRow[]>(
        "SELECT id FROM orders WHERE invoice_number = ? LIMIT 1",
        [invoiceNumber],
      );
      if (invoiceNumber && exists.length > 0) {
        throw new Error("Invoice number already exists.");
      }

      const totalAmount = items.reduce(
        (sum, item) => sum + item.quantity * item.unitPrice,
        0,
      );

      const [orderResult] = await conn.execute<ResultSetHeader>(
        `INSERT INTO orders
         (client_id, order_date, total_amount, status, payment_type, invoice_number, notes, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, NOW(), NOW())`,
        [clientId, orderDate, totalAmount, status, paymentType, invoiceNumber, notes],
      );
      const orderId = orderResult.insertId;

      for (const [sortOrder, item] of items.entries()) {
        const totalPrice = item.quantity * item.unitPrice;
        await conn.execute<ResultSetHeader>(
          `INSERT INTO order_items
           (order_id, product_name, bottle_type, quantity, unit_price, total_price, sort_order)
           VALUES (?, ?, ?, ?, ?, ?, ?)`,
          [
            orderId,
            item.productName,
            item.bottleType,
            item.quantity,
            item.unitPrice,
            totalPrice,
            sortOrder + 1,
          ],
        );
      }

      return { orderId, totalAmount };
    });

    return NextResponse.json(
      { message: "Order created.", id: created.orderId, totalAmount: created.totalAmount },
      { status: 201 },
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unable to create order.";
    return NextResponse.json({ message }, { status: 400 });
  }
}
