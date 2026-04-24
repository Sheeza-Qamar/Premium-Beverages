import { dbQuery, type DbRow } from "@/lib/db";
import { NextResponse } from "next/server";

type CountRow = DbRow & { c: number };

export async function GET() {
  try {
    const [rows] = await dbQuery<CountRow[]>(
      "SELECT COUNT(*) AS c FROM admins",
    );
    const c = Number(rows[0]?.c ?? 0);
    return NextResponse.json({ available: c === 0 });
  } catch (error) {
    console.error("first-admin-available:", error);
    return NextResponse.json(
      { available: false, error: "database_unavailable" },
      { status: 503 },
    );
  }
}
