"use client";

import { mergeBottleSizeSuggestions } from "@/lib/bottle-sizes";
import { BRAND } from "@/lib/brand";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import Link from "next/link";
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
  bottleSize: string | null;
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
  bottleSize: string;
  quantity: string;
  unitPrice: string;
};

const defaultDraftItem: DraftItem = {
  productName: "",
  bottleType: "",
  bottleSize: "",
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

export function BillingInvoicesClient() {
  const [clients, setClients] = useState<Client[]>([]);
  const [invoices, setInvoices] = useState<InvoiceRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [successMessage, setSuccessMessage] = useState("");
  const [invoiceListSearch, setInvoiceListSearch] = useState("");

  const [form, setForm] = useState({
    clientId: "",
    invoiceDate: new Date().toISOString().slice(0, 10),
    paymentType: "credit" as "credit" | "cash",
    status: "pending" as "pending" | "completed" | "cancelled",
    invoiceNumber: "",
    notes: "",
  });
  const [items, setItems] = useState<DraftItem[]>([{ ...defaultDraftItem }]);
  const [bottleSizeSuggestions, setBottleSizeSuggestions] = useState<string[]>(() =>
    mergeBottleSizeSuggestions([]),
  );

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
    setInvoices(
      payload.invoices.map((inv) => ({
        ...inv,
        items: inv.items.map((i) => ({
          ...i,
          bottleSize: i.bottleSize ?? null,
        })),
      })),
    );
  };

  useEffect(() => {
    void (async () => {
      try {
        const r = await fetch("/api/inventory", { cache: "no-store" });
        if (!r.ok) {
          setBottleSizeSuggestions(mergeBottleSizeSuggestions([]));
          return;
        }
        const data = (await r.json()) as {
          items: Array<{ materialType: string; name: string }>;
        };
        const names = data.items
          .filter((i) => i.materialType === "bottle")
          .map((i) => String(i.name ?? "").trim())
          .filter(Boolean);
        setBottleSizeSuggestions(mergeBottleSizeSuggestions(names));
      } catch {
        setBottleSizeSuggestions(mergeBottleSizeSuggestions([]));
      }
    })();
  }, []);

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

  const filteredInvoices = useMemo(() => {
    const q = invoiceListSearch.trim().toLowerCase();
    if (!q) return invoices;
    return invoices.filter((inv) => {
      const itemsText = inv.items
        .map(
          (i) =>
            `${i.productName} ${i.bottleSize ?? ""} ${i.bottleType ?? ""} ${i.quantity} ${i.unitPrice}`,
        )
        .join(" ");
      const blob = [
        inv.invoiceNumber,
        inv.invoiceDate,
        formatPkDateTime(inv.invoiceDate),
        inv.client.name,
        inv.client.email ?? "",
        inv.client.contactNumber ?? "",
        inv.status,
        inv.paymentType,
        String(inv.totalAmount),
        inv.notes ?? "",
        itemsText,
      ]
        .join(" ")
        .toLowerCase();
      return blob.includes(q);
    });
  }, [invoices, invoiceListSearch]);

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
          bottleSize: item.bottleSize.trim(),
          quantity: Number(item.quantity),
          unitPrice: Number(item.unitPrice),
        }))
        .filter((item) => item.productName !== "");

      if (payloadItems.length === 0) {
        throw new Error("Add at least one item with product name.");
      }
      const missingSize = payloadItems.find((item) => !item.bottleSize);
      if (missingSize) {
        throw new Error("Each line needs a bottle size (choose a suggestion or type your own).");
      }
      const sizeTooLong = payloadItems.find((item) => item.bottleSize.length > 80);
      if (sizeTooLong) {
        throw new Error("Bottle size must be 80 characters or less on each line.");
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

  const downloadInvoicePdf = async (invoice: InvoiceRecord) => {
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
    doc.text("SALES INVOICE", right, 54, { align: "right" });

    doc.setFont("helvetica", "normal");
    doc.setFontSize(10);
    doc.setTextColor(71, 85, 105);
    doc.text(`Invoice #: ${invoice.invoiceNumber}`, right, 74, { align: "right" });
    doc.text(`Issued: ${formatPkDateTime(invoice.invoiceDate)}`, right, 89, { align: "right" });
    doc.text(`Payment Type: ${invoice.paymentType.toUpperCase()}`, right, 104, {
      align: "right",
    });

    doc.setDrawColor(228, 231, 236);
    doc.setFillColor(255, 255, 255);
    doc.roundedRect(left, 152, pageWidth - 84, 70, 8, 8, "FD");
    doc.setFont("helvetica", "bold");
    doc.setFontSize(11);
    doc.setTextColor(15, 23, 42);
    doc.text("Bill To", left + 12, 172);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(10.5);
    doc.setTextColor(51, 65, 85);
    doc.text(`Client: ${invoice.client.name}`, left + 12, 190);
    doc.text(
      `Contact: ${invoice.client.email ?? invoice.client.contactNumber ?? "N/A"}`,
      left + 12,
      206,
    );

    const tableBody = invoice.items.map((item, index) => [
      String(index + 1),
      `${item.productName}${item.bottleSize ? ` · ${item.bottleSize}` : ""}${item.bottleType ? ` (${item.bottleType})` : ""}`,
      item.quantity.toFixed(2),
      item.unitPrice.toFixed(2),
      item.totalPrice.toFixed(2),
    ]);

    autoTable(doc, {
      startY: 242,
      head: [["#", "Item", "Qty", "Unit Price", "Line Total"]],
      body: tableBody,
      styles: { fontSize: 10, cellPadding: 7, textColor: [31, 41, 55] },
      headStyles: { fillColor: [26, 122, 155], textColor: [255, 255, 255], fontStyle: "bold" },
      alternateRowStyles: { fillColor: [248, 250, 252] },
      bodyStyles: { lineColor: [226, 232, 240], lineWidth: 0.4 },
      theme: "striped",
      margin: { left, right: left },
    });

    const tableEndY =
      (doc as jsPDF & { lastAutoTable?: { finalY: number } }).lastAutoTable?.finalY ?? 380;
    const summaryBoxY = tableEndY + 16;

    doc.setFillColor(248, 250, 252);
    doc.roundedRect(right - 230, summaryBoxY, 230, 52, 8, 8, "F");
    doc.setFont("helvetica", "normal");
    doc.setFontSize(10);
    doc.setTextColor(71, 85, 105);
    doc.text("Grand Total", right - 214, summaryBoxY + 21);

    doc.setFont("helvetica", "bold");
    doc.setFontSize(14);
    doc.setTextColor(15, 23, 42);
    doc.text(invoice.totalAmount.toFixed(2), right - 16, summaryBoxY + 34, { align: "right" });

    if (invoice.notes) {
      doc.setFont("helvetica", "normal");
      doc.setFontSize(10);
      doc.setTextColor(51, 65, 85);
      doc.text(`Notes: ${invoice.notes}`, left, summaryBoxY + 76);
    }

    doc.setDrawColor(226, 232, 240);
    doc.line(left, 760, right, 760);
    doc.setFont("helvetica", "italic");
    doc.setFontSize(9.5);
    doc.setTextColor(100, 116, 139);
    doc.text("Thank you for your business.", left, 778);
    doc.text("This is a computer-generated invoice.", right, 778, { align: "right" });

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
      <div className="rounded-[10px] border border-primary/25 bg-primary/5 px-4 py-3 text-sm text-dark dark:text-white">
        <span className="font-medium">Recommended:</span> create sales orders (with auto-invoice and optional advance) on the{" "}
        <Link href="/dashboard/orders" className="text-primary underline-offset-2 hover:underline">
          Orders
        </Link>{" "}
        page first. Use this screen for extra invoices or legacy entries; PDF download works the same for all invoices.
      </div>

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

          <datalist id="billing-bottle-size-suggestions">
            {bottleSizeSuggestions.map((s) => (
              <option key={s} value={s} />
            ))}
          </datalist>

          <div className="overflow-x-auto">
            <table className="w-full min-w-[1020px] border-collapse text-sm">
              <thead>
                <tr className="border-b border-stroke text-left dark:border-dark-3">
                  <th className="px-3 py-2">Item</th>
                  <th className="px-3 py-2">Bottle Type</th>
                  <th className="px-3 py-2">Bottle size</th>
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
                          className="w-full min-w-[120px] rounded border border-stroke bg-transparent px-2 py-1 dark:border-dark-3"
                          list="billing-bottle-size-suggestions"
                          value={item.bottleSize}
                          onChange={(event) =>
                            updateItem(index, { bottleSize: event.target.value })
                          }
                          placeholder="e.g. 500ml"
                          maxLength={80}
                        />
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
        <label htmlFor="generated-invoices-search" className="sr-only">
          Search generated invoices
        </label>
        <input
          id="generated-invoices-search"
          type="search"
          value={invoiceListSearch}
          onChange={(e) => setInvoiceListSearch(e.target.value)}
          placeholder="Search invoice #, client, date, items, amount…"
          className="mt-3 w-full max-w-md rounded-lg border border-stroke bg-transparent px-4 py-2.5 text-sm dark:border-dark-3 dark:bg-dark-2"
        />
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
              {filteredInvoices.map((invoice) => (
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
                          `${item.productName}${item.bottleSize ? ` · ${item.bottleSize}` : ""}${item.bottleType ? ` (${item.bottleType})` : ""} x ${item.quantity}`,
                      )
                      .join(", ")}
                  </td>
                  <td className="px-3 py-3 font-medium">{invoice.totalAmount.toFixed(2)}</td>
                  <td className="px-3 py-3">
                    <button
                      type="button"
                      onClick={() => void downloadInvoicePdf(invoice)}
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
          ) : filteredInvoices.length === 0 ? (
            <p className="mt-4 text-sm text-dark-5 dark:text-dark-6">No invoices match your search.</p>
          ) : null}
        </div>
      </section>
    </div>
  );
}
