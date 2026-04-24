-- Add email field to clients table.
-- Safe migration for existing installations.

ALTER TABLE `clients`
  ADD COLUMN IF NOT EXISTS `email` VARCHAR(190) DEFAULT NULL AFTER `name`,
  ADD INDEX `idx_clients_email` (`email`);
