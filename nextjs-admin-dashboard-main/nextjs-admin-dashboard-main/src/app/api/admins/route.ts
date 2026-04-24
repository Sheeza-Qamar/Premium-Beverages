import { getSessionUser } from "@/lib/auth";
import { dbExecute, dbQuery, type DbRow } from "@/lib/db";
import bcrypt from "bcryptjs";
import { NextResponse } from "next/server";

type AdminRow = DbRow & {
  id: number;
  name: string;
  email: string;
  is_active: number;
  created_at: string;
  created_by: number | null;
};

async function requireSignedInAdmin() {
  const user = await getSessionUser();
  if (!user) {
    return { ok: false as const, response: NextResponse.json({ message: "Unauthorized." }, { status: 401 }) };
  }
  return { ok: true as const, user };
}

export async function GET() {
  const auth = await requireSignedInAdmin();
  if (!auth.ok) {
    return auth.response;
  }

  const [rows] = await dbQuery<
    (AdminRow & { creator_name: string | null })[]
  >(
    `SELECT a.id, a.name, a.email, a.is_active, a.created_at, a.created_by,
            c.name AS creator_name
     FROM admins a
     LEFT JOIN admins c ON c.id = a.created_by
     ORDER BY a.created_at ASC`,
  );

  return NextResponse.json({
    admins: rows.map((row) => ({
      id: row.id,
      name: row.name,
      email: row.email,
      isActive: row.is_active === 1,
      createdAt: row.created_at,
      createdById: row.created_by,
      createdByName: row.creator_name,
    })),
  });
}

export async function POST(request: Request) {
  const auth = await requireSignedInAdmin();
  if (!auth.ok) {
    return auth.response;
  }

  const body = await request.json().catch(() => null);
  const name = String(body?.name ?? "").trim();
  const email = String(body?.email ?? "").trim().toLowerCase();
  const password = String(body?.password ?? "");

  if (!name || !email || !password) {
    return NextResponse.json(
      { message: "Name, email and password are required." },
      { status: 400 },
    );
  }

  if (password.length < 8) {
    return NextResponse.json(
      { message: "Password must be at least 8 characters." },
      { status: 400 },
    );
  }

  const [existing] = await dbQuery<DbRow[]>(
    "SELECT id FROM admins WHERE email = ? LIMIT 1",
    [email],
  );
  if (existing.length > 0) {
    return NextResponse.json(
      { message: "An admin with this email already exists." },
      { status: 409 },
    );
  }

  const passwordHash = await bcrypt.hash(password, 10);
  const [result] = await dbExecute(
    `INSERT INTO admins (name, email, password_hash, is_active, created_by, created_at, updated_at)
     VALUES (?, ?, ?, 1, ?, NOW(), NOW())`,
    [name, email, passwordHash, auth.user.id],
  );

  return NextResponse.json(
    { message: "Admin created.", id: result.insertId },
    { status: 201 },
  );
}
