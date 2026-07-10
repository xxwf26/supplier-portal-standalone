import { Module } from '@nestjs/common';
import { RecommendLinksController } from './recommend-links.controller';
import { RecommendLinksService } from './recommend-links.service';
import { ClaudeSearchClient } from './claude-search.client';

@Module({
  controllers: [RecommendLinksController],
  providers: [ClaudeSearchClient, RecommendLinksService],
})
export class RecommendLinksModule {}
