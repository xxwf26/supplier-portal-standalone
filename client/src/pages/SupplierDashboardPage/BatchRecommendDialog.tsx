import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Checkbox } from '@/components/ui/checkbox';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { ExternalLinkIcon, SearchIcon, SparklesIcon } from 'lucide-react';
import { toast } from 'sonner';
import { recommendApi, type RecommendCandidate } from '@/api/recommend';
import { supplierApi } from '@/api/supplier';
import { normalizeLinkMap, PLATFORM_LABELS } from './supplierFormShared';
import type { ISupplier } from '@/api/types';

type Item = {
  supplier: Pick<ISupplier, 'id' | 'accountName' | 'manualLinks' | 'socialLinks'>;
  candidates: RecommendCandidate[];
  error?: string;
};

/**
 * 批量链接推荐弹窗。
 * 对传入的（缺链接）画师逐个联网搜索 → 分组展示候选 → 用户勾选 → 合并写回 manualLinks。
 */
export function BatchRecommendDialog({
  open,
  onClose,
  suppliers,
  onDone,
}: {
  open: boolean;
  onClose: () => void;
  suppliers: Pick<ISupplier, 'id' | 'accountName' | 'manualLinks' | 'socialLinks'>[];
  onDone?: () => void;
}) {
  const [phase, setPhase] = useState<'idle' | 'searching' | 'review' | 'applying'>('idle');
  const [progress, setProgress] = useState({ done: 0, total: 0 });
  const [items, setItems] = useState<Item[]>([]);
  const [selected, setSelected] = useState<Record<string, Set<number>>>({}); // supplierId -> 选中候选索引
  const [applying, setApplying] = useState(false);

  const reset = () => {
    setPhase('idle');
    setItems([]);
    setSelected({});
    setApplying(false);
  };

  const start = async () => {
    setPhase('searching');
    setProgress({ done: 0, total: suppliers.length });
    const results: Item[] = [];
    for (const s of suppliers) {
      try {
        const r = await recommendApi.recommendLinks(s.accountName);
        results.push({ supplier: s, candidates: r.ok ? r.candidates : [], error: r.ok ? undefined : r.reason });
      } catch (e: any) {
        results.push({ supplier: s, candidates: [], error: e?.message || '请求失败' });
      }
      setProgress({ done: results.length, total: suppliers.length });
    }
    // 默认全选每个画师的候选
    const sel: Record<string, Set<number>> = {};
    results.forEach((it) => {
      sel[it.supplier.id] = new Set(it.candidates.map((_, i) => i));
    });
    setItems(results);
    setSelected(sel);
    setPhase('review');
    const found = results.filter((r) => r.candidates.length > 0).length;
    toast.success(`搜索完成，${found}/${suppliers.length} 位画师找到候选链接`);
  };

  const toggle = (supplierId: string, i: number) =>
    setSelected((prev) => {
      const next = { ...prev };
      const set = new Set(next[supplierId] || []);
      if (set.has(i)) set.delete(i);
      else set.add(i);
      next[supplierId] = set;
      return next;
    });

  const totalSelected = Object.values(selected).reduce((acc, s) => acc + s.size, 0);

  const apply = async () => {
    setApplying(true);
    setPhase('applying');
    let updated = 0;
    for (const it of items) {
      const sel = selected[it.supplier.id];
      if (!sel || sel.size === 0) continue;
      const chosen = it.candidates.filter((_, i) => sel.has(i));
      if (!chosen.length) continue;
      // 合并进现有 manualLinks（按平台分组、url 去重）
      const merged = normalizeLinkMap(it.supplier.manualLinks);
      for (const c of chosen) {
        const arr = merged[c.platform] ? [...merged[c.platform]] : [];
        if (!arr.includes(c.url)) arr.push(c.url);
        merged[c.platform] = arr;
      }
      try {
        await supplierApi.update(it.supplier.id, { manualLinks: merged });
        updated++;
      } catch {
        // 单个失败不中断
      }
    }
    setApplying(false);
    toast.success(`已为 ${updated} 位画师填入推荐链接`);
    onDone?.();
    reset();
    onClose();
  };

  const hasCandidates = items.some((it) => it.candidates.length > 0);

  return (
    <Dialog
      open={open}
      onOpenChange={(v) => {
        if (!v) {
          reset();
          onClose();
        }
      }}
    >
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-1.5">
            <SparklesIcon className="w-4 h-4 text-primary" />
            批量推荐链接（{suppliers.length} 位画师）
          </DialogTitle>
          <DialogDescription className="sr-only">批量联网搜索画师主页链接并确认填入</DialogDescription>
        </DialogHeader>

        {phase === 'idle' && (
          <div className="space-y-3">
            <p className="text-sm text-muted-foreground">
              将对选中的 <b>{suppliers.length}</b> 位（缺平台链接的）画师逐个联网搜索主页链接，搜完后再由你勾选确认。
            </p>
            <p className="text-xs text-amber-600 bg-amber-50 border border-amber-200 rounded p-2">
              ⚠️ 联网搜索按次计费、耗时较长（每位约 10–30 秒），人数多时请耐心等待。
            </p>
            <div className="flex justify-end gap-2">
              <Button variant="outline" size="sm" onClick={onClose}>取消</Button>
              <Button size="sm" onClick={start} disabled={suppliers.length === 0}>
                <SearchIcon className="w-3.5 h-3.5 mr-1" /> 开始推荐
              </Button>
            </div>
          </div>
        )}

        {phase === 'searching' && (
          <div className="py-8 text-center text-sm text-muted-foreground">
            <SearchIcon className="w-6 h-6 mx-auto mb-2 animate-pulse text-primary" />
            联网搜索中… {progress.done}/{progress.total}
          </div>
        )}

        {(phase === 'review' || phase === 'applying') && (
          <>
            <p className="text-xs text-muted-foreground">
              已选 {totalSelected} 条候选。核对无误后点「应用选中」填入；可点链接新窗口打开核实。
            </p>
            <ScrollArea className="max-h-[55vh]">
              <div className="space-y-3 pr-1">
                {items.map((it) => (
                  <div key={it.supplier.id} className="rounded-lg border border-border p-2.5">
                    <div className="flex items-center justify-between mb-1.5">
                      <span className="text-sm font-medium truncate">{it.supplier.accountName}</span>
                      {it.candidates.length === 0 && (
                        <span className="text-[10px] text-muted-foreground">{it.error ? '搜索失败' : '未找到'}</span>
                      )}
                    </div>
                    {it.candidates.length > 0 && (
                      <div className="space-y-1.5">
                        {it.candidates.map((c, i) => (
                          <label key={i} className="flex items-start gap-2 p-1.5 rounded hover:bg-muted/40 cursor-pointer">
                            <Checkbox
                              checked={selected[it.supplier.id]?.has(i) ?? false}
                              onCheckedChange={() => toggle(it.supplier.id, i)}
                              className="mt-0.5"
                            />
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-1.5 mb-0.5">
                                <Badge variant="outline" className="text-[10px] bg-muted/30 shrink-0">
                                  {PLATFORM_LABELS[c.platform] || c.platform}
                                </Badge>
                                {c.title && <span className="text-xs text-muted-foreground truncate">{c.title}</span>}
                              </div>
                              <a
                                href={c.url}
                                target="_blank"
                                rel="noopener noreferrer"
                                onClick={(e) => e.stopPropagation()}
                                className="text-xs text-blue-600 hover:underline break-all inline-flex items-center gap-0.5"
                              >
                                {c.url}
                                <ExternalLinkIcon className="w-2.5 h-2.5 shrink-0" />
                              </a>
                            </div>
                          </label>
                        ))}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </ScrollArea>
            <div className="flex justify-end gap-2 pt-1">
              <Button variant="outline" size="sm" onClick={() => { reset(); onClose(); }}>取消</Button>
              <Button size="sm" onClick={apply} disabled={applying || totalSelected === 0}>
                {applying ? '应用中…' : `应用选中（${totalSelected}）`}
              </Button>
            </div>
          </>
        )}

        {!hasCandidates && phase === 'review' && (
          <p className="text-xs text-muted-foreground text-center">没有搜到任何候选链接，可关闭后手动填写。</p>
        )}
      </DialogContent>
    </Dialog>
  );
}
