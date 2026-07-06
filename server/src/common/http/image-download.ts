import * as https from 'https';
import * as http from 'http';
import * as fs from 'fs';
import { isAbsolute, resolve, join } from 'path';
import { assertSafeUrl } from './url-safety';

/**
 * 图片下载工具：把远程图片（小红书 CDN）下载到 uploads 目录，返回可对外访问的
 * `/uploads/xxx` 路径。用于固化易过期、且有防盗链的 CDN 链接——直接把小红书
 * 图 URL 塞进 <img src> 会因 Referer 校验加载失败，下载到本地即可绕过。
 *
 * 方法移植自姐妹项目「周边可视化系统」的 imageDownload.js。
 */

// 与 UploadController / main.ts 保持一致的上传目录解析
const UPLOAD_DIR = (() => {
  const configured = process.env.UPLOAD_DIR || '../uploads';
  return isAbsolute(configured) ? configured : resolve(process.cwd(), configured);
})();

// 下载时带小红书 Referer，绕过 CDN 防盗链
const DL_HEADERS: Record<string, string> = {
  'User-Agent':
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
  Referer: 'https://www.xiaohongshu.com/',
};

/**
 * 下载单张图片到 uploads 目录，返回 `/uploads/文件名`；失败返回 null。
 * 首次与每次重定向都过 SSRF 校验（assertSafeUrl），防止被重定向到内网。
 */
async function downloadOne(url: string, prefix = 'xhs', redirect = 0): Promise<string | null> {
  if (!url || redirect > 3) return null;
  const safeUrl = url.replace(/^http:\/\//, 'https://');
  try {
    await assertSafeUrl(safeUrl);
  } catch {
    return null; // 内网/非法地址，直接放弃这张图
  }
  return new Promise((resolve2) => {
    const client = safeUrl.startsWith('https') ? https : http;
    const ext = /\.(png|jpe?g|gif|webp)/i.test(safeUrl) ? '' : '.webp';
    const filename = `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 8)}${ext}`;
    const dest = join(UPLOAD_DIR, filename);
    const file = fs.createWriteStream(dest);
    const cleanup = () => file.close(() => fs.existsSync(dest) && fs.unlinkSync(dest));

    const req = client.get(safeUrl, { timeout: 15000, headers: DL_HEADERS }, (res) => {
      if (res.statusCode && res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
        res.resume();
        cleanup();
        // 相对重定向解析成绝对地址；下一跳会再次 assertSafeUrl
        let next: string;
        try {
          next = new URL(res.headers.location, safeUrl).href;
        } catch {
          return resolve2(null);
        }
        downloadOne(next, prefix, redirect + 1).then(resolve2);
        return;
      }
      if (res.statusCode !== 200) {
        res.resume();
        cleanup();
        return resolve2(null);
      }
      res.pipe(file);
      file.on('finish', () => file.close(() => resolve2(`/uploads/${filename}`)));
      file.on('error', () => {
        cleanup();
        resolve2(null);
      });
    });
    req.on('error', () => {
      cleanup();
      resolve2(null);
    });
    req.on('timeout', () => {
      req.destroy();
      cleanup();
      resolve2(null);
    });
  });
}

/**
 * 批量下载图片到本地（限并发 3）。返回与输入等长的数组，
 * 下载成功的位置是 `/uploads/xxx`，失败的位置回退为原始 URL（至少不丢）。
 */
export async function downloadImages(urls: string[], prefix = 'xhs'): Promise<string[]> {
  const list = (urls || []).filter(Boolean);
  if (!list.length) return [];
  const out: string[] = new Array(list.length);
  let cursor = 0;
  const worker = async () => {
    while (cursor < list.length) {
      const i = cursor++;
      const local = await downloadOne(list[i], prefix);
      out[i] = local || list[i]; // 失败则保留原始 URL
    }
  };
  await Promise.all(Array.from({ length: Math.min(3, list.length) }, () => worker()));
  return out;
}

/**
 * 保存画师时「按需落地」外链图片：只把 http(s) 外链（如小红书 CDN）下载到 uploads，
 * 已是本地 `/uploads/…` 或相对路径的原样保留，顺序不变。限并发 3。
 * 下载失败的外链回退保留原链（至少不丢）。
 *
 * 用途：抓取阶段只返回 CDN 原链（不落盘，避免用户不保存产生孤儿图），
 * 真正保存画师时才调用本函数把用户最终保留的图固化到本地。
 */
export async function persistExternalImages(urls: string[], prefix = 'artwork'): Promise<string[]> {
  const list = (urls || []).filter((u): u is string => typeof u === 'string' && !!u);
  if (!list.length) return [];
  const out: string[] = new Array(list.length);
  let cursor = 0;
  const worker = async () => {
    while (cursor < list.length) {
      const i = cursor++;
      const u = list[i];
      if (/^https?:\/\//i.test(u)) {
        const local = await downloadOne(u, prefix);
        out[i] = local || u; // 下载失败保留原链
      } else {
        out[i] = u; // 本地 /uploads 或相对路径，原样保留
      }
    }
  };
  await Promise.all(Array.from({ length: Math.min(3, list.length) }, () => worker()));
  return out;
}
