# HomeWallHub（家和智能助手总览）

本仓库用于承载“家和智能助手（JieHe Smart Assistant）”及相关自动化测试与脚本。核心应用位于目录 `jiehe-smart-assistant/`，包含 Koa.js + Vue 3 + TypeScript 的前后端项目，以及 SQLite 持久化存储。

如果你只想立即运行应用，请直接阅读并遵循：`jiehe-smart-assistant/README.md`。

## 功能总览
- 家庭空间：成员管理、角色与权限
- 任务管理：分配、状态、统计
- 库存管理：物品/批次、过期提醒、低库存统计
- 菜单与投票：家庭点菜、偏好统计
- 留言与通知：分类、置顶、@提醒、已读状态
- 共享日历：事件、参与者、提醒
- 实时推送：基于 Socket.IO 的家庭/个人频道

## 快速开始
### 环境要求
- Node.js ≥ 18
- npm ≥ 8
- SQLite（随应用自动创建，无需单独安装）

### 启动步骤（简版）
1) 克隆本仓库
```bash
git clone <your-repo> 
cd <repo-root>
```
2) 进入主应用并按子项目文档启动
```bash
cd jiehe-smart-assistant
# 详细步骤见该目录下 README（含前后端、环境变量、构建/启动命令）
```

### 数据库路径提示（开发者常见坑）
- 建议在后端始终显式设置 `DATABASE_PATH=./database/jiehe.db`，避免开发与生产路径不一致导致“双数据库文件”。
- 如你曾在 `backend/src/database/` 下生成过旧库，可在 `jiehe-smart-assistant/backend/` 内执行：
```bash
npm run db:migrate-path
```
将旧库复制到 `DATABASE_PATH` 指向的位置（默认 `backend/database/jiehe.db`）。

## 目录结构
```
<repo-root>
├─ README.md                      # 本文件
├─ jiehe-smart-assistant/         # 主应用（前后端 + 文档）
├─ tests/                         # Playwright 端到端测试
├─ playwright.config.ts           # E2E 测试配置
└─ 其他辅助文件
```

## 测试（可选）
根目录包含 Playwright 测试脚本：
```bash
npm run test:e2e           # 无头模式
npm run test:e2e:headed    # 可视化模式
```
如未安装依赖，请先执行 `npm ci`（或 `npm install`）。

## 贡献指南
- 代码注释、API/技术文档、用户指南统一使用中文
- 提交信息（commit message）建议遵循约定式提交
- 优先保证向后兼容（Never break userspace）
- 简化数据结构、消除“特殊情况”，保持实现可读性

## 许可证
- 默认遵循各子项目内声明（例如后端为 MIT）。

---
如需帮助或有改进建议，欢迎提交 Issue/PR。
