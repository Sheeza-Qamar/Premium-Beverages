import { verifyClientCardToken } from "@/lib/client-card-token";
import { dbQuery, type DbRow } from "@/lib/db";
import { NextResponse } from "next/server";

type ClientRow = DbRow & {
  id: number;
  name: string;
  email: string | null;
  contact_number: string | null;
  address: string | null;
  created_at: string;
};

type LabelRow = DbRow & {
  id: number;
  label_name: string;
  quantity_available: string;
};

type OrderRow = DbRow & {
  id: number;
  invoice_number: string | null;
  order_date: string;
  total_amount: string;
  status: "pending" | "completed" | "cancelled";
  payment_type: "credit" | "cash";
  recovered_amount: string;
  pending_amount: string;
};

type PaymentRow = DbRow & {
  id: number;
  amount_paid: string;
  payment_date: string;
  payment_method: string;
  reference_note: string | null;
  invoice_number: string | null;
};

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ token: string }> },
) {
  const { token } = await params;
  const decoded = verifyClientCardToken(token);
  if (!decoded) {
    return NextResponse.json({ message: "Invalid client card." }, { status: 401 });
  }

  const clientId = decoded.clientId;

  const [clients] = await dbQuery<ClientRow[]>(
    `SELECT id, name, email, contact_number, address, created_at
     FROM clients
     WHERE id = ?
     LIMIT 1`,
    [clientId],
  );
  const client = clients[0];
  if (!client) {
    return NextResponse.json({ message: "Client not found." }, { status: 404 });
  }

  const [labels] = await dbQuery<LabelRow[]>(
    `SELECT id, label_name, quantity_available
     FROM client_labels
     WHERE client_id = ?
     ORDER BY label_name ASC`,
    [clientId],
  );

  const [orders] = await dbQuery<OrderRow[]>(
    `SELECT
       o.id,
       o.invoice_number,
       o.order_date,
       o.total_amount,
       o.status,
       o.payment_type,
       COALESCE(SUM(p.amount_paid), 0) AS recovered_amount,
       GREATEST(o.total_amount - COALESCE(SUM(p.amount_paid), 0), 0) AS pending_amount
     FROM orders o
     LEFT JOIN payments p ON p.order_id = o.id
     WHERE o.client_id = ?
     GROUP BY o.id, o.invoice_number, o.order_date, o.total_amount, o.status, o.payment_type
     ORDER BY o.order_date DESC, o.id DESC`,
    [clientId],
  );

  const [payments] = await dbQuery<PaymentRow[]>(
    `SELECT
       p.id,
       p.amount_paid,
       p.payment_date,
       p.payment_method,
       p.reference_note,
       o.invoice_number
     FROM payments p
     LEFT JOIN orders o ON o.id = p.order_id
     WHERE p.client_id = ?
     ORDER BY p.payment_date DESC, p.id DESC`,
    [clientId],
  );

  const totals = orders.reduce(
    (acc, order) => {
      acc.totalDebit += Number(order.total_amount);
      acc.totalCredit += Number(order.recovered_amount);
      return acc;
    },
    { totalDebit: 0, totalCredit: 0 },
  );
  const remainingBalance = Math.max(totals.totalDebit - totals.totalCredit, 0);

  return NextResponse.json({
    client: {
      id: client.id,
      name: client.name,
      email: client.email,
      contactNumber: client.contact_number,
      address: client.address,
      createdAt: client.created_at,
    },
    summary: {
      totalDebit: totals.totalDebit,
      totalCredit: totals.totalCredit,
      remainingBalance,
      totalOrders: orders.length,
      totalPayments: payments.length,
    },
    labels: labels.map((label) => ({
      id: label.id,
      labelName: label.label_name,
      quantityAvailable: Number(label.quantity_available),
    })),
    orders: orders.map((order) => ({
      id: order.id,
      invoiceNumber: order.invoice_number,
      orderDate: order.order_date,
      totalAmount: Number(order.total_amount),
      status: order.status,
      paymentType: order.payment_type,
      recoveredAmount: Number(order.recovered_amount),
      pendingAmount: Number(order.pending_amount),
    })),
    payments: payments.map((payment) => ({
      id: payment.id,
      amountPaid: Number(payment.amount_paid),
      paymentDate: payment.payment_date,
      paymentMethod: payment.payment_method,
      referenceNote: payment.reference_note,
      invoiceNumber: payment.invoice_number,
    })),
  });
}
