/**
 * Generate bcrypt hash for a password (paste into SQL UPDATE).
 * Usage: node scripts/print-password-hash.js "YourPasswordHere"
 */
const bcrypt = require("bcryptjs");
const pwd = process.argv[2] || "BottleERP@2026";
bcrypt.hash(pwd, 10).then((h) => {
  console.log("Password:", pwd);
  console.log("Hash:\n" + h);
});
