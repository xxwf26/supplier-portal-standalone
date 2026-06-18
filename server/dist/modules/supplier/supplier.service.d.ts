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
    /** 提取字符串中所有长度>=2的连续子串（用于模糊匹配） */
    /** 比较前对名称做规范化：去除括号内容、地名、行业通用词、法人主体后缀 */
    private normalizeName;
    private getNgrams;
    /** 查找库内重复/相似画师 */
    getDuplicates(): Promise<Array<{
        ids: string[];
        names: string[];
        reason: string;
    }>>;
    getStatistics(): Promise<{
        total: number;
        individualCount: number;
        artistCount: number;
        companyCount: number;
        studioCount: number;
        activeCount: number;
        categoryCount: Record<string, number>;
        riskCount: Record<string, number>;
    }>;
    private mapToISupplier;
}
//# sourceMappingURL=supplier.service.d.ts.map