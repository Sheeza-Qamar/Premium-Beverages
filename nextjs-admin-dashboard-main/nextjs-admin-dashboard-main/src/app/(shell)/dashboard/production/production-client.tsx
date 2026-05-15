"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";

type Client = {
  id: number;
  name: string;
};

type ClientOrder = {
  id: number;
  orderDate: string;
  invoiceNumber: string | null;
  status: "pending" | "completed" | "cancelled";
  paymentType: "credit" | "cash";
  totalAmount: number;
  paidAmount: number;
  outstandingAmount: number;
  orderedQty: number;
  producedQty: number;
  items: Array<{
    productName: string;
    bottleType: "mix" | "pure" | null;
    bottleSize?: string | null;
  }>;
};

/** Line items first, then order date — easy to spot which order when producing. */
function formatOrderDropdownLabel(o: ClientOrder): string {
  const datePart = String(o.orderDate).slice(0, 10);
  if (o.items.length === 0) {
    const ref = o.invoiceNumber ?? `Order #${o.id}`;
    return `${ref} · ${datePart}`;
  }
  const line = o.items
    .map((i) => {
      const sz = i.bottleSize?.trim() ? ` · ${i.bottleSize.trim()}` : "";
      const bt = i.bottleType ? ` (${i.bottleType})` : "";
      return `${i.productName.trim()}${sz}${bt}`;
    })
    .join(", ");
  const maxLen = 100;
  const itemsPart = line.length > maxLen ? `${line.slice(0, maxLen - 1)}…` : line;
  return `${itemsPart} · ${datePart}`;
}

type ClientLabel = {
  id: number;
  labelName: string;
  quantityAvailable: number;
};

type ProductionRecord = {
  id: number;
  clientId: number;
  clientName: string;
  orderId: number | null;
  orderInvoiceNumber: string | null;
  bottleType: "mix" | "pure";
  quantityProduced: number;
  productionDate: string;
  notes: string | null;
  createdAt: string;
  labelUsage: Array<{
    clientLabelId: number;
    labelName: string;
    quantityUsed: number;
  }>;
  materialUsage: Array<{
    materialId: number;
    materialName: string;
    materialType: "bottle" | "label" | "other";
    quantityUsed: number;
  }>;
};

export function ProductionClient() {
  const [clients, setClients] = useState<Client[]>([]);
  const [clientOrders, setClientOrders] = useState<ClientOrder[]>([]);
  const [labels, setLabels] = useState<ClientLabel[]>([]);
  const [productions, setProductions] = useState<ProductionRecord[]>([]);
  const [productionListSearch, setProductionListSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const [form, setForm] = useState({
    clientId: "",
    orderId: "",
    quantityProduced: "",
    productionDate: new Date().toISOString().slice(0, 10),
    notes: "",
  });

  const [usageInputs, setUsageInputs] = useState<Record<number, string>>({});

  const [payForm, setPayForm] = useState({
    amount: "",
    date: new Date().toISOString().slice(0, 10),
    method: "cash",
    note: "",
  });
  const [paySaving, setPaySaving] = useState(false);
  const [payMessage, setPayMessage] = useState("");

  const selectedClientId = Number(form.clientId);
  const isClientSelected =
    Number.isInteger(selectedClientId) && selectedClientId > 0;

  const loadProductions = async () => {
    const r = await fetch("/api/production", { cache: "no-store" });
    if (!r.ok) {
      const p = (await r.json().catch(() => null)) as { message?: string } | null;
      throw new Error(p?.message ?? "Failed to load production records.");
    }
    const data = (await r.json()) as { productions: ProductionRecord[] };
    setProductions(data.productions);
  };

  const loadClients = async () => {
    const r = await fetch("/api/clients", { cache: "no-store" });
    if (!r.ok) {
      const p = (await r.json().catch(() => null)) as { message?: string } | null;
      throw new Error(p?.message ?? "Failed to load clients.");
    }
    const data = (await r.json()) as { clients: Array<{ id: number; name: string }> };
    setClients(data.clients.map((c) => ({ id: c.id, name: c.name })));
  };

  const loadClientOrders = async (clientId: number) => {
    const r = await fetch(`/api/orders?clientId=${clientId}`, { cache: "no-store" });
    if (!r.ok) {
      const p = (await r.json().catch(() => null)) as { message?: string } | null;
      throw new Error(p?.message ?? "Failed to load orders for this client.");
    }
    const data = (await r.json()) as { orders: ClientOrder[] };
    setClientOrders(
      data.orders
        .filter((o) => o.status !== "cancelled")
        .map((o) => ({
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
  };

  const loadClientLabels = async (clientId: number) => {
    const r = await fetch(`/api/clients/${clientId}`, { cache: "no-store" });
    if (!r.ok) {
      const p = (await r.json().catch(() => null)) as { message?: string } | null;
      throw new Error(p?.message ?? "Failed to load client labels.");
    }
    const data = (await r.json()) as { labels: ClientLabel[] };
    setLabels(data.labels);
    setUsageInputs({});
  };

  const initialLoad = async () => {
    setLoading(true);
    setError("");
    try {
      await Promise.all([loadClients(), loadProductions()]);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Unable to load production module.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void initialLoad();
  }, []);

  useEffect(() => {
    if (!isClientSelected) {
      setLabels([]);
      setUsageInputs({});
      setClientOrders([]);
      setForm((p) => ({ ...p, orderId: "" }));
      return;
    }
    void (async () => {
      try {
        await Promise.all([
          loadClientLabels(selectedClientId),
          loadClientOrders(selectedClientId),
        ]);
      } catch (e) {
        setError(e instanceof Error ? e.message : "Unable to load client data.");
      }
    })();
  }, [isClientSelected, selectedClientId]);

  const selectedUsage = useMemo(() => {
    return labels
      .map((label) => {
        const raw = usageInputs[label.id]?.trim() ?? "";
        if (raw === "") return null;
        const quantityUsed = Number(raw);
        if (!Number.isFinite(quantityUsed) || quantityUsed <= 0) return null;
        return {
          clientLabelId: label.id,
          labelName: label.labelName,
          quantityUsed,
        };
      })
      .filter((x): x is { clientLabelId: number; labelName: string; quantityUsed: number } => x !== null);
  }, [labels, usageInputs]);

  const selectedOrderId = Number(form.orderId);
  const selectedOrder = useMemo(() => {
    if (!Number.isInteger(selectedOrderId) || selectedOrderId < 1) return null;
    return clientOrders.find((o) => o.id === selectedOrderId) ?? null;
  }, [clientOrders, selectedOrderId]);

  /** Default label usage = bottles produced this run (each field stays editable). */
  useEffect(() => {
    if (labels.length === 0) return;
    const qty = form.quantityProduced.trim();

    setUsageInputs((prev) => {
      const next = { ...prev };

      if (labels.length === 1) {
        next[labels[0].id] = qty;
        return next;
      }

      if (selectedOrder?.items?.length) {
        const orderNames = new Set(
          selectedOrder.items.map((i) => i.productName.trim().toLowerCase()),
        );
        let matchedAny = false;
        for (const label of labels) {
          if (orderNames.has(label.labelName.trim().toLowerCase())) {
            matchedAny = true;
            next[label.id] = qty;
          }
        }
        if (!matchedAny) {
          for (const label of labels) {
            next[label.id] = qty;
          }
        }
        return next;
      }

      return prev;
    });
  }, [form.quantityProduced, labels, selectedOrder]);

  /** Bottle type(s) recorded on the order lines — production must match exactly one. */
  const orderBottleTypeForProduction = useMemo(() => {
    if (!selectedOrder?.items?.length) return null;
    const types = new Set(
      selectedOrder.items
        .map((i) => i.bottleType)
        .filter((t): t is "mix" | "pure" => t === "mix" || t === "pure"),
    );
    if (types.size === 0) return "missing" as const;
    if (types.size > 1) return "ambiguous" as const;
    return [...types][0] as "mix" | "pure";
  }, [selectedOrder]);

  const remainingProductionQty = useMemo(() => {
    if (!selectedOrder) return null;
    return Math.max(0, selectedOrder.orderedQty - selectedOrder.producedQty);
  }, [selectedOrder]);

  /** Distinct bottle sizes recorded on the selected order (read-only for production). */
  const orderBottleSizesDisplay = useMemo(() => {
    if (!selectedOrder?.items?.length) return null;
    const sizes = [
      ...new Set(
        selectedOrder.items
          .map((i) => (i.bottleSize ?? "").trim())
          .filter(Boolean),
      ),
    ];
    return sizes.length > 0 ? sizes.join(", ") : null;
  }, [selectedOrder]);

  const orderFullyProduced =
    selectedOrder !== null &&
    selectedOrder.orderedQty > 0 &&
    selectedOrder.producedQty >= selectedOrder.orderedQty;

  const bottleTypeOkForProduction =
    orderBottleTypeForProduction === "mix" || orderBottleTypeForProduction === "pure";

  const cannotRecordProduction =
    selectedOrder !== null &&
    (selectedOrder.orderedQty <= 0 ||
      orderFullyProduced ||
      !bottleTypeOkForProduction ||
      (remainingProductionQty !== null && remainingProductionQty <= 0));

  const filteredProductions = useMemo(() => {
    const q = productionListSearch.trim().toLowerCase();
    if (!q) return productions;
    return productions.filter((p) => {
      const materials = p.materialUsage
        .map((u) => `${u.materialName} ${u.materialType} ${u.quantityUsed}`)
        .join(" ");
      const labels = p.labelUsage.map((u) => `${u.labelName} ${u.quantityUsed}`).join(" ");
      const blob = [
        p.productionDate,
        p.clientName,
        p.orderInvoiceNumber ?? "",
        p.orderId != null ? String(p.orderId) : "",
        p.bottleType,
        String(p.quantityProduced),
        p.notes ?? "",
        materials,
        labels,
        String(p.id),
      ]
        .join(" ")
        .toLowerCase();
      return blob.includes(q);
    });
  }, [productions, productionListSearch]);

  useEffect(() => {
    setPayMessage("");
    setPayForm((p) => ({ ...p, amount: "", note: "" }));
  }, [form.orderId]);

  const submitOrderPayment = async () => {
    if (!selectedOrder || !isClientSelected) return;
    const amt = Number(payForm.amount);
    if (!Number.isFinite(amt) || amt <= 0) {
      setError("Enter a valid payment amount.");
      return;
    }
    setPaySaving(true);
    setError("");
    setPayMessage("");
    try {
      const r = await fetch("/api/payments", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          clientId: selectedClientId,
          orderId: selectedOrder.id,
          amountPaid: amt,
          paymentDate: payForm.date,
          paymentMethod: payForm.method,
          referenceNote: payForm.note.trim() || null,
        }),
      });
      if (!r.ok) {
        const p = (await r.json().catch(() => null)) as { message?: string } | null;
        throw new Error(p?.message ?? "Could not record payment.");
      }
      setPayForm((p) => ({
        ...p,
        amount: "",
        note: "",
        date: new Date().toISOString().slice(0, 10),
      }));
      setPayMessage("Payment saved.");
      await loadClientOrders(selectedClientId);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not record payment.");
    } finally {
      setPaySaving(false);
    }
  };

  const submitProduction = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setSaving(true);
    setError("");
    try {
      if (!isClientSelected) {
        setError("Please select a client.");
        return;
      }
      const orderIdNum = Number(form.orderId);
      if (!Number.isInteger(orderIdNum) || orderIdNum < 1) {
        setError("Select the order this production fulfills.");
        return;
      }
      const quantityProduced = Number(form.quantityProduced);
      if (!Number.isFinite(quantityProduced) || quantityProduced <= 0) {
        setError("Quantity produced must be greater than zero.");
        return;
      }
      if (orderBottleTypeForProduction === "missing") {
        setError(
          "This order has no bottle type on its line items. Fix the order under Orders, then try again.",
        );
        return;
      }
      if (orderBottleTypeForProduction === "ambiguous") {
        setError(
          "This order mixes mix and pure bottle types on different lines. Use separate orders for production.",
        );
        return;
      }
      if (orderBottleTypeForProduction !== "mix" && orderBottleTypeForProduction !== "pure") {
        setError(
          "This order has no product lines or no valid bottle type. Update the order, then try again.",
        );
        return;
      }
      if (selectedOrder) {
        const remaining = Math.max(0, selectedOrder.orderedQty - selectedOrder.producedQty);
        if (quantityProduced > remaining) {
          setError(
            `Quantity cannot exceed what is left on this order (${remaining} remaining; ordered ${selectedOrder.orderedQty}, already produced ${selectedOrder.producedQty}).`,
          );
          return;
        }
      }
      if (selectedUsage.length === 0) {
        setError("Please enter at least one label usage quantity.");
        return;
      }

      const r = await fetch("/api/production", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          clientId: selectedClientId,
          orderId: orderIdNum,
          bottleType: orderBottleTypeForProduction,
          quantityProduced,
          productionDate: form.productionDate,
          notes: form.notes.trim() || null,
          materialUsages: [],
          labelUsages: selectedUsage.map((u) => ({
            clientLabelId: u.clientLabelId,
            quantityUsed: u.quantityUsed,
          })),
        }),
      });

      if (!r.ok) {
        const p = (await r.json().catch(() => null)) as { message?: string } | null;
        throw new Error(p?.message ?? "Could not record production.");
      }

      setForm((prev) => ({
        ...prev,
        orderId: "",
        quantityProduced: "",
        notes: "",
      }));
      setUsageInputs({});
      await Promise.all([
        loadProductions(),
        loadClientLabels(selectedClientId),
        loadClientOrders(selectedClientId),
      ]);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not record production.");
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="rounded-[10px] bg-white p-6 shadow-1 dark:bg-gray-dark dark:shadow-card">
        <p>Loading production module...</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <section className="rounded-[10px] bg-white p-6 shadow-1 dark:bg-gray-dark dark:shadow-card">
        <h2 className="text-xl font-semibold text-dark dark:text-white">
          Record production
        </h2>
        <p className="mt-1 text-sm text-dark-5 dark:text-dark-6">
          Production runs are tied to a client order (order first, then production). Bottle type and
          size come from the order lines. Saving deducts labels from the client&apos;s label stock
          only.
        </p>

        {error ? <p className="mt-3 text-sm text-red">{error}</p> : null}

        <form onSubmit={submitProduction} className="mt-4 space-y-4">
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            <select
              className="rounded-lg border border-stroke bg-transparent px-4 py-3 dark:border-dark-3 dark:bg-dark-2"
              value={form.clientId}
              onChange={(e) =>
                setForm((prev) => ({
                  ...prev,
                  clientId: e.target.value,
                  orderId: "",
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
              value={form.orderId}
              onChange={(e) => {
                const oid = e.target.value;
                setForm((prev) => ({ ...prev, orderId: oid }));
              }}
              required={isClientSelected}
              disabled={!isClientSelected}
            >
              <option value="">
                {isClientSelected ? "Select order…" : "Choose a client first"}
              </option>
              {clientOrders.map((o) => (
                <option key={o.id} value={o.id}>
                  {formatOrderDropdownLabel(o)}
                </option>
              ))}
            </select>

            {isClientSelected && clientOrders.length === 0 ? (
              <p className="md:col-span-2 lg:col-span-3 text-sm text-dark-5 dark:text-dark-6">
                No active orders for this client. Create an order under{" "}
                <Link href="/dashboard/orders" className="font-medium text-primary hover:underline">
                  Orders
                </Link>{" "}
                before recording production.
              </p>
            ) : null}

            {selectedOrder ? (
              <div className="md:col-span-2 lg:col-span-3 space-y-3 rounded-xl border border-stroke bg-gray-2/50 p-4 dark:border-dark-3 dark:bg-dark-2/30">
                <div>
                  <p className="text-[11px] font-semibold uppercase tracking-wider text-dark-5 dark:text-dark-6">
                    Order & payments
                  </p>
                  <p className="mt-1 text-sm font-semibold text-dark dark:text-white">
                    {selectedOrder.invoiceNumber ?? `Order #${selectedOrder.id}`}
                  </p>
                  <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs text-dark-5 dark:text-dark-6">
                    <span>
                      Total{" "}
                      <span className="font-medium text-dark dark:text-white">
                        {selectedOrder.totalAmount.toFixed(2)}
                      </span>
                    </span>
                    <span>
                      Paid{" "}
                      <span className="font-medium text-green-600 dark:text-green-400">
                        {selectedOrder.paidAmount.toFixed(2)}
                      </span>
                    </span>
                    <span>
                      Due{" "}
                      <span className="font-medium text-red">
                        {selectedOrder.outstandingAmount.toFixed(2)}
                      </span>
                    </span>
                    <span>
                      Produced / ordered{" "}
                      <span className="font-medium text-dark dark:text-white">
                        {selectedOrder.producedQty.toFixed(0)} / {selectedOrder.orderedQty.toFixed(0)}
                      </span>
                    </span>
                  </div>
                </div>

                {selectedOrder && orderBottleTypeForProduction === null ? (
                  <div
                    className="rounded-lg border border-amber-500/40 bg-amber-500/10 px-3 py-2.5 text-sm text-dark dark:text-white"
                    role="status"
                  >
                    <span className="font-medium">No product lines</span> on this order. Add
                    items under{" "}
                    <Link href="/dashboard/orders" className="text-primary underline-offset-2 hover:underline">
                      Orders
                    </Link>{" "}
                    before recording production.
                  </div>
                ) : null}
                {orderBottleTypeForProduction === "missing" ? (
                  <div
                    className="rounded-lg border border-amber-500/40 bg-amber-500/10 px-3 py-2.5 text-sm text-dark dark:text-white"
                    role="status"
                  >
                    <span className="font-medium">Bottle type missing</span> on this order&apos;s
                    lines. Set bottle type on each item under{" "}
                    <Link href="/dashboard/orders" className="text-primary underline-offset-2 hover:underline">
                      Orders
                    </Link>{" "}
                    before recording production.
                  </div>
                ) : null}
                {orderBottleTypeForProduction === "ambiguous" ? (
                  <div
                    className="rounded-lg border border-amber-500/40 bg-amber-500/10 px-3 py-2.5 text-sm text-dark dark:text-white"
                    role="status"
                  >
                    <span className="font-medium">Mixed bottle types</span> on this order (some
                    lines mix, some pure). Split into separate orders so each order has one bottle
                    type, then record production.
                  </div>
                ) : null}
                {orderFullyProduced ? (
                  <div
                    className="rounded-lg border border-primary/35 bg-primary/8 px-3 py-2.5 text-sm text-dark dark:text-white"
                    role="status"
                  >
                    <span className="font-medium">Fully produced</span> for this order&apos;s line
                    quantities. Record any balance payment below, or use{" "}
                    <Link
                      href="/dashboard/orders#record-payment"
                      className="text-primary underline-offset-2 hover:underline"
                    >
                      Orders &amp; payments
                    </Link>
                    .
                  </div>
                ) : null}

                {selectedOrder.outstandingAmount > 0 ? (
                  <div className="border-t border-stroke pt-3 dark:border-dark-3">
                    <p className="text-sm font-medium text-dark dark:text-white">
                      Record payment (same order)
                    </p>
                    <div className="mt-2 grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
                      <input
                        type="number"
                        min={0}
                        step="any"
                        className="rounded-lg border border-stroke bg-white px-3 py-2 text-sm dark:border-dark-3 dark:bg-dark-2"
                        placeholder="Amount"
                        value={payForm.amount}
                        onChange={(e) =>
                          setPayForm((p) => ({ ...p, amount: e.target.value }))
                        }
                      />
                      <input
                        type="date"
                        className="rounded-lg border border-stroke bg-white px-3 py-2 text-sm dark:border-dark-3 dark:bg-dark-2"
                        value={payForm.date}
                        onChange={(e) =>
                          setPayForm((p) => ({ ...p, date: e.target.value }))
                        }
                      />
                      <select
                        className="rounded-lg border border-stroke bg-white px-3 py-2 text-sm dark:border-dark-3 dark:bg-dark-2"
                        value={payForm.method}
                        onChange={(e) =>
                          setPayForm((p) => ({ ...p, method: e.target.value }))
                        }
                      >
                        <option value="cash">Cash</option>
                        <option value="bank">Bank transfer</option>
                        <option value="jazzcash">JazzCash</option>
                        <option value="easypaisa">Easypaisa</option>
                        <option value="cheque">Cheque</option>
                      </select>
                      <input
                        className="rounded-lg border border-stroke bg-white px-3 py-2 text-sm dark:border-dark-3 dark:bg-dark-2"
                        placeholder="Reference / note"
                        value={payForm.note}
                        onChange={(e) =>
                          setPayForm((p) => ({ ...p, note: e.target.value }))
                        }
                      />
                    </div>
                    <button
                      type="button"
                      disabled={paySaving}
                      onClick={() => void submitOrderPayment()}
                      className="mt-2 rounded-lg border border-stroke bg-white px-4 py-2 text-sm font-medium hover:bg-gray-2 dark:border-dark-3 dark:bg-dark-2 dark:hover:bg-dark-3 disabled:opacity-60"
                    >
                      {paySaving ? "Saving…" : "Record payment"}
                    </button>
                    {payMessage ? (
                      <p className="mt-2 text-sm text-green-600 dark:text-green-400">{payMessage}</p>
                    ) : null}
                  </div>
                ) : (
                  <p className="text-sm text-green-600 dark:text-green-400">
                    No balance due on this order.
                  </p>
                )}
              </div>
            ) : null}

            <div className="rounded-lg border border-stroke bg-gray-2/40 px-4 py-3 dark:border-dark-3 dark:bg-dark-2/40">
              <p className="text-[11px] font-semibold uppercase tracking-wide text-dark-5 dark:text-dark-6">
                Bottle type (from order)
              </p>
              <p className="mt-1 text-sm font-medium capitalize text-dark dark:text-white">
                {!selectedOrder
                  ? "— select an order"
                  : orderBottleTypeForProduction === null
                    ? "— no line items"
                    : orderBottleTypeForProduction === "missing" ||
                        orderBottleTypeForProduction === "ambiguous"
                      ? "— see notice above"
                      : orderBottleTypeForProduction}
              </p>
            </div>

            <div className="rounded-lg border border-stroke bg-gray-2/40 px-4 py-3 dark:border-dark-3 dark:bg-dark-2/40">
              <p className="text-[11px] font-semibold uppercase tracking-wide text-dark-5 dark:text-dark-6">
                Bottle size (from order)
              </p>
              <p className="mt-1 text-sm font-medium text-dark dark:text-white">
                {!selectedOrder
                  ? "— select an order"
                  : !orderBottleSizesDisplay
                    ? "— not set on order lines"
                    : orderBottleSizesDisplay}
              </p>
            </div>

            <div className="space-y-1">
              <input
                type="number"
                min={0}
                step="any"
                max={
                  remainingProductionQty !== null && remainingProductionQty > 0
                    ? remainingProductionQty
                    : undefined
                }
                className="w-full rounded-lg border border-stroke bg-transparent px-4 py-3 dark:border-dark-3 dark:bg-dark-2"
                placeholder="Quantity produced"
                value={form.quantityProduced}
                onChange={(e) =>
                  setForm((prev) => ({ ...prev, quantityProduced: e.target.value }))
                }
                disabled={!selectedOrder || cannotRecordProduction}
                required
              />
              {selectedOrder && remainingProductionQty !== null && !cannotRecordProduction ? (
                <p className="text-xs text-dark-5 dark:text-dark-6">
                  Max this run:{" "}
                  <span className="font-medium text-dark dark:text-white">
                    {remainingProductionQty}
                  </span>{" "}
                  (ordered {selectedOrder.orderedQty}, already produced {selectedOrder.producedQty}).
                </p>
              ) : null}
            </div>

            <input
              type="date"
              className="rounded-lg border border-stroke bg-transparent px-4 py-3 dark:border-dark-3 dark:bg-dark-2"
              value={form.productionDate}
              onChange={(e) =>
                setForm((prev) => ({ ...prev, productionDate: e.target.value }))
              }
              required
            />

            <input
              className="md:col-span-2 rounded-lg border border-stroke bg-transparent px-4 py-3 dark:border-dark-3 dark:bg-dark-2"
              placeholder="Notes (optional)"
              value={form.notes}
              onChange={(e) => setForm((prev) => ({ ...prev, notes: e.target.value }))}
            />
          </div>

          <div className="overflow-x-auto">
            <table className="w-full min-w-[620px] border-collapse text-sm">
              <thead>
                <tr className="border-b border-stroke text-left dark:border-dark-3">
                  <th className="px-3 py-2">Label</th>
                  <th className="px-3 py-2">Available</th>
                  <th className="px-3 py-2">Use in this production</th>
                </tr>
              </thead>
              <tbody>
                {labels.map((label) => (
                  <tr key={label.id} className="border-b border-stroke dark:border-dark-3">
                    <td className="px-3 py-3">{label.labelName}</td>
                    <td className="px-3 py-3">{label.quantityAvailable}</td>
                    <td className="px-3 py-3">
                      <input
                        type="number"
                        min={0}
                        step="any"
                        className="w-40 rounded border border-stroke bg-transparent px-2 py-1 dark:border-dark-3"
                        placeholder="0"
                        value={usageInputs[label.id] ?? ""}
                        onChange={(e) =>
                          setUsageInputs((prev) => ({
                            ...prev,
                            [label.id]: e.target.value,
                          }))
                        }
                      />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {isClientSelected && labels.length === 0 ? (
              <p className="mt-3 text-sm text-dark-5 dark:text-dark-6">
                This client has no labels configured yet.
              </p>
            ) : null}
          </div>

          <button
            type="submit"
            disabled={saving || !isClientSelected || !selectedOrder || cannotRecordProduction}
            className="rounded-lg bg-primary px-4 py-3 font-medium text-white hover:bg-opacity-90 disabled:opacity-60"
          >
            {saving ? "Saving..." : "Save production and deduct labels"}
          </button>
        </form>
      </section>

      <section className="rounded-[10px] bg-white p-6 shadow-1 dark:bg-gray-dark dark:shadow-card">
        <h2 className="text-xl font-semibold text-dark dark:text-white">
          Recent production
        </h2>
        <label htmlFor="production-list-search" className="sr-only">
          Search production records
        </label>
        <input
          id="production-list-search"
          type="search"
          value={productionListSearch}
          onChange={(e) => setProductionListSearch(e.target.value)}
          placeholder="Search date, client, order, labels, notes…"
          className="mt-3 w-full max-w-md rounded-lg border border-stroke bg-transparent px-4 py-2.5 text-sm dark:border-dark-3 dark:bg-dark-2"
        />
        <div className="mt-4 overflow-x-auto">
          <table className="w-full min-w-[1020px] border-collapse text-sm">
            <thead>
              <tr className="border-b border-stroke text-left dark:border-dark-3">
                <th className="px-3 py-2">Date</th>
                <th className="px-3 py-2">Client</th>
                <th className="px-3 py-2">Order</th>
                <th className="px-3 py-2">Bottle Type</th>
                <th className="px-3 py-2">Produced Qty</th>
                <th className="px-3 py-2">Legacy stock usage</th>
                <th className="px-3 py-2">Labels Deducted</th>
                <th className="px-3 py-2">Notes</th>
              </tr>
            </thead>
            <tbody>
              {filteredProductions.map((p) => (
                <tr key={p.id} className="border-b border-stroke dark:border-dark-3">
                  <td className="px-3 py-3 whitespace-nowrap">{p.productionDate}</td>
                  <td className="px-3 py-3">{p.clientName}</td>
                  <td className="px-3 py-3 text-dark-5 dark:text-dark-6">
                    {p.orderInvoiceNumber ??
                      (p.orderId != null ? `Order #${p.orderId}` : "—")}
                  </td>
                  <td className="px-3 py-3 capitalize">{p.bottleType}</td>
                  <td className="px-3 py-3">{p.quantityProduced}</td>
                  <td className="px-3 py-3 text-dark-5 dark:text-dark-6">
                    {p.materialUsage.length === 0
                      ? "—"
                      : p.materialUsage
                          .map(
                            (u) =>
                              `${u.materialName} (${u.materialType}: ${u.quantityUsed})`,
                          )
                          .join(", ")}
                  </td>
                  <td className="px-3 py-3 text-dark-5 dark:text-dark-6">
                    {p.labelUsage.length === 0
                      ? "—"
                      : p.labelUsage
                          .map((u) => `${u.labelName} (${u.quantityUsed})`)
                          .join(", ")}
                  </td>
                  <td className="px-3 py-3 text-dark-5 dark:text-dark-6">
                    {p.notes ?? "—"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {productions.length === 0 ? (
            <p className="mt-4 text-sm text-dark-5 dark:text-dark-6">
              No production records yet.
            </p>
          ) : filteredProductions.length === 0 ? (
            <p className="mt-4 text-sm text-dark-5 dark:text-dark-6">
              No production records match your search.
            </p>
          ) : null}
        </div>
      </section>
    </div>
  );
}
