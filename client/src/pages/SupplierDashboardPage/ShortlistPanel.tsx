import React, { useState, useEffect, useCallback } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel,
  AlertDialogContent, AlertDialogDescription, AlertDialogFooter,
  AlertDialogHeader, AlertDialogTitle as AlertTitle,
} from '@/components/ui/alert-dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { toast } from 'sonner';
import {
  PlusCircleIcon, Trash2Icon, PencilIcon, ChevronLeftIcon,
  ListChecksIcon, ImageIcon, XIcon, StarIcon,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { artworkSrc } from '@/lib/imageSrc';
import {
  shortlistApi, IShortlist, IShortlistDetail,
  SHORTLIST_STATUS, statusColor,
} from '@/api/shortlist';

// ── 清单管理面板 ─────────────────────────────────────────────
export default function ShortlistPanel({
  open,
  onClose,
  onOpenSupplier,
}: {
  open: boolean;
  onClose: () => void;
  onOpenSupplier?: (supplierId: string) => void;
}) {
  const [lists, setLists] = useState<IShortlist[]>([]);
  const [loading, setLoading] = useState(false);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [detail, setDetail] = useState<IShortlistDetail | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);

  // 新建/重命名
  const [editing, setEditing] = useState<{ id?: string; name: string; description: string } | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<IShortlist | null>(null);

  const loadLists = useCallback(async () => {
    setLoading(true);
    try {
      setLists(await shortlistApi.list());
    } catch {
      toast.error('清单加载失败');
    } finally {
      setLoading(false);
    }
  }, []);

  const loadDetail = useCallback(async (id: string) => {
    setDetailLoading(true);
    try {
      setDetail(await shortlistApi.get(id));
    } catch {
      toast.error('清单详情加载失败');
    } finally {
      setDetailLoading(false);
    }
  }, []);

  useEffect(() => {
    if (open) {
      loadLists();
      setActiveId(null);
      setDetail(null);
    }
  }, [open, loadLists]);

  useEffect(() => {
    if (activeId) loadDetail(activeId);
  }, [activeId, loadDetail]);

  const saveEdit = async () => {
    if (!editing) return;
    const name = editing.name.trim();
    if (!name) { toast.error('请输入清单名称'); return; }
    try {
      if (editing.id) {
        await shortlistApi.update(editing.id, { name, description: editing.description });
        toast.success('已保存');
      } else {
        await shortlistApi.create(name, editing.description);
        toast.success('清单已创建');
      }
      setEditing(null);
      loadLists();
    } catch {
      toast.error('保存失败');
    }
  };

  const doDelete = async () => {
    if (!confirmDelete) return;
    try {
      await shortlistApi.remove(confirmDelete.id);
      toast.success('清单已删除');
      if (activeId === confirmDelete.id) { setActiveId(null); setDetail(null); }
      setConfirmDelete(null);
      loadLists();
    } catch {
      toast.error('删除失败');
    }
  };

  const changeItemStatus = async (supplierId: string, status: string) => {
    if (!detail) return;
    // 乐观更新
    setDetail({ ...detail, items: detail.items.map((it) => it.supplierId === supplierId ? { ...it, status } : it) });
    try {
      await shortlistApi.updateItem(detail.id, supplierId, { status });
    } catch {
      toast.error('状态更新失败');
      loadDetail(detail.id);
    }
  };

  const removeItem = async (supplierId: string) => {
    if (!detail) return;
    setDetail({ ...detail, items: detail.items.filter((it) => it.supplierId !== supplierId) });
    try {
      await shortlistApi.removeItem(detail.id, supplierId);
      loadLists();
    } catch {
      toast.error('移除失败');
      loadDetail(detail.id);
    }
  };

  return (
    <>
      <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
        <DialogContent className="max-w-3xl max-h-[85vh] flex flex-col">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <ListChecksIcon className="w-4 h-4 text-primary" />
              {activeId && detail ? (
                <button className="flex items-center gap-1 hover:text-primary" onClick={() => { setActiveId(null); setDetail(null); }}>
                  <ChevronLeftIcon className="w-4 h-4" /> 候选清单
                </button>
              ) : '候选清单'}
              {activeId && detail && <span className="text-muted-foreground font-normal">/ {detail.name}</span>}
            </DialogTitle>
          </DialogHeader>

          {/* 清单列表视图 */}
          {!activeId && (
            <div className="flex-1 min-h-0 flex flex-col gap-3">
              <div className="flex justify-end">
                <Button size="sm" className="gap-1.5" onClick={() => setEditing({ name: '', description: '' })}>
                  <PlusCircleIcon className="w-4 h-4" /> 新建清单
                </Button>
              </div>
              <ScrollArea className="flex-1 -mx-1 px-1">
                {loading ? (
                  <p className="text-sm text-muted-foreground text-center py-10">加载中…</p>
                ) : lists.length === 0 ? (
                  <p className="text-sm text-muted-foreground text-center py-10">还没有清单。点「新建清单」创建，或在列表多选画师后「加入清单」。</p>
                ) : (
                  <div className="space-y-2">
                    {lists.map((l) => (
                      <div key={l.id} className="flex items-center gap-3 p-3 rounded-lg border border-border hover:border-primary/40 hover:bg-muted/40 transition-colors cursor-pointer" onClick={() => setActiveId(l.id)}>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <span className="font-medium text-sm truncate">{l.name}</span>
                            <Badge variant="secondary" className="text-[10px]">{l.itemCount} 人</Badge>
                          </div>
                          {l.description && <p className="text-xs text-muted-foreground truncate mt-0.5">{l.description}</p>}
                        </div>
                        <Button variant="ghost" size="icon" className="h-7 w-7" onClick={(e) => { e.stopPropagation(); setEditing({ id: l.id, name: l.name, description: l.description || '' }); }}>
                          <PencilIcon className="w-3.5 h-3.5" />
                        </Button>
                        <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive hover:text-destructive" onClick={(e) => { e.stopPropagation(); setConfirmDelete(l); }}>
                          <Trash2Icon className="w-3.5 h-3.5" />
                        </Button>
                      </div>
                    ))}
                  </div>
                )}
              </ScrollArea>
            </div>
          )}

          {/* 清单详情视图 */}
          {activeId && (
            <ScrollArea className="flex-1 min-h-0 -mx-1 px-1">
              {detailLoading || !detail ? (
                <p className="text-sm text-muted-foreground text-center py-10">加载中…</p>
              ) : detail.items.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-10">该清单还没有画师。在列表多选后点「加入清单」添加。</p>
              ) : (
                <div className="space-y-2">
                  {detail.items.map((it) => {
                    const firstImg = it.artworkUrls && it.artworkUrls.length > 0 ? artworkSrc(it.artworkUrls[0]) : null;
                    return (
                      <div key={it.itemId} className="flex items-center gap-3 p-2.5 rounded-lg border border-border">
                        <div className="w-12 h-12 rounded-md bg-muted overflow-hidden flex-shrink-0 flex items-center justify-center">
                          {firstImg ? <img src={firstImg} alt="" className="w-full h-full object-cover" loading="lazy" /> : <ImageIcon className="w-5 h-5 text-muted-foreground/30" />}
                        </div>
                        <div className="flex-1 min-w-0">
                          <button
                            className="text-sm font-medium truncate hover:text-primary text-left"
                            onClick={() => it.supplierId && onOpenSupplier?.(it.supplierId)}
                          >
                            {it.accountName || '(已删除画师)'}
                          </button>
                          <div className="flex items-center gap-2 text-[11px] text-muted-foreground mt-0.5">
                            {it.supplierType && <span>{it.supplierType}</span>}
                            {it.rating != null && <span className="inline-flex items-center gap-0.5"><StarIcon className="w-3 h-3 fill-amber-400 text-amber-400" />{it.rating}</span>}
                            {it.contactItems && it.contactItems.length > 0 && <span className="truncate">{it.contactItems[0].type}:{it.contactItems[0].value}</span>}
                          </div>
                        </div>
                        <Select value={it.status} onValueChange={(v) => changeItemStatus(it.supplierId, v)}>
                          <SelectTrigger className={cn('h-7 text-xs w-24 border', statusColor(it.status))}>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {SHORTLIST_STATUS.map((s) => (
                              <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive hover:text-destructive" onClick={() => removeItem(it.supplierId)}>
                          <XIcon className="w-4 h-4" />
                        </Button>
                      </div>
                    );
                  })}
                </div>
              )}
            </ScrollArea>
          )}
        </DialogContent>
      </Dialog>

      {/* 新建/重命名清单 */}
      <Dialog open={!!editing} onOpenChange={(v) => !v && setEditing(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>{editing?.id ? '编辑清单' : '新建清单'}</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div>
              <label className="text-xs text-muted-foreground mb-1 block">清单名称</label>
              <Input value={editing?.name || ''} onChange={(e) => setEditing((p) => p && { ...p, name: e.target.value })} placeholder="如：某项目头像候选" />
            </div>
            <div>
              <label className="text-xs text-muted-foreground mb-1 block">备注（可选）</label>
              <Input value={editing?.description || ''} onChange={(e) => setEditing((p) => p && { ...p, description: e.target.value })} placeholder="用途说明" />
            </div>
            <div className="flex justify-end gap-2 pt-1">
              <Button variant="outline" size="sm" onClick={() => setEditing(null)}>取消</Button>
              <Button size="sm" onClick={saveEdit}>保存</Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* 删除确认 */}
      <AlertDialog open={!!confirmDelete} onOpenChange={(v) => !v && setConfirmDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertTitle>删除清单「{confirmDelete?.name}」？</AlertTitle>
            <AlertDialogDescription>将移除该清单及其中 {confirmDelete?.itemCount} 位画师的清单记录（不影响画师本身）。此操作不可撤销。</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>取消</AlertDialogCancel>
            <AlertDialogAction onClick={doDelete} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">删除</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}

// ── 加入清单对话框（供批量栏调用）─────────────────────────────
export function AddToShortlistDialog({
  open,
  onClose,
  supplierIds,
  onAdded,
}: {
  open: boolean;
  onClose: () => void;
  supplierIds: string[];
  onAdded?: () => void;
}) {
  const [lists, setLists] = useState<IShortlist[]>([]);
  const [loading, setLoading] = useState(false);
  const [creating, setCreating] = useState(false);
  const [newName, setNewName] = useState('');
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!open) return;
    setCreating(false);
    setNewName('');
    setLoading(true);
    shortlistApi.list().then(setLists).catch(() => toast.error('清单加载失败')).finally(() => setLoading(false));
  }, [open]);

  const addTo = async (id: string) => {
    setSubmitting(true);
    try {
      const r = await shortlistApi.addItems(id, supplierIds);
      toast.success(`已加入 ${r.added} 人${r.skipped ? `（${r.skipped} 人已在清单中）` : ''}`);
      onAdded?.();
      onClose();
    } catch {
      toast.error('加入失败');
    } finally {
      setSubmitting(false);
    }
  };

  const createAndAdd = async () => {
    const name = newName.trim();
    if (!name) { toast.error('请输入清单名称'); return; }
    setSubmitting(true);
    try {
      const created = await shortlistApi.create(name);
      const r = await shortlistApi.addItems(created.id, supplierIds);
      toast.success(`已创建「${name}」并加入 ${r.added} 人`);
      onAdded?.();
      onClose();
    } catch {
      toast.error('创建失败');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>加入候选清单（{supplierIds.length} 人）</DialogTitle>
        </DialogHeader>
        {creating ? (
          <div className="space-y-3">
            <Input value={newName} onChange={(e) => setNewName(e.target.value)} placeholder="新清单名称，如：某项目头像候选" autoFocus onKeyDown={(e) => e.key === 'Enter' && createAndAdd()} />
            <div className="flex justify-between">
              <Button variant="ghost" size="sm" onClick={() => setCreating(false)}>返回选择</Button>
              <Button size="sm" onClick={createAndAdd} disabled={submitting}>创建并加入</Button>
            </div>
          </div>
        ) : (
          <div className="space-y-3">
            <Button variant="outline" size="sm" className="w-full gap-1.5" onClick={() => setCreating(true)}>
              <PlusCircleIcon className="w-4 h-4" /> 新建清单并加入
            </Button>
            <ScrollArea className="max-h-64">
              {loading ? (
                <p className="text-sm text-muted-foreground text-center py-6">加载中…</p>
              ) : lists.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-6">还没有清单，点上方新建。</p>
              ) : (
                <div className="space-y-1.5">
                  {lists.map((l) => (
                    <button
                      key={l.id}
                      disabled={submitting}
                      className="w-full flex items-center gap-2 p-2.5 rounded-lg border border-border hover:border-primary/40 hover:bg-muted/40 text-left disabled:opacity-50"
                      onClick={() => addTo(l.id)}
                    >
                      <span className="flex-1 text-sm truncate">{l.name}</span>
                      <Badge variant="secondary" className="text-[10px]">{l.itemCount} 人</Badge>
                    </button>
                  ))}
                </div>
              )}
            </ScrollArea>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
