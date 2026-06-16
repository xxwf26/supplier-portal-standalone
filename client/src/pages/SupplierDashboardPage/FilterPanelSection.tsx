import React, { useState, useEffect } from 'react';
import { Checkbox } from '@/components/ui/checkbox';
import { Slider } from '@/components/ui/slider';
import { useFilterOptions } from '@/hooks/useFilterOptions';

export interface IFilterState {
  types: string[];
  cooperationTypes: string[];
  styles: string[];
  priceRange: [number, number];
  status: string[];
  projects: string[];
  keyword: string;
}

export const STORAGE_KEY = '__global_supplier_filter';

export default function FilterPanelSection({
  onFilterChange,
  mode = 'sidebar',
}: {
  onFilterChange: (filters: IFilterState) => void;
  mode?: 'sidebar' | 'sheet';
}) {
  const filterConfig = useFilterOptions();

  // 从 hook 动态获取选项
  const typeOptions = filterConfig.supplierType.map((o) => ({ value: o.value, label: o.label }));
  const cooperationOptions = filterConfig.cooperationType.map((o) => ({ value: o.value, label: o.label }));
  const styleOptions = filterConfig.style.map((o) => ({
    value: o.value,
    label: o.label,
    color: o.color ? `text-${o.color}-600` : 'text-muted-foreground',
  }));
  const statusOptions = filterConfig.cooperationStatus.map((o) => ({
    value: o.value,
    label: o.label,
    color: o.color || 'text-muted-foreground',
  }));
  const projectOptions = filterConfig.project.map((o) => ({ value: o.value, label: o.label }));
  const [filters, setFilters] = useState<IFilterState>({
    types: [],
    cooperationTypes: [],
    styles: [],
    priceRange: [500, 10000],
    status: [],
    projects: [],
    keyword: '',
  });

  useEffect(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) {
        const parsed = JSON.parse(saved);
        setFilters(prev => ({ ...prev, ...parsed }));
      }
    } catch { /* ignore */ }
  }, []);

  useEffect(() => {
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(filters)); } catch {}
    onFilterChange(filters);
  }, [filters, onFilterChange]);

  const toggleArrayFilter = (key: keyof IFilterState, value: string) => {
    setFilters(prev => {
      const current = prev[key] as string[];
      const updated = current.includes(value) ? current.filter(v => v !== value) : [...current, value];
      return { ...prev, [key]: updated };
    });
  };

  const handlePriceChange = (value: number[]) => {
    setFilters(prev => ({ ...prev, priceRange: [value[0], value[1]] as [number, number] }));
  };

  const clearFilters = () => {
    setFilters({ types: [], cooperationTypes: [], styles: [], priceRange: [500, 10000], status: [], projects: [], keyword: '' });
  };

  const hasActiveFilters = filters.types.length > 0 || filters.cooperationTypes.length > 0 ||
    filters.styles.length > 0 || filters.status.length > 0 || filters.projects.length > 0 ||
    filters.keyword !== '' || filters.priceRange[0] !== 500 || filters.priceRange[1] !== 10000;

  const activeFilterCount =
    filters.types.length +
    filters.cooperationTypes.length +
    filters.styles.length +
    filters.status.length +
    filters.projects.length +
    (filters.keyword !== '' ? 1 : 0) +
    (filters.priceRange[0] !== 500 || filters.priceRange[1] !== 10000 ? 1 : 0);

  const content = (
    <>
      <div className="flex items-center justify-between mb-4">
        {mode === 'sidebar' && <h2 className="text-sm font-semibold text-foreground">筛选条件</h2>}
        {hasActiveFilters && (
          <button
            onClick={clearFilters}
            className="text-xs text-primary hover:text-primary/80 transition-colors ml-auto"
          >
            清空筛选
          </button>
        )}
      </div>

      {/* 供应商类型 */}
      <div className="mb-6">
        <label className="text-xs font-medium text-muted-foreground mb-2 block">供应商类型</label>
        <div className="space-y-2">
          {typeOptions.map(option => (
            <label key={option.value} className="flex items-center gap-2 cursor-pointer group">
              <Checkbox checked={filters.types.includes(option.value)} onCheckedChange={() => toggleArrayFilter('types', option.value)}
                className="border-border data-[state=checked]:bg-primary data-[state=checked]:border-primary" />
              <span className="text-sm text-foreground group-hover:text-primary transition-colors">{option.label}</span>
            </label>
          ))}
        </div>
      </div>

      {/* 合作类型 */}
      <div className="mb-6">
        <label className="text-xs font-medium text-muted-foreground mb-2 block">合作类型</label>
        <div className="space-y-2">
          {cooperationOptions.map(option => (
            <label key={option.value} className="flex items-center gap-2 cursor-pointer group">
              <Checkbox checked={filters.cooperationTypes.includes(option.value)} onCheckedChange={() => toggleArrayFilter('cooperationTypes', option.value)}
                className="border-border data-[state=checked]:bg-primary data-[state=checked]:border-primary" />
              <span className="text-sm text-foreground group-hover:text-primary transition-colors">{option.label}</span>
            </label>
          ))}
          <label className="flex items-center gap-2 cursor-pointer group">
            <Checkbox checked={filters.cooperationTypes.includes('__unset__')} onCheckedChange={() => toggleArrayFilter('cooperationTypes', '__unset__')}
              className="border-border data-[state=checked]:bg-primary data-[state=checked]:border-primary" />
            <span className="text-sm text-muted-foreground group-hover:text-primary transition-colors">未填写</span>
          </label>
        </div>
      </div>

      {/* 细分风格 */}
      <div className="mb-6">
        <label className="text-xs font-medium text-muted-foreground mb-2 block">细分风格</label>
        <div className="flex flex-wrap gap-2">
          {styleOptions.map(option => (
            <button key={option.value} onClick={() => toggleArrayFilter('styles', option.value)}
              className={`px-2.5 py-1 rounded-full text-xs font-medium transition-all duration-150 ${
                filters.styles.includes(option.value)
                  ? `bg-primary/10 text-primary ring-1 ring-primary/30`
                  : 'bg-muted text-muted-foreground hover:bg-muted/80'
              }`} >
              {option.label}
            </button>
          ))}
          <button onClick={() => toggleArrayFilter('styles', '__unset__')}
            className={`px-2.5 py-1 rounded-full text-xs font-medium transition-all duration-150 ${
              filters.styles.includes('__unset__')
                ? 'bg-primary/10 text-primary ring-1 ring-primary/30'
                : 'bg-muted text-muted-foreground hover:bg-muted/80'
            }`}>
            未填写
          </button>
        </div>
      </div>

      {/* 报价区间 */}
      <div className="mb-6">
        <label className="text-xs font-medium text-muted-foreground mb-2 block">报价区间</label>
        <div className="px-1">
          <Slider value={filters.priceRange} onValueChange={handlePriceChange} min={500} max={10000} step={100} className="mb-3" />
          <div className="flex items-center justify-between text-xs text-muted-foreground">
            <span>{filters.priceRange[0]}元</span><span>{filters.priceRange[1]}元</span>
          </div>
        </div>
      </div>

      {/* 合作状态 */}
      <div className="mb-6">
        <label className="text-xs font-medium text-muted-foreground mb-2 block">合作状态</label>
        <div className="space-y-2">
          {statusOptions.map(option => (
            <label key={option.value} className="flex items-center gap-2 cursor-pointer group">
              <Checkbox checked={filters.status.includes(option.value)} onCheckedChange={() => toggleArrayFilter('status', option.value)}
                className="border-border data-[state=checked]:bg-primary data-[state=checked]:border-primary" />
              <span className={`text-sm ${option.color} group-hover:opacity-80 transition-opacity`}>{option.label}</span>
            </label>
          ))}
        </div>
      </div>

      {/* 所属项目 */}
      <div className="mb-6">
        <label className="text-xs font-medium text-muted-foreground mb-2 block">所属项目</label>
        <div className="space-y-2">
          {projectOptions.map(option => (
            <label key={option.value} className="flex items-center gap-2 cursor-pointer group">
              <Checkbox checked={filters.projects.includes(option.value)} onCheckedChange={() => toggleArrayFilter('projects', option.value)}
                className="border-border data-[state=checked]:bg-primary data-[state=checked]:border-primary" />
              <span className="text-sm text-foreground group-hover:text-primary transition-colors">{option.label}</span>
            </label>
          ))}
          <label className="flex items-center gap-2 cursor-pointer group">
            <Checkbox checked={filters.projects.includes('__unset__')} onCheckedChange={() => toggleArrayFilter('projects', '__unset__')}
              className="border-border data-[state=checked]:bg-primary data-[state=checked]:border-primary" />
            <span className="text-sm text-muted-foreground group-hover:text-primary transition-colors">未填写</span>
          </label>
        </div>
      </div>
    </>
  );

  if (mode === 'sheet') {
    return <div className="px-1 py-2">{content}</div>;
  }

  return (
    <aside className="w-[280px] flex-shrink-0 bg-card border-r border-border p-4 overflow-y-auto sticky top-0 h-[calc(100vh-64px)]">
      {content}
    </aside>
  );
}