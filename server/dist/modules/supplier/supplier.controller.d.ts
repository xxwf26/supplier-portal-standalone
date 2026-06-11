import { SupplierService } from './supplier.service';
import { ICreateSupplierDto, IUpdateSupplierDto, IBatchCreateResponse } from './supplier.types';
export declare class SupplierController {
    private readonly supplierService;
    constructor(supplierService: SupplierService);
    findAll(supplierType?: string, cooperationCategory?: string, subCategory?: string, riskStatus?: string, entityType?: string, keyword?: string): Promise<import("./supplier.types").ISupplierListResponse>;
    getStatistics(): Promise<{
        total: number;
        individualCount: number;
        companyCount: number;
        activeCount: number;
        categoryCount: Record<string, number>;
        riskCount: Record<string, number>;
    }>;
    findById(id: string): Promise<import("./supplier.types").ISupplier>;
    batchCreate(data: {
        items: ICreateSupplierDto[];
    }): Promise<IBatchCreateResponse>;
    create(data: ICreateSupplierDto): Promise<import("./supplier.types").ISupplier>;
    update(id: string, data: IUpdateSupplierDto): Promise<import("./supplier.types").ISupplier>;
    delete(id: string): Promise<{
        success: boolean;
    }>;
}
//# sourceMappingURL=supplier.controller.d.ts.map