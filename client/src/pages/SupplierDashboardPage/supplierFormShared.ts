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

/**
 * 把 socialLinks / manualLinks 这类"平台→链接"的 JSON 列归一化为
 * `Record<string, string[]>`（每平台多条链接）。
 *
 * 兼容三种历史形态，是"零数据库迁移"支持多链接的核心：
 * - 新格式 `{p: [url1, url2]}`：过滤空串后原样返回；
 * - **老格式 `{p: "url"}`：单字符串自动包成 `[url]`**（老记录读出即升级，无需迁移）；
 * - 字符串化的 JSON（后端偶发把 json 列当字符串返回）：先 parse 再归一化。
 *
 * 供 SupplierDetailModal / SupplierDashboardPage 的读取路径共用，替代原先各自
 * 重复的 toObj / toObject，避免再次漂移。
 */
export function normalizeLinkMap(v: unknown): Record<string, string[]> {
  let obj: unknown = v;
  if (typeof v === 'string') {
    try {
      obj = JSON.parse(v);
    } catch {
      return {};
    }
  }
  if (!obj || typeof obj !== 'object' || Array.isArray(obj)) return {};
  const out: Record<string, string[]> = {};
  for (const [platform, raw] of Object.entries(obj as Record<string, unknown>)) {
    let urls: string[];
    if (Array.isArray(raw)) {
      urls = raw.filter((u): u is string => typeof u === 'string' && !!u.trim()).map((u) => u.trim());
    } else if (typeof raw === 'string' && raw.trim()) {
      urls = [raw.trim()];
    } else {
      urls = [];
    }
    if (urls.length) out[platform] = urls;
  }
  return out;
}

