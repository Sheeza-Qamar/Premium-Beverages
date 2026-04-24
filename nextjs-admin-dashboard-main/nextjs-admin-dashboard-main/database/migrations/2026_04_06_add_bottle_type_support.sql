-- Add bottle type support across inventory/selling/production.
-- MySQL 8+ required for IF NOT EXISTS on ADD COLUMN.

ALTER TABLE `raw_materials`
  ADD COLUMN IF NOT EXISTS `bottle_type` ENUM('mix','pure') DEFAULT NULL AFTER `material_type`,
  ADD INDEX `idx_raw_materials_bottle_type` (`bottle_type`);

ALTER TABLE `production`
  ADD COLUMN IF NOT EXISTS `bottle_type` ENUM('mix','pure') NOT NULL DEFAULT 'mix' AFTER `client_id`;

ALTER TABLE `order_items`
  ADD COLUMN IF NOT EXISTS `bottle_type` ENUM('mix','pure') DEFAULT NULL AFTER `product_name`;
