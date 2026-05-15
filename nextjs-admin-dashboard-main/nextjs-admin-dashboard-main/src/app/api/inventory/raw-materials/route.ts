import { requireAuth } from "@/lib/auth";
import { withTransaction, type DbRow } from "@/lib/db";
import { ensureRawMaterialsClientLabelColumns } from "@/lib/inventory-client-label-schema";
import { ensureCapRetiredFromRawMaterials } from "@/lib/inventory-retire-cap";
import { ensurePlasticRetiredFromRawMaterials } from "@/lib/inventory-retire-plastic";
import {
  BOTTLE_TYPES,
  MATERIAL_TYPES,
  UNITS,
  parseNonNegativeNumberOr,
} from "@/lib/inventory-validation";
import { toOptionalTrimmedString, toTrimmedString } from "@/lib/validation";
import type { PoolConnection, ResultSetHeader } from "mysql2/promise";
import { NextResponse } from "next/server";

type LabelLinkRow = DbRow & {
  id: number;
  client_id: number;
  label_name: string;
};

type ClientNameRow = DbRow & { name: string };

export async function POST(request: Request) {
  const auth = await requireAuth();
  if (!auth.ok) {
    return auth.response;
  }
  await ensurePlasticRetiredFromRawMaterials();
  await ensureCapRetiredFromRawMaterials();
  await ensureRawMaterialsClientLabelColumns();

  const body = await request.json().catch(() => null);
  const nameRaw = toOptionalTrimmedString(body?.name);
  const unit = toTrimmedString(body?.unit).toLowerCase();
  const materialType = toTrimmedString(body?.materialType ?? "other").toLowerCase();
  const bottleTypeRaw =
    body?.bottleType === undefined || body?.bottleType === null
      ? null
      : toOptionalTrimmedString(body.bottleType)?.toLowerCase() ?? null;

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
      { message: "Bottle type is required for bottle stock." },
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

  let displayName = nameRaw ?? "";

  if (materialType === "label") {
    const clientLabelIdNum = Number(body?.clientLabelId);
    if (!Number.isInteger(clientLabelIdNum) || clientLabelIdNum < 1) {
      return NextResponse.json(
        {
          message:
            "For labels, choose the client and their label line (from the print shop). Each label line can only have one inventory row.",
        },
        { status: 400 },
      );
    }

    let materialIdResult: number;
    try {
      materialIdResult = await withTransaction(async (conn: PoolConnection) => {
        const [labelRows] = await conn.query<LabelLinkRow[]>(
          `SELECT id, client_id, label_name
           FROM client_labels
           WHERE id = ?
           LIMIT 1
           FOR UPDATE`,
          [clientLabelIdNum],
        );
        if (labelRows.length === 0) {
          throw new Error("LABEL_NOT_FOUND");
        }
        const label = labelRows[0];
        const clientId = label.client_id;
        const clientLabelId = label.id;

        const [dup] = await conn.query<(DbRow & { id: number })[]>(
          "SELECT id FROM raw_materials WHERE client_label_id = ? LIMIT 1",
          [clientLabelId],
        );
        if (dup.length > 0) {
          throw new Error("DUPLICATE_LABEL_INVENTORY");
        }

        const [clients] = await conn.query<ClientNameRow[]>(
          "SELECT name FROM clients WHERE id = ? LIMIT 1",
          [clientId],
        );
        const clientName = clients[0]?.name ?? "Client";
        let rowName = displayName;
        if (!rowName) {
          rowName = `${clientName} — ${label.label_name}`;
        }

        const [result] = await conn.execute<ResultSetHeader>(
          `INSERT INTO raw_materials
           (name, unit, material_type, bottle_type, client_id, client_label_id, created_at, updated_at)
           VALUES (?, ?, ?, NULL, ?, ?, NOW(), NOW())`,
          [rowName, unit, materialType, clientId, clientLabelId],
        );
        const materialId = result.insertId;
        await conn.execute<ResultSetHeader>(
          `INSERT INTO inventory (material_id, quantity_available, low_stock_threshold, last_updated)
           VALUES (?, ?, ?, NOW())`,
          [materialId, initialQuantity, lowStock],
        );
        if (initialQuantity > 0) {
          await conn.execute<ResultSetHeader>(
            `UPDATE client_labels
             SET quantity_available = quantity_available + ?, updated_at = NOW()
             WHERE id = ?`,
            [initialQuantity, clientLabelId],
          );
        }
        return materialId;
      });
    } catch (e) {
      if (e instanceof Error && e.message === "LABEL_NOT_FOUND") {
        return NextResponse.json({ message: "Label not found." }, { status: 404 });
      }
      if (e instanceof Error && e.message === "DUPLICATE_LABEL_INVENTORY") {
        return NextResponse.json(
          {
            message:
              "This client label already has a warehouse row. Update quantity on Current stock instead of adding again.",
          },
          { status: 409 },
        );
      }
      throw e;
    }

    return NextResponse.json(
      { message: "Raw material created.", id: materialIdResult },
      { status: 201 },
    );
  }

  if (!displayName) {
    return NextResponse.json({ message: "Name is required." }, { status: 400 });
  }

  const id = await withTransaction(async (conn: PoolConnection) => {
    const [result] = await conn.execute<ResultSetHeader>(
      `INSERT INTO raw_materials (name, unit, material_type, bottle_type, client_id, client_label_id, created_at, updated_at)
       VALUES (?, ?, ?, ?, NULL, NULL, NOW(), NOW())`,
      [displayName, unit, materialType, bottleType],
    );
    const materialId = result.insertId;
    await conn.execute<ResultSetHeader>(
      `INSERT INTO inventory (material_id, quantity_available, low_stock_threshold, last_updated)
       VALUES (?, ?, ?, NOW())`,
      [materialId, initialQuantity, lowStock],
    );
    return materialId;
  });

  return NextResponse.json({ message: "Raw material created.", id }, { status: 201 });
}
