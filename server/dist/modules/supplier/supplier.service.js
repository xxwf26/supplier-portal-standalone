"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
var __param = (this && this.__param) || function (paramIndex, decorator) {
    return function (target, key) { decorator(target, key, paramIndex); }
};
var SupplierService_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.SupplierService = void 0;
const common_1 = require("@nestjs/common");
function parseJson(value, fallback) {
    if (value === null || value === undefined)
        return fallback;
    if (typeof value === 'string') {
        try {
            return JSON.parse(value);
        }
        catch {
            return fallback;
        }
    }
    return value;
}
const drizzle_orm_1 = require("drizzle-orm");
const database_module_1 = require("../../database/database.module");
const schema_1 = require("../../database/schema");
const audit_service_1 = require("../audit/audit.service");
const supplier_type_util_1 = require("./supplier-type.util");
let SupplierService = SupplierService_1 = class SupplierService {
    db;
    auditService;
    logger = new common_1.Logger(SupplierService_1.name);
    constructor(db, auditService) {
        this.db = db;
        this.auditService = auditService;
    }
    async findAll(filter) {
        const conditions = [];
        if (filter?.supplierType?.length) {
            conditions.push((0, drizzle_orm_1.inArray)(schema_1.suppliers.supplierType, filter.supplierType));
        }
        if (filter?.cooperationCategory?.length) {
            conditions.push((0, drizzle_orm_1.inArray)(schema_1.suppliers.cooperationCategory, filter.cooperationCategory));
        }
        if (filter?.subCategory?.length) {
            conditions.push((0, drizzle_orm_1.inArray)(schema_1.suppliers.subCategory, filter.subCategory));
        }
        if (filter?.riskStatus?.length) {
            conditions.push((0, drizzle_orm_1.inArray)(schema_1.suppliers.riskStatus, filter.riskStatus));
        }
        if (filter?.entityType?.length) {
            conditions.push((0, drizzle_orm_1.inArray)(schema_1.suppliers.entityType, filter.entityType));
        }
        if (filter?.keyword) {
            const keyword = `%${filter.keyword}%`;
            conditions.push((0, drizzle_orm_1.or)((0, drizzle_orm_1.like)(schema_1.suppliers.accountName, keyword), (0, drizzle_orm_1.like)(schema_1.suppliers.contactInfo, keyword)));
        }
        const where = conditions.length > 0 ? (0, drizzle_orm_1.and)(...conditions) : undefined;
        const list = await this.db
            .select()
            .from(schema_1.suppliers)
            .where(where)
            .orderBy((0, drizzle_orm_1.sql) `${schema_1.suppliers.createdAt} DESC`);
        return {
            list: list.map(this.mapToISupplier),
            total: list.length,
        };
    }
    async findById(id) {
        const result = await this.db
            .select()
            .from(schema_1.suppliers)
            .where((0, drizzle_orm_1.eq)(schema_1.suppliers.id, id))
            .limit(1);
        return result.length > 0 ? this.mapToISupplier(result[0]) : null;
    }
    async create(data, operatedBy = 'admin', options = {}) {
        // 主键先在应用层生成，避免插入后用 createdAt DESC LIMIT 1 取回时
        // 在同秒并发 / 批量导入场景下取错记录
        const id = crypto.randomUUID();
        await this.db.insert(schema_1.suppliers).values({
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
                ? (0, supplier_type_util_1.normalizeSupplierType)(data.supplierType, data.accountName || '')
                : null,
            importSource: options.importSource || 'manual',
            importBatchId: options.importBatchId || null,
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
    clampCount(value) {
        return Math.max(0, Math.min(9999, Number(value) || 0));
    }
    /** 评分范围校验：1 ~ 5，空值保持 null */
    clampRating(value) {
        if (value === undefined || value === null || value === '')
            return null;
        const n = Number(value);
        if (Number.isNaN(n))
            return null;
        return Math.max(1, Math.min(5, n));
    }
    async update(id, data, operatedBy = 'admin') {
        const existing = await this.findById(id);
        if (!existing)
            return null;
        const finalManualLinks = data.manualLinks !== undefined ? data.manualLinks : existing.manualLinks;
        const updateData = {
            manualLinks: finalManualLinks,
            updatedAt: new Date(),
        };
        if (data.accountName !== undefined)
            updateData.accountName = data.accountName;
        if (data.socialLinks !== undefined)
            updateData.socialLinks = data.socialLinks;
        if (data.subCategory !== undefined)
            updateData.subCategory = data.subCategory;
        if (data.cooperationType !== undefined)
            updateData.cooperationType = data.cooperationType;
        if (data.priceRange !== undefined)
            updateData.priceRange = data.priceRange;
        if (data.cooperationCount !== undefined)
            updateData.cooperationCount = this.clampCount(data.cooperationCount);
        if (data.rating !== undefined)
            updateData.rating = this.clampRating(data.rating);
        if (data.riskStatus !== undefined)
            updateData.riskStatus = data.riskStatus;
        if (data.isInStock !== undefined)
            updateData.isInStock = data.isInStock;
        if (data.entityType !== undefined)
            updateData.entityType = data.entityType;
        if (data.contractEntity !== undefined)
            updateData.contractEntity = data.contractEntity;
        if (data.contractType !== undefined)
            updateData.contractType = data.contractType;
        if (data.contractNo !== undefined)
            updateData.contractNo = data.contractNo;
        if (data.contractDeadline !== undefined)
            updateData.contractDeadline = data.contractDeadline ? new Date(data.contractDeadline) : null;
        if (data.taxStatus !== undefined)
            updateData.taxStatus = data.taxStatus;
        if (data.contactInfo !== undefined)
            updateData.contactInfo = data.contactInfo ? data.contactInfo.slice(0, 500) : null;
        if (data.contactItems !== undefined)
            updateData.contactItems = data.contactItems;
        if (data.priceItems !== undefined)
            updateData.priceItems = data.priceItems;
        if (data.cooperationCategory !== undefined)
            updateData.cooperationCategory = data.cooperationCategory;
        if (data.supplierType !== undefined)
            updateData.supplierType = data.supplierType
                ? (0, supplier_type_util_1.normalizeSupplierType)(data.supplierType, data.accountName || '')
                : null;
        if (data.artworkUrls !== undefined)
            updateData.artworkUrls = data.artworkUrls;
        if (data.noteImages !== undefined)
            updateData.noteImages = data.noteImages;
        await this.db.update(schema_1.suppliers).set(updateData).where((0, drizzle_orm_1.eq)(schema_1.suppliers.id, id));
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
    async delete(id, operatedBy = 'admin') {
        const existing = await this.findById(id);
        if (!existing)
            return false;
        await this.db.delete(schema_1.suppliers).where((0, drizzle_orm_1.eq)(schema_1.suppliers.id, id));
        await this.auditService.log({
            operation: 'DELETE',
            recordId: id,
            oldData: existing,
            operatedBy,
        });
        return true;
    }
    async batchCreate(items, operatedBy = 'admin') {
        // 批量导入前先创建快照
        try {
            await this.auditService.createSnapshot('pre_import');
        }
        catch (err) {
            this.logger.warn('Pre-import snapshot failed (non-blocking):', err);
        }
        // 为本次导入生成统一批次号，使「导入批次列表 / 批次回滚」可用
        const importBatchId = `import_${new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19)}_${crypto.randomUUID().slice(0, 8)}`;
        let successCount = 0;
        let failCount = 0;
        const errors = [];
        for (let i = 0; i < items.length; i++) {
            const item = items[i];
            try {
                await this.create(item, operatedBy, { importSource: 'import', importBatchId });
                successCount++;
            }
            catch (err) {
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
    async batchDelete(ids, operatedBy = 'admin') {
        // 删除前先创建快照（best-effort，依赖服务器有 mysqldump，失败不阻塞）
        try {
            await this.auditService.createSnapshot('pre_batch_delete');
        }
        catch (err) {
            this.logger.warn('Pre-batch-delete snapshot failed (non-blocking):', err);
        }
        const batchId = `del_${new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19)}_${crypto.randomUUID().slice(0, 8)}`;
        // 先取出确实存在的记录，用于审计 oldData 与精确计数
        const rows = await this.db.select().from(schema_1.suppliers).where((0, drizzle_orm_1.inArray)(schema_1.suppliers.id, ids));
        if (rows.length === 0) {
            return { deleted: 0, notFound: ids.length, batchId };
        }
        await this.db.transaction(async (tx) => {
            for (const row of rows) {
                await tx.insert(schema_1.auditLog).values({
                    operation: 'BATCH_DELETE',
                    recordId: row.id,
                    batchId,
                    oldData: row,
                    newData: null,
                    operatedBy,
                });
            }
            await tx.delete(schema_1.suppliers).where((0, drizzle_orm_1.inArray)(schema_1.suppliers.id, rows.map((r) => r.id)));
        });
        this.logger.log(`Batch deleted ${rows.length} suppliers (batch ${batchId}) by ${operatedBy}`);
        return { deleted: rows.length, notFound: ids.length - rows.length, batchId };
    }
    /** 提取字符串中所有长度>=2的连续子串（用于模糊匹配） */
    /** 比较前对名称做规范化：去除括号内容、地名、行业通用词、法人主体后缀 */
    normalizeName(str) {
        // ① 先删括号内容（必须在删括号字符之前）
        let s = str
            .replace(/（[^）]*）/g, '') // 全角括号
            .replace(/\([^)]*\)/g, '') // 半角括号
            .replace(/【[^】]*】/g, '') // 方括号
            .replace(/\s+/g, ''); // 空格
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
    getNgrams(str, minLen = 2) {
        const s = this.normalizeName(str);
        if (s.length < 2)
            return new Set();
        // 名称主要为英文/数字时，要求更长的匹配（避免 na/an/ana 等短字母组合误触发）
        const isMainlyLatin = (s.match(/[a-zA-Z0-9]/g) || []).length > s.length * 0.5;
        const effectiveMinLen = isMainlyLatin ? 4 : minLen;
        const grams = new Set();
        for (let len = effectiveMinLen; len <= Math.min(s.length, 4); len++) {
            for (let i = 0; i <= s.length - len; i++) {
                grams.add(s.slice(i, i + len));
            }
        }
        return grams;
    }
    /** 查找库内重复/相似画师 */
    async getDuplicates() {
        const all = await this.db.select({
            id: schema_1.suppliers.id,
            accountName: schema_1.suppliers.accountName,
        }).from(schema_1.suppliers);
        const groups = new Map();
        // 先做精确去重（完全一致）
        const nameMap = new Map();
        for (const s of all) {
            const key = (s.accountName || '').trim().toLowerCase();
            if (!nameMap.has(key))
                nameMap.set(key, []);
            nameMap.get(key).push(s);
        }
        const result = [];
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
        const seen = new Set();
        for (let i = 0; i < all.length; i++) {
            for (let j = i + 1; j < all.length; j++) {
                const a = all[i], b = all[j];
                const pairKey = [a.id, b.id].sort().join('|');
                if (seen.has(pairKey))
                    continue;
                const gramsA = this.getNgrams(a.accountName || '');
                const gramsB = this.getNgrams(b.accountName || '');
                const common = [];
                for (const g of gramsA) {
                    if (gramsB.has(g))
                        common.push(g);
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
        const all = await this.db.select().from(schema_1.suppliers);
        const total = all.length;
        // 按归一化后的中文全称统计，兼容历史未迁移的脏值
        const typeOf = (s) => (0, supplier_type_util_1.normalizeSupplierType)(s.supplierType, s.accountName || '');
        const individualCount = all.filter(s => typeOf(s) === '个人画师').length;
        const artistCount = all.filter(s => typeOf(s) === '艺术家').length;
        const studioCount = all.filter(s => typeOf(s) === '工作室').length;
        const companyCount = all.filter(s => typeOf(s) === '公司').length;
        const activeCount = all.filter(s => s.isInStock && s.riskStatus !== '拉黑').length;
        const categoryCount = {};
        all.forEach(s => {
            if (s.cooperationCategory) {
                categoryCount[s.cooperationCategory] = (categoryCount[s.cooperationCategory] || 0) + 1;
            }
        });
        const riskCount = {};
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
    mapToISupplier(dbRecord) {
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
};
exports.SupplierService = SupplierService;
exports.SupplierService = SupplierService = SupplierService_1 = __decorate([
    (0, common_1.Injectable)(),
    __param(0, (0, common_1.Inject)(database_module_1.DRIZZLE_DATABASE)),
    __metadata("design:paramtypes", [Object, audit_service_1.AuditService])
], SupplierService);
//# sourceMappingURL=supplier.service.js.map