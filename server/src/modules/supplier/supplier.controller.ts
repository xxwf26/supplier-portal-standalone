import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Body,
  Param,
  Query,
  HttpException,
  HttpStatus,
  UseGuards,
} from '@nestjs/common';
import { SupplierService } from './supplier.service';
import { ICreateSupplierDto, IUpdateSupplierDto, ISupplierFilter, IBatchCreateResponse } from './supplier.types';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';

@Controller('/api/suppliers')
export class SupplierController {
  constructor(private readonly supplierService: SupplierService) {}

  @Get()
  async findAll(
    @Query('supplierType') supplierType?: string,
    @Query('cooperationCategory') cooperationCategory?: string,
    @Query('subCategory') subCategory?: string,
    @Query('riskStatus') riskStatus?: string,
    @Query('entityType') entityType?: string,
    @Query('keyword') keyword?: string,
  ) {
    const filter: ISupplierFilter = {};

    if (supplierType) filter.supplierType = supplierType.split(',');
    if (cooperationCategory) filter.cooperationCategory = cooperationCategory.split(',');
    if (subCategory) filter.subCategory = subCategory.split(',');
    if (riskStatus) filter.riskStatus = riskStatus.split(',');
    if (entityType) filter.entityType = entityType.split(',');
    if (keyword) filter.keyword = keyword;

    return this.supplierService.findAll(filter);
  }

  @Get('statistics')
  async getStatistics() {
    return this.supplierService.getStatistics();
  }

  @Get(':id')
  async findById(@Param('id') id: string) {
    const supplier = await this.supplierService.findById(id);
    if (!supplier) {
      throw new HttpException('供应商不存在', HttpStatus.NOT_FOUND);
    }
    return supplier;
  }

  @Post('batch')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('admin')
  async batchCreate(@Body() data: { items: ICreateSupplierDto[] }): Promise<IBatchCreateResponse> {
    if (!data.items || !Array.isArray(data.items) || data.items.length === 0) {
      throw new HttpException('导入数据不能为空', HttpStatus.BAD_REQUEST);
    }
    if (data.items.length > 500) {
      throw new HttpException('单次导入最多 500 条', HttpStatus.BAD_REQUEST);
    }
    return this.supplierService.batchCreate(data.items);
  }

  @Post()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('admin')
  async create(@Body() data: ICreateSupplierDto) {
    if (!data.accountName) {
      throw new HttpException('账号名称不能为空', HttpStatus.BAD_REQUEST);
    }
    return this.supplierService.create(data);
  }

  @Put(':id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('admin')
  async update(@Param('id') id: string, @Body() data: IUpdateSupplierDto) {
    const supplier = await this.supplierService.update(id, data);
    if (!supplier) {
      throw new HttpException('供应商不存在', HttpStatus.NOT_FOUND);
    }
    return supplier;
  }

  @Delete(':id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('admin')
  async delete(@Param('id') id: string) {
    const success = await this.supplierService.delete(id);
    if (!success) {
      throw new HttpException('供应商不存在', HttpStatus.NOT_FOUND);
    }
    return { success: true };
  }
}