import { requireAuth } from "@/lib/auth";
import { dbQuery, type DbRow } from "@/lib/db";
import { NextResponse } from "next/server";

type OrderLedgerRow = DbRow & {
  id: number;
  client_id: number;
  client_name: string;
  invoice_number: string | null;
  order_date: string;
  total_amount: string;
  notes: string | null;
};

type PaymentLedgerRow = DbRow & {
  id: number;
  client_id: number;
  client_name: string;
  order_id: number | null;
  invoice_number: string | null;
  payment_date: string;
  amount_paid: string;
  payment_method: string;
  reference_note: string | null;
};

type LedgerEntry = {
  id: string;
  clientId: number;
  clientName: string;
  entryDate: string;
  referenceType: "order" | "payment";
  referenceId: number;
  invoiceNumber: string | null;
  paymentMethod: string | null;
  debit: number;
  credit: number;
  balance: number;
  notes: string | null;
};

export async function GET() {
  const auth = await requireAuth();
  if (!auth.ok) {
    return auth.response;
  }

  const [orders] = await dbQuery<OrderLedgerRow[]>(
    `SELECT
       o.id,
       o.client_id,
       c.name AS client_name,
       o.invoice_number,
       o.order_date,
       o.total_amount,
       o.notes
     FROM orders o
     INNER JOIN clients c ON c.id = o.client_id
     WHERE o.status <> 'cancelled'
     ORDER BY o.order_date ASC, o.id ASC`,
  );

  const [payments] = await dbQuery<PaymentLedgerRow[]>(
    `SELECT
       p.id,
       p.client_id,
       c.name AS client_name,
       p.order_id,
       o.invoice_number,
       p.payment_date,
       p.amount_paid,
       p.payment_method,
       p.reference_note
     FROM payments p
     INNER JOIN clients c ON c.id = p.client_id
     LEFT JOIN orders o ON o.id = p.order_id
     ORDER BY p.payment_date ASC, p.id ASC`,
  );

  const events: Array<Omit<LedgerEntry, "balance">> = [
    ...orders.map((order) => ({
      id: `order-${order.id}`,
      clientId: order.client_id,
      clientName: order.client_name,
      entryDate: order.order_date,
      referenceType: "order" as const,
      referenceId: order.id,
      invoiceNumber: order.invoice_number,
      paymentMethod: null,
      debit: Number(order.total_amount),
      credit: 0,
      notes: order.notes,
    })),
    ...payments.map((payment) => ({
      id: `payment-${payment.id}`,
      clientId: payment.client_id,
      clientName: payment.client_name,
      entryDate: payment.payment_date,
      referenceType: "payment" as const,
      referenceId: payment.id,
      invoiceNumber: payment.invoice_number,
      paymentMethod: payment.payment_method,
      debit: 0,
      credit: Number(payment.amount_paid),
      notes: payment.reference_note,
    })),
  ];

  events.sort((a, b) => {
    const byClient = a.clientId - b.clientId;
    if (byClient !== 0) {
      return byClient;
    }
    const byDate = a.entryDate.localeCompare(b.entryDate);
    if (byDate !== 0) {
      return byDate;
    }
    if (a.referenceType !== b.referenceType) {
      return a.referenceType === "order" ? -1 : 1;
    }
    return a.referenceId - b.referenceId;
  });

  const runningByClient = new Map<number, number>();
  const entries: LedgerEntry[] = events.map((event) => {
    const previous = runningByClient.get(event.clientId) ?? 0;
    const balance = previous + event.debit - event.credit;
    runningByClient.set(event.clientId, balance);
    return { ...event, balance };
  });

  const summary = entries.reduce(
    (acc, entry) => {
      acc.totalDebit += entry.debit;
      acc.totalCredit += entry.credit;
      return acc;
    },
    { totalDebit: 0, totalCredit: 0 },
  );
  const closingBalance = summary.totalDebit - summary.totalCredit;

  return NextResponse.json({
    summary: {
      totalDebit: summary.totalDebit,
      totalCredit: summary.totalCredit,
      closingBalance,
    },
    clients: Array.from(
      entries.reduce((map, entry) => {
        if (!map.has(entry.clientId)) {
          map.set(entry.clientId, entry.clientName);
        }
        return map;
      }, new Map<number, string>()),
    ).map(([id, name]) => ({ id, name })),
    entries,
  });
}
