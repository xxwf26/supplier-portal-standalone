import { Module } from '@nestjs/common';
import { ArtistScrapeController } from './artist-scrape.controller';
import { ArtistScrapeService } from './artist-scrape.service';
import { LlmClient } from './llm.client';
import { OcrClient } from './ocr.client';

@Module({
  controllers: [ArtistScrapeController],
  providers: [ArtistScrapeService, LlmClient, OcrClient],
})
export class ArtistScrapeModule {}
