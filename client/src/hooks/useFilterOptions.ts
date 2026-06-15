import { useState, useEffect } from 'react';
import {
  DEFAULT_FILTER_CONFIG,
  STORAGE_KEY,
  FilterConfig,
} from '@/lib/filterConfig';

export function useFilterOptions(): FilterConfig {
  const [config, setConfig] = useState<FilterConfig>(DEFAULT_FILTER_CONFIG);

  useEffect(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) {
        const parsed = JSON.parse(saved);
        // 合并：以 localStorage 为准，对缺失的 key 回退默认值
        setConfig({
          supplierType: parsed.supplierType || DEFAULT_FILTER_CONFIG.supplierType,
          cooperationType: parsed.cooperationType || DEFAULT_FILTER_CONFIG.cooperationType,
          style: parsed.style || DEFAULT_FILTER_CONFIG.style,
          cooperationStatus: parsed.cooperationStatus || DEFAULT_FILTER_CONFIG.cooperationStatus,
          project: parsed.project || DEFAULT_FILTER_CONFIG.project,
        });
      }
    } catch {
      // 解析失败，使用默认值
    }
  }, []);

  return config;
}

export { type FilterConfig, type FilterOption } from '@/lib/filterConfig';