import { createSessionToken, authCookieConfig } from "@/lib/auth";
import { dbQuery, type DbRow } from "@/lib/db";
import bcrypt from "bcryptjs";
import { NextResponse } from "next/server";

type AdminRow = DbRow & {
  id: number;
  name: string;
  email: string;
  password_hash: string;
  is_active: number;
};

export async function POST(request: Request) {
  const body = await request.json().catch(() => null);
  const email = String(body?.email ?? "").trim().toLowerCase();
  const password = String(body?.password ?? "").trim();

  if (!email || !password) {
    return NextResponse.json(
      { message: "Email and password are required." },
      { status: 400 },
    );
  }

  try {
    const [rows] = await dbQuery<AdminRow[]>(
      `SELECT id, name, email, password_hash, is_active
       FROM admins
       WHERE email = ?
       LIMIT 1`,
      [email],
    );

    const admin = rows[0];
    if (!admin || admin.is_active !== 1) {
      return NextResponse.json(
        { message: "Invalid email or password." },
        { status: 401 },
      );
    }

    const matches = await bcrypt.compare(password, admin.password_hash);
    if (!matches) {
      return NextResponse.json(
        { message: "Invalid email or password." },
        { status: 401 },
      );
    }

    const token = createSessionToken({
      id: admin.id,
      name: admin.name,
      email: admin.email,
      role: "admin",
    });

    const response = NextResponse.json({
      user: {
        id: admin.id,
        name: admin.name,
        email: admin.email,
        role: "admin" as const,
      },
    });
    response.cookies.set(authCookieConfig.name, token, authCookieConfig.options);

    return response;
  } catch (error) {
    console.error("Login DB error:", error);
    return NextResponse.json(
      {
        message:
          "Cannot reach database. Check DB_* in .env.local and that MySQL allows your IP.",
      },
      { status: 503 },
    );
  }
}
