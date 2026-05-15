"use client";

import { renderAsync } from "docx-preview";
import { useEffect, useRef, useState } from "react";

/** Optional: fixed URL under /public, e.g. /my-guide.docx */
const STATIC_FALLBACK_PATHS = [
  process.env.NEXT_PUBLIC_SUPPORT_DOC_PATH,
  "/support-guideline.docx",
  "/Support-and-guideline.docx",
  "/guideline.docx",
].filter((p): p is string => Boolean(p && p.trim()));

export function SupportGuidelineClient() {
  const bodyRef = useRef<HTMLDivElement>(null);
  const styleRef = useRef<HTMLDivElement>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    const body = bodyRef.current;
    const styleHost = styleRef.current;
    if (!body || !styleHost) return;

    let cancelled = false;
    body.innerHTML = "";

    /** Keep Word layout as rendered by docx-preview (do not stretch or ignore page widths). */
    const renderOpts = {
      inWrapper: true,
      ignoreWidth: false,
      ignoreHeight: false,
      breakPages: true,
    } as const;

    void (async () => {
      setLoading(true);
      setError("");

      let apiHint = "";

      try {
        const apiRes = await fetch("/api/support-guideline", { cache: "no-store" });
        if (apiRes.ok) {
          const blob = await apiRes.blob();
          if (cancelled) return;
          await renderAsync(blob, body, styleHost, renderOpts);
          if (!cancelled) setLoading(false);
          return;
        }
        const ct = apiRes.headers.get("content-type");
        if (ct?.includes("application/json")) {
          const j = (await apiRes.json()) as { message?: string };
          apiHint = j.message ?? "";
        }
      } catch {
        apiHint = "Could not reach the handbook API.";
      }

      let lastStatus = 0;
      for (const path of STATIC_FALLBACK_PATHS) {
        try {
          const res = await fetch(path, { cache: "no-store" });
          lastStatus = res.status;
          if (!res.ok) continue;
          const blob = await res.blob();
          if (cancelled) return;
          await renderAsync(blob, body, styleHost, renderOpts);
          if (!cancelled) setLoading(false);
          return;
        } catch {
          /* try next */
        }
      }

      if (!cancelled) {
        const parts = [
          apiHint ||
            `No .docx handbook was found (static paths also failed, last HTTP ${lastStatus}).`,
          " Add any Word file saved as .docx anywhere under the project's public folder (root or a subfolder).",
          " The server picks preferred names first (support-guideline.docx), otherwise the first .docx it finds.",
        ];
        setError(parts.join(""));
        setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
      body.innerHTML = "";
    };
  }, []);

  return (
    <div className="w-full min-w-0 space-y-4">
      {loading ? (
        <div className="rounded-[10px] bg-white p-8 text-center shadow-1 dark:bg-gray-dark dark:shadow-card">
          <p className="text-dark dark:text-white">Loading document…</p>
        </div>
      ) : null}

      {error ? (
        <div className="rounded-[10px] border border-red/40 bg-red/5 p-4 text-sm text-red dark:bg-red/10">
          {error}
        </div>
      ) : null}

      <div ref={styleRef} className="hidden" aria-hidden />

      {/* One panel: document renders inside; vertical + horizontal scroll stay inside this div only. */}
      <div
        ref={bodyRef}
        className="docx-host flex w-full min-w-0 justify-center overflow-auto rounded-[10px] border border-stroke bg-gray-2 p-4 shadow-1 dark:border-dark-3 dark:bg-dark-2 dark:shadow-card sm:p-6 [&_.docx-wrapper]:shrink-0"
        style={{ maxHeight: "calc(100dvh - 11rem)" }}
      />
    </div>
  );
}
