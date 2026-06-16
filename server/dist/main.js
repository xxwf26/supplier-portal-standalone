"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
require("reflect-metadata");
const core_1 = require("@nestjs/core");
const common_1 = require("@nestjs/common");
const path_1 = require("path");
const fs_1 = require("fs");
const app_module_1 = require("./app.module");
async function bootstrap() {
    // 上传目录：与 UploadController 保持一致（UPLOAD_DIR 环境变量，相对路径基于 cwd 解析）
    const configuredUpload = process.env.UPLOAD_DIR || '../uploads';
    const uploadsDir = (0, path_1.isAbsolute)(configuredUpload) ? configuredUpload : (0, path_1.resolve)(process.cwd(), configuredUpload);
    if (!(0, fs_1.existsSync)(uploadsDir)) {
        (0, fs_1.mkdirSync)(uploadsDir, { recursive: true });
    }
    const app = await core_1.NestFactory.create(app_module_1.AppModule, {
        abortOnError: process.env.NODE_ENV !== 'development',
    });
    // Serve uploaded files
    app.useStaticAssets(uploadsDir, { prefix: '/uploads' });
    // Serve frontend build in production
    const clientDist = (0, path_1.join)(process.cwd(), '..', 'client', 'dist');
    if ((0, fs_1.existsSync)(clientDist)) {
        app.useStaticAssets(clientDist);
    }
    // 全局请求体校验：剥离未知字段，类型转换，校验失败返回 400
    app.useGlobalPipes(new common_1.ValidationPipe({
        whitelist: true,
        transform: true,
        transformOptions: { enableImplicitConversion: true },
    }));
    // CORS：允许的源可通过 CORS_ORIGINS 环境变量覆盖（逗号分隔）
    const corsOrigins = (process.env.CORS_ORIGINS || 'http://localhost:5174,http://localhost:5173,http://localhost:3001,http://localhost:3000')
        .split(',')
        .map((o) => o.trim())
        .filter(Boolean);
    app.enableCors({
        origin: corsOrigins,
        credentials: true,
    });
    const logger = new common_1.Logger('Bootstrap');
    const host = process.env.SERVER_HOST || 'localhost';
    const port = Number(process.env.SERVER_PORT || '3000');
    await app.listen(port, host);
    logger.log(`Server running on http://${host}:${port}`);
    logger.log(`API endpoints ready at http://${host}:${port}/api`);
}
bootstrap();
//# sourceMappingURL=main.js.map