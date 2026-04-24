-- Initial admin row (optional if you already use /auth/first-admin).
-- Password: BottleERP@2026 (or use scripts/print-password-hash.js)

USE bottle_erp;

INSERT INTO `admins` (`name`, `email`, `password_hash`, `is_active`, `created_by`)
VALUES (
  'System Admin',
  'sp22-bcs-096@cuilahore.edu.pk',
  '$2b$10$AxlaU0SgGeka/AbCxiPENuvTleOGAgvKo2t8yd4YHhqdY9xA5HOXS',
  1,
  NULL
)
ON DUPLICATE KEY UPDATE
  `name` = VALUES(`name`),
  `password_hash` = VALUES(`password_hash`),
  `is_active` = 1;
