import { axiosForBackend } from '@/api';

/** 抓取 + AI 总结的返回结构（对齐后端 ScrapeResult） */
export interface ScrapeResult {
  ok: boolean;
  reason?: string;
  /** 识别到的来源平台（xiaohongshu / mihuashi），前端据此给链接选对平台 */
  platform?: string;
  resolvedUrl?: string;
  accountName?: string;
  summary?: string;
  styleGuesses?: string[];
  images?: string[];
  model?: string;
}

export const scrapeApi = {
  /**
   * 粘贴画师链接（小红书笔记 / 米画师画师主页）→ 后端按域名分派抓取 + AI 总结，
   * 返回预填数据。抓取 + LLM（米画师还含无头浏览器渲染）可能耗时较久，
   * 单独放宽超时到 180s。
   */
  fromLink: async (url: string): Promise<ScrapeResult> => {
    const res = await axiosForBackend({
      url: '/api/artist-scrape',
      method: 'POST',
      data: { url },
      timeout: 180000,
    });
    return res.data;
  },
};
