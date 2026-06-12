import React, { useState, useEffect } from 'react';
import { Checkbox } from '@/components/ui/checkbox';
import { Slider } from '@/components/ui/slider';
import { Input } from '@/components/ui/input';
import { SearchIcon } from 'lucide-react';

export interface IFilterState {
  types: string[];
  cooperationTypes: string[];
  styles: string[];
  priceRange: [number, number];
  status: string[];
  projects: string[];
  keyword: string;
}

const STORAGE_KEY = '__global_supplier_filter';

const typeOptions = [
  { value: 'individual', label: '个人画师' },
  { value: 'artist', label: '艺术家' },
  { value: 'studio', label: '工作室' },
  { value: 'company', label: '公司' },
];

const cooperationOptions = [
  { value: '角色原画', label: '角色原画' },
  { value: '场景原画', label: '场景原画' },
  { value: '平面海报', label: '平面海报' },
  { value: 'UI图标', label: 'UI图标' },
  { value: '视频动效', label: '视频动效' },
  { value: '平面拍摄', label: '平面拍摄' },
  { value: '视频拍摄', label: '视频拍摄' },
  { value: '达人营销', label: '达人营销' },
  { value: '驻场合作', label: '驻场合作' },
];

const styleOptions = [
  { value: 'Q版', label: 'Q版', color: 'bg-amber-100 text-amber-700' },
  { value: '正比', label: '正比', color: 'bg-yellow-100 text-yellow-700' },
  { value: '古风', label: '古风', color: 'bg-red-100 text-red-700' },
  { value: '欧风', label: '欧风', color: 'bg-cyan-100 text-cyan-700' },
  { value: '写实', label: '写实', color: 'bg-blue-100 text-blue-700' },
  { value: '少女风', label: '少女风', color: 'bg-pink-100 text-pink-700' },
  { value: '赛博朋克', label: '赛博朋克', color: 'bg-purple-100 text-purple-700' },
];

const statusOptions = [
  { value: 'in_stock', label: '库内合作', color: 'text-green-600' },
  { value: 'outreach', label: '库外建联', color: 'text-blue-600' },
  { value: 'blacklisted', label: '已拉黑', color: 'text-gray-500' },
];

const projectOptions = [
  { value: '恋与制作人', label: '恋与制作人' },
  { value: '深空', label: '深空' },
  { value: '闪暖', label: '闪暖' },
  { value: '无暖', label: '无暖' },
  { value: '无期迷途', label: '无期迷途' },
  { value: 'IP开发中心', label: 'IP开发中心' },
  { value: '通用', label: '通用' },
];

export default function FilterPanelSection({
  onFilterChange,
  mode = 'sidebar',
}: {
  onFilterChange: (filters: IFilterState) => void;
  mode?: 'sidebar' | 'sheet';
}) {
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
    } catch {
      // ignore
    }
  }, []);

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(filters));
    } catch {
      // ignore
    }
    onFilterChange(filters);
  }, [filters, onFilterChange]);

  const toggleArrayFilter = (key: keyof IFilterState, value: string) => {
    setFilters(prev => {
      const current = prev[key] as string[];
      const updated = current.includes(value)
        ? current.filter(v => v !== value)
        : [...current, value];
      return { ...prev, [key]: updated };
    });
  };

  const handlePriceChange = (value: number[]) => {
    setFilters(prev => ({ ...prev, priceRange: [value[0], value[1]] as [number, number] }));
  };

  const handleKeywordChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setFilters(prev => ({ ...prev, keyword: e.target.value }));
  };

  const clearFilters = () => {
    setFilters({
      types: [],
      cooperationTypes: [],
      styles: [],
      priceRange: [500, 10000],
      status: [],
      projects: [],
      keyword: '',
    });
  };

  const hasActiveFilters =
    filters.types.length > 0 ||
    filters.cooperationTypes.length > 0 ||
    filters.styles.length > 0 ||
    filters.status.length > 0 ||
    filters.projects.length > 0 ||
    filters.keyword !== '' ||
    filters.priceRange[0] !== 500 ||
    filters.priceRange[1] !== 10000;

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

      {/* 关键词搜索 */}
      <div className="mb-6">
        <label className="text-xs font-medium text-muted-foreground mb-2 block">关键词搜索</label>
        <div className="relative">
          <SearchIcon className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            type="search"
            placeholder="搜索名称/备注..."
            value={filters.keyword}
            onChange={handleKeywordChange}
            className="pl-9 h-9 text-sm bg-muted border-transparent focus:border-primary rounded-lg"
          />
        </div>
      </div>

      {/* 供应商类型 */}
      <div className="mb-6">
        <label className="text-xs font-medium text-muted-foreground mb-2 block">供应商类型</label>
        <div className="space-y-2">
          {typeOptions.map(option => (
            <label
              key={option.value}
              className="flex items-center gap-2 cursor-pointer group"
            >
              <Checkbox
                checked={filters.types.includes(option.value)}
                onCheckedChange={() => toggleArrayFilter('types', option.value)}
                className="border-border data-[state=checked]:bg-primary data-[state=checked]:border-primary"
              />
              <span className="text-sm text-foreground group-hover:text-primary transition-colors">
                {option.label}
              </span>
            </label>
          ))}
        </div>
      </div>

      {/* 合作类型 */}
      <div className="mb-6">
        <label className="text-xs font-medium text-muted-foreground mb-2 block">合作类型</label>
        <div className="space-y-2">
          {cooperationOptions.map(option => (
            <label
              key={option.value}
              className="flex items-center gap-2 cursor-pointer group"
            >
              <Checkbox
                checked={filters.cooperationTypes.includes(option.value)}
                onCheckedChange={() => toggleArrayFilter('cooperationTypes', option.value)}
                className="border-border data-[state=checked]:bg-primary data-[state=checked]:border-primary"
              />
              <span className="text-sm text-foreground group-hover:text-primary transition-colors">
                {option.label}
              </span>
            </label>
          ))}
        </div>
      </div>

      {/* 擅长风格 */}
      <div className="mb-6">
        <label className="text-xs font-medium text-muted-foreground mb-2 block">擅长风格</label>
        <div className="flex flex-wrap gap-2">
          {styleOptions.map(option => (
            <button
              key={option.value}
              onClick={() => toggleArrayFilter('styles', option.value)}
              className={`px-2.5 py-1 rounded-full text-xs font-medium transition-all duration-150 ${
                filters.styles.includes(option.value)
                  ? option.color + ' ring-1 ring-offset-1 ring-current'
                  : 'bg-muted text-muted-foreground hover:bg-muted/80'
              }`}
            >
              {option.label}
            </button>
          ))}
        </div>
      </div>

      {/* 报价区间 */}
      <div className="mb-6">
        <label className="text-xs font-medium text-muted-foreground mb-2 block">报价区间</label>
        <div className="px-1">
          <Slider
            value={filters.priceRange}
            onValueChange={handlePriceChange}
            min={500}
            max={10000}
            step={100}
            className="mb-3"
          />
          <div className="flex items-center justify-between text-xs text-muted-foreground">
            <span>{filters.priceRange[0]}元</span>
            <span>{filters.priceRange[1]}元</span>
          </div>
        </div>
      </div>

      {/* 合作状态 */}
      <div className="mb-6">
        <label className="text-xs font-medium text-muted-foreground mb-2 block">合作状态</label>
        <div className="space-y-2">
          {statusOptions.map(option => (
            <label
              key={option.value}
              className="flex items-center gap-2 cursor-pointer group"
            >
              <Checkbox
                checked={filters.status.includes(option.value)}
                onCheckedChange={() => toggleArrayFilter('status', option.value)}
                className="border-border data-[state=checked]:bg-primary data-[state=checked]:border-primary"
              />
              <span className={`text-sm ${option.color} group-hover:opacity-80 transition-opacity`}>
                {option.label}
              </span>
            </label>
          ))}
        </div>
      </div>

      {/* 所属项目 */}
      <div className="mb-6">
        <label className="text-xs font-medium text-muted-foreground mb-2 block">所属项目</label>
        <div className="space-y-2">
          {projectOptions.map(option => (
            <label
              key={option.value}
              className="flex items-center gap-2 cursor-pointer group"
            >
              <Checkbox
                checked={filters.projects.includes(option.value)}
                onCheckedChange={() => toggleArrayFilter('projects', option.value)}
                className="border-border data-[state=checked]:bg-primary data-[state=checked]:border-primary"
              />
              <span className="text-sm text-foreground group-hover:text-primary transition-colors">
                {option.label}
              </span>
            </label>
          ))}
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
