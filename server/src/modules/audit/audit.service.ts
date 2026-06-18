import { Injectable, Inject, Logger } from '@nestjs/common';
import { and, count, desc, eq, gt, sql } from 'drizzle-orm';
import { DRIZZLE_DATABASE, type Database } from '../../database/database.module';

// MariaDB 的 JSON 列有时以字符串形式返回，统一解析
function parseJsonField<T>(value: unknown): T | null {
  if (value === null || value === undefined) return null;
  if (typeof value === 'string') {
    try { return JSON.parse(value) as T; } catch { return null; }
  }
  return value as T;
}
import { auditLog, suppliers } from '../../database/schema';
import { exec } from 'child_process';
import { promisify } from 'util';
import { join } from 'path';
import { existsSync, mkdirSync, readdirSync, statSync, unlinkSync } from 'fs';
import { ConfigService } from '@nestjs/config';

const execAsync = promisify(exec);

export interface ILogParams {
  operation: string;
  recordId?: string;
  batchId?: string;
  oldData?: unknown;
  newData?: unknown;
  operatedBy?: string;
}

// 将快照中可能的字符串日期转换为 Date 对象
function parseDateField(val: unknown): Date | null {
  if (!val) return null;
  if (val instanceof Date) return val;
  if (typeof val === 'string') {
    const d = new Date(val);
    return isNaN(d.getTime()) ? null : d;
  }
  return null;
}

@Injectable()
export class AuditService {
  private readonly logger = new Logger(AuditService.name);
  private readonly backupsDir: string;

  constructor(
    @Inject(DRIZZLE_DATABASE) private readonly db: Database,
    private readonly config: ConfigService,
  ) {
    this.backupsDir = join(process.cwd(), '..', 'backups');
    if (!existsSync(this.backupsDir)) mkdirSync(this.backupsDir, { recursive: true });
  }

  // ── 写审计日志 ──────────────────────────────────────────

  async log(params: ILogParams): Promise<void> {
    try {
      await this.db.insert(auditLog).values({
        operation: params.operation,
        recordId: params.recordId ?? null,
        batchId: params.batchId ?? null,
        oldData: params.oldData ?? null,
        newData: params.newData ?? null,
        operatedBy: params.operatedBy ?? 'system',
      });
    } catch (err) {
      this.logger.error('Failed to write audit log', err);
    }
  }

  // ── 读审计日志（分页） ───────────────────────────────────

  async getLogs(page = 1, limit = 50, operation?: string) {
    const offset = (page - 1) * limit;
    const where = operation ? eq(auditLog.operation, operation) : undefined;

    const [rows, countResult] = await Promise.all([
      this.db.select().from(auditLog).where(where).orderBy(desc(auditLog.createdAt)).limit(limit).offset(offset),
      this.db.select({ total: count() }).from(auditLog).where(where),
    ]);

    return { list: rows, total: countResult[0]?.total ?? 0, page, limit };
  }

  // ── 批次列表（导入历史） ─────────────────────────────────

  async getBatches() {
    const result = await this.db.execute(sql`
      SELECT import_batch_id, COUNT(*) AS count, MIN(created_at) AS imported_at
      FROM suppliers
      WHERE import_batch_id IS NOT NULL
      GROUP BY import_batch_id
      ORDER BY imported_at DESC
      LIMIT 100
    `);
    // drizzle mysql2 execute 返回 [rows, fields]
    const rows = Array.isArray((result as any)[0]) ? (result as any)[0] : result;
    return rows as Array<{ import_batch_id: string; count: number; imported_at: string }>;
  }

  // ── 回滚批次（事务保证原子性） ────────────────────────────

  async rollbackBatch(batchId: string, operatedBy: string) {
    const toDelete = await this.db
      .select()
      .from(suppliers)
      .where(eq(suppliers.importBatchId, batchId));

    if (toDelete.length === 0) {
      return { deleted: 0, message: '该批次数据已不存在' };
    }

    await this.db.transaction(async (tx) => {
      for (const row of toDelete) {
        await tx.insert(auditLog).values({
          operation: 'BATCH_ROLLBACK',
          recordId: row.id,
          batchId,
          oldData: row,
          newData: null,
          operatedBy,
        });
      }
      await tx.delete(suppliers).where(eq(suppliers.importBatchId, batchId));
    });

    this.logger.log(`Rolled back batch ${batchId}: deleted ${toDelete.length} records by ${operatedBy}`);
    return { deleted: toDelete.length, message: `已撤销 ${toDelete.length} 条导入数据` };
  }

  // ── 整批恢复（撤销一次批量删除，事务保证原子性） ──────────

  async rollbackDeleteBatch(batchId: string, operatedBy: string): Promise<{ restored: number; message: string }> {
    const logs = await this.db
      .select()
      .from(auditLog)
      .where(and(eq(auditLog.batchId, batchId), eq(auditLog.operation, 'BATCH_DELETE')));

    if (logs.length === 0) {
      return { restored: 0, message: '该批次删除记录不存在或已恢复' };
    }

    let restored = 0;
    await this.db.transaction(async (tx) => {
      for (const entry of logs) {
        const old = parseJsonField<Record<string, unknown>>(entry.oldData);
        if (!old) continue;
        await tx
          .insert(suppliers)
          .values(this.buildSupplierRow(old))
          .onDuplicateKeyUpdate({ set: { updatedAt: new Date() } });
        await tx.insert(auditLog).values({
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
  private buildSupplierRow(old: Record<string, unknown>): any {
    // JSON 列在 oldData 里可能是字符串，需先 parse，否则会被再次编码成字符串（双重编码）
    return {
      id: old.id,
      accountName: old.accountName,
      socialLinks: parseJsonField(old.socialLinks) ?? {},
      subCategory: old.subCategory || null,
      cooperationType: old.cooperationType || null,
      priceRange: old.priceRange || null,
      priceItems: parseJsonField(old.priceItems) ?? [],
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
      contactItems: parseJsonField(old.contactItems) ?? [],
      cooperationCategory: old.cooperationCategory || null,
      supplierType: old.supplierType || null,
      artworkUrls: parseJsonField(old.artworkUrls) ?? [],
      manualLinks: parseJsonField(old.manualLinks) ?? {},
      noteImages: parseJsonField(old.noteImages) ?? [],
      importSource: old.importSource || 'manual',
      importBatchId: old.importBatchId || null,
      createdAt: parseDateField(old.createdAt) ?? new Date(),
      updatedAt: new Date(),
    };
  }

  // ── 单条日志撤回 ─────────────────────────────────────────

  async rollbackLog(logId: number, operatedBy: string): Promise<{ message: string }> {
    const entries = await this.db
      .select()
      .from(auditLog)
      .where(eq(auditLog.id, logId))
      .limit(1);

    if (!entries.length) throw new Error('日志记录不存在');
    const entry = entries[0];

    if (!['INSERT', 'UPDATE', 'DELETE', 'BATCH_DELETE'].includes(entry.operation)) {
      throw new Error(`此操作类型不支持撤回: ${entry.operation}`);
    }

    const recordId = entry.recordId;

    switch (entry.operation) {
      case 'INSERT': {
        if (recordId) {
          await this.db.delete(suppliers).where(eq(suppliers.id, recordId));
        }
        break;
      }
      case 'UPDATE': {
        if (recordId && entry.oldData) {
          const allRecordLogs = await this.db
            .select({ id: auditLog.id, operation: auditLog.operation })
            .from(auditLog)
            .where(eq(auditLog.recordId, recordId))
            .orderBy(desc(auditLog.id));
          const laterOps = allRecordLogs.filter(r => r.id > logId && ['UPDATE', 'DELETE'].includes(r.operation));
          if (laterOps.length > 0) {
            this.logger.warn(`Rollback log ${logId}: ${laterOps.length} later update(s) will be overwritten`);
          }

          // ★ 解析 JSON 字符串（MariaDB 返回 JSON 列为字符串）
          const old = parseJsonField<Record<string, unknown>>(entry.oldData) ?? {};
          const skipFields = new Set(['id', 'createdAt', 'updatedAt', 'importBatchId', 'importSource']);
          const restoreData: Record<string, unknown> = { updatedAt: new Date() };
          for (const [k, v] of Object.entries(old)) {
            if (skipFields.has(k)) continue;
            if (k === 'contractDeadline') {
              restoreData[k] = parseDateField(v);
            } else {
              restoreData[k] = v;
            }
          }
          await this.db.update(suppliers).set(restoreData).where(eq(suppliers.id, recordId));

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
          const old = parseJsonField<Record<string, unknown>>(entry.oldData);
          if (old) {
            await this.db
              .insert(suppliers)
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

  async restoreSnapshot(filename: string, operatedBy: string): Promise<{ message: string }> {
    if (!filename.endsWith('.sql') || filename.includes('/') || filename.includes('..')) {
      throw new Error('非法的快照文件名');
    }
    const filepath = join(this.backupsDir, filename);
    if (!existsSync(filepath)) throw new Error('快照文件不存在');

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
    } catch (err) {
      this.logger.error('Snapshot restore failed', err);
      throw new Error('快照恢复失败：' + (err as Error).message);
    }
  }

  // ── 快照：创建（通过 MYSQL_PWD 环境变量传密码，避免命令行注入） ──

  async createSnapshot(reason = 'manual'): Promise<{ filename: string; size: number }> {
    const ts = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
    const filename = `snapshot_${ts}_${reason}.sql`;
    const filepath = join(this.backupsDir, filename);

    const host = this.config.get('DB_HOST', 'localhost');
    const port = this.config.get('DB_PORT', '3306');
    const user = this.config.get('DB_USER', 'root');
    const pass = this.config.get('DB_PASSWORD', '');
    const dbName = this.config.get('DB_NAME', 'supplier_portal');

    // 通过 MYSQL_PWD 环境变量传递密码，避免命令行拼接导致的注入/解析风险
    const cmd = `mysqldump -h${host} -P${port} -u${user} --single-transaction --routines --triggers ${dbName} > "${filepath}"`;

    try {
      await execAsync(cmd, { env: { ...process.env, MYSQL_PWD: pass } });
      const size = statSync(filepath).size;
      await this.log({ operation: 'SNAPSHOT', operatedBy: reason, batchId: filename });
      await this.pruneSnapshots();
      this.logger.log(`Snapshot created: ${filename} (${size} bytes)`);
      return { filename, size };
    } catch (err) {
      this.logger.error('Snapshot failed', err);
      throw new Error('快照创建失败：' + (err as Error).message);
    }
  }

  // ── 快照：列表 ───────────────────────────────────────────

  listSnapshots(): Array<{ filename: string; size: number; createdAt: string }> {
    if (!existsSync(this.backupsDir)) return [];
    return readdirSync(this.backupsDir)
      .filter(f => f.endsWith('.sql'))
      .map(f => {
        const stat = statSync(join(this.backupsDir, f));
        return { filename: f, size: stat.size, createdAt: stat.mtime.toISOString() };
      })
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  }

  // ── 快照：自动清理（保留最近 30 个） ────────────────────

  private pruneSnapshots(keep = 30): void {
    const all = this.listSnapshots();
    if (all.length <= keep) return;
    all.slice(keep).forEach(s => {
      try { unlinkSync(join(this.backupsDir, s.filename)); } catch { /* ignore */ }
    });
  }
}
