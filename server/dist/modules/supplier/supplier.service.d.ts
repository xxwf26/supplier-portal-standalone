import { type Database } from '../../database/database.module';
import { ISupplier, ICreateSupplierDto, IUpdateSupplierDto, ISupplierFilter, ISupplierListResponse, IBatchCreateResponse } from './supplier.types';
export declare class SupplierService {
    private readonly db;
    private readonly logger;
    constructor(db: Database);
    findAll(filter?: ISupplierFilter): Promise<ISupplierListResponse>;
    findById(id: string): Promise<ISupplier | null>;
    create(data: ICreateSupplierDto): Promise<ISupplier>;
    update(id: string, data: IUpdateSupplierDto): Promise<ISupplier | null>;
    delete(id: string): Promise<boolean>;
    batchCreate(items: ICreateSupplierDto[]): Promise<IBatchCreateResponse>;
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