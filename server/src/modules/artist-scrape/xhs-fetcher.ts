import * as https from 'https';
import * as http from 'http';
import * as zlib from 'zlib';
import { assertSafeUrl } from '../../common/http/url-safety';

/**
 * 小红书笔记抓取（SSR 解析法）。
 *
 * 方法来自姐妹项目「周边可视化系统」的 MetaFetcher，已生产验证：
 * 普通 HTTP GET + 完整浏览器请求头 → 从原始 HTML 里正则抠出
 * `window.__INITIAL_STATE__` 这段服务端注入的 JSON，笔记的标题/正文/作者/
 * 图片/话题标签都在里面。不用无头浏览器、不用登录、不触发登录墙。
 *
 * 适用：笔记页（/explore/...、/discovery/item/...、xhslink.com 短链）。
 * 不适用：用户主页（/user/profile/...，SSR 结构不同）。
 */

const MAX_REDIRECTS = 3;
const MAX_BODY_BYTES = 3 * 1024 * 1024; // 3MB

// 完整浏览器请求头——绕过基础反爬识别的关键（小红书会检查 Accept/语言/Sec-Fetch 等）
const BROWSER_HEADERS: Record<string, string> = {
  'User-Agent':
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
  Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8',
  'Accept-Language': 'zh-CN,zh;q=0.9,en;q=0.8',
  'Accept-Encoding': 'gzip, deflate, br',
  'Cache-Control': 'no-cache',
  'Sec-Ch-Ua': '"Not_A Brand";v="8", "Chromium";v="120", "Google Chrome";v="120"',
  'Sec-Ch-Ua-Mobile': '?0',
  'Sec-Ch-Ua-Platform': '"Windows"',
  'Sec-Fetch-Dest': 'document',
  'Sec-Fetch-Mode': 'navigate',
  'Sec-Fetch-Site': 'none',
  'Sec-Fetch-User': '?1',
  'Upgrade-Insecure-Requests': '1',
};

/** 抓取结果 */
export interface XhsNote {
  ok: boolean;
  title: string;
  desc: string;
  author: string;
  tags: string[];
  images: string[];
}

// ---- HTTP 抓取（https.get + 解压 + 重定向跟随） ----

async function fetchHtml(url: string, redirectCount = 0): Promise<string> {
  await assertSafeUrl(url);
  return new Promise((resolve, reject) => {
    const client = url.startsWith('https') ? https : http;
    const req = client.get(url, { timeout: 15000, headers: BROWSER_HEADERS }, (res) => {
      let stream: NodeJS.ReadableStream = res;
      const enc = (res.headers['content-encoding'] || '').toLowerCase();
      if (enc.includes('gzip')) stream = res.pipe(zlib.createGunzip());
      else if (enc.includes('deflate')) stream = res.pipe(zlib.createInflate());
      else if (enc.includes('br')) stream = res.pipe(zlib.createBrotliDecompress());

      // 重定向跟随（小红书短链 xhslink.com 会 302 跳到真实 /explore/...）
      if (res.statusCode && res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
        res.resume();
        if (redirectCount >= MAX_REDIRECTS) {
          reject(new Error('重定向次数过多'));
          return;
        }
        let next: string | null = null;
        try {
          next = new URL(res.headers.location, url).href;
        } catch {
          next = null;
        }
        if (!next) {
          reject(new Error('非法重定向地址'));
          return;
        }
        fetchHtml(next, redirectCount + 1).then(resolve).catch(reject);
        return;
      }

      let data = '';
      let size = 0;
      stream.on('data', (chunk: Buffer) => {
        size += chunk.length;
        if (size > MAX_BODY_BYTES) {
          req.destroy();
          reject(new Error('响应体过大'));
          return;
        }
        data += chunk.toString('utf8');
      });
      stream.on('end', () => resolve(data));
      stream.on('error', reject);
    });
    req.on('error', reject);
    req.on('timeout', () => {
      req.destroy();
      reject(new Error('timeout'));
    });
  });
}

// ---- 解析 __INITIAL_STATE__ 抠笔记数据 ----

function parseNote(html: string): XhsNote {
  const empty: XhsNote = { ok: false, title: '', desc: '', author: '', tags: [], images: [] };

  const stateMatch = html.match(/window\.__INITIAL_STATE__\s*=\s*(\{[\s\S]*?\})\s*<\/script>/);
  if (!stateMatch) return empty;

  let state: any;
  try {
    // 小红书的 state 里有裸 undefined，JSON.parse 前替换成 null
    state = JSON.parse(stateMatch[1].replace(/\bundefined\b/g, 'null'));
  } catch {
    return empty;
  }

  // 笔记详情：state.note.noteDetailMap[firstKey].note（周边库验证过的路径）
  let note: any = null;
  if (state.note?.noteDetailMap) {
    const keys = Object.keys(state.note.noteDetailMap);
    if (keys.length) note = state.note.noteDetailMap[keys[0]]?.note;
  }
  if (!note) note = state.note?.firstNote || state.note?.note;
  if (!note) return empty;

  const title: string = note.title || '';
  const desc: string = note.desc || '';
  const author: string = note.user?.nickname || note.user?.nickName || note.user?.name || '';
  const tags: string[] = (note.tagList || note.descTags || [])
    .map((t: any) => (typeof t === 'string' ? t : t?.name))
    .filter(Boolean);
  const images: string[] = (note.imageList || [])
    .map((img: any) => img.urlDefault || img.infoList?.[0]?.url || img.url)
    .filter(Boolean);

  // 有作者或标题或正文任一，才算抓到有效笔记
  const ok = !!(title || desc || author || images.length);
  return { ok, title, desc, author, tags, images };
}

/**
 * 抓取小红书笔记。成功返回 { ok:true, ... }，失败/非笔记页返回 { ok:false }。
 */
export async function fetchXhsNote(url: string): Promise<XhsNote> {
  const html = await fetchHtml(url);
  return parseNote(html);
}
