import React, { useState, useEffect, useCallback, useMemo, lazy, Suspense } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { PlusIcon, UploadIcon, DownloadIcon, CopyIcon, CheckIcon, XIcon, FilterIcon, HistoryIcon, SearchIcon, ArrowUpDownIcon, ArrowUpToLineIcon, SearchXIcon, ScanSearchIcon, Trash2Icon, ListChecksIcon, FileSpreadsheetIcon, LayoutGridIcon, TableIcon, PencilIcon } from 'lucide-react';
import { toast } from 'sonner';
import HeaderSection from './HeaderSection';
import FilterPanelSection, { IFilterState, STORAGE_KEY } from './FilterPanelSection';
import SupplierGridSection, { IProcessedSupplier } from './SupplierGridSection';
import SupplierDetailModal from './SupplierDetailModal';
import { supplierApi } from '@/api/supplier';
import { auditApi } from '@/api/audit';
import { ISupplier } from '@/api/types';
import { logger } from '@/lib/polyfills/logger';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { useAuth } from '@/lib/auth';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Checkbox } from '@/components/ui/checkbox';
import HistoryPanel from './HistoryPanel';
import ShortlistPanel, { AddToShortlistDialog } from './ShortlistPanel';
import SupplierTableSection from './SupplierTableSection';
import BatchEditDialog from './BatchEditDialog';
import DuplicateCheckPanel from './DuplicateCheckPanel';
import { normalizeSupplierType } from '@/lib/supplierUtils';
import { normalizeForSearch } from '@/lib/chineseNormalize';
import { useDebouncedValue } from '@/hooks/useDebouncedValue';
import { ExportFields, DEFAULT_EXPORT_FIELDS, EXPORT_FIELD_LABELS, exportSuppliersToPdf } from './exportSupplierPdf';
import { exportSuppliersToExcel } from './exportSupplierExcel';

const EXPORT_FIELDS_STORAGE_KEY = '__export_fields';

export type SortKey = 'default' | 'ratingDesc' | 'ratingAsc' | 'countDesc' | 'countAsc' | 'recent';

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

// 容错：数据库 JSON 列有时回传字符串（含历史脏数据被双重编码的情况），
// 统一转成数组/对象，避免单条坏数据 .map 崩溃整页
function toArray<T>(v: unknown): T[] {
  if (Array.isArray(v)) return v as T[];
  if (typeof v === 'string') {
    try { const p = JSON.parse(v); return Array.isArray(p) ? (p as T[]) : []; } catch { return []; }
  }
  return [];
}
function toObject(v: unknown): Record<string, string> {
  if (v && typeof v === 'object' && !Array.isArray(v)) return v as Record<string, string>;
  if (typeof v === 'string') {
    try { const p = JSON.parse(v); return p && typeof p === 'object' && !Array.isArray(p) ? p : {}; } catch { return {}; }
  }
  return {};
}

// 转换API数据到前端格式
function processSupplier(raw: ISupplier): IProcessedSupplier {
  const type = normalizeSupplierType(raw.supplierType, raw.accountName || '');

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
  const priceItems = toArray<NonNullable<ISupplier['priceItems']>[number]>(raw.priceItems);
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

  let status: 'in_stock' | 'outreach' | 'blacklisted' | 'unset';
  if (raw.riskStatus === '拉黑') {
    status = 'blacklisted';
  } else if (raw.isInStock) {
    status = 'in_stock';
  } else if (!raw.riskStatus || raw.riskStatus === '未填写') {
    status = 'unset';
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
  Object.entries(toObject(raw.socialLinks)).forEach(([key, url]) => {
    if (url) links[key] = url;
  });
  Object.entries(toObject(raw.manualLinks)).forEach(([key, url]) => {
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

  const contactItems = toArray<NonNullable<ISupplier['contactItems']>[number]>(raw.contactItems);

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
    works: toArray<string>(raw.artworkUrls),
    history: [],
    rating: raw.rating,
    cooperationCount: raw.cooperationCount,
    riskStatus: raw.riskStatus,
    cooperationCategory: raw.cooperationCategory,
    contractDeadline: raw.contractDeadline,
    updatedAt: raw.updatedAt,
  };
}

export default function SupplierDashboardPage({ viewMode = 'pc' }: { viewMode?: 'pc' | 'mobile' }) {
  const [selectedSupplier, setSelectedSupplier] = useState<IProcessedSupplier | null>(null);
  const [selectedRawSupplier, setSelectedRawSupplier] = useState<ISupplier | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isImportOpen, setIsImportOpen] = useState(false);
  const [isNewOpen, setIsNewOpen] = useState(false);
  const [rawSuppliers, setRawSuppliers] = useState<ISupplier[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [currentFilters, setCurrentFilters] = useState<IFilterState | null>(null);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [isMobileFilterOpen, setIsMobileFilterOpen] = useState(false);
  const [isHistoryOpen, setIsHistoryOpen] = useState(false);
  const [isDuplicateOpen, setIsDuplicateOpen] = useState(false);
  const [isShortlistOpen, setIsShortlistOpen] = useState(false);
  const [addToListOpen, setAddToListOpen] = useState(false);
  const [batchEditOpen, setBatchEditOpen] = useState(false);
  const [keyword, setKeyword] = useState('');
  // 搜索防抖：输入框即时回显 keyword，实际过滤用 debouncedKeyword，避免每次按键全量重算
  const debouncedKeyword = useDebouncedValue(keyword, 300);
  const [sortKey, setSortKey] = useState<SortKey>('default');
  const [showBackToTop, setShowBackToTop] = useState(false);
  const [filterResetKey, setFilterResetKey] = useState(0);
  const [gridColumns, setGridColumns] = useState<number>(() => {
    const saved = localStorage.getItem('__grid_columns');
    return saved ? Number(saved) : 0;
  });

  const handleGridColumns = (cols: number) => {
    setGridColumns(cols);
    localStorage.setItem('__grid_columns', String(cols));
  };

  const [layoutMode, setLayoutMode] = useState<'card' | 'table'>(() => {
    return localStorage.getItem('__layout_mode') === 'table' ? 'table' : 'card';
  });
  const handleLayoutMode = (m: 'card' | 'table') => {
    setLayoutMode(m);
    localStorage.setItem('__layout_mode', m);
  };

  const { isAdmin } = useAuth();


  const activeFilterCount = useMemo(() => {
    if (!currentFilters) return 0;
    return (
      currentFilters.types.length +
      currentFilters.cooperationTypes.length +
      currentFilters.styles.length +
      currentFilters.status.length +
      currentFilters.projects.length +
      currentFilters.ratings.length +
      currentFilters.contractExpiry.length +
      (currentFilters.priceRange[0] !== 0 || currentFilters.priceRange[1] !== 10000 || currentFilters.priceUnset ? 1 : 0)
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
      const hasUnset = currentFilters.styles.includes('__unset__');
      const realStyles = currentFilters.styles.filter(s => s !== '__unset__');
      result = result.filter((s) =>
        (hasUnset && s.styles.length === 0) ||
        (realStyles.length > 0 && s.styles.some((st) => realStyles.includes(st)))
      );
    }
    if (currentFilters.cooperationTypes.length > 0) {
      const hasUnset = currentFilters.cooperationTypes.includes('__unset__');
      const realTypes = currentFilters.cooperationTypes.filter(t => t !== '__unset__');
      result = result.filter((s) =>
        (hasUnset && s.cooperationTypes.length === 0) ||
        (realTypes.length > 0 && s.cooperationTypes.some((ct) => realTypes.includes(ct)))
      );
    }
    if (currentFilters.projects.length > 0) {
      const hasUnset = currentFilters.projects.includes('__unset__');
      const realProjects = currentFilters.projects.filter(p => p !== '__unset__');
      result = result.filter((s) =>
        (hasUnset && s.project.length === 0) ||
        (realProjects.length > 0 && s.project.some((p) => realProjects.includes(p)))
      );
    }

    // 价格过滤：滑块偏离默认 或 勾选了「未填写报价」时才生效
    const priceSliderActive = currentFilters.priceRange[0] > 0 || currentFilters.priceRange[1] < 10000;
    if (priceSliderActive || currentFilters.priceUnset) {
      result = result.filter((s) => {
        const noPrice = s.priceRange[0] === 0 && s.priceRange[1] === 0;
        if (noPrice) return currentFilters.priceUnset; // 无报价：仅在勾选「未填写」时显示
        if (!priceSliderActive) return true;            // 有报价且滑块未动：显示
        return s.priceRange[0] >= currentFilters.priceRange[0] &&
               s.priceRange[1] <= currentFilters.priceRange[1];
      });
    }

    // 评分过滤：勾选具体星级（精确命中）或「未评分」
    if (currentFilters.ratings.length > 0) {
      const hasUnset = currentFilters.ratings.includes('__unset__');
      const realRatings = currentFilters.ratings.filter(r => r !== '__unset__');
      result = result.filter((s) =>
        (hasUnset && (s.rating === null || s.rating === undefined)) ||
        (realRatings.length > 0 && s.rating != null && realRatings.includes(String(s.rating)))
      );
    }

    // 合同到期过滤：30天内到期(soon) / 已过期(expired)
    if (currentFilters.contractExpiry.length > 0) {
      const wantSoon = currentFilters.contractExpiry.includes('soon');
      const wantExpired = currentFilters.contractExpiry.includes('expired');
      const startOfToday = new Date();
      startOfToday.setHours(0, 0, 0, 0);
      const todayMs = startOfToday.getTime();
      result = result.filter((s) => {
        if (!s.contractDeadline) return false;
        const d = new Date(String(s.contractDeadline).slice(0, 10));
        if (isNaN(d.getTime())) return false;
        const days = Math.round((d.getTime() - todayMs) / 86400000);
        if (wantExpired && days < 0) return true;
        if (wantSoon && days >= 0 && days <= 30) return true;
        return false;
      });
    }

    return result;
  }, [processedSuppliers, currentFilters]);

  // 关键词搜索（来自吸顶工具条）+ 排序，得到最终展示列表
  const displaySuppliers = useMemo(() => {
    let result = filteredSuppliers;

    const kw = normalizeForSearch(debouncedKeyword.trim());
    if (kw) {
      result = result.filter((s) => {
        if (normalizeForSearch(s.name).includes(kw)) return true;
        if (s.notes && normalizeForSearch(s.notes).includes(kw)) return true;
        // 搜索结构化联系方式（微信/QQ/电话）
        if (s.contactItems?.some(c => c.value.toLowerCase().includes(kw))) return true;
        // 搜索平台链接
        if (s.links && Object.values(s.links).some(v => v.toLowerCase().includes(kw))) return true;
        return false;
      });
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
  }, [filteredSuppliers, debouncedKeyword, sortKey]);

  const fetchSuppliers = useCallback(async () => {
    setLoading(true);
    setLoadError(null);
    try {
      const response = await supplierApi.getList();
      setRawSuppliers(response.list);
    } catch (error) {
      logger.error('Failed to fetch suppliers:', String(error));
      setLoadError('画师列表加载失败，请检查网络或稍后重试');
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

  const handleOpenSupplierById = useCallback((id: string) => {
    const raw = rawSuppliers.find((r) => r.id === id);
    if (!raw) { toast.error('该画师可能已被删除'); return; }
    setSelectedRawSupplier(raw);
    setSelectedSupplier(processSupplier(raw));
    setIsShortlistOpen(false);
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
    if (allIds.length > 200) {
      toast.warning(`当前共 ${allIds.length} 条结果，已全选，导出可能需要较长时间`);
    }
    setSelectedIds(new Set(allIds));
  }, [displaySuppliers]);

  const handleClearSelection = useCallback(() => {
    setSelectedIds(new Set());
  }, []);

  const selectedSuppliers = useMemo(() => {
    return displaySuppliers.filter((s) => selectedIds.has(s.id));
  }, [displaySuppliers, selectedIds]);

  // 被当前筛选/搜索隐藏、但仍处于选中状态的数量。
  // 这些项不会出现在 selectedSuppliers 中，导出/复制时需提示用户避免静默丢失
  const hiddenSelectedCount = useMemo(() => {
    return selectedIds.size - selectedSuppliers.length;
  }, [selectedIds, selectedSuppliers]);

  const [isExporting, setIsExporting] = useState(false);
  const [showExportDialog, setShowExportDialog] = useState(false);
  const [exportFields, setExportFields] = useState<ExportFields>(() => {
    try {
      const saved = localStorage.getItem(EXPORT_FIELDS_STORAGE_KEY);
      if (saved) return { ...DEFAULT_EXPORT_FIELDS, ...JSON.parse(saved) };
    } catch {}
    return DEFAULT_EXPORT_FIELDS;
  });
  const [confirmBatchDelete, setConfirmBatchDelete] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  // 已选画师名单（含被筛选隐藏的项）——从原始列表按 id 解析，用于删除确认弹窗
  const selectedNames = useMemo(() => {
    return rawSuppliers
      .filter((s) => selectedIds.has(s.id))
      .map((s) => s.accountName || '(未命名)');
  }, [rawSuppliers, selectedIds]);

  const handleBatchDelete = useCallback(async () => {
    if (selectedIds.size === 0 || isDeleting) return;
    setConfirmBatchDelete(false);
    setIsDeleting(true);
    const ids = Array.from(selectedIds);
    try {
      const { deleted, batchId } = await supplierApi.batchDelete(ids);
      handleClearSelection();
      await fetchSuppliers();
      toast.success(`已删除 ${deleted} 位画师`, {
        action: {
          label: '撤销',
          onClick: async () => {
            try {
              const { restored } = await auditApi.rollbackDeleteBatch(batchId);
              await fetchSuppliers();
              toast.success(`已恢复 ${restored} 位画师`);
            } catch (err) {
              logger.error('Batch delete rollback failed:', String(err));
              toast.error('撤销失败，可在「变更记录」中手动恢复');
            }
          },
        },
        duration: 10000,
      });
    } catch (err) {
      logger.error('Batch delete failed:', String(err));
      toast.error('批量删除失败，请重试');
    } finally {
      setIsDeleting(false);
    }
  }, [selectedIds, isDeleting, handleClearSelection, fetchSuppliers]);

  const handleExportPdf = useCallback(() => {
    if (selectedSuppliers.length === 0 || isExporting) return;
    setShowExportDialog(true);
  }, [selectedSuppliers, isExporting]);

  const handleConfirmExport = useCallback(async (fields: ExportFields) => {
    setShowExportDialog(false);
    try { localStorage.setItem(EXPORT_FIELDS_STORAGE_KEY, JSON.stringify(fields)); } catch {}
    if (hiddenSelectedCount > 0) {
      toast.warning(`有 ${hiddenSelectedCount} 位已选画师被当前筛选/搜索隐藏，本次仅导出可见的 ${selectedSuppliers.length} 位`);
    }
    setIsExporting(true);
    const toastId = toast.loading(`正在生成 PDF（0/${selectedSuppliers.length}）…`);
    try {
      await exportSuppliersToPdf(selectedSuppliers, {
        fields,
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
  }, [selectedSuppliers, isExporting, hiddenSelectedCount]);

  const handleExportExcel = useCallback(() => {
    if (selectedIds.size === 0) return;
    const rows = rawSuppliers.filter((s) => selectedIds.has(s.id));
    if (rows.length === 0) { toast.error('没有可导出的画师'); return; }
    try {
      const stamp = new Date().toISOString().slice(0, 10);
      exportSuppliersToExcel(rows, `画师导出_${stamp}`);
      toast.success(`已导出 ${rows.length} 位画师为 Excel`);
    } catch (err) {
      logger.error('Excel export failed:', String(err));
      toast.error('Excel 导出失败，请重试');
    }
  }, [selectedIds, rawSuppliers]);

  const handleCopyToClipboard = useCallback(async () => {
    if (selectedSuppliers.length === 0) return;
    if (hiddenSelectedCount > 0) {
      toast.warning(`有 ${hiddenSelectedCount} 位已选画师被当前筛选/搜索隐藏，本次仅复制可见的 ${selectedSuppliers.length} 位`);
    }

    const statusLabelMap: Record<string, string> = {
      in_stock: '库内合作', outreach: '库外建联', blacklisted: '已拉黑',
    };

    const lines = selectedSuppliers.map((s, i) => {
      const parts = [
        `${i + 1}. ${s.name}`,
        `类型: ${s.type}`,
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
      // 优先用现代 API（需要 HTTPS），降级用 execCommand（兼容 HTTP 局域网访问）
      if (navigator.clipboard && window.isSecureContext) {
        await navigator.clipboard.writeText(text);
      } else {
        const ta = document.createElement('textarea');
        ta.value = text;
        ta.style.cssText = 'position:fixed;top:-9999px;left:-9999px;opacity:0';
        document.body.appendChild(ta);
        ta.focus();
        ta.select();
        const ok = document.execCommand('copy');
        document.body.removeChild(ta);
        if (!ok) throw new Error('execCommand failed');
      }
      toast.success(`已复制 ${selectedSuppliers.length} 位画师信息`);
    } catch {
      toast.error('复制失败，请手动复制');
    }
  }, [selectedSuppliers, hiddenSelectedCount]);

  useEffect(() => {
    fetchSuppliers();
  }, [fetchSuppliers]);

  // rawSuppliers 更新后同步刷新弹窗内的供应商数据（保存后实时展示最新内容）
  useEffect(() => {
    if (selectedRawSupplier) {
      const updated = rawSuppliers.find(r => r.id === selectedRawSupplier.id);
      if (updated) setSelectedRawSupplier(updated);
    }
  }, [rawSuppliers]);

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

      {/* 视图切换：卡片 / 表格 */}
      <div className="flex items-center gap-0.5 bg-muted rounded-md p-0.5 shrink-0">
        <button
          title="卡片视图"
          onClick={() => handleLayoutMode('card')}
          className={`h-7 px-2 rounded transition-colors inline-flex items-center gap-1 text-xs ${layoutMode === 'card' ? 'bg-background text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground'}`}
        >
          <LayoutGridIcon className="w-3.5 h-3.5" />
          <span>卡片</span>
        </button>
        <button
          title="表格视图"
          onClick={() => handleLayoutMode('table')}
          className={`h-7 px-2 rounded transition-colors inline-flex items-center gap-1 text-xs ${layoutMode === 'table' ? 'bg-background text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground'}`}
        >
          <TableIcon className="w-3.5 h-3.5" />
          <span>表格</span>
        </button>
      </div>

      {/* 列数切换（仅 PC 卡片模式） */}
      {layoutMode === 'card' && (
      <div className="flex items-center gap-0.5 bg-muted rounded-md p-0.5 shrink-0">
        {[0, 1, 2, 3, 4, 5, 6].map(n => (
          <button
            key={n}
            title={n === 0 ? '自动' : `${n}列`}
            onClick={() => handleGridColumns(n)}
            className={`h-7 px-2 rounded text-xs font-medium transition-colors ${
              gridColumns === n
                ? 'bg-background text-foreground shadow-sm'
                : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            {n === 0 ? '自动' : n}
          </button>
        ))}
      </div>
      )}
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

  const errorState = (
    <div className="flex flex-col items-center justify-center py-24 text-center">
      <SearchXIcon className="w-14 h-14 text-destructive/40 mb-4" />
      <p className="text-sm font-medium text-foreground mb-1">加载失败</p>
      <p className="text-xs text-muted-foreground mb-4">{loadError}</p>
      <Button variant="outline" size="sm" onClick={fetchSuppliers}>
        重试
      </Button>
    </div>
  );

  return (
    <div className="min-h-screen bg-background">
      <HeaderSection viewMode={viewMode} />

      {/* PC 模式：侧边栏 + 主内容 */}
      {viewMode === 'pc' ? (
        <div className="flex">
          <FilterPanelSection key={filterResetKey} onFilterChange={handleFilterChange} />
          <main className="flex-1 p-4 md:p-6">
            {/* 吸顶工具条：搜索 + 排序 + 计数 + 操作 */}
            <div className="sticky top-[44px] z-30 -mx-4 md:-mx-6 px-4 md:px-6 py-3 mb-4 bg-background/95 backdrop-blur border-b border-border">
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
                      <Button variant="ghost" size="sm" className="gap-1.5" onClick={() => setIsDuplicateOpen(true)}>
                        <ScanSearchIcon className="w-3.5 h-3.5" />
                        查重
                      </Button>
                      <Button variant="ghost" size="sm" className="gap-1.5" onClick={() => setIsShortlistOpen(true)}>
                        <ListChecksIcon className="w-3.5 h-3.5" />
                        清单
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
            ) : loadError ? (
              errorState
            ) : displaySuppliers.length === 0 ? (
              emptyState
            ) : layoutMode === 'table' ? (
              <SupplierTableSection
                suppliers={displaySuppliers}
                onSelect={handleSupplierSelect}
                selectedIds={selectedIds}
                onToggleSelect={handleToggleSelect}
                isAdmin={isAdmin}
                sortKey={sortKey}
                onSort={setSortKey}
              />
            ) : (
              <SupplierGridSection
                suppliers={displaySuppliers}
                onSelect={handleSupplierSelect}
                selectedIds={selectedIds}
                onToggleSelect={handleToggleSelect}
                viewMode="pc"
                columns={gridColumns}
              />
            )}
          </main>
        </div>
      ) : (
        /* 手机模式：全宽竖向滚动 */
        <>
          <main className="w-full p-3 pb-24">
            {/* 吸顶工具条 */}
            <div className="sticky top-[44px] z-30 -mx-3 px-3 py-2 mb-3 bg-background/95 backdrop-blur border-b border-border space-y-2">
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
                      <Button variant="ghost" size="sm" className="gap-1 h-7 px-2 text-xs" onClick={() => setIsDuplicateOpen(true)}>
                        <ScanSearchIcon className="w-3 h-3" />
                        查重
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
            ) : loadError ? (
              errorState
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
            className={`fixed ${selectedIds.size > 0 ? 'bottom-24' : 'bottom-6'} left-4 z-40 flex items-center gap-2 bg-primary text-white rounded-full px-4 py-2.5 shadow-lg active:scale-95 transition-all duration-200`}
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
                  key={filterResetKey}
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
          suppliers={rawSuppliers}
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
                onClick={handleExportExcel}
              >
                <FileSpreadsheetIcon className="w-3.5 h-3.5" />
                导出 Excel
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

              {isAdmin && (
                <>
                  <div className="w-px h-5 bg-border" />
                  <Button
                    variant="outline"
                    size="sm"
                    className="gap-1.5 text-xs"
                    onClick={() => setAddToListOpen(true)}
                  >
                    <ListChecksIcon className="w-3.5 h-3.5" />
                    加入清单
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    className="gap-1.5 text-xs"
                    onClick={() => setBatchEditOpen(true)}
                  >
                    <PencilIcon className="w-3.5 h-3.5" />
                    批量编辑
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="gap-1.5 text-xs text-destructive hover:text-destructive hover:bg-destructive/10"
                    onClick={() => setConfirmBatchDelete(true)}
                    disabled={isDeleting}
                  >
                    <Trash2Icon className="w-3.5 h-3.5" />
                    {isDeleting ? '删除中…' : '批量删除'}
                  </Button>
                </>
              )}
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
      <DuplicateCheckPanel open={isDuplicateOpen} onClose={() => setIsDuplicateOpen(false)} onDeleted={fetchSuppliers} suppliers={rawSuppliers} />
      <ShortlistPanel open={isShortlistOpen} onClose={() => setIsShortlistOpen(false)} onOpenSupplier={handleOpenSupplierById} />
      <AddToShortlistDialog open={addToListOpen} onClose={() => setAddToListOpen(false)} supplierIds={Array.from(selectedIds)} />
      <BatchEditDialog open={batchEditOpen} onClose={() => setBatchEditOpen(false)} supplierIds={Array.from(selectedIds)} onDone={() => { handleClearSelection(); fetchSuppliers(); }} />

      {/* 导出字段选择对话框 */}
      <ExportFieldsDialog
        open={showExportDialog}
        fields={exportFields}
        onFieldsChange={setExportFields}
        onConfirm={handleConfirmExport}
        onCancel={() => setShowExportDialog(false)}
        count={selectedSuppliers.length}
      />

      <AlertDialog open={confirmBatchDelete} onOpenChange={setConfirmBatchDelete}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>删除选中的 {selectedIds.size} 位画师？</AlertDialogTitle>
            <AlertDialogDescription asChild>
              <div className="space-y-2">
                <p>删除后可在弹窗「撤销」或「变更记录」中整批恢复。</p>
                {hiddenSelectedCount > 0 && (
                  <p className="text-amber-600">
                    其中 {hiddenSelectedCount} 位当前被筛选/搜索隐藏，也将一并删除。
                  </p>
                )}
                <div className="max-h-32 overflow-y-auto rounded-md bg-muted/50 px-3 py-2 text-xs text-muted-foreground">
                  {selectedNames.slice(0, 12).join('、')}
                  {selectedNames.length > 12 && ` 等 ${selectedNames.length} 位`}
                </div>
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>取消</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={handleBatchDelete}
            >
              确认删除
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

// ── 导出字段选择对话框 ─────────────────────────────────────
function ExportFieldsDialog({
  open, fields, onFieldsChange, onConfirm, onCancel, count,
}: {
  open: boolean;
  fields: ExportFields;
  onFieldsChange: (f: ExportFields) => void;
  onConfirm: (f: ExportFields) => void;
  onCancel: () => void;
  count: number;
}) {
  const allChecked = EXPORT_FIELD_LABELS.every(({ key }) => fields[key]);
  const noneChecked = EXPORT_FIELD_LABELS.every(({ key }) => !fields[key]);

  const toggle = (key: keyof ExportFields) =>
    onFieldsChange({ ...fields, [key]: !fields[key] });

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onCancel()}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle>选择导出字段</DialogTitle>
        </DialogHeader>
        <p className="text-xs text-muted-foreground -mt-1">
          基础信息（名称 / 类型 / 状态 / 评分 / 频次）始终导出
        </p>
        <div className="grid grid-cols-2 gap-2 py-1">
          {EXPORT_FIELD_LABELS.map(({ key, label }) => (
            <label key={key} className="flex items-center gap-2 cursor-pointer select-none text-sm">
              <Checkbox
                checked={fields[key]}
                onCheckedChange={() => toggle(key)}
              />
              {label}
            </label>
          ))}
        </div>
        <div className="flex items-center gap-2 pt-1 border-t border-border">
          <button
            className="text-xs text-muted-foreground hover:text-foreground transition-colors"
            onClick={() => onFieldsChange(DEFAULT_EXPORT_FIELDS)}
          >
            全选
          </button>
          <span className="text-muted-foreground/40 text-xs">·</span>
          <button
            className="text-xs text-muted-foreground hover:text-foreground transition-colors"
            onClick={() => onFieldsChange(Object.fromEntries(EXPORT_FIELD_LABELS.map(({ key }) => [key, false])) as ExportFields)}
          >
            全不选
          </button>
          <div className="flex-1" />
          <Button variant="outline" size="sm" onClick={onCancel}>取消</Button>
          <Button
            size="sm"
            disabled={noneChecked}
            onClick={() => onConfirm(fields)}
          >
            <DownloadIcon className="w-3.5 h-3.5 mr-1" />
            导出 {count} 位
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
