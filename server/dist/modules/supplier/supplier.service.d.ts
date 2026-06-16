import { type Database } from '../../database/database.module';
import { ISupplier, ICreateSupplierDto, IUpdateSupplierDto, ISupplierFilter, ISupplierListResponse, IBatchCreateResponse } from './supplier.types';
import { AuditService } from '../audit/audit.service';
export declare class SupplierService {
    private readonly db;
    private readonly auditService;
    private readonly logger;
    constructor(db: Database, auditService: AuditService);
    findAll(filter?: ISupplierFilter): Promise<ISupplierListResponse>;
    findById(id: string): Promise<ISupplier | null>;
    create(data: ICreateSupplierDto, operatedBy?: string, options?: {
        importSource?: string;
        importBatchId?: string;
    }): Promise<ISupplier>;
    /** 合作频次范围校验：0 ~ 9999 */
    private clampCount;
    /** 评分范围校验：1 ~ 5，空值保持 null */
    private clampRating;
    update(id: string, data: IUpdateSupplierDto, operatedBy?: string): Promise<ISupplier | null>;
    delete(id: string, operatedBy?: string): Promise<boolean>;
    batchCreate(items: ICreateSupplierDto[], operatedBy?: string): Promise<IBatchCreateResponse>;
    getStatistics(): Promise<{
        total: number;
        individualCount: number;
        companyCount: number;
        activeCount: number;
        categoryCount: Record<string, number>;
        riskCount: Record<string, number>;
    }>;
    private mapToISupplier;
}
//# sourceMappingURL=supplier.service.d.ts.map