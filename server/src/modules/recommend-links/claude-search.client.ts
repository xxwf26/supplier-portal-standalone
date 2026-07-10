import { Injectable, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Anthropic from '@anthropic-ai/sdk';

/**
 * Claude 联网搜索客户端。
 * 走代理 tc-paperhub.diezhi.net/anthropic 的 Claude 模型 + Anthropic web_search 工具，
 * 真正联网搜索（实测返回 server_tool_use + web_search_tool_result 真实 URL）。
 *
 * 与现有 llm.client.ts（DeepSeek 摘要，走 /v1）独立——用单独的 CLAUDE_* env 配置，
 * 互不影响。缺 CLAUDE_API_KEY 时不阻断启动，调用时报错。
 */
@Injectable()
export class ClaudeSearchClient implements OnModuleInit {
  private client!: Anthropic;
  private apiKey = '';
  private readonly model: string;
  private readonly maxTokens: number;
  private readonly timeout: number;

  constructor(private readonly cfg: ConfigService) {
    this.model = this.cfg.get<string>('CLAUDE_MODEL') || 'claude-haiku-4-5';
    this.maxTokens = Number(this.cfg.get<string>('CLAUDE_MAX_TOKENS') || 2000);
    this.timeout = Number(this.cfg.get<string>('CLAUDE_TIMEOUT_MS') || 120000);
  }

  onModuleInit() {
    this.apiKey = this.cfg.get<string>('CLAUDE_API_KEY') || '';
    const baseURL = this.cfg.get<string>('CLAUDE_BASE_URL') || '';
    if (!this.apiKey) {
      // eslint-disable-next-line no-console
      console.warn('[RecommendLinks] CLAUDE_API_KEY 未配置，链接推荐将不可用');
      return;
    }
    this.client = new Anthropic({ apiKey: this.apiKey, baseURL: baseURL || undefined, timeout: this.timeout });
  }

  get available(): boolean {
    return !!this.apiKey;
  }

  /**
   * 联网搜索画师在各平台的主页链接。
   * 只返回 Claude 通过 web_search 核实过的真实链接（从其 text 输出的 JSON 里解析），
   * 搜不到返回空数组。瞬时错误自动重试。
   */
  async searchArtistLinks(name: string): Promise<{ platform: string; url: string; title?: string }[]> {
    if (!this.apiKey) {
      throw new Error('链接推荐未配置（缺少 CLAUDE_API_KEY）');
    }
    const system = `你是画师资源库的链接推荐助手。给定画师名，用联网搜索找出该画师在各平台的主页链接，重点是小红书（xiaohongshu），也包括微博(weibo)、B站(bilibili)、Pixiv(pixiv)、米画师(mihuashi)、官网(website)、其他(other)。

## 铁律
- 只返回你通过联网搜索核实过的真实主页链接，**禁止编造**任何 URL。
- 平台必须是以下之一：xiaohongshu / weibo / bilibili / pixiv / mihuashi / website / other。
- 小红书主页链接形如 https://www.xiaohongshu.com/user/profile/<数字ID>，不是用户名。
- 找不到任何真实链接就返回空数组 []。
- 注意同名画师，尽量通过搜索结果里的作品/简介确认是否是本人；无法确认也返回，但 title 里标注。

## 输出格式
只输出一个 JSON 数组，不要任何解释、不要 Markdown 代码围栏：
[{"platform":"xiaohongshu","url":"https://...","title":"搜索结果标题/简介"}]`;

    const userMsg = `画师名：${name}\n\n请联网搜索该画师各平台主页链接，按格式输出 JSON 数组。`;

    const maxAttempts = 3;
    let lastErr: unknown;
    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
      try {
        const res = await this.client.messages.create({
          model: this.model,
          max_tokens: this.maxTokens,
          system,
          tools: [{ type: 'web_search_20250305', name: 'web_search', max_uses: 5 } as Anthropic.Messages.WebSearchTool20250305],
          messages: [{ role: 'user', content: userMsg }],
        });
        // 拼接所有 text 块
        const text = (res.content ?? [])
          .filter((b): b is Anthropic.Messages.TextBlock => b.type === 'text')
          .map((b) => b.text)
          .join('\n')
          .trim();
        return parseCandidates(text);
      } catch (err: any) {
        lastErr = err;
        const status = err?.status ?? err?.response?.status;
        const retryable =
          status === 429 ||
          (typeof status === 'number' && status >= 500) ||
          err?.name === 'APIConnectionError' ||
          err?.name === 'APITimeoutError';
        if (!retryable || attempt === maxAttempts) throw err;
        await new Promise((r) => setTimeout(r, 500 * Math.pow(3, attempt - 1)));
      }
    }
    throw lastErr;
  }
}

/** 已知平台白名单（与前端 PLATFORM_OPTIONS 一致）；不在其中的归一化为 other，避免编辑态 Select 空白。 */
const KNOWN_PLATFORMS = new Set(['xiaohongshu', 'weibo', 'bilibili', 'pixiv', 'mihuashi', 'x', 'website', 'other']);

/** 鲁棒解析 Claude 输出的 JSON 候选数组：容忍代码围栏、前后多余文字。 */
function parseCandidates(text: string): { platform: string; url: string; title?: string }[] {
  if (!text) return [];
  let s = text.trim().replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/i, '');
  const start = s.indexOf('[');
  const end = s.lastIndexOf(']');
  if (start === -1 || end === -1 || end <= start) return [];
  try {
    const arr = JSON.parse(s.slice(start, end + 1)) as unknown[];
    if (!Array.isArray(arr)) return [];
    return arr
      .filter((o): o is Record<string, unknown> => !!o && typeof o === 'object')
      .map((o) => ({
        platform: typeof o.platform === 'string' ? (KNOWN_PLATFORMS.has(o.platform) ? o.platform : 'other') : 'other',
        url: typeof o.url === 'string' ? o.url : '',
        title: typeof o.title === 'string' ? o.title : undefined,
      }))
      .filter((c) => c.url && /^https?:\/\//i.test(c.url));
  } catch {
    return [];
  }
}
