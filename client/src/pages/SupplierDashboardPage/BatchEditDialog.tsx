import React, { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import { useFilterOptions } from '@/hooks/useFilterOptions';
import { supplierApi } from '@/api/supplier';
import { logger } from '@/lib/polyfills/logger';

type FieldKey = 'status' | 'supplierType' | 'project' | 'appendStyles' | 'appendCooperationTypes';

const FIELD_OPTIONS: { value: FieldKey; label: string; multi?: boolean }[] = [
  { value: 'status', label: '合作状态' },
  { value: 'supplierType', label: '供应商类型' },
  { value: 'project', label: '所属项目' },
  { value: 'appendStyles', label: '追加擅长风格', multi: true },
  { value: 'appendCooperationTypes', label: '追加合作类型', multi: true },
];

export default function BatchEditDialog({
  open,
  onClose,
  supplierIds,
  onDone,
}: {
  open: boolean;
  onClose: () => void;
  supplierIds: string[];
  onDone?: () => void;
}) {
  const cfg = useFilterOptions();
  const [field, setField] = useState<FieldKey>('status');
  const [single, setSingle] = useState('');
  const [multi, setMulti] = useState<string[]>([]);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (open) { setField('status'); setSingle(''); setMulti([]); }
  }, [open]);

  const current = FIELD_OPTIONS.find((f) => f.value === field)!;

  const singleOptions =
    field === 'status' ? cfg.cooperationStatus
    : field === 'supplierType' ? cfg.supplierType
    : field === 'project' ? cfg.project
    : [];
  const multiOptions =
    field === 'appendStyles' ? cfg.style
    : field === 'appendCooperationTypes' ? cfg.cooperationType
    : [];

  const toggleMulti = (v: string) =>
    setMulti((prev) => prev.includes(v) ? prev.filter((x) => x !== v) : [...prev, v]);

  const buildPatch = (): Record<string, unknown> | null => {
    if (current.multi) {
      if (multi.length === 0) return null;
      return field === 'appendStyles' ? { appendStyles: multi } : { appendCooperationTypes: multi };
    }
    if (!single) return null;
    if (field === 'status') {
      // 与详情弹窗一致：状态码 → isInStock + riskStatus
      return {
        isInStock: single === 'in_stock',
        riskStatus: single === 'blacklisted' ? '拉黑' : single === 'outreach' ? '暂无' : '未填写',
      };
    }
    if (field === 'supplierType') return { supplierType: single };
    if (field === 'project') return { entityType: single };
    return null;
  };

  const apply = async () => {
    const patch = buildPatch();
    if (!patch) { toast.error('请选择要设置的值'); return; }
    setSubmitting(true);
    try {
      const r = await supplierApi.batchUpdate(supplierIds, patch as any);
      toast.success(`已更新 ${r.updated} 位画师${r.notFound ? `（${r.notFound} 条未找到）` : ''}`);
      onDone?.();
      onClose();
    } catch (err) {
      logger.error('Batch update failed:', String(err));
      toast.error('批量修改失败，请重试');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>批量编辑（{supplierIds.length} 位画师）</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div>
            <label className="text-xs text-muted-foreground mb-1.5 block">修改字段</label>
            <Select value={field} onValueChange={(v) => { setField(v as FieldKey); setSingle(''); setMulti([]); }}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {FIELD_OPTIONS.map((f) => <SelectItem key={f.value} value={f.value}>{f.label}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>

          <div>
            <label className="text-xs text-muted-foreground mb-1.5 block">
              {current.multi ? '选择要追加的标签（原有标签保留）' : '设为'}
            </label>
            {current.multi ? (
              <div className="flex flex-wrap gap-1.5">
                {multiOptions.length === 0 ? (
                  <span className="text-xs text-muted-foreground">暂无可选项</span>
                ) : multiOptions.map((o) => (
                  <button
                    key={o.value}
                    onClick={() => toggleMulti(o.value)}
                    className={cn(
                      'px-2.5 py-1 rounded-full text-xs font-medium transition-all',
                      multi.includes(o.value)
                        ? 'bg-primary/10 text-primary ring-1 ring-primary/30'
                        : 'bg-muted text-muted-foreground hover:bg-muted/80',
                    )}
                  >
                    {o.label}
                  </button>
                ))}
              </div>
            ) : (
              <Select value={single} onValueChange={setSingle}>
                <SelectTrigger><SelectValue placeholder="请选择" /></SelectTrigger>
                <SelectContent>
                  {singleOptions.map((o) => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}
                </SelectContent>
              </Select>
            )}
          </div>

          <div className="rounded-md bg-amber-50 border border-amber-200 text-amber-700 text-xs px-3 py-2">
            将对选中的 {supplierIds.length} 位画师生效。操作前已自动快照，变更记录里可逐条撤回。
          </div>

          <div className="flex justify-end gap-2">
            <Button variant="outline" size="sm" onClick={onClose}>取消</Button>
            <Button size="sm" onClick={apply} disabled={submitting}>{submitting ? '应用中…' : '应用'}</Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
