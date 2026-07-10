import { useEffect, useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Checkbox } from '@/components/ui/checkbox';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { ExternalLinkIcon, SearchIcon } from 'lucide-react';
import { cn } from '@/lib/utils';
import { PLATFORM_LABELS } from './supplierFormShared';
import type { RecommendCandidate } from '@/api/recommend';

/**
 * 链接推荐候选确认弹窗（单个画师）。
 * 展示 AI 联网搜到的候选主页链接，用户勾选确认后回填到平台链接。
 */
export function RecommendLinksDialog({
  open,
  onClose,
  name,
  candidates,
  loading,
  error,
  onConfirm,
}: {
  open: boolean;
  onClose: () => void;
  name: string;
  candidates: RecommendCandidate[];
  loading: boolean;
  error?: string;
  onConfirm: (selected: RecommendCandidate[]) => void;
}) {
  const [selected, setSelected] = useState<Set<number>>(new Set());

  // 候选变化时默认全选
  useEffect(() => {
    setSelected(new Set(candidates.map((_, i) => i)));
  }, [candidates]);

  const toggle = (i: number) =>
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(i)) next.delete(i);
      else next.add(i);
      return next;
    });

  const handleConfirm = () => {
    onConfirm(candidates.filter((_, i) => selected.has(i)));
  };

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-1.5">
            <SearchIcon className="w-4 h-4 text-primary" />
            AI 推荐链接 — {name}
          </DialogTitle>
          <DialogDescription className="sr-only">AI 联网搜索的候选主页链接，请确认后填入</DialogDescription>
        </DialogHeader>
        <p className="text-xs text-muted-foreground -mt-1">
          以下为 AI 联网搜索结果，{loading ? '搜索中…' : '请核对后勾选要填入的链接（可点链接新窗口打开核实）'}。
        </p>

        {loading ? (
          <div className="py-8 text-center text-sm text-muted-foreground">
            <SearchIcon className="w-6 h-6 mx-auto mb-2 animate-pulse text-primary" />
            正在联网搜索「{name}」的平台主页…
          </div>
        ) : error ? (
          <div className="py-6 text-center text-sm text-destructive">{error}</div>
        ) : candidates.length === 0 ? (
          <div className="py-6 text-center text-sm text-muted-foreground">
            未找到「{name}」的平台主页链接，可手动填写。
          </div>
        ) : (
          <ScrollArea className="max-h-80">
            <div className="space-y-1.5 pr-1">
              {candidates.map((c, i) => (
                <label
                  key={`${c.platform}-${c.url}-${i}`}
                  className="flex items-start gap-2 p-2.5 rounded-lg border border-border hover:bg-muted/40 cursor-pointer"
                >
                  <Checkbox checked={selected.has(i)} onCheckedChange={() => toggle(i)} className="mt-0.5" />
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
          </ScrollArea>
        )}

        <div className="flex justify-between items-center pt-1">
          <span className="text-[10px] text-muted-foreground">
            {!loading && !error && candidates.length > 0 && `已选 ${selected.size}/${candidates.length}`}
          </span>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={onClose}>取消</Button>
            <Button size="sm" onClick={handleConfirm} disabled={loading || !!error || selected.size === 0}>
              填入选中（{selected.size}）
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
