import { requireAuth } from "@/lib/auth";
import { dbExecute, dbQuery, type DbRow } from "@/lib/db";
import { NextResponse } from "next/server";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const auth = await requireAuth();
  if (!auth.ok) {
    return auth.response;
  }

  const { id: idParam } = await params;
  const clientId = Number(idParam);
  if (!Number.isInteger(clientId) || clientId < 1) {
    return NextResponse.json({ message: "Invalid client id." }, { status: 400 });
  }

  const [client] = await dbQuery<DbRow[]>(
    "SELECT id FROM clients WHERE id = ? LIMIT 1",
    [clientId],
  );
  if (client.length === 0) {
    return NextResponse.json({ message: "Client not found." }, { status: 404 });
  }

  const body = await request.json().catch(() => null);
  const labelName = String(body?.labelName ?? "").trim();
  const qty = Number(body?.quantityAvailable ?? 0);

  if (!labelName) {
    return NextResponse.json({ message: "Label name is required." }, { status: 400 });
  }
  if (!Number.isFinite(qty) || qty < 0) {
    return NextResponse.json(
      { message: "Quantity must be a non-negative number." },
      { status: 400 },
    );
  }

  try {
    const [result] = await dbExecute(
      `INSERT INTO client_labels (client_id, label_name, quantity_available, created_at, updated_at)
       VALUES (?, ?, ?, NOW(), NOW())`,
      [clientId, labelName, qty],
    );
    return NextResponse.json(
      { message: "Label added.", id: result.insertId },
      { status: 201 },
    );
  } catch (e: unknown) {
    const code = (e as { code?: string })?.code;
    if (code === "ER_DUP_ENTRY") {
      return NextResponse.json(
        { message: "This client already has a label with that name." },
        { status: 409 },
      );
    }
    throw e;
  }
}
