-- Link label-category raw materials to a client's branded label line (print-shop receipt).
-- MySQL 8+ for IF NOT EXISTS on ADD COLUMN. Indexes/unique key are also applied at runtime via
-- `ensureRawMaterialsClientLabelColumns()` on first inventory API use.

ALTER TABLE `raw_materials`
  ADD COLUMN IF NOT EXISTS `client_id` BIGINT UNSIGNED NULL AFTER `bottle_type`,
  ADD COLUMN IF NOT EXISTS `client_label_id` BIGINT UNSIGNED NULL AFTER `client_id`;
