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
  socialLinks: Record<string, string[]>;
  subCategory: string | null;
  cooperationType: string | null;
  priceRange: string | null;
  priceItems: IPriceItem[];
  contactItems: IContactItem[];
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
  cooperationCategory: string | null;
  supplierType: string | null;
  artworkUrls: string[];
  manualLinks: Record<string, string[]>;
  noteImages: string[];
  importSource: string;
  importBatchId: string | null;
  createdAt: string;
  updatedAt: string;
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

export interface ISupplierStatistics {
  total: number;
  individualCount: number;
  artistCount: number;
  studioCount: number;
  companyCount: number;
  activeCount: number;
  categoryCount: Record<string, number>;
  riskCount: Record<string, number>;
}

export interface IUploadUrlResponse {
  url: string;
  fileName: string;
}

export interface IBatchCreateResponse {
  successCount: number;
  failCount: number;
  errors: { row: number; name: string; reason: string }[];
}
