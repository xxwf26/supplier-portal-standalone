import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Body,
  Param,
  Request,
  UseGuards,
} from '@nestjs/common';
import { ShortlistService } from './shortlist.service';
import { CreateShortlistDto, UpdateShortlistDto, AddItemsDto, UpdateItemDto } from './shortlist.dto';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';

@Controller('api/shortlists')
@UseGuards(JwtAuthGuard)
export class ShortlistController {
  constructor(private readonly service: ShortlistService) {}

  @Get()
  listAll() {
    return this.service.listAll();
  }

  @Get(':id')
  getOne(@Param('id') id: string) {
    return this.service.getOne(id);
  }

  @Post()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('admin')
  create(@Body() dto: CreateShortlistDto, @Request() req: any) {
    return this.service.create(dto.name, dto.description, req.user?.username);
  }

  @Put(':id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('admin')
  update(@Param('id') id: string, @Body() dto: UpdateShortlistDto) {
    return this.service.update(id, dto.name, dto.description);
  }

  @Delete(':id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('admin')
  remove(@Param('id') id: string) {
    return this.service.remove(id);
  }

  @Post(':id/items')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('admin')
  addItems(@Param('id') id: string, @Body() dto: AddItemsDto, @Request() req: any) {
    return this.service.addItems(id, dto.supplierIds, req.user?.username);
  }

  @Put(':id/items/:supplierId')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('admin')
  updateItem(
    @Param('id') id: string,
    @Param('supplierId') supplierId: string,
    @Body() dto: UpdateItemDto,
  ) {
    return this.service.updateItem(id, supplierId, dto.status, dto.note);
  }

  @Delete(':id/items/:supplierId')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('admin')
  removeItem(@Param('id') id: string, @Param('supplierId') supplierId: string) {
    return this.service.removeItem(id, supplierId);
  }
}
