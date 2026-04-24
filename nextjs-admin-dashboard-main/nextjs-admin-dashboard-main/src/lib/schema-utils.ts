import { dbQuery, type DbRow } from "@/lib/db";

type CountRow = DbRow & { total: string | number };

export async function columnExists(
  tableName: string,
  columnName: string,
): Promise<boolean> {
  const [rows] = await dbQuery<CountRow[]>(
    `SELECT COUNT(*) AS total
     FROM INFORMATION_SCHEMA.COLUMNS
     WHERE TABLE_SCHEMA = DATABASE()
       AND TABLE_NAME = ?
       AND COLUMN_NAME = ?`,
    [tableName, columnName],
  );
  return Number(rows[0]?.total ?? 0) > 0;
}

export async function indexExists(
  tableName: string,
  indexName: string,
): Promise<boolean> {
  const [rows] = await dbQuery<CountRow[]>(
    `SELECT COUNT(*) AS total
     FROM INFORMATION_SCHEMA.STATISTICS
     WHERE TABLE_SCHEMA = DATABASE()
       AND TABLE_NAME = ?
       AND INDEX_NAME = ?`,
    [tableName, indexName],
  );
  return Number(rows[0]?.total ?? 0) > 0;
}
