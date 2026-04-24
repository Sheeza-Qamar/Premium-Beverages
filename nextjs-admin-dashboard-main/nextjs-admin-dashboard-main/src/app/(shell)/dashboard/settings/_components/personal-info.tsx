"use client";

import { EmailIcon, UserIcon } from "@/assets/icons";
import InputGroup from "@/components/FormElements/InputGroup";
import { ShowcaseSection } from "@/components/Layouts/showcase-section";
import { BRAND } from "@/lib/brand";
import { useCallback, useEffect, useState } from "react";

type MeUser = {
  id: number;
  name: string;
  email: string;
  role: string;
};

export function PersonalInfoForm() {
  const [user, setUser] = useState<MeUser | null>(null);
  const [name, setName] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [feedback, setFeedback] = useState<{ type: "success" | "error"; text: string } | null>(
    null,
  );

  const load = useCallback(async () => {
    setLoading(true);
    setFeedback(null);
    try {
      const res = await fetch("/api/auth/me", { credentials: "include" });
      if (!res.ok) {
        setFeedback({ type: "error", text: "Could not load your account." });
        setUser(null);
        return;
      }
      const data = (await res.json()) as { user: MeUser };
      setUser(data.user);
      setName(data.user.name);
    } catch {
      setFeedback({ type: "error", text: "Could not load your account." });
      setUser(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!user) return;
    const trimmed = name.trim();
    if (!trimmed) {
      setFeedback({ type: "error", text: "Name cannot be empty." });
      return;
    }
    if (trimmed === user.name) {
      setFeedback({ type: "success", text: "No changes to save." });
      return;
    }

    setSaving(true);
    setFeedback(null);
    try {
      const res = await fetch(`/api/admins/${user.id}`, {
        method: "PATCH",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: trimmed }),
      });
      const body = (await res.json().catch(() => ({}))) as { message?: string };
      if (!res.ok) {
        setFeedback({ type: "error", text: body.message ?? "Save failed." });
        return;
      }
      setUser({ ...user, name: trimmed });
      setFeedback({ type: "success", text: "Profile updated." });
      window.dispatchEvent(new CustomEvent("erp-profile-updated"));
    } catch {
      setFeedback({ type: "error", text: "Save failed." });
    } finally {
      setSaving(false);
    }
  }

  function handleReset() {
    if (user) setName(user.name);
    setFeedback(null);
  }

  return (
    <ShowcaseSection title="Profile" className="!p-7">
      <p className="mb-6 text-body-sm text-dark-6 dark:text-dark-6">
        Your sign-in name for {BRAND.name} ERP. Email is read-only; ask an administrator if it must
        be changed.
      </p>

      {loading ? (
        <p className="text-body-sm text-dark-6">Loading…</p>
      ) : !user ? (
        <p className="text-body-sm text-red">Unable to load profile.</p>
      ) : (
        <form onSubmit={handleSubmit}>
          {feedback && (
            <p
              className={`mb-4 text-body-sm ${feedback.type === "success" ? "text-green-600 dark:text-green-400" : "text-red"}`}
              role="status"
            >
              {feedback.text}
            </p>
          )}

          <InputGroup
            className="mb-5.5"
            type="text"
            name="name"
            label="Full name"
            placeholder="Your name"
            value={name}
            handleChange={(e) => setName(e.target.value)}
            icon={<UserIcon />}
            iconPosition="left"
            height="sm"
            required
          />

          <InputGroup
            className="mb-5.5"
            type="email"
            name="email"
            label="Email (sign-in)"
            placeholder=""
            defaultValue={user.email}
            icon={<EmailIcon />}
            iconPosition="left"
            height="sm"
            disabled
          />

          <div className="mb-6">
            <span className="text-body-sm font-medium text-dark dark:text-white">Role</span>
            <p className="mt-2 rounded-lg border border-stroke bg-gray-2 px-5.5 py-2.5 text-body-sm text-dark dark:border-dark-3 dark:bg-dark-2 dark:text-white">
              {user.role === "admin" ? "Administrator" : user.role}
            </p>
          </div>

          <div className="flex justify-end gap-3">
            <button
              className="rounded-lg border border-stroke px-6 py-[7px] font-medium text-dark hover:shadow-1 disabled:opacity-50 dark:border-dark-3 dark:text-white"
              type="button"
              onClick={handleReset}
              disabled={saving}
            >
              Reset
            </button>

            <button
              className="rounded-lg bg-primary px-6 py-[7px] font-medium text-gray-2 hover:bg-opacity-90 disabled:opacity-50"
              type="submit"
              disabled={saving}
            >
              {saving ? "Saving…" : "Save"}
            </button>
          </div>
        </form>
      )}
    </ShowcaseSection>
  );
}
