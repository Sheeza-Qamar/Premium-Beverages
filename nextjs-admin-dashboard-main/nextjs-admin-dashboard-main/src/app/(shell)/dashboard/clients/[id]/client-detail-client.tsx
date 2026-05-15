"use client";

import { BRAND_LOGO_SRC } from "@/components/logo";
import jsPDF from "jspdf";
import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
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

type ClientLabel = {
  id: number;
  labelName: string;
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
  const [labels, setLabels] = useState<ClientLabel[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const [qrDataUrl, setQrDataUrl] = useState("");

  const [newLabelName, setNewLabelName] = useState("");
  const [addingLabel, setAddingLabel] = useState(false);
  const [labelsError, setLabelsError] = useState("");
  const [editingLabelId, setEditingLabelId] = useState<number | null>(null);
  const [editLabelDraft, setEditLabelDraft] = useState("");
  const [savingLabelId, setSavingLabelId] = useState<number | null>(null);
  const [deletingLabelId, setDeletingLabelId] = useState<number | null>(null);
  const [labelLinesSearch, setLabelLinesSearch] = useState("");

  const [edit, setEdit] = useState({
    name: "",
    email: "",
    contactNumber: "",
    address: "",
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
        setLabels([]);
        return;
      }
      if (!r.ok) {
        const p = (await r.json().catch(() => null)) as { message?: string } | null;
        throw new Error(p?.message ?? "Failed to load.");
      }
      const data = (await r.json()) as {
        client: Client;
        labels: {
          id: number;
          labelName: string;
          quantityAvailable: number;
        }[];
      };
      setClient(data.client);
      setLabels(
        (data.labels ?? []).map((l) => ({
          id: l.id,
          labelName: l.labelName,
        })),
      );
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

  const addLabelLine = async (e: React.FormEvent) => {
    e.preventDefault();
    const name = newLabelName.trim();
    if (!name) {
      setLabelsError("Enter a label line name.");
      return;
    }
    setAddingLabel(true);
    setLabelsError("");
    try {
      const r = await fetch(`/api/clients/${id}/labels`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ labelName: name, quantityAvailable: 0 }),
      });
      if (!r.ok) {
        const p = (await r.json().catch(() => null)) as { message?: string } | null;
        throw new Error(p?.message ?? "Could not add label line.");
      }
      setNewLabelName("");
      await load();
    } catch (e) {
      setLabelsError(e instanceof Error ? e.message : "Could not add label line.");
    } finally {
      setAddingLabel(false);
    }
  };

  const saveLabelRename = async (labelId: number) => {
    const name = editLabelDraft.trim();
    if (!name) {
      setLabelsError("Label name cannot be empty.");
      return;
    }
    setSavingLabelId(labelId);
    setLabelsError("");
    try {
      const r = await fetch(`/api/clients/${id}/labels/${labelId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ labelName: name }),
      });
      if (!r.ok) {
        const p = (await r.json().catch(() => null)) as { message?: string } | null;
        throw new Error(p?.message ?? "Could not update label.");
      }
      setEditingLabelId(null);
      await load();
    } catch (e) {
      setLabelsError(e instanceof Error ? e.message : "Could not update label.");
    } finally {
      setSavingLabelId(null);
    }
  };

  const deleteLabelLine = async (labelId: number) => {
    if (
      !window.confirm(
        "Remove this label line? You cannot remove it if production or other records still reference it.",
      )
    ) {
      return;
    }
    setDeletingLabelId(labelId);
    setLabelsError("");
    try {
      const r = await fetch(`/api/clients/${id}/labels/${labelId}`, {
        method: "DELETE",
      });
      if (!r.ok) {
        const p = (await r.json().catch(() => null)) as { message?: string } | null;
        throw new Error(p?.message ?? "Could not remove label line.");
      }
      if (editingLabelId === labelId) {
        setEditingLabelId(null);
      }
      await load();
    } catch (e) {
      setLabelsError(e instanceof Error ? e.message : "Could not remove label line.");
    } finally {
      setDeletingLabelId(null);
    }
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

  const filteredLabelLines = useMemo(() => {
    const q = labelLinesSearch.trim().toLowerCase();
    if (!q) return labels;
    return labels.filter((l) => l.labelName.toLowerCase().includes(q));
  }, [labels, labelLinesSearch]);

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
          Branded label lines
        </h2>
        <p className="mt-1 text-sm text-dark-5 dark:text-dark-6">
          Add every print-shop label name for this client (for example Brand A 500ml). Quantities are
          adjusted under{" "}
          <Link href="/dashboard/inventory" className="font-medium text-primary hover:underline">
            Inventory
          </Link>{" "}
          when you add or edit label stock (type Label — pick this client and the line).
        </p>
        {labelsError ? (
          <p className="mt-3 text-sm text-red" role="alert">
            {labelsError}
          </p>
        ) : null}

        <label htmlFor="client-label-lines-search" className="sr-only">
          Search label lines
        </label>
        <input
          id="client-label-lines-search"
          type="search"
          value={labelLinesSearch}
          onChange={(e) => setLabelLinesSearch(e.target.value)}
          placeholder="Search label line name…"
          className="mt-3 w-full max-w-md rounded-lg border border-stroke bg-transparent px-3.5 py-2 text-sm dark:border-dark-3 dark:bg-dark-2"
        />

        <div className="mt-4 overflow-x-auto rounded-lg border border-stroke dark:border-dark-3">
          <table className="min-w-full text-left text-sm">
            <thead className="border-b border-stroke bg-gray-2/60 dark:border-dark-3 dark:bg-dark-2">
              <tr>
                <th className="px-3 py-2 font-medium text-dark dark:text-white">Label line</th>
                <th className="px-3 py-2 font-medium text-dark dark:text-white">Actions</th>
              </tr>
            </thead>
            <tbody>
              {labels.length === 0 ? (
                <tr>
                  <td
                    colSpan={2}
                    className="px-3 py-4 text-dark-5 dark:text-dark-6"
                  >
                    No label lines yet. Add the first name below.
                  </td>
                </tr>
              ) : filteredLabelLines.length === 0 ? (
                <tr>
                  <td colSpan={2} className="px-3 py-4 text-dark-5 dark:text-dark-6">
                    No label lines match your search.
                  </td>
                </tr>
              ) : (
                filteredLabelLines.map((l) => (
                  <tr
                    key={l.id}
                    className="border-b border-stroke last:border-0 dark:border-dark-3"
                  >
                    <td className="px-3 py-2 align-middle text-dark dark:text-white">
                      {editingLabelId === l.id ? (
                        <input
                          className="h-9 w-full max-w-xs rounded-lg border border-stroke bg-transparent px-2.5 text-sm dark:border-dark-3 dark:bg-dark-2"
                          value={editLabelDraft}
                          onChange={(e) => setEditLabelDraft(e.target.value)}
                          autoFocus
                        />
                      ) : (
                        l.labelName
                      )}
                    </td>
                    <td className="px-3 py-2 align-middle">
                      <div className="flex flex-wrap gap-2">
                        {editingLabelId === l.id ? (
                          <>
                            <button
                              type="button"
                              disabled={savingLabelId === l.id}
                              onClick={() => void saveLabelRename(l.id)}
                              className="h-8 rounded-lg bg-primary px-3 text-xs font-medium text-white hover:bg-opacity-90 disabled:opacity-60"
                            >
                              {savingLabelId === l.id ? "Saving…" : "Save"}
                            </button>
                            <button
                              type="button"
                              disabled={savingLabelId === l.id}
                              onClick={() => {
                                setEditingLabelId(null);
                                setLabelsError("");
                              }}
                              className="h-8 rounded-lg border border-stroke px-3 text-xs font-medium hover:bg-gray-2 dark:border-dark-3 dark:hover:bg-dark-2"
                            >
                              Cancel
                            </button>
                          </>
                        ) : (
                          <>
                            <button
                              type="button"
                              onClick={() => {
                                setEditingLabelId(l.id);
                                setEditLabelDraft(l.labelName);
                                setLabelsError("");
                              }}
                              className="h-8 rounded-lg border border-stroke px-3 text-xs font-medium hover:bg-gray-2 dark:border-dark-3 dark:hover:bg-dark-2"
                            >
                              Rename
                            </button>
                            <button
                              type="button"
                              disabled={deletingLabelId === l.id}
                              onClick={() => void deleteLabelLine(l.id)}
                              className="h-8 rounded-lg border border-stroke px-3 text-xs font-medium text-red hover:bg-red/5 dark:border-dark-3 disabled:opacity-60"
                            >
                              {deletingLabelId === l.id ? "Removing…" : "Remove"}
                            </button>
                          </>
                        )}
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        <form onSubmit={addLabelLine} className="mt-4 flex flex-wrap items-end gap-2">
          <div className="min-w-[200px] flex-1">
            <label htmlFor="new-label-line" className="sr-only">
              line name
            </label>
            <input
              id="new-label-line"
              className="h-10 w-full rounded-lg border border-stroke bg-transparent px-3.5 text-sm dark:border-dark-3 dark:bg-dark-2"
              placeholder="Aquafina.."
              value={newLabelName}
              onChange={(e) => setNewLabelName(e.target.value)}
            />
          </div>
          <button
            type="submit"
            disabled={addingLabel}
            className="h-10 shrink-0 rounded-lg bg-primary px-4 text-sm font-medium text-white hover:bg-opacity-90 disabled:opacity-60"
          >
            {addingLabel ? "Adding…" : "Add label line"}
          </button>
        </form>
      </section>

      <section className="rounded-xl border border-stroke/80 bg-white p-4 shadow-sm dark:border-dark-3 dark:bg-gray-dark">
        <h2 className="text-lg font-semibold text-dark dark:text-white">
          Client membership QR
        </h2>
        <p className="mt-1 text-sm text-dark-5 dark:text-dark-6">
          Scan this QR code to open this client&apos;s full card with debit, credit,
          orders and payment details. Label line names are listed above; label stock is
          adjusted under{" "}
          <Link href="/dashboard/inventory" className="font-medium text-primary hover:underline">
            Inventory
          </Link>
          .
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
    </div>
  );
}
