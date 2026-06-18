"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.suppliersTable = exports.suppliers = exports.auditLog = void 0;
const mysql_core_1 = require("drizzle-orm/mysql-core");
const drizzle_orm_1 = require("drizzle-orm");
exports.auditLog = (0, mysql_core_1.mysqlTable)('audit_log', {
    id: (0, mysql_core_1.int)('id').autoincrement().primaryKey(),
    operation: (0, mysql_core_1.varchar)('operation', { length: 50 }).notNull(), // INSERT | UPDATE | DELETE | BATCH_IMPORT | BATCH_ROLLBACK | SNAPSHOT
    recordId: (0, mysql_core_1.varchar)('record_id', { length: 36 }),
    batchId: (0, mysql_core_1.varchar)('batch_id', { length: 255 }),
    tableName: (0, mysql_core_1.varchar)('table_name', { length: 100 }).default('suppliers'),
    oldData: (0, mysql_core_1.json)('old_data'),
    newData: (0, mysql_core_1.json)('new_data'),
    operatedBy: (0, mysql_core_1.varchar)('operated_by', { length: 255 }),
    createdAt: (0, mysql_core_1.timestamp)('created_at').default((0, drizzle_orm_1.sql) `CURRENT_TIMESTAMP`).notNull(),
}, (table) => ({
    idxBatchId: (0, mysql_core_1.index)('idx_audit_batch_id').on(table.batchId),
    idxRecordId: (0, mysql_core_1.index)('idx_audit_record_id').on(table.recordId),
    idxCreatedAt: (0, mysql_core_1.index)('idx_audit_created_at').on(table.createdAt),
}));
exports.suppliers = (0, mysql_core_1.mysqlTable)('suppliers', {
    id: (0, mysql_core_1.varchar)('id', { length: 36 })
        .notNull()
        .primaryKey()
        .$defaultFn(() => crypto.randomUUID()),
    accountName: (0, mysql_core_1.varchar)('account_name', { length: 255 }).notNull(),
    /** 社媒平台链接 { weibo, xiaohongshu, bilibili, ... } */
    socialLinks: (0, mysql_core_1.json)('social_links').$type(),
    subCategory: (0, mysql_core_1.text)('sub_category'),
    cooperationType: (0, mysql_core_1.varchar)('cooperation_type', { length: 255 }),
    priceRange: (0, mysql_core_1.text)('price_range'),
    /** 结构化报价 [{ cooperationType, unitPrice, priceUnit }] */
    priceItems: (0, mysql_core_1.json)('price_items').$type(),
    cooperationCount: (0, mysql_core_1.int)('cooperation_count').default(0),
    rating: (0, mysql_core_1.int)('rating'),
    riskStatus: (0, mysql_core_1.varchar)('risk_status', { length: 255 }).default('暂无'),
    isInStock: (0, mysql_core_1.boolean)('is_in_stock').default(true),
    entityType: (0, mysql_core_1.varchar)('entity_type', { length: 255 }),
    contractEntity: (0, mysql_core_1.varchar)('contract_entity', { length: 255 }),
    contractType: (0, mysql_core_1.varchar)('contract_type', { length: 255 }),
    contractNo: (0, mysql_core_1.varchar)('contract_no', { length: 255 }),
    contractDeadline: (0, mysql_core_1.date)('contract_deadline'),
    taxStatus: (0, mysql_core_1.varchar)('tax_status', { length: 255 }),
    contactInfo: (0, mysql_core_1.text)('contact_info'),
    /** 结构化联系方式 [{ type: wechat|qq|phone, value }] */
    contactItems: (0, mysql_core_1.json)('contact_items').$type(),
    cooperationCategory: (0, mysql_core_1.varchar)('cooperation_category', { length: 255 }),
    supplierType: (0, mysql_core_1.varchar)('supplier_type', { length: 255 }),
    /** 作品图片URL列表 */
    artworkUrls: (0, mysql_core_1.json)('artwork_urls').$type(),
    /** 手动补录的平台链接 */
    manualLinks: (0, mysql_core_1.json)('manual_links').$type(),
    /** 备注区域的佐证图片URL列表 */
    noteImages: (0, mysql_core_1.json)('note_images').$type(),
    importSource: (0, mysql_core_1.varchar)('import_source', { length: 255 }).default('manual'),
    importBatchId: (0, mysql_core_1.varchar)('import_batch_id', { length: 255 }),
    createdAt: (0, mysql_core_1.timestamp)('created_at').default((0, drizzle_orm_1.sql) `CURRENT_TIMESTAMP`).notNull(),
    updatedAt: (0, mysql_core_1.timestamp)('updated_at').default((0, drizzle_orm_1.sql) `CURRENT_TIMESTAMP`).notNull(),
}, (table) => ({
    idxAccountName: (0, mysql_core_1.index)('idx_account_name').on(table.accountName),
    idxCooperationCategory: (0, mysql_core_1.index)('idx_cooperation_category').on(table.cooperationCategory),
    idxEntityType: (0, mysql_core_1.index)('idx_entity_type').on(table.entityType),
    idxImportBatchId: (0, mysql_core_1.index)('idx_import_batch_id').on(table.importBatchId),
    idxRiskStatus: (0, mysql_core_1.index)('idx_risk_status').on(table.riskStatus),
    idxSupplierType: (0, mysql_core_1.index)('idx_supplier_type').on(table.supplierType),
}));
exports.suppliersTable = exports.suppliers;
//# sourceMappingURL=schema.js.map