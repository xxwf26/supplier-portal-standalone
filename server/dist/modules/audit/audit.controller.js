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
exports.AuditController = void 0;
const common_1 = require("@nestjs/common");
const audit_service_1 = require("./audit.service");
const jwt_auth_guard_1 = require("../auth/jwt-auth.guard");
const roles_guard_1 = require("../auth/roles.guard");
const roles_decorator_1 = require("../auth/roles.decorator");
let AuditController = class AuditController {
    auditService;
    constructor(auditService) {
        this.auditService = auditService;
    }
    /** 变更记录分页列表（管理员） */
    getLogs(page = '1', limit = '50', operation) {
        return this.auditService.getLogs(Number(page), Number(limit), operation);
    }
    /** 导入批次列表（管理员） */
    getBatches() {
        return this.auditService.getBatches();
    }
    /** 回滚单条日志（管理员） */
    rollbackLog(id, req) {
        return this.auditService.rollbackLog(Number(id), req.user?.username ?? 'admin');
    }
    /** 回滚指定批次（管理员） */
    rollbackBatch(batchId, req) {
        return this.auditService.rollbackBatch(batchId, req.user?.username ?? 'admin');
    }
    /** 快照列表（管理员） */
    listSnapshots() {
        return this.auditService.listSnapshots();
    }
    /** 恢复快照（管理员） */
    restoreSnapshot(filename, req) {
        return this.auditService.restoreSnapshot(decodeURIComponent(filename), req.user?.username ?? 'admin');
    }
    /** 手动创建快照（管理员） */
    createSnapshot(req) {
        return this.auditService.createSnapshot(req.user?.username ?? 'manual');
    }
};
exports.AuditController = AuditController;
__decorate([
    (0, common_1.Get)('logs'),
    (0, common_1.UseGuards)(roles_guard_1.RolesGuard),
    (0, roles_decorator_1.Roles)('admin'),
    __param(0, (0, common_1.Query)('page')),
    __param(1, (0, common_1.Query)('limit')),
    __param(2, (0, common_1.Query)('operation')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, Object, String]),
    __metadata("design:returntype", void 0)
], AuditController.prototype, "getLogs", null);
__decorate([
    (0, common_1.Get)('batches'),
    (0, common_1.UseGuards)(roles_guard_1.RolesGuard),
    (0, roles_decorator_1.Roles)('admin'),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", void 0)
], AuditController.prototype, "getBatches", null);
__decorate([
    (0, common_1.Post)('rollback-log/:id'),
    (0, common_1.UseGuards)(roles_guard_1.RolesGuard),
    (0, roles_decorator_1.Roles)('admin'),
    __param(0, (0, common_1.Param)('id')),
    __param(1, (0, common_1.Request)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, Object]),
    __metadata("design:returntype", void 0)
], AuditController.prototype, "rollbackLog", null);
__decorate([
    (0, common_1.Post)('rollback-batch/:batchId'),
    (0, common_1.UseGuards)(roles_guard_1.RolesGuard),
    (0, roles_decorator_1.Roles)('admin'),
    __param(0, (0, common_1.Param)('batchId')),
    __param(1, (0, common_1.Request)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, Object]),
    __metadata("design:returntype", void 0)
], AuditController.prototype, "rollbackBatch", null);
__decorate([
    (0, common_1.Get)('snapshots'),
    (0, common_1.UseGuards)(roles_guard_1.RolesGuard),
    (0, roles_decorator_1.Roles)('admin'),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", void 0)
], AuditController.prototype, "listSnapshots", null);
__decorate([
    (0, common_1.Post)('restore-snapshot/:filename'),
    (0, common_1.UseGuards)(roles_guard_1.RolesGuard),
    (0, roles_decorator_1.Roles)('admin'),
    __param(0, (0, common_1.Param)('filename')),
    __param(1, (0, common_1.Request)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, Object]),
    __metadata("design:returntype", void 0)
], AuditController.prototype, "restoreSnapshot", null);
__decorate([
    (0, common_1.Post)('snapshots'),
    (0, common_1.UseGuards)(roles_guard_1.RolesGuard),
    (0, roles_decorator_1.Roles)('admin'),
    __param(0, (0, common_1.Request)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", void 0)
], AuditController.prototype, "createSnapshot", null);
exports.AuditController = AuditController = __decorate([
    (0, common_1.Controller)('api/audit'),
    (0, common_1.UseGuards)(jwt_auth_guard_1.JwtAuthGuard),
    __metadata("design:paramtypes", [audit_service_1.AuditService])
], AuditController);
//# sourceMappingURL=audit.controller.js.map