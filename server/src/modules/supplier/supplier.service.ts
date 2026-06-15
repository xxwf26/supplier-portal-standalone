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
import { suppliers } from '../../database/schema';
import { ISupplier, ICreateSupplierDto, IUpdateSupplierDto, ISupplierFilter, ISupplierListResponse, IBatchCreateResponse } from './supplier.types';
import { AuditService } from '../audit/audit.service';

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

  async create(data: ICreateSupplierDto, operatedBy = 'admin'): Promise<ISupplier> {
    await this.db.insert(suppliers).values({
      accountName: data.accountName,
      socialLinks: data.socialLinks || {},
      subCategory: data.subCategory || null,
      cooperationType: data.cooperationType || null,
      priceRange: data.priceRange || null,
      priceItems: data.priceItems || [],
      cooperationCount: data.cooperationCount || 0,
      rating: data.rating || null,
      riskStatus: data.riskStatus || '暂无',
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
      supplierType: data.supplierType || null,
      importSource: 'manual',
    });

    const all = await this.db.select().from(suppliers).orderBy(sql`${suppliers.createdAt} DESC`).limit(1);
    const created = this.mapToISupplier(all[0]);

    await this.auditService.log({
      operation: 'INSERT',
      recordId: created.id,
      newData: created,
      operatedBy,
    });

    return created;
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
    if (data.cooperationCount !== undefined) updateData.cooperationCount = data.cooperationCount;
    if (data.rating !== undefined) updateData.rating = data.rating;
    if (data.riskStatus !== undefined) updateData.riskStatus = data.riskStatus;
    if (data.isInStock !== undefined) updateData.isInStock = data.isInStock;
    if (data.entityType !== undefined) updateData.entityType = data.entityType;
    if (data.contractEntity !== undefined) updateData.contractEntity = data.contractEntity;
    if (data.contractType !== undefined) updateData.contractType = data.contractType;
    if (data.contractNo !== undefined) updateData.contractNo = data.contractNo;
    if (data.contractDeadline !== undefined) updateData.contractDeadline = data.contractDeadline ? new Date(data.contractDeadline) : null;
    if (data.taxStatus !== undefined) updateData.taxStatus = data.taxStatus;
    if (data.contactInfo !== undefined) updateData.contactInfo = data.contactInfo;
    if (data.contactItems !== undefined) updateData.contactItems = data.contactItems;
    if (data.priceItems !== undefined) updateData.priceItems = data.priceItems;
    if (data.cooperationCategory !== undefined) updateData.cooperationCategory = data.cooperationCategory;
    if (data.supplierType !== undefined) updateData.supplierType = data.supplierType;
    if (data.artworkUrls !== undefined) updateData.artworkUrls = data.artworkUrls;

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

    let successCount = 0;
    let failCount = 0;
    const errors: { row: number; name: string; reason: string }[] = [];

    for (let i = 0; i < items.length; i++) {
      const item = items[i];
      try {
        await this.create(item, operatedBy);
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

  async getStatistics() {
    const all = await this.db.select().from(suppliers);

    const total = all.length;
    const individualCount = all.filter(s => s.supplierType === '个人').length;
    const companyCount = all.filter(s => s.supplierType === '公司' || s.supplierType === '个体工商户').length;
    const activeCount = all.filter(s => s.isInStock && s.riskStatus !== '拉黑').length;

    const categoryCount: Record<string, number> = {};
    all.forEach(s => {
      if (s.cooperationCategory) {
        categoryCount[s.cooperationCategory] = (categoryCount[s.cooperationCategory] || 0) + 1;
      }
    });

    const riskCount: Record<string, number> = {};
    all.forEach(s => {
      const status = s.riskStatus || '暂无';
      riskCount[status] = (riskCount[status] || 0) + 1;
    });

    return {
      total,
      individualCount,
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
      importSource: dbRecord.importSource || 'manual',
      importBatchId: dbRecord.importBatchId,
      createdAt: dbRecord.createdAt instanceof Date ? dbRecord.createdAt.toISOString() : String(dbRecord.createdAt),
      updatedAt: dbRecord.updatedAt instanceof Date ? dbRecord.updatedAt.toISOString() : String(dbRecord.updatedAt),
    };
  }
}