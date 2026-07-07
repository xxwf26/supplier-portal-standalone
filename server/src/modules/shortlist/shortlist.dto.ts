import { IsString, IsOptional, IsArray, MaxLength } from 'class-validator';

export class CreateShortlistDto {
  @IsString()
  @MaxLength(100)
  name!: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  description?: string;
}

export class UpdateShortlistDto {
  @IsOptional()
  @IsString()
  @MaxLength(100)
  name?: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  description?: string;
}

export class AddItemsDto {
  @IsArray()
  @IsString({ each: true })
  supplierIds!: string[];
}

export class UpdateItemDto {
  @IsOptional()
  @IsString()
  status?: string;

  @IsOptional()
  @IsString()
  note?: string;
}
