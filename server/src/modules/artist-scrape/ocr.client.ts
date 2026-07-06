import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as https from 'https';
import * as http from 'http';

/**
 * 图片 OCR 客户端（OpenAI 兼容协议 + 视觉模型）。
 *
 * 小红书很多内容画在图上，SSR 只能拿到笔记正文/标签，图上的字要靠 OCR。
 * 复用画师库现有中转 `tc-paperhub.diezhi.net`——已实测它同时支持 OpenAI 格式的
 * `/v1/chat/completions` 且 `qwen-vl-ocr` 视觉模型可用（用现有 AI_API_KEY）。
 *
 * 方法移植自姐妹项目「周边可视化系统」的 AiAnalyzer（ocrImage + 并发池 + 清洗）。
 */
@Injectable()
export class OcrClient {
  private readonly apiKey: string;
  private readonly baseUrl: string;
  private readonly model: string;

  constructor(private readonly cfg: ConfigService) {
    this.apiKey = this.cfg.get<string>('AI_API_KEY') || '';
    // 默认指向现有中转的 OpenAI 端点
    this.baseUrl = (this.cfg.get<string>('AI_OCR_BASE_URL') || 'https://tc-paperhub.diezhi.net/v1').replace(/\/$/, '');
    this.model = this.cfg.get<string>('AI_OCR_MODEL') || 'qwen-vl-ocr';
  }

  get available(): boolean {
    return !!this.apiKey;
  }

  /** OpenAI 兼容 chat/completions 调用（Node https，无第三方依赖） */
  private chatCompletion(messages: any[], maxTokens = 1500, timeoutMs = 60000): Promise<string> {
    return new Promise((resolve, reject) => {
      const body = JSON.stringify({ model: this.model, messages, max_tokens: maxTokens });
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
            try {
              const j = JSON.parse(d);
              if (j.error) return reject(new Error(j.error.message || 'OCR接口错误'));
              resolve(j.choices?.[0]?.message?.content || '');
            } catch {
              reject(new Error('OCR返回解析失败: ' + d.slice(0, 200)));
            }
          });
        },
      );
      req.on('error', reject);
      req.on('timeout', () => {
        req.destroy();
        reject(new Error('OCR请求超时'));
      });
      req.write(body);
      req.end();
    });
  }

  /** OCR 单张图片，返回识别到的文字（含少量画面描述）。失败返回空串。 */
  async ocrImage(imageUrl: string): Promise<string> {
    try {
      const content = await this.chatCompletion([
        {
          role: 'user',
          content: [
            { type: 'image_url', image_url: { url: imageUrl } },
            {
              type: 'text',
              text: '这是一位画师的作品图。请：①识别图中所有文字并原样输出；②无论有无文字，都用一句话描述画面的美术风格（如日系/古风/厚涂/线稿/Q版/写实、色彩倾向、主体题材）。只输出结果，不要解释。',
            },
          ],
        },
      ]);
      return (content || '').trim();
    } catch {
      return '';
    }
  }

  /**
   * 并发 OCR 多张图（限并发 3，单图失败跳过不拖垮整轮）。
   * 返回 [{ index, text }]，只保留有文字的。
   */
  async ocrImages(imageUrls: string[], limit = 6): Promise<{ index: number; text: string }[]> {
    const imgs = (imageUrls || []).filter(Boolean).slice(0, limit);
    if (!imgs.length || !this.available) return [];
    const results: { index: number; text: string }[] = new Array(imgs.length);
    let cursor = 0;
    const worker = async () => {
      while (cursor < imgs.length) {
        const i = cursor++;
        const text = await this.ocrImage(imgs[i]);
        results[i] = { index: i + 1, text };
      }
    };
    await Promise.all(Array.from({ length: Math.min(3, imgs.length) }, () => worker()));
    return results.filter((r) => r && r.text);
  }
}
