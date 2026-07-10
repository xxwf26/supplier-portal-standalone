import { Injectable } from '@nestjs/common';
import { ClaudeSearchClient } from './claude-search.client';

/** 链接推荐的候选条目 */
export interface RecommendCandidate {
  platform: string;
  url: string;
  title?: string;
}

/** recommend(name) 返回结构 */
export interface RecommendResult {
  ok: boolean;
  /** ok=false 时的原因 */
  reason?: string;
  /** 画师名（原样回显，前端展示用） */
  name?: string;
  /** 候选主页链接列表 */
  candidates: RecommendCandidate[];
}

@Injectable()
export class RecommendLinksService {
  constructor(private readonly claude: ClaudeSearchClient) {}

  async recommend(name: string): Promise<RecommendResult> {
    if (!this.claude.available) {
      return { ok: false, reason: '链接推荐未配置（缺少 CLAUDE_API_KEY），无法使用', name, candidates: [] };
    }
    try {
      const candidates = await this.claude.searchArtistLinks(name);
      return { ok: true, name, candidates };
    } catch (err: any) {
      return {
        ok: false,
        reason: `联网搜索失败：${err?.message || '未知错误'}`,
        name,
        candidates: [],
      };
    }
  }
}
