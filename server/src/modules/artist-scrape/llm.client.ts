import { Injectable, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as https from 'https';
import * as http from 'http';

/**
 * 大模型调用客户端。
 * 接现有中转 tc-paperhub.diezhi.net 的 OpenAI 兼容端点 /v1/chat/completions。
 * 模型 deepseek-v4-pro 会产出 reasoning_content（思考块），本客户端只取 message.content 正文。
 *
 * 注：原版走 Anthropic Messages 协议（@anthropic-ai/sdk → /v1/messages），但该中转
 * 不提供 /v1/messages 端点（404），故改为 OpenAI 兼容协议，与 OcrClient 同一通道。
 * 公共签名 chat(system, messages, maxTokens?, opts?) 保持不变，调用方无需改动。
 */
@Injectable()
export class LlmClient implements OnModuleInit {
  private apiKey = '';
  private baseUrl = '';
  private readonly model: string;
  private readonly maxTokens: number;
  private readonly timeout: number;

  constructor(private readonly cfg: ConfigService) {
    this.model = this.cfg.get<string>('AI_MODEL') || 'deepseek-v4-pro';
    // thinking 与正文共享 max_tokens 配额，需给足，否则正文被思考吃光
    this.maxTokens = Number(this.cfg.get<string>('AI_MAX_TOKENS') || 8000);
    this.timeout = Number(this.cfg.get<string>('AI_TIMEOUT_MS') || 90000);
  }

  onModuleInit() {
    this.apiKey = this.cfg.get<string>('AI_API_KEY') || '';
    // 兼容配成 https://host 或 https://host/v1 两种写法，统一归一到 .../v1
    let base = (this.cfg.get<string>('AI_BASE_URL') || '').replace(/\/+$/, '');
    if (!/\/v1$/.test(base)) base += '/v1';
    this.baseUrl = base;
    if (!this.apiKey) {
      // 不抛异常阻断启动：AI 是增强功能，缺 Key 时其它接口照常工作，调用时再报错。
      // eslint-disable-next-line no-console
      console.warn('[ArtistScrape] AI_API_KEY 未配置，AI 总结将不可用');
    }
  }

  get available(): boolean {
    return !!this.apiKey;
  }

  /** 非流式调用：返回正文 + 用量。丢弃 reasoning_content。瞬时错误自动重试。
   *  maxTokens 可选覆盖；opts 可选覆盖单次调用的超时/重试次数。 */
  async chat(
    system: string,
    messages: Array<{ role: 'user' | 'assistant'; content: string }>,
    maxTokens?: number,
    opts?: { timeoutMs?: number; maxRetries?: number },
  ): Promise<{ content: string; model: string; usage: Record<string, number> }> {
    if (!this.apiKey) {
      throw new Error('AI 服务未配置（缺少 AI_API_KEY）');
    }
    const maxAttempts = (opts?.maxRetries ?? 2) + 1; // 默认 3 次（2 次重试）
    const res = await this.callWithRetry(
      () =>
        this.chatCompletion(
          system,
          messages,
          maxTokens ?? this.maxTokens,
          opts?.timeoutMs ?? this.timeout,
        ),
      maxAttempts,
    );
    const text = (res.content || '').trim();
    if (!text) {
      throw new Error('AI 未返回正文（可能思考耗尽 max_tokens，请调大 AI_MAX_TOKENS 或重试）');
    }
    return { content: text, model: res.model, usage: res.usage };
  }

  /** OpenAI 兼容 chat/completions 调用（Node https，无第三方依赖）。与 OcrClient 同一模式。 */
  private chatCompletion(
    system: string,
    messages: Array<{ role: 'user' | 'assistant'; content: string }>,
    maxTokens: number,
    timeoutMs: number,
  ): Promise<{ content: string; model: string; usage: Record<string, number> }> {
    return new Promise((resolve, reject) => {
      const body = JSON.stringify({
        model: this.model,
        max_tokens: maxTokens,
        stream: false,
        messages: [{ role: 'system', content: system }, ...messages],
      });
      const url = new URL(this.baseUrl + '/chat/completions');
      const client = url.protocol === 'http:' ? http : https;
      const req = client.request(
        url,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${this.apiKey}`,
            'Content-Length': Buffer.byteLength(body),
          },
          timeout: timeoutMs,
        },
        (res) => {
          let d = '';
          res.on('data', (c) => (d += c));
          res.on('end', () => {
            const status = res.statusCode ?? 0;
            try {
              const j = JSON.parse(d);
              if (j.error) {
                return reject(
                  Object.assign(new Error(j.error.message || JSON.stringify(j.error)), { status }),
                );
              }
              if (status >= 400) {
                return reject(
                  Object.assign(new Error(`AI接口返回 ${status}: ${d.slice(0, 200)}`), { status }),
                );
              }
              resolve({
                content: j.choices?.[0]?.message?.content || '',
                model: j.model || this.model,
                usage: (j.usage as Record<string, number>) || {},
              });
            } catch {
              reject(Object.assign(new Error('AI返回解析失败: ' + d.slice(0, 200)), { status }));
            }
          });
        },
      );
      req.on('error', (e) =>
        reject(Object.assign(e, { name: 'APIConnectionError' })),
      );
      req.on('timeout', () => {
        req.destroy();
        reject(Object.assign(new Error('AI请求超时'), { name: 'APITimeoutError' }));
      });
      req.write(body);
      req.end();
    });
  }

  /** 对瞬时错误（429/超时/5xx/连接错误）做重试。maxAttempts 含首次尝试。 */
  private async callWithRetry<T>(fn: () => Promise<T>, maxAttempts = 3): Promise<T> {
    let lastErr: unknown;
    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
      try {
        return await fn();
      } catch (err: any) {
        lastErr = err;
        const status = err?.status ?? err?.response?.status;
        const retryable =
          status === 429 ||
          (typeof status === 'number' && status >= 500) ||
          err?.name === 'APIConnectionError' ||
          err?.name === 'APITimeoutError' ||
          err?.code === 'ETIMEDOUT';
        if (!retryable || attempt === maxAttempts) throw err;
        await new Promise((r) => setTimeout(r, 500 * Math.pow(3, attempt - 1)));
      }
    }
    throw lastErr;
  }
}
