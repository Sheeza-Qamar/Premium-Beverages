-- One-time migration if you already have the OLD `users` table (not for fresh installs).
-- Review and run in order: Workbench / mysql client on `bottle_erp`.
-- Backup your database first.

USE bottle_erp;

-- 1) Create admins if missing (same structure as bottle_erp_full_schema.sql)
CREATE TABLE IF NOT EXISTS `admins` (
  `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  `name` VARCHAR(120) NOT NULL,
  `email` VARCHAR(190) NOT NULL,
  `password_hash` VARCHAR(255) NOT NULL,
  `is_active` TINYINT(1) NOT NULL DEFAULT 1,
  `created_by` BIGINT UNSIGNED DEFAULT NULL,
  `created_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_admins_email` (`email`),
  KEY `idx_admins_active` (`is_active`),
  KEY `idx_admins_created_by` (`created_by`),
  CONSTRAINT `fk_admins_created_by` FOREIGN KEY (`created_by`) REFERENCES `admins` (`id`) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 2) Copy admin-role rows from users (preserves ids for FKs)
INSERT INTO `admins` (`id`, `name`, `email`, `password_hash`, `is_active`, `created_by`, `created_at`, `updated_at`)
SELECT `id`, `name`, `email`, `password_hash`, `is_active`, NULL, `created_at`, `updated_at`
FROM `users`
WHERE `role` = 'admin'
ON DUPLICATE KEY UPDATE
  `name` = VALUES(`name`),
  `email` = VALUES(`email`),
  `password_hash` = VALUES(`password_hash`),
  `is_active` = VALUES(`is_active`);

-- 3) Fix FKs on production / expenses (drop old user FKs, point to admins)
SET FOREIGN_KEY_CHECKS = 0;

-- production
ALTER TABLE `production` DROP FOREIGN KEY `fk_production_user`;
ALTER TABLE `production` ADD CONSTRAINT `fk_production_admin` FOREIGN KEY (`created_by`) REFERENCES `admins` (`id`) ON DELETE RESTRICT;

-- expenses
ALTER TABLE `expenses` DROP FOREIGN KEY `fk_expenses_user`;
ALTER TABLE `expenses` ADD CONSTRAINT `fk_expenses_admin` FOREIGN KEY (`created_by`) REFERENCES `admins` (`id`) ON DELETE SET NULL;

SET FOREIGN_KEY_CHECKS = 1;

-- 4) Drop old users table (only after verifying admins + app works)
-- DROP TABLE IF EXISTS `users`;
