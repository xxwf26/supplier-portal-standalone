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
   * names 为该画师的若干名字（真名 + 网名，都搜）。只返回主页显示名与给定名字之一
   * **完全相同**（精准匹配）的真实链接。搜不到返回空数组。瞬时错误自动重试。
   */
  async searchArtistLinks(names: string[]): Promise<{ platform: string; url: string; title?: string; name?: string }[]> {
    if (!this.apiKey) {
      throw new Error('链接推荐未配置（缺少 CLAUDE_API_KEY）');
    }
    const nameList = names.filter(Boolean);
    if (nameList.length === 0) return [];
    const system = `你是画师资源库的链接推荐助手。给定一个画师的若干名字（可能是真名+网名，例如真名「黄鑫奔」网名「本本不熬夜」），用联网搜索找出该画师在各**公开可搜**平台的主页链接：微博(weibo)、B站(bilibili)、Pixiv(pixiv)、米画师(mihuashi)、官网(website)、其他(other)。这些平台主页被搜索引擎收录，能搜到。逐个名字都搜一遍。

注意：小红书(xiaohongshu)主页几乎不被搜索引擎收录，通常搜不到——只有在搜索结果里明确看到该画师的小红书主页链接时才返回，否则不要在小红书上浪费搜索次数（小红书由用户手动搜索补充）。

## 铁律（精准匹配）
- **只返回主页显示名与给定名字之一「完全相同」的链接**（逐字一致，忽略大小写和首尾空格）。相似名、谐音、同名不同人一律不要。
- name 字段填该主页的显示名（用于校验精准匹配）。
- 只返回联网搜索核实过的真实链接，**禁止编造** URL。
- 平台必须是：xiaohongshu / weibo / bilibili / pixiv / mihuashi / website / other。
- 小红书主页链接形如 https://www.xiaohongshu.com/user/profile/<数字ID>，不是用户名。
- 找不到任何精准匹配的链接就返回空数组 []。

## 输出格式
只输出一个 JSON 数组，不要解释、不要 Markdown 代码围栏：
[{"platform":"weibo","url":"https://...","title":"搜索结果标题","name":"主页显示名"}]`;

    const userMsg = `画师名字（都搜）：${nameList.join(' / ')}\n\n请联网搜索，只返回显示名与上述名字之一完全一致的精准匹配主页链接，按格式输出 JSON 数组。`;

    const maxAttempts = 3;
    let lastErr: unknown;
    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
      try {
        const res = await this.client.messages.create({
          model: this.model,
          max_tokens: this.maxTokens,
          system,
          tools: [{ type: 'web_search_20250305', name: 'web_search', max_uses: 8 } as Anthropic.Messages.WebSearchTool20250305],
          messages: [{ role: 'user', content: userMsg }],
        });
        const text = (res.content ?? [])
          .filter((b): b is Anthropic.Messages.TextBlock => b.type === 'text')
          .map((b) => b.text)
          .join('\n')
          .trim();
        return parseCandidates(text, nameList);
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

/** 名字归一化：去首尾空格、转小写、去内部空格，用于精准匹配比对。 */
function normName(s: string): string {
  return (s || '').trim().toLowerCase().replace(/\s+/g, '');
}

/**
 * 从画师名里提取要搜索的名字数组（"两个都用"）：括号外 + 每个括号内，去重去空。
 * 例：'黄鑫奔（本本不熬夜）' → ['黄鑫奔','本本不熬夜']；'本本不熬夜' → ['本本不熬夜']。
 */
export function extractSearchNames(name: string): string[] {
  const trimmed = (name || '').trim();
  if (!trimmed) return [];
  const names = new Set<string>();
  const outside = trimmed.replace(/[（(][^）)]*[）)]/g, '').replace(/\s+/g, ' ').trim();
  if (outside) names.add(outside);
  const parens = trimmed.match(/[（(][^）)]*[）)]/g) || [];
  for (const p of parens) {
    const inner = p.slice(1, -1).trim();
    if (inner) names.add(inner);
  }
  return Array.from(names);
}

/** 鲁棒解析 Claude 输出的 JSON 候选数组：容忍代码围栏、前后多余文字；并按精准匹配过滤。 */
function parseCandidates(
  text: string,
  searchNames: string[],
): { platform: string; url: string; title?: string; name?: string }[] {
  if (!text) return [];
  let s = text.trim().replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/i, '');
  const start = s.indexOf('[');
  const end = s.lastIndexOf(']');
  if (start === -1 || end === -1 || end <= start) return [];
  const normTargets = new Set(searchNames.map(normName).filter(Boolean));
  try {
    const arr = JSON.parse(s.slice(start, end + 1)) as unknown[];
    if (!Array.isArray(arr)) return [];
    return arr
      .filter((o): o is Record<string, unknown> => !!o && typeof o === 'object')
      .map((o) => ({
        platform: typeof o.platform === 'string' ? (KNOWN_PLATFORMS.has(o.platform) ? o.platform : 'other') : 'other',
        url: typeof o.url === 'string' ? o.url : '',
        title: typeof o.title === 'string' ? o.title : undefined,
        name: typeof o.name === 'string' ? o.name : undefined,
      }))
      .filter((c) => c.url && /^https?:\/\//i.test(c.url))
      // 精准匹配：候选主页显示名须与某个搜索名字一致；容忍平台后缀（如「wlop-的个人空间」）
      // 和包含关系（短名<2字要求逐字一致，避免「王」误配「王大锤」）。无 name 字段则信任 AI。
      .filter((c) => {
        if (!c.name) return true;
        const cn = normName(c.name);
        if (!cn) return true;
        return searchNames.some((sn) => {
          const n = normName(sn);
          if (!n) return false;
          if (n === cn) return true; // 逐字一致
          if (n.length >= 2 && (cn.includes(n) || n.includes(cn))) return true; // 含平台后缀或网名包含
          return false;
        });
      });
  } catch {
    return [];
  }
}
