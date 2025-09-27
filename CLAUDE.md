# CLAUDE.md

这个文件为 Claude Code (claude.ai/code) 在此代码库中工作时提供指导。

## 🏗️ 项目概述

这是"家和智能助手"项目，一个基于 Koa.js + Vue 3 + TypeScript 构建的智能家庭管理应用。主要功能包括任务管理、库存管理、点菜系统、共享日历、家庭留言板等。

## 🔧 开发环境和常用命令

### 项目结构
```
jiehe-smart-assistant/
├── backend/          # 后端 Koa.js 应用
├── frontend/         # 前端 Vue 3 应用
├── database/         # 数据库Schema和迁移文件
└── docs/             # 项目文档
```

### 环境要求
- Node.js: 16.x 或更高版本
- NPM: 8.x 或更高版本
- 数据库: SQLite (自动创建)

### 开发命令

#### 项目启动
```bash
# 开发模式 - 同时启动前后端
npm run dev

# 分别启动
cd backend && npm run dev    # 后端开发服务器
cd frontend && npm run dev   # 前端开发服务器
```

#### 构建和部署
```bash
# 前端构建
cd frontend && npm run build

# 后端构建
cd backend && npm run build

# 生产模式启动
cd backend && npm run start
```

#### 代码质量
```bash
# 后端
cd backend
npm run lint          # ESLint 检查
npm run lint:fix      # 自动修复lint问题
npm run format        # Prettier 格式化

# 前端
cd frontend
npm run lint          # ESLint 检查
npm run format        # Prettier 格式化
npm run type-check    # TypeScript 类型检查
```

#### 测试
```bash
# 后端测试
cd backend && npm test

# 前端测试
cd frontend && npm test
```

#### 数据库操作
```bash
cd backend
npm run migrate       # 运行数据库迁移
npm run seed         # 插入种子数据

# 手动操作SQLite数据库
sqlite3 database/jiehe.db
```

## 🎯 核心架构

### 后端架构 (backend/)
- **框架**: Koa2 + TypeScript
- **数据库**: SQLite (WAL模式) + 进程内缓存
- **认证**: JWT双令牌机制
- **实时通信**: Socket.IO (基于家庭房间隔离)
- **AI集成**: 通义千问API (预算控制)

### 前端架构 (frontend/)
- **框架**: Vue 3 + Vite + TypeScript
- **UI库**: Vant UI (移动端优化)
- **状态管理**: Pinia
- **路由**: Vue Router
- **PWA**: 支持离线功能和应用安装

### 数据库设计
- **核心表**: users, families, family_members
- **功能模块**: tasks, inventory_*, menus, calendar_events, messages
- **AI系统**: ai_budget_records, cost_records
- **分析系统**: analysis_reports, purchasing_plans

## 🚀 核心功能模块

### 1. 用户和家庭管理
- 用户注册/登录 (JWT认证)
- 家庭创建和加入 (邀请码机制)
- 成员权限管理 (admin/member角色)

### 2. 任务管理系统
- 任务CRUD操作
- 任务分配和状态管理
- 优先级和分类管理

### 3. 智能库存管理
- 多批次FIFO库存管理
- 过期提醒和智能通知
- 库存分类和统计分析

### 4. 点菜投票系统
- 菜单创建和菜品管理
- 投票机制 (点赞/反对/中性)
- 投票统计和结果分析

### 5. 共享日历系统
- 事件CRUD和重复规则
- 多人参与和状态管理
- 智能提醒系统

### 6. 家庭留言板
- 留言发布和@提醒功能
- 反应系统和评论功能
- 实时消息推送

### 7. AI智能功能
- 基于库存的菜谱推荐
- 智能任务建议
- 智能购物清单生成
- 成本分析和预算管理

## 🔌 API架构

### RESTful API 设计模式
- `/api/auth/*` - 用户认证
- `/api/families/*` - 家庭管理
- `/api/families/:id/tasks/*` - 任务管理
- `/api/families/:id/inventory/*` - 库存管理
- `/api/families/:id/menus/*` - 点菜系统
- `/api/families/:id/events/*` - 日历事件
- `/api/families/:id/messages/*` - 留言板
- `/api/ai/*` - AI服务

### Socket.IO 实时通信
- 基于family_id的房间隔离
- 实时任务更新、库存变化、新消息推送
- 在线状态和输入提示

## ⚠️ 开发注意事项

### 数据库操作
- 使用SQLite WAL模式，支持并发读写
- 所有数据操作都应包含family_id隔离
- 使用soft delete (is_active字段) 而非物理删除

### AI服务使用
- 所有AI调用都要进行预算控制
- 失败时要有本地算法降级
- 记录AI使用情况到ai_budget_records表

### 权限控制
- 所有API都需要JWT认证
- 家庭级别的数据隔离
- admin/member角色权限区分

### 前端开发
- 使用Vant UI组件，保持移动端体验
- 利用PWA功能支持离线使用
- 代码分割按功能模块进行

### 错误处理
- 统一错误响应格式
- 详细的日志记录 (logs/目录)
- 用户友好的错误提示

### 文件上传
- 限制文件类型和大小 (10MB)
- 存储在uploads/目录
- 支持图片、音频、PDF格式

## 🧪 测试和调试

### 本地开发测试
- 使用curl或Postman测试API
- 浏览器开发者工具调试前端
- SQLite数据库直接查询

### 日志查看
```bash
cd backend
tail -f logs/app.log      # 应用日志
tail -f logs/error.log    # 错误日志
```

### 数据库重置
```bash
cd backend
rm -f database/jiehe.db   # 删除数据库文件
npm run dev               # 重启自动创建新数据库
```

## 🎨 前端组件指南

### 页面组件位置
- 主要功能页面: `frontend/src/views/`
- 通用组件: `frontend/src/components/`
- API服务: `frontend/src/api/`
- 状态管理: `frontend/src/stores/`

### 移动端适配
- 所有页面都要适配移动端
- 使用Vant UI的移动端组件
- 支持触摸手势和响应式设计

### PWA功能
- 自动更新和缓存策略
- 支持应用安装到桌面
- 离线数据存储和同步

## 📚 重要文件说明

- `backend/src/app.ts` - 后端入口文件
- `backend/database/schema.sql` - 完整数据库架构
- `frontend/src/main.ts` - 前端入口文件
- `frontend/vite.config.ts` - Vite配置和PWA设置
- `.env.example` - 环境变量模板

## 🔧 配置建议

### 开发环境配置
1. 复制 `backend/.env.example` 到 `backend/.env`
2. 配置JWT密钥和通义千问API密钥
3. 设置合适的端口和CORS配置

### 生产环境注意事项
- 使用强密码的JWT密钥
- 配置适当的文件上传限制
- 设置AI预算限制避免超支
- 配置HTTPS和安全头部

通过以上指导，Claude Code 可以有效地在此项目中进行开发和维护工作。