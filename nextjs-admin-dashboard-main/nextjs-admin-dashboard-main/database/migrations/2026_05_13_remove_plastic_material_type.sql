-- Retire `plastic` as a raw material category: move data to `other`, then shrink ENUM.
-- Safe to run once on existing databases.

UPDATE `raw_materials`
SET `material_type` = 'other', `updated_at` = NOW()
WHERE `material_type` = 'plastic';

ALTER TABLE `raw_materials`
  MODIFY COLUMN `material_type` ENUM('bottle','cap','label','other') NOT NULL DEFAULT 'other';
