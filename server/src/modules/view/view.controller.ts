import { Controller, Get, Res } from '@nestjs/common';
import type { Response } from 'express';
import { join } from 'path';
import { readFileSync, existsSync } from 'fs';

@Controller()
export class ViewController {
  @Get(['/', '/*'])
  async render(@Res() res: Response) {
    // 尝试提供前端的 index.html（生产模式）
    const indexPath = join(process.cwd(), '..', 'client', 'dist', 'index.html');
    if (existsSync(indexPath)) {
      const html = readFileSync(indexPath, 'utf-8');
      res.send(html);
    } else {
      // 开发模式提示
      res.send(`
        <!DOCTYPE html>
        <html lang="zh">
        <head>
          <meta charset="UTF-8">
          <title>供应商可视化平台</title>
        </head>
        <body>
          <div id="root"></div>
          <p style="text-align:center;margin-top:100px;color:#999;">
            前端未构建。请运行 <code>cd client && npm run dev</code> 启动前端开发服务器。<br/>
            生产环境请先执行 <code>cd client && npm run build</code> 构建前端。
          </p>
        </body>
        </html>
      `);
    }
  }
}