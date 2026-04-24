"use client";

import { BRAND_LOGO_SRC } from "@/components/logo";
import jsPDF from "jspdf";
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

async function loadImageAsDataUrl(path: string): Promise<string | null> {
  try {
    const response = await fetch(path, { cache: "force-cache" });
    if (!response.ok) {
      return null;
    }
    const blob = await response.blob();
    const blobUrl = URL.createObjectURL(blob);
    const image = new Image();
    image.decoding = "async";
    image.src = blobUrl;
    await image.decode();

    const canvas = document.createElement("canvas");
    canvas.width = 420;
    canvas.height = 420;
    const ctx = canvas.getContext("2d");
    if (!ctx) {
      URL.revokeObjectURL(blobUrl);
      return null;
    }
    const size = Math.min(image.naturalWidth || image.width, image.naturalHeight || image.height);
    const sx = ((image.naturalWidth || image.width) - size) / 2;
    const sy = ((image.naturalHeight || image.height) - size) / 2;
    ctx.beginPath();
    ctx.arc(canvas.width / 2, canvas.height / 2, canvas.width / 2, 0, Math.PI * 2);
    ctx.closePath();
    ctx.clip();
    ctx.drawImage(image, sx, sy, size, size, 0, 0, canvas.width, canvas.height);
    URL.revokeObjectURL(blobUrl);
    return canvas.toDataURL("image/png", 0.92);
  } catch {
    return null;
  }
}

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

  const downloadMembershipCardPdf = async () => {
    if (!client) return;
    const doc = new jsPDF({ unit: "pt", format: "a4" });
    const pageWidth = doc.internal.pageSize.getWidth();
    const cardX = 70;
    const cardW = pageWidth - 140;
    const cardH = 220;

    const logoDataUrl = await loadImageAsDataUrl(BRAND_LOGO_SRC);
    const qrForPrint =
      qrDataUrl ||
      (await QRCode.toDataURL(client.cardUrl, {
        width: 220,
        margin: 1,
      }));

    const drawCardBase = (y: number) => {
      doc.setFillColor(5, 20, 56);
      doc.roundedRect(cardX, y, cardW, cardH, 12, 12, "F");
      doc.setFillColor(13, 53, 116);
      doc.roundedRect(cardX + 8, y + 8, cardW - 16, cardH - 16, 10, 10, "F");
      doc.setDrawColor(255, 172, 39);
      doc.setLineWidth(4);
      doc.line(cardX + cardW * 0.45, y + 18, cardX + cardW * 0.39, y + cardH - 18);
      doc.setLineWidth(1);
    };

    // Front side
    const frontY = 68;
    drawCardBase(frontY);
    if (logoDataUrl) {
      doc.addImage(logoDataUrl, "PNG", cardX + 22, frontY + 20, 70, 70);
    }
    doc.setTextColor(255, 255, 255);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(26);
    doc.text("MEMBERSHIP", cardX + 112, frontY + 46);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(11);
    doc.text("PREMIUM CLIENT CARD", cardX + 114, frontY + 64);
    doc.setFontSize(10);
    doc.text(`Client ID: ${client.id}`, cardX + 114, frontY + 84);

    doc.setFont("helvetica", "normal");
    doc.setFontSize(10);
    doc.text("CARDHOLDER", cardX + 24, frontY + 132);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(22);
    doc.text(client.name, cardX + 24, frontY + 160);

    if (qrForPrint) {
      doc.addImage(qrForPrint, "PNG", cardX + cardW - 124, frontY + 102, 90, 90);
    }

    // Back side
    const backY = frontY + cardH + 44;
    drawCardBase(backY);
    doc.setFillColor(2, 8, 30);
    doc.rect(cardX + 12, backY + 24, cardW - 24, 34, "F");

    if (qrForPrint) {
      doc.setFillColor(255, 255, 255);
      doc.roundedRect(cardX + 24, backY + 94, 104, 104, 8, 8, "F");
      doc.addImage(qrForPrint, "PNG", cardX + 31, backY + 101, 90, 90);
    }

    doc.setTextColor(220, 231, 255);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(10);
    const contact = client.contactNumber ?? client.email ?? "N/A";
    doc.text("Use this card QR to view live account details.", cardX + 148, backY + 118);
    doc.text(`Name: ${client.name}`, cardX + 148, backY + 138);
    doc.text(`Contact: ${contact}`, cardX + 148, backY + 154);
    doc.text(`Address: ${client.address ?? "N/A"}`, cardX + 148, backY + 170, {
      maxWidth: cardW - 176,
    });
    doc.text("Premium Beverages", cardX + 148, backY + 188);

    doc.save(`membership-card-${client.id}-v3.pdf`);
  };

  if (loading) {
    return (
      <div className="rounded-xl border border-stroke/80 bg-white p-4 shadow-sm dark:border-dark-3 dark:bg-gray-dark">
        <p>Loading...</p>
      </div>
    );
  }

  if (!client) {
    return (
      <div className="rounded-xl border border-stroke/80 bg-white p-4 shadow-sm dark:border-dark-3 dark:bg-gray-dark">
        <p className="text-red">{error || "Not found."}</p>
        <Link href="/dashboard/clients" className="mt-4 inline-block text-primary">
          ← Back to clients
        </Link>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div>
        <Link
          href="/dashboard/clients"
          className="text-sm font-medium text-primary hover:underline"
        >
          ← All clients
        </Link>
      </div>

      <section className="rounded-xl border border-stroke/80 bg-white p-4 shadow-sm dark:border-dark-3 dark:bg-gray-dark">
        <h2 className="text-lg font-semibold text-dark dark:text-white">
          Contact details
        </h2>
        {error ? <p className="mt-3 text-sm text-red">{error}</p> : null}
        <form onSubmit={saveClient} className="mt-3 grid gap-3 md:grid-cols-2">
          <input
            className="h-10 rounded-lg border border-stroke bg-transparent px-3.5 text-sm dark:border-dark-3 dark:bg-dark-2"
            value={edit.name}
            onChange={(e) => setEdit((s) => ({ ...s, name: e.target.value }))}
            required
          />
          <input
            className="h-10 rounded-lg border border-stroke bg-transparent px-3.5 text-sm dark:border-dark-3 dark:bg-dark-2"
            type="email"
            placeholder="Email"
            value={edit.email}
            onChange={(e) => setEdit((s) => ({ ...s, email: e.target.value }))}
          />
          <input
            className="h-10 rounded-lg border border-stroke bg-transparent px-3.5 text-sm dark:border-dark-3 dark:bg-dark-2"
            placeholder="Contact number"
            value={edit.contactNumber}
            onChange={(e) =>
              setEdit((s) => ({ ...s, contactNumber: e.target.value }))
            }
          />
          <textarea
            className="md:col-span-2 rounded-lg border border-stroke bg-transparent px-3.5 py-2.5 text-sm dark:border-dark-3 dark:bg-dark-2"
            placeholder="Address"
            rows={2}
            value={edit.address}
            onChange={(e) => setEdit((s) => ({ ...s, address: e.target.value }))}
          />
          <button
            type="submit"
            disabled={saving}
            className="h-10 rounded-lg bg-primary px-4 text-sm font-medium text-white hover:bg-opacity-90 disabled:opacity-60"
          >
            {saving ? "Saving..." : "Save changes"}
          </button>
        </form>
      </section>

      <section className="rounded-xl border border-stroke/80 bg-white p-4 shadow-sm dark:border-dark-3 dark:bg-gray-dark">
        <h2 className="text-lg font-semibold text-dark dark:text-white">
          Client membership QR
        </h2>
        <p className="mt-1 text-sm text-dark-5 dark:text-dark-6">
          Scan this QR code to open this client's full card with debit, credit,
          orders and payment details.
        </p>

        <div className="mt-3 flex flex-wrap items-start gap-4">
          {qrDataUrl ? (
            <img
              src={qrDataUrl}
              alt={`QR code for ${client.name}`}
              className="h-40 w-40 rounded-lg border border-stroke bg-white p-2 dark:border-dark-3"
            />
          ) : (
            <div className="flex h-40 w-40 items-center justify-center rounded-lg border border-stroke text-sm text-dark-5 dark:border-dark-3 dark:text-dark-6">
              QR loading...
            </div>
          )}

          <div className="space-y-3">
            <a
              href={client.cardUrl}
              target="_blank"
              rel="noreferrer"
              className="inline-flex h-9 items-center rounded-lg bg-primary px-4 text-sm font-medium text-white hover:bg-opacity-90"
            >
              Open client card
            </a>
            <button
              type="button"
              className="block h-9 rounded-lg border border-stroke px-4 text-sm font-medium hover:bg-gray-2 dark:border-dark-3 dark:hover:bg-dark-2"
              onClick={async () => {
                await navigator.clipboard.writeText(client.cardUrl);
              }}
            >
              Copy card URL
            </button>
            <button
              type="button"
              className="block h-9 rounded-lg border border-stroke px-4 text-sm font-medium hover:bg-gray-2 dark:border-dark-3 dark:hover:bg-dark-2"
              onClick={() => void downloadMembershipCardPdf()}
            >
              Download membership card PDF
            </button>
          </div>
        </div>
      </section>

      <section className="rounded-xl border border-stroke/80 bg-white p-4 shadow-sm dark:border-dark-3 dark:bg-gray-dark">
        <h2 className="text-lg font-semibold text-dark dark:text-white">
          Label inventory (this client)
        </h2>
        <p className="mt-1 text-sm text-dark-5 dark:text-dark-6">
          Track printed / branded labels per client. Quantities can be adjusted when
          you receive stock or after production (production module later).
        </p>

        <form
          onSubmit={addLabel}
          className="mt-3 flex flex-wrap items-end gap-3"
        >
          <input
            className="h-10 min-w-[180px] rounded-lg border border-stroke bg-transparent px-3.5 text-sm dark:border-dark-3 dark:bg-dark-2"
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
            className="h-10 w-28 rounded-lg border border-stroke bg-transparent px-3.5 text-sm dark:border-dark-3 dark:bg-dark-2"
            placeholder="Qty"
            value={newLabel.quantityAvailable}
            onChange={(e) =>
              setNewLabel((s) => ({ ...s, quantityAvailable: e.target.value }))
            }
          />
          <button
            type="submit"
            disabled={saving}
            className="h-10 rounded-lg border border-stroke px-4 text-sm font-medium hover:bg-gray-2 dark:border-dark-3 dark:hover:bg-dark-2"
          >
            Add label line
          </button>
        </form>

        <div className="mt-4 overflow-x-auto">
          <table className="w-full min-w-[560px] border-collapse text-sm">
            <thead>
              <tr className="border-b border-stroke text-left dark:border-dark-3">
                <th className="px-3 py-2 text-xs font-semibold uppercase tracking-wide text-dark-5 dark:text-dark-6">Label name</th>
                <th className="px-3 py-2 text-xs font-semibold uppercase tracking-wide text-dark-5 dark:text-dark-6">Quantity</th>
                <th className="px-3 py-2 text-xs font-semibold uppercase tracking-wide text-dark-5 dark:text-dark-6"> </th>
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
                      className="h-8 w-full max-w-xs rounded border border-stroke bg-transparent px-2.5 text-sm dark:border-dark-3"
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
                      className="h-8 w-24 rounded border border-stroke bg-transparent px-2.5 text-sm dark:border-dark-3"
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
