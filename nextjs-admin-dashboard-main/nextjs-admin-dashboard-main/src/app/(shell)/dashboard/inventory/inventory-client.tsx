"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

type MaterialType = "bottle" | "cap" | "label" | "plastic" | "other";
type Unit = "pcs" | "kg";
type BottleType = "mix" | "pure";

type InventoryItem = {
  id: number;
  name: string;
  unit: Unit;
  materialType: MaterialType;
  bottleType: BottleType | null;
  createdAt: string;
  quantityAvailable: number;
  lowStockThreshold: number | null;
  lastUpdated: string;
  isLowStock: boolean;
};

export function InventoryClient() {
  const [items, setItems] = useState<InventoryItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [unauthorized, setUnauthorized] = useState(false);
  const [error, setError] = useState("");
  const [savingId, setSavingId] = useState<number | null>(null);
  const [creating, setCreating] = useState(false);

  const [newMaterial, setNewMaterial] = useState({
    name: "",
    unit: "pcs" as Unit,
    materialType: "bottle" as MaterialType,
    bottleType: "mix" as BottleType,
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
      const body: Record<string, unknown> = {
        name: newMaterial.name.trim(),
        unit: newMaterial.unit,
        materialType: newMaterial.materialType,
        initialQuantity,
      };
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

  const lowCount = items.filter((i) => i.isLowStock).length;

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
          Bottles, caps, labels, plastic — units are pieces or kilograms. Low
          stock alert is optional. Bottle materials require bottle type (mix or
          pure).
        </p>

        <form
          onSubmit={createMaterial}
          className="mt-4 grid gap-4 md:grid-cols-2 lg:grid-cols-3"
        >
          <input
            className="rounded-lg border border-stroke bg-transparent px-4 py-3 dark:border-dark-3 dark:bg-dark-2"
            placeholder="Name (e.g. 500ml PET bottle)"
            value={newMaterial.name}
            onChange={(e) =>
              setNewMaterial((p) => ({ ...p, name: e.target.value }))
            }
            required
          />
          <select
            className="rounded-lg border border-stroke bg-transparent px-4 py-3 dark:border-dark-3 dark:bg-dark-2"
            value={newMaterial.materialType}
            onChange={(e) =>
              setNewMaterial((p) => ({
                ...p,
                materialType: e.target.value as MaterialType,
              }))
            }
          >
            <option value="bottle">Bottle</option>
            <option value="cap">Cap</option>
            <option value="label">Label</option>
            <option value="plastic">Plastic</option>
            <option value="other">Other</option>
          </select>
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
          <select
            className="rounded-lg border border-stroke bg-transparent px-4 py-3 dark:border-dark-3 dark:bg-dark-2"
            value={newMaterial.bottleType}
            onChange={(e) =>
              setNewMaterial((p) => ({
                ...p,
                bottleType: e.target.value as BottleType,
              }))
            }
            disabled={newMaterial.materialType !== "bottle"}
          >
            <option value="mix">Bottle type: Mix</option>
            <option value="pure">Bottle type: Pure</option>
          </select>
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
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 className="text-xl font-semibold text-dark dark:text-white">
            Current stock
          </h2>
          <button
            type="button"
            onClick={() => void loadAll()}
            className="rounded-lg border border-stroke px-3 py-2 text-sm font-medium hover:bg-gray-2 dark:border-dark-3 dark:hover:bg-dark-2"
          >
            Refresh
          </button>
        </div>

        {error ? <p className="mt-3 text-sm text-red">{error}</p> : null}

        <div className="mt-4 overflow-x-auto">
          <table className="w-full min-w-[900px] border-collapse text-sm">
            <thead>
              <tr className="border-b border-stroke text-left dark:border-dark-3">
                <th className="px-3 py-2">Type</th>
                <th className="px-3 py-2">Bottle Type</th>
                <th className="px-3 py-2">Name</th>
                <th className="px-3 py-2">Unit</th>
                <th className="px-3 py-2">Quantity</th>
                <th className="px-3 py-2">Low stock at</th>
                <th className="px-3 py-2">Updated</th>
                <th className="px-3 py-2"> </th>
              </tr>
            </thead>
            <tbody>
              {items.map((row) => (
                <tr
                  key={`${row.id}-${row.lastUpdated}`}
                  className={`border-b border-stroke dark:border-dark-3 ${
                    row.isLowStock ? "bg-red/5 dark:bg-red/10" : ""
                  }`}
                >
                  <td className="px-3 py-3">
                    <select
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
                      <option value="bottle">Bottle</option>
                      <option value="cap">Cap</option>
                      <option value="label">Label</option>
                      <option value="plastic">Plastic</option>
                      <option value="other">Other</option>
                    </select>
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
                  <td className="px-3 py-3">
                    <input
                      className="w-full min-w-[140px] rounded border border-stroke bg-transparent px-2 py-1 dark:border-dark-3"
                      defaultValue={row.name}
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
          ) : null}
        </div>
      </section>
    </div>
  );
}
