import { requireAuth } from "@/lib/auth";
import { dbExecute, dbQuery, type DbRow, withTransaction } from "@/lib/db";
import { parseNonNegativeNumber, toOptionalTrimmedString } from "@/lib/validation";
import type { PoolConnection } from "mysql2/promise";
import { NextResponse } from "next/server";

type PaymentRow = DbRow & {
  id: number;
  client_id: number;
  client_name: string;
  order_id: number | null;
  invoice_number: string | null;
  amount_paid: string;
  payment_date: string;
  payment_method: string;
  reference_note: string | null;
  created_at: string;
};

type ReceivableRow = DbRow & {
  order_id: number;
  client_id: number;
  client_name: string;
  invoice_number: string | null;
  order_date: string;
  total_amount: string;
  recovered_amount: string;
  pending_amount: string;
};

type OrderCheckRow = DbRow & {
  id: number;
  client_id: number;
  total_amount: string;
  status: "pending" | "completed" | "cancelled";
  invoice_number: string | null;
};

function isValidDate(value: string) {
  return /^\d{4}-\d{2}-\d{2}$/.test(value);
}

export async function GET() {
  const auth = await requireAuth();
  if (!auth.ok) {
    return auth.response;
  }

  const [payments] = await dbQuery<PaymentRow[]>(
    `SELECT
       p.id,
       p.client_id,
       c.name AS client_name,
       p.order_id,
       o.invoice_number,
       p.amount_paid,
       p.payment_date,
       p.payment_method,
       p.reference_note,
       p.created_at
     FROM payments p
     INNER JOIN clients c ON c.id = p.client_id
     LEFT JOIN orders o ON o.id = p.order_id
     ORDER BY p.payment_date DESC, p.id DESC
     LIMIT 200`,
  );

  const [receivables] = await dbQuery<ReceivableRow[]>(
    `SELECT
       o.id AS order_id,
       o.client_id,
       c.name AS client_name,
       o.invoice_number,
       o.order_date,
       o.total_amount,
       COALESCE(SUM(p.amount_paid), 0) AS recovered_amount,
       GREATEST(o.total_amount - COALESCE(SUM(p.amount_paid), 0), 0) AS pending_amount
     FROM orders o
     INNER JOIN clients c ON c.id = o.client_id
     LEFT JOIN payments p ON p.order_id = o.id
     WHERE o.status <> 'cancelled'
       AND o.invoice_number IS NOT NULL
     GROUP BY o.id, o.client_id, c.name, o.invoice_number, o.order_date, o.total_amount
     ORDER BY o.order_date DESC, o.id DESC`,
  );

  const summary = receivables.reduce(
    (acc, row) => {
      acc.totalReceivable += Number(row.total_amount);
      acc.recoveredAmount += Number(row.recovered_amount);
      acc.pendingAmount += Number(row.pending_amount);
      return acc;
    },
    { totalReceivable: 0, recoveredAmount: 0, pendingAmount: 0 },
  );

  return NextResponse.json({
    summary,
    receivables: receivables.map((row) => ({
      orderId: row.order_id,
      clientId: row.client_id,
      clientName: row.client_name,
      invoiceNumber: row.invoice_number,
      orderDate: row.order_date,
      totalAmount: Number(row.total_amount),
      recoveredAmount: Number(row.recovered_amount),
      pendingAmount: Number(row.pending_amount),
    })),
    payments: payments.map((row) => ({
      id: row.id,
      clientId: row.client_id,
      clientName: row.client_name,
      orderId: row.order_id,
      invoiceNumber: row.invoice_number,
      amountPaid: Number(row.amount_paid),
      paymentDate: row.payment_date,
      paymentMethod: row.payment_method,
      referenceNote: row.reference_note,
      createdAt: row.created_at,
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
  const orderId = Number(body?.orderId);
  const amountPaid = parseNonNegativeNumber(body?.amountPaid);
  const paymentDate = String(body?.paymentDate ?? "").trim();
  const paymentMethod = toOptionalTrimmedString(body?.paymentMethod) ?? "cash";
  const referenceNote = toOptionalTrimmedString(body?.referenceNote);

  if (!Number.isInteger(clientId) || clientId < 1) {
    return NextResponse.json({ message: "Valid client is required." }, { status: 400 });
  }
  if (!Number.isInteger(orderId) || orderId < 1) {
    return NextResponse.json({ message: "Valid order is required." }, { status: 400 });
  }
  if (amountPaid === null || amountPaid <= 0) {
    return NextResponse.json({ message: "Payment amount must be greater than zero." }, { status: 400 });
  }
  if (!paymentDate || !isValidDate(paymentDate)) {
    return NextResponse.json(
      { message: "Payment date is required (YYYY-MM-DD)." },
      { status: 400 },
    );
  }

  try {
    const created = await withTransaction(async (conn: PoolConnection) => {
      const [orders] = await conn.query<OrderCheckRow[]>(
        `SELECT id, client_id, total_amount, status, invoice_number
         FROM orders
         WHERE id = ?
         LIMIT 1`,
        [orderId],
      );
      if (orders.length === 0) {
        throw new Error("Order not found.");
      }
      const order = orders[0];
      if (order.client_id !== clientId) {
        throw new Error("Selected order does not belong to selected client.");
      }
      if (order.status === "cancelled") {
        throw new Error("Cannot record payment for cancelled order.");
      }
      if (!order.invoice_number) {
        throw new Error("Order has no invoice number.");
      }

      const [paidRows] = await conn.query<(DbRow & { paid: string })[]>(
        "SELECT COALESCE(SUM(amount_paid), 0) AS paid FROM payments WHERE order_id = ?",
        [orderId],
      );
      const alreadyRecovered = Number(paidRows[0]?.paid ?? 0);
      const totalAmount = Number(order.total_amount);
      const outstandingBefore = Math.max(totalAmount - alreadyRecovered, 0);

      if (outstandingBefore <= 0) {
        throw new Error("Order is already fully recovered.");
      }
      if (amountPaid > outstandingBefore) {
        throw new Error(`Payment exceeds outstanding amount (${outstandingBefore.toFixed(2)}).`);
      }

      const [result] = await conn.execute(
        `INSERT INTO payments
         (client_id, order_id, amount_paid, payment_date, payment_method, reference_note, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, NOW(), NOW())`,
        [clientId, orderId, amountPaid, paymentDate, paymentMethod, referenceNote],
      );

      const outstandingAfter = Math.max(outstandingBefore - amountPaid, 0);

      return {
        paymentId: (result as { insertId: number }).insertId,
        invoiceNumber: order.invoice_number,
        outstandingAfter,
      };
    });

    return NextResponse.json(
      {
        message: "Payment recorded successfully.",
        id: created.paymentId,
        invoiceNumber: created.invoiceNumber,
        outstandingAfter: created.outstandingAfter,
      },
      { status: 201 },
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unable to record payment.";
    return NextResponse.json({ message }, { status: 400 });
  }
}
