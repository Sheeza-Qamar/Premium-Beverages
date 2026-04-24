"use client";

import { BRAND } from "@/lib/brand";
import jsPDF from "jspdf";
import { useEffect, useMemo, useState } from "react";

type Summary = {
  totalReceivable: number;
  recoveredAmount: number;
  pendingAmount: number;
};

type Receivable = {
  orderId: number;
  clientId: number;
  clientName: string;
  invoiceNumber: string | null;
  orderDate: string;
  totalAmount: number;
  recoveredAmount: number;
  pendingAmount: number;
};

type PaymentRecord = {
  id: number;
  clientId: number;
  clientName: string;
  orderId: number | null;
  invoiceNumber: string | null;
  amountPaid: number;
  paymentDate: string;
  paymentMethod: string;
  referenceNote: string | null;
  createdAt: string;
  receiptNumber: string;
};

function formatPkDateTime(value: string) {
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    return value;
  }
  return new Intl.DateTimeFormat("en-PK", {
    timeZone: "Asia/Karachi",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  }).format(parsed);
}

async function loadImageAsDataUrl(path: string): Promise<string | null> {
  try {
    const response = await fetch(path, { cache: "force-cache" });
    if (!response.ok) {
      return null;
    }
    const imageBlob = await response.blob();
    const blobUrl = URL.createObjectURL(imageBlob);
    const image = new Image();
    image.decoding = "async";
    image.src = blobUrl;
    await image.decode();

    const canvas = document.createElement("canvas");
    canvas.width = 420;
    canvas.height = 420;
    const ctx = canvas.getContext("2d");
    if (!ctx) {
      URL.revokeObjectURL(blobUrl);
      return null;
    }
    const size = Math.min(image.naturalWidth || image.width, image.naturalHeight || image.height);
    const sx = ((image.naturalWidth || image.width) - size) / 2;
    const sy = ((image.naturalHeight || image.height) - size) / 2;

    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.beginPath();
    ctx.arc(canvas.width / 2, canvas.height / 2, canvas.width / 2, 0, Math.PI * 2);
    ctx.closePath();
    ctx.clip();
    ctx.drawImage(image, sx, sy, size, size, 0, 0, canvas.width, canvas.height);
    URL.revokeObjectURL(blobUrl);
    return canvas.toDataURL("image/png", 0.92);
  } catch {
    return null;
  }
}

export function PaymentsRecoveryClient() {
  const [summary, setSummary] = useState<Summary>({
    totalReceivable: 0,
    recoveredAmount: 0,
    pendingAmount: 0,
  });
  const [receivables, setReceivables] = useState<Receivable[]>([]);
  const [payments, setPayments] = useState<PaymentRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [successMessage, setSuccessMessage] = useState("");

  const [form, setForm] = useState({
    clientId: "",
    orderId: "",
    amountPaid: "",
    paymentDate: new Date().toISOString().slice(0, 10),
    paymentMethod: "cash",
    referenceNote: "",
  });

  const loadData = async () => {
    const response = await fetch("/api/payments", { cache: "no-store" });
    if (!response.ok) {
      const payload = (await response.json().catch(() => null)) as { message?: string } | null;
      throw new Error(payload?.message ?? "Unable to load payments.");
    }
    const payload = (await response.json()) as {
      summary: Summary;
      receivables: Receivable[];
      payments: PaymentRecord[];
    };
    setSummary(payload.summary);
    setReceivables(payload.receivables);
    setPayments(payload.payments);
  };

  useEffect(() => {
    void (async () => {
      setLoading(true);
      setError("");
      try {
        await loadData();
      } catch (fetchError) {
        setError(fetchError instanceof Error ? fetchError.message : "Unable to load payments.");
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const clientOptions = useMemo(() => {
    const map = new Map<number, string>();
    for (const row of receivables) {
      if (row.pendingAmount > 0 && !map.has(row.clientId)) {
        map.set(row.clientId, row.clientName);
      }
    }
    return Array.from(map.entries()).map(([id, name]) => ({ id, name }));
  }, [receivables]);

  const selectedClientId = Number(form.clientId);
  const receivablesForClient = useMemo(
    () =>
      receivables.filter(
        (row) =>
          row.pendingAmount > 0 &&
          (!Number.isInteger(selectedClientId) || selectedClientId < 1 || row.clientId === selectedClientId),
      ),
    [receivables, selectedClientId],
  );

  const selectedOrder = useMemo(() => {
    const orderId = Number(form.orderId);
    if (!Number.isInteger(orderId) || orderId < 1) {
      return null;
    }
    return receivables.find((row) => row.orderId === orderId) ?? null;
  }, [form.orderId, receivables]);

  const submitPayment = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setSaving(true);
    setError("");
    setSuccessMessage("");

    try {
      const clientId = Number(form.clientId);
      const orderId = Number(form.orderId);
      const amountPaid = Number(form.amountPaid);

      if (!Number.isInteger(clientId) || clientId < 1) {
        throw new Error("Please select a client.");
      }
      if (!Number.isInteger(orderId) || orderId < 1) {
        throw new Error("Please select an order/invoice.");
      }
      if (!Number.isFinite(amountPaid) || amountPaid <= 0) {
        throw new Error("Payment amount must be greater than zero.");
      }

      const response = await fetch("/api/payments", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          clientId,
          orderId,
          amountPaid,
          paymentDate: form.paymentDate,
          paymentMethod: form.paymentMethod,
          referenceNote: form.referenceNote.trim() || null,
        }),
      });

      if (!response.ok) {
        const payload = (await response.json().catch(() => null)) as { message?: string } | null;
        throw new Error(payload?.message ?? "Unable to record payment.");
      }

      const payload = (await response.json()) as {
        message: string;
        invoiceNumber: string;
        receiptNumber: string;
        outstandingAfter: number;
      };

      setSuccessMessage(
        `${payload.message} Receipt ${payload.receiptNumber} generated. Invoice ${payload.invoiceNumber} outstanding: ${payload.outstandingAfter.toFixed(2)}.`,
      );
      setForm((previous) => ({
        ...previous,
        orderId: "",
        amountPaid: "",
        referenceNote: "",
      }));
      await loadData();
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : "Unable to record payment.");
    } finally {
      setSaving(false);
    }
  };

  const downloadPaymentReceiptPdf = async (payment: PaymentRecord) => {
    const doc = new jsPDF({ unit: "pt", format: "a4" });
    const pageWidth = doc.internal.pageSize.getWidth();
    const left = 42;
    const right = pageWidth - 42;

    doc.setDrawColor(228, 231, 236);
    doc.setFillColor(248, 250, 252);
    doc.roundedRect(30, 24, pageWidth - 60, 112, 12, 12, "FD");

    const logoDataUrl =
      (await loadImageAsDataUrl("/images/logo/elegant-premium-beverages-logo.png")) ??
      (await loadImageAsDataUrl("/images/logo/logo.svg"));
    if (logoDataUrl) {
      doc.addImage(logoDataUrl, "PNG", left + 4, 34, 72, 72);
    } else {
      doc.setTextColor(15, 23, 42);
      doc.setFont("helvetica", "bold");
      doc.setFontSize(18);
      doc.text(BRAND.name, left, 62);
    }

    doc.setTextColor(30, 41, 59);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(20);
    doc.text("PAYMENT RECEIPT", right, 54, { align: "right" });

    doc.setFont("helvetica", "normal");
    doc.setFontSize(10);
    doc.setTextColor(71, 85, 105);
    doc.text(`Receipt #: ${payment.receiptNumber}`, right, 74, { align: "right" });
    doc.text(`Issued: ${formatPkDateTime(payment.createdAt)}`, right, 89, { align: "right" });
    doc.text(`Payment Date: ${payment.paymentDate}`, right, 104, { align: "right" });

    doc.setDrawColor(228, 231, 236);
    doc.setFillColor(255, 255, 255);
    doc.roundedRect(left, 152, pageWidth - 84, 154, 8, 8, "FD");
    doc.setFont("helvetica", "bold");
    doc.setFontSize(11);
    doc.setTextColor(15, 23, 42);
    doc.text("Received From", left + 12, 172);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(10.5);
    doc.setTextColor(51, 65, 85);
    doc.text(`Client: ${payment.clientName}`, left + 12, 191);
    doc.text(`Invoice: ${payment.invoiceNumber ?? "N/A"}`, left + 12, 208);
    doc.text(`Payment Method: ${payment.paymentMethod}`, left + 12, 225);
    doc.text(`Reference: ${payment.referenceNote ?? "N/A"}`, left + 12, 242);

    doc.setFillColor(248, 250, 252);
    doc.roundedRect(right - 230, 248, 230, 52, 8, 8, "F");
    doc.setFont("helvetica", "normal");
    doc.setFontSize(10);
    doc.setTextColor(71, 85, 105);
    doc.text("Amount Received", right - 214, 269);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(14);
    doc.setTextColor(15, 23, 42);
    doc.text(payment.amountPaid.toFixed(2), right - 16, 282, { align: "right" });

    doc.setDrawColor(226, 232, 240);
    doc.line(left, 760, right, 760);
    doc.setFont("helvetica", "italic");
    doc.setFontSize(9.5);
    doc.setTextColor(100, 116, 139);
    doc.text("This is a system-generated receipt and can be used as payment proof.", left, 778);
    doc.text("Thank you for your prompt payment.", right, 778, { align: "right" });

    doc.save(`${payment.receiptNumber}.pdf`);
  };

  if (loading) {
    return (
      <div className="rounded-[10px] bg-white p-6 shadow-1 dark:bg-gray-dark dark:shadow-card">
        <p>Loading payments &amp; recovery...</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <section className="grid gap-4 md:grid-cols-3">
        <div className="rounded-[10px] bg-white p-5 shadow-1 dark:bg-gray-dark dark:shadow-card">
          <p className="text-sm text-dark-5 dark:text-dark-6">Total receivable</p>
          <p className="mt-2 text-2xl font-semibold text-dark dark:text-white">
            {summary.totalReceivable.toFixed(2)}
          </p>
        </div>
        <div className="rounded-[10px] bg-white p-5 shadow-1 dark:bg-gray-dark dark:shadow-card">
          <p className="text-sm text-dark-5 dark:text-dark-6">Recovered amount</p>
          <p className="mt-2 text-2xl font-semibold text-green-600 dark:text-green-400">
            {summary.recoveredAmount.toFixed(2)}
          </p>
        </div>
        <div className="rounded-[10px] bg-white p-5 shadow-1 dark:bg-gray-dark dark:shadow-card">
          <p className="text-sm text-dark-5 dark:text-dark-6">Pending amount</p>
          <p className="mt-2 text-2xl font-semibold text-red">{summary.pendingAmount.toFixed(2)}</p>
        </div>
      </section>

      <section className="rounded-[10px] bg-white p-6 shadow-1 dark:bg-gray-dark dark:shadow-card">
        <h2 className="text-xl font-semibold text-dark dark:text-white">Record payment</h2>
        <p className="mt-1 text-sm text-dark-5 dark:text-dark-6">
          Record client payments, link them to invoice orders, and keep outstanding balances updated.
        </p>

        {error ? <p className="mt-3 text-sm text-red">{error}</p> : null}
        {successMessage ? (
          <p className="mt-3 text-sm text-green-600 dark:text-green-400">{successMessage}</p>
        ) : null}

        <form onSubmit={submitPayment} className="mt-4 grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          <select
            className="rounded-lg border border-stroke bg-transparent px-4 py-3 dark:border-dark-3 dark:bg-dark-2"
            value={form.clientId}
            onChange={(event) =>
              setForm((previous) => ({
                ...previous,
                clientId: event.target.value,
                orderId: "",
                amountPaid: "",
              }))
            }
            required
          >
            <option value="">Select client</option>
            {clientOptions.map((client) => (
              <option key={client.id} value={client.id}>
                {client.name}
              </option>
            ))}
          </select>

          <select
            className="rounded-lg border border-stroke bg-transparent px-4 py-3 dark:border-dark-3 dark:bg-dark-2"
            value={form.orderId}
            onChange={(event) => {
              const nextOrderId = event.target.value;
              const nextOrder = receivables.find((row) => String(row.orderId) === nextOrderId);
              setForm((previous) => ({
                ...previous,
                orderId: nextOrderId,
                amountPaid: nextOrder ? nextOrder.pendingAmount.toFixed(2) : "",
              }));
            }}
            required
          >
            <option value="">Select order / invoice</option>
            {receivablesForClient.map((row) => (
              <option key={row.orderId} value={row.orderId}>
                {row.invoiceNumber ?? `Order #${row.orderId}`} - Pending {row.pendingAmount.toFixed(2)}
              </option>
            ))}
          </select>

          <input
            type="number"
            min={0}
            step="any"
            className="rounded-lg border border-stroke bg-transparent px-4 py-3 dark:border-dark-3 dark:bg-dark-2"
            placeholder="Amount paid"
            value={form.amountPaid}
            onChange={(event) =>
              setForm((previous) => ({ ...previous, amountPaid: event.target.value }))
            }
            required
          />

          <input
            type="date"
            className="rounded-lg border border-stroke bg-transparent px-4 py-3 dark:border-dark-3 dark:bg-dark-2"
            value={form.paymentDate}
            onChange={(event) =>
              setForm((previous) => ({ ...previous, paymentDate: event.target.value }))
            }
            required
          />

          <input
            className="rounded-lg border border-stroke bg-transparent px-4 py-3 dark:border-dark-3 dark:bg-dark-2"
            placeholder="Payment method (cash/bank transfer/etc)"
            value={form.paymentMethod}
            onChange={(event) =>
              setForm((previous) => ({ ...previous, paymentMethod: event.target.value }))
            }
          />

          <input
            className="rounded-lg border border-stroke bg-transparent px-4 py-3 dark:border-dark-3 dark:bg-dark-2"
            placeholder="Reference note (optional)"
            value={form.referenceNote}
            onChange={(event) =>
              setForm((previous) => ({ ...previous, referenceNote: event.target.value }))
            }
          />

          <button
            type="submit"
            disabled={saving}
            className="rounded-lg bg-primary px-4 py-3 font-medium text-white hover:bg-opacity-90 disabled:opacity-60"
          >
            {saving ? "Recording..." : "Record payment"}
          </button>
        </form>

        {selectedOrder ? (
          <p className="mt-3 text-sm text-dark-5 dark:text-dark-6">
            Selected invoice total: {selectedOrder.totalAmount.toFixed(2)} | Recovered:{" "}
            {selectedOrder.recoveredAmount.toFixed(2)} | Pending: {selectedOrder.pendingAmount.toFixed(2)}
          </p>
        ) : null}
      </section>

      <section className="rounded-[10px] bg-white p-6 shadow-1 dark:bg-gray-dark dark:shadow-card">
        <h2 className="text-xl font-semibold text-dark dark:text-white">Outstanding receivables</h2>
        <div className="mt-4 overflow-x-auto">
          <table className="w-full min-w-[1000px] border-collapse text-sm">
            <thead>
              <tr className="border-b border-stroke text-left dark:border-dark-3">
                <th className="px-3 py-2">Invoice</th>
                <th className="px-3 py-2">Client</th>
                <th className="px-3 py-2">Date</th>
                <th className="px-3 py-2">Total</th>
                <th className="px-3 py-2">Recovered</th>
                <th className="px-3 py-2">Pending</th>
              </tr>
            </thead>
            <tbody>
              {receivables.map((row) => (
                <tr key={row.orderId} className="border-b border-stroke dark:border-dark-3">
                  <td className="px-3 py-3">{row.invoiceNumber ?? `Order #${row.orderId}`}</td>
                  <td className="px-3 py-3">{row.clientName}</td>
                  <td className="px-3 py-3 whitespace-nowrap">{row.orderDate}</td>
                  <td className="px-3 py-3">{row.totalAmount.toFixed(2)}</td>
                  <td className="px-3 py-3 text-green-600 dark:text-green-400">
                    {row.recoveredAmount.toFixed(2)}
                  </td>
                  <td className="px-3 py-3 font-medium text-red">{row.pendingAmount.toFixed(2)}</td>
                </tr>
              ))}
            </tbody>
          </table>
          {receivables.length === 0 ? (
            <p className="mt-4 text-sm text-dark-5 dark:text-dark-6">No receivable invoices found.</p>
          ) : null}
        </div>
      </section>

      <section className="rounded-[10px] bg-white p-6 shadow-1 dark:bg-gray-dark dark:shadow-card">
        <h2 className="text-xl font-semibold text-dark dark:text-white">Payment history</h2>
        <div className="mt-4 overflow-x-auto">
          <table className="w-full min-w-[1200px] border-collapse text-sm">
            <thead>
              <tr className="border-b border-stroke text-left dark:border-dark-3">
                <th className="px-3 py-2">Date</th>
                <th className="px-3 py-2">Receipt #</th>
                <th className="px-3 py-2">Client</th>
                <th className="px-3 py-2">Invoice</th>
                <th className="px-3 py-2">Method</th>
                <th className="px-3 py-2">Reference</th>
                <th className="px-3 py-2">Amount</th>
                <th className="px-3 py-2">Proof</th>
              </tr>
            </thead>
            <tbody>
              {payments.map((payment) => (
                <tr key={payment.id} className="border-b border-stroke dark:border-dark-3">
                  <td className="px-3 py-3 whitespace-nowrap">{payment.paymentDate}</td>
                  <td className="px-3 py-3 font-medium">{payment.receiptNumber}</td>
                  <td className="px-3 py-3">{payment.clientName}</td>
                  <td className="px-3 py-3">{payment.invoiceNumber ?? "—"}</td>
                  <td className="px-3 py-3 capitalize">{payment.paymentMethod}</td>
                  <td className="px-3 py-3 text-dark-5 dark:text-dark-6">{payment.referenceNote ?? "—"}</td>
                  <td className="px-3 py-3 font-medium">{payment.amountPaid.toFixed(2)}</td>
                  <td className="px-3 py-3">
                    <button
                      type="button"
                      onClick={() => void downloadPaymentReceiptPdf(payment)}
                      className="rounded-lg border border-stroke px-3 py-1.5 text-xs font-medium hover:bg-gray-2 dark:border-dark-3 dark:hover:bg-dark-2"
                    >
                      Download receipt
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {payments.length === 0 ? (
            <p className="mt-4 text-sm text-dark-5 dark:text-dark-6">No payments recorded yet.</p>
          ) : null}
        </div>
      </section>
    </div>
  );
}
