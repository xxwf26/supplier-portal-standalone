/** 供应商类型推断：名字优先，fallback 到数据库 supplierType 字段 */
export function inferSupplierType(
  name: string,
  supplierType: string | null | undefined,
): 'individual' | 'studio' | 'company' | 'artist' {
  if (name.includes('工作室')) return 'studio';
  if (name.includes('公司') || name.includes('有限') || name.includes('股份')) return 'company';
  switch (supplierType) {
    case '个人': return 'individual';
    case '艺术家': return 'artist';
    case '工作室': return 'studio';
    case '公司':
    case '个体工商户':
    case '一般企业': return 'company';
    default: return 'individual';
  }
}
