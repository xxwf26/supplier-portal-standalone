import React from 'react';
import { Table, TableHeader, TableBody, TableHead, TableRow, TableCell } from '@/components/ui/table';
import { Checkbox } from '@/components/ui/checkbox';
import { Badge } from '@/components/ui/badge';
import { StarIcon, ArrowUpIcon, ArrowDownIcon } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { IProcessedSupplier } from './SupplierGridSection';
import { cardDeadlineStatus } from './SupplierGridSection';
import type { SortKey } from './SupplierDashboardPage';

const STATUS_LABEL: Record<string, { label: string; color: string }> = {
  in_stock: { label: '库内合作', color: 'bg-green-50 text-green-600 border-green-200' },
  outreach: { label: '库外建联', color: 'bg-blue-50 text-blue-600 border-blue-200' },
  blacklisted: { label: '已拉黑', color: 'bg-gray-50 text-gray-500 border-gray-200' },
  unset: { label: '未填写', color: 'bg-orange-50 text-orange-500 border-orange-200' },
};

function priceText(s: IProcessedSupplier): string {
  if (s.priceItems && s.priceItems.length > 0) {
    return s.priceItems.map((p) => `${p.cooperationType}:${p.unitPrice}${p.priceUnit || ''}`).join('；');
  }
  return s.priceText || '';
}

function SortHeader({
  label,
  descKey,
  ascKey,
  sortKey,
  onSort,
  className,
}: {
  label: string;
  descKey: SortKey;
  ascKey?: SortKey;
  sortKey: SortKey;
  onSort: (k: SortKey) => void;
  className?: string;
}) {
  const isDesc = sortKey === descKey;
  const isAsc = ascKey && sortKey === ascKey;
  const next: SortKey = isDesc && ascKey ? ascKey : descKey;
  return (
    <TableHead className={cn('cursor-pointer select-none whitespace-nowrap', className)} onClick={() => onSort(next)}>
      <span className="inline-flex items-center gap-1">
        {label}
        {isDesc && <ArrowDownIcon className="w-3 h-3" />}
        {isAsc && <ArrowUpIcon className="w-3 h-3" />}
      </span>
    </TableHead>
  );
}

export default function SupplierTableSection({
  suppliers,
  onSelect,
  selectedIds = new Set<string>(),
  onToggleSelect,
  isAdmin = false,
  sortKey,
  onSort,
}: {
  suppliers: IProcessedSupplier[];
  onSelect: (s: IProcessedSupplier) => void;
  selectedIds?: Set<string>;
  onToggleSelect?: (id: string) => void;
  isAdmin?: boolean;
  sortKey: SortKey;
  onSort: (k: SortKey) => void;
}) {
  return (
    <div className="rounded-lg border border-border overflow-x-auto bg-card">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className="w-10"></TableHead>
            <TableHead className="min-w-[140px]">名称</TableHead>
            <TableHead className="whitespace-nowrap">类型</TableHead>
            {isAdmin && <TableHead className="whitespace-nowrap">合作状态</TableHead>}
            <SortHeader label="评分" descKey="ratingDesc" ascKey="ratingAsc" sortKey={sortKey} onSort={onSort} />
            <SortHeader label="频次" descKey="countDesc" ascKey="countAsc" sortKey={sortKey} onSort={onSort} />
            <TableHead className="min-w-[120px]">擅长风格</TableHead>
            <TableHead className="min-w-[120px]">报价</TableHead>
            {isAdmin && <TableHead className="min-w-[120px]">联系方式</TableHead>}
            {isAdmin && <TableHead className="whitespace-nowrap">合同到期</TableHead>}
            <SortHeader label="更新时间" descKey="recent" sortKey={sortKey} onSort={onSort} className="whitespace-nowrap" />
          </TableRow>
        </TableHeader>
        <TableBody>
          {suppliers.map((s) => {
            const st = STATUS_LABEL[s.status] || STATUS_LABEL.unset;
            const dl = cardDeadlineStatus(s.contractDeadline);
            return (
              <TableRow key={s.id} className="cursor-pointer" onClick={() => onSelect(s)}>
                <TableCell onClick={(e) => e.stopPropagation()}>
                  <Checkbox
                    checked={selectedIds.has(s.id)}
                    onCheckedChange={() => onToggleSelect?.(s.id)}
                  />
                </TableCell>
                <TableCell className="font-medium">{s.name}</TableCell>
                <TableCell className="whitespace-nowrap text-xs">{s.type}</TableCell>
                {isAdmin && (
                  <TableCell>
                    <Badge variant="outline" className={cn('text-[10px] border', st.color)}>{st.label}</Badge>
                  </TableCell>
                )}
                <TableCell className="whitespace-nowrap">
                  {s.rating != null ? (
                    <span className="inline-flex items-center gap-0.5"><StarIcon className="w-3 h-3 fill-amber-400 text-amber-400" />{s.rating}</span>
                  ) : <span className="text-muted-foreground">-</span>}
                </TableCell>
                <TableCell className="tabular-nums">{s.cooperationCount}</TableCell>
                <TableCell>
                  <div className="flex flex-wrap gap-1 max-w-[180px]">
                    {s.styles.slice(0, 3).map((st2) => (
                      <span key={st2} className="text-[10px] px-1.5 py-0.5 rounded-full bg-muted text-muted-foreground">{st2}</span>
                    ))}
                    {s.styles.length > 3 && <span className="text-[10px] text-muted-foreground">+{s.styles.length - 3}</span>}
                  </div>
                </TableCell>
                <TableCell className="text-xs max-w-[180px] truncate">{priceText(s) || <span className="text-muted-foreground">-</span>}</TableCell>
                {isAdmin && (
                  <TableCell className="text-xs max-w-[180px] truncate">
                    {s.contactItems && s.contactItems.length > 0
                      ? s.contactItems.map((c) => `${c.type}:${c.value}`).join('；')
                      : <span className="text-muted-foreground">-</span>}
                  </TableCell>
                )}
                {isAdmin && (
                  <TableCell className="whitespace-nowrap">
                    {dl ? <Badge variant="outline" className={cn('text-[10px] border', dl.className)}>{dl.label}</Badge> : <span className="text-muted-foreground text-xs">-</span>}
                  </TableCell>
                )}
                <TableCell className="whitespace-nowrap text-xs text-muted-foreground">
                  {s.updatedAt ? new Date(s.updatedAt).toLocaleDateString('zh-CN') : '-'}
                </TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
    </div>
  );
}
