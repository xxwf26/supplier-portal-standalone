import * as XLSX from 'xlsx';
import type { ISupplier } from '@/api/types';

/** 把结构化字段拍平成可读文本，表头与导入模板一致，可往返 */
function priceText(s: ISupplier): string {
  const items = Array.isArray(s.priceItems) ? s.priceItems : [];
  if (items.length > 0) {
    return items.map((p) => `${p.cooperationType}:${p.unitPrice}${p.priceUnit || ''}`).join('；');
  }
  return s.priceRange || '';
}

function contactText(s: ISupplier): string {
  const items = Array.isArray(s.contactItems) ? s.contactItems : [];
  return items.map((c) => `${c.type}:${c.value}`).join('；');
}

function linkText(s: ISupplier): string {
  // 合并 social + manual，同平台多条链接合并去重；平台内多 url 用逗号、平台间用；
  const merged: Record<string, string[]> = {};
  const add = (m?: Record<string, string[]>) => {
    for (const [k, v] of Object.entries(m || {})) {
      const urls = Array.isArray(v) ? v : v ? [v as unknown as string] : [];
      merged[k] = Array.from(new Set([...(merged[k] || []), ...urls.filter(Boolean)]));
    }
  };
  add(s.socialLinks);
  add(s.manualLinks);
  return Object.entries(merged)
    .filter(([, urls]) => urls.length)
    .map(([k, urls]) => `${k}:${urls.join(',')}`)
    .join('；');
}

function dateOnly(v: string | null): string {
  return v ? String(v).slice(0, 10) : '';
}

/**
 * 导出画师为 Excel(.xlsx)。表头采用中文，与导入模板保持一致，便于往返编辑。
 * @param suppliers 原始画师数据（含合同/税务等全字段）
 * @param filename 不含扩展名
 */
export function exportSuppliersToExcel(suppliers: ISupplier[], filename = '画师导出') {
  const rows = suppliers.map((s) => ({
    '名称': s.accountName || '',
    '供应商类型': s.supplierType || '',
    '合作品类': s.cooperationCategory || '',
    '合作类型': s.cooperationType || '',
    '擅长风格': s.subCategory || '',
    '报价参考': priceText(s),
    '评分': s.rating ?? '',
    '合作频次': s.cooperationCount ?? 0,
    '风险状态': s.riskStatus || '',
    '是否库内': s.isInStock ? '是' : '否',
    '所属项目': s.entityType || '',
    '合同主体': s.contractEntity || '',
    '合同类型': s.contractType || '',
    '合同编号': s.contractNo || '',
    '合同到期日': dateOnly(s.contractDeadline),
    '税务状态': s.taxStatus || '',
    '联系方式': contactText(s),
    '平台链接': linkText(s),
    '备注': s.contactInfo || '',
  }));

  const ws = XLSX.utils.json_to_sheet(rows);
  // 适度列宽
  ws['!cols'] = [
    { wch: 18 }, { wch: 12 }, { wch: 12 }, { wch: 14 }, { wch: 20 },
    { wch: 20 }, { wch: 6 }, { wch: 8 }, { wch: 10 }, { wch: 8 },
    { wch: 12 }, { wch: 14 }, { wch: 12 }, { wch: 14 }, { wch: 12 },
    { wch: 12 }, { wch: 24 }, { wch: 28 }, { wch: 30 },
  ];
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, '画师');
  XLSX.writeFile(wb, `${filename}.xlsx`);
}
