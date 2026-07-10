import { IsString, IsNotEmpty } from 'class-validator';

export class RecommendLinksDto {
  /** 画师名（供应商名称）。后端据此联网搜索其平台主页链接。 */
  @IsString()
  @IsNotEmpty()
  name!: string;
}
