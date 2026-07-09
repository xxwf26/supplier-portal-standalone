import { IsString } from 'class-validator';

export class ScrapeArtistDto {
  /**
   * 画师链接分享内容。可以是小红书笔记链接 / App 分享的整段「文案 + 短链 + 口令」，
   * 也可以是米画师画师主页链接——service 会从中提取 URL 并按域名分派抓取。
   */
  @IsString()
  url!: string;
}
