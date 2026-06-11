"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
require("reflect-metadata");
const core_1 = require("@nestjs/core");
const common_1 = require("@nestjs/common");
const path_1 = require("path");
const fs_1 = require("fs");
const app_module_1 = require("./app.module");
async function bootstrap() {
    // Ensure uploads directory exists
    const uploadsDir = (0, path_1.join)(process.cwd(), '..', 'uploads');
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
    // CORS for development
    app.enableCors({
        origin: ['http://localhost:5173', 'http://localhost:3000'],
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