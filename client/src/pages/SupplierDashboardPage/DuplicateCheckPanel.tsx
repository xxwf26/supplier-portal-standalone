import React, { useState, useCallback } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { toast } from 'sonner';
import { supplierApi } from '@/api/supplier';
import { RefreshCwIcon, Trash2Icon, AlertTriangleIcon, CheckCircleIcon } from 'lucide-react';
import { cn } from '@/lib/utils';

interface DuplicateGroup {
  ids: string[];
  names: string[];
  reason: string;
}

export default function DuplicateCheckPanel({
  open,
  onClose,
  onDeleted,
}: {
  open: boolean;
  onClose: () => void;
  onDeleted?: () => void;
}) {
  const [groups, setGroups] = useState<DuplicateGroup[]>([]);
  const [loading, setLoading] = useState(false);
  const [checked, setChecked] = useState(false);
  const [deleting, setDeleting] = useState<string | null>(null);
  const [dismissed, setDismissed] = useState<Set<string>>(new Set());

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
        .map(g => ({ ...g, ids: g.ids.filter(i => i !== id), names: g.names.filter((_, idx) => g.ids[idx] !== id) }))
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
      <DialogContent aria-describedby={undefined} className="max-w-2xl max-h-[85vh] flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <AlertTriangleIcon className="w-5 h-5 text-orange-500" />
            查重检测
          </DialogTitle>
        </DialogHeader>

        <div className="flex items-center justify-between px-1 shrink-0">
          <p className="text-xs text-muted-foreground">
            检测名称完全相同或含有≥2个连续相同字符的画师
          </p>
          <Button size="sm" onClick={runCheck} disabled={loading} className="gap-1.5">
            <RefreshCwIcon className={cn('w-3.5 h-3.5', loading && 'animate-spin')} />
            {loading ? '检测中…' : checked ? '重新检测' : '开始检测'}
          </Button>
        </div>

        <ScrollArea className="flex-1 mt-2">
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
            <div className="space-y-4 px-1">
              {/* 完全重复 */}
              {exactGroups.length > 0 && (
                <div>
                  <p className="text-xs font-semibold text-red-600 mb-2 flex items-center gap-1">
                    <span className="w-2 h-2 rounded-full bg-red-500 inline-block" />
                    名称完全相同（{exactGroups.length} 组）
                  </p>
                  <div className="space-y-2">
                    {exactGroups.map(g => (
                      <DuplicateCard key={g.ids.join('|')} group={g} onDelete={handleDelete} onDismiss={() => setDismissed(prev => new Set([...prev, g.ids.join('|')]))} deleting={deleting} />
                    ))}
                  </div>
                </div>
              )}

              {/* 相似 */}
              {similarGroups.length > 0 && (
                <div>
                  <p className="text-xs font-semibold text-orange-600 mb-2 flex items-center gap-1">
                    <span className="w-2 h-2 rounded-full bg-orange-400 inline-block" />
                    名称相似，请人工校对（{similarGroups.length} 组）
                  </p>
                  <div className="space-y-2">
                    {similarGroups.map(g => (
                      <DuplicateCard key={g.ids.join('|')} group={g} onDelete={handleDelete} onDismiss={() => setDismissed(prev => new Set([...prev, g.ids.join('|')]))} deleting={deleting} similar />
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </ScrollArea>
      </DialogContent>
    </Dialog>
  );
}

function DuplicateCard({
  group, onDelete, onDismiss, deleting, similar,
}: {
  group: DuplicateGroup;
  onDelete: (id: string, name: string) => void;
  onDismiss: () => void;
  deleting: string | null;
  similar?: boolean;
}) {
  return (
    <div className={cn(
      'rounded-lg border p-3 space-y-2',
      similar ? 'border-orange-200 bg-orange-50/50' : 'border-red-200 bg-red-50/50'
    )}>
      <div className="flex items-start justify-between gap-2">
        <Badge variant="outline" className={cn('text-[10px] shrink-0', similar ? 'border-orange-300 text-orange-700' : 'border-red-300 text-red-700')}>
          {group.reason}
        </Badge>
        <button onClick={onDismiss} className="text-[10px] text-muted-foreground hover:text-foreground shrink-0">
          忽略此组
        </button>
      </div>
      <div className="space-y-1.5">
        {group.ids.map((id, idx) => (
          <div key={id} className="flex items-center justify-between gap-2 bg-white rounded px-2.5 py-1.5 border border-border/50">
            <span className="text-sm font-medium truncate">{group.names[idx]}</span>
            <Button
              variant="ghost"
              size="sm"
              className="h-6 px-2 text-[11px] text-red-600 hover:bg-red-50 hover:text-red-700 shrink-0"
              disabled={deleting === id}
              onClick={() => onDelete(id, group.names[idx])}
            >
              <Trash2Icon className={cn('w-3 h-3 mr-1', deleting === id && 'animate-spin')} />
              {deleting === id ? '删除中' : '删除'}
            </Button>
          </div>
        ))}
      </div>
    </div>
  );
}
