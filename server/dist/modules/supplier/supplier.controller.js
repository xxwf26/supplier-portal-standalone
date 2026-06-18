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
Object.defineProperty(exports, "__esModule", { value: true });
exports.SupplierController = void 0;
const common_1 = require("@nestjs/common");
const supplier_service_1 = require("./supplier.service");
const supplier_dto_1 = require("./supplier.dto");
const jwt_auth_guard_1 = require("../auth/jwt-auth.guard");
const roles_guard_1 = require("../auth/roles.guard");
const roles_decorator_1 = require("../auth/roles.decorator");
let SupplierController = class SupplierController {
    supplierService;
    constructor(supplierService) {
        this.supplierService = supplierService;
    }
    async findAll(supplierType, cooperationCategory, subCategory, riskStatus, entityType, keyword) {
        const filter = {};
        if (supplierType)
            filter.supplierType = supplierType.split(',');
        if (cooperationCategory)
            filter.cooperationCategory = cooperationCategory.split(',');
        if (subCategory)
            filter.subCategory = subCategory.split(',');
        if (riskStatus)
            filter.riskStatus = riskStatus.split(',');
        if (entityType)
            filter.entityType = entityType.split(',');
        if (keyword)
            filter.keyword = keyword;
        return this.supplierService.findAll(filter);
    }
    async getStatistics() {
        return this.supplierService.getStatistics();
    }
    async getDuplicates() {
        return this.supplierService.getDuplicates();
    }
    async findById(id) {
        const supplier = await this.supplierService.findById(id);
        if (!supplier) {
            throw new common_1.HttpException('供应商不存在', common_1.HttpStatus.NOT_FOUND);
        }
        return supplier;
    }
    async batchCreate(data, req) {
        if (!data.items || !Array.isArray(data.items) || data.items.length === 0) {
            throw new common_1.HttpException('导入数据不能为空', common_1.HttpStatus.BAD_REQUEST);
        }
        if (data.items.length > 500) {
            throw new common_1.HttpException('单次导入最多 500 条', common_1.HttpStatus.BAD_REQUEST);
        }
        return this.supplierService.batchCreate(data.items, req.user?.username);
    }
    async batchDelete(data, req) {
        if (!data.ids || !Array.isArray(data.ids) || data.ids.length === 0) {
            throw new common_1.HttpException('请选择要删除的画师', common_1.HttpStatus.BAD_REQUEST);
        }
        if (data.ids.length > 500) {
            throw new common_1.HttpException('单次最多删除 500 条', common_1.HttpStatus.BAD_REQUEST);
        }
        return this.supplierService.batchDelete(data.ids, req.user?.username);
    }
    async create(data, req) {
        if (!data.accountName) {
            throw new common_1.HttpException('账号名称不能为空', common_1.HttpStatus.BAD_REQUEST);
        }
        return this.supplierService.create(data, req.user?.username);
    }
    async update(id, data, req) {
        const supplier = await this.supplierService.update(id, data, req.user?.username);
        if (!supplier) {
            throw new common_1.HttpException('供应商不存在', common_1.HttpStatus.NOT_FOUND);
        }
        return supplier;
    }
    async delete(id, req) {
        const success = await this.supplierService.delete(id, req.user?.username);
        if (!success) {
            throw new common_1.HttpException('供应商不存在', common_1.HttpStatus.NOT_FOUND);
        }
        return { success: true };
    }
};
exports.SupplierController = SupplierController;
__decorate([
    (0, common_1.Get)(),
    __param(0, (0, common_1.Query)('supplierType')),
    __param(1, (0, common_1.Query)('cooperationCategory')),
    __param(2, (0, common_1.Query)('subCategory')),
    __param(3, (0, common_1.Query)('riskStatus')),
    __param(4, (0, common_1.Query)('entityType')),
    __param(5, (0, common_1.Query)('keyword')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, String, String, String, String, String]),
    __metadata("design:returntype", Promise)
], SupplierController.prototype, "findAll", null);
__decorate([
    (0, common_1.Get)('statistics'),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", Promise)
], SupplierController.prototype, "getStatistics", null);
__decorate([
    (0, common_1.Get)('duplicates'),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", Promise)
], SupplierController.prototype, "getDuplicates", null);
__decorate([
    (0, common_1.Get)(':id'),
    __param(0, (0, common_1.Param)('id')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", Promise)
], SupplierController.prototype, "findById", null);
__decorate([
    (0, common_1.Post)('batch'),
    (0, common_1.UseGuards)(jwt_auth_guard_1.JwtAuthGuard, roles_guard_1.RolesGuard),
    (0, roles_decorator_1.Roles)('admin'),
    __param(0, (0, common_1.Body)()),
    __param(1, (0, common_1.Request)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [supplier_dto_1.BatchCreateSupplierDto, Object]),
    __metadata("design:returntype", Promise)
], SupplierController.prototype, "batchCreate", null);
__decorate([
    (0, common_1.Post)('batch-delete'),
    (0, common_1.UseGuards)(jwt_auth_guard_1.JwtAuthGuard, roles_guard_1.RolesGuard),
    (0, roles_decorator_1.Roles)('admin'),
    __param(0, (0, common_1.Body)()),
    __param(1, (0, common_1.Request)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [supplier_dto_1.BatchDeleteSupplierDto, Object]),
    __metadata("design:returntype", Promise)
], SupplierController.prototype, "batchDelete", null);
__decorate([
    (0, common_1.Post)(),
    (0, common_1.UseGuards)(jwt_auth_guard_1.JwtAuthGuard, roles_guard_1.RolesGuard),
    (0, roles_decorator_1.Roles)('admin'),
    __param(0, (0, common_1.Body)()),
    __param(1, (0, common_1.Request)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [supplier_dto_1.CreateSupplierDto, Object]),
    __metadata("design:returntype", Promise)
], SupplierController.prototype, "create", null);
__decorate([
    (0, common_1.Put)(':id'),
    (0, common_1.UseGuards)(jwt_auth_guard_1.JwtAuthGuard, roles_guard_1.RolesGuard),
    (0, roles_decorator_1.Roles)('admin'),
    __param(0, (0, common_1.Param)('id')),
    __param(1, (0, common_1.Body)()),
    __param(2, (0, common_1.Request)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, supplier_dto_1.UpdateSupplierDto, Object]),
    __metadata("design:returntype", Promise)
], SupplierController.prototype, "update", null);
__decorate([
    (0, common_1.Delete)(':id'),
    (0, common_1.UseGuards)(jwt_auth_guard_1.JwtAuthGuard, roles_guard_1.RolesGuard),
    (0, roles_decorator_1.Roles)('admin'),
    __param(0, (0, common_1.Param)('id')),
    __param(1, (0, common_1.Request)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, Object]),
    __metadata("design:returntype", Promise)
], SupplierController.prototype, "delete", null);
exports.SupplierController = SupplierController = __decorate([
    (0, common_1.Controller)('/api/suppliers'),
    (0, common_1.UseGuards)(jwt_auth_guard_1.JwtAuthGuard),
    __metadata("design:paramtypes", [supplier_service_1.SupplierService])
], SupplierController);
//# sourceMappingURL=supplier.controller.js.map