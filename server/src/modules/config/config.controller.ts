import { Controller, Get, Post, Put, Delete, Body, Param, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';
import { ConfigService } from './config.service';

@Controller('/api/config/filters')
export class ConfigController {
  constructor(private readonly configService: ConfigService) {}

  @Get()
  async getAll() {
    return this.configService.getAll();
  }

  @Get(':category')
  async getByCategory(@Param('category') category: string) {
    return this.configService.getByCategory(category);
  }

  @Post()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('admin')
  async create(@Body() data: { category: string; label: string; value: string; color?: string; sort_order?: number }) {
    return this.configService.create(data);
  }

  @Put(':id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('admin')
  async update(@Param('id') id: string, @Body() data: { label?: string; value?: string; color?: string; sort_order?: number; enabled?: boolean }) {
    return this.configService.update(id, data);
  }

  @Delete(':id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('admin')
  async delete(@Param('id') id: string) {
    return this.configService.delete(id);
  }
}