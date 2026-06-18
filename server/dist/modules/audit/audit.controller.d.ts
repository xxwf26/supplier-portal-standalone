import { AuditService } from './audit.service';
export declare class AuditController {
    private readonly auditService;
    constructor(auditService: AuditService);
    /** 变更记录分页列表（管理员） */
    getLogs(page?: string, limit?: string, operation?: string): Promise<{
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
    /** 导入批次列表（管理员） */
    getBatches(): Promise<{
        import_batch_id: string;
        count: number;
        imported_at: string;
    }[]>;
    /** 回滚单条日志（管理员） */
    rollbackLog(id: string, req: any): Promise<{
        message: string;
    }>;
    /** 回滚指定批次（管理员） */
    rollbackBatch(batchId: string, req: any): Promise<{
        deleted: number;
        message: string;
    }>;
    /** 撤销一次批量删除，整批恢复（管理员） */
    rollbackDeleteBatch(batchId: string, req: any): Promise<{
        restored: number;
        message: string;
    }>;
    /** 快照列表（管理员） */
    listSnapshots(): {
        filename: string;
        size: number;
        createdAt: string;
    }[];
    /** 恢复快照（管理员） */
    restoreSnapshot(filename: string, req: any): Promise<{
        message: string;
    }>;
    /** 手动创建快照（管理员） */
    createSnapshot(req: any): Promise<{
        filename: string;
        size: number;
    }>;
}
//# sourceMappingURL=audit.controller.d.ts.map