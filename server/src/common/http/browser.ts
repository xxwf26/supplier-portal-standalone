import type { Browser } from 'playwright';

/**
 * 无头浏览器单例管理。
 * - 全进程复用一个 chromium 实例，避免每次抓取都冷启动（省几百 ms + 内存）。
 * - 懒加载：只有真正用到浏览器抓取（如米画师）时才启动，其它链路不受影响。
 * - 调用方每次抓取应自建独立 context（隔离 cookie/存储），抓完即关。
 *
 * 移植自姐妹项目 ACG 寻源雷达的 crawl/browser.ts（已生产验证）。
 * 放在 common/http 供 artist-scrape 用，与 url-safety.ts / image-download.ts 同处。
 */
let browserPromise: Promise<Browser> | null = null;

export async function getBrowser(): Promise<Browser> {
  if (!browserPromise) {
    // 动态 import，避免未装 chromium 时拖累整个模块加载
    browserPromise = import('playwright').then(({ chromium }) =>
      chromium.launch({
        headless: true,
        args: ['--no-sandbox', '--disable-dev-shm-usage'],
      }),
    );
  }
  return browserPromise;
}

/** 进程退出时关闭浏览器（NestJS onModuleDestroy 会调用），避免 chromium 残留。 */
export async function closeBrowser(): Promise<void> {
  if (browserPromise) {
    const b = await browserPromise.catch(() => null);
    browserPromise = null;
    if (b) await b.close().catch(() => {});
  }
}
