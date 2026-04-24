import { createSessionToken, authCookieConfig } from "@/lib/auth";
import { dbExecute, dbQuery, type DbRow } from "@/lib/db";
import bcrypt from "bcryptjs";
import { NextResponse } from "next/server";

type CountRow = DbRow & { c: number };

export async function POST(request: Request) {
  const body = await request.json().catch(() => null);
  const name = String(body?.name ?? "").trim();
  const email = String(body?.email ?? "").trim().toLowerCase();
  const password = String(body?.password ?? "").trim();

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

  try {
    const [countRows] = await dbQuery<CountRow[]>(
      "SELECT COUNT(*) AS c FROM admins",
    );
    if (Number(countRows[0]?.c ?? 0) > 0) {
      return NextResponse.json(
        { message: "An administrator already exists. Sign in instead." },
        { status: 403 },
      );
    }

    const [existing] = await dbQuery<DbRow[]>(
      "SELECT id FROM admins WHERE email = ? LIMIT 1",
      [email],
    );
    if (existing.length > 0) {
      return NextResponse.json(
        { message: "This email is already registered." },
        { status: 409 },
      );
    }

    const passwordHash = await bcrypt.hash(password, 10);
    const [result] = await dbExecute(
      `INSERT INTO admins (name, email, password_hash, is_active, created_by, created_at, updated_at)
       VALUES (?, ?, ?, 1, NULL, NOW(), NOW())`,
      [name, email, passwordHash],
    );

    const insertId = Number(result.insertId);
    const token = createSessionToken({
      id: insertId,
      name,
      email,
      role: "admin",
    });

    const response = NextResponse.json({
      message: "Registered.",
      user: { id: insertId, name, email, role: "admin" as const },
    });
    response.cookies.set(authCookieConfig.name, token, authCookieConfig.options);
    return response;
  } catch (error) {
    console.error("register-first-admin:", error);
    return NextResponse.json(
      { message: "Could not create account. Check database connection." },
      { status: 503 },
    );
  }
}
