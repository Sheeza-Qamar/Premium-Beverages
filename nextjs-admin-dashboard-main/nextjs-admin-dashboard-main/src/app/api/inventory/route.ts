import { requireAuth } from "@/lib/auth";
import { dbQuery, type DbRow } from "@/lib/db";
import { ensureRawMaterialsClientLabelColumns } from "@/lib/inventory-client-label-schema";
import { ensureCapRetiredFromRawMaterials } from "@/lib/inventory-retire-cap";
import { ensurePlasticRetiredFromRawMaterials } from "@/lib/inventory-retire-plastic";
import { NextResponse } from "next/server";

type Unit = "pcs" | "kg";
type MaterialType = "bottle" | "label" | "other";
type BottleType = "mix" | "pure";

type InventoryRow = DbRow & {
  id: number;
  name: string;
  unit: Unit;
  material_type: MaterialType;
  bottle_type: BottleType | null;
  client_id: number | null;
  client_label_id: number | null;
  client_name: string | null;
  label_name: string | null;
  created_at: string;
  quantity_available: string;
  low_stock_threshold: string | null;
  last_updated: string;
};

export async function GET() {
  const auth = await requireAuth();
  if (!auth.ok) {
    return auth.response;
  }
  await ensurePlasticRetiredFromRawMaterials();
  await ensureCapRetiredFromRawMaterials();
  await ensureRawMaterialsClientLabelColumns();
  const [rows] = await dbQuery<InventoryRow[]>(
    `SELECT
       rm.id,
       rm.name,
       rm.unit,
       rm.material_type,
       rm.bottle_type,
       rm.client_id,
       rm.client_label_id,
       c.name AS client_name,
       cl.label_name AS label_name,
       rm.created_at,
       i.quantity_available,
       i.low_stock_threshold,
       i.last_updated
     FROM raw_materials rm
     INNER JOIN inventory i ON i.material_id = rm.id
     LEFT JOIN clients c ON c.id = rm.client_id
     LEFT JOIN client_labels cl ON cl.id = rm.client_label_id
     ORDER BY rm.material_type ASC, rm.name ASC`,
  );

  const items = rows.map((row) => {
    const qty = Number(row.quantity_available);
    const threshold =
      row.low_stock_threshold === null ? null : Number(row.low_stock_threshold);
    const isLowStock =
      threshold !== null && !Number.isNaN(threshold) && qty <= threshold;

    return {
      id: row.id,
      name: row.name,
      unit: row.unit,
      materialType: row.material_type,
      bottleType: row.bottle_type,
      clientId: row.client_id,
      clientLabelId: row.client_label_id,
      clientName: row.client_name,
      clientLabelName: row.label_name,
      createdAt: row.created_at,
      quantityAvailable: qty,
      lowStockThreshold: threshold,
      lastUpdated: row.last_updated,
      isLowStock,
    };
  });

  return NextResponse.json({ items });
}
