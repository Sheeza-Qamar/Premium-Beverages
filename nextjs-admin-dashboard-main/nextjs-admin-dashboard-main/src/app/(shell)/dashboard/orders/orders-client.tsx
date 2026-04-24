"use client";

import { useEffect, useMemo, useState } from "react";

type Client = { id: number; name: string };

type OrderItem = {
  id: number;
  productName: string;
  bottleType: "mix" | "pure" | null;
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
  items: OrderItem[];
};

type DraftItem = {
  productName: string;
  bottleType: "" | "mix" | "pure";
  quantity: string;
  unitPrice: string;
};

export function OrdersClient() {
  const [clients, setClients] = useState<Client[]>([]);
  const [orders, setOrders] = useState<OrderRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const [form, setForm] = useState({
    clientId: "",
    orderDate: new Date().toISOString().slice(0, 10),
    paymentType: "credit" as "credit" | "cash",
    status: "pending" as "pending" | "completed" | "cancelled",
    invoiceNumber: "",
    notes: "",
  });

  const [items, setItems] = useState<DraftItem[]>([
    { productName: "", bottleType: "", quantity: "", unitPrice: "" },
  ]);

  const loadClients = async () => {
    const r = await fetch("/api/clients", { cache: "no-store" });
    if (!r.ok) {
      const p = (await r.json().catch(() => null)) as { message?: string } | null;
      throw new Error(p?.message ?? "Failed to load clients.");
    }
    const data = (await r.json()) as { clients: Array<{ id: number; name: string }> };
    setClients(data.clients.map((c) => ({ id: c.id, name: c.name })));
  };

  const loadOrders = async () => {
    const r = await fetch("/api/orders", { cache: "no-store" });
    if (!r.ok) {
      const p = (await r.json().catch(() => null)) as { message?: string } | null;
      throw new Error(p?.message ?? "Failed to load orders.");
    }
    const data = (await r.json()) as { orders: OrderRecord[] };
    setOrders(data.orders);
  };

  useEffect(() => {
    void (async () => {
      setLoading(true);
      setError("");
      try {
        await Promise.all([loadClients(), loadOrders()]);
      } catch (e) {
        setError(e instanceof Error ? e.message : "Unable to load orders module.");
      } finally {
        setLoading(false);
      }
    })();
  }, []);

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

  const addItemRow = () => {
    setItems((prev) => [
      ...prev,
      { productName: "", bottleType: "", quantity: "", unitPrice: "" },
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

  const createOrder = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setSaving(true);
    setError("");
    try {
      const clientId = Number(form.clientId);
      if (!Number.isInteger(clientId) || clientId < 1) {
        setError("Please select a client.");
        return;
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
        setError("Add at least one valid item.");
        return;
      }

      const r = await fetch("/api/orders", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          clientId,
          orderDate: form.orderDate,
          paymentType: form.paymentType,
          status: form.status,
          invoiceNumber: form.invoiceNumber.trim() || null,
          notes: form.notes.trim() || null,
          items: payloadItems,
        }),
      });

      if (!r.ok) {
        const p = (await r.json().catch(() => null)) as { message?: string } | null;
        throw new Error(p?.message ?? "Could not create order.");
      }

      setForm((prev) => ({
        ...prev,
        invoiceNumber: "",
        notes: "",
      }));
      setItems([{ productName: "", bottleType: "", quantity: "", unitPrice: "" }]);
      await loadOrders();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not create order.");
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="rounded-[10px] bg-white p-6 shadow-1 dark:bg-gray-dark dark:shadow-card">
        <p>Loading orders...</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <section className="rounded-[10px] bg-white p-6 shadow-1 dark:bg-gray-dark dark:shadow-card">
        <h2 className="text-xl font-semibold text-dark dark:text-white">Create order</h2>
        <p className="mt-1 text-sm text-dark-5 dark:text-dark-6">
          Create sales orders per client with cash/credit payment and item-level details.
        </p>

        {error ? <p className="mt-3 text-sm text-red">{error}</p> : null}

        <form onSubmit={createOrder} className="mt-4 space-y-4">
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
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
              <option value="pending">Pending</option>
              <option value="completed">Completed</option>
              <option value="cancelled">Cancelled</option>
            </select>

            <input
              className="rounded-lg border border-stroke bg-transparent px-4 py-3 dark:border-dark-3 dark:bg-dark-2"
              placeholder="Invoice number (optional)"
              value={form.invoiceNumber}
              onChange={(e) =>
                setForm((prev) => ({ ...prev, invoiceNumber: e.target.value }))
              }
            />

            <input
              className="rounded-lg border border-stroke bg-transparent px-4 py-3 dark:border-dark-3 dark:bg-dark-2"
              placeholder="Notes (optional)"
              value={form.notes}
              onChange={(e) =>
                setForm((prev) => ({ ...prev, notes: e.target.value }))
              }
            />
          </div>

          <div className="overflow-x-auto">
            <table className="w-full min-w-[900px] border-collapse text-sm">
              <thead>
                <tr className="border-b border-stroke text-left dark:border-dark-3">
                  <th className="px-3 py-2">Product</th>
                  <th className="px-3 py-2">Bottle Type</th>
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
                        <input
                          className="w-full min-w-[180px] rounded border border-stroke bg-transparent px-2 py-1 dark:border-dark-3"
                          value={item.productName}
                          onChange={(e) =>
                            updateItem(index, { productName: e.target.value })
                          }
                          placeholder="Product name"
                        />
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
              Draft total: <span className="font-medium text-dark dark:text-white">{draftTotal.toFixed(2)}</span>
            </span>
          </div>

          <button
            type="submit"
            disabled={saving}
            className="rounded-lg bg-primary px-4 py-3 font-medium text-white hover:bg-opacity-90 disabled:opacity-60"
          >
            {saving ? "Saving..." : "Create order"}
          </button>
        </form>
      </section>

      <section className="rounded-[10px] bg-white p-6 shadow-1 dark:bg-gray-dark dark:shadow-card">
        <h2 className="text-xl font-semibold text-dark dark:text-white">Recent orders</h2>
        <div className="mt-4 overflow-x-auto">
          <table className="w-full min-w-[1000px] border-collapse text-sm">
            <thead>
              <tr className="border-b border-stroke text-left dark:border-dark-3">
                <th className="px-3 py-2">Date</th>
                <th className="px-3 py-2">Client</th>
                <th className="px-3 py-2">Payment</th>
                <th className="px-3 py-2">Status</th>
                <th className="px-3 py-2">Invoice</th>
                <th className="px-3 py-2">Items</th>
                <th className="px-3 py-2">Total</th>
              </tr>
            </thead>
            <tbody>
              {orders.map((order) => (
                <tr key={order.id} className="border-b border-stroke dark:border-dark-3">
                  <td className="px-3 py-3 whitespace-nowrap">{order.orderDate}</td>
                  <td className="px-3 py-3">{order.clientName}</td>
                  <td className="px-3 py-3 capitalize">{order.paymentType}</td>
                  <td className="px-3 py-3 capitalize">{order.status}</td>
                  <td className="px-3 py-3">{order.invoiceNumber ?? "—"}</td>
                  <td className="px-3 py-3 text-dark-5 dark:text-dark-6">
                    {order.items.length === 0
                      ? "—"
                      : order.items
                          .map(
                            (i) =>
                              `${i.productName}${i.bottleType ? ` (${i.bottleType})` : ""} x ${i.quantity}`,
                          )
                          .join(", ")}
                  </td>
                  <td className="px-3 py-3 font-medium">{order.totalAmount.toFixed(2)}</td>
                </tr>
              ))}
            </tbody>
          </table>
          {orders.length === 0 ? (
            <p className="mt-4 text-sm text-dark-5 dark:text-dark-6">No orders yet.</p>
          ) : null}
        </div>
      </section>
    </div>
  );
}
