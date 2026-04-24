"use client";

import { useEffect, useMemo, useState } from "react";

type Client = {
  id: number;
  name: string;
};

type ClientLabel = {
  id: number;
  labelName: string;
  quantityAvailable: number;
};

type InventoryMaterial = {
  id: number;
  name: string;
  materialType: "bottle" | "cap" | "label" | "plastic" | "other";
  bottleType: "mix" | "pure" | null;
  quantityAvailable: number;
};

type ProductionRecord = {
  id: number;
  clientId: number;
  clientName: string;
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
    materialType: "bottle" | "cap" | "label" | "plastic" | "other";
    quantityUsed: number;
  }>;
};

export function ProductionClient() {
  const [clients, setClients] = useState<Client[]>([]);
  const [labels, setLabels] = useState<ClientLabel[]>([]);
  const [materials, setMaterials] = useState<InventoryMaterial[]>([]);
  const [productions, setProductions] = useState<ProductionRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const [form, setForm] = useState({
    clientId: "",
    bottleType: "mix" as "mix" | "pure",
    bottleMaterialId: "",
    capMaterialId: "",
    bottleQuantityUsed: "",
    capQuantityUsed: "",
    quantityProduced: "",
    productionDate: new Date().toISOString().slice(0, 10),
    notes: "",
  });

  const [usageInputs, setUsageInputs] = useState<Record<number, string>>({});

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

  const loadInventoryMaterials = async () => {
    const r = await fetch("/api/inventory", { cache: "no-store" });
    if (!r.ok) {
      const p = (await r.json().catch(() => null)) as { message?: string } | null;
      throw new Error(p?.message ?? "Failed to load inventory materials.");
    }
    const data = (await r.json()) as { items: InventoryMaterial[] };
    setMaterials(
      data.items.filter(
        (m) => m.materialType === "bottle" || m.materialType === "cap",
      ),
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
      await Promise.all([loadClients(), loadProductions(), loadInventoryMaterials()]);
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
      return;
    }
    void (async () => {
      try {
        await loadClientLabels(selectedClientId);
      } catch (e) {
        setError(e instanceof Error ? e.message : "Unable to load labels.");
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

  const bottleMaterials = useMemo(
    () =>
      materials.filter(
        (m) => m.materialType === "bottle" && m.bottleType === form.bottleType,
      ),
    [materials, form.bottleType],
  );

  const capMaterials = useMemo(
    () => materials.filter((m) => m.materialType === "cap"),
    [materials],
  );

  const submitProduction = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setSaving(true);
    setError("");
    try {
      if (!isClientSelected) {
        setError("Please select a client.");
        return;
      }
      const quantityProduced = Number(form.quantityProduced);
      if (!Number.isFinite(quantityProduced) || quantityProduced <= 0) {
        setError("Quantity produced must be greater than zero.");
        return;
      }
      if (selectedUsage.length === 0) {
        setError("Please enter at least one label usage quantity.");
        return;
      }
      const bottleMaterialId = Number(form.bottleMaterialId);
      const capMaterialId = Number(form.capMaterialId);
      if (!Number.isInteger(bottleMaterialId) || bottleMaterialId < 1) {
        setError("Please select bottle material.");
        return;
      }
      if (!Number.isInteger(capMaterialId) || capMaterialId < 1) {
        setError("Please select cap material.");
        return;
      }
      const bottleQuantityUsed =
        form.bottleQuantityUsed.trim() === ""
          ? quantityProduced
          : Number(form.bottleQuantityUsed);
      const capQuantityUsed =
        form.capQuantityUsed.trim() === ""
          ? quantityProduced
          : Number(form.capQuantityUsed);
      if (
        !Number.isFinite(bottleQuantityUsed) ||
        bottleQuantityUsed <= 0 ||
        !Number.isFinite(capQuantityUsed) ||
        capQuantityUsed <= 0
      ) {
        setError("Bottle/cap usage quantities must be greater than zero.");
        return;
      }

      const r = await fetch("/api/production", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          clientId: selectedClientId,
          bottleType: form.bottleType,
          quantityProduced,
          productionDate: form.productionDate,
          notes: form.notes.trim() || null,
          materialUsages: [
            { materialId: bottleMaterialId, quantityUsed: bottleQuantityUsed },
            { materialId: capMaterialId, quantityUsed: capQuantityUsed },
          ],
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
        bottleMaterialId: "",
        capMaterialId: "",
        bottleQuantityUsed: "",
        capQuantityUsed: "",
        quantityProduced: "",
        notes: "",
      }));
      setUsageInputs({});
      await Promise.all([
        loadProductions(),
        loadClientLabels(selectedClientId),
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
          Saving a production entry deducts bottles and caps from inventory, and labels from selected client label stock.
        </p>

        {error ? <p className="mt-3 text-sm text-red">{error}</p> : null}

        <form onSubmit={submitProduction} className="mt-4 space-y-4">
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

            <select
              className="rounded-lg border border-stroke bg-transparent px-4 py-3 dark:border-dark-3 dark:bg-dark-2"
              value={form.bottleType}
              onChange={(e) =>
                setForm((prev) => ({
                  ...prev,
                  bottleType: e.target.value as "mix" | "pure",
                  bottleMaterialId: "",
                }))
              }
            >
              <option value="mix">Bottle type: Mix</option>
              <option value="pure">Bottle type: Pure</option>
            </select>

            <input
              type="number"
              min={0}
              step="any"
              className="rounded-lg border border-stroke bg-transparent px-4 py-3 dark:border-dark-3 dark:bg-dark-2"
              placeholder="Quantity produced"
              value={form.quantityProduced}
              onChange={(e) =>
                setForm((prev) => ({ ...prev, quantityProduced: e.target.value }))
              }
              required
            />

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
            <select
              className="rounded-lg border border-stroke bg-transparent px-4 py-3 dark:border-dark-3 dark:bg-dark-2"
              value={form.bottleMaterialId}
              onChange={(e) =>
                setForm((prev) => ({ ...prev, bottleMaterialId: e.target.value }))
              }
              required
            >
              <option value="">Select bottle material</option>
              {bottleMaterials.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.name} (available: {m.quantityAvailable})
                </option>
              ))}
            </select>
            <input
              type="number"
              min={0}
              step="any"
              className="rounded-lg border border-stroke bg-transparent px-4 py-3 dark:border-dark-3 dark:bg-dark-2"
              placeholder="Bottle usage qty (default = produced qty)"
              value={form.bottleQuantityUsed}
              onChange={(e) =>
                setForm((prev) => ({ ...prev, bottleQuantityUsed: e.target.value }))
              }
            />
            <select
              className="rounded-lg border border-stroke bg-transparent px-4 py-3 dark:border-dark-3 dark:bg-dark-2"
              value={form.capMaterialId}
              onChange={(e) =>
                setForm((prev) => ({ ...prev, capMaterialId: e.target.value }))
              }
              required
            >
              <option value="">Select cap material</option>
              {capMaterials.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.name} (available: {m.quantityAvailable})
                </option>
              ))}
            </select>
            <input
              type="number"
              min={0}
              step="any"
              className="rounded-lg border border-stroke bg-transparent px-4 py-3 dark:border-dark-3 dark:bg-dark-2"
              placeholder="Cap usage qty (default = produced qty)"
              value={form.capQuantityUsed}
              onChange={(e) =>
                setForm((prev) => ({ ...prev, capQuantityUsed: e.target.value }))
              }
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
            disabled={saving}
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
        <div className="mt-4 overflow-x-auto">
          <table className="w-full min-w-[900px] border-collapse text-sm">
            <thead>
              <tr className="border-b border-stroke text-left dark:border-dark-3">
                <th className="px-3 py-2">Date</th>
                <th className="px-3 py-2">Client</th>
                <th className="px-3 py-2">Bottle Type</th>
                <th className="px-3 py-2">Produced Qty</th>
                <th className="px-3 py-2">Materials Deducted</th>
                <th className="px-3 py-2">Labels Deducted</th>
                <th className="px-3 py-2">Notes</th>
              </tr>
            </thead>
            <tbody>
              {productions.map((p) => (
                <tr key={p.id} className="border-b border-stroke dark:border-dark-3">
                  <td className="px-3 py-3 whitespace-nowrap">{p.productionDate}</td>
                  <td className="px-3 py-3">{p.clientName}</td>
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
          ) : null}
        </div>
      </section>
    </div>
  );
}
