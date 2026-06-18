import {
  AwardIcon,
  Building2Icon,
  PaletteIcon,
  UserIcon,
} from 'lucide-react';

/** 供应商类型：全站唯一的 4 种中文全称，数据库存储 / 显示 / 筛选三处一致 */
export type SupplierType = '个人画师' | '艺术家' | '工作室' | '公司';

/** 4 种类型的权威顺序（用于遍历、统计、下拉等） */
export const SUPPLIER_TYPES: SupplierType[] = ['个人画师', '艺术家', '工作室', '公司'];

/**
 * 归一化供应商类型 → 4 种中文全称之一。
 * 存储值优先：已是 4 种全称则原样返回（数据库为权威来源）；
 * 否则按名字与旧值兜底（兼容历史脏值 / NULL / Excel 导入）。
 */
export function normalizeSupplierType(
  supplierType: string | null | undefined,
  name = '',
): SupplierType {
  // 已规范：直接信任数据库
  if (
    supplierType === '个人画师' ||
    supplierType === '艺术家' ||
    supplierType === '工作室' ||
    supplierType === '公司'
  ) {
    return supplierType;
  }
  // 兜底：名字优先
  if (name.includes('工作室')) return '工作室';
  if (name.includes('公司') || name.includes('有限') || name.includes('股份')) return '公司';
  // 再按旧存储值映射
  switch (supplierType) {
    case '艺术家':
      return '艺术家';
    case '个体工商户':
    case '一般企业':
      return '公司';
    case '个人':
    default:
      return '个人画师';
  }
}

/** 与后端 normalizeName 保持一致的前端版本：去掉括号内容、地名、行业通用词后缀 */
export function normalizeSupplierName(str: string): string {
  // ① 去括号内容
  let s = str
    .replace(/（[^）]*）/g, '')
    .replace(/\([^)]*\)/g, '')
    .replace(/【[^】]*】/g, '')
    .replace(/\s+/g, '');

  // ② 去尾部法人/行业后缀
  const suffixes = [
    '有限责任公司', '股份有限公司', '有限合伙企业',
    '文化传媒有限公司', '科技有限公司', '网络科技有限公司',
    '文化创意有限公司', '创意设计有限公司',
    '文化发展有限公司', '影视文化有限公司',
    '文化传播有限公司', '动漫科技有限公司',
    '有限公司', '工作室',
    '文化传媒', '网络科技', '文化科技', '创意设计',
    '文化传播', '影视传媒', '影视文化', '互娱科技',
    '文化', '传媒', '科技', '网络', '信息', '动画',
    '设计', '创意', '传播', '互娱', '影视', '映画',
    '艺术', '制作', '互动', '数字', '游戏', '教育', '有限',
  ];
  for (const sfx of suffixes) {
    if (s.endsWith(sfx)) { s = s.slice(0, s.length - sfx.length); break; }
  }

  // ③ 去头部地名/常见前缀
  const prefixes = [
    '成都市', '天津市', '北京市', '上海市', '广州市', '深圳市',
    '杭州市', '武汉市', '南京市', '重庆市', '西安市',
    '哈尔滨市', '南通市', '昆山市',
    '成都', '天津', '北京', '上海', '广州', '深圳',
    '杭州', '武汉', '南京', '重庆', '西安', '贵州',
    '哈尔滨', '南通', '昆山', '青羊区', '锦江区',
    '画画的',
  ];
  for (const pfx of prefixes) {
    if (s.startsWith(pfx)) { s = s.slice(pfx.length); break; }
  }

  // ④ 去活动/类别标签后缀（-带人原画、-场景 等）
  s = s.replace(/[-_][^-_]{0,10}$/, '');

  return s.trim();
}

/** 生成 n-gram 集合（用于相似度判断） */
function getNgrams(s: string, minLen = 2): Set<string> {
  if (s.length < 2) return new Set();
  const isMainlyLatin = (s.match(/[a-zA-Z0-9]/g) || []).length > s.length * 0.5;
  const effectiveMin = isMainlyLatin ? 4 : minLen;
  const grams = new Set<string>();
  for (let len = effectiveMin; len <= Math.min(s.length, 4); len++) {
    for (let i = 0; i <= s.length - len; i++) {
      grams.add(s.slice(i, i + len));
    }
  }
  return grams;
}

/** 检测输入名称是否与已有名称相似（返回相似的名称列表） */
export function findSimilarNames(
  input: string,
  existingNames: string[],
): string[] {
  const normInput = normalizeSupplierName(input);
  if (normInput.length < 2) return [];
  const gramsInput = getNgrams(normInput);
  if (gramsInput.size === 0) return [];

  return existingNames.filter(name => {
    const normName = normalizeSupplierName(name);
    if (normName.length < 2) return false;
    // 完全一致
    if (normInput === normName) return true;
    // 共享 ngram
    const gramsName = getNgrams(normName);
    for (const g of gramsInput) {
      if (gramsName.has(g)) return true;
    }
    return false;
  });
}

/** 供应商类型徽章样式（颜色 class + 图标），键为中文全称。Grid 卡片与详情页共用，避免两套配色漂移。 */
export const SUPPLIER_TYPE_STYLE: Record<
  SupplierType,
  { color: string; icon: typeof UserIcon }
> = {
  个人画师: { color: 'bg-blue-100 text-blue-700 border-blue-200', icon: UserIcon },
  艺术家: { color: 'bg-purple-100 text-purple-700 border-purple-200', icon: AwardIcon },
  工作室: { color: 'bg-emerald-100 text-emerald-700 border-emerald-200', icon: PaletteIcon },
  公司: { color: 'bg-amber-100 text-amber-700 border-amber-200', icon: Building2Icon },
};
