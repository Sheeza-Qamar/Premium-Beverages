"use client";

import { BRAND_LOGO_SRC } from "@/components/logo";
import Image from "next/image";
import QRCode from "qrcode";
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
  const [qrDataUrl, setQrDataUrl] = useState("");

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

  useEffect(() => {
    void (async () => {
      try {
        const href = window.location.href;
        const qr = await QRCode.toDataURL(href, { width: 180, margin: 1 });
        setQrDataUrl(qr);
      } catch {
        setQrDataUrl("");
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
      <section className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-[#041a3a] via-[#0a2f67] to-[#0a1f4d] p-6 text-white shadow-2xl">
        <div className="absolute -right-12 -top-16 h-56 w-56 rounded-full bg-cyan-400/20 blur-3xl" />
        <div className="absolute -bottom-20 -left-12 h-64 w-64 rounded-full bg-blue-500/20 blur-3xl" />
        <div className="relative grid gap-5 md:grid-cols-[1fr_auto]">
          <div>
            <div className="relative mb-3 h-14 w-14 overflow-hidden rounded-full border border-white/35 shadow-lg">
              <Image
                src={BRAND_LOGO_SRC}
                alt="Premium Beverages"
                fill
                className="object-cover"
                sizes="56px"
                priority
              />
            </div>
            <p className="text-xs uppercase tracking-[0.2em] text-cyan-100/90">Membership Card</p>
            <h1 className="mt-2 text-3xl font-semibold tracking-tight">{data.client.name}</h1>
            <p className="mt-1 text-sm text-cyan-100/90">Client ID: {data.client.id}</p>
            <div className="mt-5 grid max-w-xl gap-2 text-sm text-cyan-50/90 sm:grid-cols-2">
              <p>Email: {data.client.email ?? "—"}</p>
              <p>Contact: {data.client.contactNumber ?? "—"}</p>
              <p className="sm:col-span-2">Address: {data.client.address ?? "—"}</p>
            </div>
          </div>

          <div className="rounded-xl bg-white p-3 text-dark shadow-lg">
            {qrDataUrl ? (
              <img
                src={qrDataUrl}
                alt="Membership QR"
                className="h-36 w-36 rounded-md object-contain"
              />
            ) : (
              <div className="flex h-36 w-36 items-center justify-center rounded-md border border-stroke text-xs text-dark-5">
                QR loading...
              </div>
            )}
            <p className="mt-2 text-center text-xs font-medium text-dark-5">Scan to open card</p>
          </div>
        </div>
      </section>

      <section className="rounded-[10px] border border-stroke bg-white p-6 shadow-1 dark:border-dark-3 dark:bg-gray-dark">
        <h2 className="text-xl font-semibold text-dark dark:text-white">Account overview</h2>
        <div className="mt-4 grid gap-3 md:grid-cols-2">
          <p>Joined: {new Date(data.client.createdAt).toLocaleDateString()}</p>
          <p>Membership status: Active</p>
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
