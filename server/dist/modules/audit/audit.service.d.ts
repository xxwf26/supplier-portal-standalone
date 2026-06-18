import { type Database } from '../../database/database.module';
import { ConfigService } from '@nestjs/config';
export interface ILogParams {
    operation: string;
    recordId?: string;
    batchId?: string;
    oldData?: unknown;
    newData?: unknown;
    operatedBy?: string;
}
export declare class AuditService {
    private readonly db;
    private readonly config;
    private readonly logger;
    private readonly backupsDir;
    constructor(db: Database, config: ConfigService);
    log(params: ILogParams): Promise<void>;
    getLogs(page?: number, limit?: number, operation?: string): Promise<{
        list: {
            id: number;
            operation: string;
            recordId: string | null;
            batchId: string | null;
            tableName: string | null;
            oldData: unknown;
            newData: unknown;
            operatedBy: string | null;
            createdAt: Date;
        }[];
        total: number;
        page: number;
        limit: number;
    }>;
    getBatches(): Promise<{
        import_batch_id: string;
        count: number;
        imported_at: string;
    }[]>;
    rollbackBatch(batchId: string, operatedBy: string): Promise<{
        deleted: number;
        message: string;
    }>;
    rollbackDeleteBatch(batchId: string, operatedBy: string): Promise<{
        restored: number;
        message: string;
    }>;
    /** 从审计 oldData 还原一条 suppliers 插入行（撤回删除时复用） */
    private buildSupplierRow;
    rollbackLog(logId: number, operatedBy: string): Promise<{
        message: string;
    }>;
    restoreSnapshot(filename: string, operatedBy: string): Promise<{
        message: string;
    }>;
    createSnapshot(reason?: string): Promise<{
        filename: string;
        size: number;
    }>;
    listSnapshots(): Array<{
        filename: string;
        size: number;
        createdAt: string;
    }>;
    private pruneSnapshots;
}
//# sourceMappingURL=audit.service.d.ts.map