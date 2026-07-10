import * as OpenCC from 'opencc-js';
import { pinyin } from 'pinyin-pro';

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

/**
 * 生成用于拼音搜索的索引串：把中文名转成「全拼 + 首字母」两段小写字符串。
 * 例："李彦峰" → "liyanfeng lyf"；输入 `liyanfeng`（全拼）或 `lyf`（首字母）均可命中。
 * 非中文字符会被 pinyin-pro 原样保留（nonZh:'consecutive'），故英文名也不受影响。
 */
export function toPinyin(text: string | null | undefined): string {
  if (!text) return '';
  try {
    const full = pinyin(text, { toneType: 'none', type: 'array', nonZh: 'consecutive' }).join('');
    const first = pinyin(text, { pattern: 'first', toneType: 'none', type: 'array', nonZh: 'consecutive' }).join('');
    return `${full} ${first}`.toLowerCase();
  } catch {
    return '';
  }
}

