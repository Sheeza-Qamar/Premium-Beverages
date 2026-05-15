"use client";

import { mergeBottleSizeSuggestions } from "@/lib/bottle-sizes";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";

type MaterialType = "bottle" | "label" | "other";
type Unit = "pcs" | "kg";
type BottleType = "mix" | "pure";

type InventoryItem = {
  id: number;
  name: string;
  unit: Unit;
  materialType: MaterialType;
  bottleType: BottleType | null;
  clientId: number | null;
  clientLabelId: number | null;
  clientName: string | null;
  clientLabelName: string | null;
  createdAt: string;
  quantityAvailable: number;
  lowStockThreshold: number | null;
  lastUpdated: string;
  isLowStock: boolean;
};

type ClientLite = { id: number; name: string };
type LabelLite = { id: number; labelName: string };

function materialTypeOptionsForRow(row: InventoryItem): MaterialType[] {
  const all: MaterialType[] = ["bottle", "label", "other"];
  if (row.materialType === "label" && row.clientLabelId != null) {
    return ["label"];
  }
  if (row.materialType !== "label") {
    return all.filter((t) => t !== "label");
  }
  return all;
}

export function InventoryClient() {
  const [items, setItems] = useState<InventoryItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [unauthorized, setUnauthorized] = useState(false);
  const [error, setError] = useState("");
  const [savingId, setSavingId] = useState<number | null>(null);
  const [creating, setCreating] = useState(false);
  const [stockSearch, setStockSearch] = useState("");

  const [clients, setClients] = useState<ClientLite[]>([]);
  const [labelChoicesForAdd, setLabelChoicesForAdd] = useState<LabelLite[]>([]);

  const [newMaterial, setNewMaterial] = useState({
    name: "",
    unit: "pcs" as Unit,
    materialType: "bottle" as MaterialType,
    bottleType: "mix" as BottleType,
    clientId: "",
    clientLabelId: "",
    initialQuantity: "",
    lowStockThreshold: "",
  });

  const loadAll = async () => {
    setLoading(true);
    setError("");
    setUnauthorized(false);
    try {
      const meResp = await fetch("/api/auth/me", { cache: "no-store" });
      if (!meResp.ok) {
        setUnauthorized(true);
        return;
      }

      const resp = await fetch("/api/inventory", { cache: "no-store" });
      if (resp.status === 401) {
        setUnauthorized(true);
        return;
      }
      if (!resp.ok) {
        const payload = (await resp.json().catch(() => null)) as
          | { message?: string }
          | null;
        throw new Error(payload?.message ?? "Failed to load inventory.");
      }
      const data = (await resp.json()) as { items: InventoryItem[] };
      setItems(data.items);
    } catch (e) {
      setError(
        e instanceof Error ? e.message : "Unable to load inventory.",
      );
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadAll();
  }, []);

  useEffect(() => {
    const loadClients = async () => {
      try {
        const r = await fetch("/api/clients", { cache: "no-store" });
        if (!r.ok) return;
        const data = (await r.json()) as { clients: { id: number; name: string }[] };
        setClients(data.clients.map((c) => ({ id: c.id, name: c.name })));
      } catch {
        /* ignore */
      }
    };
    void loadClients();
  }, []);

  useEffect(() => {
    if (newMaterial.materialType !== "label") {
      setLabelChoicesForAdd([]);
      return;
    }
    const cid = Number(newMaterial.clientId);
    if (!Number.isInteger(cid) || cid < 1) {
      setLabelChoicesForAdd([]);
      return;
    }
    let cancelled = false;
    (async () => {
      try {
        const r = await fetch(`/api/clients/${cid}`, { cache: "no-store" });
        if (!r.ok) {
          if (!cancelled) setLabelChoicesForAdd([]);
          return;
        }
        const data = (await r.json()) as {
          labels: { id: number; labelName: string }[];
        };
        if (!cancelled) {
          setLabelChoicesForAdd(
            data.labels.map((l) => ({ id: l.id, labelName: l.labelName })),
          );
        }
      } catch {
        if (!cancelled) setLabelChoicesForAdd([]);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [newMaterial.materialType, newMaterial.clientId]);

  const bottleSizeSuggestionList = useMemo(
    () =>
      mergeBottleSizeSuggestions(
        items.filter((i) => i.materialType === "bottle").map((i) => i.name),
      ),
    [items],
  );

  const lowCount = useMemo(
    () => items.filter((i) => i.isLowStock).length,
    [items],
  );

  const filteredStockItems = useMemo(() => {
    const q = stockSearch.trim().toLowerCase();
    if (!q) return items;
    return items.filter((row) => {
      const blob = [
        row.materialType,
        row.name,
        row.bottleType ?? "",
        row.clientName ?? "",
        row.clientLabelName ?? "",
        row.unit,
        String(row.quantityAvailable),
        row.lowStockThreshold != null ? String(row.lowStockThreshold) : "",
        row.lastUpdated,
        String(row.id),
      ]
        .join(" ")
        .toLowerCase();
      return blob.includes(q);
    });
  }, [items, stockSearch]);

  const createMaterial = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setCreating(true);
    setError("");
    try {
      const qtyRaw = newMaterial.initialQuantity.trim();
      const initialQuantity =
        qtyRaw === "" ? 0 : Number(qtyRaw);
      if (qtyRaw !== "" && !Number.isFinite(initialQuantity)) {
        setError("Initial quantity must be a valid number.");
        return;
      }
      if (initialQuantity < 0) {
        setError("Initial quantity cannot be negative.");
        return;
      }
      const lowRaw = newMaterial.lowStockThreshold.trim();
      if (lowRaw !== "") {
        const t = Number(lowRaw);
        if (!Number.isFinite(t) || t < 0) {
          setError("Low stock alert must be a valid zero or positive number.");
          return;
        }
      }

      if (newMaterial.materialType === "label") {
        const cid = Number(newMaterial.clientId);
        const lid = Number(newMaterial.clientLabelId);
        if (!Number.isInteger(cid) || cid < 1) {
          setError("Choose the client for this label stock.");
          return;
        }
        if (!Number.isInteger(lid) || lid < 1) {
          setError(
            "Choose the client’s label line. Add new lines on that client’s page (Clients → Edit).",
          );
          return;
        }
      } else if (!newMaterial.name.trim()) {
        setError(
          newMaterial.materialType === "bottle"
            ? "Bottle size is required."
            : "Name is required.",
        );
        return;
      }

      const body: Record<string, unknown> = {
        unit: newMaterial.unit,
        materialType: newMaterial.materialType,
        initialQuantity,
      };
      if (newMaterial.materialType === "label") {
        body.clientLabelId = Number(newMaterial.clientLabelId);
        const trimmedName = newMaterial.name.trim();
        if (trimmedName) {
          body.name = trimmedName;
        }
      } else {
        body.name = newMaterial.name.trim();
      }
      if (newMaterial.materialType === "bottle") {
        body.bottleType = newMaterial.bottleType;
      }
      if (lowRaw !== "") {
        body.lowStockThreshold = Number(lowRaw);
      }

      const response = await fetch("/api/inventory/raw-materials", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (!response.ok) {
        if (response.status === 401) {
          setUnauthorized(true);
          return;
        }
        const payload = (await response.json().catch(() => null)) as
          | { message?: string }
          | null;
        throw new Error(payload?.message ?? "Unable to add material.");
      }
      setNewMaterial({
        name: "",
        unit: "pcs",
        materialType: "bottle",
        bottleType: "mix",
        clientId: "",
        clientLabelId: "",
        initialQuantity: "",
        lowStockThreshold: "",
      });
      await loadAll();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Unable to add material.");
    } finally {
      setCreating(false);
    }
  };

  const patchMaterial = async (
    id: number,
    patch: Record<string, string | number | null>,
  ) => {
    setSavingId(id);
    setError("");
    try {
      const response = await fetch(`/api/inventory/raw-materials/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(patch),
      });
      if (!response.ok) {
        if (response.status === 401) {
          setUnauthorized(true);
          return;
        }
        const payload = (await response.json().catch(() => null)) as
          | { message?: string }
          | null;
        throw new Error(payload?.message ?? "Update failed.");
      }
      await loadAll();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Update failed.");
    } finally {
      setSavingId(null);
    }
  };

  if (loading) {
    return (
      <div className="rounded-[10px] bg-white p-6 shadow-1 dark:bg-gray-dark dark:shadow-card">
        <p>Loading inventory...</p>
      </div>
    );
  }

  if (unauthorized) {
    return (
      <div className="rounded-[10px] bg-white p-6 shadow-1 dark:bg-gray-dark dark:shadow-card">
        <p className="text-dark dark:text-white">
          You need to be signed in to view and manage inventory.
        </p>
        <Link
          href="/auth/sign-in"
          className="mt-4 inline-block rounded-lg bg-primary px-4 py-3 font-medium text-white hover:bg-opacity-90"
        >
          Sign in
        </Link>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {lowCount > 0 ? (
        <div
          className="rounded-[10px] border border-red/40 bg-red/5 px-4 py-3 text-sm dark:border-red/50 dark:bg-red/10"
          role="status"
        >
          <span className="font-medium text-red">Low stock: </span>
          {lowCount} material{lowCount === 1 ? "" : "s"} at or below threshold.
        </div>
      ) : null}

      <section className="rounded-[10px] bg-white p-6 shadow-1 dark:bg-gray-dark dark:shadow-card">
        <h2 className="text-xl font-semibold text-dark dark:text-white">
          Add raw material
        </h2>
        <p className="mt-1 text-sm text-dark-5 dark:text-dark-6">
          Bottle stock uses <span className="font-medium text-dark dark:text-white">size</span>{" "}
          (e.g. 500ml, 1 litre — pick a suggestion or type your own). Other materials use a short
          name.{" "}
          <span className="font-medium text-dark dark:text-white">Labels from the print shop</span>{" "}
          use the client and label line below (add label line names on each client&apos;s edit page
          first). Low stock alert is optional. Bottle stock requires bottle type (mix or pure).
        </p>

        <datalist id="inventory-bottle-size-suggestions">
          {bottleSizeSuggestionList.map((s) => (
            <option key={s} value={s} />
          ))}
        </datalist>

        <form
          onSubmit={createMaterial}
          className="mt-4 grid gap-4 md:grid-cols-2 lg:grid-cols-3"
        >
          <select
            className="rounded-lg border border-stroke bg-transparent px-4 py-3 dark:border-dark-3 dark:bg-dark-2"
            value={newMaterial.materialType}
            onChange={(e) => {
              const materialType = e.target.value as MaterialType;
              setNewMaterial((p) => ({
                ...p,
                materialType,
                clientId: materialType === "label" ? p.clientId : "",
                clientLabelId: materialType === "label" ? p.clientLabelId : "",
              }));
            }}
          >
            <option value="bottle">Bottle</option>
            <option value="label">Label (client branded)</option>
            <option value="other">Other</option>
          </select>
          {newMaterial.materialType === "label" ? (
            <>
              <select
                className="rounded-lg border border-stroke bg-transparent px-4 py-3 dark:border-dark-3 dark:bg-dark-2"
                value={newMaterial.clientId}
                onChange={(e) =>
                  setNewMaterial((p) => ({
                    ...p,
                    clientId: e.target.value,
                    clientLabelId: "",
                  }))
                }
                required
              >
                <option value="">Select client…</option>
                {clients.map((c) => (
                  <option key={c.id} value={String(c.id)}>
                    {c.name}
                  </option>
                ))}
              </select>
              <select
                className="rounded-lg border border-stroke bg-transparent px-4 py-3 dark:border-dark-3 dark:bg-dark-2"
                value={newMaterial.clientLabelId}
                onChange={(e) =>
                  setNewMaterial((p) => ({ ...p, clientLabelId: e.target.value }))
                }
                required
                disabled={!newMaterial.clientId}
              >
                <option value="">
                  {newMaterial.clientId ? "Select client label…" : "Choose a client first"}
                </option>
                {labelChoicesForAdd.map((l) => (
                  <option key={l.id} value={String(l.id)}>
                    {l.labelName}
                  </option>
                ))}
              </select>
            </>
          ) : null}
          <input
            className="rounded-lg border border-stroke bg-transparent px-4 py-3 dark:border-dark-3 dark:bg-dark-2"
            list={
              newMaterial.materialType === "bottle"
                ? "inventory-bottle-size-suggestions"
                : undefined
            }
            placeholder={
              newMaterial.materialType === "label"
                ? "Optional display name (defaults to Client — Label)"
                : newMaterial.materialType === "bottle"
                  ? "Size (500ml, 1 litre, or custom)"
                  : "Name (short description)"
            }
            value={newMaterial.name}
            onChange={(e) =>
              setNewMaterial((p) => ({ ...p, name: e.target.value }))
            }
            required={newMaterial.materialType !== "label"}
            maxLength={newMaterial.materialType === "bottle" ? 160 : undefined}
          />
          <select
            className="rounded-lg border border-stroke bg-transparent px-4 py-3 dark:border-dark-3 dark:bg-dark-2"
            value={newMaterial.unit}
            onChange={(e) =>
              setNewMaterial((p) => ({ ...p, unit: e.target.value as Unit }))
            }
          >
            <option value="pcs">pcs</option>
            <option value="kg">kg</option>
          </select>
          {newMaterial.materialType === "bottle" ? (
            <select
              className="rounded-lg border border-stroke bg-transparent px-4 py-3 dark:border-dark-3 dark:bg-dark-2"
              value={newMaterial.bottleType}
              onChange={(e) =>
                setNewMaterial((p) => ({
                  ...p,
                  bottleType: e.target.value as BottleType,
                }))
              }
            >
              <option value="mix">Bottle type: Mix</option>
              <option value="pure">Bottle type: Pure</option>
            </select>
          ) : null}
          <input
            className="rounded-lg border border-stroke bg-transparent px-4 py-3 dark:border-dark-3 dark:bg-dark-2"
            type="number"
            min={0}
            step="any"
            placeholder="Initial quantity (default 0)"
            value={newMaterial.initialQuantity}
            onChange={(e) =>
              setNewMaterial((p) => ({ ...p, initialQuantity: e.target.value }))
            }
          />
          <input
            className="rounded-lg border border-stroke bg-transparent px-4 py-3 dark:border-dark-3 dark:bg-dark-2"
            type="number"
            min={0}
            step="any"
            placeholder="Low stock alert (optional)"
            value={newMaterial.lowStockThreshold}
            onChange={(e) =>
              setNewMaterial((p) => ({
                ...p,
                lowStockThreshold: e.target.value,
              }))
            }
          />
          <button
            type="submit"
            disabled={creating}
            className="rounded-lg bg-primary px-4 py-3 font-medium text-white hover:bg-opacity-90 disabled:opacity-60"
          >
            {creating ? "Saving..." : "Add material"}
          </button>
        </form>
      </section>

      <section className="rounded-[10px] bg-white p-6 shadow-1 dark:bg-gray-dark dark:shadow-card">
        <h2 className="text-xl font-semibold text-dark dark:text-white">Current stock</h2>
        <div className="mt-4 flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center sm:justify-between">
          <div className="flex min-w-0 flex-1 flex-col gap-2 sm:max-w-md">
            <label htmlFor="inventory-stock-search" className="sr-only">
              Search current stock
            </label>
            <input
              id="inventory-stock-search"
              type="search"
              value={stockSearch}
              onChange={(e) => setStockSearch(e.target.value)}
              placeholder="Search type, name, client, label, quantity…"
              className="w-full rounded-lg border border-stroke bg-transparent px-4 py-2.5 text-sm dark:border-dark-3 dark:bg-dark-2"
            />
          </div>
          <button
            type="button"
            onClick={() => void loadAll()}
            className="shrink-0 rounded-lg border border-stroke px-3 py-2 text-sm font-medium hover:bg-gray-2 dark:border-dark-3 dark:hover:bg-dark-2"
          >
            Refresh
          </button>
        </div>

        {error ? <p className="mt-3 text-sm text-red">{error}</p> : null}

        <div className="mt-4 overflow-x-auto">
          <table className="w-full min-w-[1100px] border-collapse text-sm">
            <thead>
              <tr className="border-b border-stroke text-left dark:border-dark-3">
                <th className="px-3 py-2">Type</th>
                <th className="px-3 py-2">Bottle Type</th>
                <th className="px-3 py-2">Client</th>
                <th className="px-3 py-2">Client label</th>
                <th className="px-3 py-2">Size / name</th>
                <th className="px-3 py-2">Unit</th>
                <th className="px-3 py-2">Quantity</th>
                <th className="px-3 py-2">Low stock at</th>
                <th className="px-3 py-2">Updated</th>
                <th className="px-3 py-2"> </th>
              </tr>
            </thead>
            <tbody>
              {filteredStockItems.map((row) => (
                <tr
                  key={`${row.id}-${row.lastUpdated}`}
                  className={`border-b border-stroke dark:border-dark-3 ${
                    row.isLowStock ? "bg-red/5 dark:bg-red/10" : ""
                  }`}
                >
                  <td className="px-3 py-3">
                    {row.materialType === "label" && row.clientLabelId != null ? (
                      <span className="capitalize text-dark dark:text-white">Label</span>
                    ) : (
                      <select
                        key={`${row.id}-mt-${row.materialType}`}
                        className="rounded border border-stroke bg-transparent px-2 py-1 capitalize dark:border-dark-3"
                        defaultValue={row.materialType}
                        onChange={(e) => {
                          const nextMaterialType = e.target.value as MaterialType;
                          void patchMaterial(row.id, {
                            materialType: nextMaterialType,
                            bottleType:
                              nextMaterialType === "bottle"
                                ? (row.bottleType ?? "mix")
                                : null,
                          });
                        }}
                      >
                        {materialTypeOptionsForRow(row).map((t) => (
                          <option key={t} value={t}>
                            {t === "label" ? "Label (client)" : t}
                          </option>
                        ))}
                      </select>
                    )}
                  </td>
                  <td className="px-3 py-3">
                    {row.materialType === "bottle" ? (
                      <select
                        className="rounded border border-stroke bg-transparent px-2 py-1 dark:border-dark-3"
                        defaultValue={row.bottleType ?? "mix"}
                        onChange={(e) =>
                          void patchMaterial(row.id, {
                            bottleType: e.target.value as BottleType,
                          })
                        }
                      >
                        <option value="mix">mix</option>
                        <option value="pure">pure</option>
                      </select>
                    ) : (
                      <span className="text-dark-5 dark:text-dark-6">--</span>
                    )}
                  </td>
                  <td className="max-w-[140px] truncate px-3 py-3 text-dark-5 dark:text-dark-6">
                    {row.clientName ?? "—"}
                  </td>
                  <td className="max-w-[160px] truncate px-3 py-3 text-dark-5 dark:text-dark-6">
                    {row.clientLabelName ?? "—"}
                  </td>
                  <td className="px-3 py-3">
                    <input
                      className="w-full min-w-[140px] rounded border border-stroke bg-transparent px-2 py-1 dark:border-dark-3"
                      list={
                        row.materialType === "bottle"
                          ? "inventory-bottle-size-suggestions"
                          : undefined
                      }
                      defaultValue={row.name}
                      maxLength={row.materialType === "bottle" ? 160 : undefined}
                      onBlur={(e) => {
                        const v = e.target.value.trim();
                        if (v && v !== row.name) {
                          void patchMaterial(row.id, { name: v });
                        }
                      }}
                    />
                  </td>
                  <td className="px-3 py-3">
                    <select
                      className="rounded border border-stroke bg-transparent px-2 py-1 dark:border-dark-3"
                      defaultValue={row.unit}
                      onChange={(e) =>
                        void patchMaterial(row.id, {
                          unit: e.target.value as Unit,
                        })
                      }
                    >
                      <option value="pcs">pcs</option>
                      <option value="kg">kg</option>
                    </select>
                  </td>
                  <td className="px-3 py-3">
                    <input
                      type="number"
                      min={0}
                      step="any"
                      className="w-28 rounded border border-stroke bg-transparent px-2 py-1 dark:border-dark-3"
                      defaultValue={row.quantityAvailable}
                      onBlur={(e) => {
                        const v = Number(e.target.value);
                        if (
                          Number.isFinite(v) &&
                          v >= 0 &&
                          v !== row.quantityAvailable
                        ) {
                          void patchMaterial(row.id, {
                            quantityAvailable: v,
                          });
                        }
                      }}
                    />
                  </td>
                  <td className="px-3 py-3">
                    <input
                      type="number"
                      min={0}
                      step="any"
                      placeholder="—"
                      className="w-28 rounded border border-stroke bg-transparent px-2 py-1 dark:border-dark-3"
                      defaultValue={
                        row.lowStockThreshold === null
                          ? ""
                          : row.lowStockThreshold
                      }
                      onBlur={(e) => {
                        const raw = e.target.value.trim();
                        if (raw === "") {
                          if (row.lowStockThreshold !== null) {
                            void patchMaterial(row.id, {
                              lowStockThreshold: null,
                            });
                          }
                          return;
                        }
                        const v = Number(raw);
                        if (
                          Number.isFinite(v) &&
                          v >= 0 &&
                          v !== row.lowStockThreshold
                        ) {
                          void patchMaterial(row.id, {
                            lowStockThreshold: v,
                          });
                        }
                      }}
                    />
                  </td>
                  <td className="px-3 py-3 whitespace-nowrap text-dark-5 dark:text-dark-6">
                    {new Date(row.lastUpdated).toLocaleString()}
                  </td>
                  <td className="px-3 py-3">
                    {row.isLowStock ? (
                      <span className="font-medium text-red">Low</span>
                    ) : (
                      <span className="text-dark-5 dark:text-dark-6">OK</span>
                    )}
                    {savingId === row.id ? (
                      <span className="ml-2 text-xs text-dark-5">Saving…</span>
                    ) : null}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {items.length === 0 ? (
            <p className="mt-4 text-sm text-dark-5 dark:text-dark-6">
              No materials yet. Add one above.
            </p>
          ) : filteredStockItems.length === 0 ? (
            <p className="mt-4 text-sm text-dark-5 dark:text-dark-6">
              No rows match your search.
            </p>
          ) : null}
        </div>
      </section>
    </div>
  );
}
