import Signin from "@/components/Auth/Signin";
import { BRAND } from "@/lib/brand";
import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Sign in",
};

export default function SignIn() {
  return (
    <main className="relative flex min-h-screen items-center justify-center overflow-hidden bg-slate-950 px-4 py-10">
      <div
        className="pointer-events-none absolute inset-0 opacity-90"
        style={{
          background:
            "radial-gradient(circle at 10% 15%, rgba(26,122,155,0.45), transparent 40%), radial-gradient(circle at 90% 85%, rgba(20,106,132,0.35), transparent 45%), linear-gradient(135deg, #041b2d 0%, #08263d 45%, #0f2f46 100%)",
        }}
      />
      <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(0deg,rgba(255,255,255,0.02)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.02)_1px,transparent_1px)] bg-[size:36px_36px]" />

      <div className="relative z-10 w-full max-w-5xl overflow-hidden rounded-2xl border border-white/20 bg-white/8 shadow-2xl backdrop-blur-xl">
        <div className="grid min-h-[620px] grid-cols-1 lg:grid-cols-2">
          <div className="hidden bg-primary/[0.18] p-10 lg:block">
            <Link href="/" className="inline-flex items-center gap-3">
              <Image
                src="/images/logo/elegant-premium-beverages-logo.png"
                alt={BRAND.name}
                width={72}
                height={72}
                className="rounded-full border border-white/30 object-cover"
                priority
              />
              <span className="text-lg font-semibold text-white">{BRAND.name}</span>
            </Link>

            <div className="mt-20 max-w-sm">
              <p className="text-sm uppercase tracking-[0.2em] text-white/70">
                Admin Portal
              </p>
              <h1 className="mt-3 text-4xl font-bold leading-tight text-white">
                Welcome Back
              </h1>
              <p className="mt-4 text-base text-white/80">
                Sign in to manage inventory, production, billing, recovery, and
                client ledgers in one secure dashboard.
              </p>
            </div>
          </div>

          <div className="flex items-center bg-white/95 p-6 sm:p-10 dark:bg-gray-dark/95">
            <div className="mx-auto w-full max-w-md">
              <Link className="mb-8 inline-flex items-center gap-3 lg:hidden" href="/">
                <Image
                  src="/images/logo/elegant-premium-beverages-logo.png"
                  alt={BRAND.name}
                  width={56}
                  height={56}
                  className="rounded-full object-cover"
                  priority
                />
                <span className="text-lg font-semibold text-dark dark:text-white">
                  {BRAND.name}
                </span>
              </Link>

              <p className="text-sm font-medium uppercase tracking-wider text-primary">
                Sign in
              </p>
              <h2 className="mt-2 text-3xl font-bold text-dark dark:text-white">
                Login to your account
              </h2>
              <p className="mt-2 text-sm text-dark-5 dark:text-dark-6">
                Use your administrator credentials to continue.
              </p>

              <div className="mt-8">
                <Signin />
              </div>
            </div>
          </div>
        </div>
      </div>
    </main>
  );
}
