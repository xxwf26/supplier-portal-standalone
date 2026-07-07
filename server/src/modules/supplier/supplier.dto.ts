import {
  IsArray,
  IsBoolean,
  IsInt,
  IsObject,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';
import { ICreateSupplierDto, IPriceItem, IContactItem } from './supplier.types';

class PriceItemDto implements IPriceItem {
  @IsString()
  cooperationType!: string;

  @IsInt()
  unitPrice!: number;

  @IsString()
  priceUnit!: string;
}

class ContactItemDto implements IContactItem {
  @IsString()
  type!: string;

  @IsString()
  value!: string;
}

/**
 * 创建供应商入参校验。
 * 仅对类型/长度做基础校验；数值范围（评分 1-5、频次 0-9999）在 service 层 clamp。
 */
export class CreateSupplierDto implements ICreateSupplierDto {
  @IsString()
  @MaxLength(255)
  accountName!: string;

  @IsOptional()
  @IsObject()
  socialLinks?: Record<string, string>;

  @IsOptional()
  @IsString()
  subCategory?: string;

  @IsOptional()
  @IsString()
  cooperationType?: string;

  @IsOptional()
  @IsString()
  priceRange?: string;

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => PriceItemDto)
  priceItems?: PriceItemDto[];

  @IsOptional()
  @IsInt()
  cooperationCount?: number;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(5)
  rating?: number;

  @IsOptional()
  @IsString()
  riskStatus?: string;

  @IsOptional()
  @IsBoolean()
  isInStock?: boolean;

  @IsOptional()
  @IsString()
  entityType?: string;

  @IsOptional()
  @IsString()
  contractEntity?: string;

  @IsOptional()
  @IsString()
  contractType?: string;

  @IsOptional()
  @IsString()
  contractNo?: string;

  @IsOptional()
  @IsString()
  contractDeadline?: string;

  @IsOptional()
  @IsString()
  taxStatus?: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  contactInfo?: string;

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ContactItemDto)
  contactItems?: ContactItemDto[];

  @IsOptional()
  @IsString()
  cooperationCategory?: string;

  @IsOptional()
  @IsString()
  supplierType?: string;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  artworkUrls?: string[];

  @IsOptional()
  @IsObject()
  manualLinks?: Record<string, string>;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  noteImages?: string[];
}

/** 更新供应商入参：所有字段可选 */
export class UpdateSupplierDto extends CreateSupplierDto {
  @IsOptional()
  @IsString()
  @MaxLength(255)
  declare accountName: string;
}

/** 批量导入入参 */
export class BatchCreateSupplierDto {
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CreateSupplierDto)
  items!: CreateSupplierDto[];
}

/** 批量删除入参 */
export class BatchDeleteSupplierDto {
  @IsArray()
  @IsString({ each: true })
  ids!: string[];
}

/** 批量编辑：可覆盖类字段 + 追加标签类 */
export class BatchUpdatePatchDto {
  @IsOptional() @IsString() riskStatus?: string;
  @IsOptional() @IsBoolean() isInStock?: boolean;
  @IsOptional() @IsString() supplierType?: string;
  @IsOptional() @IsString() cooperationCategory?: string;
  @IsOptional() @IsString() entityType?: string;
  @IsOptional() @IsArray() @IsString({ each: true }) appendStyles?: string[];
  @IsOptional() @IsArray() @IsString({ each: true }) appendCooperationTypes?: string[];
}

export class BatchUpdateSupplierDto {
  @IsArray()
  @IsString({ each: true })
  ids!: string[];

  @IsObject()
  @ValidateNested()
  @Type(() => BatchUpdatePatchDto)
  patch!: BatchUpdatePatchDto;
}
