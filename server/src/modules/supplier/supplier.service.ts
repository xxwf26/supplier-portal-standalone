import { Injectable, Inject, Logger } from '@nestjs/common';

function parseJson<T>(value: unknown, fallback: T): T {
  if (value === null || value === undefined) return fallback;
  if (typeof value === 'string') {
    try { return JSON.parse(value); } catch { return fallback; }
  }
  return value as T;
}
import { eq, and, or, like, inArray, SQL, sql } from 'drizzle-orm';
import { DRIZZLE_DATABASE, type Database } from '../../database/database.module';
import { suppliers, auditLog } from '../../database/schema';
import { ISupplier, ICreateSupplierDto, IUpdateSupplierDto, ISupplierFilter, ISupplierListResponse, IBatchCreateResponse } from './supplier.types';
import { AuditService } from '../audit/audit.service';
import { normalizeSupplierType } from './supplier-type.util';
import { persistExternalImages } from '../../common/http/image-download';

@Injectable()
export class SupplierService {
  private readonly logger = new Logger(SupplierService.name);

  constructor(
    @Inject(DRIZZLE_DATABASE) private readonly db: Database,
    private readonly auditService: AuditService,
  ) {}

  async findAll(filter?: ISupplierFilter): Promise<ISupplierListResponse> {
    const conditions: SQL[] = [];

    if (filter?.supplierType?.length) {
      conditions.push(inArray(suppliers.supplierType, filter.supplierType));
    }
    if (filter?.cooperationCategory?.length) {
      conditions.push(inArray(suppliers.cooperationCategory, filter.cooperationCategory));
    }
    if (filter?.subCategory?.length) {
      conditions.push(inArray(suppliers.subCategory, filter.subCategory));
    }
    if (filter?.riskStatus?.length) {
      conditions.push(inArray(suppliers.riskStatus, filter.riskStatus));
    }
    if (filter?.entityType?.length) {
      conditions.push(inArray(suppliers.entityType, filter.entityType));
    }
    if (filter?.keyword) {
      const keyword = `%${filter.keyword}%`;
      conditions.push(
        or(
          like(suppliers.accountName, keyword),
          like(suppliers.contactInfo, keyword),
        ) as SQL,
      );
    }

    const where = conditions.length > 0 ? and(...conditions) : undefined;

    const list = await this.db
      .select()
      .from(suppliers)
      .where(where)
      .orderBy(sql`${suppliers.createdAt} DESC`);

    return {
      list: list.map(this.mapToISupplier),
      total: list.length,
    };
  }

  async findById(id: string): Promise<ISupplier | null> {
    const result = await this.db
      .select()
      .from(suppliers)
      .where(eq(suppliers.id, id))
      .limit(1);

    return result.length > 0 ? this.mapToISupplier(result[0]) : null;
  }

  async create(
    data: ICreateSupplierDto,
    operatedBy = 'admin',
    options: { importSource?: string; importBatchId?: string } = {},
  ): Promise<ISupplier> {
    // 主键先在应用层生成，避免插入后用 createdAt DESC LIMIT 1 取回时
    // 在同秒并发 / 批量导入场景下取错记录
    const id = crypto.randomUUID();

    // 作品图里若有外链（小红书 CDN，来自「识别链接」预填），保存时才落地到本地 uploads，
    // 避免抓取即下载产生孤儿图。已是 /uploads 的原样保留。
    const artworkUrls = await persistExternalImages(data.artworkUrls || [], 'artwork');

    await this.db.insert(suppliers).values({
      id,
      accountName: data.accountName,
      socialLinks: data.socialLinks || {},
      subCategory: data.subCategory || null,
      cooperationType: data.cooperationType || null,
      priceRange: data.priceRange || null,
      priceItems: data.priceItems || [],
      cooperationCount: this.clampCount(data.cooperationCount),
      rating: this.clampRating(data.rating),
      riskStatus: data.riskStatus || '未填写',
      isInStock: data.isInStock ?? true,
      entityType: data.entityType || null,
      contractEntity: data.contractEntity || null,
      contractType: data.contractType || null,
      contractNo: data.contractNo || null,
      contractDeadline: data.contractDeadline ? new Date(data.contractDeadline) : null,
      taxStatus: data.taxStatus || null,
      contactInfo: data.contactInfo ? data.contactInfo.slice(0, 500) : null,
      contactItems: data.contactItems || [],
      cooperationCategory: data.cooperationCategory || null,
      supplierType: data.supplierType
        ? normalizeSupplierType(data.supplierType, data.accountName || '')
        : null,
      importSource: options.importSource || 'manual',
      importBatchId: options.importBatchId || null,
      artworkUrls,
      noteImages: data.noteImages || [],
    });
    const created = await this.findById(id);
    if (!created) {
      throw new Error('创建后未能读取到新记录');
    }

    await this.auditService.log({
      operation: 'INSERT',
      recordId: created.id,
      batchId: options.importBatchId,
      newData: created,
      operatedBy,
    });

    return created;
  }

  /** 合作频次范围校验：0 ~ 9999 */
  private clampCount(value: unknown): number {
    return Math.max(0, Math.min(9999, Number(value) || 0));
  }

  /** 评分范围校验：1 ~ 5，空值保持 null */
  private clampRating(value: unknown): number | null {
    if (value === undefined || value === null || value === '') return null;
    const n = Number(value);
    if (Number.isNaN(n)) return null;
    return Math.max(1, Math.min(5, n));
  }

  async update(id: string, data: IUpdateSupplierDto, operatedBy = 'admin'): Promise<ISupplier | null> {
    const existing = await this.findById(id);
    if (!existing) return null;

    const finalManualLinks = data.manualLinks !== undefined ? data.manualLinks : existing.manualLinks;

    const updateData: Record<string, unknown> = {
      manualLinks: finalManualLinks,
      updatedAt: new Date(),
    };

    if (data.accountName !== undefined) updateData.accountName = data.accountName;
    if (data.socialLinks !== undefined) updateData.socialLinks = data.socialLinks;
    if (data.subCategory !== undefined) updateData.subCategory = data.subCategory;
    if (data.cooperationType !== undefined) updateData.cooperationType = data.cooperationType;
    if (data.priceRange !== undefined) updateData.priceRange = data.priceRange;
    if (data.cooperationCount !== undefined) updateData.cooperationCount = this.clampCount(data.cooperationCount);
    if (data.rating !== undefined) updateData.rating = this.clampRating(data.rating);
    if (data.riskStatus !== undefined) updateData.riskStatus = data.riskStatus;
    if (data.isInStock !== undefined) updateData.isInStock = data.isInStock;
    if (data.entityType !== undefined) updateData.entityType = data.entityType;
    if (data.contractEntity !== undefined) updateData.contractEntity = data.contractEntity;
    if (data.contractType !== undefined) updateData.contractType = data.contractType;
    if (data.contractNo !== undefined) updateData.contractNo = data.contractNo;
    if (data.contractDeadline !== undefined) updateData.contractDeadline = data.contractDeadline ? new Date(data.contractDeadline) : null;
    if (data.taxStatus !== undefined) updateData.taxStatus = data.taxStatus;
    if (data.contactInfo !== undefined) updateData.contactInfo = data.contactInfo ? data.contactInfo.slice(0, 500) : null;
    if (data.contactItems !== undefined) updateData.contactItems = data.contactItems;
    if (data.priceItems !== undefined) updateData.priceItems = data.priceItems;
    if (data.cooperationCategory !== undefined) updateData.cooperationCategory = data.cooperationCategory;
    if (data.supplierType !== undefined) updateData.supplierType = data.supplierType
      ? normalizeSupplierType(data.supplierType, data.accountName || '')
      : null;
    if (data.artworkUrls !== undefined) updateData.artworkUrls = await persistExternalImages(data.artworkUrls, 'artwork');
    if (data.noteImages !== undefined) updateData.noteImages = data.noteImages;

    await this.db.update(suppliers).set(updateData).where(eq(suppliers.id, id));
    const updated = await this.findById(id);

    await this.auditService.log({
      operation: 'UPDATE',
      recordId: id,
      oldData: existing,
      newData: updated,
      operatedBy,
    });

    return updated;
  }

  async delete(id: string, operatedBy = 'admin'): Promise<boolean> {
    const existing = await this.findById(id);
    if (!existing) return false;
    await this.db.delete(suppliers).where(eq(suppliers.id, id));
    await this.auditService.log({
      operation: 'DELETE',
      recordId: id,
      oldData: existing,
      operatedBy,
    });
    return true;
  }

  async batchCreate(items: ICreateSupplierDto[], operatedBy = 'admin'): Promise<IBatchCreateResponse> {
    // 批量导入前先创建快照
    try {
      await this.auditService.createSnapshot('pre_import');
    } catch (err) {
      this.logger.warn('Pre-import snapshot failed (non-blocking):', err);
    }

    // 为本次导入生成统一批次号，使「导入批次列表 / 批次回滚」可用
    const importBatchId = `import_${new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19)}_${crypto.randomUUID().slice(0, 8)}`;

    let successCount = 0;
    let failCount = 0;
    const errors: { row: number; name: string; reason: string }[] = [];

    for (let i = 0; i < items.length; i++) {
      const item = items[i];
      try {
        await this.create(item, operatedBy, { importSource: 'import', importBatchId });
        successCount++;
      } catch (err) {
        failCount++;
        errors.push({
          row: i + 1,
          name: item.accountName || '(未命名)',
          reason: err instanceof Error ? err.message : '未知错误',
        });
      }
    }

    return { successCount, failCount, errors };
  }

  /**
   * 批量删除：删前快照 + 事务内逐条记审计（带共享 batchId）再批删。
   * 每条记 BATCH_DELETE 并保留 oldData，使「单条撤回」与「整批恢复」皆可用。
   */
  async batchDelete(
    ids: string[],
    operatedBy = 'admin',
  ): Promise<{ deleted: number; notFound: number; batchId: string }> {
    // 删除前先创建快照（best-effort，依赖服务器有 mysqldump，失败不阻塞）
    try {
      await this.auditService.createSnapshot('pre_batch_delete');
    } catch (err) {
      this.logger.warn('Pre-batch-delete snapshot failed (non-blocking):', err);
    }

    const batchId = `del_${new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19)}_${crypto.randomUUID().slice(0, 8)}`;

    // 先取出确实存在的记录，用于审计 oldData 与精确计数
    const rows = await this.db.select().from(suppliers).where(inArray(suppliers.id, ids));
    if (rows.length === 0) {
      return { deleted: 0, notFound: ids.length, batchId };
    }

    await this.db.transaction(async (tx) => {
      for (const row of rows) {
        await tx.insert(auditLog).values({
          operation: 'BATCH_DELETE',
          recordId: row.id,
          batchId,
          oldData: row,
          newData: null,
          operatedBy,
        });
      }
      await tx.delete(suppliers).where(inArray(suppliers.id, rows.map((r) => r.id)));
    });

    this.logger.log(`Batch deleted ${rows.length} suppliers (batch ${batchId}) by ${operatedBy}`);
    return { deleted: rows.length, notFound: ids.length - rows.length, batchId };
  }

  /** 提取字符串中所有长度>=2的连续子串（用于模糊匹配） */
  /** 比较前对名称做规范化：去除括号内容、地名、行业通用词、法人主体后缀 */
  private normalizeName(str: string): string {
    // ① 先删括号内容（必须在删括号字符之前）
    let s = str
      .replace(/（[^）]*）/g, '')   // 全角括号
      .replace(/\([^)]*\)/g, '')    // 半角括号
      .replace(/【[^】]*】/g, '')   // 方括号
      .replace(/\s+/g, '');         // 空格

    // ② 从尾部去除法人主体/行业后缀（从长到短逐个尝试）
    const suffixes = [
      '有限责任公司', '股份有限公司', '有限合伙企业',
      '文化传媒有限公司', '科技有限公司', '网络科技有限公司',
      '文化创意有限公司', '创意设计有限公司',
      '文化发展有限公司', '影视文化有限公司',
      '文化传播有限公司', '动漫科技有限公司',
      '有限公司', '工作室',
      '文化传媒', '网络科技', '文化科技', '创意设计',
      '文化传播', '影视传媒', '影视文化', '互娱科技',
      '文化', '传媒', '科技', '网络', '信息', '动画',
      '设计', '创意', '传播', '互娱', '影视', '映画',
      '艺术', '制作', '互动', '数字', '游戏', '教育',
      '有限',
    ];
    for (const sfx of suffixes) {
      if (s.endsWith(sfx)) {
        s = s.slice(0, s.length - sfx.length);
      }
    }

    // ③ 从头部去除城市/地区前缀以及常见笔名前缀
    const prefixes = [
      '成都市', '天津市', '北京市', '上海市', '广州市', '深圳市',
      '杭州市', '武汉市', '南京市', '重庆市', '西安市',
      '哈尔滨市', '南通市', '昆山市',
      '成都', '天津', '北京', '上海', '广州', '深圳',
      '杭州', '武汉', '南京', '重庆', '西安', '贵州',
      '哈尔滨', '南通', '昆山', '青羊区', '锦江区',
      '画画的', // 常见笔名前缀，不作为相似标志
    ];
    for (const pfx of prefixes) {
      if (s.startsWith(pfx)) {
        s = s.slice(pfx.length);
        break; // 只去一个前缀
      }
    }

    // ④ 去除画师档案里的活动/类别标签（"-带人原画""-场景"等）
    s = s.replace(/[-_][^-_]{0,10}$/, '');

    return s.trim();
  }

  private getNgrams(str: string, minLen = 2): Set<string> {
    const s = this.normalizeName(str);
    if (s.length < 2) return new Set();

    // 名称主要为英文/数字时，要求更长的匹配（避免 na/an/ana 等短字母组合误触发）
    const isMainlyLatin = (s.match(/[a-zA-Z0-9]/g) || []).length > s.length * 0.5;
    const effectiveMinLen = isMainlyLatin ? 4 : minLen;

    const grams = new Set<string>();
    for (let len = effectiveMinLen; len <= Math.min(s.length, 4); len++) {
      for (let i = 0; i <= s.length - len; i++) {
        grams.add(s.slice(i, i + len));
      }
    }
    return grams;
  }

  /** 查找库内重复/相似画师 */
  async getDuplicates(): Promise<Array<{ ids: string[]; names: string[]; reason: string }>> {
    const all = await this.db.select({
      id: suppliers.id,
      accountName: suppliers.accountName,
    }).from(suppliers);

    const groups: Map<string, typeof all> = new Map();

    // 先做精确去重（完全一致）
    const nameMap = new Map<string, typeof all[0][]>();
    for (const s of all) {
      const key = (s.accountName || '').trim().toLowerCase();
      if (!nameMap.has(key)) nameMap.set(key, []);
      nameMap.get(key)!.push(s);
    }

    const result: Array<{ ids: string[]; names: string[]; reason: string }> = [];

    // 1. 完全重复
    for (const [, group] of nameMap) {
      if (group.length >= 2) {
        result.push({
          ids: group.map(s => s.id),
          names: group.map(s => s.accountName || ''),
          reason: '名称完全相同',
        });
      }
    }

    // 2. 共享2+字连续片段（模糊相似）
    const seen = new Set<string>();
    for (let i = 0; i < all.length; i++) {
      for (let j = i + 1; j < all.length; j++) {
        const a = all[i], b = all[j];
        const pairKey = [a.id, b.id].sort().join('|');
        if (seen.has(pairKey)) continue;

        const gramsA = this.getNgrams(a.accountName || '');
        const gramsB = this.getNgrams(b.accountName || '');
        const common: string[] = [];
        for (const g of gramsA) {
          if (gramsB.has(g)) common.push(g);
        }

        if (common.length > 0) {
          seen.add(pairKey);
          result.push({
            ids: [a.id, b.id],
            names: [a.accountName || '', b.accountName || ''],
            reason: `含相同片段：「${common.slice(0, 3).join('」「')}」`,
          });
        }
      }
    }

    return result;
  }

  async getStatistics() {
    const all = await this.db.select().from(suppliers);

    const total = all.length;
    // 按归一化后的中文全称统计，兼容历史未迁移的脏值
    const typeOf = (s: { supplierType: string | null; accountName: string }) =>
      normalizeSupplierType(s.supplierType, s.accountName || '');
    const individualCount = all.filter(s => typeOf(s) === '个人画师').length;
    const artistCount = all.filter(s => typeOf(s) === '艺术家').length;
    const studioCount = all.filter(s => typeOf(s) === '工作室').length;
    const companyCount = all.filter(s => typeOf(s) === '公司').length;
    const activeCount = all.filter(s => s.isInStock && s.riskStatus !== '拉黑').length;

    const categoryCount: Record<string, number> = {};
    all.forEach(s => {
      if (s.cooperationCategory) {
        categoryCount[s.cooperationCategory] = (categoryCount[s.cooperationCategory] || 0) + 1;
      }
    });

    const riskCount: Record<string, number> = {};
    all.forEach(s => {
      const status = s.riskStatus || '未填写';
      riskCount[status] = (riskCount[status] || 0) + 1;
    });

    return {
      total,
      individualCount,
      artistCount,
      studioCount,
      companyCount,
      activeCount,
      categoryCount,
      riskCount,
    };
  }

  private mapToISupplier(dbRecord: any): ISupplier {
    return {
      id: dbRecord.id,
      accountName: dbRecord.accountName,
      socialLinks: parseJson(dbRecord.socialLinks, {}),
      subCategory: dbRecord.subCategory,
      cooperationType: dbRecord.cooperationType,
      priceRange: dbRecord.priceRange,
      priceItems: parseJson(dbRecord.priceItems, []),
      cooperationCount: dbRecord.cooperationCount || 0,
      rating: dbRecord.rating,
      riskStatus: dbRecord.riskStatus || '暂无',
      isInStock: dbRecord.isInStock ?? true,
      entityType: dbRecord.entityType,
      contractEntity: dbRecord.contractEntity,
      contractType: dbRecord.contractType,
      contractNo: dbRecord.contractNo,
      contractDeadline: dbRecord.contractDeadline,
      taxStatus: dbRecord.taxStatus,
      contactInfo: dbRecord.contactInfo,
      contactItems: parseJson(dbRecord.contactItems, []),
      cooperationCategory: dbRecord.cooperationCategory,
      supplierType: dbRecord.supplierType,
      artworkUrls: parseJson(dbRecord.artworkUrls, []),
      manualLinks: parseJson(dbRecord.manualLinks, {}),
      noteImages: parseJson(dbRecord.noteImages, []),
      importSource: dbRecord.importSource || 'manual',
      importBatchId: dbRecord.importBatchId,
      createdAt: dbRecord.createdAt instanceof Date ? dbRecord.createdAt.toISOString() : String(dbRecord.createdAt),
      updatedAt: dbRecord.updatedAt instanceof Date ? dbRecord.updatedAt.toISOString() : String(dbRecord.updatedAt),
    };
  }
}