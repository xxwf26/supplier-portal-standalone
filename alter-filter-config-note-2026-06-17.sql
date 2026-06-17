-- ============================================================
-- filter_config 增加 note(备注)列 — 2026-06-17
-- 备注仅在系统配置页展示，不参与筛选/详情页/报价。
-- 每个数据库执行一次（用 MySQL Workbench）。
-- 注意：MySQL 8.0 不支持 ADD COLUMN IF NOT EXISTS；若该列已存在会报
--      “Duplicate column name 'note'”，忽略即可（说明已加过）。
-- ============================================================

USE supplier_portal;

ALTER TABLE `filter_config`
  ADD COLUMN `note` VARCHAR(255) NULL AFTER `color`;

-- 校验
SHOW COLUMNS FROM `filter_config` LIKE 'note';
