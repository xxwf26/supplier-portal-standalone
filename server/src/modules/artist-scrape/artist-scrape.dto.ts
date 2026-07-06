import { IsString } from 'class-validator';

export class ScrapeArtistDto {
  /**
   * 小红书分享内容。可以是纯链接，也可以是 App 分享出来的一整段
   * 「文案 + 短链 + 口令」文本——service 会从中提取出真正的 URL。
   */
  @IsString()
  url!: string;
}
