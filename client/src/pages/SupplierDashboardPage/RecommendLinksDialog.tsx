import { useEffect, useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Checkbox } from '@/components/ui/checkbox';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import { ExternalLinkIcon, SearchIcon, PlusIcon } from 'lucide-react';
import { PLATFORM_OPTIONS, PLATFORM_LABELS } from './supplierFormShared';
import type { RecommendCandidate } from '@/api/recommend';

/** 小红书主页不被搜索引擎收录、AI 搜不到，由用户在自己浏览器（已登录）手动搜索补充。
 *  微博/B站/P站等公开可搜平台由 AI 直接给主页链接，不放在这里。 */
const PLATFORM_SEARCH_URLS: { platform: string; label: string; url: (name: string) => string }[] = [
  { platform: 'xiaohongshu', label: '小红书', url: (n) => `https://www.xiaohongshu.com/search_result?keyword=${encodeURIComponent(n)}` },
];

/**
 * 链接推荐候选确认弹窗（单个画师）。
 * 展示 AI 联网搜到的候选主页链接；同时提供"手动搜索"入口——点击跳转各平台搜索页
 * （自动填入画师名），用户在自己浏览器找到主页后复制链接粘贴回来加入。最终勾选确认后回填。
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
  const [extra, setExtra] = useState<RecommendCandidate[]>([]); // 用户手动粘贴加入的
  const [pastePlatform, setPastePlatform] = useState('xiaohongshu');
  const [pasteUrl, setPasteUrl] = useState('');

  // 候选变化时默认全选（仅 AI 候选，手动加入的也默认选中）
  useEffect(() => {
    setSelected(new Set(candidates.map((_, i) => i)));
    setExtra([]);
    setPasteUrl('');
  }, [candidates]);

  const all = [...candidates, ...extra];

  const toggle = (i: number) =>
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(i)) next.delete(i);
      else next.add(i);
      return next;
    });

  const addPasted = () => {
    const url = pasteUrl.trim();
    if (!url) return;
    if (!/^https?:\/\//i.test(url)) return;
    if (all.some((c) => c.url === url)) { setPasteUrl(''); return; }
    setExtra((prev) => [...prev, { platform: pastePlatform, url, title: '手动加入' }]);
    setSelected((prev) => new Set(prev).add(all.length)); // 选中刚加入的
    setPasteUrl('');
  };

  const handleConfirm = () => {
    onConfirm(all.filter((_, i) => selected.has(i)));
  };

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-1.5">
            <SearchIcon className="w-4 h-4 text-primary" />
            AI 推荐链接 — {name}
          </DialogTitle>
          <DialogDescription className="sr-only">AI 联网搜索的候选主页链接，可手动搜索加入，确认后填入</DialogDescription>
        </DialogHeader>

        {/* 手动搜索入口：点击跳转各平台搜索页（自动填入画师名），用户在自己浏览器登录态下搜 */}
        <div className="rounded-md border border-blue-200 bg-blue-50/50 p-2 space-y-1.5">
          <p className="text-[10px] text-muted-foreground">
            小红书主页 AI 搜不到？点这里在小红书搜索「{name}」（在你自己浏览器里，已登录可直接看结果），找到主页后复制链接粘贴到下方加入：
          </p>
          <div className="flex flex-wrap gap-1.5">
            {PLATFORM_SEARCH_URLS.map((p) => (
              <a
                key={p.platform}
                href={p.url(name)}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1 px-2 py-1 rounded-full text-[11px] bg-white border border-border hover:border-primary hover:text-primary transition-colors"
              >
                {p.label}
                <ExternalLinkIcon className="w-2.5 h-2.5" />
              </a>
            ))}
          </div>
          {/* 粘贴加入 */}
          <div className="flex items-center gap-1.5 pt-0.5">
            <Select value={pastePlatform} onValueChange={setPastePlatform}>
              <SelectTrigger className="w-[90px] shrink-0 h-7 text-xs">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {PLATFORM_OPTIONS.map((o) => (
                  <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Input
              placeholder="粘贴找到的主页链接 https://..."
              value={pasteUrl}
              onChange={(e) => setPasteUrl(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); addPasted(); } }}
              className="flex-1 h-7 text-xs"
            />
            <Button variant="outline" size="sm" onClick={addPasted} disabled={!pasteUrl.trim()} className="h-7 px-2 shrink-0">
              <PlusIcon className="w-3 h-3" />
            </Button>
          </div>
        </div>

        {/* 候选列表 */}
        {loading ? (
          <div className="py-8 text-center text-sm text-muted-foreground">
            <SearchIcon className="w-6 h-6 mx-auto mb-2 animate-pulse text-primary" />
            正在联网搜索「{name}」的平台主页…
          </div>
        ) : error ? (
          <div className="py-6 text-center text-sm text-destructive">{error}</div>
        ) : all.length === 0 ? (
          <div className="py-4 text-center text-sm text-muted-foreground">
            AI 未找到候选，可用上方手动搜索加入。
          </div>
        ) : (
          <ScrollArea className="max-h-72">
            <div className="space-y-1.5 pr-1">
              {all.map((c, i) => (
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
            {!loading && all.length > 0 && `已选 ${selected.size}/${all.length}`}
          </span>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={onClose}>取消</Button>
            <Button size="sm" onClick={handleConfirm} disabled={loading || selected.size === 0}>
              填入选中（{selected.size}）
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
