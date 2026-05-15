-- Retire cap as a tracked material type (use "other" for misc stock if needed).
UPDATE `raw_materials`
SET `material_type` = 'other', `updated_at` = NOW()
WHERE `material_type` = 'cap';

ALTER TABLE `raw_materials`
  MODIFY COLUMN `material_type` ENUM('bottle','label','other') NOT NULL DEFAULT 'other';
