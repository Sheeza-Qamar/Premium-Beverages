import { requireAuth } from "@/lib/auth";
import { dbQuery, type DbRow, withTransaction } from "@/lib/db";
import { generateInvoiceNumber } from "@/lib/invoice-number";
import { ensureOrdersSchema } from "@/lib/orders-schema";
import { ensureProductionSchema } from "@/lib/production-schema";
import { parseNonNegativeNumber, toOptionalTrimmedString } from "@/lib/validation";
import type { PoolConnection, ResultSetHeader } from "mysql2/promise";
import { NextResponse } from "next/server";

type OrderListRow = DbRow & {
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
  paid_amount: string;
  outstanding_amount: string;
  ordered_qty: string;
  produced_qty: string;
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

function toNumber(v: string | null | undefined) {
  const n = Number(v ?? 0);
  return Number.isFinite(n) ? n : 0;
}

export async function GET(request: Request) {
  const auth = await requireAuth();
  if (!auth.ok) {
    return auth.response;
  }
  await ensureProductionSchema();
  await ensureOrdersSchema();

  const url = new URL(request.url);
  const clientFilter = url.searchParams.get("clientId");
  const searchQ = url.searchParams.get("q");

  let clientIdFilter: number | null = null;
  if (clientFilter !== null && clientFilter !== "") {
    const n = Number(clientFilter);
    if (Number.isInteger(n) && n > 0) {
      clientIdFilter = n;
    }
  }

  const whereParts: string[] = [];
  const queryParams: Array<string | number> = [];

  if (clientIdFilter !== null) {
    whereParts.push("o.client_id = ?");
    queryParams.push(clientIdFilter);
  }

  const qTrim = searchQ?.trim() ?? "";
  if (qTrim.length > 0) {
    const like = `%${qTrim}%`;
    whereParts.push(
      `(o.invoice_number LIKE ? OR c.name LIKE ? OR CAST(o.id AS CHAR) LIKE ? OR EXISTS (
        SELECT 1 FROM order_items oi WHERE oi.order_id = o.id AND oi.product_name LIKE ?
      ))`,
    );
    queryParams.push(like, like, like, like);
  }

  const whereSql = whereParts.length > 0 ? `WHERE ${whereParts.join(" AND ")}` : "";

  const [orders] = await dbQuery<OrderListRow[]>(
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
       o.created_at,
       COALESCE(pay.paid, 0) AS paid_amount,
       GREATEST(o.total_amount - COALESCE(pay.paid, 0), 0) AS outstanding_amount,
       COALESCE(oiq.items_qty, 0) AS ordered_qty,
       COALESCE(prq.produced_qty, 0) AS produced_qty
     FROM orders o
     INNER JOIN clients c ON c.id = o.client_id
     LEFT JOIN (
       SELECT order_id, SUM(amount_paid) AS paid
       FROM payments
       GROUP BY order_id
     ) pay ON pay.order_id = o.id
     LEFT JOIN (
       SELECT order_id, SUM(quantity) AS items_qty
       FROM order_items
       GROUP BY order_id
     ) oiq ON oiq.order_id = o.id
     LEFT JOIN (
       SELECT order_id, SUM(quantity_produced) AS produced_qty
       FROM production
       GROUP BY order_id
     ) prq ON prq.order_id = o.id
     ${whereSql}
     ORDER BY o.order_date DESC, o.id DESC
     LIMIT 100`,
    queryParams,
  );

  const orderIds = orders.map((o) => o.id);
  let itemsByOrder = new Map<
    number,
    Array<{
      id: number;
      productName: string;
      bottleType: "mix" | "pure" | null;
      bottleSize: string | null;
      quantity: number;
      unitPrice: number;
      totalPrice: number;
      sortOrder: number;
    }>
  >();
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

    itemsByOrder = items.reduce((map, row) => {
      const list = map.get(row.order_id) ?? [];
      list.push({
        id: row.id,
        productName: row.product_name,
        bottleType: row.bottle_type,
        bottleSize: row.bottle_size ? String(row.bottle_size).trim() : null,
        quantity: Number(row.quantity),
        unitPrice: Number(row.unit_price),
        totalPrice: Number(row.total_price),
        sortOrder: row.sort_order,
      });
      map.set(row.order_id, list);
      return map;
    }, new Map());
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
      paidAmount: toNumber(o.paid_amount),
      outstandingAmount: toNumber(o.outstanding_amount),
      orderedQty: toNumber(o.ordered_qty),
      producedQty: toNumber(o.produced_qty),
      items: itemsByOrder.get(o.id) ?? [],
    })),
  });
}

export async function POST(request: Request) {
  const auth = await requireAuth();
  if (!auth.ok) {
    return auth.response;
  }
  await ensureProductionSchema();
  await ensureOrdersSchema();

  const body = await request.json().catch(() => null);
  const clientId = Number(body?.clientId);
  const orderDate = String(body?.orderDate ?? "").trim();
  const paymentType = String(body?.paymentType ?? "").toLowerCase();
  const statusRaw = String(body?.status ?? "pending").toLowerCase();
  const status =
    statusRaw === "completed" || statusRaw === "cancelled" ? statusRaw : "pending";
  let invoiceNumber =
    body?.invoiceNumber === undefined || body?.invoiceNumber === null
      ? null
      : toOptionalTrimmedString(body.invoiceNumber);
  const notes =
    body?.notes === undefined || body?.notes === null
      ? null
      : toOptionalTrimmedString(body.notes);

  const advancePaymentAmount = parseNonNegativeNumber(body?.advancePaymentAmount);
  const advancePaymentDateRaw = String(body?.advancePaymentDate ?? "").trim();
  const advancePaymentDate =
    advancePaymentDateRaw && isValidDate(advancePaymentDateRaw)
      ? advancePaymentDateRaw
      : orderDate;
  const advancePaymentMethod =
    toOptionalTrimmedString(body?.advancePaymentMethod) ?? "cash";
  const advancePaymentNote = toOptionalTrimmedString(body?.advancePaymentNote);

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

  const totalAmount = items.reduce((sum, item) => sum + item.quantity * item.unitPrice, 0);

  if (advancePaymentAmount !== null && advancePaymentAmount > 0) {
    if (advancePaymentAmount > totalAmount) {
      return NextResponse.json(
        { message: "Advance payment cannot exceed order total." },
        { status: 400 },
      );
    }
    if (!advancePaymentDate || !isValidDate(advancePaymentDate)) {
      return NextResponse.json(
        { message: "Advance payment date must be YYYY-MM-DD." },
        { status: 400 },
      );
    }
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

      const [labelRows] = await conn.query<DbRow[]>(
        "SELECT label_name FROM client_labels WHERE client_id = ?",
        [clientId],
      );
      const allowedLabelNames = new Set(
        labelRows
          .map((row) => String((row as { label_name: string }).label_name).trim())
          .filter((name) => name.length > 0),
      );
      if (allowedLabelNames.size === 0) {
        throw new Error(
          "This client has no label lines yet. Add labels on the client edit page before creating an order.",
        );
      }

      for (const [index, item] of items.entries()) {
        if (!allowedLabelNames.has(item.productName)) {
          throw new Error(
            `Item ${index + 1}: product must be one of this client's label lines (Clients → edit).`,
          );
        }
      }

      if (!invoiceNumber || invoiceNumber.length === 0) {
        invoiceNumber = await generateInvoiceNumber(conn, orderDate);
      }

      const [exists] = await conn.query<DbRow[]>(
        "SELECT id FROM orders WHERE invoice_number = ? LIMIT 1",
        [invoiceNumber],
      );
      if (exists.length > 0) {
        throw new Error("Invoice number already exists.");
      }

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
           (order_id, product_name, bottle_type, bottle_size, quantity, unit_price, total_price, sort_order)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
          [
            orderId,
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

      let advanceRecorded = 0;
      if (advancePaymentAmount !== null && advancePaymentAmount > 0) {
        await conn.execute<ResultSetHeader>(
          `INSERT INTO payments
           (client_id, order_id, amount_paid, payment_date, payment_method, reference_note, created_at, updated_at)
           VALUES (?, ?, ?, ?, ?, ?, NOW(), NOW())`,
          [
            clientId,
            orderId,
            advancePaymentAmount,
            advancePaymentDate,
            advancePaymentMethod,
            advancePaymentNote,
          ],
        );
        advanceRecorded = advancePaymentAmount;
      }

      return { orderId, totalAmount, invoiceNumber, advanceRecorded };
    });

    return NextResponse.json(
      {
        message:
          created.advanceRecorded > 0
            ? "Order created with advance payment recorded."
            : "Order created.",
        id: created.orderId,
        totalAmount: created.totalAmount,
        invoiceNumber: created.invoiceNumber,
        advanceRecorded: created.advanceRecorded,
      },
      { status: 201 },
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unable to create order.";
    return NextResponse.json({ message }, { status: 400 });
  }
}
