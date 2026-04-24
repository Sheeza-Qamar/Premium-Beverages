/**
 * Connects with .env.local and:
 * 1) Creates `admins` if missing
 * 2) Copies rows from `users` into `admins` (drops `role`; `created_by` = NULL)
 * 3) Repoints FKs from `users` to `admins` on `production` and `expenses`
 * 4) Drops `users`
 *
 * Usage: node scripts/migrate-users-to-admins-run.js
 */
const fs = require("fs");
const path = require("path");
const mysql = require("mysql2/promise");

function loadEnvLocal() {
  const envPath = path.join(__dirname, "..", ".env.local");
  if (!fs.existsSync(envPath)) {
    throw new Error("Missing .env.local");
  }
  const env = {};
  for (const line of fs.readFileSync(envPath, "utf8").split(/\r?\n/)) {
    const t = line.trim();
    if (!t || t.startsWith("#")) continue;
    const i = t.indexOf("=");
    if (i === -1) continue;
    env[t.slice(0, i).trim()] = t.slice(i + 1).trim();
  }
  return env;
}

function sslOptions(env) {
  if (env.DB_SSL !== "true" && env.DB_SSL !== "1") return undefined;
  if (env.DB_SSL_CA_PATH && fs.existsSync(env.DB_SSL_CA_PATH)) {
    return {
      ca: fs.readFileSync(env.DB_SSL_CA_PATH),
      rejectUnauthorized: true,
    };
  }
  return { rejectUnauthorized: false };
}

async function tableExists(conn, name) {
  const [rows] = await conn.query(
    `SELECT 1 FROM information_schema.TABLES
     WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ? LIMIT 1`,
    [name],
  );
  return rows.length > 0;
}

async function dropForeignKeysToTable(conn, referencedTable) {
  const [rows] = await conn.query(
    `SELECT TABLE_NAME, CONSTRAINT_NAME
     FROM information_schema.REFERENTIAL_CONSTRAINTS
     WHERE CONSTRAINT_SCHEMA = DATABASE()
       AND REFERENCED_TABLE_NAME = ?`,
    [referencedTable],
  );
  for (const row of rows) {
    const sql = `ALTER TABLE \`${row.TABLE_NAME}\` DROP FOREIGN KEY \`${row.CONSTRAINT_NAME}\``;
    console.log("Running:", sql);
    await conn.query(sql);
  }
}

/** Drop any foreign key on this table column (e.g. old users or admins ref). */
async function dropFkOnColumn(conn, tableName, columnName) {
  const [rows] = await conn.query(
    `SELECT kcu.CONSTRAINT_NAME
     FROM information_schema.KEY_COLUMN_USAGE kcu
     INNER JOIN information_schema.TABLE_CONSTRAINTS tc
       ON kcu.CONSTRAINT_SCHEMA = tc.CONSTRAINT_SCHEMA
       AND kcu.TABLE_NAME = tc.TABLE_NAME
       AND kcu.CONSTRAINT_NAME = tc.CONSTRAINT_NAME
     WHERE kcu.TABLE_SCHEMA = DATABASE()
       AND kcu.TABLE_NAME = ?
       AND kcu.COLUMN_NAME = ?
       AND tc.CONSTRAINT_TYPE = 'FOREIGN KEY'`,
    [tableName, columnName],
  );
  for (const row of rows) {
    const sql = `ALTER TABLE \`${tableName}\` DROP FOREIGN KEY \`${row.CONSTRAINT_NAME}\``;
    console.log("Running:", sql);
    await conn.query(sql);
  }
}

async function addFkIfMissing(conn, table, col, refTable, cname, onDelete) {
  const [rows] = await conn.query(
    `SELECT CONSTRAINT_NAME FROM information_schema.REFERENTIAL_CONSTRAINTS
     WHERE CONSTRAINT_SCHEMA = DATABASE()
       AND TABLE_NAME = ?
       AND CONSTRAINT_NAME = ?`,
    [table, cname],
  );
  if (rows.length > 0) {
    console.log(`FK ${cname} on ${table} already exists — skip.`);
    return;
  }
  const sql = `ALTER TABLE \`${table}\` ADD CONSTRAINT \`${cname}\`
    FOREIGN KEY (\`${col}\`) REFERENCES \`${refTable}\`(\`id\`) ${onDelete}`;
  console.log("Running:", sql.replace(/\s+/g, " "));
  await conn.query(sql);
}

async function main() {
  const env = loadEnvLocal();
  const conn = await mysql.createConnection({
    host: env.DB_HOST,
    port: Number(env.DB_PORT || 3306),
    user: env.DB_USER,
    password: env.DB_PASSWORD,
    database: env.DB_NAME,
    ssl: sslOptions(env),
    multipleStatements: false,
  });

  console.log("Database:", env.DB_NAME);

  const hasUsers = await tableExists(conn, "users");
  const hasAdmins = await tableExists(conn, "admins");

  if (!hasUsers && hasAdmins) {
    console.log("OK: `users` already removed and `admins` exists. Nothing to do.");
    await conn.end();
    return;
  }

  await conn.query("SET FOREIGN_KEY_CHECKS = 0");

  if (!hasAdmins) {
    console.log("Creating table `admins`...");
    await conn.query(`
      CREATE TABLE \`admins\` (
        \`id\` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
        \`name\` VARCHAR(120) NOT NULL,
        \`email\` VARCHAR(190) NOT NULL,
        \`password_hash\` VARCHAR(255) NOT NULL,
        \`is_active\` TINYINT(1) NOT NULL DEFAULT 1,
        \`created_by\` BIGINT UNSIGNED DEFAULT NULL,
        \`created_at\` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
        \`updated_at\` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        PRIMARY KEY (\`id\`),
        UNIQUE KEY \`uq_admins_email\` (\`email\`),
        KEY \`idx_admins_active\` (\`is_active\`),
        KEY \`idx_admins_created_by\` (\`created_by\`),
        CONSTRAINT \`fk_admins_created_by\` FOREIGN KEY (\`created_by\`) REFERENCES \`admins\` (\`id\`) ON DELETE SET NULL
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `);
  }

  if (hasUsers) {
    console.log("Copying rows from `users` → `admins`...");
    await conn.query(`
      INSERT INTO \`admins\` (\`id\`, \`name\`, \`email\`, \`password_hash\`, \`is_active\`, \`created_by\`, \`created_at\`, \`updated_at\`)
      SELECT \`id\`, \`name\`, \`email\`, \`password_hash\`, \`is_active\`, NULL, \`created_at\`, \`updated_at\`
      FROM \`users\`
      ON DUPLICATE KEY UPDATE
        \`name\` = VALUES(\`name\`),
        \`email\` = VALUES(\`email\`),
        \`password_hash\` = VALUES(\`password_hash\`),
        \`is_active\` = VALUES(\`is_active\`)
    `);

    const [maxRow] = await conn.query(
      "SELECT COALESCE(MAX(id), 0) + 1 AS n FROM admins",
    );
    const nextAi = Number(maxRow[0].n);
    await conn.query(`ALTER TABLE admins AUTO_INCREMENT = ${nextAi}`);
  }

  if (hasUsers) {
    console.log("Dropping foreign keys pointing to `users`...");
    await dropForeignKeysToTable(conn, "users");
  }

  console.log("Ensuring FKs from `production` / `expenses` → `admins`...");
  if (await tableExists(conn, "production")) {
    await dropFkOnColumn(conn, "production", "created_by");
    await addFkIfMissing(
      conn,
      "production",
      "created_by",
      "admins",
      "fk_production_admin",
      "ON DELETE RESTRICT",
    );
  }

  if (await tableExists(conn, "expenses")) {
    await dropFkOnColumn(conn, "expenses", "created_by");
    await addFkIfMissing(
      conn,
      "expenses",
      "created_by",
      "admins",
      "fk_expenses_admin",
      "ON DELETE SET NULL",
    );
  }

  if (hasUsers) {
    console.log("Dropping table `users`...");
    await conn.query("DROP TABLE IF EXISTS `users`");
  }

  await conn.query("SET FOREIGN_KEY_CHECKS = 1");
  await conn.end();
  console.log("Done: `admins` is ready; `users` removed (if it existed).");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
