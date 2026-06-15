import { Injectable, Inject, Logger } from '@nestjs/common';
import { desc, eq, and, sql } from 'drizzle-orm';
import { DRIZZLE_DATABASE, type Database } from '../../database/database.module';
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

    const rows = await this.db
      .select()
      .from(auditLog)
      .where(operation ? eq(auditLog.operation, operation) : undefined)
      .orderBy(desc(auditLog.createdAt))
      .limit(limit)
      .offset(offset);

    const countRows = await this.db
      .select({ id: auditLog.id })
      .from(auditLog)
      .where(operation ? eq(auditLog.operation, operation) : undefined);

    return { list: rows, total: countRows.length, page, limit };
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
    return (result as any[])[0] as Array<{ import_batch_id: string; count: number; imported_at: string }>;
  }

  // ── 回滚批次 ─────────────────────────────────────────────

  async rollbackBatch(batchId: string, operatedBy: string) {
    // 先查出要删的数据（用于日志）
    const toDelete = await this.db
      .select()
      .from(suppliers)
      .where(eq(suppliers.importBatchId, batchId));

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
    await this.db.delete(suppliers).where(eq(suppliers.importBatchId, batchId));

    this.logger.log(`Rolled back batch ${batchId}: deleted ${toDelete.length} records by ${operatedBy}`);
    return { deleted: toDelete.length, message: `已撤销 ${toDelete.length} 条导入数据` };
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

    if (!['INSERT', 'UPDATE', 'DELETE'].includes(entry.operation)) {
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
          const old = entry.oldData as Record<string, unknown>;
          const skipFields = new Set(['id', 'createdAt', 'updatedAt', 'importBatchId', 'importSource']);
          const restoreData: Record<string, unknown> = { updatedAt: new Date() };
          for (const [k, v] of Object.entries(old)) {
            if (!skipFields.has(k)) {
              restoreData[k] = v;
            }
          }
          await this.db.update(suppliers).set(restoreData).where(eq(suppliers.id, recordId));
        }
        break;
      }
      case 'DELETE': {
        if (entry.oldData) {
          const old = entry.oldData as Record<string, unknown>;
          const insertData: any = { ...old };
          if (insertData.contractDeadline && typeof insertData.contractDeadline === 'string') {
            insertData.contractDeadline = new Date(insertData.contractDeadline);
          }
          insertData.createdAt = insertData.createdAt ? new Date(insertData.createdAt) : new Date();
          insertData.updatedAt = new Date();
          await this.db.insert(suppliers).values(insertData).onDuplicateKeyUpdate({ set: { updatedAt: new Date() } });
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

  async createSnapshot(reason = 'manual'): Promise<{ filename: string; size: number }> {
    const ts = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
    const filename = `snapshot_${ts}_${reason}.sql`;
    const filepath = join(this.backupsDir, filename);

    const host = this.config.get('DB_HOST', 'localhost');
    const port = this.config.get('DB_PORT', '3306');
    const user = this.config.get('DB_USER', 'root');
    const pass = this.config.get('DB_PASSWORD', '');
    const dbName = this.config.get('DB_NAME', 'supplier_portal');

    const cmd = `mysqldump -h${host} -P${port} -u${user} -p${pass} --single-transaction --routines --triggers ${dbName} > "${filepath}"`;

    try {
      await execAsync(cmd);
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
