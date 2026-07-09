import { mysqlTable, varchar, text, int, boolean, date, timestamp, json, index } from 'drizzle-orm/mysql-core';
import { sql } from 'drizzle-orm';

export const auditLog = mysqlTable(
  'audit_log',
  {
    id: int('id').autoincrement().primaryKey(),
    operation: varchar('operation', { length: 50 }).notNull(), // INSERT | UPDATE | DELETE | BATCH_IMPORT | BATCH_ROLLBACK | SNAPSHOT
    recordId: varchar('record_id', { length: 36 }),
    batchId: varchar('batch_id', { length: 255 }),
    tableName: varchar('table_name', { length: 100 }).default('suppliers'),
    oldData: json('old_data'),
    newData: json('new_data'),
    operatedBy: varchar('operated_by', { length: 255 }),
    createdAt: timestamp('created_at').default(sql`CURRENT_TIMESTAMP`).notNull(),
  },
  (table) => ({
    idxBatchId: index('idx_audit_batch_id').on(table.batchId),
    idxRecordId: index('idx_audit_record_id').on(table.recordId),
    idxCreatedAt: index('idx_audit_created_at').on(table.createdAt),
  }),
);

export const suppliers = mysqlTable(
  'suppliers',
  {
    id: varchar('id', { length: 36 })
      .notNull()
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),
    accountName: varchar('account_name', { length: 255 }).notNull(),
    /** 社媒平台链接 { weibo: [url...], xiaohongshu: [url...], ... }（每平台可多条） */
    socialLinks: json('social_links').$type<Record<string, string[]>>(),
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
    /** 手动补录的平台链接（每平台可多条） */
    manualLinks: json('manual_links').$type<Record<string, string[]>>(),
    /** 备注区域的佐证图片URL列表 */
    noteImages: json('note_images').$type<string[]>(),
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