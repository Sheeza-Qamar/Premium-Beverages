import { requireAuth } from "@/lib/auth";
import { dbExecute, dbQuery, type DbRow } from "@/lib/db";
import {
  BOTTLE_TYPES,
  MATERIAL_TYPES,
  UNITS,
} from "@/lib/inventory-validation";
import { parseNonNegativeNumber, toOptionalTrimmedString, toTrimmedString } from "@/lib/validation";
import { NextResponse } from "next/server";

type MaterialRow = DbRow & {
  id: number;
  material_type: "bottle" | "cap" | "label" | "plastic" | "other";
  bottle_type: "mix" | "pure" | null;
};

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const auth = await requireAuth();
  if (!auth.ok) {
    return auth.response;
  }
  const { id: idParam } = await params;
  const materialId = Number(idParam);
  if (!Number.isInteger(materialId) || materialId < 1) {
    return NextResponse.json({ message: "Invalid material id." }, { status: 400 });
  }

  const body = await request.json().catch(() => null);
  if (!body || typeof body !== "object") {
    return NextResponse.json({ message: "Invalid JSON body." }, { status: 400 });
  }

  const [existing] = await dbQuery<MaterialRow[]>(
    "SELECT id, material_type, bottle_type FROM raw_materials WHERE id = ? LIMIT 1",
    [materialId],
  );
  if (existing.length === 0) {
    return NextResponse.json({ message: "Material not found." }, { status: 404 });
  }

  if (body.name !== undefined) {
    const name = toTrimmedString(body.name);
    if (!name) {
      return NextResponse.json({ message: "Name cannot be empty." }, { status: 400 });
    }
    await dbExecute(
      "UPDATE raw_materials SET name = ?, updated_at = NOW() WHERE id = ?",
      [name, materialId],
    );
  }

  if (body.unit !== undefined) {
    const unit = toTrimmedString(body.unit).toLowerCase();
    if (!UNITS.has(unit)) {
      return NextResponse.json(
        { message: "Unit must be pcs or kg." },
        { status: 400 },
      );
    }
    await dbExecute(
      "UPDATE raw_materials SET unit = ?, updated_at = NOW() WHERE id = ?",
      [unit, materialId],
    );
  }

  if (body.materialType !== undefined) {
    const materialType = toTrimmedString(body.materialType).toLowerCase();
    if (!MATERIAL_TYPES.has(materialType)) {
      return NextResponse.json(
        { message: "Invalid material type." },
        { status: 400 },
      );
    }
    await dbExecute(
      "UPDATE raw_materials SET material_type = ?, updated_at = NOW() WHERE id = ?",
      [materialType, materialId],
    );
  }

  if (body.bottleType !== undefined || body.materialType !== undefined) {
    const nextMaterialType =
      body.materialType !== undefined
        ? toTrimmedString(body.materialType).toLowerCase()
        : existing[0].material_type;
    if (!MATERIAL_TYPES.has(nextMaterialType)) {
      return NextResponse.json(
        { message: "Invalid material type." },
        { status: 400 },
      );
    }

    const parsedBottleType =
      body.bottleType === undefined || body.bottleType === null
        ? null
        : toOptionalTrimmedString(body.bottleType)?.toLowerCase() ?? null;

    if (parsedBottleType !== null && !BOTTLE_TYPES.has(parsedBottleType)) {
      return NextResponse.json(
        { message: "Bottle type must be mix or pure." },
        { status: 400 },
      );
    }

    if (nextMaterialType === "bottle") {
      const nextBottleType = parsedBottleType ?? existing[0].bottle_type;
      if (!nextBottleType || !BOTTLE_TYPES.has(nextBottleType)) {
        return NextResponse.json(
          { message: "Bottle type is required for bottle materials." },
          { status: 400 },
        );
      }
      await dbExecute(
        "UPDATE raw_materials SET bottle_type = ?, updated_at = NOW() WHERE id = ?",
        [nextBottleType, materialId],
      );
    } else {
      await dbExecute(
        "UPDATE raw_materials SET bottle_type = NULL, updated_at = NOW() WHERE id = ?",
        [materialId],
      );
    }
  }

  if (body.quantityAvailable !== undefined) {
    const qty = parseNonNegativeNumber(body.quantityAvailable);
    if (qty === null) {
      return NextResponse.json(
        { message: "Quantity must be a non-negative number." },
        { status: 400 },
      );
    }
    await dbExecute(
      `UPDATE inventory SET quantity_available = ?, last_updated = NOW()
       WHERE material_id = ?`,
      [qty, materialId],
    );
  }

  if (body.lowStockThreshold !== undefined) {
    if (body.lowStockThreshold === null) {
      await dbExecute(
        `UPDATE inventory SET low_stock_threshold = NULL, last_updated = NOW()
         WHERE material_id = ?`,
        [materialId],
      );
    } else {
      const t = parseNonNegativeNumber(body.lowStockThreshold);
      if (t === null) {
        return NextResponse.json(
          { message: "Low stock threshold must be zero or positive." },
          { status: 400 },
        );
      }
      await dbExecute(
        `UPDATE inventory SET low_stock_threshold = ?, last_updated = NOW()
         WHERE material_id = ?`,
        [t, materialId],
      );
    }
  }

  return NextResponse.json({ message: "Updated." });
}
