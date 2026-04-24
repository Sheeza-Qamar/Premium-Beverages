import fs from "node:fs";
import mysql, {
  type Pool,
  type PoolConnection,
  type PoolOptions,
  type QueryResult,
  type ResultSetHeader,
  type RowDataPacket,
} from "mysql2/promise";

/* eslint-disable no-var */
declare global {
  var __erpDbPool: Pool | undefined;
}

function getRequiredEnv(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return value;
}

function envFlag(name: string): boolean {
  const v = process.env[name]?.toLowerCase();
  return v === "1" || v === "true" || v === "yes";
}

/**
 * Aiven (and most hosted MySQL) require TLS.
 * - With `DB_SSL_CA_PATH` pointing to Aiven `ca.pem`: full certificate verification.
 * - With `DB_SSL=true` but no CA file: Node often fails on "self-signed certificate in
 *   certificate chain" if `rejectUnauthorized` is true — so we default to false unless
 *   `DB_SSL_REJECT_UNAUTHORIZED=true` (only use after you have ca.pem working).
 */
function getSslOptions(): PoolOptions["ssl"] | undefined {
  const caPath = process.env.DB_SSL_CA_PATH?.trim();
  if (caPath) {
    return { ca: fs.readFileSync(caPath), rejectUnauthorized: true };
  }
  if (
    envFlag("DB_SSL") ||
    envFlag("DATABASE_SSL") ||
    process.env.DB_SSL_MODE?.toUpperCase() === "REQUIRED"
  ) {
    const strict = envFlag("DB_SSL_REJECT_UNAUTHORIZED");
    return { rejectUnauthorized: strict };
  }
  return undefined;
}

function getPool(): Pool {
  if (global.__erpDbPool) {
    return global.__erpDbPool;
  }

  const ssl = getSslOptions();
  const pool = mysql.createPool({
    host: getRequiredEnv("DB_HOST"),
    port: Number(process.env.DB_PORT ?? 3306),
    user: getRequiredEnv("DB_USER"),
    password: getRequiredEnv("DB_PASSWORD"),
    database: getRequiredEnv("DB_NAME"),
    ssl,
    waitForConnections: true,
    connectionLimit: 10,
    queueLimit: 0,
  });

  // Reuse one pool instance in all environments to avoid reconnect overhead
  // on every request (especially expensive with remote TLS databases).
  global.__erpDbPool = pool;

  return pool;
}

export type DbRow = RowDataPacket;

export async function dbQuery<T extends QueryResult>(
  sql: string,
  values: any[] = [],
) {
  return getPool().query<T>(sql, values);
}

export async function dbExecute(sql: string, values: any[] = []) {
  return getPool().execute<ResultSetHeader>(sql, values);
}

export async function withTransaction<T>(
  fn: (connection: PoolConnection) => Promise<T>,
): Promise<T> {
  const connection = await getPool().getConnection();
  try {
    await connection.beginTransaction();
    const result = await fn(connection);
    await connection.commit();
    return result;
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
}
