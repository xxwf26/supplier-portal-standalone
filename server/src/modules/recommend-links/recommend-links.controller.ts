import { Body, Controller, Post, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';
import { RecommendLinksDto } from './recommend-links.dto';
import { RecommendLinksService, RecommendResult } from './recommend-links.service';

/**
 * 根据画师名联网搜索推荐平台主页链接。
 * 仅 admin（Claude web_search 按次计费）。返回候选，前端让用户确认后填入。
 */
@Controller('/api/recommend-links')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('admin')
export class RecommendLinksController {
  constructor(private readonly service: RecommendLinksService) {}

  @Post()
  async recommend(@Body() dto: RecommendLinksDto): Promise<RecommendResult> {
    return this.service.recommend(dto.name?.trim() || '');
  }
}
