import React, { useState, useEffect, useCallback } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { toast } from 'sonner';
import { auditApi, IAuditLog, IBatch, ISnapshot } from '@/api/audit';
import {
  RotateCcwIcon, CameraIcon, RefreshCwIcon,
  ChevronLeftIcon, ChevronRightIcon, AlertTriangleIcon,
  ArrowRightIcon, PlusCircleIcon, Trash2Icon, PencilIcon,
} from 'lucide-react';
import { cn } from '@/lib/utils';

// ── 工具函数 ──────────────────────────────────────────────

function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(2)} MB`;
}

function timeAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return '刚刚';
  if (mins < 60) return `${mins} 分钟前`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours} 小时前`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days} 天前`;
  return new Date(iso).toLocaleDateString('zh-CN');
}

function fullDate(iso: string): string {
  return new Date(iso).toLocaleString('zh-CN', { timeZone: 'Asia/Shanghai' });
}

// ── 字段标签与格式化 ──────────────────────────────────────

const FIELD_LABELS: Record<string, string> = {
  accountName: '供应商名称',
  subCategory: '擅长风格',
  cooperationType: '合作类型',
  priceRange: '报价参考',
  priceItems: '报价明细',
  cooperationCount: '合作频次',
  rating: '评分',
  riskStatus: '风险状态',
  isInStock: '库存状态',
  entityType: '主体类型',
  contractEntity: '签约主体',
  contractType: '合同类型',
  contractNo: '合同编号',
  contractDeadline: '合同截止',
  taxStatus: '税务状态',
  contactInfo: '联系备注',
  contactItems: '联系方式',
  cooperationCategory: '合作品类',
  supplierType: '供应商类型',
  manualLinks: '平台链接',
  socialLinks: '社交链接',
};

const SKIP_FIELDS = new Set(['id', 'importSource', 'importBatchId', 'createdAt', 'updatedAt', 'artworkUrls']);

function fmtValue(field: string, value: unknown): string {
  if (value === null || value === undefined || value === '') return '–';
  if (field === 'isInStock') return value ? '在库' : '不在库';
  if (field === 'rating') return value !== null ? `${value} 分` : '–';
  if (field === 'cooperationCount') return `${value} 次`;
  if (field === 'contractDeadline') {
    try { return new Date(value as string).toLocaleDateString('zh-CN'); } catch { return String(value); }
  }
  if (field === 'priceItems' && Array.isArray(value)) {
    const items = (value as any[]);
    return items.length
      ? items.map((p: any) => `${p.cooperationType} ${p.unitPrice}${p.priceUnit}`).join(' | ')
      : '–';
  }
  if (field === 'contactItems' && Array.isArray(value)) {
    const items = (value as any[]);
    const typeLabel: Record<string, string> = { wechat: '微信', qq: 'QQ', phone: '电话' };
    return items.length
      ? items.map((c: any) => `${typeLabel[c.type] || c.type}: ${c.value}`).join(' | ')
      : '–';
  }
  if ((field === 'socialLinks' || field === 'manualLinks') && typeof value === 'object') {
    const entries = Object.entries(value as Record<string, string>).filter(([, v]) => v);
    return entries.length ? entries.map(([k, v]) => `${k}: ${v}`).join(', ') : '–';
  }
  if (Array.isArray(value)) return value.length ? value.join('、') : '–';
  return String(value);
}

interface DiffItem { field: string; label: string; oldVal: string; newVal: string }

function computeDiff(
  oldData: Record<string, unknown> | null,
  newData: Record<string, unknown> | null,
): DiffItem[] {
  if (!oldData || !newData) return [];
  const allKeys = new Set([...Object.keys(oldData), ...Object.keys(newData)]);
  const diffs: DiffItem[] = [];
  for (const key of allKeys) {
    if (SKIP_FIELDS.has(key) || !(key in FIELD_LABELS)) continue;
    const ov = fmtValue(key, oldData[key]);
    const nv = fmtValue(key, newData[key]);
    if (ov !== nv) diffs.push({ field: key, label: FIELD_LABELS[key], oldVal: ov, newVal: nv });
  }
  return diffs;
}

function keyInfo(data: Record<string, unknown> | null): string {
  if (!data) return '–';
  const parts = [
    data.cooperationCategory,
    data.supplierType,
    data.cooperationType,
    data.rating != null ? `评分 ${data.rating} 分` : null,
  ].filter(Boolean);
  return parts.join(' · ') || '无更多信息';
}

// ── 操作类型配置 ─────────────────────────────────────────

const OP_CONFIG: Record<string, { label: string; borderColor: string; badgeColor: string; icon: React.ReactNode }> = {
  INSERT:        { label: '新增', borderColor: 'border-green-400',  badgeColor: 'bg-green-50 text-green-700 border-green-200',  icon: <PlusCircleIcon className="w-3 h-3" /> },
  UPDATE:        { label: '编辑', borderColor: 'border-blue-400',   badgeColor: 'bg-blue-50 text-blue-700 border-blue-200',    icon: <PencilIcon className="w-3 h-3" /> },
  DELETE:        { label: '删除', borderColor: 'border-red-400',    badgeColor: 'bg-red-50 text-red-700 border-red-200',      icon: <Trash2Icon className="w-3 h-3" /> },
  BATCH_ROLLBACK:{ label: '撤销导入', borderColor: 'border-orange-400', badgeColor: 'bg-orange-50 text-orange-700 border-orange-200', icon: <RotateCcwIcon className="w-3 h-3" /> },
  LOG_ROLLBACK:  { label: '撤回操作', borderColor: 'border-orange-400', badgeColor: 'bg-orange-50 text-orange-700 border-orange-200', icon: <RotateCcwIcon className="w-3 h-3" /> },
};

const ROLLBACKABLE = new Set(['INSERT', 'UPDATE', 'DELETE']);

// ── 单条日志卡片 ─────────────────────────────────────────

function LogCard({ log, onRollbackSuccess }: { log: IAuditLog; onRollbackSuccess: () => void }) {
  const [confirmRollback, setConfirmRollback] = useState(false);
  const [rolling, setRolling] = useState(false);

  const op = OP_CONFIG[log.operation] ?? {
    label: log.operation,
    borderColor: 'border-gray-300',
    badgeColor: 'bg-gray-50 text-gray-600 border-gray-200',
    icon: null,
  };

  const name = (log.newData?.accountName ?? log.oldData?.accountName ?? `#${log.id}`) as string;
  const diff = log.operation === 'UPDATE' ? computeDiff(
    log.oldData as Record<string, unknown> | null,
    log.newData as Record<string, unknown> | null,
  ) : [];

  const handleRollback = async () => {
    if (!confirmRollback) { setConfirmRollback(true); return; }
    setConfirmRollback(false);
    setRolling(true);
    try {
      const res = await auditApi.rollbackLog(log.id);
      toast.success(res.message);
      onRollbackSuccess();
    } catch {
      toast.error('撤回失败，请重试');
    } finally {
      setRolling(false);
    }
  };

  return (
    <div className={cn('border-l-2 pl-3 py-2 group', op.borderColor)}>
      <div className="flex items-start justify-between gap-2">
        {/* 左：操作信息 */}
        <div className="flex-1 min-w-0">
          {/* 第一行：标签 + 名称 + 时间 */}
          <div className="flex items-center gap-2 flex-wrap">
            <span className={cn('inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-medium border', op.badgeColor)}>
              {op.icon}{op.label}
            </span>
            <span className="text-sm font-semibold text-foreground truncate max-w-[180px]">{name}</span>
            <span className="text-xs text-muted-foreground" title={fullDate(log.createdAt)}>{timeAgo(log.createdAt)}</span>
          </div>

          {/* 第二行：具体变更内容 */}
          <div className="mt-1.5">
            {log.operation === 'UPDATE' && diff.length > 0 && (
              <div className="space-y-1">
                {diff.map((d) => (
                  <div key={d.field} className="flex items-baseline gap-1.5 text-xs">
                    <span className="text-muted-foreground shrink-0 w-[72px] text-right">{d.label}</span>
                    <span className="text-red-500 line-through max-w-[100px] truncate" title={d.oldVal}>{d.oldVal}</span>
                    <ArrowRightIcon className="w-2.5 h-2.5 text-muted-foreground shrink-0" />
                    <span className="text-green-600 font-medium max-w-[120px] truncate" title={d.newVal}>{d.newVal}</span>
                  </div>
                ))}
              </div>
            )}
            {log.operation === 'UPDATE' && diff.length === 0 && (
              <p className="text-xs text-muted-foreground">无字段变化</p>
            )}
            {log.operation === 'INSERT' && (
              <p className="text-xs text-muted-foreground">{keyInfo(log.newData as Record<string, unknown> | null)}</p>
            )}
            {log.operation === 'DELETE' && (
              <p className="text-xs text-muted-foreground">{keyInfo(log.oldData as Record<string, unknown> | null)}</p>
            )}
            {log.operation === 'LOG_ROLLBACK' && (
              <p className="text-xs text-muted-foreground">撤回了日志 #{log.batchId}</p>
            )}
            {log.operation === 'BATCH_ROLLBACK' && (
              <p className="text-xs text-muted-foreground">批次撤销</p>
            )}
          </div>

          {/* 第三行：操作人 */}
          <div className="mt-1 text-[11px] text-muted-foreground/70">{log.operatedBy ?? '–'}</div>
        </div>

        {/* 右：撤回按钮 */}
        {ROLLBACKABLE.has(log.operation) && (
          <div className="flex items-center gap-1.5 shrink-0">
            {confirmRollback && (
              <span className="text-[10px] text-orange-600 flex items-center gap-0.5">
                <AlertTriangleIcon className="w-3 h-3" /> 确认?
              </span>
            )}
            <Button
              variant={confirmRollback ? 'destructive' : 'ghost'}
              size="sm"
              className={cn('h-6 px-2 text-[11px] gap-1 opacity-0 group-hover:opacity-100 transition-opacity', confirmRollback && 'opacity-100')}
              disabled={rolling}
              onClick={handleRollback}
              onBlur={() => setTimeout(() => setConfirmRollback(false), 200)}
            >
              <RotateCcwIcon className={cn('w-3 h-3', rolling && 'animate-spin')} />
              {rolling ? '…' : confirmRollback ? '执行' : '撤回'}
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}

// ── 变更记录 Tab ──────────────────────────────────────────

function LogsTab({ onDataChange }: { onDataChange?: () => void }) {
  const [logs, setLogs] = useState<IAuditLog[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const LIMIT = 20;

  const load = useCallback(async (p: number) => {
    setLoading(true);
    try {
      const res = await auditApi.getLogs(p, LIMIT);
      setLogs(res.list);
      setTotal(res.total);
    } finally { setLoading(false); }
  }, []);

  useEffect(() => { load(page); }, [load, page]);

  const handleRollbackSuccess = useCallback(() => {
    load(page);
    onDataChange?.();
  }, [load, page, onDataChange]);

  const totalPages = Math.ceil(total / LIMIT);

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center justify-between">
        <span className="text-xs text-muted-foreground">共 <span className="font-semibold text-foreground">{total}</span> 条记录 · 悬停显示「撤回」按钮</span>
        <Button variant="ghost" size="sm" className="gap-1.5 text-xs h-7" onClick={() => load(page)}>
          <RefreshCwIcon className="w-3 h-3" /> 刷新
        </Button>
      </div>

      {loading ? (
        <div className="flex justify-center py-10"><div className="animate-spin h-6 w-6 border-b-2 border-primary rounded-full" /></div>
      ) : logs.length === 0 ? (
        <div className="text-center py-10 text-muted-foreground text-sm">暂无变更记录</div>
      ) : (
        <div className="space-y-2.5 pl-1">
          {logs.map((log) => (
            <LogCard key={log.id} log={log} onRollbackSuccess={handleRollbackSuccess} />
          ))}
        </div>
      )}

      {totalPages > 1 && (
        <div className="flex items-center justify-center gap-2 pt-1">
          <Button variant="ghost" size="sm" disabled={page <= 1} onClick={() => setPage(p => p - 1)}>
            <ChevronLeftIcon className="w-4 h-4" />
          </Button>
          <span className="text-xs text-muted-foreground">{page} / {totalPages}</span>
          <Button variant="ghost" size="sm" disabled={page >= totalPages} onClick={() => setPage(p => p + 1)}>
            <ChevronRightIcon className="w-4 h-4" />
          </Button>
        </div>
      )}
    </div>
  );
}

// ── 导入批次 Tab ──────────────────────────────────────────

function BatchesTab({ onDataChange }: { onDataChange?: () => void }) {
  const [batches, setBatches] = useState<IBatch[]>([]);
  const [loading, setLoading] = useState(true);
  const [rolling, setRolling] = useState<string | null>(null);
  const [confirm, setConfirm] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try { setBatches(await auditApi.getBatches()); } finally { setLoading(false); }
  }, []);

  useEffect(() => { load(); }, [load]);

  const handleRollback = async (batchId: string) => {
    if (confirm !== batchId) { setConfirm(batchId); return; }
    setConfirm(null);
    setRolling(batchId);
    try {
      const res = await auditApi.rollbackBatch(batchId);
      toast.success(res.message);
      load();
      onDataChange?.();
    } catch {
      toast.error('撤销失败，请重试');
    } finally {
      setRolling(null);
    }
  };

  if (loading) return <div className="flex justify-center py-10"><div className="animate-spin h-6 w-6 border-b-2 border-primary rounded-full" /></div>;
  if (batches.length === 0) return <div className="text-center py-10 text-muted-foreground text-sm">暂无批量导入记录</div>;

  return (
    <div className="space-y-2">
      {batches.map((b) => (
        <div key={b.import_batch_id} className="flex items-center justify-between rounded-lg border border-border bg-card px-4 py-3">
          <div>
            <div className="text-sm font-medium text-foreground">
              导入 <span className="font-bold text-primary">{b.count}</span> 条数据
            </div>
            <div className="text-xs text-muted-foreground mt-0.5">
              {fullDate(b.imported_at)} &nbsp;·&nbsp; 批次：<span className="font-mono">{b.import_batch_id.slice(0, 12)}…</span>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {confirm === b.import_batch_id && (
              <span className="text-xs text-orange-600 flex items-center gap-1">
                <AlertTriangleIcon className="w-3.5 h-3.5" /> 再次点击确认撤销
              </span>
            )}
            <Button
              variant={confirm === b.import_batch_id ? 'destructive' : 'outline'}
              size="sm"
              className="gap-1.5 text-xs"
              disabled={rolling === b.import_batch_id}
              onClick={() => handleRollback(b.import_batch_id)}
            >
              <RotateCcwIcon className={cn('w-3.5 h-3.5', rolling === b.import_batch_id && 'animate-spin')} />
              {rolling === b.import_batch_id ? '撤销中…' : '撤销此批'}
            </Button>
          </div>
        </div>
      ))}
    </div>
  );
}

// ── 快照备份 Tab ──────────────────────────────────────────

function SnapshotsTab() {
  const [snapshots, setSnapshots] = useState<ISnapshot[]>([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try { setSnapshots(await auditApi.listSnapshots()); } finally { setLoading(false); }
  }, []);

  useEffect(() => { load(); }, [load]);

  const handleCreate = async () => {
    setCreating(true);
    try {
      const res = await auditApi.createSnapshot();
      toast.success(`快照已创建：${res.filename}（${formatSize(res.size)}）`);
      load();
    } catch {
      toast.error('快照创建失败，请检查 mysqldump 是否可用');
    } finally {
      setCreating(false);
    }
  };

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center justify-between">
        <p className="text-xs text-muted-foreground">每次批量导入前自动创建快照，最多保留 <span className="font-semibold text-foreground">30</span> 份</p>
        <Button size="sm" className="gap-1.5 text-xs" onClick={handleCreate} disabled={creating}>
          <CameraIcon className={cn('w-3.5 h-3.5', creating && 'animate-pulse')} />
          {creating ? '创建中…' : '立即备份'}
        </Button>
      </div>

      {loading ? (
        <div className="flex justify-center py-10"><div className="animate-spin h-6 w-6 border-b-2 border-primary rounded-full" /></div>
      ) : snapshots.length === 0 ? (
        <div className="text-center py-10 text-muted-foreground text-sm">暂无快照，可点击「立即备份」手动创建</div>
      ) : (
        <div className="space-y-1.5">
          {snapshots.map((s) => (
            <div key={s.filename} className="flex items-center justify-between rounded-lg border border-border/60 bg-card px-3 py-2.5">
              <div>
                <div className="text-xs font-mono text-foreground">{s.filename}</div>
                <div className="text-xs text-muted-foreground mt-0.5">{fullDate(s.createdAt)} &nbsp;·&nbsp; {formatSize(s.size)}</div>
              </div>
              <Badge variant="outline" className="text-[10px] shrink-0">
                {s.filename.includes('pre_import') ? '导入前' : '手动'}
              </Badge>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ── 主组件 ────────────────────────────────────────────────

export default function HistoryPanel({
  open,
  onClose,
  onDataChange,
}: {
  open: boolean;
  onClose: () => void;
  onDataChange?: () => void;
}) {
  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl max-h-[88vh] flex flex-col">
        <DialogHeader>
          <DialogTitle>数据管理 · 历史记录</DialogTitle>
        </DialogHeader>
        <Tabs defaultValue="logs" className="flex-1 flex flex-col min-h-0">
          <TabsList className="shrink-0">
            <TabsTrigger value="logs">变更记录</TabsTrigger>
            <TabsTrigger value="batches">导入批次</TabsTrigger>
            <TabsTrigger value="snapshots">快照备份</TabsTrigger>
          </TabsList>
          <ScrollArea className="flex-1 mt-3">
            <TabsContent value="logs" className="mt-0 pr-1"><LogsTab onDataChange={onDataChange} /></TabsContent>
            <TabsContent value="batches" className="mt-0 pr-1"><BatchesTab onDataChange={onDataChange} /></TabsContent>
            <TabsContent value="snapshots" className="mt-0 pr-1"><SnapshotsTab /></TabsContent>
          </ScrollArea>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}
