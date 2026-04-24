import { requireAuth } from "@/lib/auth";
import { dbQuery, type DbRow } from "@/lib/db";
import { NextResponse } from "next/server";

type TotalsRow = DbRow & {
  total_stock: string | null;
  total_production: string | null;
  total_sales: string | null;
  total_paid: string | null;
};

type ClientRow = DbRow & {
  id: number;
  name: string;
};

type ClientSummaryRow = DbRow & {
  total_payable: string | null;
  total_paid: string | null;
};

type ClientOrderRow = DbRow & {
  id: number;
  invoice_number: string | null;
  order_date: string;
  total_amount: string;
  status: "pending" | "completed" | "cancelled";
  payment_type: "credit" | "cash";
  recovered_amount: string;
  pending_amount: string;
};

type MonthlySalesRow = DbRow & {
  month_key: string;
  total_sales: string;
};

type MonthlyPaymentsRow = DbRow & {
  month_key: string;
  total_paid: string;
};

type MonthlyExpensesRow = DbRow & {
  month_key: string;
  total_expense: string;
};

type MonthlyProductionRow = DbRow & {
  month_key: string;
  bottle_type: "mix" | "pure";
  total_qty: string;
};

type ReceivableByClientRow = DbRow & {
  client_name: string;
  pending_amount: string;
};

function toNumber(value: string | null | undefined) {
  if (!value) {
    return 0;
  }
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

export async function GET(request: Request) {
  const auth = await requireAuth();
  if (!auth.ok) {
    return auth.response;
  }

  const url = new URL(request.url);
  const requestedClientId = Number(url.searchParams.get("clientId"));

  const [[clients], [totalsRows], [monthlySalesRows], [monthlyPaymentRows], [monthlyExpenseRows], [monthlyProductionRows], [receivableByClientRows]] =
    await Promise.all([
      dbQuery<ClientRow[]>(
        `SELECT id, name
         FROM clients
         ORDER BY name ASC`,
      ),
      dbQuery<TotalsRow[]>(
        `SELECT
           (SELECT COALESCE(SUM(quantity_available), 0) FROM inventory) AS total_stock,
           (SELECT COALESCE(SUM(quantity_produced), 0) FROM production) AS total_production,
           (SELECT COALESCE(SUM(total_amount), 0) FROM orders WHERE status <> 'cancelled') AS total_sales,
           (SELECT COALESCE(SUM(amount_paid), 0) FROM payments) AS total_paid`,
      ),
      dbQuery<MonthlySalesRow[]>(
        `SELECT DATE_FORMAT(order_date, '%Y-%m') AS month_key, COALESCE(SUM(total_amount), 0) AS total_sales
         FROM orders
         WHERE status <> 'cancelled'
         GROUP BY DATE_FORMAT(order_date, '%Y-%m')
         ORDER BY month_key DESC
         LIMIT 12`,
      ),
      dbQuery<MonthlyPaymentsRow[]>(
        `SELECT DATE_FORMAT(payment_date, '%Y-%m') AS month_key, COALESCE(SUM(amount_paid), 0) AS total_paid
         FROM payments
         GROUP BY DATE_FORMAT(payment_date, '%Y-%m')
         ORDER BY month_key DESC
         LIMIT 12`,
      ),
      dbQuery<MonthlyExpensesRow[]>(
        `SELECT DATE_FORMAT(expense_date, '%Y-%m') AS month_key, COALESCE(SUM(amount), 0) AS total_expense
         FROM expenses
         GROUP BY DATE_FORMAT(expense_date, '%Y-%m')
         ORDER BY month_key DESC
         LIMIT 12`,
      ),
      dbQuery<MonthlyProductionRow[]>(
        `SELECT DATE_FORMAT(production_date, '%Y-%m') AS month_key, bottle_type, COALESCE(SUM(quantity_produced), 0) AS total_qty
         FROM production
         GROUP BY DATE_FORMAT(production_date, '%Y-%m'), bottle_type
         ORDER BY month_key DESC
         LIMIT 24`,
      ),
      dbQuery<ReceivableByClientRow[]>(
        `SELECT
           c.name AS client_name,
           SUM(GREATEST(o.total_amount - COALESCE(paid.paid_amount, 0), 0)) AS pending_amount
         FROM orders o
         INNER JOIN clients c ON c.id = o.client_id
         LEFT JOIN (
           SELECT order_id, COALESCE(SUM(amount_paid), 0) AS paid_amount
           FROM payments
           GROUP BY order_id
         ) paid ON paid.order_id = o.id
         WHERE o.status <> 'cancelled'
         GROUP BY c.id, c.name
         HAVING pending_amount > 0
         ORDER BY pending_amount DESC
         LIMIT 8`,
      ),
    ]);
  const totals = totalsRows[0];
  const totalSales = toNumber(totals?.total_sales);
  const recoveredAmount = toNumber(totals?.total_paid);

  const monthSet = new Set<string>();
  for (const row of monthlySalesRows) monthSet.add(row.month_key);
  for (const row of monthlyPaymentRows) monthSet.add(row.month_key);
  for (const row of monthlyExpenseRows) monthSet.add(row.month_key);

  const months = Array.from(monthSet).sort().slice(-6);
  const salesMap = new Map(monthlySalesRows.map((r) => [r.month_key, toNumber(r.total_sales)]));
  const paidMap = new Map(monthlyPaymentRows.map((r) => [r.month_key, toNumber(r.total_paid)]));
  const expenseMap = new Map(monthlyExpenseRows.map((r) => [r.month_key, toNumber(r.total_expense)]));

  const monthlyFinancials = months.map((monthKey) => ({
    monthKey,
    monthLabel: monthKey,
    sales: salesMap.get(monthKey) ?? 0,
    recovered: paidMap.get(monthKey) ?? 0,
    expenses: expenseMap.get(monthKey) ?? 0,
  }));

  const productionMonthSet = new Set(monthlyProductionRows.map((r) => r.month_key));
  const productionMonths = Array.from(productionMonthSet).sort().slice(-6);
  const productionMixMap = new Map<string, number>();
  const productionPureMap = new Map<string, number>();
  for (const row of monthlyProductionRows) {
    const map = row.bottle_type === "mix" ? productionMixMap : productionPureMap;
    map.set(row.month_key, (map.get(row.month_key) ?? 0) + toNumber(row.total_qty));
  }
  const monthlyProduction = productionMonths.map((monthKey) => ({
    monthKey,
    monthLabel: monthKey,
    mix: productionMixMap.get(monthKey) ?? 0,
    pure: productionPureMap.get(monthKey) ?? 0,
  }));

  const validClientId =
    Number.isInteger(requestedClientId) && requestedClientId > 0
      ? requestedClientId
      : clients[0]?.id ?? null;
  const selectedClient = validClientId
    ? clients.find((client) => client.id === validClientId) ?? null
    : null;

  let clientDashboard:
    | {
        clientId: number;
        clientName: string;
        totalPayable: number;
        totalPaid: number;
        remainingBalance: number;
        orderHistory: Array<{
          id: number;
          invoiceNumber: string | null;
          orderDate: string;
          totalAmount: number;
          status: "pending" | "completed" | "cancelled";
          paymentType: "credit" | "cash";
          recoveredAmount: number;
          pendingAmount: number;
        }>;
      }
    | null = null;

  if (selectedClient) {
    const [[clientSummaryRows], [orders]] = await Promise.all([
      dbQuery<ClientSummaryRow[]>(
        `SELECT
           (SELECT COALESCE(SUM(total_amount), 0)
            FROM orders
            WHERE client_id = ? AND status <> 'cancelled') AS total_payable,
           (SELECT COALESCE(SUM(amount_paid), 0)
            FROM payments
            WHERE client_id = ?) AS total_paid`,
        [selectedClient.id, selectedClient.id],
      ),
      dbQuery<ClientOrderRow[]>(
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
         ORDER BY o.order_date DESC, o.id DESC
         LIMIT 100`,
        [selectedClient.id],
      ),
    ]);
    const clientSummary = clientSummaryRows[0];
    const totalPayable = toNumber(clientSummary?.total_payable);
    const totalPaid = toNumber(clientSummary?.total_paid);

    clientDashboard = {
      clientId: selectedClient.id,
      clientName: selectedClient.name,
      totalPayable,
      totalPaid,
      remainingBalance: Math.max(totalPayable - totalPaid, 0),
      orderHistory: orders.map((order) => ({
        id: order.id,
        invoiceNumber: order.invoice_number,
        orderDate: order.order_date,
        totalAmount: toNumber(order.total_amount),
        status: order.status,
        paymentType: order.payment_type,
        recoveredAmount: toNumber(order.recovered_amount),
        pendingAmount: toNumber(order.pending_amount),
      })),
    };
  }

  return NextResponse.json({
    adminDashboard: {
      totalStock: toNumber(totals?.total_stock),
      totalProduction: toNumber(totals?.total_production),
      totalSales,
      totalReceivables: Math.max(totalSales - recoveredAmount, 0),
    },
    clients: clients.map((client) => ({ id: client.id, name: client.name })),
    selectedClientId: selectedClient?.id ?? null,
    clientDashboard,
    charts: {
      monthlyFinancials,
      monthlyProduction,
      receivablesByClient: receivableByClientRows.map((row) => ({
        clientName: row.client_name,
        pendingAmount: toNumber(row.pending_amount),
      })),
    },
  });
}
