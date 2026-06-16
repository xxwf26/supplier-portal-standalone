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
exports.UploadController = void 0;
const common_1 = require("@nestjs/common");
const platform_express_1 = require("@nestjs/platform-express");
const multer_1 = require("multer");
const path_1 = require("path");
// 上传目录：优先用 UPLOAD_DIR 环境变量；相对路径基于 server 工作目录解析为绝对路径，
// 避免因启动 cwd 不同导致文件写错位置 / 服务不到
const UPLOAD_DIR = (() => {
    const configured = process.env.UPLOAD_DIR || '../uploads';
    return (0, path_1.isAbsolute)(configured) ? configured : (0, path_1.resolve)(process.cwd(), configured);
})();
// 允许的图片扩展名（与 mimetype 双重校验，mimetype 可被伪造）
const ALLOWED_EXT = new Set(['.jpg', '.jpeg', '.png', '.gif', '.webp', '.bmp', '.svg']);
let UploadController = class UploadController {
    uploadFile(file) {
        if (!file) {
            throw new common_1.BadRequestException('未接收到文件');
        }
        return {
            url: `/uploads/${file.filename}`,
            fileName: file.originalname,
        };
    }
};
exports.UploadController = UploadController;
__decorate([
    (0, common_1.Post)(),
    (0, common_1.UseInterceptors)((0, platform_express_1.FileInterceptor)('file', {
        storage: (0, multer_1.diskStorage)({
            destination: UPLOAD_DIR,
            filename: (_req, file, cb) => {
                const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1e9);
                cb(null, uniqueSuffix + (0, path_1.extname)(file.originalname).toLowerCase());
            },
        }),
        limits: { fileSize: 10 * 1024 * 1024 }, // 10MB
        fileFilter: (_req, file, cb) => {
            const ext = (0, path_1.extname)(file.originalname).toLowerCase();
            // 同时校验 mimetype 与扩展名
            if (!file.mimetype.startsWith('image/') || !ALLOWED_EXT.has(ext)) {
                cb(new common_1.BadRequestException('只支持图片文件（jpg/png/gif/webp/bmp/svg）'), false);
            }
            else {
                cb(null, true);
            }
        },
    })),
    __param(0, (0, common_1.UploadedFile)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", void 0)
], UploadController.prototype, "uploadFile", null);
exports.UploadController = UploadController = __decorate([
    (0, common_1.Controller)('/api/upload')
], UploadController);
//# sourceMappingURL=upload.controller.js.map