import { requireAuth } from "@/lib/auth";
import { createClientCardToken } from "@/lib/client-card-token";
import { dbExecute, dbQuery, type DbRow } from "@/lib/db";
import { isValidEmail, toOptionalTrimmedString, toTrimmedString } from "@/lib/validation";
import { NextResponse } from "next/server";

type ClientRow = DbRow & {
  id: number;
  name: string;
  email: string | null;
  contact_number: string | null;
  address: string | null;
  created_at: string;
  updated_at: string;
};

type LabelRow = DbRow & {
  id: number;
  label_name: string;
  quantity_available: string;
  created_at: string;
  updated_at: string;
};

export async function GET(
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

  const [clients] = await dbQuery<ClientRow[]>(
    `SELECT id, name, email, contact_number, address, created_at, updated_at
     FROM clients WHERE id = ? LIMIT 1`,
    [clientId],
  );
  if (clients.length === 0) {
    return NextResponse.json({ message: "Client not found." }, { status: 404 });
  }

  const [labels] = await dbQuery<LabelRow[]>(
    `SELECT id, label_name, quantity_available, created_at, updated_at
     FROM client_labels
     WHERE client_id = ?
     ORDER BY label_name ASC`,
    [clientId],
  );

  const c = clients[0];
  const cardToken = createClientCardToken(c.id);
  const origin = new URL(request.url).origin;
  return NextResponse.json({
    client: {
      id: c.id,
      name: c.name,
      email: c.email,
      contactNumber: c.contact_number,
      address: c.address,
      createdAt: c.created_at,
      updatedAt: c.updated_at,
      cardToken,
      cardUrl: `${origin}/client-card/${cardToken}`,
    },
    labels: labels.map((l) => ({
      id: l.id,
      labelName: l.label_name,
      quantityAvailable: Number(l.quantity_available),
      createdAt: l.created_at,
      updatedAt: l.updated_at,
    })),
  });
}

export async function PATCH(
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

  const body = await request.json().catch(() => null);
  const name =
    body?.name !== undefined ? toTrimmedString(body?.name) : undefined;
  const email =
    body?.email !== undefined
      ? body?.email === null
        ? null
        : (toOptionalTrimmedString(body.email)?.toLowerCase() ?? null)
      : undefined;
  const contactNumber =
    body?.contactNumber !== undefined
      ? body?.contactNumber === null
        ? null
        : toOptionalTrimmedString(body.contactNumber)
      : undefined;
  const address =
    body?.address !== undefined
      ? body?.address === null
        ? null
        : toOptionalTrimmedString(body.address)
      : undefined;

  if (name !== undefined && !name) {
    return NextResponse.json({ message: "Name cannot be empty." }, { status: 400 });
  }
  if (email !== undefined && email !== null && !isValidEmail(email)) {
    return NextResponse.json({ message: "Enter a valid email address." }, { status: 400 });
  }

  if (
    name === undefined &&
    email === undefined &&
    contactNumber === undefined &&
    address === undefined
  ) {
    return NextResponse.json({ message: "Nothing to update." }, { status: 400 });
  }

  const [exists] = await dbQuery<DbRow[]>(
    "SELECT id FROM clients WHERE id = ? LIMIT 1",
    [clientId],
  );
  if (exists.length === 0) {
    return NextResponse.json({ message: "Client not found." }, { status: 404 });
  }

  const updates: string[] = [];
  const values: Array<string | null | number> = [];
  if (name !== undefined) {
    updates.push("name = ?");
    values.push(name);
  }
  if (email !== undefined) {
    updates.push("email = ?");
    values.push(email);
  }
  if (contactNumber !== undefined) {
    updates.push("contact_number = ?");
    values.push(contactNumber);
  }
  if (address !== undefined) {
    updates.push("address = ?");
    values.push(address);
  }
  updates.push("updated_at = NOW()");
  values.push(clientId);

  await dbExecute(`UPDATE clients SET ${updates.join(", ")} WHERE id = ?`, values);

  return NextResponse.json({ message: "Updated." });
}

export async function DELETE(
  _request: Request,
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

  const [orders] = await dbQuery<DbRow[]>(
    "SELECT id FROM orders WHERE client_id = ? LIMIT 1",
    [clientId],
  );
  if (orders.length > 0) {
    return NextResponse.json(
      {
        message:
          "Cannot delete this client because they have orders. Remove or reassign orders first.",
      },
      { status: 409 },
    );
  }

  const [production] = await dbQuery<DbRow[]>(
    "SELECT id FROM production WHERE client_id = ? LIMIT 1",
    [clientId],
  );
  if (production.length > 0) {
    return NextResponse.json(
      {
        message:
          "Cannot delete this client because they have production records.",
      },
      { status: 409 },
    );
  }

  await dbExecute("DELETE FROM clients WHERE id = ?", [clientId]);

  return NextResponse.json({ message: "Deleted." });
}
