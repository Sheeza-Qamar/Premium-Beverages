import { requireAuth } from "@/lib/auth";
import { withTransaction } from "@/lib/db";
import {
  BOTTLE_TYPES,
  MATERIAL_TYPES,
  UNITS,
  parseNonNegativeNumberOr,
} from "@/lib/inventory-validation";
import { toOptionalTrimmedString, toTrimmedString } from "@/lib/validation";
import type { PoolConnection, ResultSetHeader } from "mysql2/promise";
import { NextResponse } from "next/server";

export async function POST(request: Request) {
  const auth = await requireAuth();
  if (!auth.ok) {
    return auth.response;
  }
  const body = await request.json().catch(() => null);
  const name = toTrimmedString(body?.name);
  const unit = toTrimmedString(body?.unit).toLowerCase();
  const materialType = toTrimmedString(body?.materialType ?? "other").toLowerCase();
  const bottleTypeRaw =
    body?.bottleType === undefined || body?.bottleType === null
      ? null
      : toOptionalTrimmedString(body.bottleType)?.toLowerCase() ?? null;

  if (!name) {
    return NextResponse.json({ message: "Name is required." }, { status: 400 });
  }
  if (!UNITS.has(unit)) {
    return NextResponse.json(
      { message: "Unit must be pcs or kg." },
      { status: 400 },
    );
  }
  if (!MATERIAL_TYPES.has(materialType)) {
    return NextResponse.json(
      { message: "Invalid material type." },
      { status: 400 },
    );
  }
  if (materialType === "bottle" && !bottleTypeRaw) {
    return NextResponse.json(
      { message: "Bottle type is required for bottle materials." },
      { status: 400 },
    );
  }
  if (bottleTypeRaw !== null && !BOTTLE_TYPES.has(bottleTypeRaw)) {
    return NextResponse.json(
      { message: "Bottle type must be mix or pure." },
      { status: 400 },
    );
  }
  const bottleType = materialType === "bottle" ? bottleTypeRaw : null;

  const initialQuantity = parseNonNegativeNumberOr(body?.initialQuantity, 0);
  let lowStock: number | null = null;
  if (body?.lowStockThreshold !== undefined && body?.lowStockThreshold !== null) {
    lowStock = parseNonNegativeNumberOr(body.lowStockThreshold, -1);
    if (lowStock < 0) {
      return NextResponse.json(
        { message: "Low stock threshold must be zero or positive." },
        { status: 400 },
      );
    }
  }

  const id = await withTransaction(async (conn: PoolConnection) => {
    const [result] = await conn.execute<ResultSetHeader>(
      `INSERT INTO raw_materials (name, unit, material_type, bottle_type, created_at, updated_at)
       VALUES (?, ?, ?, ?, NOW(), NOW())`,
      [name, unit, materialType, bottleType],
    );
    const materialId = result.insertId;
    await conn.execute<ResultSetHeader>(
      `INSERT INTO inventory (material_id, quantity_available, low_stock_threshold, last_updated)
       VALUES (?, ?, ?, NOW())`,
      [materialId, initialQuantity, lowStock],
    );
    return materialId;
  });

  return NextResponse.json(
    { message: "Raw material created.", id },
    { status: 201 },
  );
}
