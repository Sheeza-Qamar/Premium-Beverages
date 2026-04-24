"use client";

import { useEffect, useState } from "react";

type ClientCardPayload = {
  client: {
    id: number;
    name: string;
    email: string | null;
    contactNumber: string | null;
    address: string | null;
    createdAt: string;
  };
  summary: {
    totalDebit: number;
    totalCredit: number;
    remainingBalance: number;
    totalOrders: number;
    totalPayments: number;
  };
  labels: Array<{
    id: number;
    labelName: string;
    quantityAvailable: number;
  }>;
  orders: Array<{
    id: number;
    invoiceNumber: string | null;
    orderDate: string;
    totalAmount: number;
    status: "pending" | "completed" | "cancelled";
    paymentType: "credit" | "cash";
    recoveredAmount: number;
    pendingAmount: number;
  }>;
  payments: Array<{
    id: number;
    amountPaid: number;
    paymentDate: string;
    paymentMethod: string;
    referenceNote: string | null;
    invoiceNumber: string | null;
  }>;
};

export function ClientCardView({ token }: { token: string }) {
  const [data, setData] = useState<ClientCardPayload | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    void (async () => {
      setLoading(true);
      setError("");
      try {
        const response = await fetch(`/api/client-card/${token}`, { cache: "no-store" });
        if (!response.ok) {
          const payload = (await response.json().catch(() => null)) as { message?: string } | null;
          throw new Error(payload?.message ?? "Unable to open client card.");
        }
        const payload = (await response.json()) as ClientCardPayload;
        setData(payload);
      } catch (fetchError) {
        setError(fetchError instanceof Error ? fetchError.message : "Unable to open client card.");
      } finally {
        setLoading(false);
      }
    })();
  }, [token]);

  if (loading) {
    return <main className="mx-auto max-w-6xl p-6">Loading client card...</main>;
  }

  if (!data) {
    return (
      <main className="mx-auto max-w-6xl p-6">
        <p className="text-red">{error || "Client card unavailable."}</p>
      </main>
    );
  }

  return (
    <main className="mx-auto max-w-6xl space-y-6 p-6">
      <section className="rounded-[10px] border border-stroke bg-white p-6 shadow-1 dark:border-dark-3 dark:bg-gray-dark">
        <h1 className="text-2xl font-semibold text-dark dark:text-white">{data.client.name}</h1>
        <p className="mt-1 text-sm text-dark-5 dark:text-dark-6">Client Membership Card</p>
        <div className="mt-4 grid gap-3 md:grid-cols-2">
          <p>Email: {data.client.email ?? "—"}</p>
          <p>Contact: {data.client.contactNumber ?? "—"}</p>
          <p className="md:col-span-2">Address: {data.client.address ?? "—"}</p>
          <p>Joined: {new Date(data.client.createdAt).toLocaleDateString()}</p>
          <p>Client ID: {data.client.id}</p>
        </div>
      </section>

      <section className="rounded-[10px] border border-stroke bg-white p-6 shadow-1 dark:border-dark-3 dark:bg-gray-dark">
        <h2 className="text-lg font-semibold text-dark dark:text-white">Label inventory</h2>
        <div className="mt-4 overflow-x-auto">
          <table className="w-full min-w-[500px] border-collapse text-sm">
            <thead>
              <tr className="border-b border-stroke text-left dark:border-dark-3">
                <th className="px-3 py-2">Label</th>
                <th className="px-3 py-2">Quantity</th>
              </tr>
            </thead>
            <tbody>
              {data.labels.map((label) => (
                <tr key={label.id} className="border-b border-stroke dark:border-dark-3">
                  <td className="px-3 py-3">{label.labelName}</td>
                  <td className="px-3 py-3">{label.quantityAvailable.toFixed(2)}</td>
                </tr>
              ))}
            </tbody>
          </table>
          {data.labels.length === 0 ? (
            <p className="mt-4 text-sm text-dark-5 dark:text-dark-6">No labels configured.</p>
          ) : null}
        </div>
      </section>

      <section className="grid gap-4 md:grid-cols-5">
        <MetricCard label="Total debit" value={data.summary.totalDebit} />
        <MetricCard label="Total credit" value={data.summary.totalCredit} tone="success" />
        <MetricCard label="Remaining" value={data.summary.remainingBalance} tone="danger" />
        <MetricCard label="Orders" value={data.summary.totalOrders} isCount />
        <MetricCard label="Payments" value={data.summary.totalPayments} isCount />
      </section>

      <section className="rounded-[10px] border border-stroke bg-white p-6 shadow-1 dark:border-dark-3 dark:bg-gray-dark">
        <h2 className="text-lg font-semibold text-dark dark:text-white">Order history</h2>
        <div className="mt-4 overflow-x-auto">
          <table className="w-full min-w-[900px] border-collapse text-sm">
            <thead>
              <tr className="border-b border-stroke text-left dark:border-dark-3">
                <th className="px-3 py-2">Date</th>
                <th className="px-3 py-2">Invoice</th>
                <th className="px-3 py-2">Status</th>
                <th className="px-3 py-2">Payment</th>
                <th className="px-3 py-2">Total</th>
                <th className="px-3 py-2">Credit</th>
                <th className="px-3 py-2">Pending</th>
              </tr>
            </thead>
            <tbody>
              {data.orders.map((order) => (
                <tr key={order.id} className="border-b border-stroke dark:border-dark-3">
                  <td className="px-3 py-3 whitespace-nowrap">{order.orderDate}</td>
                  <td className="px-3 py-3">{order.invoiceNumber ?? `Order #${order.id}`}</td>
                  <td className="px-3 py-3 capitalize">{order.status}</td>
                  <td className="px-3 py-3 capitalize">{order.paymentType}</td>
                  <td className="px-3 py-3">{order.totalAmount.toFixed(2)}</td>
                  <td className="px-3 py-3 text-green-600 dark:text-green-400">
                    {order.recoveredAmount.toFixed(2)}
                  </td>
                  <td className="px-3 py-3 text-red">{order.pendingAmount.toFixed(2)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section className="rounded-[10px] border border-stroke bg-white p-6 shadow-1 dark:border-dark-3 dark:bg-gray-dark">
        <h2 className="text-lg font-semibold text-dark dark:text-white">Payments history</h2>
        <div className="mt-4 overflow-x-auto">
          <table className="w-full min-w-[800px] border-collapse text-sm">
            <thead>
              <tr className="border-b border-stroke text-left dark:border-dark-3">
                <th className="px-3 py-2">Date</th>
                <th className="px-3 py-2">Invoice</th>
                <th className="px-3 py-2">Method</th>
                <th className="px-3 py-2">Reference</th>
                <th className="px-3 py-2">Amount</th>
              </tr>
            </thead>
            <tbody>
              {data.payments.map((payment) => (
                <tr key={payment.id} className="border-b border-stroke dark:border-dark-3">
                  <td className="px-3 py-3 whitespace-nowrap">{payment.paymentDate}</td>
                  <td className="px-3 py-3">{payment.invoiceNumber ?? "—"}</td>
                  <td className="px-3 py-3">{payment.paymentMethod}</td>
                  <td className="px-3 py-3">{payment.referenceNote ?? "—"}</td>
                  <td className="px-3 py-3">{payment.amountPaid.toFixed(2)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </main>
  );
}

function MetricCard({
  label,
  value,
  tone = "default",
  isCount = false,
}: {
  label: string;
  value: number;
  tone?: "default" | "success" | "danger";
  isCount?: boolean;
}) {
  const toneClass =
    tone === "success" ? "text-green-600 dark:text-green-400" : tone === "danger" ? "text-red" : "text-dark dark:text-white";
  return (
    <div className="rounded-[10px] border border-stroke bg-white p-4 shadow-1 dark:border-dark-3 dark:bg-gray-dark">
      <p className="text-sm text-dark-5 dark:text-dark-6">{label}</p>
      <p className={`mt-2 text-xl font-semibold ${toneClass}`}>
        {isCount ? String(value) : value.toFixed(2)}
      </p>
    </div>
  );
}
