"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
var __param = (this && this.__param) || function (paramIndex, decorator) {
    return function (target, key) { decorator(target, key, paramIndex); }
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.ViewController = void 0;
const common_1 = require("@nestjs/common");
const path_1 = require("path");
const fs_1 = require("fs");
let ViewController = class ViewController {
    async render(res) {
        // 尝试提供前端的 index.html（生产模式）
        const indexPath = (0, path_1.join)(process.cwd(), '..', 'client', 'dist', 'index.html');
        if ((0, fs_1.existsSync)(indexPath)) {
            const html = (0, fs_1.readFileSync)(indexPath, 'utf-8');
            res.send(html);
        }
        else {
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
};
exports.ViewController = ViewController;
__decorate([
    (0, common_1.Get)(['/', '/*']),
    __param(0, (0, common_1.Res)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", Promise)
], ViewController.prototype, "render", null);
exports.ViewController = ViewController = __decorate([
    (0, common_1.Controller)()
], ViewController);
//# sourceMappingURL=view.controller.js.map