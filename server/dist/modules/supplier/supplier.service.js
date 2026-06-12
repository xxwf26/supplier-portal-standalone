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
let SupplierService = SupplierService_1 = class SupplierService {
    db;
    logger = new common_1.Logger(SupplierService_1.name);
    constructor(db) {
        this.db = db;
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
    async create(data) {
        await this.db.insert(schema_1.suppliers).values({
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
            contactInfo: data.contactInfo || null,
            contactItems: data.contactItems || [],
            cooperationCategory: data.cooperationCategory || null,
            supplierType: data.supplierType || null,
            importSource: 'manual',
        });
        // Get the inserted record (last insert)
        const all = await this.db.select().from(schema_1.suppliers).orderBy((0, drizzle_orm_1.sql) `${schema_1.suppliers.createdAt} DESC`).limit(1);
        return this.mapToISupplier(all[0]);
    }
    async update(id, data) {
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
            updateData.cooperationCount = data.cooperationCount;
        if (data.rating !== undefined)
            updateData.rating = data.rating;
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
            updateData.contactInfo = data.contactInfo;
        if (data.contactItems !== undefined)
            updateData.contactItems = data.contactItems;
        if (data.priceItems !== undefined)
            updateData.priceItems = data.priceItems;
        if (data.cooperationCategory !== undefined)
            updateData.cooperationCategory = data.cooperationCategory;
        if (data.supplierType !== undefined)
            updateData.supplierType = data.supplierType;
        if (data.artworkUrls !== undefined)
            updateData.artworkUrls = data.artworkUrls;
        await this.db.update(schema_1.suppliers).set(updateData).where((0, drizzle_orm_1.eq)(schema_1.suppliers.id, id));
        return this.findById(id);
    }
    async delete(id) {
        await this.db.delete(schema_1.suppliers).where((0, drizzle_orm_1.eq)(schema_1.suppliers.id, id));
        return true;
    }
    async batchCreate(items) {
        let successCount = 0;
        let failCount = 0;
        const errors = [];
        for (let i = 0; i < items.length; i++) {
            const item = items[i];
            try {
                await this.create(item);
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
    async getStatistics() {
        const all = await this.db.select().from(schema_1.suppliers);
        const total = all.length;
        const individualCount = all.filter(s => s.supplierType === '个人').length;
        const companyCount = all.filter(s => s.supplierType === '公司' || s.supplierType === '个体工商户').length;
        const activeCount = all.filter(s => s.isInStock && s.riskStatus !== '拉黑').length;
        const categoryCount = {};
        all.forEach(s => {
            if (s.cooperationCategory) {
                categoryCount[s.cooperationCategory] = (categoryCount[s.cooperationCategory] || 0) + 1;
            }
        });
        const riskCount = {};
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
    __metadata("design:paramtypes", [Object])
], SupplierService);
//# sourceMappingURL=supplier.service.js.map