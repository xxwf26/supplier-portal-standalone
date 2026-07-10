import { Injectable } from '@nestjs/common';
import { ClaudeSearchClient, extractSearchNames } from './claude-search.client';

/** 链接推荐的候选条目 */
export interface RecommendCandidate {
  platform: string;
  url: string;
  title?: string;
  name?: string;
}

/** recommend(name) 返回结构 */
export interface RecommendResult {
  ok: boolean;
  /** ok=false 时的原因 */
  reason?: string;
  /** 画师名（原样回显，前端展示用） */
  name?: string;
  /** 实际用于搜索的名字（真名+网名，括号内外都取） */
  searchNames?: string[];
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
    const searchNames = extractSearchNames(name);
    if (searchNames.length === 0) {
      return { ok: false, reason: '画师名为空', name, candidates: [] };
    }
    try {
      const candidates = await this.claude.searchArtistLinks(searchNames);
      return { ok: true, name, searchNames, candidates };
    } catch (err: any) {
      return {
        ok: false,
        reason: `联网搜索失败：${err?.message || '未知错误'}`,
        name,
        searchNames,
        candidates: [],
      };
    }
  }
}
