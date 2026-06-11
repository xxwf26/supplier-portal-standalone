# 个画资源可视化平台 (Supplier Portal Standalone)

> 美术类供应商/画师管理平台，面向营销采购岗位，提供多维度供应商筛选和管理能力。

## 技术栈

| 层级 | 技术 |
|------|------|
| 前端 | React 19 + TypeScript + Vite + Tailwind CSS 4 + shadcn/ui |
| 后端 | NestJS 10 + TypeScript |
| 数据库 | MySQL 8.0+ + Drizzle ORM |
| 其它 | Framer Motion、SheetJS (xlsx) |

## 快速开始

### 1. 环境要求

- Node.js 18+
- MySQL 8.0+
- npm

### 2. 数据库设置

创建 MySQL 数据库：

```sql
CREATE DATABASE supplier_portal CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
```

### 3. 后端配置

```bash
cd server

# 修改 .env 文件中的数据库连接信息
# DB_HOST=localhost
# DB_PORT=3306
# DB_USER=root
# DB_PASSWORD=your_password
# DB_NAME=supplier_portal

# 安装依赖
npm install

# 生成数据库迁移文件
npm run db:generate

# 执行数据库迁移（创建 suppliers 表）
npm run db:migrate

# 启动后端开发服务器
npm run start:dev
```

后端运行在 `http://localhost:3000`，API 路径为 `/api/suppliers`

### 4. 前端配置

```bash
cd client

# 安装依赖
npm install

# 启动前端开发服务器
npm run dev
```

前端运行在 `http://localhost:5173`，API 请求会自动代理到后端 `localhost:3000`

### 5. 生产构建

```bash
# 构建前端
cd client && npm run build

# 启动后端（会自动服务前端静态文件）
cd server && npm run start
```

生产环境访问 `http://localhost:3000` 即可。

## 项目结构

```
├── server/                    # NestJS 后端
│   ├── src/
│   │   ├── main.ts            # 入口
│   │   ├── app.module.ts      # 根模块
│   │   ├── database/          # 数据库 schema + 连接
│   │   ├── common/            # 公共工具（异常过滤、响应码）
│   │   └── modules/
│   │       ├── supplier/      # 供应商 CRUD API
│   │       ├── upload/        # 文件上传 API
│   │       └── view/          # 前端页面服务
│   └── .env                   # 环境变量
│
├── client/                    # React 前端
│   ├── src/
│   │   ├── pages/SupplierDashboardPage/  # 核心页面
│   │   │   ├── SupplierDashboardPage.tsx # 主页面
│   │   │   ├── HeaderSection.tsx         # 顶部统计
│   │   │   ├── FilterPanelSection.tsx    # 筛选面板
│   │   │   ├── SupplierGridSection.tsx   # 卡片网格
│   │   │   ├── SupplierDetailModal.tsx   # 详情弹窗
│   │   │   ├── ExcelImportModal.tsx      # Excel 导入
│   │   │   └── NewSupplierModal.tsx      # 新建供应商
│   │   ├── api/               # API 层
│   │   ├── components/ui/     # shadcn/ui 基础组件
│   │   ├── components/business-ui/  # 业务组件
│   │   └── lib/polyfills/     # 飞书平台 polyfills
│   └── vite.config.ts
│
├── shared/                    # 前后端共享
│   └── static/suppliers.json  # 示例数据
│
└── uploads/                   # 文件上传目录
```

## API 接口

| 方法 | 路径 | 说明 |
|------|------|------|
| GET | /api/suppliers | 供应商列表（支持筛选） |
| GET | /api/suppliers/statistics | 统计数据 |
| GET | /api/suppliers/:id | 供应商详情 |
| POST | /api/suppliers | 创建供应商 |
| PUT | /api/suppliers/:id | 更新供应商 |
| DELETE | /api/suppliers/:id | 删除供应商 |
| POST | /api/suppliers/batch | 批量导入（最多 500 条） |
| POST | /api/upload | 上传图片 |

## 导出说明

此项目从飞书 APAAS 平台应用导出并改造为独立项目。主要改动：

1. 移除 `@lark-apaas/*` 平台依赖
2. 数据库从 PostgreSQL 改为 MySQL
3. 文件上传从飞书存储改为本地存储
4. 业务组件中的飞书 API 调用替换为 mock polyfills
5. 构建工具从 Rspack 改为 Vite