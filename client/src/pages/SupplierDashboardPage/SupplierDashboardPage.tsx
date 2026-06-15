import React, { useState, useEffect, useCallback, useMemo, lazy, Suspense } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { PlusIcon, UploadIcon, DownloadIcon, CopyIcon, CheckIcon, XIcon, FilterIcon, HistoryIcon, SearchIcon, ArrowUpDownIcon, ArrowUpToLineIcon, SearchXIcon } from 'lucide-react';
import { toast } from 'sonner';
import HeaderSection from './HeaderSection';
import FilterPanelSection, { IFilterState, STORAGE_KEY } from './FilterPanelSection';
import SupplierGridSection, { IProcessedSupplier } from './SupplierGridSection';
import SupplierDetailModal from './SupplierDetailModal';
import { supplierApi } from '@/api/supplier';
import { ISupplier } from '@/api/types';
import { logger } from '@/lib/polyfills/logger';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import { useAuth } from '@/lib/auth';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import HistoryPanel from './HistoryPanel';
import { inferSupplierType } from '@/lib/supplierUtils';
import { normalizeForSearch } from '@/lib/chineseNormalize';

type SortKey = 'default' | 'ratingDesc' | 'ratingAsc' | 'countDesc' | 'countAsc' | 'recent';

const SORT_OPTIONS: { value: SortKey; label: string }[] = [
  { value: 'default', label: '默认排序' },
  { value: 'ratingDesc', label: '评分从高到低' },
  { value: 'ratingAsc', label: '评分从低到高' },
  { value: 'countDesc', label: '合作频次从高到低' },
  { value: 'countAsc', label: '合作频次从低到高' },
  { value: 'recent', label: '最近更新' },
];

// Lazy-load heavy components
const ExcelImportModal = lazy(() => import('./ExcelImportModal'));
const NewSupplierModal = lazy(() => import('./NewSupplierModal'));

function getInitialViewMode(): 'pc' | 'mobile' {
  const saved = localStorage.getItem('__view_mode');
  if (saved === 'pc' || saved === 'mobile') return saved;
  return window.innerWidth < 768 ? 'mobile' : 'pc';
}

// 转换API数据到前端格式
function processSupplier(raw: ISupplier): IProcessedSupplier {
  const type = inferSupplierType(raw.accountName || '', raw.supplierType);

  const styles: string[] = [];
  if (raw.subCategory) {
    const split = raw.subCategory.split(/[\/、，]/).map((s) => s.trim()).filter(Boolean);
    styles.push(...split);
  }

  const cooperationTypes: string[] = [];
  if (raw.cooperationType && typeof raw.cooperationType === 'string') {
    const split = raw.cooperationType.split(/[\/、，]/).map((s) => s.trim()).filter(Boolean);
    cooperationTypes.push(...split);
  }

  let priceRange: [number, number] = [0, 0];
  let hasPrice = false;
  const priceItems = raw.priceItems || [];
  if (priceItems.length > 0) {
    const prices = priceItems.map((p) => p.unitPrice).filter((p) => p > 0);
    if (prices.length > 0) {
      priceRange = [Math.min(...prices), Math.max(...prices)];
      hasPrice = true;
    }
  } else if (raw.priceRange && typeof raw.priceRange === 'string') {
    const numbers = raw.priceRange.split(/[~-]/).map((n) => parseFloat(n.trim())).filter((n) => !isNaN(n));
    if (numbers.length === 2) {
      priceRange = [numbers[0], numbers[1]] as [number, number];
      hasPrice = true;
    } else if (numbers.length === 1) {
      priceRange = [numbers[0], numbers[0]];
      hasPrice = true;
    }
  }

  let status: 'in_stock' | 'outreach' | 'blacklisted';
  if (raw.riskStatus === '拉黑') {
    status = 'blacklisted';
  } else if (raw.isInStock) {
    status = 'in_stock';
  } else {
    status = 'outreach';
  }

  const project: string[] = [];
  if (raw.entityType) {
    project.push(raw.entityType);
  }
  if (raw.contractEntity && !project.includes(raw.contractEntity)) {
    project.push(raw.contractEntity);
  }

  const links: Record<string, string> = {};
  Object.entries(raw.socialLinks || {}).forEach(([key, url]) => {
    if (url) links[key] = url;
  });
  Object.entries(raw.manualLinks || {}).forEach(([key, url]) => {
    if (url) links[key] = url;
  });

  let contacts: { wechat?: string; email?: string } | undefined;
  if (raw.contactInfo) {
    const wechatMatch = raw.contactInfo.match(/微信[:：]?\s*([^\s]+)/);
    const emailMatch = raw.contactInfo.match(/邮箱[:：]?\s*([^\s]+)/);
    contacts = {};
    if (wechatMatch) contacts.wechat = wechatMatch[1];
    if (emailMatch) contacts.email = emailMatch[1];
  }

  const contactItems = raw.contactItems || [];

  return {
    id: raw.id,
    name: raw.accountName,
    type,
    styles,
    cooperationTypes,
    priceRange,
    priceUnit: '元',
    priceText: raw.priceRange,
    priceItems,
    contactItems,
    status,
    project,
    contacts,
    links,
    notes: raw.contactInfo,
    works: raw.artworkUrls,
    history: [],
    rating: raw.rating,
    cooperationCount: raw.cooperationCount,
    riskStatus: raw.riskStatus,
    cooperationCategory: raw.cooperationCategory,
    updatedAt: raw.updatedAt,
  };
}

export default function SupplierDashboardPage() {
  const [selectedSupplier, setSelectedSupplier] = useState<IProcessedSupplier | null>(null);
  const [selectedRawSupplier, setSelectedRawSupplier] = useState<ISupplier | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isImportOpen, setIsImportOpen] = useState(false);
  const [isNewOpen, setIsNewOpen] = useState(false);
  const [rawSuppliers, setRawSuppliers] = useState<ISupplier[]>([]);
  const [loading, setLoading] = useState(true);
  const [currentFilters, setCurrentFilters] = useState<IFilterState | null>(null);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [viewMode, setViewMode] = useState<'pc' | 'mobile'>(getInitialViewMode);
  const [isMobileFilterOpen, setIsMobileFilterOpen] = useState(false);
  const [isHistoryOpen, setIsHistoryOpen] = useState(false);
  const [keyword, setKeyword] = useState('');
  const [sortKey, setSortKey] = useState<SortKey>('default');
  const [showBackToTop, setShowBackToTop] = useState(false);
  const [filterResetKey, setFilterResetKey] = useState(0);

  const { isAdmin } = useAuth();

  const toggleViewMode = useCallback(() => {
    setViewMode(prev => {
      const next = prev === 'pc' ? 'mobile' : 'pc';
      localStorage.setItem('__view_mode', next);
      return next;
    });
  }, []);

  const activeFilterCount = useMemo(() => {
    if (!currentFilters) return 0;
    return (
      currentFilters.types.length +
      currentFilters.cooperationTypes.length +
      currentFilters.styles.length +
      currentFilters.status.length +
      currentFilters.projects.length +
      (currentFilters.priceRange[0] !== 500 || currentFilters.priceRange[1] !== 10000 ? 1 : 0)
    );
  }, [currentFilters]);

  const processedSuppliers = useMemo(() => {
    if (!Array.isArray(rawSuppliers)) return [];
    return rawSuppliers.map(processSupplier);
  }, [rawSuppliers]);

  const filteredSuppliers = useMemo(() => {
    if (!currentFilters) return processedSuppliers;

    let result = processedSuppliers;

    if (currentFilters.types.length > 0) {
      result = result.filter((s) => currentFilters.types.includes(s.type));
    }
    if (currentFilters.status.length > 0) {
      result = result.filter((s) => currentFilters.status.includes(s.status));
    }
    if (currentFilters.styles.length > 0) {
      result = result.filter((s) => s.styles.some((st) => currentFilters.styles.includes(st)));
    }
    if (currentFilters.cooperationTypes.length > 0) {
      result = result.filter((s) =>
        s.cooperationTypes.some((ct) => currentFilters.cooperationTypes.includes(ct))
      );
    }
    if (currentFilters.projects.length > 0) {
      result = result.filter((s) => s.project.some((p) => currentFilters.projects.includes(p)));
    }

    result = result.filter(
      (s) =>
        (s.priceRange[0] === 0 && s.priceRange[1] === 0) || // 无报价数据不过滤
        (s.priceRange[0] >= currentFilters.priceRange[0] &&
         s.priceRange[1] <= currentFilters.priceRange[1])
    );

    return result;
  }, [processedSuppliers, currentFilters]);

  // 关键词搜索（来自吸顶工具条）+ 排序，得到最终展示列表
  const displaySuppliers = useMemo(() => {
    let result = filteredSuppliers;

    const kw = normalizeForSearch(keyword.trim());
    if (kw) {
      result = result.filter(
        (s) =>
          normalizeForSearch(s.name).includes(kw) ||
          (s.notes && normalizeForSearch(s.notes).includes(kw))
      );
    }

    if (sortKey !== 'default') {
      const sorted = [...result];
      switch (sortKey) {
        case 'ratingDesc':
          sorted.sort((a, b) => (b.rating ?? -1) - (a.rating ?? -1));
          break;
        case 'ratingAsc':
          // 无评分排最后
          sorted.sort((a, b) => (a.rating ?? Infinity) - (b.rating ?? Infinity));
          break;
        case 'countDesc':
          sorted.sort((a, b) => b.cooperationCount - a.cooperationCount);
          break;
        case 'countAsc':
          sorted.sort((a, b) => a.cooperationCount - b.cooperationCount);
          break;
        case 'recent':
          sorted.sort(
            (a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()
          );
          break;
      }
      result = sorted;
    }

    return result;
  }, [filteredSuppliers, keyword, sortKey]);

  const fetchSuppliers = useCallback(async () => {
    setLoading(true);
    try {
      const response = await supplierApi.getList();
      setRawSuppliers(response.list);
    } catch (error) {
      logger.error('Failed to fetch suppliers:', String(error));
    } finally {
      setLoading(false);
    }
  }, []);

  const handleSupplierSelect = useCallback((supplier: IProcessedSupplier) => {
    const raw = rawSuppliers.find((r) => r.id === supplier.id);
    setSelectedRawSupplier(raw || null);
    setSelectedSupplier(supplier);
    setIsModalOpen(true);
  }, [rawSuppliers]);

  const handleCloseModal = useCallback(() => {
    setIsModalOpen(false);
    setTimeout(() => {
      setSelectedSupplier(null);
      setSelectedRawSupplier(null);
    }, 200);
  }, []);

  const handleSave = useCallback(() => {
    fetchSuppliers();
  }, [fetchSuppliers]);

  const handleFilterChange = useCallback((filters: IFilterState) => {
    setCurrentFilters(filters);
  }, []);

  const handleToggleSelect = useCallback((id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  }, []);

  const handleSelectAll = useCallback(() => {
    const allIds = displaySuppliers.map((s) => s.id);
    setSelectedIds(new Set(allIds));
  }, [displaySuppliers]);

  const handleClearSelection = useCallback(() => {
    setSelectedIds(new Set());
  }, []);

  const selectedSuppliers = useMemo(() => {
    return displaySuppliers.filter((s) => selectedIds.has(s.id));
  }, [displaySuppliers, selectedIds]);

  const [isExporting, setIsExporting] = useState(false);

  const handleExportPdf = useCallback(async () => {
    if (selectedSuppliers.length === 0 || isExporting) return;
    setIsExporting(true);
    const toastId = toast.loading(`正在生成 PDF（0/${selectedSuppliers.length}）…`);
    try {
      const { exportSuppliersToPdf } = await import('./exportSupplierPdf');
      await exportSuppliersToPdf(selectedSuppliers, {
        onProgress: (current, total) => {
          toast.loading(`正在生成 PDF（${current}/${total}）…`, { id: toastId });
        },
      });
      toast.success(`已导出 ${selectedSuppliers.length} 位画师档案`, { id: toastId });
    } catch (err) {
      logger.error('PDF export failed:', String(err));
      toast.error('导出失败，请重试', { id: toastId });
    } finally {
      setIsExporting(false);
    }
  }, [selectedSuppliers, isExporting]);

  const handleCopyToClipboard = useCallback(async () => {
    if (selectedSuppliers.length === 0) return;

    const statusLabelMap: Record<string, string> = {
      in_stock: '库内合作', outreach: '库外建联', blacklisted: '已拉黑',
    };

    const lines = selectedSuppliers.map((s, i) => {
      const parts = [
        `${i + 1}. ${s.name}`,
        `类型: ${s.type === 'individual' ? '个人画师' : s.type === 'artist' ? '艺术家' : s.type === 'studio' ? '工作室' : '公司'}`,
        `状态: ${statusLabelMap[s.status] || s.status}`,
        s.styles.length > 0 ? `风格: ${s.styles.join('、')}` : '',
        s.cooperationTypes.length > 0 ? `合作: ${s.cooperationTypes.join('、')}` : '',
        s.priceItems && s.priceItems.length > 0
          ? `报价: ${s.priceItems.map((p) => `${p.cooperationType} ${p.unitPrice}${p.priceUnit}`).join(' | ')}`
          : '',
        s.rating != null ? `评分: ${s.rating}分` : '',
        `频次: ${s.cooperationCount}`,
      ].filter(Boolean);
      return parts.join(' | ');
    });

    const text = lines.join('\n');
    try {
      await navigator.clipboard.writeText(text);
      toast.success(`已复制 ${selectedSuppliers.length} 位画师信息`);
    } catch {
      toast.error('复制失败，请手动复制');
    }
  }, [selectedSuppliers]);

  useEffect(() => {
    fetchSuppliers();
  }, [fetchSuppliers]);

  // 滚动超过一屏时显示「回到顶部」按钮
  useEffect(() => {
    const onScroll = () => setShowBackToTop(window.scrollY > window.innerHeight * 0.6);
    window.addEventListener('scroll', onScroll, { passive: true });
    onScroll();
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  const scrollToTop = useCallback(() => {
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }, []);

  const clearAllFilters = useCallback(() => {
    setKeyword('');
    setSortKey('default');
    try { localStorage.removeItem(STORAGE_KEY); } catch { /* ignore */ }
    // 触发 FilterPanelSection 重新挂载以清空其内部筛选状态
    setFilterResetKey((k) => k + 1);
  }, []);

  const hasAnyCondition = keyword.trim() !== '' || activeFilterCount > 0;

  // 关键词搜索框 + 排序下拉（吸顶工具条内复用）
  const searchAndSort = (
    <>
      <div className="relative flex-1 min-w-[160px] max-w-xs">
        <SearchIcon className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
        <Input
          type="search"
          placeholder="搜索名称 / 备注…"
          value={keyword}
          onChange={(e) => setKeyword(e.target.value)}
          className="pl-9 h-9 text-sm"
        />
      </div>
      <Select value={sortKey} onValueChange={(v) => setSortKey(v as SortKey)}>
        <SelectTrigger className="h-9 w-[150px] text-sm gap-1">
          <ArrowUpDownIcon className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {SORT_OPTIONS.map((o) => (
            <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
          ))}
        </SelectContent>
      </Select>
    </>
  );

  // 空状态（筛选/搜索后无结果）
  const emptyState = (
    <div className="flex flex-col items-center justify-center py-24 text-center">
      <SearchXIcon className="w-14 h-14 text-muted-foreground/30 mb-4" />
      <p className="text-sm font-medium text-foreground mb-1">没有符合条件的画师</p>
      <p className="text-xs text-muted-foreground mb-4">
        {hasAnyCondition ? '试试调整或清空筛选条件' : '当前暂无数据'}
      </p>
      {hasAnyCondition && (
        <Button variant="outline" size="sm" onClick={clearAllFilters}>
          <XIcon className="w-3.5 h-3.5 mr-1" />
          清空筛选
        </Button>
      )}
    </div>
  );

  return (
    <div className="min-h-screen bg-background">
      <HeaderSection viewMode={viewMode} onToggleViewMode={toggleViewMode} />

      {/* PC 模式：侧边栏 + 主内容 */}
      {viewMode === 'pc' ? (
        <div className="flex">
          <FilterPanelSection key={filterResetKey} onFilterChange={handleFilterChange} />
          <main className="flex-1 p-4 md:p-6">
            {/* 吸顶工具条：搜索 + 排序 + 计数 + 操作 */}
            <div className="sticky top-0 z-30 -mx-4 md:-mx-6 px-4 md:px-6 py-3 mb-4 bg-background/95 backdrop-blur border-b border-border">
              <div className="flex items-center gap-2 flex-wrap">
                {searchAndSort}
                <p className="text-sm text-muted-foreground whitespace-nowrap ml-1">
                  共 <span className="font-semibold text-foreground">{displaySuppliers.length}</span> 个
                </p>
                <div className="flex items-center gap-2 ml-auto">
                  {isAdmin && (
                    <>
                      <Button variant="ghost" size="sm" className="gap-1.5" onClick={() => setIsHistoryOpen(true)}>
                        <HistoryIcon className="w-3.5 h-3.5" />
                        历史
                      </Button>
                      <Button variant="outline" size="sm" className="gap-1.5" onClick={() => setIsImportOpen(true)}>
                        <UploadIcon className="w-3.5 h-3.5" />
                        导入 Excel
                      </Button>
                      <Button size="sm" className="gap-1.5" onClick={() => setIsNewOpen(true)}>
                        <PlusIcon className="w-3.5 h-3.5" />
                        新建供应商
                      </Button>
                    </>
                  )}
                </div>
              </div>
            </div>
            {loading ? (
              <div className="flex items-center justify-center py-20">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
              </div>
            ) : displaySuppliers.length === 0 ? (
              emptyState
            ) : (
              <SupplierGridSection
                suppliers={displaySuppliers}
                onSelect={handleSupplierSelect}
                selectedIds={selectedIds}
                onToggleSelect={handleToggleSelect}
                viewMode="pc"
              />
            )}
          </main>
        </div>
      ) : (
        /* 手机模式：全宽竖向滚动 */
        <>
          <main className="w-full p-3 pb-24">
            {/* 吸顶工具条 */}
            <div className="sticky top-0 z-30 -mx-3 px-3 py-2 mb-3 bg-background/95 backdrop-blur border-b border-border space-y-2">
              <div className="flex items-center gap-2">
                {searchAndSort}
              </div>
              <div className="flex items-center justify-between">
                <p className="text-sm text-muted-foreground">
                  共 <span className="font-semibold text-foreground">{displaySuppliers.length}</span> 个
                </p>
                <div className="flex items-center gap-1.5">
                  {isAdmin && (
                    <>
                      <Button variant="ghost" size="sm" className="gap-1 h-7 px-2 text-xs" onClick={() => setIsHistoryOpen(true)}>
                        <HistoryIcon className="w-3 h-3" />
                        历史
                      </Button>
                      <Button variant="outline" size="sm" className="gap-1 h-7 px-2 text-xs" onClick={() => setIsImportOpen(true)}>
                        <UploadIcon className="w-3 h-3" />
                        导入
                      </Button>
                      <Button size="sm" className="gap-1 h-7 px-2 text-xs" onClick={() => setIsNewOpen(true)}>
                        <PlusIcon className="w-3 h-3" />
                        新建
                      </Button>
                    </>
                  )}
                </div>
              </div>
            </div>
            {loading ? (
              <div className="flex items-center justify-center py-20">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
              </div>
            ) : displaySuppliers.length === 0 ? (
              emptyState
            ) : (
              <SupplierGridSection
                suppliers={displaySuppliers}
                onSelect={handleSupplierSelect}
                selectedIds={selectedIds}
                onToggleSelect={handleToggleSelect}
                viewMode="mobile"
              />
            )}
          </main>

          {/* 浮动筛选按钮 */}
          <button
            onClick={() => setIsMobileFilterOpen(true)}
            className={`fixed ${selectedIds.size > 0 ? 'bottom-20' : 'bottom-6'} left-4 z-40 flex items-center gap-2 bg-primary text-white rounded-full px-4 py-2.5 shadow-lg active:scale-95 transition-all duration-200`}
          >
            <FilterIcon className="w-4 h-4" />
            <span className="text-sm font-medium">筛选</span>
            {activeFilterCount > 0 && (
              <span className="flex items-center justify-center w-5 h-5 rounded-full bg-white text-primary text-[11px] font-bold leading-none">
                {activeFilterCount}
              </span>
            )}
          </button>

          {/* 筛选 Sheet（从底部弹出） */}
          <Sheet open={isMobileFilterOpen} onOpenChange={setIsMobileFilterOpen}>
            <SheetContent side="bottom" className="h-[82vh] flex flex-col p-0 rounded-t-2xl">
              <SheetHeader className="px-4 pt-4 pb-2 border-b border-border flex-shrink-0">
                <SheetTitle className="text-base">筛选条件</SheetTitle>
              </SheetHeader>
              <div className="flex-1 overflow-y-auto px-4 py-2">
                <FilterPanelSection
                  onFilterChange={handleFilterChange}
                  mode="sheet"
                />
              </div>
            </SheetContent>
          </Sheet>
        </>
      )}

      <AnimatePresence>
        {isModalOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
          >
            <SupplierDetailModal
              supplier={selectedRawSupplier}
              open={isModalOpen}
              onClose={handleCloseModal}
              onSave={handleSave}
              onDelete={fetchSuppliers}
            />
          </motion.div>
        )}
      </AnimatePresence>

      <Suspense fallback={null}>
        <ExcelImportModal
          open={isImportOpen}
          onClose={() => setIsImportOpen(false)}
          onImportComplete={fetchSuppliers}
        />
      </Suspense>

      <Suspense fallback={null}>
        <NewSupplierModal
          open={isNewOpen}
          onClose={() => setIsNewOpen(false)}
          onCreated={fetchSuppliers}
        />
      </Suspense>

      {/* Floating export action bar */}
      <AnimatePresence>
        {selectedIds.size > 0 && (
          <motion.div
            initial={{ y: 80, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: 80, opacity: 0 }}
            transition={{ type: 'spring', stiffness: 300, damping: 30 }}
            className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50"
          >
            <div className="flex items-center gap-3 bg-card border border-border rounded-2xl shadow-xl px-5 py-3">
              <div className="flex items-center gap-2 text-sm">
                <span className="inline-flex items-center justify-center w-6 h-6 rounded-full bg-primary text-white text-xs font-bold">
                  {selectedIds.size}
                </span>
                <span className="text-muted-foreground">位画师已选中</span>
              </div>

              <div className="w-px h-5 bg-border" />

              <Button
                variant="ghost"
                size="sm"
                className="gap-1.5 text-xs"
                onClick={handleSelectAll}
              >
                全选当前
              </Button>
              <Button
                variant="ghost"
                size="sm"
                className="gap-1.5 text-xs"
                onClick={handleClearSelection}
              >
                <XIcon className="w-3 h-3" />
                清除
              </Button>

              <div className="w-px h-5 bg-border" />

              <Button
                size="sm"
                className="gap-1.5 text-xs"
                onClick={handleExportPdf}
                disabled={isExporting}
              >
                <DownloadIcon className="w-3.5 h-3.5" />
                {isExporting ? '导出中…' : '导出 PDF'}
              </Button>
              <Button
                variant="outline"
                size="sm"
                className="gap-1.5 text-xs"
                onClick={handleCopyToClipboard}
              >
                <CopyIcon className="w-3.5 h-3.5" />
                复制名单
              </Button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
      {/* 回到顶部 */}
      <AnimatePresence>
        {showBackToTop && (
          <motion.button
            initial={{ opacity: 0, scale: 0.8 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.8 }}
            transition={{ duration: 0.15 }}
            onClick={scrollToTop}
            title="回到顶部"
            className="fixed bottom-6 right-6 z-40 w-11 h-11 rounded-full bg-card border border-border shadow-lg flex items-center justify-center text-foreground hover:bg-muted active:scale-95 transition-colors"
          >
            <ArrowUpToLineIcon className="w-5 h-5" />
          </motion.button>
        )}
      </AnimatePresence>

      <HistoryPanel open={isHistoryOpen} onClose={() => setIsHistoryOpen(false)} onDataChange={fetchSuppliers} />
    </div>
  );
}
