-- ============================================================
-- filter_config 建表 + 种子 — 2026-06-17（配置入库 阶段1）
-- 把"系统配置"的细分标签从浏览器 localStorage 迁入数据库，成为唯一数据源。
--
-- 在每个需要该功能的数据库上执行一次（本地 + 伙伴的权威库）。
-- 用 MySQL Workbench 执行。建表用 IF NOT EXISTS；种子先清空再插入，
-- 若已有自定义配置，勿重复跑种子段。
-- 供应商类型沿用现有体系：label=中文展示，value=英文枚举(individual/artist/studio/company)。
-- ============================================================

USE supplier_portal;

-- 1) 建表（与 server/src/database/filter-config.schema.ts 一致）
CREATE TABLE IF NOT EXISTS `filter_config` (
  `id`         VARCHAR(36)  NOT NULL,
  `category`   VARCHAR(50)  NOT NULL,
  `label`      VARCHAR(100) NOT NULL,
  `value`      VARCHAR(100) NOT NULL,
  `color`      VARCHAR(30)  DEFAULT NULL,
  `sort_order` INT          DEFAULT 0,
  `enabled`    BOOLEAN      DEFAULT TRUE,
  `created_at` TIMESTAMP    DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_category` (`category`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 2) 种子：灌入当前默认配置（与 client/src/lib/filterConfig.ts 的 DEFAULT_FILTER_CONFIG 一致）
--    ⚠ 仅在初次初始化、或确实想重置为默认时执行。
DELETE FROM `filter_config`;

INSERT INTO `filter_config` (`id`, `category`, `label`, `value`, `color`, `sort_order`, `enabled`) VALUES
-- 供应商类型（value 为英文枚举，与 inferSupplierType / 筛选保持一致）
(UUID(), 'supplierType', '个人画师', 'individual', 'blue',   0, TRUE),
(UUID(), 'supplierType', '艺术家',   'artist',     'purple', 1, TRUE),
(UUID(), 'supplierType', '工作室',   'studio',     'green',  2, TRUE),
(UUID(), 'supplierType', '公司',     'company',    'amber',  3, TRUE),
-- 合作类型
(UUID(), 'cooperationType', '角色原画', '角色原画', NULL, 0,  TRUE),
(UUID(), 'cooperationType', '场景原画', '场景原画', NULL, 1,  TRUE),
(UUID(), 'cooperationType', '平面海报', '平面海报', NULL, 2,  TRUE),
(UUID(), 'cooperationType', 'UI图标',   'UI图标',   NULL, 3,  TRUE),
(UUID(), 'cooperationType', '视频动效', '视频动效', NULL, 4,  TRUE),
(UUID(), 'cooperationType', '平面拍摄', '平面拍摄', NULL, 5,  TRUE),
(UUID(), 'cooperationType', '视频拍摄', '视频拍摄', NULL, 6,  TRUE),
(UUID(), 'cooperationType', '达人营销', '达人营销', NULL, 7,  TRUE),
(UUID(), 'cooperationType', '驻场合作', '驻场合作', NULL, 8,  TRUE),
(UUID(), 'cooperationType', '笔替',     '笔替',     NULL, 9,  TRUE),
(UUID(), 'cooperationType', '文案',     '文案',     NULL, 10, TRUE),
-- 细分风格
(UUID(), 'style', 'Q版',       'Q版',       'amber',   0,  TRUE),
(UUID(), 'style', '正比',      '正比',      'yellow',  1,  TRUE),
(UUID(), 'style', '古风',      '古风',      'red',     2,  TRUE),
(UUID(), 'style', '欧风',      '欧风',      'cyan',    3,  TRUE),
(UUID(), 'style', '写实',      '写实',      'blue',    4,  TRUE),
(UUID(), 'style', '少女风',    '少女风',    'pink',    5,  TRUE),
(UUID(), 'style', '赛博朋克',  '赛博朋克',  'purple',  6,  TRUE),
(UUID(), 'style', '立绘',      '立绘',      'green',   7,  TRUE),
(UUID(), 'style', '小物',      '小物',      'teal',    8,  TRUE),
(UUID(), 'style', '场景',      '场景',      'sky',     9,  TRUE),
(UUID(), 'style', 'KKV',       'KKV',       'indigo',  10, TRUE),
(UUID(), 'style', 'L2D动效',   'L2D动效',   'emerald', 11, TRUE),
(UUID(), 'style', '手书',      '手书',      'rose',    12, TRUE),
(UUID(), 'style', '3D建模',    '3D建模',    'slate',   13, TRUE),
(UUID(), 'style', '像素风',    '像素风',    'lime',    14, TRUE),
(UUID(), 'style', '推文长图',  '推文长图',  'stone',   15, TRUE),
(UUID(), 'style', '解说视频',  '解说视频',  'sky',     16, TRUE),
(UUID(), 'style', '逐帧动画',  '逐帧动画',  'orange',  17, TRUE),
(UUID(), 'style', '包装视频',  '包装视频',  'violet',  18, TRUE),
(UUID(), 'style', 'PV整包',    'PV整包',    'fuchsia', 19, TRUE),
(UUID(), 'style', '特效原画',  '特效原画',  'red',     20, TRUE),
(UUID(), 'style', '广告投放',  '广告投放',  'amber',   21, TRUE),
(UUID(), 'style', '活动搭建',  '活动搭建',  'emerald', 22, TRUE),
(UUID(), 'style', '达人合作',  '达人合作',  'pink',    23, TRUE),
-- 合作状态
(UUID(), 'cooperationStatus', '库内合作', 'in_stock',    'text-green-600', 0, TRUE),
(UUID(), 'cooperationStatus', '库外建联', 'outreach',    'text-blue-600',  1, TRUE),
(UUID(), 'cooperationStatus', '已拉黑',   'blacklisted', 'text-gray-500',  2, TRUE),
-- 所属项目
(UUID(), 'project', '恋与制作人',   '恋与制作人',   NULL, 0, TRUE),
(UUID(), 'project', '深空',         '深空',         NULL, 1, TRUE),
(UUID(), 'project', '闪暖',         '闪暖',         NULL, 2, TRUE),
(UUID(), 'project', '无暖',         '无暖',         NULL, 3, TRUE),
(UUID(), 'project', '无期迷途',     '无期迷途',     NULL, 4, TRUE),
(UUID(), 'project', 'IP开发中心',   'IP开发中心',   NULL, 5, TRUE),
(UUID(), 'project', '通用',         '通用',         NULL, 6, TRUE);

-- 3) 校验
SELECT category, COUNT(*) AS cnt FROM `filter_config` GROUP BY category;
