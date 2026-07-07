-- 候选清单功能建表（批次3：项目候选清单/收藏分组）
-- 需在每个库执行一次。全库共享，无用户隔离（系统当前无用户表）。

CREATE TABLE IF NOT EXISTS `shortlists` (
  `id` varchar(36) NOT NULL,
  `name` varchar(100) NOT NULL,
  `description` varchar(500) DEFAULT NULL,
  `created_by` varchar(255) DEFAULT NULL,
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `shortlist_items` (
  `id` varchar(36) NOT NULL,
  `shortlist_id` varchar(36) NOT NULL,
  `supplier_id` varchar(36) NOT NULL,
  -- 接洽状态：pending 待联系 / contacted 已联系 / quoted 已报价 / cooperated 已合作 / dropped 已放弃
  `status` varchar(20) NOT NULL DEFAULT 'pending',
  `note` text DEFAULT NULL,
  `added_by` varchar(255) DEFAULT NULL,
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uniq_shortlist_supplier` (`shortlist_id`, `supplier_id`),
  KEY `idx_shortlist_items_list` (`shortlist_id`),
  KEY `idx_shortlist_items_supplier` (`supplier_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
