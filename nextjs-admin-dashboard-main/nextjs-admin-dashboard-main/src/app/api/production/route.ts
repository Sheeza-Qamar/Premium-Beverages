import { requireAuth } from "@/lib/auth";
import { dbQuery, type DbRow, withTransaction } from "@/lib/db";
import { parseNonNegativeNumber, toOptionalTrimmedString } from "@/lib/validation";
import type { PoolConnection, ResultSetHeader } from "mysql2/promise";
import { NextResponse } from "next/server";

type ProductionRow = DbRow & {
  id: number;
  client_id: number;
  client_name: string;
  bottle_type: "mix" | "pure";
  quantity_produced: string;
  production_date: string;
  notes: string | null;
  created_at: string;
};

type LabelUsageRow = DbRow & {
  production_id: number;
  client_label_id: number;
  label_name: string;
  quantity_used: string;
};

type MaterialUsageRow = DbRow & {
  production_id: number;
  material_id: number;
  material_name: string;
  material_type: "bottle" | "cap" | "label" | "plastic" | "other";
  quantity_used: string;
};

type ClientRow = DbRow & { id: number };
type ClientLabelRow = DbRow & {
  id: number;
  client_id: number;
  label_name: string;
  quantity_available: string;
};

type MaterialInventoryRow = DbRow & {
  id: number;
  name: string;
  material_type: "bottle" | "cap" | "label" | "plastic" | "other";
  bottle_type: "mix" | "pure" | null;
  quantity_available: string;
};

type UsageInput = {
  clientLabelId: number;
  quantityUsed: number;
};

type MaterialUsageInput = {
  materialId: number;
  quantityUsed: number;
};

function isValidDate(value: string) {
  return /^\d{4}-\d{2}-\d{2}$/.test(value);
}

export async function GET() {
  const auth = await requireAuth();
  if (!auth.ok) {
    return auth.response;
  }
  const [productions] = await dbQuery<ProductionRow[]>(
    `SELECT
       p.id,
       p.client_id,
       c.name AS client_name,
       p.bottle_type,
       p.quantity_produced,
       p.production_date,
       p.notes,
       p.created_at
     FROM production p
     INNER JOIN clients c ON c.id = p.client_id
     ORDER BY p.production_date DESC, p.id DESC
     LIMIT 100`,
  );

  const ids = productions.map((p) => p.id);
  let labelUsageByProduction = new Map<number, Array<{ clientLabelId: number; labelName: string; quantityUsed: number }>>();
  let materialUsageByProduction = new Map<
    number,
    Array<{
      materialId: number;
      materialName: string;
      materialType: "bottle" | "cap" | "label" | "plastic" | "other";
      quantityUsed: number;
    }>
  >();
  if (ids.length > 0) {
    const placeholders = ids.map(() => "?").join(", ");
    const [usageRows] = await dbQuery<LabelUsageRow[]>(
      `SELECT
         plu.production_id,
         plu.client_label_id,
         cl.label_name,
         plu.quantity_used
       FROM production_label_usage plu
       INNER JOIN client_labels cl ON cl.id = plu.client_label_id
       WHERE plu.production_id IN (${placeholders})
       ORDER BY plu.id ASC`,
      ids,
    );

    labelUsageByProduction = usageRows.reduce((map, row) => {
      const list = map.get(row.production_id) ?? [];
      list.push({
        clientLabelId: row.client_label_id,
        labelName: row.label_name,
        quantityUsed: Number(row.quantity_used),
      });
      map.set(row.production_id, list);
      return map;
    }, new Map<number, Array<{ clientLabelId: number; labelName: string; quantityUsed: number }>>());

    const [materialUsageRows] = await dbQuery<MaterialUsageRow[]>(
      `SELECT
         pu.production_id,
         pu.material_id,
         rm.name AS material_name,
         rm.material_type,
         pu.quantity_used
       FROM production_usage pu
       INNER JOIN raw_materials rm ON rm.id = pu.material_id
       WHERE pu.production_id IN (${placeholders})
       ORDER BY pu.id ASC`,
      ids,
    );

    materialUsageByProduction = materialUsageRows.reduce((map, row) => {
      const list = map.get(row.production_id) ?? [];
      list.push({
        materialId: row.material_id,
        materialName: row.material_name,
        materialType: row.material_type,
        quantityUsed: Number(row.quantity_used),
      });
      map.set(row.production_id, list);
      return map;
    }, new Map<
      number,
      Array<{
        materialId: number;
        materialName: string;
        materialType: "bottle" | "cap" | "label" | "plastic" | "other";
        quantityUsed: number;
      }>
    >());
  }

  return NextResponse.json({
    productions: productions.map((p) => ({
      id: p.id,
      clientId: p.client_id,
      clientName: p.client_name,
      bottleType: p.bottle_type,
      quantityProduced: Number(p.quantity_produced),
      productionDate: p.production_date,
      notes: p.notes,
      createdAt: p.created_at,
      labelUsage: labelUsageByProduction.get(p.id) ?? [],
      materialUsage: materialUsageByProduction.get(p.id) ?? [],
    })),
  });
}

export async function POST(request: Request) {
  const auth = await requireAuth();
  if (!auth.ok) {
    return auth.response;
  }
  const body = await request.json().catch(() => null);
  const clientId = Number(body?.clientId);
  const bottleType = String(body?.bottleType ?? "").toLowerCase();
  const productionDate = String(body?.productionDate ?? "").trim();
  const notes =
    body?.notes === undefined || body?.notes === null
      ? null
      : toOptionalTrimmedString(body.notes);
  const quantityProduced = parseNonNegativeNumber(body?.quantityProduced);

  if (!Number.isInteger(clientId) || clientId < 1) {
    return NextResponse.json({ message: "Valid client is required." }, { status: 400 });
  }
  if (bottleType !== "mix" && bottleType !== "pure") {
    return NextResponse.json(
      { message: "Bottle type must be mix or pure." },
      { status: 400 },
    );
  }
  if (!productionDate || !isValidDate(productionDate)) {
    return NextResponse.json(
      { message: "Production date is required (YYYY-MM-DD)." },
      { status: 400 },
    );
  }
  if (quantityProduced === null || quantityProduced <= 0) {
    return NextResponse.json(
      { message: "Quantity produced must be greater than zero." },
      { status: 400 },
    );
  }

  const rawUsages = Array.isArray(body?.labelUsages) ? body.labelUsages : [];
  const rawMaterialUsages = Array.isArray(body?.materialUsages)
    ? body.materialUsages
    : [];
  const usages: UsageInput[] = [];
  const materialUsages: MaterialUsageInput[] = [];
  for (const item of rawUsages) {
    const clientLabelId = Number((item as { clientLabelId?: unknown })?.clientLabelId);
    const quantityUsed = parseNonNegativeNumber(
      (item as { quantityUsed?: unknown })?.quantityUsed,
    );
    if (!Number.isInteger(clientLabelId) || clientLabelId < 1) {
      return NextResponse.json(
        { message: "Each label usage requires a valid label id." },
        { status: 400 },
      );
    }
    if (quantityUsed === null || quantityUsed <= 0) {
      return NextResponse.json(
        { message: "Each label usage quantity must be greater than zero." },
        { status: 400 },
      );
    }
    usages.push({ clientLabelId, quantityUsed });
  }

  if (usages.length === 0) {
    return NextResponse.json(
      { message: "At least one label usage row is required." },
      { status: 400 },
    );
  }

  for (const item of rawMaterialUsages) {
    const materialId = Number((item as { materialId?: unknown })?.materialId);
    const quantityUsed = parseNonNegativeNumber(
      (item as { quantityUsed?: unknown })?.quantityUsed,
    );
    if (!Number.isInteger(materialId) || materialId < 1) {
      return NextResponse.json(
        { message: "Each material usage requires a valid material id." },
        { status: 400 },
      );
    }
    if (quantityUsed === null || quantityUsed <= 0) {
      return NextResponse.json(
        { message: "Each material usage quantity must be greater than zero." },
        { status: 400 },
      );
    }
    materialUsages.push({ materialId, quantityUsed });
  }
  if (materialUsages.length === 0) {
    return NextResponse.json(
      { message: "Bottle and cap usage are required." },
      { status: 400 },
    );
  }

  const duplicateMaterialCheck = new Set<number>();
  for (const u of materialUsages) {
    if (duplicateMaterialCheck.has(u.materialId)) {
      return NextResponse.json(
        { message: "Same material cannot be repeated. Combine quantities in one row." },
        { status: 400 },
      );
    }
    duplicateMaterialCheck.add(u.materialId);
  }

  const duplicateCheck = new Set<number>();
  for (const u of usages) {
    if (duplicateCheck.has(u.clientLabelId)) {
      return NextResponse.json(
        { message: "Same label cannot be repeated. Combine quantities in one row." },
        { status: 400 },
      );
    }
    duplicateCheck.add(u.clientLabelId);
  }

  try {
    const productionId = await withTransaction(async (conn: PoolConnection) => {
      const [clientRows] = await conn.query<ClientRow[]>(
        "SELECT id FROM clients WHERE id = ? LIMIT 1",
        [clientId],
      );
      if (clientRows.length === 0) {
        throw new Error("Client not found.");
      }

      const [result] = await conn.execute<ResultSetHeader>(
        `INSERT INTO production
         (client_id, bottle_type, quantity_produced, production_date, notes, created_by, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, NOW(), NOW())`,
        [clientId, bottleType, quantityProduced, productionDate, notes, auth.user.id],
      );
      const newProductionId = result.insertId;

      let hasBottleUsage = false;
      let hasCapUsage = false;
      for (const usage of materialUsages) {
        const [materialRows] = await conn.query<MaterialInventoryRow[]>(
          `SELECT
             rm.id,
             rm.name,
             rm.material_type,
             rm.bottle_type,
             i.quantity_available
           FROM raw_materials rm
           INNER JOIN inventory i ON i.material_id = rm.id
           WHERE rm.id = ?
           LIMIT 1
           FOR UPDATE`,
          [usage.materialId],
        );
        if (materialRows.length === 0) {
          throw new Error("One of the selected materials no longer exists.");
        }

        const material = materialRows[0];
        if (material.material_type !== "bottle" && material.material_type !== "cap") {
          throw new Error(
            `Material "${material.name}" is not a bottle/cap material.`,
          );
        }
        if (material.material_type === "bottle") {
          hasBottleUsage = true;
          if (material.bottle_type !== bottleType) {
            throw new Error(
              `Bottle material "${material.name}" does not match production bottle type "${bottleType}".`,
            );
          }
        }
        if (material.material_type === "cap") {
          hasCapUsage = true;
        }

        const available = Number(material.quantity_available);
        if (available < usage.quantityUsed) {
          throw new Error(
            `Insufficient inventory for "${material.name}". Available: ${available}.`,
          );
        }

        await conn.execute<ResultSetHeader>(
          `UPDATE inventory
           SET quantity_available = quantity_available - ?, last_updated = NOW()
           WHERE material_id = ?`,
          [usage.quantityUsed, usage.materialId],
        );

        await conn.execute<ResultSetHeader>(
          `INSERT INTO production_usage
           (production_id, material_id, quantity_used)
           VALUES (?, ?, ?)`,
          [newProductionId, usage.materialId, usage.quantityUsed],
        );
      }

      if (!hasBottleUsage || !hasCapUsage) {
        throw new Error("Production must include both bottle and cap usage.");
      }

      for (const usage of usages) {
        const [labelRows] = await conn.query<ClientLabelRow[]>(
          `SELECT id, client_id, label_name, quantity_available
           FROM client_labels
           WHERE id = ?
           LIMIT 1
           FOR UPDATE`,
          [usage.clientLabelId],
        );
        if (labelRows.length === 0) {
          throw new Error("One of the selected labels no longer exists.");
        }

        const label = labelRows[0];
        if (label.client_id !== clientId) {
          throw new Error(
            `Label "${label.label_name}" does not belong to the selected client.`,
          );
        }

        const available = Number(label.quantity_available);
        if (available < usage.quantityUsed) {
          throw new Error(
            `Insufficient label stock for "${label.label_name}". Available: ${available}.`,
          );
        }

        await conn.execute<ResultSetHeader>(
          `UPDATE client_labels
           SET quantity_available = quantity_available - ?, updated_at = NOW()
           WHERE id = ?`,
          [usage.quantityUsed, usage.clientLabelId],
        );

        await conn.execute<ResultSetHeader>(
          `INSERT INTO production_label_usage
           (production_id, client_label_id, quantity_used)
           VALUES (?, ?, ?)`,
          [newProductionId, usage.clientLabelId, usage.quantityUsed],
        );
      }

      return newProductionId;
    });

    return NextResponse.json(
      { message: "Production recorded. Bottles, caps, and labels deducted.", id: productionId },
      { status: 201 },
    );
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Unable to record production.";
    return NextResponse.json({ message }, { status: 400 });
  }
}
