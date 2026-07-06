/**
 * 作品图显示地址转换。
 *
 * 「识别链接」预填时，作品图是小红书 CDN 原链——浏览器 <img src> 直连会被防盗链
 * （Referer 校验）拦掉。此时改走后端图片代理 `/api/artist-scrape/img` 绕过。
 * 保存画师后图片已落地为本地 `/uploads/…`，原样返回、不再走代理。
 *
 * 幂等：本地路径 / data URI 原样返回，可安全地在所有作品图 <img src> 处套用。
 */
export function artworkSrc(url: string): string {
  if (!url) return url;
  if (/^https?:\/\//i.test(url)) {
    return `/api/artist-scrape/img?u=${encodeURIComponent(url)}`;
  }
  return url;
}
