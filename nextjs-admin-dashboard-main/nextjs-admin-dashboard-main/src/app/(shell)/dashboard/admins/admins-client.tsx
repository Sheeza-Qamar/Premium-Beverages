"use client";

import { useEffect, useState } from "react";

type SessionUser = {
  id: number;
  name: string;
  email: string;
  role: "admin";
};

type AdminRecord = {
  id: number;
  name: string;
  email: string;
  isActive: boolean;
  createdAt: string;
  createdById: number | null;
  createdByName: string | null;
};

export function AdminsClient() {
  const [sessionUser, setSessionUser] = useState<SessionUser | null>(null);
  const [admins, setAdmins] = useState<AdminRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  const [newAdmin, setNewAdmin] = useState({
    name: "",
    email: "",
    password: "",
  });

  const loadAll = async () => {
    setLoading(true);
    setError("");
    try {
      const meResp = await fetch("/api/auth/me", { cache: "no-store" });
      if (!meResp.ok) {
        throw new Error("Session expired. Please sign in again.");
      }
      const mePayload = (await meResp.json()) as { user: SessionUser };
      setSessionUser(mePayload.user);

      const resp = await fetch("/api/admins", { cache: "no-store" });
      if (!resp.ok) {
        const payload = (await resp.json().catch(() => null)) as
          | { message?: string }
          | null;
        throw new Error(payload?.message ?? "Failed to load admins.");
      }
      const data = (await resp.json()) as { admins: AdminRecord[] };
      setAdmins(data.admins);
    } catch (e) {
      setError(
        e instanceof Error ? e.message : "Unable to load admins.",
      );
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadAll();
  }, []);

  const createAdmin = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setSaving(true);
    setError("");
    try {
      const response = await fetch("/api/admins", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(newAdmin),
      });

      if (!response.ok) {
        const payload = (await response.json().catch(() => null)) as
          | { message?: string }
          | null;
        throw new Error(payload?.message ?? "Unable to create admin.");
      }

      setNewAdmin({ name: "", email: "", password: "" });
      await loadAll();
    } catch (e) {
      setError(
        e instanceof Error ? e.message : "Unable to create admin.",
      );
    } finally {
      setSaving(false);
    }
  };

  const updateAdmin = async (
    id: number,
    changes: Partial<Pick<AdminRecord, "isActive"> & { name: string }>,
  ) => {
    setError("");
    const response = await fetch(`/api/admins/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(changes),
    });
    if (!response.ok) {
      const payload = (await response.json().catch(() => null)) as
        | { message?: string }
        | null;
      setError(payload?.message ?? "Unable to update.");
      return;
    }

    await loadAll();
  };

  if (loading) {
    return (
      <div className="rounded-[10px] bg-white p-6 shadow-1 dark:bg-gray-dark dark:shadow-card">
        <p>Loading admins...</p>
      </div>
    );
  }

  if (!sessionUser) {
    return (
      <div className="rounded-[10px] bg-white p-6 shadow-1 dark:bg-gray-dark dark:shadow-card">
        <p className="text-sm text-red">Please sign in.</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <section className="rounded-[10px] bg-white p-6 shadow-1 dark:bg-gray-dark dark:shadow-card">
        <h2 className="text-xl font-semibold text-dark dark:text-white">
          Add administrator
        </h2>
        <p className="mt-1 text-sm text-dark-5 dark:text-dark-6">
          New admins can sign in with the email and password you set here.
        </p>

        <form onSubmit={createAdmin} className="mt-4 grid gap-4 md:grid-cols-2">
          <input
            className="rounded-lg border border-stroke bg-transparent px-4 py-3 dark:border-dark-3 dark:bg-dark-2"
            placeholder="Full name"
            value={newAdmin.name}
            onChange={(e) =>
              setNewAdmin((p) => ({ ...p, name: e.target.value }))
            }
            required
          />
          <input
            className="rounded-lg border border-stroke bg-transparent px-4 py-3 dark:border-dark-3 dark:bg-dark-2"
            type="email"
            placeholder="Email"
            value={newAdmin.email}
            onChange={(e) =>
              setNewAdmin((p) => ({ ...p, email: e.target.value }))
            }
            required
          />
          <input
            className="rounded-lg border border-stroke bg-transparent px-4 py-3 dark:border-dark-3 dark:bg-dark-2"
            type="password"
            placeholder="Password (min 8 characters)"
            value={newAdmin.password}
            onChange={(e) =>
              setNewAdmin((p) => ({ ...p, password: e.target.value }))
            }
            required
            minLength={8}
          />
          <button
            type="submit"
            disabled={saving}
            className="rounded-lg bg-primary px-4 py-3 font-medium text-white hover:bg-opacity-90 disabled:opacity-60"
          >
            {saving ? "Creating..." : "Create admin"}
          </button>
        </form>
      </section>

      <section className="rounded-[10px] bg-white p-6 shadow-1 dark:bg-gray-dark dark:shadow-card">
        <h2 className="text-xl font-semibold text-dark dark:text-white">
          Administrators
        </h2>

        {error ? <p className="mt-3 text-sm text-red">{error}</p> : null}

        <div className="mt-4 overflow-x-auto">
          <table className="w-full min-w-[800px] border-collapse">
            <thead>
              <tr className="border-b border-stroke text-left dark:border-dark-3">
                <th className="px-3 py-2">Name</th>
                <th className="px-3 py-2">Email</th>
                <th className="px-3 py-2">Added by</th>
                <th className="px-3 py-2">Active</th>
                <th className="px-3 py-2">Created</th>
              </tr>
            </thead>
            <tbody>
              {admins.map((a) => (
                <tr key={a.id} className="border-b border-stroke dark:border-dark-3">
                  <td className="px-3 py-3">
                    <input
                      className="w-full max-w-xs rounded border border-stroke bg-transparent px-2 py-1 dark:border-dark-3"
                      defaultValue={a.name}
                      onBlur={(e) => {
                        const v = e.target.value.trim();
                        if (v && v !== a.name) {
                          void updateAdmin(a.id, { name: v });
                        }
                      }}
                    />
                  </td>
                  <td className="px-3 py-3">{a.email}</td>
                  <td className="px-3 py-3 text-sm text-dark-5 dark:text-dark-6">
                    {a.createdByName ?? (a.createdById === null ? "—" : `#${a.createdById}`)}
                  </td>
                  <td className="px-3 py-3">
                    <label className="inline-flex items-center gap-2">
                      <input
                        type="checkbox"
                        checked={a.isActive}
                        disabled={a.id === sessionUser.id}
                        onChange={(e) =>
                          void updateAdmin(a.id, { isActive: e.target.checked })
                        }
                      />
                      <span>{a.isActive ? "Active" : "Inactive"}</span>
                    </label>
                  </td>
                  <td className="px-3 py-3 text-sm">
                    {new Date(a.createdAt).toLocaleString()}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
