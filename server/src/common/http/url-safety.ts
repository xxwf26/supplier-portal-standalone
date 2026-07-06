import * as dns from 'dns';
import * as net from 'net';

/**
 * SSRF 防护：拦截指向内网/环回/链路本地地址的 URL。
 * 移植自姐妹项目「周边可视化系统」的 urlSafety.js，供本模块的
 * xhs-fetcher（抓 HTML）与 image-download（下图，含重定向）共用——
 * 二者原先各自持有一份/漏了一处，统一到这里避免漂移。
 */

export function isBlockedIp(ip: string): boolean {
  const type = net.isIP(ip);
  if (type === 4) {
    const p = ip.split('.').map(Number);
    if (p[0] === 10) return true;
    if (p[0] === 127) return true;
    if (p[0] === 0) return true;
    if (p[0] === 172 && p[1] >= 16 && p[1] <= 31) return true;
    if (p[0] === 192 && p[1] === 168) return true;
    if (p[0] === 169 && p[1] === 254) return true;
    return false;
  }
  if (type === 6) {
    const v = ip.toLowerCase();
    if (v === '::1' || v === '::') return true;
    if (v.startsWith('fe80') || v.startsWith('fc') || v.startsWith('fd')) return true;
    if (v.startsWith('::ffff:')) return isBlockedIp(v.slice(7));
    return false;
  }
  return true;
}

/** 校验 URL 安全：仅 http/https，且解析出的 IP 不落在内网段。不安全则抛错。 */
export async function assertSafeUrl(url: string): Promise<void> {
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    throw new Error('非法 URL');
  }
  if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
    throw new Error('仅支持 http/https 链接');
  }
  if (net.isIP(parsed.hostname) && isBlockedIp(parsed.hostname)) {
    throw new Error('禁止访问内网地址');
  }
  try {
    const addrs = await dns.promises.lookup(parsed.hostname, { all: true });
    if (addrs.some((a) => isBlockedIp(a.address))) {
      throw new Error('禁止访问内网地址');
    }
  } catch (e: any) {
    if (e.message === '禁止访问内网地址') throw e;
    throw new Error('域名解析失败');
  }
}
