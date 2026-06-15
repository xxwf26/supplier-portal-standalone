import { useState, useEffect } from 'react';
import { configApi, IFilterOption } from '@/api/config';

interface FilterConfig {
  supplierType: IFilterOption[];
  category: IFilterOption[];
  style: IFilterOption[];
  nature: IFilterOption[];
  linkStatus: IFilterOption[];
  risk: IFilterOption[];
}

const emptyConfig: FilterConfig = {
  supplierType: [], category: [], style: [], nature: [], linkStatus: [], risk: [],
};

export function useFilterConfig(): { config: FilterConfig; loading: boolean } {
  const [config, setConfig] = useState<FilterConfig>(emptyConfig);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    configApi.getAll().then(data => {
      setConfig({
        supplierType: data.supplierType || [],
        category: data.category || [],
        style: data.style || [],
        nature: data.nature || [],
        linkStatus: data.linkStatus || [],
        risk: data.risk || [],
      });
    }).catch(() => {}).finally(() => setLoading(false));
  }, []);

  return { config, loading };
}