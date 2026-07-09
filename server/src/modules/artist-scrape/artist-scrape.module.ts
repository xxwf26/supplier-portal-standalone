import { Module, OnModuleDestroy } from '@nestjs/common';
import { ArtistScrapeController } from './artist-scrape.controller';
import { ArtistScrapeService } from './artist-scrape.service';
import { LlmClient } from './llm.client';
import { OcrClient } from './ocr.client';
import { closeBrowser } from '../../common/http/browser';

@Module({
  controllers: [ArtistScrapeController],
  providers: [ArtistScrapeService, LlmClient, OcrClient],
})
export class ArtistScrapeModule implements OnModuleDestroy {
  /** 进程/模块销毁时关闭 playwright 浏览器单例（米画师抓取用），避免 chromium 残留。 */
  async onModuleDestroy(): Promise<void> {
    await closeBrowser();
  }
}
