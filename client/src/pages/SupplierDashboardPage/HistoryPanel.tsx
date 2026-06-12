import React, { useState, useEffect, useCallback } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { toast } from 'sonner';
import { auditApi, IAuditLog, IBatch, ISnapshot } from '@/api/audit';
import { RotateCcwIcon, CameraIcon, RefreshCwIcon, ChevronLeftIcon, ChevronRightIcon, AlertTriangleIcon } from 'lucide-react';
import { cn } from '@/lib/utils';

const OP_LABELS: Record<string, { label: string; color: string }> = {
  INSERT:          { label: '新增', color: 'bg-green-100 text-green-700 border-green-200' },
  UPDATE:          { label: '编辑', color: 'bg-blue-100 text-blue-700 border-blue-200' },
  DELETE:          { label: '删除', color: 'bg-red-100 text-red-700 border-red-200' },
  BATCH_IMPORT:    { label: '批量导入', color: 'bg-purple-100 text-purple-700 border-purple-200' },
  BATCH_ROLLBACK:  { label: '撤销导入', color: 'bg-orange-100 text-orange-700 border-orange-200' },
  SNAPSHOT:        { label: '快照', color: 'bg-gray-100 text-gray-600 border-gray-200' },
};

function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(2)} MB`;
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleString('zh-CN', { timeZone: 'Asia/Shanghai' });
}

// ── 导入批次 Tab ──────────────────────────────────────────

function BatchesTab() {
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
              {formatDate(b.imported_at)} &nbsp;·&nbsp; 批次 ID：<span className="font-mono">{b.import_batch_id.slice(0, 12)}…</span>
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

// ── 变更记录 Tab ──────────────────────────────────────────

function LogsTab() {
  const [logs, setLogs] = useState<IAuditLog[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const LIMIT = 30;

  const load = useCallback(async (p: number) => {
    setLoading(true);
    try {
      const res = await auditApi.getLogs(p, LIMIT);
      setLogs(res.list);
      setTotal(res.total);
    } finally { setLoading(false); }
  }, []);

  useEffect(() => { load(page); }, [load, page]);

  const totalPages = Math.ceil(total / LIMIT);

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center justify-between">
        <span className="text-xs text-muted-foreground">共 {total} 条记录</span>
        <Button variant="ghost" size="sm" className="gap-1.5 text-xs h-7" onClick={() => load(page)}>
          <RefreshCwIcon className="w-3 h-3" /> 刷新
        </Button>
      </div>

      {loading ? (
        <div className="flex justify-center py-10"><div className="animate-spin h-6 w-6 border-b-2 border-primary rounded-full" /></div>
      ) : (
        <div className="space-y-1.5">
          {logs.map((log) => {
            const op = OP_LABELS[log.operation] ?? { label: log.operation, color: 'bg-gray-100 text-gray-600 border-gray-200' };
            const name = (log.newData?.accountName ?? log.oldData?.accountName ?? log.recordId ?? '–') as string;
            return (
              <div key={log.id} className="flex items-start gap-3 rounded-lg border border-border/60 bg-card px-3 py-2.5">
                <span className={cn('mt-0.5 shrink-0 inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-medium border', op.color)}>
                  {op.label}
                </span>
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-medium truncate">{name}</div>
                  <div className="text-xs text-muted-foreground">
                    {log.operatedBy ?? '–'} &nbsp;·&nbsp; {formatDate(log.createdAt)}
                  </div>
                </div>
              </div>
            );
          })}
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
        <div>
          <p className="text-xs text-muted-foreground">每次批量导入前自动创建快照，最多保留 <span className="font-semibold text-foreground">30</span> 份</p>
        </div>
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
                <div className="text-xs text-muted-foreground mt-0.5">{formatDate(s.createdAt)} &nbsp;·&nbsp; {formatSize(s.size)}</div>
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

export default function HistoryPanel({ open, onClose }: { open: boolean; onClose: () => void }) {
  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl max-h-[85vh] flex flex-col">
        <DialogHeader>
          <DialogTitle>数据管理 · 历史记录</DialogTitle>
        </DialogHeader>
        <Tabs defaultValue="batches" className="flex-1 flex flex-col min-h-0">
          <TabsList className="shrink-0">
            <TabsTrigger value="batches">导入批次</TabsTrigger>
            <TabsTrigger value="logs">变更记录</TabsTrigger>
            <TabsTrigger value="snapshots">快照备份</TabsTrigger>
          </TabsList>
          <ScrollArea className="flex-1 mt-3">
            <TabsContent value="batches" className="mt-0 pr-1"><BatchesTab /></TabsContent>
            <TabsContent value="logs" className="mt-0 pr-1"><LogsTab /></TabsContent>
            <TabsContent value="snapshots" className="mt-0 pr-1"><SnapshotsTab /></TabsContent>
          </ScrollArea>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}
