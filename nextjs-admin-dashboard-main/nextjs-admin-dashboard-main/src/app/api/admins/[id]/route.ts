import { getSessionUser } from "@/lib/auth";
import { dbExecute, dbQuery, type DbRow } from "@/lib/db";
import { NextResponse } from "next/server";

async function requireSignedInAdmin() {
  const user = await getSessionUser();
  if (!user) {
    return { ok: false as const, response: NextResponse.json({ message: "Unauthorized." }, { status: 401 }) };
  }
  return { ok: true as const, user };
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const auth = await requireSignedInAdmin();
  if (!auth.ok) {
    return auth.response;
  }

  const { id: idParam } = await params;
  const adminId = Number(idParam);
  if (!Number.isInteger(adminId) || adminId < 1) {
    return NextResponse.json({ message: "Invalid admin id." }, { status: 400 });
  }

  const body = await request.json().catch(() => null);
  const isActive = body?.isActive as boolean | undefined;
  const name = body?.name !== undefined ? String(body?.name ?? "").trim() : undefined;

  if (isActive === undefined && name === undefined) {
    return NextResponse.json({ message: "Nothing to update." }, { status: 400 });
  }

  if (name !== undefined && !name) {
    return NextResponse.json({ message: "Name cannot be empty." }, { status: 400 });
  }

  if (isActive === false && adminId === auth.user.id) {
    return NextResponse.json(
      { message: "You cannot deactivate your own account." },
      { status: 400 },
    );
  }

  const updates: string[] = [];
  const values: Array<string | number> = [];

  if (name !== undefined) {
    updates.push("name = ?");
    values.push(name);
  }

  if (isActive !== undefined) {
    updates.push("is_active = ?");
    values.push(isActive ? 1 : 0);
  }

  updates.push("updated_at = NOW()");
  values.push(adminId);

  const [check] = await dbQuery<DbRow[]>(
    "SELECT id FROM admins WHERE id = ? LIMIT 1",
    [adminId],
  );
  if (check.length === 0) {
    return NextResponse.json({ message: "Admin not found." }, { status: 404 });
  }

  await dbExecute(`UPDATE admins SET ${updates.join(", ")} WHERE id = ?`, values);

  return NextResponse.json({ message: "Updated." });
}
