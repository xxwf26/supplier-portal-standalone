import { SupplierService } from './supplier.service';
import { IBatchCreateResponse } from './supplier.types';
import { CreateSupplierDto, UpdateSupplierDto, BatchCreateSupplierDto, BatchDeleteSupplierDto } from './supplier.dto';
export declare class SupplierController {
    private readonly supplierService;
    constructor(supplierService: SupplierService);
    findAll(supplierType?: string, cooperationCategory?: string, subCategory?: string, riskStatus?: string, entityType?: string, keyword?: string): Promise<import("./supplier.types").ISupplierListResponse>;
    getStatistics(): Promise<{
        total: number;
        individualCount: number;
        artistCount: number;
        studioCount: number;
        companyCount: number;
        activeCount: number;
        categoryCount: Record<string, number>;
        riskCount: Record<string, number>;
    }>;
    getDuplicates(): Promise<{
        ids: string[];
        names: string[];
        reason: string;
    }[]>;
    findById(id: string): Promise<import("./supplier.types").ISupplier>;
    batchCreate(data: BatchCreateSupplierDto, req: any): Promise<IBatchCreateResponse>;
    batchDelete(data: BatchDeleteSupplierDto, req: any): Promise<{
        deleted: number;
        notFound: number;
        batchId: string;
    }>;
    create(data: CreateSupplierDto, req: any): Promise<import("./supplier.types").ISupplier>;
    update(id: string, data: UpdateSupplierDto, req: any): Promise<import("./supplier.types").ISupplier>;
    delete(id: string, req: any): Promise<{
        success: boolean;
    }>;
}
//# sourceMappingURL=supplier.controller.d.ts.map