"use client";

import { BRAND } from "@/lib/brand";
import { useMemo, useState } from "react";

const WEB3FORMS_URL = "https://api.web3forms.com/submit";

export function ContactForm() {
  const accessKey = useMemo(() => process.env.NEXT_PUBLIC_WEB3FORMS_ACCESS_KEY?.trim() ?? "", []);

  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [message, setMessage] = useState("");
  const [status, setStatus] = useState<"idle" | "loading" | "success" | "error">("idle");
  const [feedback, setFeedback] = useState("");

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();

    if (!accessKey) {
      setStatus("error");
      setFeedback("Contact form is not configured. Add NEXT_PUBLIC_WEB3FORMS_ACCESS_KEY to your environment.");
      return;
    }

    setStatus("loading");
    setFeedback("");

    try {
      const response = await fetch(WEB3FORMS_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json", Accept: "application/json" },
        body: JSON.stringify({
          access_key: accessKey,
          subject: `Website contact — ${BRAND.name}`,
          from_name: name,
          name,
          email,
          phone: phone.trim() || undefined,
          message,
          botcheck: false,
        }),
      });
      const payload = (await response.json().catch(() => null)) as { success?: boolean; message?: string } | null;

      if (!response.ok || !payload?.success) {
        setStatus("error");
        setFeedback(payload?.message ?? "Something went wrong. Please try again.");
        return;
      }

      setStatus("success");
      setFeedback("Thank you — we will get back to you soon.");
      setName("");
      setEmail("");
      setPhone("");
      setMessage("");
    } catch {
      setStatus("error");
      setFeedback("Network error. Please check your connection and try again.");
    }
  };

  const inputClass =
    "mt-1.5 w-full rounded-xl border border-white/15 bg-white/5 px-4 py-2.5 text-sm text-white placeholder:text-white/35 outline-none transition focus:border-primary focus:ring-1 focus:ring-primary/40";

  return (
    <form onSubmit={submit} className="w-full max-w-md text-left">
      <p className="text-xs font-semibold uppercase tracking-[0.2em] text-primary-muted">Contact</p>
      <h3 className="mt-2 text-lg font-semibold text-white">Send us a message</h3>

      <div className="mt-5 space-y-3">
        <div>
          <label htmlFor="contact-name" className="text-xs font-medium text-white/70">
            Name
          </label>
          <input
            id="contact-name"
            name="name"
            required
            autoComplete="name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            className={inputClass}
            placeholder="Your name"
          />
        </div>
        <div>
          <label htmlFor="contact-email" className="text-xs font-medium text-white/70">
            Email
          </label>
          <input
            id="contact-email"
            name="email"
            type="email"
            required
            autoComplete="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className={inputClass}
            placeholder="you@company.com"
          />
        </div>
        <div>
          <label htmlFor="contact-phone" className="text-xs font-medium text-white/70">
            Phone <span className="text-white/40">(optional)</span>
          </label>
          <input
            id="contact-phone"
            name="phone"
            type="tel"
            autoComplete="tel"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            className={inputClass}
            placeholder="+92 …"
          />
        </div>
        <div>
          <label htmlFor="contact-message" className="text-xs font-medium text-white/70">
            Message
          </label>
          <textarea
            id="contact-message"
            name="message"
            required
            minLength={10}
            rows={4}
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            className={`${inputClass} resize-y min-h-[110px]`}
            placeholder={`Tell us what you need — supply, partnership, or ${BRAND.name} programs.`}
          />
        </div>
      </div>

      {feedback ? (
        <p
          className={`mt-3 text-sm ${status === "success" ? "text-emerald-300" : "text-amber-200"}`}
          role="status"
        >
          {feedback}
        </p>
      ) : null}

      <button
        type="submit"
        disabled={status === "loading"}
        className="mt-5 inline-flex h-11 w-full items-center justify-center rounded-full bg-primary text-sm font-semibold text-white shadow-lg shadow-primary/25 transition hover:bg-primary-dark disabled:opacity-60"
      >
        {status === "loading" ? "Sending…" : "Send message"}
      </button>
    </form>
  );
}
