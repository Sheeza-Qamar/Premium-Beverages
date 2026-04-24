"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

type ClientRow = {
  id: number;
  name: string;
  email: string | null;
  contactNumber: string | null;
  address: string | null;
  createdAt: string;
  updatedAt: string;
};

export function ClientsClient() {
  const [clients, setClients] = useState<ClientRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  const [form, setForm] = useState({
    name: "",
    email: "",
    contactNumber: "",
    address: "",
  });

  const load = async () => {
    setLoading(true);
    setError("");
    try {
      const r = await fetch("/api/clients", { cache: "no-store" });
      if (r.status === 401) {
        setError("Please sign in again.");
        return;
      }
      if (!r.ok) {
        const p = (await r.json().catch(() => null)) as { message?: string } | null;
        throw new Error(p?.message ?? "Failed to load clients.");
      }
      const data = (await r.json()) as { clients: ClientRow[] };
      setClients(data.clients);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Load failed.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void load();
  }, []);

  const createClient = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setError("");
    try {
      const r = await fetch("/api/clients", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: form.name.trim(),
          email: form.email.trim().toLowerCase() || null,
          contactNumber: form.contactNumber.trim() || null,
          address: form.address.trim() || null,
        }),
      });
      if (!r.ok) {
        const p = (await r.json().catch(() => null)) as { message?: string } | null;
        throw new Error(p?.message ?? "Could not create client.");
      }
      setForm({ name: "", email: "", contactNumber: "", address: "" });
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Create failed.");
    } finally {
      setSaving(false);
    }
  };

  const deleteClient = async (id: number, name: string) => {
    if (!window.confirm(`Delete client "${name}"? This cannot be undone if allowed.`)) {
      return;
    }
    setError("");
    const r = await fetch(`/api/clients/${id}`, { method: "DELETE" });
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
        <p>Loading clients...</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <section className="rounded-[10px] bg-white p-6 shadow-1 dark:bg-gray-dark dark:shadow-card">
        <h2 className="text-xl font-semibold text-dark dark:text-white">
          Add client
        </h2>
        <p className="mt-1 text-sm text-dark-5 dark:text-dark-6">
          Store client name, email, phone, and address. Manage per-client label
          stock from the client detail page.
        </p>
        <form
          onSubmit={createClient}
          className="mt-4 grid gap-4 md:grid-cols-2"
        >
          <input
            className="rounded-lg border border-stroke bg-transparent px-4 py-3 dark:border-dark-3 dark:bg-dark-2"
            placeholder="Client name *"
            value={form.name}
            onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
            required
          />
          <input
            className="rounded-lg border border-stroke bg-transparent px-4 py-3 dark:border-dark-3 dark:bg-dark-2"
            type="email"
            placeholder="Email"
            value={form.email}
            onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))}
          />
          <input
            className="rounded-lg border border-stroke bg-transparent px-4 py-3 dark:border-dark-3 dark:bg-dark-2"
            placeholder="Contact number"
            value={form.contactNumber}
            onChange={(e) =>
              setForm((f) => ({ ...f, contactNumber: e.target.value }))
            }
          />
          <textarea
            className="md:col-span-2 rounded-lg border border-stroke bg-transparent px-4 py-3 dark:border-dark-3 dark:bg-dark-2"
            placeholder="Address"
            rows={2}
            value={form.address}
            onChange={(e) => setForm((f) => ({ ...f, address: e.target.value }))}
          />
          <button
            type="submit"
            disabled={saving}
            className="rounded-lg bg-primary px-4 py-3 font-medium text-white hover:bg-opacity-90 disabled:opacity-60"
          >
            {saving ? "Saving..." : "Add client"}
          </button>
        </form>
      </section>

      <section className="rounded-[10px] bg-white p-6 shadow-1 dark:bg-gray-dark dark:shadow-card">
        <h2 className="text-xl font-semibold text-dark dark:text-white">
          All clients
        </h2>
        {error ? <p className="mt-3 text-sm text-red">{error}</p> : null}
        <div className="mt-4 overflow-x-auto">
          <table className="w-full min-w-[700px] border-collapse text-sm">
            <thead>
              <tr className="border-b border-stroke text-left dark:border-dark-3">
                <th className="px-3 py-2">Name</th>
                <th className="px-3 py-2">Email</th>
                <th className="px-3 py-2">Contact</th>
                <th className="px-3 py-2">Address</th>
                <th className="px-3 py-2"> </th>
              </tr>
            </thead>
            <tbody>
              {clients.map((c) => (
                <tr
                  key={c.id}
                  className="border-b border-stroke dark:border-dark-3"
                >
                  <td className="px-3 py-3 font-medium">{c.name}</td>
                  <td className="px-3 py-3 text-dark-5 dark:text-dark-6">
                    {c.email ?? "—"}
                  </td>
                  <td className="px-3 py-3 text-dark-5 dark:text-dark-6">
                    {c.contactNumber ?? "—"}
                  </td>
                  <td className="max-w-xs truncate px-3 py-3 text-dark-5 dark:text-dark-6">
                    {c.address ?? "—"}
                  </td>
                  <td className="px-3 py-3 whitespace-nowrap">
                    <Link
                      href={`/dashboard/clients/${c.id}`}
                      className="text-primary hover:underline"
                    >
                      Edit & labels
                    </Link>
                    <button
                      type="button"
                      className="ml-4 text-red hover:underline"
                      onClick={() => void deleteClient(c.id, c.name)}
                    >
                      Delete
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {clients.length === 0 ? (
            <p className="mt-4 text-sm text-dark-5 dark:text-dark-6">
              No clients yet.
            </p>
          ) : null}
        </div>
      </section>
    </div>
  );
}
