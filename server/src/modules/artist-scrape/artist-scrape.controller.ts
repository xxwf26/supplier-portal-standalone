import {
  BadRequestException,
  Body,
  Controller,
  Get,
  Post,
  Query,
  Res,
  UseGuards,
} from '@nestjs/common';
import type { Response } from 'express';
import * as https from 'https';
import * as http from 'http';
import { ArtistScrapeService, ScrapeResult } from './artist-scrape.service';
import { ScrapeArtistDto } from './artist-scrape.dto';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';
import { assertSafeUrl } from '../../common/http/url-safety';

/** 只允许代理小红书自家图片域名，避免变成任意 URL 的开放代理。 */
const XHS_IMAGE_HOST = /(^|\.)(xhscdn\.com|xiaohongshu\.com)$/i;

@Controller('/api/artist-scrape')
export class ArtistScrapeController {
  constructor(private readonly service: ArtistScrapeService) {}

  /**
   * 粘贴小红书画师主页链接 → 抓取 + AI 总结，返回预填数据（不写库）。
   * 仅 admin 可用（抓取 + LLM 成本较高）。
   */
  @Post()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('admin')
  async scrape(@Body() dto: ScrapeArtistDto): Promise<ScrapeResult> {
    return this.service.scrapeXiaohongshu(dto.url);
  }

  /**
   * 图片代理：抓取阶段返回的是小红书 CDN 原链，浏览器 <img src> 直连会被防盗链
   * （Referer 校验）拦掉。前端预填时改走本代理——服务端带 Referer 取图再回传。
   *
   * 无 JWT 守卫（<img> 标签带不了 Authorization 头），但用双重约束防滥用：
   * ① host 必须是 xhscdn/xiaohongshu 域名（非开放代理）；② assertSafeUrl 防 SSRF。
   * 只在「保存前预览」这一短暂窗口用到；保存后图片已落地 /uploads，不再走此代理。
   */
  @Get('img')
  async proxyImage(@Query('u') u: string, @Res() res: Response): Promise<void> {
    if (!u) throw new BadRequestException('缺少图片地址');
    let target: URL;
    try {
      target = new URL(u);
    } catch {
      throw new BadRequestException('非法图片地址');
    }
    if (!XHS_IMAGE_HOST.test(target.hostname)) {
      throw new BadRequestException('仅允许代理小红书图片');
    }
    try {
      await assertSafeUrl(u);
    } catch {
      throw new BadRequestException('图片地址不安全');
    }

    const client = target.protocol === 'http:' ? http : https;
    const upstream = client.get(
      u,
      {
        timeout: 15000,
        headers: {
          'User-Agent':
            'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
          Referer: 'https://www.xiaohongshu.com/',
        },
      },
      (up) => {
        if (!up.statusCode || up.statusCode >= 400) {
          up.resume();
          if (!res.headersSent) res.status(502).end();
          return;
        }
        res.setHeader('Content-Type', up.headers['content-type'] || 'image/jpeg');
        res.setHeader('Cache-Control', 'public, max-age=3600');
        up.pipe(res);
      },
    );
    upstream.on('error', () => {
      if (!res.headersSent) res.status(502).end();
    });
    upstream.on('timeout', () => {
      upstream.destroy();
      if (!res.headersSent) res.status(504).end();
    });
  }
}
