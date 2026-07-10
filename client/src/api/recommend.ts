import { axiosForBackend } from '@/api';

/** 推荐出的候选主页链接 */
export interface RecommendCandidate {
  platform: string;
  url: string;
  title?: string;
  /** 主页显示名（精准匹配校验用） */
  name?: string;
}

/** recommendLinks 返回结构（对齐后端 RecommendResult） */
export interface RecommendResult {
  ok: boolean;
  reason?: string;
  name?: string;
  candidates: RecommendCandidate[];
}

export const recommendApi = {
  /**
   * 根据画师名联网搜索推荐各平台主页链接（Claude web_search）。
   * 后端逐次联网搜索，可能耗时较久，单独放宽超时到 180s。
   */
  recommendLinks: async (name: string): Promise<RecommendResult> => {
    const res = await axiosForBackend({
      url: '/api/recommend-links',
      method: 'POST',
      data: { name },
      timeout: 180000,
    });
    return res.data;
  },
};
