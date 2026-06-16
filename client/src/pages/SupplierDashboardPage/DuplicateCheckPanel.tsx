import React, { useState, useCallback } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel,
  AlertDialogContent, AlertDialogDescription, AlertDialogFooter,
  AlertDialogHeader, AlertDialogTitle as AlertTitle,
} from '@/components/ui/alert-dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { toast } from 'sonner';
import { supplierApi } from '@/api/supplier';
import { ISupplier } from '@/api/types';
import {
  RefreshCwIcon, Trash2Icon, AlertTriangleIcon, CheckCircleIcon,
  StarIcon, ImageIcon,
} from 'lucide-react';
import { cn } from '@/lib/utils';

interface DuplicateGroup {
  ids: string[];
  names: string[];
  reason: string;
}

const STATUS_CONFIG = {
  in_stock:   { label: '库内合作', color: 'bg-green-100 text-green-700' },
  outreach:   { label: '库外建联', color: 'bg-blue-100 text-blue-700' },
  blacklisted:{ label: '已拉黑',   color: 'bg-gray-100 text-gray-500' },
};

const CONTACT_LABEL: Record<string, string> = { wechat: '微信', qq: 'QQ', phone: '电话' };

function getStatus(s: ISupplier): 'in_stock' | 'outreach' | 'blacklisted' {
  if (s.riskStatus === '拉黑') return 'blacklisted';
  return s.isInStock ? 'in_stock' : 'outreach';
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString('zh-CN');
}

// ── 单个供应商详情卡片 ────────────────────────────────────

function SupplierMiniCard({
  supplier,
  onDelete,
  deleting,
}: {
  supplier: ISupplier;
  onDelete: (id: string, name: string) => void;
  deleting: string | null;
}) {
  const [confirmDelete, setConfirmDelete] = useState(false);
  const status = getStatus(supplier);
  const statusCfg = STATUS_CONFIG[status];
  const priceText = supplier.priceItems && supplier.priceItems.length > 0
    ? supplier.priceItems.map((p: any) => `${p.cooperationType} ${p.unitPrice}${p.priceUnit}`).join(' | ')
    : supplier.priceRange || '';

  const hasArtwork = supplier.artworkUrls && supplier.artworkUrls.length > 0;

  return (
    <div className="rounded-lg border border-border bg-card overflow-hidden">
      {/* 顶部：缩略图 + 基本信息 */}
      <div className="flex gap-3 p-3">
        {/* 缩略图 */}
        <div className="w-20 h-20 rounded-md bg-muted flex-shrink-0 overflow-hidden">
          {hasArtwork ? (
            <img src={supplier.artworkUrls![0]} alt="" className="w-full h-full object-cover" />
          ) : (
            <div className="w-full h-full flex items-center justify-center">
              <ImageIcon className="w-6 h-6 text-muted-foreground/30" />
            </div>
          )}
        </div>

        {/* 信息区 */}
        <div className="flex-1 min-w-0">
          <div className="flex items-start justify-between gap-2">
            <h3 className="text-sm font-bold text-foreground leading-tight">{supplier.accountName}</h3>
            <Button
              variant="ghost"
              size="sm"
              className="h-6 px-2 text-[11px] text-red-600 hover:bg-red-50 shrink-0"
              disabled={deleting === supplier.id}
              onClick={() => setConfirmDelete(true)}
            >
              <Trash2Icon className="w-3 h-3 mr-0.5" />
              {deleting === supplier.id ? '删除中' : '删除'}
            </Button>
          </div>

          {/* 徽章行 */}
          <div className="flex flex-wrap gap-1 mt-1">
            <span className={cn('text-[10px] px-1.5 py-0.5 rounded-full font-medium', statusCfg.color)}>
              {statusCfg.label}
            </span>
            {supplier.cooperationCategory && (
              <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-emerald-50 text-emerald-700">
                {supplier.cooperationCategory}
              </span>
            )}
            {supplier.supplierType && (
              <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-muted text-muted-foreground">
                {supplier.supplierType}
              </span>
            )}
          </div>

          {/* 评分 + 频次 */}
          <div className="flex items-center gap-3 mt-1 text-xs text-muted-foreground">
            <span className="flex items-center gap-0.5">
              <StarIcon className="w-3 h-3 text-amber-400 fill-amber-400" />
              {supplier.rating ?? '–'}
            </span>
            <span>合作 {supplier.cooperationCount} 次</span>
            <span>录入 {formatDate(supplier.createdAt)}</span>
          </div>
        </div>
      </div>

      {/* 底部：报价 + 联系 + 合作类型 + 备注 */}
      {(priceText || (supplier.contactItems && supplier.contactItems.length > 0) || supplier.contactInfo || supplier.cooperationType) && (
        <div className="border-t border-border/50 px-3 py-2 space-y-1 bg-muted/20">
          {supplier.cooperationType && (
            <p className="text-xs text-muted-foreground">
              <span className="font-medium text-foreground">合作类型：</span>{supplier.cooperationType}
            </p>
          )}
          {priceText && (
            <p className="text-xs text-muted-foreground line-clamp-2">
              <span className="font-medium text-foreground">报价：</span>{priceText}
            </p>
          )}
          {supplier.contactItems && supplier.contactItems.length > 0 && (
            <p className="text-xs text-muted-foreground">
              <span className="font-medium text-foreground">联系：</span>
              {supplier.contactItems.map((c: any) => `${CONTACT_LABEL[c.type] || c.type}: ${c.value}`).join('  ')}
            </p>
          )}
          {supplier.contactInfo && (
            <p className="text-xs text-muted-foreground line-clamp-2">
              <span className="font-medium text-foreground">备注：</span>{supplier.contactInfo}
            </p>
          )}
        </div>
      )}

      {/* 删除确认 */}
      <AlertDialog open={confirmDelete} onOpenChange={setConfirmDelete}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertTitle>确认删除「{supplier.accountName}」？</AlertTitle>
            <AlertDialogDescription>删除后可通过变更记录撤回。</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>取消</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive hover:bg-destructive/90"
              onClick={() => { setConfirmDelete(false); onDelete(supplier.id, supplier.accountName); }}
            >
              确认删除
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

// ── 重复组 ────────────────────────────────────────────────

function DuplicateGroup({
  group,
  supplierMap,
  onDelete,
  onDismiss,
  deleting,
}: {
  group: DuplicateGroup;
  supplierMap: Map<string, ISupplier>;
  onDelete: (id: string, name: string) => void;
  onDismiss: () => void;
  deleting: string | null;
}) {
  const isExact = group.reason === '名称完全相同';

  return (
    <div className={cn(
      'rounded-xl border p-3 space-y-2',
      isExact ? 'border-red-200 bg-red-50/40' : 'border-orange-200 bg-orange-50/40'
    )}>
      <div className="flex items-center justify-between">
        <Badge variant="outline" className={cn('text-[10px]', isExact ? 'border-red-300 text-red-700' : 'border-orange-300 text-orange-700')}>
          {group.reason}
        </Badge>
        <button onClick={onDismiss} className="text-[10px] text-muted-foreground hover:text-foreground">
          不是重复，忽略
        </button>
      </div>

      <div className="grid gap-2 sm:grid-cols-2">
        {group.ids.map((id) => {
          const s = supplierMap.get(id);
          if (!s) return (
            <div key={id} className="rounded-lg border border-border bg-card p-3 text-xs text-muted-foreground">
              ID: {id.slice(0, 8)}… （数据未加载）
            </div>
          );
          return (
            <SupplierMiniCard key={id} supplier={s} onDelete={onDelete} deleting={deleting} />
          );
        })}
      </div>
    </div>
  );
}

// ── 主组件 ────────────────────────────────────────────────

export default function DuplicateCheckPanel({
  open,
  onClose,
  onDeleted,
  suppliers = [],
}: {
  open: boolean;
  onClose: () => void;
  onDeleted?: () => void;
  suppliers?: ISupplier[];
}) {
  const [groups, setGroups] = useState<DuplicateGroup[]>([]);
  const [loading, setLoading] = useState(false);
  const [checked, setChecked] = useState(false);
  const [deleting, setDeleting] = useState<string | null>(null);
  const [dismissed, setDismissed] = useState<Set<string>>(new Set());

  // 供应商 ID → 完整数据的映射
  const supplierMap = new Map(suppliers.map(s => [s.id, s]));

  const runCheck = useCallback(async () => {
    setLoading(true);
    setChecked(false);
    try {
      const data = await supplierApi.getDuplicates();
      setGroups(data);
      setDismissed(new Set());
      setChecked(true);
      if (data.length === 0) toast.success('未发现重复画师');
    } catch {
      toast.error('查重失败，请重试');
    } finally {
      setLoading(false);
    }
  }, []);

  const handleDelete = async (id: string, name: string) => {
    setDeleting(id);
    try {
      await supplierApi.delete(id);
      toast.success(`已删除「${name}」`);
      setGroups(prev => prev
        .map(g => ({
          ...g,
          ids: g.ids.filter(i => i !== id),
          names: g.names.filter((_, idx) => g.ids[idx] !== id),
        }))
        .filter(g => g.ids.length >= 2)
      );
      onDeleted?.();
    } catch {
      toast.error('删除失败，请重试');
    } finally {
      setDeleting(null);
    }
  };

  const visibleGroups = groups.filter(g => !dismissed.has(g.ids.join('|')));
  const exactGroups = visibleGroups.filter(g => g.reason === '名称完全相同');
  const similarGroups = visibleGroups.filter(g => g.reason !== '名称完全相同');

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent aria-describedby={undefined} className="max-w-3xl max-h-[90vh] overflow-hidden flex flex-col p-0">
        <DialogHeader className="px-6 pt-6 pb-3 shrink-0 border-b border-border">
          <DialogTitle className="flex items-center gap-2">
            <AlertTriangleIcon className="w-5 h-5 text-orange-500" />
            查重检测
          </DialogTitle>
        </DialogHeader>

        <div className="flex items-center justify-between px-6 py-3 shrink-0">
          <p className="text-xs text-muted-foreground">
            检测完全相同名称，以及含有≥2个连续相同字符的相似名称
          </p>
          <Button size="sm" onClick={runCheck} disabled={loading} className="gap-1.5">
            <RefreshCwIcon className={cn('w-3.5 h-3.5', loading && 'animate-spin')} />
            {loading ? '检测中…' : checked ? '重新检测' : '开始检测'}
          </Button>
        </div>

        <div className="flex-1 overflow-y-auto px-6 pb-6" style={{ minHeight: 0 }}>
          {!checked && !loading && (
            <div className="flex flex-col items-center justify-center py-16 text-muted-foreground">
              <AlertTriangleIcon className="w-10 h-10 mb-3 opacity-30" />
              <p className="text-sm">点击「开始检测」扫描全库重复画师</p>
            </div>
          )}

          {checked && visibleGroups.length === 0 && (
            <div className="flex flex-col items-center justify-center py-16 text-muted-foreground">
              <CheckCircleIcon className="w-10 h-10 mb-3 text-green-500 opacity-70" />
              <p className="text-sm font-medium text-green-600">未发现重复画师</p>
            </div>
          )}

          {checked && visibleGroups.length > 0 && (
            <div className="space-y-5">
              {exactGroups.length > 0 && (
                <div className="space-y-3">
                  <p className="text-xs font-semibold text-red-600 flex items-center gap-1.5">
                    <span className="w-2 h-2 rounded-full bg-red-500 inline-block" />
                    名称完全相同（{exactGroups.length} 组）—— 保留一个，删除另一个
                  </p>
                  {exactGroups.map(g => (
                    <DuplicateGroup key={g.ids.join('|')} group={g} supplierMap={supplierMap}
                      onDelete={handleDelete} onDismiss={() => setDismissed(prev => new Set([...prev, g.ids.join('|')]))} deleting={deleting} />
                  ))}
                </div>
              )}

              {similarGroups.length > 0 && (
                <div className="space-y-3">
                  <p className="text-xs font-semibold text-orange-600 flex items-center gap-1.5">
                    <span className="w-2 h-2 rounded-full bg-orange-400 inline-block" />
                    名称相似（{similarGroups.length} 组）—— 请对比确认是否为同一人
                  </p>
                  {similarGroups.map(g => (
                    <DuplicateGroup key={g.ids.join('|')} group={g} supplierMap={supplierMap}
                      onDelete={handleDelete} onDismiss={() => setDismissed(prev => new Set([...prev, g.ids.join('|')]))} deleting={deleting} />
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
