-- =============================================================================
-- Bottle ERP — complete database schema (MySQL 8+ recommended, InnoDB, utf8mb4)
-- Run this file once. Default database name: bottle_erp
--
-- Safe to re-run: CREATE TABLE IF NOT EXISTS (existing tables unchanged).
-- Auth: `admins` table (first admin via /auth/first-admin or seed SQL; more admins from dashboard).
-- =============================================================================

SET NAMES utf8mb4;
USE bottle_erp;
SET FOREIGN_KEY_CHECKS = 0;

-- ---------------------------------------------------------------------------
-- 1) Admins (JWT sign-in; created_by = another admin, NULL for first admin)
-- ---------------------------------------------------------------------------
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

-- ---------------------------------------------------------------------------
-- 2) Clients
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS `clients` (
  `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  `name` VARCHAR(200) NOT NULL,
  `email` VARCHAR(190) DEFAULT NULL,
  `contact_number` VARCHAR(40) DEFAULT NULL,
  `address` TEXT,
  `created_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_clients_name` (`name`),
  KEY `idx_clients_email` (`email`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ---------------------------------------------------------------------------
-- 3) Raw materials + inventory
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS `raw_materials` (
  `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  `name` VARCHAR(160) NOT NULL,
  `unit` ENUM('pcs','kg') NOT NULL,
  `material_type` ENUM('bottle','label','other') NOT NULL DEFAULT 'other',
  `bottle_type` ENUM('mix','pure') DEFAULT NULL,
  `client_id` BIGINT UNSIGNED DEFAULT NULL,
  `client_label_id` BIGINT UNSIGNED DEFAULT NULL,
  `created_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_raw_materials_type` (`material_type`),
  KEY `idx_raw_materials_bottle_type` (`bottle_type`),
  KEY `idx_raw_materials_client` (`client_id`),
  KEY `idx_raw_materials_client_label` (`client_label_id`),
  UNIQUE KEY `uq_raw_materials_client_label_id` (`client_label_id`),
  CONSTRAINT `fk_raw_materials_client` FOREIGN KEY (`client_id`) REFERENCES `clients` (`id`) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `inventory` (
  `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  `material_id` BIGINT UNSIGNED NOT NULL,
  `quantity_available` DECIMAL(18,4) NOT NULL DEFAULT 0,
  `low_stock_threshold` DECIMAL(18,4) DEFAULT NULL,
  `last_updated` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_inventory_material` (`material_id`),
  CONSTRAINT `fk_inventory_material` FOREIGN KEY (`material_id`) REFERENCES `raw_materials` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ---------------------------------------------------------------------------
-- 4) Client-specific labels
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS `client_labels` (
  `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  `client_id` BIGINT UNSIGNED NOT NULL,
  `label_name` VARCHAR(160) NOT NULL,
  `quantity_available` DECIMAL(18,4) NOT NULL DEFAULT 0,
  `created_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_client_label_name` (`client_id`,`label_name`),
  KEY `idx_client_labels_client` (`client_id`),
  CONSTRAINT `fk_client_labels_client` FOREIGN KEY (`client_id`) REFERENCES `clients` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ---------------------------------------------------------------------------
-- 5) Production (created_by -> admins)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS `production` (
  `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  `client_id` BIGINT UNSIGNED NOT NULL,
  `order_id` BIGINT UNSIGNED DEFAULT NULL,
  `bottle_type` ENUM('mix','pure') NOT NULL,
  `quantity_produced` DECIMAL(18,4) NOT NULL DEFAULT 0,
  `production_date` DATE NOT NULL,
  `notes` VARCHAR(500) DEFAULT NULL,
  `created_by` BIGINT UNSIGNED NOT NULL,
  `created_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_production_client` (`client_id`),
  KEY `idx_production_order` (`order_id`),
  KEY `idx_production_date` (`production_date`),
  KEY `idx_production_created_by` (`created_by`),
  CONSTRAINT `fk_production_client` FOREIGN KEY (`client_id`) REFERENCES `clients` (`id`) ON DELETE RESTRICT,
  CONSTRAINT `fk_production_order` FOREIGN KEY (`order_id`) REFERENCES `orders` (`id`) ON DELETE RESTRICT,
  CONSTRAINT `fk_production_admin` FOREIGN KEY (`created_by`) REFERENCES `admins` (`id`) ON DELETE RESTRICT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `production_usage` (
  `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  `production_id` BIGINT UNSIGNED NOT NULL,
  `material_id` BIGINT UNSIGNED NOT NULL,
  `quantity_used` DECIMAL(18,4) NOT NULL,
  PRIMARY KEY (`id`),
  KEY `idx_production_usage_production` (`production_id`),
  KEY `idx_production_usage_material` (`material_id`),
  UNIQUE KEY `uq_pu_production_material` (`production_id`,`material_id`),
  CONSTRAINT `fk_pu_production` FOREIGN KEY (`production_id`) REFERENCES `production` (`id`) ON DELETE CASCADE,
  CONSTRAINT `fk_pu_material` FOREIGN KEY (`material_id`) REFERENCES `raw_materials` (`id`) ON DELETE RESTRICT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `production_label_usage` (
  `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  `production_id` BIGINT UNSIGNED NOT NULL,
  `client_label_id` BIGINT UNSIGNED NOT NULL,
  `quantity_used` DECIMAL(18,4) NOT NULL,
  PRIMARY KEY (`id`),
  KEY `idx_plu_production` (`production_id`),
  KEY `idx_plu_label` (`client_label_id`),
  UNIQUE KEY `uq_plu_production_client_label` (`production_id`,`client_label_id`),
  CONSTRAINT `fk_plu_production` FOREIGN KEY (`production_id`) REFERENCES `production` (`id`) ON DELETE CASCADE,
  CONSTRAINT `fk_plu_client_label` FOREIGN KEY (`client_label_id`) REFERENCES `client_labels` (`id`) ON DELETE RESTRICT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ---------------------------------------------------------------------------
-- 6) Sales orders
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS `orders` (
  `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  `client_id` BIGINT UNSIGNED NOT NULL,
  `order_date` DATE NOT NULL,
  `total_amount` DECIMAL(18,2) NOT NULL DEFAULT 0,
  `status` ENUM('pending','completed','cancelled') NOT NULL DEFAULT 'pending',
  `payment_type` ENUM('credit','cash') NOT NULL DEFAULT 'credit',
  `invoice_number` VARCHAR(40) DEFAULT NULL,
  `notes` VARCHAR(500) DEFAULT NULL,
  `created_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_orders_invoice_number` (`invoice_number`),
  KEY `idx_orders_client` (`client_id`),
  KEY `idx_orders_date` (`order_date`),
  KEY `idx_orders_status` (`status`),
  CONSTRAINT `fk_orders_client` FOREIGN KEY (`client_id`) REFERENCES `clients` (`id`) ON DELETE RESTRICT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `order_items` (
  `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  `order_id` BIGINT UNSIGNED NOT NULL,
  `product_name` VARCHAR(200) NOT NULL,
  `bottle_type` ENUM('mix','pure') DEFAULT NULL,
  `bottle_size` VARCHAR(80) DEFAULT NULL,
  `quantity` DECIMAL(18,4) NOT NULL,
  `unit_price` DECIMAL(18,2) NOT NULL,
  `total_price` DECIMAL(18,2) NOT NULL,
  `sort_order` INT UNSIGNED NOT NULL DEFAULT 0,
  PRIMARY KEY (`id`),
  KEY `idx_order_items_order` (`order_id`),
  CONSTRAINT `fk_order_items_order` FOREIGN KEY (`order_id`) REFERENCES `orders` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ---------------------------------------------------------------------------
-- 7) Payments
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS `payments` (
  `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  `client_id` BIGINT UNSIGNED NOT NULL,
  `order_id` BIGINT UNSIGNED DEFAULT NULL,
  `amount_paid` DECIMAL(18,2) NOT NULL,
  `payment_date` DATE NOT NULL,
  `payment_method` VARCHAR(64) NOT NULL DEFAULT 'cash',
  `reference_note` VARCHAR(255) DEFAULT NULL,
  `created_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_payments_client` (`client_id`),
  KEY `idx_payments_order` (`order_id`),
  KEY `idx_payments_date` (`payment_date`),
  CONSTRAINT `fk_payments_client` FOREIGN KEY (`client_id`) REFERENCES `clients` (`id`) ON DELETE RESTRICT,
  CONSTRAINT `fk_payments_order` FOREIGN KEY (`order_id`) REFERENCES `orders` (`id`) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ---------------------------------------------------------------------------
-- 8) Ledger
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS `ledger` (
  `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  `client_id` BIGINT UNSIGNED NOT NULL,
  `entry_date` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `debit` DECIMAL(18,2) NOT NULL DEFAULT 0,
  `credit` DECIMAL(18,2) NOT NULL DEFAULT 0,
  `balance` DECIMAL(18,2) NOT NULL,
  `reference_type` ENUM('order','payment','adjustment','opening') NOT NULL DEFAULT 'adjustment',
  `reference_id` BIGINT UNSIGNED DEFAULT NULL,
  `notes` VARCHAR(255) DEFAULT NULL,
  `created_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_ledger_client` (`client_id`),
  KEY `idx_ledger_entry_date` (`entry_date`),
  KEY `idx_ledger_ref` (`reference_type`,`reference_id`),
  CONSTRAINT `fk_ledger_client` FOREIGN KEY (`client_id`) REFERENCES `clients` (`id`) ON DELETE RESTRICT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ---------------------------------------------------------------------------
-- 9) Expenses (created_by -> admins)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS `expenses` (
  `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  `title` VARCHAR(200) NOT NULL,
  `amount` DECIMAL(18,2) NOT NULL,
  `expense_date` DATE NOT NULL,
  `description` TEXT,
  `category` VARCHAR(80) DEFAULT NULL,
  `created_by` BIGINT UNSIGNED DEFAULT NULL,
  `created_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_expenses_date` (`expense_date`),
  KEY `idx_expenses_category` (`category`),
  KEY `idx_expenses_created_by` (`created_by`),
  CONSTRAINT `fk_expenses_admin` FOREIGN KEY (`created_by`) REFERENCES `admins` (`id`) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

SET FOREIGN_KEY_CHECKS = 1;

-- =============================================================================
-- First admin: /auth/first-admin (when no admins) or database/seed_initial_admin.sql
-- =============================================================================
