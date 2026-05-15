import { requireAuth } from "@/lib/auth";
import { dbExecute, dbQuery, type DbRow, withTransaction } from "@/lib/db";
import { ensureRawMaterialsClientLabelColumns } from "@/lib/inventory-client-label-schema";
import { ensureCapRetiredFromRawMaterials } from "@/lib/inventory-retire-cap";
import { ensurePlasticRetiredFromRawMaterials } from "@/lib/inventory-retire-plastic";
import {
  BOTTLE_TYPES,
  MATERIAL_TYPES,
  UNITS,
} from "@/lib/inventory-validation";
import { parseNonNegativeNumber, toOptionalTrimmedString, toTrimmedString } from "@/lib/validation";
import type { PoolConnection, ResultSetHeader } from "mysql2/promise";
import { NextResponse } from "next/server";

type MaterialRow = DbRow & {
  id: number;
  material_type: "bottle" | "label" | "other";
  bottle_type: "mix" | "pure" | null;
  client_id: number | null;
  client_label_id: number | null;
};

type LabelLinkRow = DbRow & { id: number; client_id: number; label_name: string };

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const auth = await requireAuth();
  if (!auth.ok) {
    return auth.response;
  }
  await ensurePlasticRetiredFromRawMaterials();
  await ensureCapRetiredFromRawMaterials();
  await ensureRawMaterialsClientLabelColumns();

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
    "SELECT id, material_type, bottle_type, client_id, client_label_id FROM raw_materials WHERE id = ? LIMIT 1",
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

    if (materialType === "label") {
      const clientLabelIdNum = Number(body?.clientLabelId);
      if (!Number.isInteger(clientLabelIdNum) || clientLabelIdNum < 1) {
        return NextResponse.json(
          {
            message:
              "To set type to Label, provide clientLabelId (the client’s label line from Clients).",
          },
          { status: 400 },
        );
      }
      try {
        await withTransaction(async (conn: PoolConnection) => {
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
          const [dup] = await conn.query<(DbRow & { id: number })[]>(
            "SELECT id FROM raw_materials WHERE client_label_id = ? AND id <> ? LIMIT 1",
            [label.id, materialId],
          );
          if (dup.length > 0) {
            throw new Error("DUPLICATE_LABEL_INVENTORY");
          }
          await conn.execute<ResultSetHeader>(
            `UPDATE raw_materials
             SET material_type = 'label', bottle_type = NULL, client_id = ?, client_label_id = ?, updated_at = NOW()
             WHERE id = ?`,
            [label.client_id, label.id, materialId],
          );
        });
      } catch (e) {
        if (e instanceof Error && e.message === "LABEL_NOT_FOUND") {
          return NextResponse.json({ message: "Label not found." }, { status: 404 });
        }
        if (e instanceof Error && e.message === "DUPLICATE_LABEL_INVENTORY") {
          return NextResponse.json(
            {
              message:
                "Another inventory row is already linked to that client label.",
            },
            { status: 409 },
          );
        }
        throw e;
      }
    } else {
      await dbExecute(
        `UPDATE raw_materials
         SET material_type = ?, client_id = NULL, client_label_id = NULL, updated_at = NOW()
         WHERE id = ?`,
        [materialType, materialId],
      );
    }
  }

  if (body.bottleType !== undefined || body.materialType !== undefined) {
    const [refreshed] = await dbQuery<MaterialRow[]>(
      "SELECT material_type, bottle_type FROM raw_materials WHERE id = ? LIMIT 1",
      [materialId],
    );
    const row = refreshed[0] ?? existing[0];
    const nextMaterialType = row.material_type;

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
      const nextBottleType = parsedBottleType ?? row.bottle_type;
      if (!nextBottleType || !BOTTLE_TYPES.has(nextBottleType)) {
        return NextResponse.json(
          { message: "Bottle type is required for bottle stock." },
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

    const [invRows] = await dbQuery<
      (DbRow & { client_label_id: number | null; quantity_available: string })[]
    >(
      `SELECT rm.client_label_id, i.quantity_available
       FROM raw_materials rm
       INNER JOIN inventory i ON i.material_id = rm.id
       WHERE rm.id = ?
       LIMIT 1`,
      [materialId],
    );
    const invRow = invRows[0];
    if (!invRow) {
      return NextResponse.json({ message: "Inventory row missing." }, { status: 500 });
    }
    const oldQty = Number(invRow.quantity_available);
    const labelId = invRow.client_label_id;
    const delta = qty - oldQty;

    if (labelId !== null && delta !== 0) {
      try {
        await withTransaction(async (conn: PoolConnection) => {
          const [lbl] = await conn.query<(DbRow & { q: string })[]>(
            "SELECT quantity_available AS q FROM client_labels WHERE id = ? LIMIT 1 FOR UPDATE",
            [labelId],
          );
          if (lbl.length === 0) {
            throw new Error("LABEL_NOT_FOUND");
          }
          const labelQty = Number(lbl[0].q);
          const nextLabelQty = labelQty + delta;
          if (nextLabelQty < 0) {
            throw new Error("LABEL_QTY_NEGATIVE");
          }
          await conn.execute<ResultSetHeader>(
            `UPDATE inventory SET quantity_available = ?, last_updated = NOW() WHERE material_id = ?`,
            [qty, materialId],
          );
          await conn.execute<ResultSetHeader>(
            `UPDATE client_labels SET quantity_available = ?, updated_at = NOW() WHERE id = ?`,
            [nextLabelQty, labelId],
          );
        });
      } catch (e) {
        if (e instanceof Error && e.message === "LABEL_QTY_NEGATIVE") {
          return NextResponse.json(
            {
              message:
                "That quantity is below what is recorded on the client’s label line. Reduce the quantity on the client first, or enter a higher amount here.",
            },
            { status: 400 },
          );
        }
        if (e instanceof Error && e.message === "LABEL_NOT_FOUND") {
          return NextResponse.json({ message: "Linked client label no longer exists." }, { status: 400 });
        }
        throw e;
      }
    } else {
      await dbExecute(
        `UPDATE inventory SET quantity_available = ?, last_updated = NOW()
         WHERE material_id = ?`,
        [qty, materialId],
      );
    }
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
