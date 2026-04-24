"use client";
import { EmailIcon, PasswordIcon } from "@/assets/icons";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import React, { useEffect, useState } from "react";
import InputGroup from "../FormElements/InputGroup";
import { Checkbox } from "../FormElements/checkbox";

export default function SigninWithPassword() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [data, setData] = useState({
    email: "",
    password: "",
    remember: false,
  });

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [firstAdminAvailable, setFirstAdminAvailable] = useState(false);

  useEffect(() => {
    void (async () => {
      try {
        const r = await fetch("/api/auth/first-admin-available", {
          cache: "no-store",
        });
        const data = (await r.json()) as { available?: boolean };
        setFirstAdminAvailable(data.available === true);
      } catch {
        setFirstAdminAvailable(false);
      }
    })();
  }, []);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setData({
      ...data,
      [e.target.name]: e.target.value,
    });
  };

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setLoading(true);
    setError("");

    try {
      const response = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: data.email,
          password: data.password,
          remember: data.remember,
        }),
      });

      if (!response.ok) {
        const payload = (await response.json().catch(() => null)) as
          | { message?: string }
          | null;
        setError(
          payload?.message ??
            (response.status === 503
              ? "Server cannot connect to the database."
              : "Login failed."),
        );
        return;
      }

      const next =
        searchParams.get("callbackUrl")?.trim() || "/dashboard";
      const safe =
        next.startsWith("/") && !next.startsWith("//") ? next : "/dashboard";
      router.push(safe);
      router.refresh();
    } finally {
      setLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit}>
      {firstAdminAvailable ? (
        <div className="mb-4 rounded-lg border border-primary/30 bg-primary/5 px-4 py-3 text-sm dark:bg-primary/10">
          <span className="text-dark dark:text-white">
            No administrator exists yet.{" "}
          </span>
          <Link
            href="/auth/first-admin"
            className="font-medium text-primary hover:underline"
          >
            Create the first admin account
          </Link>
        </div>
      ) : null}
      <InputGroup
        type="email"
        label="Email"
        className="mb-4 [&_input]:py-[15px]"
        placeholder="you@example.com"
        name="email"
        handleChange={handleChange}
        value={data.email}
        icon={<EmailIcon />}
      />

      <InputGroup
        type="password"
        label="Password"
        className="mb-5 [&_input]:py-[15px]"
        placeholder="Enter your password"
        name="password"
        handleChange={handleChange}
        value={data.password}
        icon={<PasswordIcon />}
      />

      <div className="mb-6 flex items-center justify-between gap-3 py-1 font-medium">
        <Checkbox
          label="Remember me"
          name="remember"
          withIcon="check"
          minimal
          radius="md"
          onChange={(e) =>
            setData({
              ...data,
              remember: e.target.checked,
            })
          }
        />
        <span className="text-sm text-dark-5 dark:text-dark-6">
          Admin access only
        </span>
      </div>

      <div className="mb-4.5">
        <button
          type="submit"
          className="flex w-full cursor-pointer items-center justify-center gap-2 rounded-lg bg-primary p-4 font-medium text-white transition hover:bg-opacity-90"
        >
          Sign In
          {loading && (
            <span className="inline-block h-4 w-4 animate-spin rounded-full border-2 border-solid border-white border-t-transparent dark:border-primary dark:border-t-transparent" />
          )}
        </button>
      </div>

      {error ? <p className="text-sm text-red">{error}</p> : null}
    </form>
  );
}
