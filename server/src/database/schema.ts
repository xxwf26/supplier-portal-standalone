import { mysqlTable, varchar, text, int, boolean, date, timestamp, json, index } from 'drizzle-orm/mysql-core';
import { sql } from 'drizzle-orm';

export const suppliers = mysqlTable(
  'suppliers',
  {
    id: varchar('id', { length: 36 })
      .notNull()
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),
    accountName: varchar('account_name', { length: 255 }).notNull(),
    /** 社媒平台链接 { weibo, xiaohongshu, bilibili, ... } */
    socialLinks: json('social_links').$type<Record<string, string>>(),
    subCategory: text('sub_category'),
    cooperationType: varchar('cooperation_type', { length: 255 }),
    priceRange: text('price_range'),
    /** 结构化报价 [{ cooperationType, unitPrice, priceUnit }] */
    priceItems: json('price_items').$type<{ cooperationType: string; unitPrice: number; priceUnit: string }[]>(),
    cooperationCount: int('cooperation_count').default(0),
    rating: int('rating'),
    riskStatus: varchar('risk_status', { length: 255 }).default('暂无'),
    isInStock: boolean('is_in_stock').default(true),
    entityType: varchar('entity_type', { length: 255 }),
    contractEntity: varchar('contract_entity', { length: 255 }),
    contractType: varchar('contract_type', { length: 255 }),
    contractNo: varchar('contract_no', { length: 255 }),
    contractDeadline: date('contract_deadline'),
    taxStatus: varchar('tax_status', { length: 255 }),
    contactInfo: text('contact_info'),
    /** 结构化联系方式 [{ type: wechat|qq|phone, value }] */
    contactItems: json('contact_items').$type<{ type: string; value: string }[]>(),
    cooperationCategory: varchar('cooperation_category', { length: 255 }),
    supplierType: varchar('supplier_type', { length: 255 }),
    /** 作品图片URL列表 */
    artworkUrls: json('artwork_urls').$type<string[]>(),
    /** 手动补录的平台链接 */
    manualLinks: json('manual_links').$type<Record<string, string>>(),
    importSource: varchar('import_source', { length: 255 }).default('manual'),
    importBatchId: varchar('import_batch_id', { length: 255 }),
    createdAt: timestamp('created_at').default(sql`CURRENT_TIMESTAMP`).notNull(),
    updatedAt: timestamp('updated_at').default(sql`CURRENT_TIMESTAMP`).notNull(),
  },
  (table) => ({
    idxAccountName: index('idx_account_name').on(table.accountName),
    idxCooperationCategory: index('idx_cooperation_category').on(table.cooperationCategory),
    idxEntityType: index('idx_entity_type').on(table.entityType),
    idxImportBatchId: index('idx_import_batch_id').on(table.importBatchId),
    idxRiskStatus: index('idx_risk_status').on(table.riskStatus),
    idxSupplierType: index('idx_supplier_type').on(table.supplierType),
  }),
);

export const suppliersTable = suppliers;