/**
 * 画师表单（新建 / 详情编辑）共享的常量、类型与工具。
 *
 * 抽出前这些定义在 NewSupplierModal 与 SupplierDetailModal 各存一份且已漂移
 * （典型：PLATFORM_OPTIONS 新建 4 项、详情 7 项）。统一到此处作为唯一来源，
 * 避免任一处改动漏同步。
 */

export const PRICE_UNIT_OPTIONS = [
  { value: '元/张', label: '元/张' },
  { value: '元/个', label: '元/个' },
  { value: '元/秒', label: '元/秒' },
  { value: '元/套', label: '元/套' },
  { value: '元/条', label: '元/条' },
  { value: '元/天', label: '元/天' },
];

export const CONTACT_TYPE_OPTIONS = [
  { value: 'wechat', label: '微信' },
  { value: 'qq', label: 'QQ' },
  { value: 'phone', label: '电话' },
];

/** 平台选项（取两弹窗并集，之前新建侧缺 B站/P站/官网/其他） */
export const PLATFORM_OPTIONS = [
  { value: 'xiaohongshu', label: '小红书' },
  { value: 'weibo', label: '微博' },
  { value: 'bilibili', label: 'B站' },
  { value: 'pixiv', label: 'P站' },
  { value: 'mihuashi', label: '米画师' },
  { value: 'x', label: 'X' },
  { value: 'website', label: '官网' },
  { value: 'other', label: '其他' },
];

/** value → 中文名，用于只读展示已存链接 */
export const PLATFORM_LABELS: Record<string, string> = Object.fromEntries(
  PLATFORM_OPTIONS.map((o) => [o.value, o.label]),
);

export const CONTACT_TYPE_LABELS: Record<string, string> = Object.fromEntries(
  CONTACT_TYPE_OPTIONS.map((o) => [o.value, o.label]),
);

export const MAX_PRICE_ITEMS = 5;
export const MAX_CONTACT_ITEMS = 10;

export interface LinkEntry {
  platform: string;
  url: string;
}

export interface PriceItemEntry {
  cooperationType: string;
  unitPrice: string;
  priceUnit: string;
}

export interface ContactItemEntry {
  type: string;
  value: string;
}
