import * as OpenCC from 'opencc-js';

// 繁体（台湾/香港）→ 简体，用于搜索归一化
const toSimplified = OpenCC.Converter({ from: 'tw', to: 'cn' });

/**
 * 将文本统一转换为简体中文后小写，用于繁简不敏感的搜索匹配。
 * 输入简体 → 保持简体；输入繁体 → 转为对应简体；再做包含比较。
 */
export function normalizeForSearch(text: string | null | undefined): string {
  if (!text) return '';
  return toSimplified(text).toLowerCase();
}
