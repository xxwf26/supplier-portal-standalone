-- ============================================================
-- 修复：filter_config 里 supplierType 的 value 对齐中文全称 — 2026-06-22
--
-- 背景：2026-06-17 的类型规范化迁移把 suppliers.supplier_type 与
-- DEFAULT_FILTER_CONFIG 统一成 4 种中文全称（个人画师/艺术家/工作室/公司），
-- 但 filter_config 表的种子仍是旧英文枚举（individual/artist/studio/company）。
--
-- 后果：
--   1) 供应商类型筛选完全失效——前端用选项 value(英文) 比对归一化后的
--      type(中文)，includes 永不命中。
--   2) 新建/编辑画师选「艺术家/工作室/公司」会被存成英文值，后端
--      normalizeSupplierType 不识别 → 落到 default「个人画师」，造成脏写。
--
-- 修复：把 value 直接设为 label（中文全称），与归一化结果一致。
-- 在每个权威库上执行一次（本地 + 伙伴库），用 MySQL Workbench。
-- ============================================================

USE supplier_portal;

-- 1) 修复前先看一眼现状
SELECT id, label, value, enabled FROM `filter_config`
WHERE category = 'supplierType' ORDER BY sort_order;

-- 2) value 对齐中文全称（幂等：已是中文则不变）
UPDATE `filter_config`
SET `value` = `label`
WHERE category = 'supplierType';

-- 3) 校验：value 应等于 label，且为 4 个中文全称
SELECT id, label, value, enabled FROM `filter_config`
WHERE category = 'supplierType' ORDER BY sort_order;
