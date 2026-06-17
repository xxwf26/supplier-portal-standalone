import { useState, useEffect } from 'react';
import {
  DEFAULT_FILTER_CONFIG,
  FilterConfig,
  FilterOption,
} from '@/lib/filterConfig';
import { configApi, IFilterOption } from '@/api/config';

const CATEGORIES: (keyof FilterConfig)[] = [
  'supplierType',
  'cooperationType',
  'style',
  'cooperationStatus',
  'project',
];

/** 把后端 IFilterOption[] 映射为前端 FilterOption[]（只取启用项） */
function mapOptions(rows: IFilterOption[] | undefined): FilterOption[] {
  if (!rows || rows.length === 0) return [];
  return rows
    .filter((r) => r.enabled !== false)
    .map((r) => ({
      label: r.label,
      value: r.value,
      ...(r.color ? { color: r.color } : {}),
    }));
}

/**
 * 全站筛选/字段选项的唯一数据源：读数据库 filter_config（/api/config/filters）。
 * 加载中或请求失败时回退到 DEFAULT_FILTER_CONFIG，保证应用始终可用。
 */
export function useFilterOptions(): FilterConfig {
  const [config, setConfig] = useState<FilterConfig>(DEFAULT_FILTER_CONFIG);

  useEffect(() => {
    let cancelled = false;
    configApi
      .getAll()
      .then((grouped) => {
        if (cancelled) return;
        const next = {} as FilterConfig;
        for (const cat of CATEGORIES) {
          const mapped = mapOptions(grouped[cat]);
          // 某分类后端为空则回退该分类默认值，避免下拉/筛选空白
          next[cat] = mapped.length > 0 ? mapped : DEFAULT_FILTER_CONFIG[cat];
        }
        setConfig(next);
      })
      .catch(() => {
        // 表未建 / 接口异常：保持默认值
      });
    return () => {
      cancelled = true;
    };
  }, []);

  return config;
}

export { type FilterConfig, type FilterOption } from '@/lib/filterConfig';
