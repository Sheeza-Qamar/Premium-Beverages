"use client";

import { BRAND } from "@/lib/brand";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import { useEffect, useMemo, useState } from "react";

type Client = {
  id: number;
  name: string;
  email: string | null;
  contactNumber: string | null;
};

type InvoiceItem = {
  id: number;
  productName: string;
  bottleType: "mix" | "pure" | null;
  quantity: number;
  unitPrice: number;
  totalPrice: number;
};

type InvoiceRecord = {
  id: number;
  invoiceNumber: string;
  invoiceDate: string;
  totalAmount: number;
  paymentType: "credit" | "cash";
  status: "pending" | "completed" | "cancelled";
  notes: string | null;
  client: Client;
  items: InvoiceItem[];
};

type DraftItem = {
  productName: string;
  bottleType: "" | "mix" | "pure";
  quantity: string;
  unitPrice: string;
};

const defaultDraftItem: DraftItem = {
  productName: "",
  bottleType: "",
  quantity: "",
  unitPrice: "",
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

export function BillingInvoicesClient() {
  const [clients, setClients] = useState<Client[]>([]);
  const [invoices, setInvoices] = useState<InvoiceRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [successMessage, setSuccessMessage] = useState("");

  const [form, setForm] = useState({
    clientId: "",
    invoiceDate: new Date().toISOString().slice(0, 10),
    paymentType: "credit" as "credit" | "cash",
    status: "pending" as "pending" | "completed" | "cancelled",
    invoiceNumber: "",
    notes: "",
  });
  const [items, setItems] = useState<DraftItem[]>([{ ...defaultDraftItem }]);

  const loadClients = async () => {
    const response = await fetch("/api/clients", { cache: "no-store" });
    if (!response.ok) {
      const payload = (await response.json().catch(() => null)) as { message?: string } | null;
      throw new Error(payload?.message ?? "Unable to load clients.");
    }
    const payload = (await response.json()) as {
      clients: Array<{
        id: number;
        name: string;
        email: string | null;
        contactNumber: string | null;
      }>;
    };
    setClients(payload.clients);
  };

  const loadInvoices = async () => {
    const response = await fetch("/api/invoices", { cache: "no-store" });
    if (!response.ok) {
      const payload = (await response.json().catch(() => null)) as { message?: string } | null;
      throw new Error(payload?.message ?? "Unable to load invoices.");
    }
    const payload = (await response.json()) as { invoices: InvoiceRecord[] };
    setInvoices(payload.invoices);
  };

  useEffect(() => {
    void (async () => {
      setLoading(true);
      setError("");
      try {
        await Promise.all([loadClients(), loadInvoices()]);
      } catch (fetchError) {
        setError(fetchError instanceof Error ? fetchError.message : "Unable to load billing module.");
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const draftTotal = useMemo(
    () =>
      items.reduce((sum, item) => {
        const quantity = Number(item.quantity);
        const unitPrice = Number(item.unitPrice);
        if (
          !Number.isFinite(quantity) ||
          quantity <= 0 ||
          !Number.isFinite(unitPrice) ||
          unitPrice < 0
        ) {
          return sum;
        }
        return sum + quantity * unitPrice;
      }, 0),
    [items],
  );

  const addItemRow = () => {
    setItems((previous) => [...previous, { ...defaultDraftItem }]);
  };

  const removeItemRow = (index: number) => {
    setItems((previous) => previous.filter((_, rowIndex) => rowIndex !== index));
  };

  const updateItem = (index: number, patch: Partial<DraftItem>) => {
    setItems((previous) =>
      previous.map((item, rowIndex) => (rowIndex === index ? { ...item, ...patch } : item)),
    );
  };

  const createInvoice = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setSaving(true);
    setError("");
    setSuccessMessage("");

    try {
      const clientId = Number(form.clientId);
      if (!Number.isInteger(clientId) || clientId < 1) {
        throw new Error("Please select a client.");
      }

      const payloadItems = items
        .map((item) => ({
          productName: item.productName.trim(),
          bottleType: item.bottleType === "" ? null : item.bottleType,
          quantity: Number(item.quantity),
          unitPrice: Number(item.unitPrice),
        }))
        .filter((item) => item.productName !== "");

      if (payloadItems.length === 0) {
        throw new Error("Add at least one item with product name.");
      }

      const response = await fetch("/api/invoices", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          clientId,
          invoiceDate: form.invoiceDate,
          paymentType: form.paymentType,
          status: form.status,
          invoiceNumber: form.invoiceNumber.trim() || null,
          notes: form.notes.trim() || null,
          items: payloadItems,
        }),
      });

      if (!response.ok) {
        const payload = (await response.json().catch(() => null)) as { message?: string } | null;
        throw new Error(payload?.message ?? "Unable to generate invoice.");
      }

      const payload = (await response.json()) as {
        invoiceNumber: string;
        totalAmount: number;
        message: string;
      };

      setSuccessMessage(
        `${payload.message} Invoice #${payload.invoiceNumber} generated for ${payload.totalAmount.toFixed(2)}.`,
      );

      setForm((previous) => ({
        ...previous,
        invoiceNumber: "",
        notes: "",
      }));
      setItems([{ ...defaultDraftItem }]);
      await loadInvoices();
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : "Unable to generate invoice.");
    } finally {
      setSaving(false);
    }
  };

  const downloadInvoicePdf = (invoice: InvoiceRecord) => {
    const doc = new jsPDF({ unit: "pt", format: "a4" });
    const left = 48;
    let y = 56;

    doc.setFont("helvetica", "bold");
    doc.setFontSize(20);
    doc.text(BRAND.name, left, y);
    y += 24;

    doc.setFont("helvetica", "normal");
    doc.setFontSize(11);
    doc.text("Computerized Sales Invoice", left, y);
    y += 16;
    doc.text(`Invoice #: ${invoice.invoiceNumber}`, left, y);
    y += 14;
    doc.text(`Invoice Date: ${formatPkDateTime(invoice.invoiceDate)}`, left, y);
    y += 14;
    doc.text(`Payment Type: ${invoice.paymentType.toUpperCase()}`, left, y);
    y += 26;

    doc.setFont("helvetica", "bold");
    doc.setFontSize(12);
    doc.text("Client Details", left, y);
    y += 16;

    doc.setFont("helvetica", "normal");
    doc.setFontSize(11);
    doc.text(`Name: ${invoice.client.name}`, left, y);
    y += 14;
    doc.text(
      `Email/Contact: ${invoice.client.email ?? invoice.client.contactNumber ?? "N/A"}`,
      left,
      y,
    );
    y += 12;

    const tableBody = invoice.items.map((item, index) => [
      String(index + 1),
      `${item.productName}${item.bottleType ? ` (${item.bottleType})` : ""}`,
      item.quantity.toFixed(2),
      item.unitPrice.toFixed(2),
      item.totalPrice.toFixed(2),
    ]);

    autoTable(doc, {
      startY: y + 14,
      head: [["#", "Item", "Qty", "Unit Price", "Line Total"]],
      body: tableBody,
      styles: { fontSize: 10, cellPadding: 6 },
      headStyles: { fillColor: [26, 122, 155] },
      theme: "grid",
      margin: { left, right: left },
    });

    const tableEndY = (doc as jsPDF & { lastAutoTable?: { finalY: number } }).lastAutoTable?.finalY ?? y + 120;
    const footerY = tableEndY + 26;

    doc.setFont("helvetica", "bold");
    doc.setFontSize(12);
    doc.text(`Total Amount: ${invoice.totalAmount.toFixed(2)}`, left, footerY);

    if (invoice.notes) {
      doc.setFont("helvetica", "normal");
      doc.setFontSize(10);
      doc.text(`Notes: ${invoice.notes}`, left, footerY + 18);
    }

    doc.save(`${invoice.invoiceNumber}.pdf`);
  };

  if (loading) {
    return (
      <div className="rounded-[10px] bg-white p-6 shadow-1 dark:bg-gray-dark dark:shadow-card">
        <p>Loading billing &amp; invoices...</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <section className="rounded-[10px] bg-white p-6 shadow-1 dark:bg-gray-dark dark:shadow-card">
        <h2 className="text-xl font-semibold text-dark dark:text-white">Generate computerized invoice</h2>
        <p className="mt-1 text-sm text-dark-5 dark:text-dark-6">
          Create invoice with client details, items, quantities and total amount.
        </p>

        {error ? <p className="mt-3 text-sm text-red">{error}</p> : null}
        {successMessage ? (
          <p className="mt-3 text-sm text-green-600 dark:text-green-400">{successMessage}</p>
        ) : null}

        <form className="mt-4 space-y-4" onSubmit={createInvoice}>
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            <select
              className="rounded-lg border border-stroke bg-transparent px-4 py-3 dark:border-dark-3 dark:bg-dark-2"
              value={form.clientId}
              onChange={(event) =>
                setForm((previous) => ({ ...previous, clientId: event.target.value }))
              }
              required
            >
              <option value="">Select client</option>
              {clients.map((client) => (
                <option key={client.id} value={client.id}>
                  {client.name}
                </option>
              ))}
            </select>

            <input
              type="date"
              className="rounded-lg border border-stroke bg-transparent px-4 py-3 dark:border-dark-3 dark:bg-dark-2"
              value={form.invoiceDate}
              onChange={(event) =>
                setForm((previous) => ({ ...previous, invoiceDate: event.target.value }))
              }
              required
            />

            <select
              className="rounded-lg border border-stroke bg-transparent px-4 py-3 dark:border-dark-3 dark:bg-dark-2"
              value={form.paymentType}
              onChange={(event) =>
                setForm((previous) => ({
                  ...previous,
                  paymentType: event.target.value as "credit" | "cash",
                }))
              }
            >
              <option value="credit">Credit</option>
              <option value="cash">Cash</option>
            </select>

            <select
              className="rounded-lg border border-stroke bg-transparent px-4 py-3 dark:border-dark-3 dark:bg-dark-2"
              value={form.status}
              onChange={(event) =>
                setForm((previous) => ({
                  ...previous,
                  status: event.target.value as "pending" | "completed" | "cancelled",
                }))
              }
            >
              <option value="pending">Pending</option>
              <option value="completed">Completed</option>
              <option value="cancelled">Cancelled</option>
            </select>

            <input
              className="rounded-lg border border-stroke bg-transparent px-4 py-3 dark:border-dark-3 dark:bg-dark-2"
              placeholder="Invoice number (auto if empty)"
              value={form.invoiceNumber}
              onChange={(event) =>
                setForm((previous) => ({ ...previous, invoiceNumber: event.target.value }))
              }
            />

            <input
              className="rounded-lg border border-stroke bg-transparent px-4 py-3 dark:border-dark-3 dark:bg-dark-2"
              placeholder="Notes (optional)"
              value={form.notes}
              onChange={(event) => setForm((previous) => ({ ...previous, notes: event.target.value }))}
            />
          </div>

          <div className="overflow-x-auto">
            <table className="w-full min-w-[900px] border-collapse text-sm">
              <thead>
                <tr className="border-b border-stroke text-left dark:border-dark-3">
                  <th className="px-3 py-2">Item</th>
                  <th className="px-3 py-2">Bottle Type</th>
                  <th className="px-3 py-2">Quantity</th>
                  <th className="px-3 py-2">Unit Price</th>
                  <th className="px-3 py-2">Line Total</th>
                  <th className="px-3 py-2"> </th>
                </tr>
              </thead>
              <tbody>
                {items.map((item, index) => {
                  const quantity = Number(item.quantity);
                  const unitPrice = Number(item.unitPrice);
                  const lineTotal =
                    Number.isFinite(quantity) &&
                    quantity > 0 &&
                    Number.isFinite(unitPrice) &&
                    unitPrice >= 0
                      ? quantity * unitPrice
                      : 0;

                  return (
                    <tr key={index} className="border-b border-stroke dark:border-dark-3">
                      <td className="px-3 py-3">
                        <input
                          className="w-full min-w-[180px] rounded border border-stroke bg-transparent px-2 py-1 dark:border-dark-3"
                          value={item.productName}
                          onChange={(event) =>
                            updateItem(index, { productName: event.target.value })
                          }
                          placeholder="Item name"
                        />
                      </td>
                      <td className="px-3 py-3">
                        <select
                          className="rounded border border-stroke bg-transparent px-2 py-1 dark:border-dark-3"
                          value={item.bottleType}
                          onChange={(event) =>
                            updateItem(index, {
                              bottleType: event.target.value as DraftItem["bottleType"],
                            })
                          }
                        >
                          <option value="">--</option>
                          <option value="mix">mix</option>
                          <option value="pure">pure</option>
                        </select>
                      </td>
                      <td className="px-3 py-3">
                        <input
                          type="number"
                          min={0}
                          step="any"
                          className="w-28 rounded border border-stroke bg-transparent px-2 py-1 dark:border-dark-3"
                          value={item.quantity}
                          onChange={(event) =>
                            updateItem(index, { quantity: event.target.value })
                          }
                          placeholder="0"
                        />
                      </td>
                      <td className="px-3 py-3">
                        <input
                          type="number"
                          min={0}
                          step="any"
                          className="w-32 rounded border border-stroke bg-transparent px-2 py-1 dark:border-dark-3"
                          value={item.unitPrice}
                          onChange={(event) =>
                            updateItem(index, { unitPrice: event.target.value })
                          }
                          placeholder="0"
                        />
                      </td>
                      <td className="px-3 py-3">{lineTotal.toFixed(2)}</td>
                      <td className="px-3 py-3">
                        <button
                          type="button"
                          className="text-red hover:underline"
                          disabled={items.length === 1}
                          onClick={() => removeItemRow(index)}
                        >
                          Remove
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <button
              type="button"
              onClick={addItemRow}
              className="rounded-lg border border-stroke px-4 py-2 text-sm font-medium hover:bg-gray-2 dark:border-dark-3 dark:hover:bg-dark-2"
            >
              Add item row
            </button>
            <span className="text-sm text-dark-5 dark:text-dark-6">
              Draft total:{" "}
              <span className="font-medium text-dark dark:text-white">{draftTotal.toFixed(2)}</span>
            </span>
          </div>

          <button
            type="submit"
            disabled={saving}
            className="rounded-lg bg-primary px-4 py-3 font-medium text-white hover:bg-opacity-90 disabled:opacity-60"
          >
            {saving ? "Generating..." : "Generate invoice"}
          </button>
        </form>
      </section>

      <section className="rounded-[10px] bg-white p-6 shadow-1 dark:bg-gray-dark dark:shadow-card">
        <h2 className="text-xl font-semibold text-dark dark:text-white">Generated invoices</h2>
        <div className="mt-4 overflow-x-auto">
          <table className="w-full min-w-[1100px] border-collapse text-sm">
            <thead>
              <tr className="border-b border-stroke text-left dark:border-dark-3">
                <th className="px-3 py-2">Invoice #</th>
                <th className="px-3 py-2">Date</th>
                <th className="px-3 py-2">Client Details</th>
                <th className="px-3 py-2">Items / Quantities</th>
                <th className="px-3 py-2">Total Amount</th>
                <th className="px-3 py-2">PDF</th>
              </tr>
            </thead>
            <tbody>
              {invoices.map((invoice) => (
                <tr key={invoice.id} className="border-b border-stroke align-top dark:border-dark-3">
                  <td className="px-3 py-3 font-medium">{invoice.invoiceNumber}</td>
                  <td className="px-3 py-3 whitespace-nowrap">
                    {formatPkDateTime(invoice.invoiceDate)}
                  </td>
                  <td className="px-3 py-3">
                    <p className="font-medium">{invoice.client.name}</p>
                    <p className="text-dark-5 dark:text-dark-6">
                      {invoice.client.email || invoice.client.contactNumber || "No contact"}
                    </p>
                  </td>
                  <td className="px-3 py-3 text-dark-5 dark:text-dark-6">
                    {invoice.items
                      .map(
                        (item) =>
                          `${item.productName}${item.bottleType ? ` (${item.bottleType})` : ""} x ${item.quantity}`,
                      )
                      .join(", ")}
                  </td>
                  <td className="px-3 py-3 font-medium">{invoice.totalAmount.toFixed(2)}</td>
                  <td className="px-3 py-3">
                    <button
                      type="button"
                      onClick={() => downloadInvoicePdf(invoice)}
                      className="rounded-lg border border-stroke px-3 py-1.5 text-xs font-medium hover:bg-gray-2 dark:border-dark-3 dark:hover:bg-dark-2"
                    >
                      Download PDF
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {invoices.length === 0 ? (
            <p className="mt-4 text-sm text-dark-5 dark:text-dark-6">No invoices generated yet.</p>
          ) : null}
        </div>
      </section>
    </div>
  );
}
