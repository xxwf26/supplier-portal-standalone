import React, { useState, useEffect } from 'react';
import { Checkbox } from '@/components/ui/checkbox';
import { Slider } from '@/components/ui/slider';
import { useFilterOptions } from '@/hooks/useFilterOptions';
import { useAuth } from '@/lib/auth';
import { cn } from '@/lib/utils';

export interface IFilterState {
  types: string[];
  cooperationTypes: string[];
  styles: string[];
  priceRange: [number, number];
  priceUnset: boolean;
  ratings: string[];
  status: string[];
  projects: string[];
  keyword: string;
}

export const STORAGE_KEY = '__global_supplier_filter';

// 分区：标题带左侧强调色条，统一间距
function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <div className="flex items-center gap-1.5 mb-2.5">
        <span className="w-1 h-3 rounded-full bg-primary/60" />
        <span className="text-xs font-semibold text-foreground/80 tracking-wide">{title}</span>
      </div>
      {children}
    </div>
  );
}

// 复选行：整行可点击，带 hover 背景
function CheckRow({
  checked,
  onToggle,
  label,
  muted = false,
  labelClassName,
}: {
  checked: boolean;
  onToggle: () => void;
  label: string;
  muted?: boolean;
  labelClassName?: string;
}) {
  return (
    <label className="flex items-center gap-2.5 px-2 py-1.5 -mx-2 rounded-md cursor-pointer hover:bg-muted/60 transition-colors group">
      <Checkbox
        checked={checked}
        onCheckedChange={onToggle}
        className="border-border data-[state=checked]:bg-primary data-[state=checked]:border-primary"
      />
      <span
        className={cn(
          'text-sm transition-colors',
          labelClassName || (muted ? 'text-muted-foreground' : 'text-foreground'),
          'group-hover:text-primary'
        )}
      >
        {label}
      </span>
    </label>
  );
}

// 风格标签 Pill
function Pill({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      className={cn(
        'px-2.5 py-1 rounded-full text-xs font-medium transition-all duration-150',
        active
          ? 'bg-primary/10 text-primary ring-1 ring-primary/30'
          : 'bg-muted text-muted-foreground hover:bg-muted/80'
      )}
    >
      {children}
    </button>
  );
}

export default function FilterPanelSection({
  onFilterChange,
  mode = 'sidebar',
}: {
  onFilterChange: (filters: IFilterState) => void;
  mode?: 'sidebar' | 'sheet';
}) {
  const filterConfig = useFilterOptions();
  const { isAdmin } = useAuth();

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
    priceRange: [0, 10000],
    priceUnset: false,
    ratings: [],
    status: [],
    projects: [],
    keyword: '',
  });

  useEffect(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) {
        const parsed = JSON.parse(saved);
        // 迁移：旧价格区间默认值
        if (parsed.priceRange?.[0] === 500 && parsed.priceRange?.[1] === 10000) {
          parsed.priceRange = [0, 10000];
        }
        // 迁移：供应商类型从英文 code 改为中文全称（fix/supplier-type-unification）
        const typeMap: Record<string, string> = {
          individual: '个人画师', artist: '艺术家', studio: '工作室', company: '公司',
        };
        if (Array.isArray(parsed.types)) {
          parsed.types = parsed.types.map((t: string) => typeMap[t] ?? t);
        }
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
    setFilters({ types: [], cooperationTypes: [], styles: [], priceRange: [0, 10000], priceUnset: false, ratings: [], status: [], projects: [], keyword: '' });
  };

  const hasActiveFilters = filters.types.length > 0 || filters.cooperationTypes.length > 0 ||
    filters.styles.length > 0 || filters.status.length > 0 || filters.projects.length > 0 ||
    filters.ratings.length > 0 ||
    filters.keyword !== '' || filters.priceRange[0] !== 0 || filters.priceRange[1] !== 10000 || filters.priceUnset;

  const activeFilterCount =
    filters.types.length +
    filters.cooperationTypes.length +
    filters.styles.length +
    filters.status.length +
    filters.projects.length +
    filters.ratings.length +
    (filters.keyword !== '' ? 1 : 0) +
    (filters.priceRange[0] !== 0 || filters.priceRange[1] !== 10000 || filters.priceUnset ? 1 : 0);

  const content = (
    <>
      {/* 头部：标题 + 已选数量 + 清空 */}
      <div className="flex items-center gap-2 mb-5">
        <h2 className="text-sm font-semibold text-foreground">筛选条件</h2>
        {activeFilterCount > 0 && (
          <span className="inline-flex items-center justify-center min-w-[18px] h-[18px] px-1 rounded-full bg-primary text-primary-foreground text-[10px] font-bold leading-none">
            {activeFilterCount}
          </span>
        )}
        {hasActiveFilters && (
          <button
            onClick={clearFilters}
            className="ml-auto text-xs text-primary hover:text-primary/80 transition-colors"
          >
            清空
          </button>
        )}
      </div>

      <div className="space-y-5">
        {/* 供应商类型 */}
        <Section title="供应商类型">
          <div className="space-y-0.5">
            {typeOptions.map(option => (
              <CheckRow
                key={option.value}
                checked={filters.types.includes(option.value)}
                onToggle={() => toggleArrayFilter('types', option.value)}
                label={option.label}
              />
            ))}
          </div>
        </Section>

        {/* 合作类型 */}
        <Section title="合作类型">
          <div className="space-y-0.5">
            {cooperationOptions.map(option => (
              <CheckRow
                key={option.value}
                checked={filters.cooperationTypes.includes(option.value)}
                onToggle={() => toggleArrayFilter('cooperationTypes', option.value)}
                label={option.label}
              />
            ))}
            <CheckRow
              checked={filters.cooperationTypes.includes('__unset__')}
              onToggle={() => toggleArrayFilter('cooperationTypes', '__unset__')}
              label="未填写"
              muted
            />
          </div>
        </Section>

        {/* 擅长风格 */}
        <Section title="擅长风格">
          <div className="flex flex-wrap gap-1.5">
            {styleOptions.map(option => (
              <Pill
                key={option.value}
                active={filters.styles.includes(option.value)}
                onClick={() => toggleArrayFilter('styles', option.value)}
              >
                {option.label}
              </Pill>
            ))}
            <Pill
              active={filters.styles.includes('__unset__')}
              onClick={() => toggleArrayFilter('styles', '__unset__')}
            >
              未填写
            </Pill>
          </div>
        </Section>

        {/* 报价区间 */}
        <Section title="报价区间">
          <div className="px-1 pt-1">
            <div className="flex items-center justify-between mb-2.5 text-xs">
              <span className="font-medium text-foreground tabular-nums">{filters.priceRange[0]}</span>
              <span className="text-muted-foreground">—</span>
              <span className="font-medium text-foreground tabular-nums">
                {filters.priceRange[1]}{filters.priceRange[1] >= 10000 ? '+' : ''} 元
              </span>
            </div>
            <Slider value={filters.priceRange} onValueChange={handlePriceChange} min={0} max={10000} step={100} />
            <CheckRow
              checked={filters.priceUnset}
              onToggle={() => setFilters(prev => ({ ...prev, priceUnset: !prev.priceUnset }))}
              label="未填写报价"
              muted
            />
          </div>
        </Section>

        {/* 评分 */}
        <Section title="评分">
          <div className="flex flex-wrap gap-1.5">
            {['5', '4', '3', '2', '1'].map((r) => (
              <Pill
                key={r}
                active={filters.ratings.includes(r)}
                onClick={() => toggleArrayFilter('ratings', r)}
              >
                {r}★
              </Pill>
            ))}
            <Pill
              active={filters.ratings.includes('__unset__')}
              onClick={() => toggleArrayFilter('ratings', '__unset__')}
            >
              未评分
            </Pill>
          </div>
        </Section>

        {/* 合作状态 — 仅管理员可见 */}
        {isAdmin && (
        <Section title="合作状态">
          <div className="space-y-0.5">
            {statusOptions.map(option => (
              <CheckRow
                key={option.value}
                checked={filters.status.includes(option.value)}
                onToggle={() => toggleArrayFilter('status', option.value)}
                label={option.label}
                labelClassName={option.color}
              />
            ))}
          </div>
        </Section>
        )}

        {/* 所属项目 */}
        <Section title="所属项目">
          <div className="space-y-0.5">
            {projectOptions.map(option => (
              <CheckRow
                key={option.value}
                checked={filters.projects.includes(option.value)}
                onToggle={() => toggleArrayFilter('projects', option.value)}
                label={option.label}
              />
            ))}
            <CheckRow
              checked={filters.projects.includes('__unset__')}
              onToggle={() => toggleArrayFilter('projects', '__unset__')}
              label="未填写"
              muted
            />
          </div>
        </Section>
      </div>
    </>
  );

  if (mode === 'sheet') {
    return <div className="px-1 py-2">{content}</div>;
  }

  return (
    <aside className="w-[260px] flex-shrink-0 bg-card border-r border-border px-4 py-5 overflow-y-auto sticky top-0 h-[calc(100vh-64px)]">
      {content}
    </aside>
  );
}