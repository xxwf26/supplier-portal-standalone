
-- ============================================================
-- 数据库结构(建表语句)快照 — supplier_portal — 2026-06-17
-- 用途:供伙伴对照同步表结构(数据本身以伙伴的权威库为准,不靠本文件覆盖)。
--
-- 本阶段相对早期结构的变化点:
--   1. 新增 filter_config 表 —— 系统配置(筛选/字段选项)入库,成为唯一数据源
--      (替代原来的浏览器 localStorage 配置)。
--   2. filter_config 增加 note 列 —— 标签的"备注",仅系统配置页可见,
--      不参与筛选/详情/报价。
--   3. suppliers 主表结构未变;但本地已做过画师数据清洗:
--      擅长风格/合作类型/所属项目 只保留系统配置内的值(脏值已清),
--      供应商类型沿用现状(个人/工作室/公司…,前端经 inferSupplierType 映射)。
--
-- 配套脚本(各库执行一次):
--   create-filter-config-2026-06-17.sql   建 filter_config 表 + 灌默认配置种子
--   alter-filter-config-note-2026-06-17.sql 给 filter_config 加 note 列
-- ============================================================

/*!40101 SET @OLD_CHARACTER_SET_CLIENT=@@CHARACTER_SET_CLIENT */;
/*!40101 SET @OLD_CHARACTER_SET_RESULTS=@@CHARACTER_SET_RESULTS */;
/*!40101 SET @OLD_COLLATION_CONNECTION=@@COLLATION_CONNECTION */;
/*!50503 SET NAMES utf8mb4 */;
/*!40103 SET @OLD_TIME_ZONE=@@TIME_ZONE */;
/*!40103 SET TIME_ZONE='+00:00' */;
/*!40014 SET @OLD_UNIQUE_CHECKS=@@UNIQUE_CHECKS, UNIQUE_CHECKS=0 */;
/*!40014 SET @OLD_FOREIGN_KEY_CHECKS=@@FOREIGN_KEY_CHECKS, FOREIGN_KEY_CHECKS=0 */;
/*!40101 SET @OLD_SQL_MODE=@@SQL_MODE, SQL_MODE='NO_AUTO_VALUE_ON_ZERO' */;
/*!40111 SET @OLD_SQL_NOTES=@@SQL_NOTES, SQL_NOTES=0 */;
DROP TABLE IF EXISTS `__drizzle_migrations`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `__drizzle_migrations` (
  `id` bigint unsigned NOT NULL AUTO_INCREMENT,
  `hash` text COLLATE utf8mb4_unicode_ci NOT NULL,
  `created_at` bigint DEFAULT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `id` (`id`)
) ENGINE=InnoDB AUTO_INCREMENT=2 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;
DROP TABLE IF EXISTS `audit_log`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `audit_log` (
  `id` int NOT NULL AUTO_INCREMENT,
  `operation` varchar(50) COLLATE utf8mb4_unicode_ci NOT NULL,
  `record_id` varchar(36) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `batch_id` varchar(255) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `table_name` varchar(100) COLLATE utf8mb4_unicode_ci DEFAULT 'suppliers',
  `old_data` longtext CHARACTER SET utf8mb4 COLLATE utf8mb4_bin,
  `new_data` longtext CHARACTER SET utf8mb4 COLLATE utf8mb4_bin,
  `operated_by` varchar(255) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_audit_batch_id` (`batch_id`),
  KEY `idx_audit_record_id` (`record_id`),
  KEY `idx_audit_created_at` (`created_at`),
  CONSTRAINT `audit_log_chk_1` CHECK (json_valid(`old_data`)),
  CONSTRAINT `audit_log_chk_2` CHECK (json_valid(`new_data`))
) ENGINE=InnoDB AUTO_INCREMENT=20 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;
DROP TABLE IF EXISTS `filter_config`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `filter_config` (
  `id` varchar(36) COLLATE utf8mb4_unicode_ci NOT NULL,
  `category` varchar(50) COLLATE utf8mb4_unicode_ci NOT NULL,
  `label` varchar(100) COLLATE utf8mb4_unicode_ci NOT NULL,
  `value` varchar(100) COLLATE utf8mb4_unicode_ci NOT NULL,
  `color` varchar(30) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `note` varchar(255) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `sort_order` int DEFAULT '0',
  `enabled` tinyint(1) DEFAULT '1',
  `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_filter_category` (`category`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;
DROP TABLE IF EXISTS `suppliers`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `suppliers` (
  `id` varchar(36) COLLATE utf8mb4_unicode_ci NOT NULL,
  `account_name` varchar(255) COLLATE utf8mb4_unicode_ci NOT NULL,
  `social_links` longtext CHARACTER SET utf8mb4 COLLATE utf8mb4_bin,
  `sub_category` text COLLATE utf8mb4_unicode_ci,
  `cooperation_type` varchar(255) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `price_range` text COLLATE utf8mb4_unicode_ci,
  `price_items` longtext CHARACTER SET utf8mb4 COLLATE utf8mb4_bin,
  `cooperation_count` int DEFAULT '0',
  `rating` int DEFAULT NULL,
  `risk_status` varchar(255) COLLATE utf8mb4_unicode_ci DEFAULT '暂无',
  `is_in_stock` tinyint(1) DEFAULT '1',
  `entity_type` varchar(255) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `contract_entity` varchar(255) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `contract_type` varchar(255) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `contract_no` varchar(255) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `contract_deadline` date DEFAULT NULL,
  `tax_status` varchar(255) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `contact_info` text COLLATE utf8mb4_unicode_ci,
  `contact_items` longtext CHARACTER SET utf8mb4 COLLATE utf8mb4_bin,
  `cooperation_category` varchar(255) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `supplier_type` varchar(255) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `artwork_urls` longtext CHARACTER SET utf8mb4 COLLATE utf8mb4_bin,
  `manual_links` longtext CHARACTER SET utf8mb4 COLLATE utf8mb4_bin,
  `import_source` varchar(255) COLLATE utf8mb4_unicode_ci DEFAULT 'manual',
  `import_batch_id` varchar(255) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  CONSTRAINT `suppliers_chk_1` CHECK (json_valid(`social_links`)),
  CONSTRAINT `suppliers_chk_2` CHECK (json_valid(`price_items`)),
  CONSTRAINT `suppliers_chk_3` CHECK (json_valid(`contact_items`)),
  CONSTRAINT `suppliers_chk_4` CHECK (json_valid(`artwork_urls`)),
  CONSTRAINT `suppliers_chk_5` CHECK (json_valid(`manual_links`))
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;
/*!40103 SET TIME_ZONE=@OLD_TIME_ZONE */;

/*!40101 SET SQL_MODE=@OLD_SQL_MODE */;
/*!40014 SET FOREIGN_KEY_CHECKS=@OLD_FOREIGN_KEY_CHECKS */;
/*!40014 SET UNIQUE_CHECKS=@OLD_UNIQUE_CHECKS */;
/*!40101 SET CHARACTER_SET_CLIENT=@OLD_CHARACTER_SET_CLIENT */;
/*!40101 SET CHARACTER_SET_RESULTS=@OLD_CHARACTER_SET_RESULTS */;
/*!40101 SET COLLATION_CONNECTION=@OLD_COLLATION_CONNECTION */;
/*!40111 SET SQL_NOTES=@OLD_SQL_NOTES */;

