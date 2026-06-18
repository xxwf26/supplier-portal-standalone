/** 供应商类型：全站唯一的 4 种中文全称，与前端 client/src/lib/supplierUtils.ts 保持一致 */
export type SupplierType = '个人画师' | '艺术家' | '工作室' | '公司';

export const SUPPLIER_TYPES: SupplierType[] = ['个人画师', '艺术家', '工作室', '公司'];

/**
 * 归一化供应商类型 → 4 种中文全称之一。存储值优先，空/脏值时按名字与旧值兜底。
 * 与前端 normalizeSupplierType 逻辑一致，作为入库前的最后一道白名单。
 */
export function normalizeSupplierType(
  supplierType: string | null | undefined,
  name = '',
): SupplierType {
  if (
    supplierType === '个人画师' ||
    supplierType === '艺术家' ||
    supplierType === '工作室' ||
    supplierType === '公司'
  ) {
    return supplierType;
  }
  if (name.includes('工作室')) return '工作室';
  if (name.includes('公司') || name.includes('有限') || name.includes('股份')) return '公司';
  switch (supplierType) {
    case '个体工商户':
    case '一般企业':
      return '公司';
    case '个人':
    default:
      return '个人画师';
  }
}
