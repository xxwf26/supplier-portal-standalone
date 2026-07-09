import type { BrowserContext } from 'playwright';
import { getBrowser } from '../../common/http/browser';
import { assertSafeUrl } from '../../common/http/url-safety';

/**
 * 米画师画师主页抓取（无头浏览器 + API 响应拦截法）。
 *
 * 为什么必须用浏览器（PoC 实测）：米画师是纯前端 SPA，HTML 是空壳、无数据；
 * 其 API 有「请求签名 + 阿里云盾风控」，纯 HTTP 抓子资源（作品/标签）会被
 * `签名错误` / `blocked r_1` 拦掉。但用真实浏览器加载画师主页时，SPA 前端会
 * 自己带上合法签名去调各 API——我们只需 page.on('response') 把这些 200 的
 * JSON 拦下来聚合即可。游客态足够，无需登录。
 *
 * 正确入口路由：https://www.mihuashi.com/users/{画师名}（按名字，触发 ?by=name）。
 * 数字 id 路由（/users/{id}）在前端是坏的，故统一重建为按 token 的规范链接。
 */

const MIHUASHI_HOST = /(^|\.)mihuashi\.com$/i;

export interface MihuashiArtist {
  ok: boolean;
  /** 画师名（昵称） */
  author: string;
  /** 画师简介 */
  about: string;
  /** 作品总数 */
  artworksCount: number;
  /** 是否认证 */
  verified: boolean;
  /** 画师认证状态（如 artist_verified） */
  artistStatus: string;
  /** 约稿档口状态（如 stall_verified） */
  stallStatus: string;
  /** 结构化风格标签（如 日系/厚涂/插图），已按作品数降序 */
  tags: string[];
  /** 作品图 CDN 原链 */
  images: string[];
  /** 规范化后的画师主页链接 */
  resolvedUrl: string;
}

const EMPTY: MihuashiArtist = {
  ok: false,
  author: '',
  about: '',
  artworksCount: 0,
  verified: false,
  artistStatus: '',
  stallStatus: '',
  tags: [],
  images: [],
  resolvedUrl: '',
};

/**
 * 从粘贴文本里已提取出的 URL 重建米画师规范画师主页链接。
 * 取路径最后一段作为画师标识 token（名字或 id），host 限定 mihuashi.com。
 * 非米画师域名 / 无 token → 返回 null。
 */
export function buildMihuashiUrl(rawUrl: string): string | null {
  let u: URL;
  try {
    u = new URL(rawUrl);
  } catch {
    return null;
  }
  if (!MIHUASHI_HOST.test(u.hostname)) return null;
  const segs = u.pathname.split('/').filter(Boolean);
  const token = segs.length ? decodeURIComponent(segs[segs.length - 1]) : '';
  if (!token) return null;
  return `https://www.mihuashi.com/users/${encodeURIComponent(token)}`;
}

/** 安全解析响应体 JSON，失败返回 null。 */
async function safeJson(text: string): Promise<any | null> {
  try {
    return JSON.parse(text);
  } catch {
    return null;
  }
}

/**
 * 抓取米画师画师主页。成功返回 { ok:true, ... }；
 * 非米画师链接 / 抓不到画师详情 → { ok:false }（前端引导「粘画师主页链接」）。
 */
export async function fetchMihuashiArtist(rawUrl: string): Promise<MihuashiArtist> {
  const target = buildMihuashiUrl(rawUrl);
  if (!target) return { ...EMPTY };

  // SSRF 校验（域名已限定 mihuashi.com，仍防解析到内网的边缘情况）
  try {
    await assertSafeUrl(target);
  } catch {
    return { ...EMPTY };
  }

  const browser = await getBrowser();
  const context: BrowserContext = await browser.newContext({
    userAgent:
      'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    viewport: { width: 1366, height: 900 },
    locale: 'zh-CN',
  });
  const page = await context.newPage();

  // 聚合拦截到的米画师 API 数据
  let user: any = null;
  const tagMap = new Map<string, number>(); // tag_name → artworks_count（去重取最大）
  const images: string[] = [];

  page.on('response', async (res) => {
    const url = res.url();
    if (!url.includes('/api/v1/') || res.request().method() !== 'GET') return;
    if (res.status() !== 200) return;
    let body: any = null;
    try {
      const ct = res.headers()['content-type'] || '';
      if (!ct.includes('json')) return;
      body = await safeJson(await res.text());
    } catch {
      return;
    }
    if (!body) return;

    // 画师详情：/api/v1/users/{name}?by=name
    if (body.user && typeof body.user === 'object') {
      user = body.user;
    }
    // 风格标签：/api/v1/users/{id}/exhibition_taggings → { exhibition_taggings: [{tag_name, artworks_count}] }
    if (Array.isArray(body.exhibition_taggings)) {
      for (const t of body.exhibition_taggings) {
        const name = (t?.tag_name || t?.name || '').toString().trim();
        if (name) tagMap.set(name, Math.max(tagMap.get(name) || 0, Number(t?.artworks_count) || 0));
      }
    }
    // 注：作品图不走 /artworks API（其阿里云盾风控不稳定、浏览器里也常 403），
    // 改为渲染后从 DOM 抓 <img>（见下方 goto 后逻辑），更可靠。
  });

  try {
    await page.goto(target, { waitUntil: 'domcontentloaded', timeout: 30000 });
    // 轮询等待画师详情到位（最多 ~15s）
    for (let i = 0; i < 15; i++) {
      if (user) break;
      await page.waitForTimeout(1000);
    }
    // 作品图（尽力而为）：滚动触发懒加载后从 DOM 抓 <img>。
    // 米画师作品网格依赖 /artworks API，而该 API 被阿里云盾**概率性风控**：
    // 冷启动浏览器首次请求常返回 200（网格渲染、可抓图），重复请求易被 403
    // （网格不渲染、抓到 0 张）。故作品图是**加分项**——抓不到也返回 ok:true，
    // 画师名/简介/认证状态/作品数/结构化风格标签才是稳定的核心价值。
    const collectImgs = `Array.from(document.querySelectorAll('img'))
      .map(function(i){ return i.currentSrc || i.src; })
      .filter(function(s){
        return s && s.indexOf('image-assets.mihuashi.com') > -1
          && (s.indexOf('/permanent/') > -1 || s.indexOf('/pfop/') > -1)
          && s.indexOf('/avatar/') === -1;
      })`;
    for (let i = 0; i < 4; i++) {
      await page.evaluate('window.scrollTo(0, document.body.scrollHeight)').catch(() => {});
      await page.waitForTimeout(1500);
      try {
        const domImgs = (await page.evaluate(collectImgs)) as string[];
        for (const raw of domImgs) {
          // 去掉 !artwork.square 之类的缩略图变换后缀，取原图
          const full = raw.split('!')[0];
          if (full && !images.includes(full)) images.push(full);
        }
      } catch {
        // DOM 抓图失败不影响主流程
      }
      if (images.length >= 12) break;
    }
  } catch {
    // 加载异常也走下方兜底：能拿到多少算多少
  } finally {
    await context.close().catch(() => {});
  }

  if (!user) return { ...EMPTY, resolvedUrl: target };

  const tags = Array.from(tagMap.entries())
    .sort((a, b) => b[1] - a[1])
    .map(([name]) => name);

  return {
    ok: true,
    author: (user.name || '').toString(),
    about: (user.about || '').toString(),
    artworksCount: Number(user.artworks_count) || 0,
    verified: !!user.is_verified,
    artistStatus: (user.artist_status || '').toString(),
    stallStatus: (user.stall_status || '').toString(),
    tags,
    images: images.slice(0, 12),
    resolvedUrl: target,
  };
}
