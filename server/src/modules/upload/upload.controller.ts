import {
  Controller,
  Post,
  UploadedFile,
  UseInterceptors,
  BadRequestException,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { diskStorage } from 'multer';
import { extname, isAbsolute, resolve } from 'path';

// 上传目录：优先用 UPLOAD_DIR 环境变量；相对路径基于 server 工作目录解析为绝对路径，
// 避免因启动 cwd 不同导致文件写错位置 / 服务不到
const UPLOAD_DIR = (() => {
  const configured = process.env.UPLOAD_DIR || '../uploads';
  return isAbsolute(configured) ? configured : resolve(process.cwd(), configured);
})();

// 允许的图片扩展名（与 mimetype 双重校验，mimetype 可被伪造）
const ALLOWED_EXT = new Set(['.jpg', '.jpeg', '.png', '.gif', '.webp', '.bmp', '.svg']);

@Controller('/api/upload')
export class UploadController {
  @Post()
  @UseInterceptors(
    FileInterceptor('file', {
      storage: diskStorage({
        destination: UPLOAD_DIR,
        filename: (_req, file, cb) => {
          const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1e9);
          cb(null, uniqueSuffix + extname(file.originalname).toLowerCase());
        },
      }),
      limits: { fileSize: 10 * 1024 * 1024 }, // 10MB
      fileFilter: (_req, file, cb) => {
        const ext = extname(file.originalname).toLowerCase();
        // 同时校验 mimetype 与扩展名
        if (!file.mimetype.startsWith('image/') || !ALLOWED_EXT.has(ext)) {
          cb(new BadRequestException('只支持图片文件（jpg/png/gif/webp/bmp/svg）'), false);
        } else {
          cb(null, true);
        }
      },
    }),
  )
  uploadFile(@UploadedFile() file: Express.Multer.File) {
    if (!file) {
      throw new BadRequestException('未接收到文件');
    }
    return {
      url: `/uploads/${file.filename}`,
      fileName: file.originalname,
    };
  }
}