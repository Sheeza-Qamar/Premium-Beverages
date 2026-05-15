"use client";

import { ContactForm } from "@/components/landing/contact-form";
import { BRAND_LOGO_SRC } from "@/components/logo";
import { BRAND } from "@/lib/brand";
import Image from "next/image";
import Link from "next/link";
import { useState } from "react";

const nav = [
  { href: "#services", label: "What we offer" },
  { href: "#quality", label: "Quality" },
  { href: "#partnership", label: "Partnership" },
  { href: "#contact", label: "Get in touch" },
];

const offerings = [
  {
    title: "Premium packaged beverages",
    desc: "Consistent taste, safe handling, and batch traceability from source to delivery.",
    icon: "01",
  },
  {
    title: "Wholesale & B2B supply",
    desc: "Reliable volume supply for retailers, canteens, and channels that depend on you.",
    icon: "02",
  },
  {
    title: "Label & brand programs",
    desc: "Co-branded and private-label options with clear specifications and quality checks.",
    icon: "03",
  },
  {
    title: "Order & account clarity",
    desc: "Transparent ordering, invoices, and payment history so nothing is left to guesswork.",
    icon: "04",
  },
  {
    title: "Inventory you can trust",
    desc: "Stock visibility and production alignment to reduce waste and last-minute gaps.",
    icon: "05",
  },
  {
    title: "Support that responds",
    desc: "A professional team focused on resolution, not paperwork — when you need answers fast.",
    icon: "06",
  },
];

const pillars = [
  { title: "Product integrity", body: "Rigorous standards for what goes in the bottle and how it reaches you." },
  { title: "Operational discipline", body: "Systems and processes that keep promises predictable at scale." },
  { title: "Long-term relationships", body: "We grow when our partners grow — built on trust, not one-off deals." },
];

export function LandingPage() {
  const [open, setOpen] = useState(false);

  return (
    <div className="min-h-screen bg-[#040a12] text-white antialiased">
      <div
        className="pointer-events-none fixed inset-0 -z-10"
        style={{
          background: `
            radial-gradient(1200px 600px at 20% -10%, rgba(26, 122, 155, 0.35) 0%, transparent 55%),
            radial-gradient(900px 500px at 100% 20%, rgba(20, 106, 132, 0.2) 0%, transparent 50%),
            linear-gradient(180deg, #040a12 0%, #07131c 40%, #040a12 100%)
          `,
        }}
      />
      <div
        className="pointer-events-none fixed inset-0 -z-10 opacity-[0.14]"
        style={{
          backgroundImage: `url("data:image/svg+xml,%3Csvg width='60' height='60' viewBox='0 0 60 60' xmlns='http://www.w3.org/2000/svg'%3E%3Cg fill='none' fill-rule='evenodd'%3E%3Cg fill='%23ffffff' fill-opacity='1'%3E%3Cpath d='M36 34v-4h-2v4h-4v2h4v4h2v-4h4v-2h-4zm0-30V0h-2v4h-4v2h4v4h2V6h4V4h-4zM6 34v-4H4v4H0v2h4v4h2v-4h4v-2H6zM6 4V0H4v4H0v2h4v4h2V6h4V4H6z'/%3E%3C/g%3E%3C/g%3E%3C/svg%3E")`,
        }}
      />

      <header className="sticky top-0 z-50 border-b border-white/10 bg-[#040a12]/80 backdrop-blur-md">
        <div className="mx-auto flex h-16 max-w-6xl items-center justify-between gap-4 px-4 sm:h-[4.5rem] sm:px-6">
          <Link href="/" className="flex items-center gap-3" onClick={() => setOpen(false)}>
            <div className="relative size-10 overflow-hidden rounded-full border border-white/20 shadow-lg sm:size-11">
              <Image
                src={BRAND_LOGO_SRC}
                alt={BRAND.name}
                fill
                className="object-cover"
                sizes="44px"
                priority
              />
            </div>
            <span className="text-sm font-semibold tracking-tight sm:text-base">{BRAND.name}</span>
          </Link>

          <nav className="hidden items-center gap-8 text-sm font-medium text-white/80 md:flex">
            {nav.map((item) => (
              <a
                key={item.href}
                href={item.href}
                className="transition hover:text-white"
              >
                {item.label}
              </a>
            ))}
          </nav>

          <div className="flex shrink-0 items-center gap-2 sm:gap-3">
            <Link
              href="#contact"
              className="inline-flex whitespace-nowrap rounded-full bg-primary px-3 py-2 text-xs font-semibold text-white shadow-lg shadow-primary/25 transition hover:bg-primary-dark sm:px-4 sm:text-sm"
            >
              Contact sales
            </Link>
            <Link
              href="/auth/sign-in"
              className="inline-flex whitespace-nowrap rounded-full bg-white px-3 py-2 text-xs font-semibold text-dark transition hover:bg-white/90 sm:px-4 sm:text-sm"
            >
              Admin login
            </Link>
            <button
              type="button"
              className="inline-flex h-10 min-w-[4.5rem] items-center justify-center rounded-lg border border-white/15 px-3 text-xs font-semibold uppercase tracking-wide md:hidden"
              aria-expanded={open}
              aria-label={open ? "Close menu" : "Open menu"}
              onClick={() => setOpen((v) => !v)}
            >
              {open ? "Close" : "Menu"}
            </button>
          </div>
        </div>

        {open ? (
          <div className="border-t border-white/10 bg-[#040a12]/95 px-4 py-4 md:hidden">
            <div className="flex flex-col gap-1">
              {nav.map((item) => (
                <a
                  key={item.href}
                  href={item.href}
                  className="rounded-lg px-3 py-2.5 text-sm font-medium text-white/90 hover:bg-white/5"
                  onClick={() => setOpen(false)}
                >
                  {item.label}
                </a>
              ))}
              <a
                href="#contact"
                className="mt-2 rounded-lg bg-primary px-3 py-2.5 text-center text-sm font-semibold text-white"
                onClick={() => setOpen(false)}
              >
                Contact sales
              </a>
              <Link
                href="/auth/sign-in"
                className="rounded-lg border border-white/20 bg-white px-3 py-2.5 text-center text-sm font-semibold text-dark"
                onClick={() => setOpen(false)}
              >
                Admin login
              </Link>
            </div>
          </div>
        ) : null}
      </header>

      <main>
        <section className="relative overflow-hidden px-4 pb-20 pt-14 sm:px-6 sm:pb-28 sm:pt-20 lg:pt-24">
          <div className="mx-auto max-w-6xl">
            <p className="mb-4 inline-flex rounded-full border border-primary/40 bg-primary/10 px-4 py-1.5 text-xs font-semibold uppercase tracking-[0.2em] text-primary-muted">
              Trusted beverage partner
            </p>
            <h1 className="max-w-3xl text-4xl font-semibold leading-[1.08] tracking-tight text-white sm:text-5xl lg:text-[3.25rem]">
              Quality beverages. Reliable supply.{" "}
              <span className="bg-gradient-to-r from-[#7ecce0] via-white to-[#7ecce0] bg-clip-text text-transparent">
                Built for partners who expect more.
              </span>
            </h1>
            <p className="mt-6 max-w-2xl text-base leading-relaxed text-white/65 sm:text-lg">
              {BRAND.name} delivers premium packaged drinks and dependable B2B programs — with the
              operational rigor, transparency, and service mindset that modern businesses deserve.
            </p>
            <div className="mt-10 flex flex-col gap-3 sm:flex-row sm:items-center">
              <a
                href="#contact"
                className="inline-flex h-12 items-center justify-center rounded-full bg-primary px-8 text-sm font-semibold text-white shadow-xl shadow-primary/30 transition hover:bg-primary-dark"
              >
                Start a conversation
              </a>
              <a
                href="#services"
                className="inline-flex h-12 items-center justify-center rounded-full border border-white/20 bg-white/5 px-8 text-sm font-medium text-white/90 transition hover:border-white/30 hover:bg-white/10"
              >
                Explore what we offer
              </a>
            </div>
            <div className="mt-16 grid gap-4 sm:grid-cols-3">
              {[
                { k: "Focus", v: "Product & partner experience" },
                { k: "Approach", v: "Quality-first, data-backed operations" },
                { k: "Commitment", v: "On-time supply & clear communication" },
              ].map((row) => (
                <div
                  key={row.k}
                  className="rounded-2xl border border-white/10 bg-white/[0.04] p-5 backdrop-blur-sm"
                >
                  <p className="text-xs font-semibold uppercase tracking-wider text-primary-muted">
                    {row.k}
                  </p>
                  <p className="mt-2 text-sm font-medium text-white/90">{row.v}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        <section id="services" className="scroll-mt-24 border-t border-white/10 bg-white/[0.02] px-4 py-20 sm:px-6">
          <div className="mx-auto max-w-6xl">
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-primary-muted">What we offer</p>
            <h2 className="mt-3 max-w-2xl text-3xl font-semibold tracking-tight text-white sm:text-4xl">
              Everything you need from a serious beverage partner
            </h2>
            <p className="mt-4 max-w-2xl text-base text-white/60">
              From product excellence to dependable fulfilment, we align operations with your shelf,
              your customers, and your reputation.
            </p>
            <div className="mt-12 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {offerings.map((item) => (
                <article
                  key={item.title}
                  className="group rounded-2xl border border-white/10 bg-gradient-to-b from-white/[0.07] to-transparent p-6 transition hover:border-primary/40 hover:shadow-lg hover:shadow-primary/10"
                >
                  <span className="text-xs font-mono text-primary-muted/90">{item.icon}</span>
                  <h3 className="mt-3 text-lg font-semibold text-white">{item.title}</h3>
                  <p className="mt-2 text-sm leading-relaxed text-white/55">{item.desc}</p>
                </article>
              ))}
            </div>
          </div>
        </section>

        <section id="quality" className="scroll-mt-24 px-4 py-20 sm:px-6">
          <div className="mx-auto grid max-w-6xl gap-12 lg:grid-cols-2 lg:items-center">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.2em] text-primary-muted">Quality</p>
              <h2 className="mt-3 text-3xl font-semibold tracking-tight text-white sm:text-4xl">
                Precision at every step — not just on the label
              </h2>
              <p className="mt-4 text-base leading-relaxed text-white/60">
                Our standards cover sourcing discipline, production oversight, and careful delivery
                practices. The goal is simple: your end customer should experience the same quality
                every time.
              </p>
              <ul className="mt-8 space-y-4">
                {[
                  "Consistent product profiles and batch awareness",
                  "Clear documentation and traceability where it matters",
                  "Packaging and handling that protect what you sell",
                ].map((t) => (
                  <li key={t} className="flex gap-3 text-sm text-white/75">
                    <span className="mt-1.5 size-1.5 shrink-0 rounded-full bg-primary" />
                    {t}
                  </li>
                ))}
              </ul>
            </div>
            <div className="relative aspect-[4/3] overflow-hidden rounded-3xl border border-white/10 bg-gradient-to-br from-primary/20 via-[#0a1f2e] to-[#040a12] p-8 shadow-2xl">
              <Image
                src={BRAND_LOGO_SRC}
                alt={`${BRAND.name} brand visual`}
                fill
                className="object-cover opacity-25 saturate-125"
                sizes="(max-width: 1024px) 100vw, 520px"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-[#040a12]/90 via-[#0a1f2e]/70 to-[#0a1f2e]/30" />
              <div className="absolute inset-0 bg-[radial-gradient(circle_at_30%_20%,rgba(255,255,255,0.12),transparent_50%)]" />
              <div className="relative flex h-full flex-col justify-end">
                <p className="text-sm font-medium text-white/90">“We don’t compete on noise — we compete on trust.”</p>
                <p className="mt-2 text-xs text-white/50">— {BRAND.name} operating philosophy</p>
              </div>
            </div>
          </div>
        </section>

        <section id="partnership" className="scroll-mt-24 border-t border-white/10 bg-white/[0.02] px-4 py-20 sm:px-6">
          <div className="mx-auto max-w-6xl">
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-primary-muted">Partnership</p>
            <h2 className="mt-3 max-w-2xl text-3xl font-semibold tracking-tight text-white sm:text-4xl">
              Why partners choose {BRAND.name}
            </h2>
            <div className="mt-12 grid gap-6 md:grid-cols-3">
              {pillars.map((p) => (
                <div
                  key={p.title}
                  className="rounded-2xl border border-white/10 bg-[#07131c]/80 p-6 backdrop-blur-sm"
                >
                  <h3 className="text-lg font-semibold text-white">{p.title}</h3>
                  <p className="mt-2 text-sm leading-relaxed text-white/55">{p.body}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        <section id="contact" className="scroll-mt-24 px-4 py-20 sm:px-6">
          <div className="mx-auto max-w-6xl overflow-hidden rounded-3xl border border-primary/30 bg-gradient-to-br from-primary/25 via-[#0a1f2e] to-[#040a12] p-8 shadow-2xl sm:p-12">
            <div className="grid gap-10 lg:grid-cols-[1fr_minmax(0,28rem)] lg:items-start lg:gap-12">
              <div className="text-center lg:text-left">
                <p className="text-xs font-semibold uppercase tracking-[0.2em] text-primary-muted">Get in touch</p>
                <h2 className="mt-2 text-2xl font-semibold tracking-tight text-white sm:text-3xl">
                  Ready to talk supply, labels, or a long-term program?
                </h2>
                <p className="mt-4 text-sm text-white/65 sm:text-base">
                  Use the form to reach sales — we will get back to you as soon as we can.
                </p>
                <div className="mt-8 flex justify-center lg:justify-start">
                  <a
                    href="#services"
                    className="inline-flex h-12 min-w-[200px] items-center justify-center rounded-full border border-white/25 bg-transparent px-8 text-sm font-medium text-white transition hover:border-white/40"
                  >
                    Review services
                  </a>
                </div>
              </div>
              <div className="flex justify-center lg:justify-end">
                <div className="w-full max-w-md rounded-2xl border border-white/10 bg-[#040a12]/60 p-6 backdrop-blur-sm sm:p-8">
                  <ContactForm />
                </div>
              </div>
            </div>
          </div>
        </section>
      </main>

      <footer className="border-t border-white/10 px-4 py-10 sm:px-6">
        <div className="mx-auto flex max-w-6xl flex-col items-center justify-between gap-6 sm:flex-row">
          <div className="flex items-center gap-3">
            <div className="relative size-9 overflow-hidden rounded-full border border-white/15">
              <Image src={BRAND_LOGO_SRC} alt="" fill className="object-cover" sizes="36px" />
            </div>
            <div>
              <p className="text-sm font-semibold text-white">{BRAND.name}</p>
              <p className="text-xs text-white/45">Premium beverages · Professional operations</p>
            </div>
          </div>
          <div className="text-center text-xs text-white/40 sm:text-right">
            <p>© {new Date().getFullYear()} {BRAND.name}. All rights reserved.</p>
            <p className="mt-1">
              <Link href="/auth/sign-in" className="text-white/55 hover:text-white">
                Admin login
              </Link>
            </p>
          </div>
        </div>
      </footer>
    </div>
  );
}
