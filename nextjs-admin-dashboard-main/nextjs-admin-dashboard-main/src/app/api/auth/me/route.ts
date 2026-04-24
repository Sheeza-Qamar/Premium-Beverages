import { getSessionUser } from "@/lib/auth";
import { dbQuery, type DbRow } from "@/lib/db";
import { NextResponse } from "next/server";

export async function GET() {
  const session = await getSessionUser();
  if (!session) {
    return NextResponse.json({ message: "Unauthorized." }, { status: 401 });
  }

  const [rows] = await dbQuery<DbRow[]>(
    "SELECT id, name, email FROM admins WHERE id = ? LIMIT 1",
    [session.id],
  );
  const row = rows[0] as { id: number; name: string; email: string } | undefined;
  if (!row) {
    return NextResponse.json({ user: session });
  }

  return NextResponse.json({
    user: {
      ...session,
      name: row.name,
      email: row.email,
    },
  });
}
