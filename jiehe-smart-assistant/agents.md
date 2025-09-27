# 家和智能助手 — 项目结构与运行指南（Agent专用）

> 目的：为后续智能代理/协作开发者提供统一的项目结构、启动方法、配置对齐与修复优先级参考。全文使用中文，聚焦可执行信息与落地建议。

## 1. 项目概览

- 后端：Koa2 + TypeScript + SQLite3 + Socket.IO
  - 鉴权：JWT 双令牌（访问/刷新），统一错误响应，中间件体系（限流/验证/日志）
  - 数据库：启动时自动执行 `schema.sql` 初始化，启用 WAL、外键约束
- 前端：Vue 3 + Vite + TypeScript + Vant + PWA
  - 状态：Pinia，路由守卫，Axios 拦截器（缓存/离线骨架）
  - 代理：开发态将 `/api`、`/socket.io` 代理到后端

## 2. 目录结构（缩略）

```
jiehe-smart-assistant/
├── backend/                        # Koa2 后端
│   ├── .env.example                # 环境变量模板
│   ├── package.json                # 脚本与依赖
│   ├── database/
│   │   ├── schema.sql              # 数据库建表与初始数据
│   │   └── migrations|seeds (空)
│   └── src/
│       ├── app.ts                  # 应用入口与中间件/路由装配
│       ├── config/
│       │   ├── database.ts         # SQLite 连接、WAL、schema 初始化
│       │   └── ai.ts               # AI 配置（已存在文件）
│       ├── controllers/            # 控制器（Auth/Task/Inventory 等）
│       ├── models/                 # 数据模型
│       ├── routes/                 # 路由分发（/api/*）
│       ├── middlewares/            # 错误处理/鉴权/验证中间件
│       ├── middleware/socket.ts    # Socket.IO 管理（注意目录名单数）
│       └── utils/                  # 日志/JWT/响应/校验/查询优化
├── frontend/                       # Vue3 前端
│   ├── package.json                # 开发脚本与依赖
│   ├── vite.config.ts              # 代理/PWA/分包策略
│   └── src/
│       ├── api/                    # API 封装（auth/family/task/...）
│       ├── router/index.ts         # 路由与守卫（依赖 user store）
│       ├── stores/                 # Pinia stores（family/task/...）
│       ├── utils/request.ts        # Axios 拦截器（缓存/离线/刷新）
│       └── views/                  # 视图目录（AI/Analytics/Calendar/...）
└── README.md                       # 项目级文档（启动/测试/部署）
```

## 3. 快速启动（开发）

前置：Node ≥ 18、npm ≥ 8（以后端 `package.json` 为准）

1) 后端
- 复制环境变量：在 `backend` 目录执行
  - PowerShell: `Copy-Item .env.example .env`
- 安装依赖与启动
  - `npm install`
  - `npm run dev`
- 健康检查：`http://localhost:8080/health`

2) 前端
- 安装与启动（目录：`frontend`）
  - `npm install`
  - `npm run dev`
- 代理已就绪：`/api` 与 `/socket.io` → `http://localhost:8080`

提示：根目录暂无一键脚本（`install:all`/`dev`），如需可后续新增 root `package.json` 做并发编排。


最后更新：由 Agent 基于代码与文档自动梳理（当前分支工作副本）。如发现偏差，请以实际代码为准并在此文件内迭代更正。

