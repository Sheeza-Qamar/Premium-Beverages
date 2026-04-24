import { requireAuth } from "@/lib/auth";
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

export async function GET() {
  const auth = await requireAuth();
  if (!auth.ok) {
    return auth.response;
  }
  const [rows] = await dbQuery<ClientRow[]>(
    `SELECT id, name, email, contact_number, address, created_at, updated_at
     FROM clients
     ORDER BY name ASC`,
  );

  return NextResponse.json({
    clients: rows.map((r) => ({
      id: r.id,
      name: r.name,
      email: r.email,
      contactNumber: r.contact_number,
      address: r.address,
      createdAt: r.created_at,
      updatedAt: r.updated_at,
    })),
  });
}

export async function POST(request: Request) {
  const auth = await requireAuth();
  if (!auth.ok) {
    return auth.response;
  }
  const body = await request.json().catch(() => null);
  const name = toTrimmedString(body?.name);
  const email =
    body?.email !== undefined && body?.email !== null
      ? toOptionalTrimmedString(body.email)?.toLowerCase() ?? null
      : null;
  const contactNumber =
    body?.contactNumber !== undefined && body?.contactNumber !== null
      ? toOptionalTrimmedString(body.contactNumber)
      : null;
  const address =
    body?.address !== undefined && body?.address !== null
      ? toOptionalTrimmedString(body.address)
      : null;

  if (!name) {
    return NextResponse.json({ message: "Client name is required." }, { status: 400 });
  }
  if (email && !isValidEmail(email)) {
    return NextResponse.json({ message: "Enter a valid email address." }, { status: 400 });
  }

  const [result] = await dbExecute(
    `INSERT INTO clients (name, email, contact_number, address, created_at, updated_at)
     VALUES (?, ?, ?, ?, NOW(), NOW())`,
    [name, email, contactNumber, address],
  );

  return NextResponse.json(
    { message: "Client created.", id: result.insertId },
    { status: 201 },
  );
}
