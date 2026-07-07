import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Body,
  Param,
  Query,
  Request,
  HttpException,
  HttpStatus,
  UseGuards,
} from '@nestjs/common';
import { SupplierService } from './supplier.service';
import { ISupplierFilter, IBatchCreateResponse } from './supplier.types';
import { CreateSupplierDto, UpdateSupplierDto, BatchCreateSupplierDto, BatchDeleteSupplierDto, BatchUpdateSupplierDto } from './supplier.dto';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';

@Controller('/api/suppliers')
@UseGuards(JwtAuthGuard)
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

  @Get('duplicates')
  async getDuplicates() {
    return this.supplierService.getDuplicates();
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
  async batchCreate(@Body() data: BatchCreateSupplierDto, @Request() req: any): Promise<IBatchCreateResponse> {
    if (!data.items || !Array.isArray(data.items) || data.items.length === 0) {
      throw new HttpException('导入数据不能为空', HttpStatus.BAD_REQUEST);
    }
    if (data.items.length > 500) {
      throw new HttpException('单次导入最多 500 条', HttpStatus.BAD_REQUEST);
    }
    return this.supplierService.batchCreate(data.items, req.user?.username);
  }

  @Post('batch-delete')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('admin')
  async batchDelete(@Body() data: BatchDeleteSupplierDto, @Request() req: any) {
    if (!data.ids || !Array.isArray(data.ids) || data.ids.length === 0) {
      throw new HttpException('请选择要删除的画师', HttpStatus.BAD_REQUEST);
    }
    if (data.ids.length > 500) {
      throw new HttpException('单次最多删除 500 条', HttpStatus.BAD_REQUEST);
    }
    return this.supplierService.batchDelete(data.ids, req.user?.username);
  }

  @Post('batch-update')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('admin')
  async batchUpdate(@Body() data: BatchUpdateSupplierDto, @Request() req: any) {
    if (!data.ids || !Array.isArray(data.ids) || data.ids.length === 0) {
      throw new HttpException('请选择要修改的画师', HttpStatus.BAD_REQUEST);
    }
    if (data.ids.length > 500) {
      throw new HttpException('单次最多修改 500 条', HttpStatus.BAD_REQUEST);
    }
    if (!data.patch || Object.keys(data.patch).length === 0) {
      throw new HttpException('未指定要修改的内容', HttpStatus.BAD_REQUEST);
    }
    return this.supplierService.batchUpdate(data.ids, data.patch, req.user?.username);
  }

  @Post()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('admin')
  async create(@Body() data: CreateSupplierDto, @Request() req: any) {
    if (!data.accountName) {
      throw new HttpException('账号名称不能为空', HttpStatus.BAD_REQUEST);
    }
    return this.supplierService.create(data, req.user?.username);
  }

  @Put(':id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('admin')
  async update(@Param('id') id: string, @Body() data: UpdateSupplierDto, @Request() req: any) {
    const supplier = await this.supplierService.update(id, data, req.user?.username);
    if (!supplier) {
      throw new HttpException('供应商不存在', HttpStatus.NOT_FOUND);
    }
    return supplier;
  }

  @Delete(':id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('admin')
  async delete(@Param('id') id: string, @Request() req: any) {
    const success = await this.supplierService.delete(id, req.user?.username);
    if (!success) {
      throw new HttpException('供应商不存在', HttpStatus.NOT_FOUND);
    }
    return { success: true };
  }
}