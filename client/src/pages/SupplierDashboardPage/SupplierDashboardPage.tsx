import React, { useState, useEffect, useCallback, useMemo, lazy, Suspense } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { PlusIcon, UploadIcon, DownloadIcon, CopyIcon, CheckIcon, XIcon } from 'lucide-react';
import { toast } from 'sonner';
import HeaderSection from './HeaderSection';
import FilterPanelSection, { IFilterState } from './FilterPanelSection';
import SupplierGridSection, { IProcessedSupplier } from './SupplierGridSection';
import SupplierDetailModal from './SupplierDetailModal';
import { supplierApi } from '@/api/supplier';
import { ISupplier } from '@/api/types';
import { logger } from '@/lib/polyfills/logger';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/lib/auth';

// Lazy-load heavy components
const ExcelImportModal = lazy(() => import('./ExcelImportModal'));
const NewSupplierModal = lazy(() => import('./NewSupplierModal'));

// 转换API数据到前端格式
function processSupplier(raw: ISupplier): IProcessedSupplier {
  let type: 'individual' | 'studio' | 'company' | 'artist';
  switch (raw.supplierType) {
    case '个人':
      type = 'individual';
      break;
    case '艺术家':
      type = 'artist';
      break;
    case '公司':
    case '个体工商户':
      type = 'company';
      break;
    default:
      type = 'studio';
      break;
  }

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
  Object.entries(raw.socialLinks).forEach(([key, url]) => {
    if (url) links[key] = url;
  });
  Object.entries(raw.manualLinks).forEach(([key, url]) => {
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

  const { isAdmin } = useAuth();

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
    if (currentFilters.keyword) {
      const keyword = currentFilters.keyword.toLowerCase();
      result = result.filter(
        (s) =>
          s.name.toLowerCase().includes(keyword) ||
          (s.notes && s.notes.toLowerCase().includes(keyword))
      );
    }

    result = result.filter(
      (s) =>
        (s.priceRange[0] === 0 && s.priceRange[1] === 0) || // 无报价数据不过滤
        (s.priceRange[0] >= currentFilters.priceRange[0] &&
         s.priceRange[1] <= currentFilters.priceRange[1])
    );

    return result;
  }, [processedSuppliers, currentFilters]);

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
    const allIds = filteredSuppliers.map((s) => s.id);
    setSelectedIds(new Set(allIds));
  }, [filteredSuppliers]);

  const handleClearSelection = useCallback(() => {
    setSelectedIds(new Set());
  }, []);

  const selectedSuppliers = useMemo(() => {
    return filteredSuppliers.filter((s) => selectedIds.has(s.id));
  }, [filteredSuppliers, selectedIds]);

  const handleExportExcel = useCallback(async () => {
    if (selectedSuppliers.length === 0) return;
    const XLSX = await import('xlsx');

    const platformLabelMap: Record<string, string> = {
      weibo: '微博', pixiv: 'Pixiv', xiaohongshu: '小红书',
      website: '官网', bilibili: 'B站', mihuashi: '米画师', x: 'X',
    };
    const statusLabelMap: Record<string, string> = {
      in_stock: '库内合作', outreach: '库外建联', blacklisted: '已拉黑',
    };

    const rows = selectedSuppliers.map((s) => {
      const links = Object.entries(s.links || {})
        .map(([k, v]) => `${platformLabelMap[k] || k}: ${v}`)
        .join('; ');
      const priceText = s.priceItems && s.priceItems.length > 0
        ? s.priceItems.map((p) => `${p.cooperationType} ${p.unitPrice}${p.priceUnit}`).join(' | ')
        : '';

      return {
        '画师名称': s.name,
        '供应商类型': s.type === 'individual' ? '个人画师' : s.type === 'artist' ? '艺术家' : s.type === 'studio' ? '工作室' : '公司',
        '合作状态': statusLabelMap[s.status] || s.status,
        '擅长风格': s.styles.join('、'),
        '合作类型': s.cooperationTypes.join('、'),
        '合作品类': s.cooperationCategory || '',
        '报价参考': priceText,
        '评分': s.rating != null ? `${s.rating}分` : '',
        '合作频次': s.cooperationCount,
        '平台链接': links,
        '备注': s.notes || '',
      };
    });

    const ws = XLSX.utils.json_to_sheet(rows);
    const colWidths = [
      { wch: 16 }, { wch: 10 }, { wch: 10 }, { wch: 20 },
      { wch: 14 }, { wch: 10 }, { wch: 30 }, { wch: 6 },
      { wch: 8 }, { wch: 40 }, { wch: 30 },
    ];
    ws['!cols'] = colWidths;
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, '画师名单');
    XLSX.writeFile(wb, `画师名单_${new Date().toLocaleDateString('zh-CN').replace(/\//g, '-')}.xlsx`);
    toast.success(`已导出 ${selectedSuppliers.length} 位画师`);
  }, [selectedSuppliers]);

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

  return (
    <div className="min-h-screen bg-background">
      <HeaderSection />

      <div className="flex">
        <FilterPanelSection onFilterChange={handleFilterChange} />

        <main className="flex-1 p-4 md:p-6">
          <div className="mb-4 flex items-center justify-between">
            <p className="text-sm text-muted-foreground">
              共 <span className="font-semibold text-foreground">{filteredSuppliers.length}</span> 个供应商
            </p>
            <div className="flex items-center gap-2">
              {isAdmin && (
                <>
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

          {loading ? (
            <div className="flex items-center justify-center py-20">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
            </div>
          ) : (
            <SupplierGridSection
              suppliers={filteredSuppliers}
              onSelect={handleSupplierSelect}
              selectedIds={selectedIds}
              onToggleSelect={handleToggleSelect}
            />
          )}
        </main>
      </div>

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
                onClick={handleExportExcel}
              >
                <DownloadIcon className="w-3.5 h-3.5" />
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
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
