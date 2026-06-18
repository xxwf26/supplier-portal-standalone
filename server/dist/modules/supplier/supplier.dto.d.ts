import { ICreateSupplierDto, IPriceItem, IContactItem } from './supplier.types';
declare class PriceItemDto implements IPriceItem {
    cooperationType: string;
    unitPrice: number;
    priceUnit: string;
}
declare class ContactItemDto implements IContactItem {
    type: string;
    value: string;
}
/**
 * 创建供应商入参校验。
 * 仅对类型/长度做基础校验；数值范围（评分 1-5、频次 0-9999）在 service 层 clamp。
 */
export declare class CreateSupplierDto implements ICreateSupplierDto {
    accountName: string;
    socialLinks?: Record<string, string>;
    subCategory?: string;
    cooperationType?: string;
    priceRange?: string;
    priceItems?: PriceItemDto[];
    cooperationCount?: number;
    rating?: number;
    riskStatus?: string;
    isInStock?: boolean;
    entityType?: string;
    contractEntity?: string;
    contractType?: string;
    contractNo?: string;
    contractDeadline?: string;
    taxStatus?: string;
    contactInfo?: string;
    contactItems?: ContactItemDto[];
    cooperationCategory?: string;
    supplierType?: string;
    artworkUrls?: string[];
    manualLinks?: Record<string, string>;
    noteImages?: string[];
}
/** 更新供应商入参：所有字段可选 */
export declare class UpdateSupplierDto extends CreateSupplierDto {
    accountName: string;
}
/** 批量导入入参 */
export declare class BatchCreateSupplierDto {
    items: CreateSupplierDto[];
}
export {};
//# sourceMappingURL=supplier.dto.d.ts.map