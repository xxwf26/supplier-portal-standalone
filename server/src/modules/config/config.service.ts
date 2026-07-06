import { Injectable, Inject, BadRequestException, NotFoundException } from '@nestjs/common';
import { DRIZZLE_DATABASE, type Database } from '../../database/database.module';
import { filterConfig } from '../../database/filter-config.schema';
import { suppliers } from '../../database/schema';
import { eq, asc } from 'drizzle-orm';

/** 与前端 supplierUtils.inferSupplierType 一致：名字优先，再看存储值 */
function inferSupplierType(name: string, supplierType: string | null): string {
  if (name && name.includes('工作室')) return 'studio';
  if (name && (name.includes('公司') || name.includes('有限') || name.includes('股份'))) return 'company';
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

/** 与前端 processSupplier 的状态推导一致 */
function deriveStatus(isInStock: boolean | null, riskStatus: string | null): string {
  if (riskStatus === '拉黑') return 'blacklisted';
  if (isInStock) return 'in_stock';
  return 'outreach';
}

/** 多值字段按 / 、 ， 切分（与前端一致，避免 LIKE 误判子串） */
function splitTags(s: string | null): string[] {
  if (!s) return [];
  return s.split(/[/、，]/).map((x) => x.trim()).filter(Boolean);
}

/** 这些分类的 value 始终等于 label（label 即唯一标识）；supplierType/cooperationStatus 的 value 是功能码，保留 */
const LABEL_AS_VALUE = new Set(['style', 'cooperationType', 'project']);

@Injectable()
export class ConfigService {
  constructor(@Inject(DRIZZLE_DATABASE) private readonly db: Database) {}

  async getAll() {
    const rows = await this.db.select().from(filterConfig).orderBy(asc(filterConfig.sortOrder));
    const grouped: Record<string, any[]> = {};
    for (const r of rows) {
      if (!grouped[r.category]) grouped[r.category] = [];
      grouped[r.category].push({
        id: r.id, category: r.category, label: r.label, value: r.value,
        color: r.color, note: r.note, sortOrder: r.sortOrder, enabled: r.enabled,
      });
    }
    return grouped;
  }

  async getByCategory(category: string) {
    return this.db.select().from(filterConfig).where(eq(filterConfig.category, category)).orderBy(asc(filterConfig.sortOrder));
  }

  /** 统计有多少画师正在使用某分类下的某个选项值，返回其名称列表 */
  private async findSuppliersUsingOption(category: string, value: string): Promise<string[]> {
    const rows = await this.db
      .select({
        accountName: suppliers.accountName,
        supplierType: suppliers.supplierType,
        cooperationType: suppliers.cooperationType,
        subCategory: suppliers.subCategory,
        isInStock: suppliers.isInStock,
        riskStatus: suppliers.riskStatus,
        entityType: suppliers.entityType,
        contractEntity: suppliers.contractEntity,
      })
      .from(suppliers);

    const used = (s: (typeof rows)[number]): boolean => {
      switch (category) {
        case 'supplierType':
          return inferSupplierType(s.accountName || '', s.supplierType) === value;
        case 'cooperationType':
          return splitTags(s.cooperationType).includes(value);
        case 'style':
          return splitTags(s.subCategory).includes(value);
        case 'cooperationStatus':
          return deriveStatus(s.isInStock, s.riskStatus) === value;
        case 'project':
          return [s.entityType, s.contractEntity].filter(Boolean).includes(value);
        default:
          return false;
      }
    };

    return rows.filter(used).map((s) => s.accountName).filter(Boolean) as string[];
  }

  /** 构造"被 N 个画师使用"的拒绝信息（最多列举 5 个名字） */
  private buildInUseMessage(label: string, names: string[], action: string): string {
    const shown = names.slice(0, 5).join('、');
    const more = names.length > 5 ? ` 等 ${names.length} 个` : '';
    return `「${label}」正被 ${names.length} 个画师使用（${shown}${more}），请先修改这些画师后再${action}`;
  }

  /** 抛出"选项被占用"异常，payload 带完整名单——前端可结构化展示（不止 5 个） */
  private throwInUse(label: string, names: string[], action: string): never {
    throw new BadRequestException({
      message: this.buildInUseMessage(label, names, action),
      inUse: { label, action, count: names.length, names },
    });
  }

  async create(data: { category: string; label: string; value?: string; color?: string; note?: string; sort_order?: number }) {
    if (data.category === 'supplierType') {
      throw new BadRequestException('供应商类型为固定字段，暂不支持新增或删除');
    }
    const value = LABEL_AS_VALUE.has(data.category) ? data.label : (data.value ?? data.label);
    const id = crypto.randomUUID();

    // 利用数据库唯一约束 (category, value) 实现幂等：重复时忽略冲突，不抛错
    await this.db.insert(filterConfig).values({
      id, category: data.category, label: data.label, value,
      color: data.color || null, note: data.note || null,
      sortOrder: data.sort_order || 0, enabled: true,
    }).onDuplicateKeyUpdate({ set: { label: data.label } });
    return { id };
  }

  async update(id: string, data: { label?: string; value?: string; color?: string; note?: string; sort_order?: number; enabled?: boolean }) {
    const [current] = await this.db.select().from(filterConfig).where(eq(filterConfig.id, id));
    if (!current) throw new NotFoundException('配置项不存在');

    // style/cooperationType/project：改 label 时 value 跟随 label（label 即唯一标识）
    let nextValue = data.value;
    if (LABEL_AS_VALUE.has(current.category) && data.label !== undefined) {
      nextValue = data.label;
    }

    // 引用保护：改 value 等于"删旧值"，会让引用旧值的画师变孤儿 → 有画师在用时禁止改 value
    if (nextValue !== undefined && nextValue !== current.value) {
      const inUse = await this.findSuppliersUsingOption(current.category, current.value);
      if (inUse.length > 0) {
        this.throwInUse(current.label, inUse, '修改取值');
      }
    }

    const updateData: Record<string, unknown> = {};
    if (data.label !== undefined) updateData.label = data.label;
    if (nextValue !== undefined) updateData.value = nextValue;
    if (data.color !== undefined) updateData.color = data.color;
    if (data.note !== undefined) updateData.note = data.note || null;
    if (data.sort_order !== undefined) updateData.sortOrder = data.sort_order;
    if (data.enabled !== undefined) updateData.enabled = data.enabled;
    await this.db.update(filterConfig).set(updateData).where(eq(filterConfig.id, id));
    return { success: true };
  }

  async delete(id: string) {
    const [current] = await this.db.select().from(filterConfig).where(eq(filterConfig.id, id));
    if (!current) return { success: true }; // 已不存在，视为成功

    // 供应商类型为固定字段，暂不支持删除
    if (current.category === 'supplierType') {
      throw new BadRequestException('供应商类型为固定字段，暂不支持新增或删除');
    }

    // 禁止删除：有画师在用该选项则拒绝，并列出名单
    const inUse = await this.findSuppliersUsingOption(current.category, current.value);
    if (inUse.length > 0) {
      this.throwInUse(current.label, inUse, '删除');
    }

    await this.db.delete(filterConfig).where(eq(filterConfig.id, id));
    return { success: true };
  }
}
