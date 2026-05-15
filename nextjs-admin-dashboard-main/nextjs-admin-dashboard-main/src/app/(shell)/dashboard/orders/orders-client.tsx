"use client";

import { mergeBottleSizeSuggestions } from "@/lib/bottle-sizes";
import { getDisplayOrderStatus } from "@/lib/order-status-display";
import {
  downloadInvoicePdf,
  downloadPaymentReceiptPdf,
  toPaymentReceiptInput,
  type InvoicePdfRecord,
} from "@/lib/finance-pdfs";
import { useCallback, useEffect, useMemo, useState } from "react";

type Client = { id: number; name: string };

type ClientLabel = { id: number; labelName: string };

type OrderItem = {
  id: number;
  productName: string;
  bottleType: "mix" | "pure" | null;
  bottleSize: string | null;
  quantity: number;
  unitPrice: number;
  totalPrice: number;
  sortOrder: number;
};

type OrderRecord = {
  id: number;
  clientId: number;
  clientName: string;
  orderDate: string;
  totalAmount: number;
  status: "pending" | "completed" | "cancelled";
  paymentType: "credit" | "cash";
  invoiceNumber: string | null;
  notes: string | null;
  createdAt: string;
  paidAmount: number;
  outstandingAmount: number;
  orderedQty: number;
  producedQty: number;
  items: OrderItem[];
};

type DraftItem = {
  productName: string;
  bottleType: "" | "mix" | "pure";
  bottleSize: string;
  quantity: string;
  unitPrice: string;
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
  orderTotalAmount?: number | null;
  paidPriorToThisReceipt?: number;
  outstandingAfterThisReceipt?: number | null;
};

type InvoiceApiRecord = {
  id: number;
  invoiceNumber: string;
  invoiceDate: string;
  totalAmount: number;
  paymentType: string;
  status: string;
  notes: string | null;
  client: {
    id: number;
    name: string;
    email: string | null;
    contactNumber: string | null;
    address: string | null;
  };
  items: Array<{
    productName: string;
    bottleType: "mix" | "pure" | null;
    bottleSize: string | null;
    quantity: number;
    unitPrice: number;
    totalPrice: number;
  }>;
};

function buildOrdersUrl(search?: string) {
  let path = "/api/orders";
  const q = search?.trim();
  if (q) path += `?q=${encodeURIComponent(q)}`;
  return path;
}

function apiInvoiceToPdfPayload(inv: InvoiceApiRecord): InvoicePdfRecord {
  return {
    invoiceNumber: inv.invoiceNumber,
    invoiceDate: inv.invoiceDate,
    totalAmount: inv.totalAmount,
    paymentType: inv.paymentType,
    notes: inv.notes,
    client: {
      name: inv.client.name,
      email: inv.client.email,
      contactNumber: inv.client.contactNumber,
    },
    items: inv.items.map((i) => ({
      productName: i.productName,
      bottleType: i.bottleType,
      bottleSize: i.bottleSize ?? null,
      quantity: i.quantity,
      unitPrice: i.unitPrice,
      totalPrice: i.totalPrice,
    })),
  };
}

export function OrdersClient() {
  const [clients, setClients] = useState<Client[]>([]);
  const [orders, setOrders] = useState<OrderRecord[]>([]);
  const [paymentsList, setPaymentsList] = useState<PaymentRecord[]>([]);
  const [invoicesCache, setInvoicesCache] = useState<InvoiceApiRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const [orderSearch, setOrderSearch] = useState("");
  const [searchApplied, setSearchApplied] = useState("");
  const [paymentHistoryFilter, setPaymentHistoryFilter] = useState("");
  const [pendingOrdersFilter, setPendingOrdersFilter] = useState("");

  const [payForm, setPayForm] = useState({
    clientId: "",
    orderId: "",
    amountPaid: "",
    paymentDate: new Date().toISOString().slice(0, 10),
    paymentMethod: "cash",
    referenceNote: "",
  });
  const [paySaving, setPaySaving] = useState(false);
  const [paymentModalOpen, setPaymentModalOpen] = useState(false);

  const [form, setForm] = useState({
    clientId: "",
    orderDate: new Date().toISOString().slice(0, 10),
    paymentType: "credit" as "credit" | "cash",
    status: "pending" as "pending" | "completed" | "cancelled",
    invoiceNumber: "",
    notes: "",
    advancePaymentAmount: "",
    advancePaymentDate: new Date().toISOString().slice(0, 10),
    advancePaymentMethod: "cash",
    advancePaymentNote: "",
  });

  const [items, setItems] = useState<DraftItem[]>([
    { productName: "", bottleType: "", bottleSize: "", quantity: "", unitPrice: "" },
  ]);

  const [bottleSizeSuggestions, setBottleSizeSuggestions] = useState<string[]>(() =>
    mergeBottleSizeSuggestions([]),
  );

  const [clientLabels, setClientLabels] = useState<ClientLabel[]>([]);
  const [clientLabelsLoading, setClientLabelsLoading] = useState(false);
  const [clientLabelsError, setClientLabelsError] = useState("");

  const loadClients = useCallback(async () => {
    const r = await fetch("/api/clients", { cache: "no-store" });
    if (!r.ok) {
      const p = (await r.json().catch(() => null)) as { message?: string } | null;
      throw new Error(p?.message ?? "Failed to load clients.");
    }
    const data = (await r.json()) as { clients: Array<{ id: number; name: string }> };
    setClients(data.clients.map((c) => ({ id: c.id, name: c.name })));
  }, []);

  const loadOrders = useCallback(async (search?: string) => {
    const path = buildOrdersUrl(search);
    const r = await fetch(path, { cache: "no-store" });
    if (!r.ok) {
      const p = (await r.json().catch(() => null)) as { message?: string } | null;
      throw new Error(p?.message ?? "Failed to load orders.");
    }
    const data = (await r.json()) as { orders: OrderRecord[] };
    setOrders(
      data.orders.map((o) => ({
        ...o,
        paidAmount: o.paidAmount ?? 0,
        outstandingAmount: o.outstandingAmount ?? 0,
        orderedQty: o.orderedQty ?? 0,
        producedQty: o.producedQty ?? 0,
        items: (o.items ?? []).map((i) => ({
          ...i,
          bottleSize: i.bottleSize ?? null,
        })),
      })),
    );
  }, []);

  const loadPaymentsList = useCallback(async () => {
    const r = await fetch("/api/payments", { cache: "no-store" });
    if (!r.ok) {
      const p = (await r.json().catch(() => null)) as { message?: string } | null;
      throw new Error(p?.message ?? "Failed to load payments.");
    }
    const data = (await r.json()) as { payments: PaymentRecord[] };
    setPaymentsList(data.payments);
  }, []);

  const loadInvoicesCache = useCallback(async () => {
    const r = await fetch("/api/invoices", { cache: "no-store" });
    if (!r.ok) {
      const p = (await r.json().catch(() => null)) as { message?: string } | null;
      throw new Error(p?.message ?? "Failed to load invoices for PDF.");
    }
    const data = (await r.json()) as { invoices: InvoiceApiRecord[] };
    setInvoicesCache(data.invoices);
  }, []);

  const reloadSupporting = useCallback(
    async (search?: string) => {
      await Promise.all([loadOrders(search), loadPaymentsList(), loadInvoicesCache()]);
    },
    [loadInvoicesCache, loadOrders, loadPaymentsList],
  );

  useEffect(() => {
    void (async () => {
      setLoading(true);
      setError("");
      try {
        await Promise.all([loadClients(), reloadSupporting()]);
      } catch (e) {
        setError(e instanceof Error ? e.message : "Unable to load orders module.");
      } finally {
        setLoading(false);
      }
    })();
  }, [loadClients, reloadSupporting]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    if (window.location.hash !== "#record-payment") return;
    const t = window.setTimeout(() => {
      setPaymentModalOpen(true);
      if (window.history.replaceState) {
        const { pathname, search } = window.location;
        window.history.replaceState(null, "", `${pathname}${search}`);
      }
    }, 400);
    return () => window.clearTimeout(t);
  }, []);

  useEffect(() => {
    setPayForm((p) => ({ ...p, amountPaid: "", referenceNote: "", orderId: "" }));
  }, [payForm.clientId]);

  useEffect(() => {
    if (!paymentModalOpen) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, [paymentModalOpen]);

  useEffect(() => {
    if (!paymentModalOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setPaymentModalOpen(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [paymentModalOpen]);

  useEffect(() => {
    setItems((prev) => prev.map((row) => ({ ...row, productName: "", bottleSize: "" })));
  }, [form.clientId]);

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
    const cid = Number(form.clientId);
    if (!Number.isInteger(cid) || cid < 1) {
      setClientLabels([]);
      setClientLabelsLoading(false);
      setClientLabelsError("");
      return;
    }

    let cancelled = false;
    setClientLabelsLoading(true);
    setClientLabelsError("");

    void (async () => {
      try {
        const r = await fetch(`/api/clients/${cid}`, { cache: "no-store" });
        const payload = (await r.json().catch(() => null)) as {
          labels?: Array<{ id: number; labelName: string }>;
          message?: string;
        } | null;
        if (cancelled) return;
        if (!r.ok) {
          setClientLabels([]);
          setClientLabelsError(payload?.message ?? "Could not load labels for this client.");
          return;
        }
        const mapped = (payload?.labels ?? [])
          .map((l) => ({
            id: l.id,
            labelName: String(l.labelName ?? "").trim(),
          }))
          .filter((l) => l.labelName.length > 0);
        setClientLabels(mapped);
      } catch {
        if (!cancelled) {
          setClientLabels([]);
          setClientLabelsError("Could not load labels for this client.");
        }
      } finally {
        if (!cancelled) {
          setClientLabelsLoading(false);
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [form.clientId]);

  const draftTotal = useMemo(() => {
    return items.reduce((sum, item) => {
      const qty = Number(item.quantity);
      const price = Number(item.unitPrice);
      if (!Number.isFinite(qty) || qty <= 0 || !Number.isFinite(price) || price < 0) {
        return sum;
      }
      return sum + qty * price;
    }, 0);
  }, [items]);

  const moneySummary = useMemo(() => {
    const active = orders.filter((o) => o.status !== "cancelled");
    return {
      orderValue: active.reduce((s, o) => s + o.totalAmount, 0),
      collected: active.reduce((s, o) => s + o.paidAmount, 0),
      due: active.reduce((s, o) => s + o.outstandingAmount, 0),
    };
  }, [orders]);

  const outstandingRows = useMemo(
    () => orders.filter((o) => o.status !== "cancelled" && o.outstandingAmount > 0),
    [orders],
  );

  const filteredPaymentsList = useMemo(() => {
    const q = paymentHistoryFilter.trim().toLowerCase();
    if (!q) return paymentsList;
    return paymentsList.filter((p) => {
      const blob = [
        p.receiptNumber,
        p.clientName,
        p.invoiceNumber ?? "",
        p.paymentMethod,
        p.paymentDate,
        p.amountPaid.toFixed(2),
        String(p.amountPaid),
        p.referenceNote ?? "",
        p.orderId != null ? String(p.orderId) : "",
      ]
        .join(" ")
        .toLowerCase();
      return blob.includes(q);
    });
  }, [paymentsList, paymentHistoryFilter]);

  const filteredOutstandingRows = useMemo(() => {
    const q = pendingOrdersFilter.trim().toLowerCase();
    if (!q) return outstandingRows;
    return outstandingRows.filter((o) => {
      const blob = [
        o.invoiceNumber ?? "",
        `order #${o.id}`,
        String(o.id),
        o.clientName,
        o.orderDate,
        o.totalAmount.toFixed(2),
        o.paidAmount.toFixed(2),
        o.outstandingAmount.toFixed(2),
      ]
        .join(" ")
        .toLowerCase();
      return blob.includes(q);
    });
  }, [outstandingRows, pendingOrdersFilter]);

  const selectedPayClientId = Number(payForm.clientId);
  const payOrderChoices = useMemo(() => {
    if (!Number.isInteger(selectedPayClientId) || selectedPayClientId < 1) return [];
    return orders.filter(
      (o) =>
        o.clientId === selectedPayClientId &&
        o.status !== "cancelled" &&
        o.outstandingAmount > 0,
    );
  }, [orders, selectedPayClientId]);

  const selectedPayOrderRow = useMemo(() => {
    const oid = Number(payForm.orderId);
    if (!Number.isInteger(oid) || oid < 1) return null;
    return orders.find((o) => o.id === oid) ?? null;
  }, [orders, payForm.orderId]);

  const advanceNum = Number(form.advancePaymentAmount);
  const advanceValid =
    form.advancePaymentAmount.trim() === "" ||
    (Number.isFinite(advanceNum) && advanceNum >= 0 && advanceNum <= draftTotal);

  const addItemRow = () => {
    setItems((prev) => [
      ...prev,
      { productName: "", bottleType: "", bottleSize: "", quantity: "", unitPrice: "" },
    ]);
  };

  const removeItemRow = (index: number) => {
    setItems((prev) => prev.filter((_, i) => i !== index));
  };

  const updateItem = (index: number, patch: Partial<DraftItem>) => {
    setItems((prev) =>
      prev.map((item, i) => (i === index ? { ...item, ...patch } : item)),
    );
  };

  const runSearch = async () => {
    setLoading(true);
    setError("");
    try {
      setSearchApplied(orderSearch.trim());
      await reloadSupporting(orderSearch.trim());
    } catch (e) {
      setError(e instanceof Error ? e.message : "Search failed.");
    } finally {
      setLoading(false);
    }
  };

  const clearSearch = async () => {
    setOrderSearch("");
    setSearchApplied("");
    setLoading(true);
    setError("");
    try {
      await reloadSupporting();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Unable to load orders.");
    } finally {
      setLoading(false);
    }
  };

  const downloadPdfForOrder = async (orderId: number) => {
    setError("");
    const inv = invoicesCache.find((i) => i.id === orderId);
    if (!inv) {
      setError("Invoice details not loaded yet — refresh the page and try again.");
      return;
    }
    try {
      await downloadInvoicePdf(apiInvoiceToPdfPayload(inv));
    } catch {
      setError("Could not generate PDF.");
    }
  };

  const submitPayment = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setPaySaving(true);
    setError("");
    try {
      const clientId = Number(payForm.clientId);
      const orderId = Number(payForm.orderId);
      const amountPaid = Number(payForm.amountPaid);
      if (!Number.isInteger(clientId) || clientId < 1) {
        throw new Error("Please select a client.");
      }
      if (!Number.isInteger(orderId) || orderId < 1) {
        throw new Error("Please select an order with a balance.");
      }
      if (!Number.isFinite(amountPaid) || amountPaid <= 0) {
        throw new Error("Payment amount must be greater than zero.");
      }
      const r = await fetch("/api/payments", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          clientId,
          orderId,
          amountPaid,
          paymentDate: payForm.paymentDate,
          paymentMethod: payForm.paymentMethod,
          referenceNote: payForm.referenceNote.trim() || null,
        }),
      });
      if (!r.ok) {
        const p = (await r.json().catch(() => null)) as { message?: string } | null;
        throw new Error(p?.message ?? "Unable to record payment.");
      }
      const payload = (await r.json()) as {
        receiptNumber: string;
        invoiceNumber: string | null;
        outstandingAfter: number;
      };
      setSuccess(
        `Payment saved. Receipt ${payload.receiptNumber}. Outstanding on invoice: ${payload.outstandingAfter.toFixed(2)}.`,
      );
      setPaymentModalOpen(false);
      setPayForm((p) => ({
        ...p,
        orderId: "",
        amountPaid: "",
        referenceNote: "",
      }));
      await reloadSupporting(searchApplied || undefined);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to record payment.");
    } finally {
      setPaySaving(false);
    }
  };

  const createOrder = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setSaving(true);
    setError("");
    setSuccess("");
    try {
      const clientId = Number(form.clientId);
      if (!Number.isInteger(clientId) || clientId < 1) {
        setError("Please select a client.");
        return;
      }
      if (clientLabelsError) {
        setError(clientLabelsError);
        return;
      }
      if (clientLabelsLoading) {
        setError("Labels are still loading — wait a moment and try again.");
        return;
      }
      if (clientLabels.length === 0) {
        setError(
          "This client has no label lines yet. Add labels under Clients → edit, then create the order.",
        );
        return;
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
        setError("Add at least one valid item.");
        return;
      }

      const missingSize = payloadItems.find((item) => !item.bottleSize);
      if (missingSize) {
        setError("Each line needs a bottle size (choose a suggestion or type your own).");
        return;
      }
      const sizeTooLong = payloadItems.find((item) => item.bottleSize.length > 80);
      if (sizeTooLong) {
        setError("Bottle size must be 80 characters or less on each line.");
        return;
      }

      const allowed = new Set(clientLabels.map((l) => l.labelName));
      const badLabel = payloadItems.find((item) => !allowed.has(item.productName));
      if (badLabel) {
        setError("Each product line must use a label from the dropdown for the selected client.");
        return;
      }

      const advRaw = form.advancePaymentAmount.trim();
      let advancePaymentAmount: number | undefined;
      if (advRaw !== "") {
        const a = Number(advRaw);
        if (!Number.isFinite(a) || a < 0) {
          setError("Advance payment must be a valid zero or positive number.");
          return;
        }
        if (a > draftTotal) {
          setError("Advance cannot exceed order total.");
          return;
        }
        if (a > 0) {
          advancePaymentAmount = a;
        }
      }

      const body: Record<string, unknown> = {
        clientId,
        orderDate: form.orderDate,
        paymentType: form.paymentType,
        status: form.status,
        invoiceNumber: form.invoiceNumber.trim() || null,
        notes: form.notes.trim() || null,
        items: payloadItems,
      };

      if (advancePaymentAmount !== undefined && advancePaymentAmount > 0) {
        body.advancePaymentAmount = advancePaymentAmount;
        body.advancePaymentDate = form.advancePaymentDate;
        body.advancePaymentMethod = form.advancePaymentMethod;
        body.advancePaymentNote = form.advancePaymentNote.trim() || null;
      }

      const r = await fetch("/api/orders", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });

      if (!r.ok) {
        const p = (await r.json().catch(() => null)) as { message?: string } | null;
        throw new Error(p?.message ?? "Could not create order.");
      }

      const created = (await r.json()) as {
        invoiceNumber?: string | null;
        advanceRecorded?: number;
      };
      setSuccess(
        created.advanceRecorded && created.advanceRecorded > 0
          ? `Order saved. Invoice ${created.invoiceNumber ?? "assigned"}. Advance ${created.advanceRecorded.toFixed(2)} recorded.`
          : `Order saved. Invoice ${created.invoiceNumber ?? "assigned"}.`,
      );

      setForm((prev) => ({
        ...prev,
        invoiceNumber: "",
        notes: "",
        advancePaymentAmount: "",
        advancePaymentNote: "",
        advancePaymentDate: new Date().toISOString().slice(0, 10),
      }));
      setItems([{ productName: "", bottleType: "", bottleSize: "", quantity: "", unitPrice: "" }]);
      await reloadSupporting(searchApplied || undefined);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not create order.");
    } finally {
      setSaving(false);
    }
  };

  if (loading && orders.length === 0 && clients.length === 0) {
    return (
      <div className="rounded-[10px] bg-white p-6 shadow-1 dark:bg-gray-dark dark:shadow-card">
        <p>Loading…</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <section className="rounded-[10px] border border-stroke/80 bg-white p-6 shadow-1 dark:border-dark-3 dark:bg-gray-dark dark:shadow-card">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <h2 className="text-xl font-semibold text-dark dark:text-white">Create order</h2>
            <p className="mt-1 max-w-3xl text-sm text-dark-5 dark:text-dark-6">
              One place for <span className="font-medium text-dark dark:text-white">sales orders</span>,{" "}
              <span className="font-medium text-dark dark:text-white">invoice numbers</span> (auto if blank),{" "}
              <span className="font-medium text-dark dark:text-white">advance collection</span>, then use{" "}
              <span className="font-medium text-dark dark:text-white">All orders</span> for balances and PDFs
              — no separate billing or payments menu.
            </p>
          </div>
        </div>

        {error ? <p className="mt-4 text-sm text-red">{error}</p> : null}
        {success ? (
          <p className="mt-4 rounded-lg border border-green/30 bg-green/5 px-3 py-2 text-sm text-green-700 dark:text-green-400">
            {success}
          </p>
        ) : null}

        <form onSubmit={createOrder} className="mt-6 space-y-6">
          <div className="grid gap-6 lg:grid-cols-[1fr_minmax(260px,320px)]">
            <div className="space-y-4">
              <p className="text-xs font-semibold uppercase tracking-wide text-dark-5 dark:text-dark-6">
                Order details
              </p>
              <div className="grid gap-4 sm:grid-cols-2">
                <select
                  className="rounded-lg border border-stroke bg-transparent px-4 py-3 dark:border-dark-3 dark:bg-dark-2"
                  value={form.clientId}
                  onChange={(e) =>
                    setForm((prev) => ({ ...prev, clientId: e.target.value }))
                  }
                  required
                >
                  <option value="">Select client</option>
                  {clients.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                    </option>
                  ))}
                </select>

                <input
                  type="date"
                  className="rounded-lg border border-stroke bg-transparent px-4 py-3 dark:border-dark-3 dark:bg-dark-2"
                  value={form.orderDate}
                  onChange={(e) =>
                    setForm((prev) => ({ ...prev, orderDate: e.target.value }))
                  }
                  required
                />

                <select
                  className="rounded-lg border border-stroke bg-transparent px-4 py-3 dark:border-dark-3 dark:bg-dark-2"
                  value={form.paymentType}
                  onChange={(e) =>
                    setForm((prev) => ({
                      ...prev,
                      paymentType: e.target.value as "credit" | "cash",
                    }))
                  }
                >
                  <option value="credit">Credit sale</option>
                  <option value="cash">Cash sale</option>
                </select>

                <select
                  className="rounded-lg border border-stroke bg-transparent px-4 py-3 dark:border-dark-3 dark:bg-dark-2"
                  value={form.status}
                  onChange={(e) =>
                    setForm((prev) => ({
                      ...prev,
                      status: e.target.value as "pending" | "completed" | "cancelled",
                    }))
                  }
                >
                  <option value="pending">Order status: Pending</option>
                  <option value="completed">Order status: Completed</option>
                  <option value="cancelled">Order status: Cancelled</option>
                </select>

                <input
                  className="sm:col-span-2 rounded-lg border border-stroke bg-transparent px-4 py-3 dark:border-dark-3 dark:bg-dark-2"
                  placeholder="Invoice # (optional — auto-generated if empty)"
                  value={form.invoiceNumber}
                  onChange={(e) =>
                    setForm((prev) => ({ ...prev, invoiceNumber: e.target.value }))
                  }
                />

                <input
                  className="sm:col-span-2 rounded-lg border border-stroke bg-transparent px-4 py-3 dark:border-dark-3 dark:bg-dark-2"
                  placeholder="Notes (optional)"
                  value={form.notes}
                  onChange={(e) =>
                    setForm((prev) => ({ ...prev, notes: e.target.value }))
                  }
                />
              </div>
            </div>

            <div className="rounded-xl border border-stroke bg-gray-2/40 p-4 dark:border-dark-3 dark:bg-dark-2/40">
              <p className="text-xs font-semibold uppercase tracking-wide text-dark-5 dark:text-dark-6">
                Advance payment (optional)
              </p>
              <p className="mt-1 text-xs text-dark-5 dark:text-dark-6">
                If the customer pays now, enter the amount. Cannot exceed the line-item total below.
              </p>
              <div className="mt-3 space-y-3">
                <input
                  type="number"
                  min={0}
                  step="any"
                  className="w-full rounded-lg border border-stroke bg-white px-3 py-2.5 text-sm dark:border-dark-3 dark:bg-dark-2"
                  placeholder="Amount (0 = none)"
                  value={form.advancePaymentAmount}
                  onChange={(e) =>
                    setForm((prev) => ({ ...prev, advancePaymentAmount: e.target.value }))
                  }
                />
                <input
                  type="date"
                  className="w-full rounded-lg border border-stroke bg-white px-3 py-2.5 text-sm dark:border-dark-3 dark:bg-dark-2"
                  value={form.advancePaymentDate}
                  onChange={(e) =>
                    setForm((prev) => ({ ...prev, advancePaymentDate: e.target.value }))
                  }
                />
                <select
                  className="w-full rounded-lg border border-stroke bg-white px-3 py-2.5 text-sm dark:border-dark-3 dark:bg-dark-2"
                  value={form.advancePaymentMethod}
                  onChange={(e) =>
                    setForm((prev) => ({ ...prev, advancePaymentMethod: e.target.value }))
                  }
                >
                  <option value="cash">Cash</option>
                  <option value="bank">Bank transfer</option>
                  <option value="jazzcash">JazzCash</option>
                  <option value="easypaisa">Easypaisa</option>
                  <option value="cheque">Cheque</option>
                </select>
                <input
                  className="w-full rounded-lg border border-stroke bg-white px-3 py-2.5 text-sm dark:border-dark-3 dark:bg-dark-2"
                  placeholder="Receipt note (optional)"
                  value={form.advancePaymentNote}
                  onChange={(e) =>
                    setForm((prev) => ({ ...prev, advancePaymentNote: e.target.value }))
                  }
                />
                {!advanceValid && form.advancePaymentAmount.trim() !== "" ? (
                  <p className="text-xs text-red">Advance cannot exceed draft total.</p>
                ) : null}
              </div>
            </div>
          </div>

          {clientLabelsError ? (
            <p className="text-sm text-red">{clientLabelsError}</p>
          ) : null}

          <datalist id="order-bottle-size-suggestions">
            {bottleSizeSuggestions.map((s) => (
              <option key={s} value={s} />
            ))}
          </datalist>

          <div className="overflow-x-auto rounded-lg border border-stroke dark:border-dark-3">
            <table className="w-full min-w-[1020px] border-collapse text-sm">
              <thead className="bg-gray-2/60 dark:bg-dark-2">
                <tr className="border-b border-stroke text-left dark:border-dark-3">
                  <th className="px-3 py-2">Product</th>
                  <th className="px-3 py-2">Bottle Type</th>
                  <th className="px-3 py-2">Bottle size</th>
                  <th className="px-3 py-2">Qty</th>
                  <th className="px-3 py-2">Unit Price</th>
                  <th className="px-3 py-2">Line Total</th>
                  <th className="px-3 py-2"> </th>
                </tr>
              </thead>
              <tbody>
                {items.map((item, index) => {
                  const qty = Number(item.quantity);
                  const unitPrice = Number(item.unitPrice);
                  const lineTotal =
                    Number.isFinite(qty) &&
                      qty > 0 &&
                      Number.isFinite(unitPrice) &&
                      unitPrice >= 0
                      ? qty * unitPrice
                      : 0;
                  return (
                    <tr key={index} className="border-b border-stroke dark:border-dark-3">
                      <td className="px-3 py-3">
                        <select
                          className="w-full min-w-[200px] rounded border border-stroke bg-transparent px-2 py-1 dark:border-dark-3 dark:bg-dark-2"
                          value={item.productName}
                          disabled={
                            form.clientId === "" ||
                            clientLabelsLoading ||
                            clientLabels.length === 0
                          }
                          onChange={(e) =>
                            updateItem(index, { productName: e.target.value })
                          }
                        >
                          <option value="">
                            {form.clientId === ""
                              ? "Select a client first"
                              : clientLabelsError
                                ? "Could not load labels — see message above"
                                : clientLabelsLoading
                                  ? "Loading labels…"
                                  : clientLabels.length === 0
                                    ? "No labels — add under Clients → edit"
                                    : "Select label…"}
                          </option>
                          {clientLabels.map((l) => (
                            <option key={l.id} value={l.labelName}>
                              {l.labelName}
                            </option>
                          ))}
                        </select>
                      </td>
                      <td className="px-3 py-3">
                        <select
                          className="rounded border border-stroke bg-transparent px-2 py-1 dark:border-dark-3"
                          value={item.bottleType}
                          onChange={(e) =>
                            updateItem(index, {
                              bottleType: e.target.value as DraftItem["bottleType"],
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
                          list="order-bottle-size-suggestions"
                          value={item.bottleSize}
                          onChange={(e) =>
                            updateItem(index, { bottleSize: e.target.value })
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
                          onChange={(e) =>
                            updateItem(index, { quantity: e.target.value })
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
                          onChange={(e) =>
                            updateItem(index, { unitPrice: e.target.value })
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
              Order total:{" "}
              <span className="font-semibold text-dark dark:text-white">{draftTotal.toFixed(2)}</span>
            </span>
          </div>

          <button
            type="submit"
            disabled={saving || !advanceValid}
            className="rounded-lg bg-primary px-5 py-3 font-medium text-white hover:bg-opacity-90 disabled:opacity-60"
          >
            {saving ? "Saving..." : "Create order"}
          </button>
        </form>
      </section>

      <section className="rounded-[10px] border border-stroke/80 bg-white p-6 shadow-1 dark:border-dark-3 dark:bg-gray-dark dark:shadow-card">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <h2 className="text-xl font-semibold text-dark dark:text-white">All orders</h2>
            <p className="mt-1 text-sm text-dark-5 dark:text-dark-6">
              Search by invoice, client, order #, or product. Use <strong className="font-medium text-dark dark:text-white">Invoice PDF</strong> for a printable bill.
            </p>
          </div>
          <div className="flex w-full max-w-md flex-wrap items-end gap-2 sm:w-auto">
            <div className="min-w-[200px] flex-1">
              <label htmlFor="order-search" className="sr-only">
                Search orders
              </label>
              <input
                id="order-search"
                className="h-10 w-full rounded-lg border border-stroke bg-transparent px-3 text-sm dark:border-dark-3 dark:bg-dark-2"
                placeholder="Invoice, client, product…"
                value={orderSearch}
                onChange={(e) => setOrderSearch(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    void runSearch();
                  }
                }}
              />
            </div>
            <button
              type="button"
              onClick={() => void runSearch()}
              disabled={loading}
              className="h-10 shrink-0 rounded-lg bg-primary px-4 text-sm font-medium text-white hover:bg-opacity-90 disabled:opacity-60"
            >
              Search
            </button>
            {searchApplied ? (
              <button
                type="button"
                onClick={() => void clearSearch()}
                className="h-10 shrink-0 rounded-lg border border-stroke px-4 text-sm font-medium hover:bg-gray-2 dark:border-dark-3 dark:hover:bg-dark-2"
              >
                Clear
              </button>
            ) : null}
          </div>
        </div>

        <div className="mt-4 max-h-[min(calc(2.75rem+10*4.25rem),72vh)] overflow-auto rounded-md border border-stroke/50 dark:border-dark-3">
          <table className="w-full min-w-[1180px] border-collapse text-sm">
            <thead className="sticky top-0 z-10 border-b border-stroke bg-gray-2/95 text-left backdrop-blur-sm dark:border-dark-3 dark:bg-dark-2/95">
              <tr>
                <th className="px-3 py-2">Date</th>
                <th className="px-3 py-2">Client</th>
                <th className="px-3 py-2">Invoice</th>
                <th className="px-3 py-2">Payment</th>
                <th className="px-3 py-2">Order status</th>
                <th className="px-3 py-2">Items</th>
                <th className="px-3 py-2">Total</th>
                <th className="px-3 py-2">Paid</th>
                <th className="px-3 py-2">Due</th>
                <th className="px-3 py-2">Produced</th>
                <th className="px-3 py-2">Invoice PDF</th>
              </tr>
            </thead>
            <tbody>
              {orders.map((order) => {
                const pct =
                  order.orderedQty > 0
                    ? Math.min(100, Math.round((order.producedQty / order.orderedQty) * 100))
                    : 0;
                return (
                  <tr key={order.id} className="border-b border-stroke dark:border-dark-3">
                    <td className="px-3 py-3 whitespace-nowrap">{order.orderDate}</td>
                    <td className="px-3 py-3">{order.clientName}</td>
                    <td className="px-3 py-3 font-medium text-dark dark:text-white">
                      {order.invoiceNumber ?? "—"}
                    </td>
                    <td className="px-3 py-3 capitalize">{order.paymentType}</td>
                    <td className="px-3 py-3">
                      {(() => {
                        const s = getDisplayOrderStatus(order);
                        if (s === "completed") {
                          return (
                            <span className="font-semibold capitalize text-green-600 dark:text-green-400">
                              {s}
                            </span>
                          );
                        }
                        if (s === "cancelled") {
                          return (
                            <span className="capitalize text-dark-5 dark:text-dark-6">{s}</span>
                          );
                        }
                        return (
                          <span className="capitalize text-dark dark:text-white">{s}</span>
                        );
                      })()}
                    </td>
                    <td className="max-w-[240px] px-3 py-3 text-dark-5 dark:text-dark-6">
                      {order.items.length === 0
                        ? "—"
                        : order.items
                          .map(
                            (i) =>
                              `${i.productName}${i.bottleSize ? ` · ${i.bottleSize}` : ""}${i.bottleType ? ` (${i.bottleType})` : ""} × ${i.quantity}`,
                          )
                          .join(", ")}
                    </td>
                    <td className="px-3 py-3 font-medium">{order.totalAmount.toFixed(2)}</td>
                    <td className="px-3 py-3 text-green-600 dark:text-green-400">
                      {order.paidAmount.toFixed(2)}
                    </td>
                    <td className="px-3 py-3 font-medium text-red">
                      {order.outstandingAmount.toFixed(2)}
                    </td>
                    <td className="px-3 py-3">
                      <div className="flex flex-col gap-1">
                        <span className="tabular-nums text-dark-5 dark:text-dark-6">
                          {order.producedQty.toFixed(0)} / {order.orderedQty.toFixed(0)}
                        </span>
                        <div className="h-1.5 w-24 overflow-hidden rounded-full bg-gray-2 dark:bg-dark-3">
                          <div
                            className="h-full rounded-full bg-primary"
                            style={{ width: `${pct}%` }}
                          />
                        </div>
                      </div>
                    </td>
                    <td className="px-3 py-3">
                      <button
                        type="button"
                        onClick={() => void downloadPdfForOrder(order.id)}
                        className="rounded-lg border border-stroke px-3 py-1.5 text-xs font-medium hover:bg-gray-2 dark:border-dark-3 dark:hover:bg-dark-2"
                      >
                        Download PDF
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          {orders.length === 0 ? (
            <p className="mt-4 text-sm text-dark-5 dark:text-dark-6">No orders match.</p>
          ) : null}
        </div>
      </section>

      <div className="flex flex-col items-center justify-center py-3 sm:py-4">
        <p className="text-center text-2xl font-bold uppercase tracking-[0.18em] text-dark dark:text-white sm:text-3xl md:text-4xl">
          PAYMENT SECTION
        </p>
        <p className="mt-2 max-w-xl text-center text-xs text-dark-5 dark:text-dark-6 sm:text-sm">
          Record collections and review receipts and outstanding balances.
        </p>
      </div>

      <div className="rounded-[10px] border border-stroke/80 bg-white p-5 shadow-1 dark:border-dark-3 dark:bg-gray-dark dark:shadow-card">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-dark-5 dark:text-dark-6">
              Payments
            </p>
            <p className="mt-1 max-w-xl text-sm text-dark-5 dark:text-dark-6">
              Open the dialog to see order totals and record collection against an order with a balance
              (same data as production and dashboard).
            </p>
          </div>
          <button
            type="button"
            id="record-payment"
            onClick={() => {
              setError("");
              setPaymentModalOpen(true);
            }}
            className="inline-flex h-11 shrink-0 items-center justify-center rounded-lg bg-primary px-6 text-sm font-semibold text-white shadow-sm transition hover:bg-opacity-90 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary sm:min-w-[190px]"
          >
            Record a Payment
          </button>
        </div>
      </div>

      {paymentModalOpen ? (
        <div
          className="fixed inset-0 z-[100] flex items-end justify-center p-3 sm:items-center sm:p-6 md:p-8"
          role="dialog"
          aria-modal="true"
          aria-labelledby="payment-modal-title"
        >
          <button
            type="button"
            className="absolute inset-0 bg-black/55 backdrop-blur-[2px] transition-opacity dark:bg-black/70"
            aria-label="Close dialog"
            onClick={() => setPaymentModalOpen(false)}
          />
          <div className="relative z-10 flex w-full max-w-2xl flex-col overflow-hidden rounded-t-2xl border border-stroke bg-white shadow-2xl dark:border-dark-3 dark:bg-gray-dark dark:shadow-black/50 max-h-[min(96vh,1100px)] sm:max-h-[min(92vh,980px)] sm:max-w-5xl sm:rounded-2xl lg:max-w-6xl">
            <div className="flex shrink-0 items-start justify-between gap-4 border-b border-stroke bg-gray-2/40 px-6 py-5 dark:border-dark-3 dark:bg-dark-2/50 sm:px-8 sm:py-5">
              <div>
                <h2
                  id="payment-modal-title"
                  className="text-lg font-semibold tracking-tight text-dark dark:text-white"
                >
                  Record a payment
                </h2>
                <p className="mt-1 text-sm text-dark-5 dark:text-dark-6">
                  Apply a payment to an order that still has a balance (same data as production / dashboard).
                </p>
              </div>
              <button
                type="button"
                onClick={() => setPaymentModalOpen(false)}
                className="rounded-lg p-2 text-dark-5 transition hover:bg-white hover:text-dark dark:text-dark-6 dark:hover:bg-dark-2 dark:hover:text-white"
                aria-label="Close"
              >
                <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            <div className="min-h-0 flex-1 overflow-y-auto px-6 py-6 sm:px-8 sm:py-8">
              <div className="grid gap-4 sm:grid-cols-3 sm:gap-5">
                <div className="rounded-xl border border-stroke/80 bg-white p-5 shadow-sm dark:border-dark-3 dark:bg-dark-2/80">
                  <p className="text-xs text-dark-5 dark:text-dark-6">Order value (excl. cancelled)</p>
                  <p className="mt-1.5 text-xl font-semibold tabular-nums text-dark dark:text-white">
                    {moneySummary.orderValue.toFixed(2)}
                  </p>
                </div>
                <div className="rounded-xl border border-stroke/80 bg-white p-5 shadow-sm dark:border-dark-3 dark:bg-dark-2/80">
                  <p className="text-xs text-dark-5 dark:text-dark-6">Collected on orders</p>
                  <p className="mt-1.5 text-xl font-semibold tabular-nums text-green-600 dark:text-green-400">
                    {moneySummary.collected.toFixed(2)}
                  </p>
                </div>
                <div className="rounded-xl border border-stroke/80 bg-white p-5 shadow-sm dark:border-dark-3 dark:bg-dark-2/80">
                  <p className="text-xs text-dark-5 dark:text-dark-6">Balance due (orders)</p>
                  <p className="mt-1.5 text-xl font-semibold tabular-nums text-red">
                    {moneySummary.due.toFixed(2)}
                  </p>
                </div>
              </div>

              {error ? (
                <p className="mt-4 rounded-lg border border-red/30 bg-red/5 px-3 py-2 text-sm text-red" role="alert">
                  {error}
                </p>
              ) : null}

              <form onSubmit={submitPayment} className="mt-6 grid gap-4 sm:gap-5 md:grid-cols-2 lg:grid-cols-3">
          <select
            className="rounded-lg border border-stroke bg-transparent px-4 py-3 dark:border-dark-3 dark:bg-dark-2"
            value={payForm.clientId}
            onChange={(e) =>
              setPayForm((p) => ({
                ...p,
                clientId: e.target.value,
                orderId: "",
                amountPaid: "",
              }))
            }
            required
          >
            <option value="">Select client</option>
            {clients.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>

          <select
            className="rounded-lg border border-stroke bg-transparent px-4 py-3 dark:border-dark-3 dark:bg-dark-2"
            value={payForm.orderId}
            onChange={(e) => {
              const nextId = e.target.value;
              const row = orders.find((o) => String(o.id) === nextId);
              setPayForm((p) => ({
                ...p,
                orderId: nextId,
                amountPaid: row ? row.outstandingAmount.toFixed(2) : "",
              }));
            }}
            required
            disabled={!Number.isInteger(selectedPayClientId) || selectedPayClientId < 1}
          >
            <option value="">
              {Number.isInteger(selectedPayClientId) && selectedPayClientId > 0
                ? "Select order with balance"
                : "Choose a client first"}
            </option>
            {payOrderChoices.map((row) => (
              <option key={row.id} value={row.id}>
                {row.invoiceNumber ?? `Order #${row.id}`} — due {row.outstandingAmount.toFixed(2)}
              </option>
            ))}
          </select>

          <input
            type="number"
            min={0}
            step="any"
            className="rounded-lg border border-stroke bg-transparent px-4 py-3 dark:border-dark-3 dark:bg-dark-2"
            placeholder="Amount paid"
            value={payForm.amountPaid}
            onChange={(e) => setPayForm((p) => ({ ...p, amountPaid: e.target.value }))}
            required
          />

          <input
            type="date"
            className="rounded-lg border border-stroke bg-transparent px-4 py-3 dark:border-dark-3 dark:bg-dark-2"
            value={payForm.paymentDate}
            onChange={(e) => setPayForm((p) => ({ ...p, paymentDate: e.target.value }))}
            required
          />

          <select
            className="rounded-lg border border-stroke bg-transparent px-4 py-3 dark:border-dark-3 dark:bg-dark-2"
            value={payForm.paymentMethod}
            onChange={(e) => setPayForm((p) => ({ ...p, paymentMethod: e.target.value }))}
          >
            <option value="cash">Cash</option>
            <option value="bank">Bank transfer</option>
            <option value="jazzcash">JazzCash</option>
            <option value="easypaisa">Easypaisa</option>
            <option value="cheque">Cheque</option>
          </select>

          <input
            className="md:col-span-2 rounded-lg border border-stroke bg-transparent px-4 py-3 dark:border-dark-3 dark:bg-dark-2"
            placeholder="Reference note (optional)"
            value={payForm.referenceNote}
            onChange={(e) => setPayForm((p) => ({ ...p, referenceNote: e.target.value }))}
          />

                <button
                  type="submit"
                  disabled={paySaving}
                  className="rounded-lg bg-primary px-4 py-3 font-medium text-white hover:bg-opacity-90 disabled:opacity-60"
                >
                  {paySaving ? "Recording…" : "Record payment"}
                </button>
              </form>

              {selectedPayOrderRow ? (
                <p className="mt-4 rounded-lg border border-stroke/60 bg-gray-2/30 px-3 py-2.5 text-sm text-dark-5 dark:border-dark-3 dark:bg-dark-2/40 dark:text-dark-6">
                  Order total {selectedPayOrderRow.totalAmount.toFixed(2)} · Paid{" "}
                  {selectedPayOrderRow.paidAmount.toFixed(2)} · Due{" "}
                  <span className="font-medium text-red">
                    {selectedPayOrderRow.outstandingAmount.toFixed(2)}
                  </span>
                </p>
              ) : null}
            </div>
          </div>
        </div>
      ) : null}

      <section className="rounded-[10px] border border-stroke/80 bg-white p-6 shadow-1 dark:border-dark-3 dark:bg-gray-dark dark:shadow-card">
        <h2 className="text-xl font-semibold text-dark dark:text-white">Payment history</h2>
        <p className="mt-1 text-sm text-dark-5 dark:text-dark-6">Receipt PDFs for money already received.</p>
        <div className="mt-4">
          <label htmlFor="payment-history-search" className="sr-only">
            Search payment history
          </label>
          <input
            id="payment-history-search"
            type="search"
            className="h-10 w-full max-w-xl rounded-lg border border-stroke bg-transparent px-3 text-sm dark:border-dark-3 dark:bg-dark-2"
            placeholder="Search receipt, client, invoice, method, amount…"
            value={paymentHistoryFilter}
            onChange={(e) => setPaymentHistoryFilter(e.target.value)}
          />
        </div>
        <div className="mt-4 max-h-[min(calc(2.75rem+10*4.25rem),60vh)] overflow-auto rounded-md border border-stroke/50 dark:border-dark-3">
          <table className="w-full min-w-[1000px] border-collapse text-sm">
            <thead className="sticky top-0 z-10 border-b border-stroke bg-gray-2/95 text-left backdrop-blur-sm dark:border-dark-3 dark:bg-dark-2/95">
              <tr>
                <th className="px-3 py-2">Date</th>
                <th className="px-3 py-2">Receipt #</th>
                <th className="px-3 py-2">Client</th>
                <th className="px-3 py-2">Invoice</th>
                <th className="px-3 py-2">Method</th>
                <th className="px-3 py-2">Amount</th>
                <th className="px-3 py-2">Receipt PDF</th>
              </tr>
            </thead>
            <tbody>
              {filteredPaymentsList.map((payment) => {
                return (
                  <tr key={payment.id} className="border-b border-stroke dark:border-dark-3">
                    <td className="px-3 py-3 whitespace-nowrap">{payment.paymentDate}</td>
                    <td className="px-3 py-3 font-medium">{payment.receiptNumber}</td>
                    <td className="px-3 py-3">{payment.clientName}</td>
                    <td className="px-3 py-3">{payment.invoiceNumber ?? "—"}</td>
                    <td className="px-3 py-3 capitalize">{payment.paymentMethod}</td>
                    <td className="px-3 py-3 font-medium">{payment.amountPaid.toFixed(2)}</td>
                    <td className="px-3 py-3">
                      <button
                        type="button"
                        onClick={() =>
                          void downloadPaymentReceiptPdf(
                            toPaymentReceiptInput(payment, paymentsList),
                          )
                        }
                        className="rounded-lg border border-stroke px-3 py-1.5 text-xs font-medium hover:bg-gray-2 dark:border-dark-3 dark:hover:bg-dark-2"
                      >
                        Download
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          {paymentsList.length === 0 ? (
            <p className="p-4 text-sm text-dark-5 dark:text-dark-6">No payments yet.</p>
          ) : filteredPaymentsList.length === 0 ? (
            <p className="p-4 text-sm text-dark-5 dark:text-dark-6">No rows match your search.</p>
          ) : null}
        </div>
      </section>

      <section className="rounded-[10px] border border-stroke/80 bg-white p-6 shadow-1 dark:border-dark-3 dark:bg-gray-dark dark:shadow-card">
        <h2 className="text-xl font-semibold text-dark dark:text-white">Orders with Pending Payments</h2>
        <p className="mt-1 text-sm text-dark-5 dark:text-dark-6">
          Same rows as <span className="font-medium text-dark dark:text-white">All orders</span> above,
          filtered to balances &gt; 0.
        </p>
        <div className="mt-4">
          <label htmlFor="pending-orders-search" className="sr-only">
            Search orders with pending payment
          </label>
          <input
            id="pending-orders-search"
            type="search"
            className="h-10 w-full max-w-xl rounded-lg border border-stroke bg-transparent px-3 text-sm dark:border-dark-3 dark:bg-dark-2"
            placeholder="Search invoice, client, order #, date, amounts…"
            value={pendingOrdersFilter}
            onChange={(e) => setPendingOrdersFilter(e.target.value)}
          />
        </div>
        <div className="mt-4 max-h-[min(calc(2.75rem+10*4.25rem),60vh)] overflow-auto rounded-md border border-stroke/50 dark:border-dark-3">
          <table className="w-full min-w-[720px] border-collapse text-sm">
            <thead className="sticky top-0 z-10 border-b border-stroke bg-gray-2/95 text-left backdrop-blur-sm dark:border-dark-3 dark:bg-dark-2/95">
              <tr>
                <th className="px-3 py-2 text-left">Invoice</th>
                <th className="px-3 py-2 text-left">Client</th>
                <th className="px-3 py-2 text-left">Date</th>
                <th className="px-3 py-2 text-right">Total</th>
                <th className="px-3 py-2 text-right">Paid</th>
                <th className="px-3 py-2 text-right">Due</th>
              </tr>
            </thead>
            <tbody>
              {filteredOutstandingRows.map((row) => (
                <tr key={row.id} className="border-b border-stroke dark:border-dark-3">
                  <td className="px-3 py-3 font-medium">{row.invoiceNumber ?? `Order #${row.id}`}</td>
                  <td className="px-3 py-3">{row.clientName}</td>
                  <td className="px-3 py-3 whitespace-nowrap">{row.orderDate}</td>
                  <td className="px-3 py-3 text-right">{row.totalAmount.toFixed(2)}</td>
                  <td className="px-3 py-3 text-right text-green-600 dark:text-green-400">
                    {row.paidAmount.toFixed(2)}
                  </td>
                  <td className="px-3 py-3 text-right font-medium text-red">
                    {row.outstandingAmount.toFixed(2)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {outstandingRows.length === 0 ? (
            <p className="p-4 text-sm text-dark-5 dark:text-dark-6">No outstanding balances.</p>
          ) : filteredOutstandingRows.length === 0 ? (
            <p className="p-4 text-sm text-dark-5 dark:text-dark-6">No rows match your search.</p>
          ) : null}
        </div>
      </section>
    </div>
  );
}
