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
var AuditService_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.AuditService = void 0;
const common_1 = require("@nestjs/common");
const drizzle_orm_1 = require("drizzle-orm");
const database_module_1 = require("../../database/database.module");
const schema_1 = require("../../database/schema");
const child_process_1 = require("child_process");
const util_1 = require("util");
const path_1 = require("path");
const fs_1 = require("fs");
const config_1 = require("@nestjs/config");
const execAsync = (0, util_1.promisify)(child_process_1.exec);
let AuditService = AuditService_1 = class AuditService {
    db;
    config;
    logger = new common_1.Logger(AuditService_1.name);
    backupsDir;
    constructor(db, config) {
        this.db = db;
        this.config = config;
        this.backupsDir = (0, path_1.join)(process.cwd(), '..', 'backups');
        if (!(0, fs_1.existsSync)(this.backupsDir))
            (0, fs_1.mkdirSync)(this.backupsDir, { recursive: true });
    }
    // ── 写审计日志 ──────────────────────────────────────────
    async log(params) {
        try {
            await this.db.insert(schema_1.auditLog).values({
                operation: params.operation,
                recordId: params.recordId ?? null,
                batchId: params.batchId ?? null,
                oldData: params.oldData ?? null,
                newData: params.newData ?? null,
                operatedBy: params.operatedBy ?? 'system',
            });
        }
        catch (err) {
            this.logger.error('Failed to write audit log', err);
        }
    }
    // ── 读审计日志（分页） ───────────────────────────────────
    async getLogs(page = 1, limit = 50, operation) {
        const offset = (page - 1) * limit;
        const rows = await this.db
            .select()
            .from(schema_1.auditLog)
            .where(operation ? (0, drizzle_orm_1.eq)(schema_1.auditLog.operation, operation) : undefined)
            .orderBy((0, drizzle_orm_1.desc)(schema_1.auditLog.createdAt))
            .limit(limit)
            .offset(offset);
        const countRows = await this.db
            .select({ id: schema_1.auditLog.id })
            .from(schema_1.auditLog)
            .where(operation ? (0, drizzle_orm_1.eq)(schema_1.auditLog.operation, operation) : undefined);
        return { list: rows, total: countRows.length, page, limit };
    }
    // ── 批次列表（导入历史） ─────────────────────────────────
    async getBatches() {
        const result = await this.db.execute((0, drizzle_orm_1.sql) `
      SELECT import_batch_id, COUNT(*) AS count, MIN(created_at) AS imported_at
      FROM suppliers
      WHERE import_batch_id IS NOT NULL
      GROUP BY import_batch_id
      ORDER BY imported_at DESC
      LIMIT 100
    `);
        return result[0];
    }
    // ── 回滚批次 ─────────────────────────────────────────────
    async rollbackBatch(batchId, operatedBy) {
        // 先查出要删的数据（用于日志）
        const toDelete = await this.db
            .select()
            .from(schema_1.suppliers)
            .where((0, drizzle_orm_1.eq)(schema_1.suppliers.importBatchId, batchId));
        if (toDelete.length === 0) {
            return { deleted: 0, message: '该批次数据已不存在' };
        }
        // 写批量回滚审计记录
        for (const row of toDelete) {
            await this.log({
                operation: 'BATCH_ROLLBACK',
                recordId: row.id,
                batchId,
                oldData: row,
                operatedBy,
            });
        }
        // 删除该批次的所有供应商
        await this.db.delete(schema_1.suppliers).where((0, drizzle_orm_1.eq)(schema_1.suppliers.importBatchId, batchId));
        this.logger.log(`Rolled back batch ${batchId}: deleted ${toDelete.length} records by ${operatedBy}`);
        return { deleted: toDelete.length, message: `已撤销 ${toDelete.length} 条导入数据` };
    }
    // ── 快照：创建 ───────────────────────────────────────────
    async createSnapshot(reason = 'manual') {
        const ts = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
        const filename = `snapshot_${ts}_${reason}.sql`;
        const filepath = (0, path_1.join)(this.backupsDir, filename);
        const host = this.config.get('DB_HOST', 'localhost');
        const port = this.config.get('DB_PORT', '3306');
        const user = this.config.get('DB_USER', 'root');
        const pass = this.config.get('DB_PASSWORD', '');
        const dbName = this.config.get('DB_NAME', 'supplier_portal');
        const cmd = `mysqldump -h${host} -P${port} -u${user} -p${pass} --single-transaction --routines --triggers ${dbName} > "${filepath}"`;
        try {
            await execAsync(cmd);
            const size = (0, fs_1.statSync)(filepath).size;
            await this.log({ operation: 'SNAPSHOT', operatedBy: reason, batchId: filename });
            await this.pruneSnapshots();
            this.logger.log(`Snapshot created: ${filename} (${size} bytes)`);
            return { filename, size };
        }
        catch (err) {
            this.logger.error('Snapshot failed', err);
            throw new Error('快照创建失败：' + err.message);
        }
    }
    // ── 快照：列表 ───────────────────────────────────────────
    listSnapshots() {
        if (!(0, fs_1.existsSync)(this.backupsDir))
            return [];
        return (0, fs_1.readdirSync)(this.backupsDir)
            .filter(f => f.endsWith('.sql'))
            .map(f => {
            const stat = (0, fs_1.statSync)((0, path_1.join)(this.backupsDir, f));
            return { filename: f, size: stat.size, createdAt: stat.mtime.toISOString() };
        })
            .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
    }
    // ── 快照：自动清理（保留最近 30 个） ────────────────────
    pruneSnapshots(keep = 30) {
        const all = this.listSnapshots();
        if (all.length <= keep)
            return;
        all.slice(keep).forEach(s => {
            try {
                (0, fs_1.unlinkSync)((0, path_1.join)(this.backupsDir, s.filename));
            }
            catch { /* ignore */ }
        });
    }
};
exports.AuditService = AuditService;
exports.AuditService = AuditService = AuditService_1 = __decorate([
    (0, common_1.Injectable)(),
    __param(0, (0, common_1.Inject)(database_module_1.DRIZZLE_DATABASE)),
    __metadata("design:paramtypes", [Object, config_1.ConfigService])
], AuditService);
//# sourceMappingURL=audit.service.js.map