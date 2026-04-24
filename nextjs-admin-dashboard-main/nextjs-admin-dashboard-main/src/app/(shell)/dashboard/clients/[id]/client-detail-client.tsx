"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import QRCode from "qrcode";

type Client = {
  id: number;
  name: string;
  email: string | null;
  contactNumber: string | null;
  address: string | null;
  createdAt: string;
  updatedAt: string;
  cardToken: string;
  cardUrl: string;
};

type Label = {
  id: number;
  labelName: string;
  quantityAvailable: number;
  createdAt: string;
  updatedAt: string;
};

export function ClientDetailClient({ clientId }: { clientId: string }) {
  const id = Number(clientId);
  const [client, setClient] = useState<Client | null>(null);
  const [labels, setLabels] = useState<Label[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const [qrDataUrl, setQrDataUrl] = useState("");

  const [edit, setEdit] = useState({
    name: "",
    email: "",
    contactNumber: "",
    address: "",
  });

  const [newLabel, setNewLabel] = useState({
    labelName: "",
    quantityAvailable: "",
  });

  const load = useCallback(async () => {
    if (!Number.isInteger(id) || id < 1) {
      setError("Invalid client.");
      setLoading(false);
      return;
    }
    setLoading(true);
    setError("");
    try {
      const r = await fetch(`/api/clients/${id}`, { cache: "no-store" });
      if (r.status === 404) {
        setError("Client not found.");
        setClient(null);
        return;
      }
      if (!r.ok) {
        const p = (await r.json().catch(() => null)) as { message?: string } | null;
        throw new Error(p?.message ?? "Failed to load.");
      }
      const data = (await r.json()) as {
        client: Client;
        labels: Label[];
      };
      setClient(data.client);
      setLabels(data.labels);
      setEdit({
        name: data.client.name,
        email: data.client.email ?? "",
        contactNumber: data.client.contactNumber ?? "",
        address: data.client.address ?? "",
      });
      const qr = await QRCode.toDataURL(data.client.cardUrl, {
        width: 240,
        margin: 1,
      });
      setQrDataUrl(qr);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Load failed.");
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    void load();
  }, [load]);

  const saveClient = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setError("");
    try {
      const r = await fetch(`/api/clients/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: edit.name.trim(),
          email: edit.email.trim().toLowerCase() || null,
          contactNumber: edit.contactNumber.trim() || null,
          address: edit.address.trim() || null,
        }),
      });
      if (!r.ok) {
        const p = (await r.json().catch(() => null)) as { message?: string } | null;
        throw new Error(p?.message ?? "Update failed.");
      }
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Update failed.");
    } finally {
      setSaving(false);
    }
  };

  const addLabel = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setError("");
    try {
      const qty =
        newLabel.quantityAvailable.trim() === ""
          ? 0
          : Number(newLabel.quantityAvailable);
      if (!Number.isFinite(qty) || qty < 0) {
        setError("Quantity must be a valid non-negative number.");
        return;
      }
      const r = await fetch(`/api/clients/${id}/labels`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          labelName: newLabel.labelName.trim(),
          quantityAvailable: qty,
        }),
      });
      if (!r.ok) {
        const p = (await r.json().catch(() => null)) as { message?: string } | null;
        throw new Error(p?.message ?? "Could not add label.");
      }
      setNewLabel({ labelName: "", quantityAvailable: "" });
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Add label failed.");
    } finally {
      setSaving(false);
    }
  };

  const patchLabel = async (
    labelId: number,
    patch: { labelName?: string; quantityAvailable?: number },
  ) => {
    setError("");
    const r = await fetch(`/api/clients/${id}/labels/${labelId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(patch),
    });
    if (!r.ok) {
      const p = (await r.json().catch(() => null)) as { message?: string } | null;
      setError(p?.message ?? "Update failed.");
      return;
    }
    await load();
  };

  const deleteLabel = async (labelId: number, labelName: string) => {
    if (!window.confirm(`Remove label "${labelName}"?`)) return;
    setError("");
    const r = await fetch(`/api/clients/${id}/labels/${labelId}`, {
      method: "DELETE",
    });
    if (!r.ok) {
      const p = (await r.json().catch(() => null)) as { message?: string } | null;
      setError(p?.message ?? "Delete failed.");
      return;
    }
    await load();
  };

  if (loading) {
    return (
      <div className="rounded-[10px] bg-white p-6 shadow-1 dark:bg-gray-dark dark:shadow-card">
        <p>Loading...</p>
      </div>
    );
  }

  if (!client) {
    return (
      <div className="rounded-[10px] bg-white p-6 shadow-1 dark:bg-gray-dark dark:shadow-card">
        <p className="text-red">{error || "Not found."}</p>
        <Link href="/dashboard/clients" className="mt-4 inline-block text-primary">
          ← Back to clients
        </Link>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <Link
          href="/dashboard/clients"
          className="text-sm font-medium text-primary hover:underline"
        >
          ← All clients
        </Link>
      </div>

      <section className="rounded-[10px] bg-white p-6 shadow-1 dark:bg-gray-dark dark:shadow-card">
        <h2 className="text-xl font-semibold text-dark dark:text-white">
          Contact details
        </h2>
        {error ? <p className="mt-3 text-sm text-red">{error}</p> : null}
        <form onSubmit={saveClient} className="mt-4 grid gap-4 md:grid-cols-2">
          <input
            className="rounded-lg border border-stroke bg-transparent px-4 py-3 dark:border-dark-3 dark:bg-dark-2"
            value={edit.name}
            onChange={(e) => setEdit((s) => ({ ...s, name: e.target.value }))}
            required
          />
          <input
            className="rounded-lg border border-stroke bg-transparent px-4 py-3 dark:border-dark-3 dark:bg-dark-2"
            type="email"
            placeholder="Email"
            value={edit.email}
            onChange={(e) => setEdit((s) => ({ ...s, email: e.target.value }))}
          />
          <input
            className="rounded-lg border border-stroke bg-transparent px-4 py-3 dark:border-dark-3 dark:bg-dark-2"
            placeholder="Contact number"
            value={edit.contactNumber}
            onChange={(e) =>
              setEdit((s) => ({ ...s, contactNumber: e.target.value }))
            }
          />
          <textarea
            className="md:col-span-2 rounded-lg border border-stroke bg-transparent px-4 py-3 dark:border-dark-3 dark:bg-dark-2"
            placeholder="Address"
            rows={2}
            value={edit.address}
            onChange={(e) => setEdit((s) => ({ ...s, address: e.target.value }))}
          />
          <button
            type="submit"
            disabled={saving}
            className="rounded-lg bg-primary px-4 py-3 font-medium text-white hover:bg-opacity-90 disabled:opacity-60"
          >
            {saving ? "Saving..." : "Save changes"}
          </button>
        </form>
      </section>

      <section className="rounded-[10px] bg-white p-6 shadow-1 dark:bg-gray-dark dark:shadow-card">
        <h2 className="text-xl font-semibold text-dark dark:text-white">
          Client membership QR
        </h2>
        <p className="mt-1 text-sm text-dark-5 dark:text-dark-6">
          Scan this QR code to open this client's full card with debit, credit,
          orders and payment details.
        </p>

        <div className="mt-4 flex flex-wrap items-start gap-6">
          {qrDataUrl ? (
            <img
              src={qrDataUrl}
              alt={`QR code for ${client.name}`}
              className="h-48 w-48 rounded-lg border border-stroke bg-white p-2 dark:border-dark-3"
            />
          ) : (
            <div className="flex h-48 w-48 items-center justify-center rounded-lg border border-stroke text-sm text-dark-5 dark:border-dark-3 dark:text-dark-6">
              QR loading...
            </div>
          )}

          <div className="space-y-3">
            <a
              href={client.cardUrl}
              target="_blank"
              rel="noreferrer"
              className="inline-block rounded-lg bg-primary px-4 py-2 font-medium text-white hover:bg-opacity-90"
            >
              Open client card
            </a>
            <button
              type="button"
              className="block rounded-lg border border-stroke px-4 py-2 font-medium hover:bg-gray-2 dark:border-dark-3 dark:hover:bg-dark-2"
              onClick={async () => {
                await navigator.clipboard.writeText(client.cardUrl);
              }}
            >
              Copy card URL
            </button>
            <p className="max-w-xl break-all text-xs text-dark-5 dark:text-dark-6">
              {client.cardUrl}
            </p>
          </div>
        </div>
      </section>

      <section className="rounded-[10px] bg-white p-6 shadow-1 dark:bg-gray-dark dark:shadow-card">
        <h2 className="text-xl font-semibold text-dark dark:text-white">
          Label inventory (this client)
        </h2>
        <p className="mt-1 text-sm text-dark-5 dark:text-dark-6">
          Track printed / branded labels per client. Quantities can be adjusted when
          you receive stock or after production (production module later).
        </p>

        <form
          onSubmit={addLabel}
          className="mt-4 flex flex-wrap items-end gap-4"
        >
          <input
            className="min-w-[180px] rounded-lg border border-stroke bg-transparent px-4 py-3 dark:border-dark-3 dark:bg-dark-2"
            placeholder="Label name (e.g. Brand A 500ml)"
            value={newLabel.labelName}
            onChange={(e) =>
              setNewLabel((s) => ({ ...s, labelName: e.target.value }))
            }
            required
          />
          <input
            type="number"
            min={0}
            step="any"
            className="w-32 rounded-lg border border-stroke bg-transparent px-4 py-3 dark:border-dark-3 dark:bg-dark-2"
            placeholder="Qty"
            value={newLabel.quantityAvailable}
            onChange={(e) =>
              setNewLabel((s) => ({ ...s, quantityAvailable: e.target.value }))
            }
          />
          <button
            type="submit"
            disabled={saving}
            className="rounded-lg border border-stroke px-4 py-3 font-medium hover:bg-gray-2 dark:border-dark-3 dark:hover:bg-dark-2"
          >
            Add label line
          </button>
        </form>

        <div className="mt-6 overflow-x-auto">
          <table className="w-full min-w-[560px] border-collapse text-sm">
            <thead>
              <tr className="border-b border-stroke text-left dark:border-dark-3">
                <th className="px-3 py-2">Label name</th>
                <th className="px-3 py-2">Quantity</th>
                <th className="px-3 py-2"> </th>
              </tr>
            </thead>
            <tbody>
              {labels.map((row) => (
                <tr
                  key={`${row.id}-${row.updatedAt}`}
                  className="border-b border-stroke dark:border-dark-3"
                >
                  <td className="px-3 py-3">
                    <input
                      className="w-full max-w-xs rounded border border-stroke bg-transparent px-2 py-1 dark:border-dark-3"
                      defaultValue={row.labelName}
                      onBlur={(e) => {
                        const v = e.target.value.trim();
                        if (v && v !== row.labelName) {
                          void patchLabel(row.id, { labelName: v });
                        }
                      }}
                    />
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
                          void patchLabel(row.id, { quantityAvailable: v });
                        }
                      }}
                    />
                  </td>
                  <td className="px-3 py-3">
                    <button
                      type="button"
                      className="text-sm text-red hover:underline"
                      onClick={() => void deleteLabel(row.id, row.labelName)}
                    >
                      Remove
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {labels.length === 0 ? (
            <p className="mt-4 text-sm text-dark-5 dark:text-dark-6">
              No label lines yet. Add one above.
            </p>
          ) : null}
        </div>
      </section>
    </div>
  );
}
