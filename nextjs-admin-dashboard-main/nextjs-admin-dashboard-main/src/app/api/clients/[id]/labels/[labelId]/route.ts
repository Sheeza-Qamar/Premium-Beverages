import { requireAuth } from "@/lib/auth";
import { dbExecute, dbQuery, type DbRow } from "@/lib/db";
import { NextResponse } from "next/server";

export async function PATCH(
  request: Request,
  {
    params,
  }: { params: Promise<{ id: string; labelId: string }> },
) {
  const auth = await requireAuth();
  if (!auth.ok) {
    return auth.response;
  }

  const { id: clientParam, labelId: labelParam } = await params;
  const clientId = Number(clientParam);
  const labelId = Number(labelParam);
  if (!Number.isInteger(clientId) || clientId < 1 || !Number.isInteger(labelId) || labelId < 1) {
    return NextResponse.json({ message: "Invalid id." }, { status: 400 });
  }

  const [row] = await dbQuery<DbRow[]>(
    "SELECT id FROM client_labels WHERE id = ? AND client_id = ? LIMIT 1",
    [labelId, clientId],
  );
  if (row.length === 0) {
    return NextResponse.json({ message: "Label not found." }, { status: 404 });
  }

  const body = await request.json().catch(() => null);
  const labelName =
    body?.labelName !== undefined
      ? String(body?.labelName ?? "").trim()
      : undefined;
  const quantityAvailable =
    body?.quantityAvailable !== undefined
      ? Number(body.quantityAvailable)
      : undefined;

  if (labelName !== undefined && !labelName) {
    return NextResponse.json({ message: "Label name cannot be empty." }, { status: 400 });
  }
  if (
    quantityAvailable !== undefined &&
    (!Number.isFinite(quantityAvailable) || quantityAvailable < 0)
  ) {
    return NextResponse.json(
      { message: "Quantity must be a non-negative number." },
      { status: 400 },
    );
  }

  if (labelName === undefined && quantityAvailable === undefined) {
    return NextResponse.json({ message: "Nothing to update." }, { status: 400 });
  }

  const updates: string[] = [];
  const values: Array<string | number> = [];
  if (labelName !== undefined) {
    updates.push("label_name = ?");
    values.push(labelName);
  }
  if (quantityAvailable !== undefined) {
    updates.push("quantity_available = ?");
    values.push(quantityAvailable);
  }
  updates.push("updated_at = NOW()");
  values.push(labelId);

  try {
    await dbExecute(
      `UPDATE client_labels SET ${updates.join(", ")} WHERE id = ?`,
      values,
    );
  } catch (e: unknown) {
    const code = (e as { code?: string })?.code;
    if (code === "ER_DUP_ENTRY") {
      return NextResponse.json(
        { message: "Another label with this name already exists for this client." },
        { status: 409 },
      );
    }
    throw e;
  }

  return NextResponse.json({ message: "Updated." });
}

export async function DELETE(
  _request: Request,
  {
    params,
  }: { params: Promise<{ id: string; labelId: string }> },
) {
  const auth = await requireAuth();
  if (!auth.ok) {
    return auth.response;
  }

  const { id: clientParam, labelId: labelParam } = await params;
  const clientId = Number(clientParam);
  const labelId = Number(labelParam);
  if (!Number.isInteger(clientId) || clientId < 1 || !Number.isInteger(labelId) || labelId < 1) {
    return NextResponse.json({ message: "Invalid id." }, { status: 400 });
  }

  const [result] = await dbExecute(
    "DELETE FROM client_labels WHERE id = ? AND client_id = ?",
    [labelId, clientId],
  );

  if (result.affectedRows === 0) {
    return NextResponse.json({ message: "Label not found." }, { status: 404 });
  }

  return NextResponse.json({ message: "Deleted." });
}
