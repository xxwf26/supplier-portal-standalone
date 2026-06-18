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
// MariaDB 的 JSON 列有时以字符串形式返回，统一解析
function parseJsonField(value) {
    if (value === null || value === undefined)
        return null;
    if (typeof value === 'string') {
        try {
            return JSON.parse(value);
        }
        catch {
            return null;
        }
    }
    return value;
}
const schema_1 = require("../../database/schema");
const child_process_1 = require("child_process");
const util_1 = require("util");
const path_1 = require("path");
const fs_1 = require("fs");
const config_1 = require("@nestjs/config");
const execAsync = (0, util_1.promisify)(child_process_1.exec);
// 将快照中可能的字符串日期转换为 Date 对象
function parseDateField(val) {
    if (!val)
        return null;
    if (val instanceof Date)
        return val;
    if (typeof val === 'string') {
        const d = new Date(val);
        return isNaN(d.getTime()) ? null : d;
    }
    return null;
}
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
        const where = operation ? (0, drizzle_orm_1.eq)(schema_1.auditLog.operation, operation) : undefined;
        const [rows, countResult] = await Promise.all([
            this.db.select().from(schema_1.auditLog).where(where).orderBy((0, drizzle_orm_1.desc)(schema_1.auditLog.createdAt)).limit(limit).offset(offset),
            this.db.select({ total: (0, drizzle_orm_1.count)() }).from(schema_1.auditLog).where(where),
        ]);
        return { list: rows, total: countResult[0]?.total ?? 0, page, limit };
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
        // drizzle mysql2 execute 返回 [rows, fields]
        const rows = Array.isArray(result[0]) ? result[0] : result;
        return rows;
    }
    // ── 回滚批次（事务保证原子性） ────────────────────────────
    async rollbackBatch(batchId, operatedBy) {
        const toDelete = await this.db
            .select()
            .from(schema_1.suppliers)
            .where((0, drizzle_orm_1.eq)(schema_1.suppliers.importBatchId, batchId));
        if (toDelete.length === 0) {
            return { deleted: 0, message: '该批次数据已不存在' };
        }
        await this.db.transaction(async (tx) => {
            for (const row of toDelete) {
                await tx.insert(schema_1.auditLog).values({
                    operation: 'BATCH_ROLLBACK',
                    recordId: row.id,
                    batchId,
                    oldData: row,
                    newData: null,
                    operatedBy,
                });
            }
            await tx.delete(schema_1.suppliers).where((0, drizzle_orm_1.eq)(schema_1.suppliers.importBatchId, batchId));
        });
        this.logger.log(`Rolled back batch ${batchId}: deleted ${toDelete.length} records by ${operatedBy}`);
        return { deleted: toDelete.length, message: `已撤销 ${toDelete.length} 条导入数据` };
    }
    // ── 整批恢复（撤销一次批量删除，事务保证原子性） ──────────
    async rollbackDeleteBatch(batchId, operatedBy) {
        const logs = await this.db
            .select()
            .from(schema_1.auditLog)
            .where((0, drizzle_orm_1.and)((0, drizzle_orm_1.eq)(schema_1.auditLog.batchId, batchId), (0, drizzle_orm_1.eq)(schema_1.auditLog.operation, 'BATCH_DELETE')));
        if (logs.length === 0) {
            return { restored: 0, message: '该批次删除记录不存在或已恢复' };
        }
        let restored = 0;
        await this.db.transaction(async (tx) => {
            for (const entry of logs) {
                const old = parseJsonField(entry.oldData);
                if (!old)
                    continue;
                await tx
                    .insert(schema_1.suppliers)
                    .values(this.buildSupplierRow(old))
                    .onDuplicateKeyUpdate({ set: { updatedAt: new Date() } });
                await tx.insert(schema_1.auditLog).values({
                    operation: 'BATCH_DELETE_ROLLBACK',
                    recordId: entry.recordId,
                    batchId,
                    oldData: null,
                    newData: old,
                    operatedBy,
                });
                restored++;
            }
        });
        this.logger.log(`Restored ${restored} suppliers from batch delete ${batchId} by ${operatedBy}`);
        return { restored, message: `已恢复 ${restored} 位画师` };
    }
    /** 从审计 oldData 还原一条 suppliers 插入行（撤回删除时复用） */
    buildSupplierRow(old) {
        return {
            id: old.id,
            accountName: old.accountName,
            socialLinks: old.socialLinks || {},
            subCategory: old.subCategory || null,
            cooperationType: old.cooperationType || null,
            priceRange: old.priceRange || null,
            priceItems: old.priceItems || [],
            cooperationCount: Number(old.cooperationCount) || 0,
            rating: old.rating !== undefined && old.rating !== null ? Number(old.rating) : null,
            riskStatus: old.riskStatus || '暂无',
            isInStock: old.isInStock ?? true,
            entityType: old.entityType || null,
            contractEntity: old.contractEntity || null,
            contractType: old.contractType || null,
            contractNo: old.contractNo || null,
            contractDeadline: parseDateField(old.contractDeadline),
            taxStatus: old.taxStatus || null,
            contactInfo: old.contactInfo || null,
            contactItems: old.contactItems || [],
            cooperationCategory: old.cooperationCategory || null,
            supplierType: old.supplierType || null,
            artworkUrls: old.artworkUrls || [],
            manualLinks: old.manualLinks || {},
            importSource: old.importSource || 'manual',
            importBatchId: old.importBatchId || null,
            createdAt: parseDateField(old.createdAt) ?? new Date(),
            updatedAt: new Date(),
        };
    }
    // ── 单条日志撤回 ─────────────────────────────────────────
    async rollbackLog(logId, operatedBy) {
        const entries = await this.db
            .select()
            .from(schema_1.auditLog)
            .where((0, drizzle_orm_1.eq)(schema_1.auditLog.id, logId))
            .limit(1);
        if (!entries.length)
            throw new Error('日志记录不存在');
        const entry = entries[0];
        if (!['INSERT', 'UPDATE', 'DELETE', 'BATCH_DELETE'].includes(entry.operation)) {
            throw new Error(`此操作类型不支持撤回: ${entry.operation}`);
        }
        const recordId = entry.recordId;
        switch (entry.operation) {
            case 'INSERT': {
                if (recordId) {
                    await this.db.delete(schema_1.suppliers).where((0, drizzle_orm_1.eq)(schema_1.suppliers.id, recordId));
                }
                break;
            }
            case 'UPDATE': {
                if (recordId && entry.oldData) {
                    const allRecordLogs = await this.db
                        .select({ id: schema_1.auditLog.id, operation: schema_1.auditLog.operation })
                        .from(schema_1.auditLog)
                        .where((0, drizzle_orm_1.eq)(schema_1.auditLog.recordId, recordId))
                        .orderBy((0, drizzle_orm_1.desc)(schema_1.auditLog.id));
                    const laterOps = allRecordLogs.filter(r => r.id > logId && ['UPDATE', 'DELETE'].includes(r.operation));
                    if (laterOps.length > 0) {
                        this.logger.warn(`Rollback log ${logId}: ${laterOps.length} later update(s) will be overwritten`);
                    }
                    // ★ 解析 JSON 字符串（MariaDB 返回 JSON 列为字符串）
                    const old = parseJsonField(entry.oldData) ?? {};
                    const skipFields = new Set(['id', 'createdAt', 'updatedAt', 'importBatchId', 'importSource']);
                    const restoreData = { updatedAt: new Date() };
                    for (const [k, v] of Object.entries(old)) {
                        if (skipFields.has(k))
                            continue;
                        if (k === 'contractDeadline') {
                            restoreData[k] = parseDateField(v);
                        }
                        else {
                            restoreData[k] = v;
                        }
                    }
                    await this.db.update(schema_1.suppliers).set(restoreData).where((0, drizzle_orm_1.eq)(schema_1.suppliers.id, recordId));
                    if (laterOps.length > 0) {
                        await this.log({ operation: 'LOG_ROLLBACK', recordId: recordId ?? undefined, batchId: String(logId), oldData: entry.newData, newData: entry.oldData, operatedBy });
                        this.logger.log(`Log ${logId} rolled back by ${operatedBy}`);
                        return { message: `撤回成功（注意：该记录在此操作后还有 ${laterOps.length} 次编辑已被覆盖）` };
                    }
                }
                break;
            }
            case 'DELETE':
            case 'BATCH_DELETE': {
                if (entry.oldData) {
                    // ★ 解析 JSON 字符串
                    const old = parseJsonField(entry.oldData);
                    if (old) {
                        await this.db
                            .insert(schema_1.suppliers)
                            .values(this.buildSupplierRow(old))
                            .onDuplicateKeyUpdate({ set: { updatedAt: new Date() } });
                    }
                }
                break;
            }
        }
        await this.log({
            operation: 'LOG_ROLLBACK',
            recordId: recordId ?? undefined,
            batchId: String(logId),
            oldData: entry.newData,
            newData: entry.oldData,
            operatedBy,
        });
        this.logger.log(`Log ${logId} rolled back by ${operatedBy}`);
        return { message: '撤回成功' };
    }
    // ── 快照：恢复 ───────────────────────────────────────────
    async restoreSnapshot(filename, operatedBy) {
        if (!filename.endsWith('.sql') || filename.includes('/') || filename.includes('..')) {
            throw new Error('非法的快照文件名');
        }
        const filepath = (0, path_1.join)(this.backupsDir, filename);
        if (!(0, fs_1.existsSync)(filepath))
            throw new Error('快照文件不存在');
        const host = this.config.get('DB_HOST', 'localhost');
        const port = this.config.get('DB_PORT', '3306');
        const user = this.config.get('DB_USER', 'root');
        const pass = this.config.get('DB_PASSWORD', '');
        const dbName = this.config.get('DB_NAME', 'supplier_portal');
        const cmd = `mysql -h${host} -P${port} -u${user} ${dbName} < "${filepath}"`;
        try {
            await execAsync(cmd, { env: { ...process.env, MYSQL_PWD: pass } });
            await this.log({ operation: 'SNAPSHOT_RESTORE', operatedBy, batchId: filename });
            this.logger.log(`Snapshot restored: ${filename} by ${operatedBy}`);
            return { message: `数据库已恢复至快照 ${filename}，请刷新页面` };
        }
        catch (err) {
            this.logger.error('Snapshot restore failed', err);
            throw new Error('快照恢复失败：' + err.message);
        }
    }
    // ── 快照：创建（通过 MYSQL_PWD 环境变量传密码，避免命令行注入） ──
    async createSnapshot(reason = 'manual') {
        const ts = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
        const filename = `snapshot_${ts}_${reason}.sql`;
        const filepath = (0, path_1.join)(this.backupsDir, filename);
        const host = this.config.get('DB_HOST', 'localhost');
        const port = this.config.get('DB_PORT', '3306');
        const user = this.config.get('DB_USER', 'root');
        const pass = this.config.get('DB_PASSWORD', '');
        const dbName = this.config.get('DB_NAME', 'supplier_portal');
        // 通过 MYSQL_PWD 环境变量传递密码，避免命令行拼接导致的注入/解析风险
        const cmd = `mysqldump -h${host} -P${port} -u${user} --single-transaction --routines --triggers ${dbName} > "${filepath}"`;
        try {
            await execAsync(cmd, { env: { ...process.env, MYSQL_PWD: pass } });
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