/**
 * Runs database/seed_initial_admin.sql using credentials from .env.local
 * Usage: node scripts/run-seed-admin.js
 */
const fs = require("fs");
const path = require("path");
const mysql = require("mysql2/promise");

function loadEnvLocal() {
  const envPath = path.join(__dirname, "..", ".env.local");
  const env = {};
  if (!fs.existsSync(envPath)) {
    throw new Error("Missing .env.local in project root.");
  }
  for (const line of fs.readFileSync(envPath, "utf8").split(/\r?\n/)) {
    const t = line.trim();
    if (!t || t.startsWith("#")) continue;
    const i = t.indexOf("=");
    if (i === -1) continue;
    env[t.slice(0, i).trim()] = t.slice(i + 1).trim();
  }
  return env;
}

async function main() {
  const env = loadEnvLocal();
  let ssl;
  if (env.DB_SSL === "true" || env.DB_SSL === "1") {
    if (env.DB_SSL_CA_PATH && fs.existsSync(env.DB_SSL_CA_PATH)) {
      ssl = {
        ca: fs.readFileSync(env.DB_SSL_CA_PATH),
        rejectUnauthorized: true,
      };
    } else {
      // Aiven often needs ca.pem; without it Node may reject the chain.
      ssl = { rejectUnauthorized: false };
    }
  }

  const conn = await mysql.createConnection({
    host: env.DB_HOST,
    port: Number(env.DB_PORT || 3306),
    user: env.DB_USER,
    password: env.DB_PASSWORD,
    database: env.DB_NAME,
    ssl,
    multipleStatements: true,
  });

  const sqlPath = path.join(__dirname, "..", "database", "seed_initial_admin.sql");
  const sql = fs.readFileSync(sqlPath, "utf8");
  await conn.query(sql);
  await conn.end();
  console.log("OK: seed_initial_admin.sql applied.");
}

main().catch((err) => {
  console.error(err.message || err);
  process.exit(1);
});
