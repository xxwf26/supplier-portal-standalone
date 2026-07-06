import { axiosForBackend } from '@/api';

/** 抓取 + AI 总结的返回结构（对齐后端 ScrapeResult） */
export interface ScrapeResult {
  ok: boolean;
  reason?: string;
  resolvedUrl?: string;
  accountName?: string;
  summary?: string;
  styleGuesses?: string[];
  images?: string[];
  model?: string;
}

export const scrapeApi = {
  /**
   * 粘贴小红书画师主页链接 → 后端抓取 + AI 总结，返回预填数据。
   * 抓取 + LLM 可能耗时较久，单独放宽超时到 180s。
   */
  fromXiaohongshu: async (url: string): Promise<ScrapeResult> => {
    const res = await axiosForBackend({
      url: '/api/artist-scrape',
      method: 'POST',
      data: { url },
      timeout: 180000,
    });
    return res.data;
  },
};
