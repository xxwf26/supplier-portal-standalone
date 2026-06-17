import {
  AwardIcon,
  Building2Icon,
  PaletteIcon,
  UserIcon,
} from 'lucide-react';

/** 供应商类型：全站唯一的 4 种中文全称，数据库存储 / 显示 / 筛选三处一致 */
export type SupplierType = '个人画师' | '艺术家' | '工作室' | '公司';

/** 4 种类型的权威顺序（用于遍历、统计、下拉等） */
export const SUPPLIER_TYPES: SupplierType[] = ['个人画师', '艺术家', '工作室', '公司'];

/**
 * 归一化供应商类型 → 4 种中文全称之一。
 * 存储值优先：已是 4 种全称则原样返回（数据库为权威来源）；
 * 否则按名字与旧值兜底（兼容历史脏值 / NULL / Excel 导入）。
 */
export function normalizeSupplierType(
  supplierType: string | null | undefined,
  name = '',
): SupplierType {
  // 已规范：直接信任数据库
  if (
    supplierType === '个人画师' ||
    supplierType === '艺术家' ||
    supplierType === '工作室' ||
    supplierType === '公司'
  ) {
    return supplierType;
  }
  // 兜底：名字优先
  if (name.includes('工作室')) return '工作室';
  if (name.includes('公司') || name.includes('有限') || name.includes('股份')) return '公司';
  // 再按旧存储值映射
  switch (supplierType) {
    case '艺术家':
      return '艺术家';
    case '个体工商户':
    case '一般企业':
      return '公司';
    case '个人':
    default:
      return '个人画师';
  }
}

/** 供应商类型徽章样式（颜色 class + 图标），键为中文全称。Grid 卡片与详情页共用，避免两套配色漂移。 */
export const SUPPLIER_TYPE_STYLE: Record<
  SupplierType,
  { color: string; icon: typeof UserIcon }
> = {
  个人画师: { color: 'bg-blue-100 text-blue-700 border-blue-200', icon: UserIcon },
  艺术家: { color: 'bg-purple-100 text-purple-700 border-purple-200', icon: AwardIcon },
  工作室: { color: 'bg-emerald-100 text-emerald-700 border-emerald-200', icon: PaletteIcon },
  公司: { color: 'bg-amber-100 text-amber-700 border-amber-200', icon: Building2Icon },
};
