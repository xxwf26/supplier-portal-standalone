export interface IPriceItem {
  cooperationType: string;
  unitPrice: number;
  priceUnit: string;
}

export interface IContactItem {
  type: string;
  value: string;
}

export interface ISupplier {
  id: string;
  accountName: string;
  socialLinks: Record<string, string>;
  subCategory: string | null;
  cooperationType: string | null;
  priceRange: string | null;
  priceItems: IPriceItem[];
  cooperationCount: number;
  rating: number | null;
  riskStatus: string;
  isInStock: boolean;
  entityType: string | null;
  contractEntity: string | null;
  contractType: string | null;
  contractNo: string | null;
  contractDeadline: string | null;
  taxStatus: string | null;
  contactInfo: string | null;
  contactItems: IContactItem[];
  cooperationCategory: string | null;
  supplierType: string | null;
  artworkUrls: string[];
  manualLinks: Record<string, string>;
  importSource: string;
  importBatchId: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface ICreateSupplierDto {
  accountName: string;
  socialLinks?: Record<string, string>;
  subCategory?: string;
  cooperationType?: string;
  priceRange?: string;
  priceItems?: IPriceItem[];
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
  contactItems?: IContactItem[];
  cooperationCategory?: string;
  supplierType?: string;
  artworkUrls?: string[];
  manualLinks?: Record<string, string>;
}

export interface IUpdateSupplierDto extends Partial<ICreateSupplierDto> {
  artworkUrls?: string[];
  manualLinks?: Record<string, string>;
}

export interface ISupplierFilter {
  supplierType?: string[];
  cooperationCategory?: string[];
  subCategory?: string[];
  riskStatus?: string[];
  entityType?: string[];
  keyword?: string;
  minRating?: number;
  maxRating?: number;
}

export interface ISupplierListResponse {
  list: ISupplier[];
  total: number;
}

export interface IBatchCreateResponse {
  successCount: number;
  failCount: number;
  errors: { row: number; name: string; reason: string }[];
}