import React, { useState, useRef, useCallback } from 'react';
import { UploadIcon, FileSpreadsheetIcon, CheckCircleIcon, XCircleIcon, AlertTriangleIcon, ChevronLeftIcon, ChevronRightIcon } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';

import { supplierApi } from '@/api/supplier';
import { logger } from '@/lib/polyfills/logger';
import { normalizeSupplierType } from '@/lib/supplierUtils';
import { toast } from 'sonner';
import * as XLSX from 'xlsx';

type Phase = 'upload' | 'preview' | 'result';

interface IBatchResult {
  successCount: number;
  failCount: number;
  errors: { row: number; name: string; reason: string }[];
}

interface ColumnMap {
  excelCol: string;
  field: string;
  label: string;
}

const FIELD_MAPPING: Record<string, string> = {
  '名称': 'accountName',
  '账号名称': 'accountName',
  '账号名': 'accountName',
  '供应商类型': 'supplierType',
  '类型': 'supplierType',
  '擅长风格': 'subCategory',
  '风格': 'subCategory',
  '子品类': 'subCategory',
  '合作类型': 'cooperationType',
  '报价参考': 'priceRange',
  '报价': 'priceRange',
  '价格': 'priceRange',
  '合作频次': 'cooperationCount',
  '频次': 'cooperationCount',
  '评分': 'rating',
  '风险状态': 'riskStatus',
  '是否库内': 'isInStock',
  '所属项目': 'entityType',
  '项目': 'entityType',
  '合同主体': 'contractEntity',
  '合同类型': 'contractType',
  '合同编号': 'contractNo',
  '合同到期日': 'contractDeadline',
  '税务状态': 'taxStatus',
  '联系方式': 'contactInfo',
  '备注': 'contactInfo',
  '合作品类': 'cooperationCategory',
  '品类': 'cooperationCategory',
  '微博': 'socialLink_weibo',
  'B站': 'socialLink_bilibili',
  'bilibili': 'socialLink_bilibili',
  'Pixiv': 'socialLink_pixiv',
  'pixiv': 'socialLink_pixiv',
  '小红书': 'socialLink_xiaohongshu',
  '米画师': 'socialLink_mihuashi',
  'X': 'socialLink_x',
  '推特': 'socialLink_x',
};

const FIELD_LABELS: Record<string, string> = {
  accountName: '名称',
  supplierType: '供应商类型',
  subCategory: '擅长风格',
  cooperationType: '合作类型',
  priceRange: '报价参考',
  cooperationCount: '合作频次',
  rating: '评分',
  riskStatus: '风险状态',
  isInStock: '是否库内',
  entityType: '所属项目',
  contractEntity: '合同主体',
  contractType: '合同类型',
  contractNo: '合同编号',
  contractDeadline: '合同到期日',
  taxStatus: '税务状态',
  contactInfo: '备注',
  cooperationCategory: '合作品类',
};

function mapRow(row: Record<string, unknown>, columnMaps: ColumnMap[]): Partial<Record<string, unknown>> {
  const result: Record<string, unknown> = {};
  const socialLinks: Record<string, string[]> = {};

  for (const mapping of columnMaps) {
    const rawValue = row[mapping.excelCol];
    if (rawValue === undefined || rawValue === null || rawValue === '') continue;
    const strValue = String(rawValue).trim();

    if (mapping.field.startsWith('socialLink_')) {
      const platform = mapping.field.replace('socialLink_', '');
      // 单元格可能是导出时逗号分隔的多条链接（url1,url2），拆开并去重
      const urls = Array.from(
        new Set(strValue.split(/[,，]/).map((u) => u.trim()).filter(Boolean)),
      );
      if (urls.length) socialLinks[platform] = urls;
    } else {
      result[mapping.field] = strValue;
    }
  }

  if (Object.keys(socialLinks).length > 0) {
    result.socialLinks = socialLinks;
  }

  if (result.cooperationCount !== undefined) {
    result.cooperationCount = parseInt(String(result.cooperationCount), 10) || 0;
  }
  if (result.rating !== undefined) {
    result.rating = parseInt(String(result.rating), 10) || null;
  }
  if (result.isInStock !== undefined) {
    const v = String(result.isInStock).toLowerCase();
    result.isInStock = v === '是' || v === 'true' || v === '1' || v === 'yes';
  }
  // 供应商类型归一化：导入的任意写法统一到 4 种中文全称，杜绝脏值入库
  if (result.supplierType !== undefined) {
    result.supplierType = normalizeSupplierType(
      String(result.supplierType),
      String(result.accountName || ''),
    );
  }

  return result;
}

interface ExcelImportModalProps {
  open: boolean;
  onClose: () => void;
  onImportComplete: () => void;
}

export default function ExcelImportModal({ open, onClose, onImportComplete }: ExcelImportModalProps) {
  const [phase, setPhase] = useState<Phase>('upload');
  const [rawData, setRawData] = useState<Record<string, unknown>[]>([]);
  const [columnMaps, setColumnMaps] = useState<ColumnMap[]>([]);
  const [importing, setImporting] = useState(false);
  const [result, setResult] = useState<IBatchResult | null>(null);
  const [fileName, setFileName] = useState('');
  const [previewPage, setPreviewPage] = useState(1);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const PREVIEW_PAGE_SIZE = 20;

  const reset = () => {
    setPhase('upload');
    setRawData([]);
    setColumnMaps([]);
    setResult(null);
    setImporting(false);
    setFileName('');
    setPreviewPage(1);
    setConfirmOpen(false);
  };

  const handleClose = () => {
    if (phase === 'result' && result && result.successCount > 0) {
      onImportComplete();
    }
    reset();
    onClose();
  };

  const inferColumnMappings = (headers: string[]): ColumnMap[] => {
    const maps: ColumnMap[] = [];
    const usedFields = new Set<string>();

    for (const header of headers) {
      const trimmed = header.trim();
      const field = FIELD_MAPPING[trimmed];
      if (field && !usedFields.has(field)) {
        maps.push({
          excelCol: trimmed,
          field,
          label: FIELD_LABELS[field] || field,
        });
        usedFields.add(field);
      }
    }

    return maps;
  };

  const handleFileSelect = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setFileName(file.name);

    try {
      const buffer = await file.arrayBuffer();
      const workbook = XLSX.read(buffer, { type: 'array' });
      const firstSheet = workbook.Sheets[workbook.SheetNames[0]];
      const jsonData = XLSX.utils.sheet_to_json<Record<string, unknown>>(firstSheet, { defval: '' });

      if (jsonData.length === 0) {
        toast.error('Excel 文件中没有数据');
        return;
      }

      if (jsonData.length > 500) {
        toast.error('单次导入最多 500 条记录');
        return;
      }

      const headers = Object.keys(jsonData[0]);
      const mappings = inferColumnMappings(headers);

      if (mappings.length === 0) {
        toast.error('无法识别任何列，请检查表头是否包含"名称"、"供应商类型"等字段');
        return;
      }

      const hasAccountName = mappings.some((m) => m.field === 'accountName');
      if (!hasAccountName) {
        toast.error('未找到"名称"列，请确保 Excel 包含"名称"或"账号名称"列');
        return;
      }

      setRawData(jsonData);
      setColumnMaps(mappings);
      setPreviewPage(1);
      setPhase('preview');
    } catch (err) {
      logger.error('Excel parse error:', String(err));
      toast.error('Excel 解析失败，请确认文件格式正确');
    }

    e.target.value = '';
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    const file = e.dataTransfer.files[0];
    if (!file) return;

    const validTypes = [
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'application/vnd.ms-excel',
    ];
    if (!validTypes.includes(file.type) && !file.name.endsWith('.xlsx') && !file.name.endsWith('.xls')) {
      toast.error('请上传 .xlsx 或 .xls 格式的文件');
      return;
    }

    const input = fileInputRef.current;
    if (input) {
      const dt = new DataTransfer();
      dt.items.add(file);
      input.files = dt.files;
      input.dispatchEvent(new Event('change', { bubbles: true }));
    }
  }, []);

  const handleImport = async () => {
    setImporting(true);
    try {
      const items = rawData.map((row) => mapRow(row, columnMaps));
      const validItems = items.filter((item) => {
        if (!item.accountName) return false;
        // M-4：字段级校验
        const name = String(item.accountName).trim();
        if (name.length > 200) { item.accountName = name.slice(0, 200); }
        if (item.rating !== undefined && item.rating !== null) {
          const r = Number(item.rating);
          if (isNaN(r) || r < 1 || r > 5) item.rating = undefined;
        }
        if (item.cooperationCount !== undefined) {
          const c = Number(item.cooperationCount);
          item.cooperationCount = isNaN(c) ? 0 : Math.max(0, Math.min(9999, c));
        }
        return true;
      });
      const invalidCount = items.length - validItems.length;
      if (invalidCount > 0) {
        toast.warning(`跳过 ${invalidCount} 条无效数据（名称为空）`);
      }

      if (validItems.length === 0) {
        toast.error('没有有效数据可导入');
        setImporting(false);
        setConfirmOpen(false);
        return;
      }

      const res = await supplierApi.batchCreate(validItems);
      setResult(res);
      setConfirmOpen(false);
      setPhase('result');

      if (res.successCount > 0) {
        toast.success(`成功导入 ${res.successCount} 条供应商数据`);
      }
      if (res.failCount > 0) {
        toast.warning(`${res.failCount} 条数据导入失败`);
      }
    } catch (err) {
      logger.error('Batch import failed:', String(err));
      toast.error('批量导入失败，请重试');
      setConfirmOpen(false);
    } finally {
      setImporting(false);
    }
  };

  const totalPages = Math.max(1, Math.ceil(rawData.length / PREVIEW_PAGE_SIZE));
  const pageStart = (previewPage - 1) * PREVIEW_PAGE_SIZE;
  const previewRows = rawData.slice(pageStart, pageStart + PREVIEW_PAGE_SIZE);
  const mappedFields = columnMaps.map((m) => m.field);

  return (
    <Dialog open={open} onOpenChange={importing ? undefined : handleClose}>
      <DialogContent
        aria-describedby={undefined}
        className="max-w-3xl w-full max-h-[85vh] p-0 overflow-hidden flex flex-col"
        onPointerDownOutside={(e) => importing && e.preventDefault()}
        onEscapeKeyDown={(e) => importing && e.preventDefault()}
      >
        <DialogHeader className="px-6 pt-6 pb-4 border-b border-border shrink-0">
          <DialogTitle className="text-lg font-bold flex items-center gap-2">
            <FileSpreadsheetIcon className="w-5 h-5 text-primary" />
            导入供应商
          </DialogTitle>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto px-6 py-4">
            {phase === 'upload' && (
              <div
                className="border-2 border-dashed border-border rounded-xl p-12 text-center hover:border-primary/50 transition-colors cursor-pointer"
                onClick={() => fileInputRef.current?.click()}
                onDrop={handleDrop}
                onDragOver={(e) => e.preventDefault()}
              >
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".xlsx,.xls"
                  className="hidden"
                  onChange={handleFileSelect}
                />
                <UploadIcon className="w-12 h-12 text-muted-foreground/40 mx-auto mb-4" />
                <p className="text-sm font-medium text-foreground mb-1">
                  点击上传或拖拽 Excel 文件到此处
                </p>
                <p className="text-xs text-muted-foreground">
                  支持 .xlsx / .xls 格式，单次最多 500 条
                </p>
                <div className="mt-6 text-left max-w-md mx-auto">
                  <p className="text-xs font-medium text-muted-foreground mb-2">表头字段参考：</p>
                  <div className="flex flex-wrap gap-1.5">
                    {Object.keys(FIELD_MAPPING).filter((k, i) => i < 12).map((name) => (
                      <Badge key={name} variant="outline" className="text-[10px] bg-muted/50">
                        {name}
                      </Badge>
                    ))}
                  </div>
                </div>
              </div>
            )}

            {phase === 'preview' && (
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-foreground">
                      文件: {fileName}
                    </p>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      共 {rawData.length} 条数据，已识别 {columnMaps.length} 个字段
                      {rawData.map(r => mapRow(r, columnMaps)).filter(i => !i.accountName).length > 0 && (
                        <span className="text-orange-500 ml-2">
                          ⚠ {rawData.map(r => mapRow(r, columnMaps)).filter(i => !i.accountName).length} 条名称为空将被跳过
                        </span>
                      )}
                    </p>
                  </div>
                  <Button variant="outline" size="sm" onClick={() => { setPhase('upload'); setRawData([]); setColumnMaps([]); }}>
                    重新选择
                  </Button>
                </div>

                <div className="space-y-2">
                  <p className="text-xs font-medium text-muted-foreground">已映射字段：</p>
                  <div className="flex flex-wrap gap-1.5">
                    {columnMaps.map((m) => (
                      <Badge key={m.field} variant="outline" className="text-[10px] bg-primary/5 text-primary border-primary/20">
                        {m.excelCol} → {m.label}
                      </Badge>
                    ))}
                  </div>
                </div>

                <div>
                  <p className="text-xs font-medium text-muted-foreground mb-2">
                    数据预览（全部 {rawData.length} 条，第 {pageStart + 1}-{Math.min(pageStart + PREVIEW_PAGE_SIZE, rawData.length)} 条）：
                  </p>
                  <div className="border border-border rounded-lg overflow-x-auto">
                    <table className="w-full text-xs">
                      <thead>
                        <tr className="bg-muted/50">
                          <th className="px-3 py-2 text-left font-medium text-muted-foreground">
                            #
                          </th>
                          {mappedFields.map((field) => (
                            <th key={field} className="px-3 py-2 text-left font-medium text-muted-foreground whitespace-nowrap">
                              {FIELD_LABELS[field] || field}
                            </th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {previewRows.map((row, i) => {
                          const mapped = mapRow(row, columnMaps);
                          return (
                            <tr key={pageStart + i} className="border-t border-border/50">
                              <td className="px-3 py-1.5 text-muted-foreground">{pageStart + i + 1}</td>
                              {mappedFields.map((field) => {
                                let value = mapped[field];
                                if (field === 'socialLinks' && typeof value === 'object' && value) {
                                  value = Object.keys(value as Record<string, string>).length + ' 个链接';
                                }
                                return (
                                  <td key={field} className="px-3 py-1.5 text-foreground max-w-[200px] truncate">
                                    {value !== undefined && value !== null ? String(value) : '-'}
                                  </td>
                                );
                              })}
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>

                  {totalPages > 1 && (
                    <div className="flex items-center justify-center gap-3 mt-3">
                      <Button
                        variant="outline"
                        size="sm"
                        className="h-7 px-2 gap-1 text-xs"
                        disabled={previewPage <= 1}
                        onClick={() => setPreviewPage((p) => Math.max(1, p - 1))}
                      >
                        <ChevronLeftIcon className="w-3.5 h-3.5" />
                        上一页
                      </Button>
                      <span className="text-xs text-muted-foreground tabular-nums">
                        第 {previewPage} / {totalPages} 页
                      </span>
                      <Button
                        variant="outline"
                        size="sm"
                        className="h-7 px-2 gap-1 text-xs"
                        disabled={previewPage >= totalPages}
                        onClick={() => setPreviewPage((p) => Math.min(totalPages, p + 1))}
                      >
                        下一页
                        <ChevronRightIcon className="w-3.5 h-3.5" />
                      </Button>
                    </div>
                  )}
                </div>
              </div>
            )}

            {phase === 'result' && result && (
              <div className="space-y-6 py-4">
                <div className="flex flex-col items-center text-center">
                  {result.failCount === 0 ? (
                    <CheckCircleIcon className="w-16 h-16 text-green-500 mb-3" />
                  ) : (
                    <AlertTriangleIcon className="w-16 h-16 text-amber-500 mb-3" />
                  )}
                  <h3 className="text-lg font-bold text-foreground">
                    {result.failCount === 0 ? '导入成功' : '导入完成（部分失败）'}
                  </h3>
                  <p className="text-sm text-muted-foreground mt-1">
                    成功 {result.successCount} 条
                    {result.failCount > 0 && `，失败 ${result.failCount} 条`}
                  </p>
                </div>

                {result.errors.length > 0 && (
                  <div className="border border-destructive/20 rounded-lg p-4 bg-destructive/5">
                    <p className="text-sm font-medium text-destructive mb-2">失败详情：</p>
                    <div className="space-y-1 max-h-[200px] overflow-y-auto">
                      {result.errors.map((err, i) => (
                        <p key={i} className="text-xs text-muted-foreground">
                          第 {err.row} 行 [{err.name}]：{err.reason}
                        </p>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>

        {phase === 'preview' && (
          <div className="px-6 py-4 border-t border-border flex justify-end gap-2 shrink-0">
            <Button variant="outline" onClick={() => { setPhase('upload'); setRawData([]); setColumnMaps([]); }}>
              取消
            </Button>
            <Button onClick={() => setConfirmOpen(true)} disabled={importing}>
              {importing ? '导入中...' : `确认导入 ${rawData.length} 条`}
            </Button>
          </div>
        )}

        <AlertDialog open={confirmOpen} onOpenChange={(v) => { if (!importing) setConfirmOpen(v); }}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>确认导入数据？</AlertDialogTitle>
              <AlertDialogDescription>
                即将向数据库导入 {rawData.length} 条供应商数据，已识别 {columnMaps.length} 个字段。
                导入后数据会立即写入，请确认无误后继续。
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel disabled={importing}>取消</AlertDialogCancel>
              <AlertDialogAction
                disabled={importing}
                onClick={(e) => { e.preventDefault(); handleImport(); }}
              >
                {importing ? '导入中...' : '确定导入'}
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>

        {phase === 'result' && (
          <div className="px-6 py-4 border-t border-border flex justify-end shrink-0">
            <Button onClick={handleClose}>完成</Button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
