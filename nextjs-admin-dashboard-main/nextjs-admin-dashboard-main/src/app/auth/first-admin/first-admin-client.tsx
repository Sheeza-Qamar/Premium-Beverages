"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

export function FirstAdminClient() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [available, setAvailable] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [form, setForm] = useState({
    name: "",
    email: "",
    password: "",
  });

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const r = await fetch("/api/auth/first-admin-available", {
          cache: "no-store",
        });
        const data = (await r.json()) as { available?: boolean };
        if (!cancelled) {
          setAvailable(data.available === true);
        }
      } catch {
        if (!cancelled) setAvailable(false);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setError("");
    try {
      const response = await fetch("/api/auth/register-first-admin", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      if (!response.ok) {
        const payload = (await response.json().catch(() => null)) as
          | { message?: string }
          | null;
        throw new Error(payload?.message ?? "Registration failed.");
      }
      router.push("/dashboard");
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Registration failed.");
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="rounded-[10px] bg-white p-6 shadow-1 dark:bg-gray-dark dark:shadow-card">
        <p>Loading...</p>
      </div>
    );
  }

  if (!available) {
    return (
      <div className="rounded-[10px] bg-white p-6 shadow-1 dark:bg-gray-dark dark:shadow-card">
        <p className="text-dark dark:text-white">
          An administrator account already exists. Use the normal sign-in page.
        </p>
        <Link
          href="/auth/sign-in"
          className="mt-4 inline-block text-primary hover:underline"
        >
          Go to sign in
        </Link>
      </div>
    );
  }

  return (
    <div className="rounded-[10px] bg-white p-6 shadow-1 dark:bg-gray-dark dark:shadow-card">
      <h2 className="text-xl font-semibold text-dark dark:text-white">
        Create your administrator account
      </h2>
      <p className="mt-2 text-sm text-dark-5 dark:text-dark-6">
        This page is only available while there are no admins in the database.
        You can add more admins later from the Administrators screen.
      </p>

      <form onSubmit={submit} className="mt-6 grid max-w-md gap-4">
        <input
          className="rounded-lg border border-stroke bg-transparent px-4 py-3 dark:border-dark-3 dark:bg-dark-2"
          placeholder="Your name"
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
          required
        />
        <input
          className="rounded-lg border border-stroke bg-transparent px-4 py-3 dark:border-dark-3 dark:bg-dark-2"
          type="password"
          placeholder="Password (min 8 characters)"
          value={form.password}
          onChange={(e) => setForm((f) => ({ ...f, password: e.target.value }))}
          required
          minLength={8}
        />
        {error ? <p className="text-sm text-red">{error}</p> : null}
        <button
          type="submit"
          disabled={saving}
          className="rounded-lg bg-primary px-4 py-3 font-medium text-white hover:bg-opacity-90 disabled:opacity-60"
        >
          {saving ? "Creating..." : "Create and sign in"}
        </button>
      </form>
    </div>
  );
}
