/** 供应商类型推断：名字优先，fallback 到数据库 supplierType 字段 */
export function inferSupplierType(
  name: string,
  supplierType: string | null | undefined,
): 'individual' | 'studio' | 'company' | 'artist' {
  if (name.includes('工作室')) return 'studio';
  if (name.includes('公司') || name.includes('有限') || name.includes('股份')) return 'company';
  switch (supplierType) {
    case '个人': return 'individual';
    case '艺术家': return 'artist';
    case '工作室': return 'studio';
    case '公司':
    case '个体工商户':
    case '一般企业': return 'company';
    default: return 'individual';
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
