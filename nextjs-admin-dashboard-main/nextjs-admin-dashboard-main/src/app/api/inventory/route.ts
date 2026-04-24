import { requireAuth } from "@/lib/auth";
import { dbQuery, type DbRow } from "@/lib/db";
import { NextResponse } from "next/server";

type Unit = "pcs" | "kg";
type MaterialType = "bottle" | "cap" | "label" | "plastic" | "other";
type BottleType = "mix" | "pure";

type InventoryRow = DbRow & {
  id: number;
  name: string;
  unit: Unit;
  material_type: MaterialType;
  bottle_type: BottleType | null;
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
  const [rows] = await dbQuery<InventoryRow[]>(
    `SELECT
       rm.id,
       rm.name,
       rm.unit,
       rm.material_type,
       rm.bottle_type,
       rm.created_at,
       i.quantity_available,
       i.low_stock_threshold,
       i.last_updated
     FROM raw_materials rm
     INNER JOIN inventory i ON i.material_id = rm.id
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
      createdAt: row.created_at,
      quantityAvailable: qty,
      lowStockThreshold: threshold,
      lastUpdated: row.last_updated,
      isLowStock,
    };
  });

  return NextResponse.json({ items });
}
