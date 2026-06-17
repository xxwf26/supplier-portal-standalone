-- ============================================================
-- 供应商类型字段统一迁移 — 2026-06-17
-- 目标：supplier_type 只保留 4 种中文全称（个人画师/艺术家/工作室/公司）
-- 规则：与前端 normalizeSupplierType 的"名字优先"逻辑一致，
--       迁移后画面显示完全不变，仅把正确值落库。
--
-- 执行前务必备份：
--   mysqldump -u root supplier_portal > backup_before_supplier_type.sql
-- 然后在 MySQL Workbench 里执行本脚本（顺序敏感，请勿打乱）。
-- ============================================================

USE supplier_portal;

-- 1) 名字含"工作室" → 工作室
UPDATE suppliers SET supplier_type = '工作室'
WHERE account_name LIKE '%工作室%';

-- 2) 名字含 公司/有限/股份，或旧脏值 个体工商户/一般企业 → 公司
UPDATE suppliers SET supplier_type = '公司'
WHERE account_name LIKE '%公司%'
   OR account_name LIKE '%有限%'
   OR account_name LIKE '%股份%'
   OR supplier_type IN ('个体工商户', '一般企业');

-- 3) 剩余的 个人 / 空 / NULL → 个人画师
UPDATE suppliers SET supplier_type = '个人画师'
WHERE supplier_type IS NULL
   OR supplier_type = ''
   OR supplier_type = '个人';

-- 已是 艺术家 / 工作室 / 公司 / 个人画师 的行不受影响。

-- ============================================================
-- 校验：执行后结果应只含 4 种中文全称
-- ============================================================
SELECT supplier_type, COUNT(*) AS cnt
FROM suppliers
GROUP BY supplier_type
ORDER BY cnt DESC;
